import test from "node:test";
import assert from "node:assert/strict";
import {
  REQUESTS_KEY,
  getAllRequests,
  getRequestById,
  updateRequestById,
  saveRequests,
  migrateLegacyClosedRequests,
} from "./storage.js";
import {
  esPropuestaElegida, esCancelado, puedeRecibirActividadDeProductores, tieneProfesionalElegido,
  puedeCancelarse, puedeEscribirEnConversacion, tieneLimiteDeMensajes,
} from "../domain/estado.js";
import { applyStartBooking, applyRequestSlot, applyConfirmSlot, applyPayDeposit } from "../domain/booking.js";

// Stub mínimo de localStorage en memoria, sin dependencias nuevas. storage.js
// sólo necesita getItem/setItem de window.localStorage — dejamos window.storage
// sin definir a propósito, para ejercitar la misma rama que corre en un
// navegador real fuera de Claude Artifacts. Se reinstala al principio de cada
// test para que ninguno vea datos de otro.
function installMemoryLocalStorage() {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
    },
  };
}

function seedRequests(requests) {
  globalThis.window.localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
}

test("getAllRequests sin datos devuelve una colección vacía", async () => {
  installMemoryLocalStorage();
  const all = await getAllRequests();
  assert.deepEqual(all, []);
});

test("getRequestById encuentra el pedido correcto", async () => {
  installMemoryLocalStorage();
  seedRequests([
    { id: "a", estado: "esperando" },
    { id: "b", estado: "con_ofertas" },
  ]);
  const found = await getRequestById("b");
  assert.equal(found.estado, "con_ofertas");
});

test("getRequestById con un id inexistente devuelve null", async () => {
  installMemoryLocalStorage();
  seedRequests([{ id: "a", estado: "esperando" }]);
  assert.equal(await getRequestById("no-existe"), null);
});

test("updateRequestById actualiza únicamente el ID indicado", async () => {
  installMemoryLocalStorage();
  seedRequests([
    { id: "a", estado: "esperando", n: 1 },
    { id: "b", estado: "esperando", n: 2 },
  ]);
  const { changed, ok, request } = await updateRequestById("a", (r) => ({ ...r, n: 99 }));
  assert.equal(changed, true);
  assert.equal(ok, true);
  assert.equal(request.n, 99);
  const all = await getAllRequests();
  assert.equal(all.find((r) => r.id === "a").n, 99);
  assert.equal(all.find((r) => r.id === "b").n, 2);
});

test("un id inexistente devuelve changed: false y no modifica la colección", async () => {
  installMemoryLocalStorage();
  seedRequests([{ id: "a", estado: "esperando" }]);
  const result = await updateRequestById("no-existe", (r) => ({ ...r, estado: "cancelado" }));
  assert.equal(result.changed, false);
  assert.equal(result.ok, false);
  assert.equal(result.request, null);
  const all = await getAllRequests();
  assert.equal(all[0].estado, "esperando");
});

test("un updater que devuelve null no guarda nada", async () => {
  installMemoryLocalStorage();
  seedRequests([{ id: "a", estado: "cancelado" }]);
  const result = await updateRequestById("a", (r) => (r.estado === "cancelado" ? null : { ...r, estado: "con_ofertas" }));
  assert.equal(result.changed, false);
  const all = await getAllRequests();
  assert.equal(all[0].estado, "cancelado");
});

test("un updater que devuelve la misma referencia recibida no guarda nada", async () => {
  installMemoryLocalStorage();
  seedRequests([{ id: "a", estado: "esperando" }]);
  const result = await updateRequestById("a", (r) => r);
  assert.equal(result.changed, false);
  assert.equal(result.ok, false);
});

test("un guard de estado puede impedir una actualización tardía (ej. timer de productor)", async () => {
  installMemoryLocalStorage();
  seedRequests([{ id: "a", estado: "propuesta_elegida", ofertas: [] }]);
  // Simula el mismo guard que usan los timers de scheduleSimulatedProducers:
  // una oferta directa tardía no debe aplicarse sobre un pedido que ya tiene
  // una propuesta elegida.
  const result = await updateRequestById("a", (r) => {
    if (r.estado === "propuesta_elegida") return null;
    return { ...r, ofertas: [...r.ofertas, { id: "oferta-tardia" }], estado: "con_ofertas" };
  });
  assert.equal(result.changed, false);
  const all = await getAllRequests();
  assert.equal(all[0].estado, "propuesta_elegida");
  assert.deepEqual(all[0].ofertas, []);
});

test("dos actualizaciones consecutivas conservan los cambios anteriores", async () => {
  installMemoryLocalStorage();
  seedRequests([{ id: "a", estado: "esperando", ofertas: [] }]);
  await updateRequestById("a", (r) => ({ ...r, ofertas: [...r.ofertas, { id: "o1" }] }));
  await updateRequestById("a", (r) => ({ ...r, ofertas: [...r.ofertas, { id: "o2" }] }));
  const mine = await getRequestById("a");
  assert.deepEqual(mine.ofertas.map((o) => o.id), ["o1", "o2"]);
});

test("migrateLegacyClosedRequests convierte 'cerrado' en 'propuesta_elegida' sin tocar otros campos", async () => {
  installMemoryLocalStorage();
  seedRequests([
    { id: "a", estado: "cerrado", chosenOfferId: "o1", resumen: "pedido legacy" },
    { id: "b", estado: "esperando" },
  ]);
  await migrateLegacyClosedRequests();
  const all = await getAllRequests();
  const a = all.find((r) => r.id === "a");
  assert.equal(a.estado, "propuesta_elegida");
  assert.equal(a.chosenOfferId, "o1");
  assert.equal(a.resumen, "pedido legacy");
  const b = all.find((r) => r.id === "b");
  assert.equal(b.estado, "esperando");
});

test("un fallo de escritura hace que updateRequestById devuelva ok: false", async () => {
  installMemoryLocalStorage();
  seedRequests([{ id: "a", estado: "esperando" }]);
  globalThis.window.localStorage.setItem = () => {
    throw new Error("quota exceeded (simulado para este test)");
  };
  // storageSet ya loguea con console.error ante un fallo real; silenciamos
  // sólo ese log esperado para este test puntual, sin ocultar el resultado
  // (seguimos comprobando `ok` más abajo).
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const result = await updateRequestById("a", (r) => ({ ...r, estado: "con_ofertas" }));
    assert.equal(result.changed, true);
    assert.equal(result.ok, false);
    assert.equal(result.request, null);
  } finally {
    console.error = originalConsoleError;
  }
});

// Reproduce la carrera real entre los timers de scheduleSimulatedProducers
// (ColabApp.jsx) y una acción del artista: usa el mismo guard de dos
// condiciones (esPropuestaElegida / esCancelado) que corre dentro de cada
// updater de esos timers, en el mismo orden en que puede darse en producción
// — la comprobación inicial ya pasó, y lo que decide si la escritura tardía
// se aplica es únicamente este guard repetido dentro del updater.
test("carrera: elegir una propuesta antes de que vuelva un callback de productor evita reabrir el pedido", async () => {
  installMemoryLocalStorage();
  seedRequests([{ id: "req-1", estado: "con_ofertas", ofertas: [{ id: "of-1", productor: "A" }], chosenOfferId: null, intereses: [] }]);

  // El artista elige una propuesta mientras un callback de productor todavía
  // no llegó a su updateRequestById (mismo guard que usa handleChoose).
  const chooseResult = await updateRequestById("req-1", (r) => {
    if (esPropuestaElegida(r.estado) || esCancelado(r.estado)) return null;
    return { ...r, estado: "propuesta_elegida", chosenOfferId: "of-1" };
  });
  assert.equal(chooseResult.changed, true);
  assert.equal(chooseResult.request.estado, "propuesta_elegida");

  // Recién ahora "llega" el callback del productor e intenta aplicar su
  // oferta directa tardía — debe abortar sin tocar nada.
  const lateOfferResult = await updateRequestById("req-1", (r) => {
    if (esPropuestaElegida(r.estado) || esCancelado(r.estado)) return null;
    return { ...r, ofertas: [...r.ofertas, { id: "of-tardia", productor: "B" }], estado: "con_ofertas" };
  });
  assert.equal(lateOfferResult.changed, false);

  const final = await getRequestById("req-1");
  assert.equal(final.estado, "propuesta_elegida");
  assert.equal(final.chosenOfferId, "of-1");
  assert.equal(final.ofertas.length, 1);
  assert.equal(final.intereses.length, 0);
});

test("carrera: cancelar el pedido antes de que vuelva un callback de productor evita un interés tardío", async () => {
  installMemoryLocalStorage();
  seedRequests([{ id: "req-2", estado: "esperando", ofertas: [], intereses: [] }]);

  const cancelResult = await updateRequestById("req-2", (r) => ({ ...r, estado: "cancelado" }));
  assert.equal(cancelResult.changed, true);

  const lateInteresResult = await updateRequestById("req-2", (r) => {
    if (esPropuestaElegida(r.estado) || esCancelado(r.estado)) return null;
    return { ...r, intereses: [...r.intereses, { id: "interes-tardio" }] };
  });
  assert.equal(lateInteresResult.changed, false);

  const final = await getRequestById("req-2");
  assert.equal(final.estado, "cancelado");
  assert.equal(final.intereses.length, 0);
});

test("saveRequests también devuelve false si la escritura falla", async () => {
  installMemoryLocalStorage();
  globalThis.window.localStorage.setItem = () => {
    throw new Error("quota exceeded (simulado para este test)");
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const ok = await saveRequests([{ id: "a", estado: "esperando" }]);
    assert.equal(ok, false);
  } finally {
    console.error = originalConsoleError;
  }
});

// --- Flujo de reserva (propuesta_elegida -> horario -> seña -> reservado) ---
// Estos tests usan exactamente las mismas funciones de app/domain/booking.js
// que llaman los handlers de ColabApp.jsx (applyStartBooking, applyRequestSlot,
// applyConfirmSlot, applyPayDeposit) — nunca reimplementan la condición de
// guard acá, para que producción y pruebas no puedan divergir.

test("un pedido reservado no puede reabrirse por un callback tardío de productor", async () => {
  installMemoryLocalStorage();
  seedRequests([{
    id: "r1",
    estado: "reservado",
    ofertas: [{ id: "of-1", productor: "A" }],
    intereses: [],
    booking: { status: "deposit_paid" },
  }]);
  // Mismo guard central que usan los timers de scheduleSimulatedProducers.
  const result = await updateRequestById("r1", (r) => {
    if (!puedeRecibirActividadDeProductores(r.estado)) return null;
    return { ...r, ofertas: [...r.ofertas, { id: "of-tardia" }], estado: "con_ofertas" };
  });
  assert.equal(result.changed, false);
  const final = await getRequestById("r1");
  assert.equal(final.estado, "reservado");
  assert.equal(final.ofertas.length, 1);
});

test("solicitar horario, confirmarlo y pagar la seña con las funciones reales de booking.js", async () => {
  installMemoryLocalStorage();
  seedRequests([{
    id: "r2",
    estado: "propuesta_elegida",
    ofertas: [{ id: "of-1", productor: "A", producerAmount: 45000 }],
    chosenOfferId: "of-1",
  }]);

  const started = await updateRequestById("r2", (r) => applyStartBooking(r, 49500));
  assert.equal(started.ok, true);
  assert.equal(started.request.booking.status, "pending_confirmation");

  const slot = started.request.booking.availableSlots[0];
  const requested = await updateRequestById("r2", (r) => applyRequestSlot(r, slot));
  assert.equal(requested.ok, true);
  assert.equal(requested.request.booking.selectedSlot.id, slot.id);
  assert.ok(requested.request.booking.balanceDueAt);

  const confirmed = await updateRequestById("r2", (r) => applyConfirmSlot(r));
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.request.booking.status, "slot_confirmed");

  const paid = await updateRequestById("r2", (r) => applyPayDeposit(r));
  assert.equal(paid.ok, true);
  assert.equal(paid.request.estado, "reservado");
  assert.equal(paid.request.booking.status, "deposit_paid");
});

test("confirmar el pago de la seña dos veces no duplica ni altera la reserva (applyPayDeposit real)", async () => {
  installMemoryLocalStorage();
  seedRequests([{
    id: "r3",
    estado: "propuesta_elegida",
    booking: {
      status: "slot_confirmed",
      selectedSlot: { id: "slot-1", label: "lunes 15:00hs", isoDate: "2026-09-08T15:00:00.000Z" },
      availableSlots: [],
      requestedAt: "2026-08-30T10:00:00.000Z",
      confirmedAt: "2026-08-30T10:05:00.000Z",
      depositPaidAt: null,
      balanceDueAt: "2026-09-07T15:00:00.000Z",
      totalAmount: 1000,
      depositAmount: 250,
      balanceAmount: 750,
    },
  }]);

  const first = await updateRequestById("r3", (r) => applyPayDeposit(r));
  assert.equal(first.changed, true);
  assert.equal(first.ok, true);
  const paidAtAfterFirst = first.request.booking.depositPaidAt;
  assert.ok(paidAtAfterFirst);

  // Segundo intento: doble click, reapertura, o el mismo callback repetido.
  const second = await updateRequestById("r3", (r) => applyPayDeposit(r));
  assert.equal(second.changed, false); // idempotente: no vuelve a aplicar el pago

  const final = await getRequestById("r3");
  assert.equal(final.estado, "reservado");
  assert.equal(final.booking.status, "deposit_paid");
  assert.equal(final.booking.depositPaidAt, paidAtAfterFirst); // no se pisó
});

test("cada transición de reserva rechaza estados incompatibles (esperando, con_ofertas, reservado, cancelado, desconocido)", async () => {
  const estadosIncompatibles = ["esperando", "con_ofertas", "reservado", "cancelado", "algo_desconocido", undefined];
  const bookingPendiente = { status: "pending_confirmation", availableSlots: [{ id: "slot-1", label: "x", isoDate: "2026-09-08T15:00:00.000Z" }], selectedSlot: null };
  const bookingConHorario = { ...bookingPendiente, selectedSlot: bookingPendiente.availableSlots[0], requestedAt: "2026-08-30T10:00:00.000Z" };
  const bookingConfirmado = { ...bookingConHorario, status: "slot_confirmed", confirmedAt: "2026-08-30T10:05:00.000Z" };

  for (const estado of estadosIncompatibles) {
    assert.equal(applyStartBooking({ estado, ofertas: [] }, 1000), null, `applyStartBooking no debería aplicarse desde "${estado}"`);
    assert.equal(applyRequestSlot({ estado, booking: bookingPendiente }, bookingPendiente.availableSlots[0]), null, `applyRequestSlot no debería aplicarse desde "${estado}"`);
    assert.equal(applyConfirmSlot({ estado, booking: bookingConHorario }), null, `applyConfirmSlot no debería aplicarse desde "${estado}"`);
    assert.equal(applyPayDeposit({ estado, booking: bookingConfirmado }), null, `applyPayDeposit no debería aplicarse desde "${estado}"`);
  }
});

test("rechazar cancelación después de elegir una propuesta o de reservar (puedeCancelarse)", async () => {
  installMemoryLocalStorage();
  seedRequests([
    { id: "activo", estado: "con_ofertas" },
    { id: "elegido", estado: "propuesta_elegida" },
    { id: "reservado1", estado: "reservado" },
  ]);
  const cancelUpdater = (r) => {
    if (!puedeCancelarse(r.estado)) return null;
    return { ...r, estado: "cancelado" };
  };

  const resultActivo = await updateRequestById("activo", cancelUpdater);
  assert.equal(resultActivo.changed, true);
  assert.equal((await getRequestById("activo")).estado, "cancelado");

  const resultElegido = await updateRequestById("elegido", cancelUpdater);
  assert.equal(resultElegido.changed, false);
  assert.equal((await getRequestById("elegido")).estado, "propuesta_elegida");

  const resultReservado = await updateRequestById("reservado1", cancelUpdater);
  assert.equal(resultReservado.changed, false);
  assert.equal((await getRequestById("reservado1")).estado, "reservado");
});

test("chat: el profesional elegido puede escribir sin límite después de reservar; los demás quedan bloqueados", async () => {
  installMemoryLocalStorage();
  const requestReservado = {
    id: "chat1",
    estado: "reservado",
    chosenOfferId: "of-elegido",
    ofertas: [{ id: "of-elegido", productor: "Tomás Ibarra" }],
  };
  seedRequests([requestReservado]);

  // El updater real de appendMessage (ConversationScreen) usa exactamente
  // estas dos funciones para decidir si puede escribir y si tiene límite.
  function puedeMandarMensaje(request, productor, mensajesPrevios) {
    if (!puedeEscribirEnConversacion(request, productor)) return false;
    if (tieneLimiteDeMensajes(request, productor) && mensajesPrevios >= 4) return false;
    return true;
  }

  assert.equal(puedeMandarMensaje(requestReservado, "Tomás Ibarra", 4), true, "el elegido debe poder mandar un quinto mensaje");
  assert.equal(puedeMandarMensaje(requestReservado, "Tomás Ibarra", 10), true, "el elegido no tiene techo de mensajes");
  assert.equal(puedeMandarMensaje(requestReservado, "Otra Productora", 0), false, "otro profesional queda bloqueado a nivel de persistencia, aunque no haya usado ningún mensaje");
});

test("chat: antes de reservar, cualquier conversación existente sigue con el límite de 4 mensajes", async () => {
  const requestPropuestaElegida = { id: "chat2", estado: "propuesta_elegida", chosenOfferId: "of-1", ofertas: [{ id: "of-1", productor: "A" }] };
  assert.equal(puedeEscribirEnConversacion(requestPropuestaElegida, "A"), true);
  assert.equal(puedeEscribirEnConversacion(requestPropuestaElegida, "B"), true); // todavía no rige la exclusividad de "reservado"
  assert.equal(tieneLimiteDeMensajes(requestPropuestaElegida, "A"), true);
  assert.equal(tieneLimiteDeMensajes(requestPropuestaElegida, "B"), true);
});

test("chat: un pedido cancelado bloquea escribir a cualquier profesional", async () => {
  const requestCancelado = { id: "chat3", estado: "cancelado", chosenOfferId: null, ofertas: [] };
  assert.equal(puedeEscribirEnConversacion(requestCancelado, "Cualquiera"), false);
});

test("un pedido guardado sin booking (formato anterior a este bloque) sigue leyéndose sin problemas", async () => {
  installMemoryLocalStorage();
  seedRequests([{ id: "legacy1", estado: "propuesta_elegida", ofertas: [{ id: "of-1", productor: "A", producerAmount: 45000 }], chosenOfferId: "of-1" }]);
  const mine = await getRequestById("legacy1");
  assert.equal(mine.booking, undefined);
  assert.equal(tieneProfesionalElegido(mine.estado), true);
  // Crear el booking por primera vez (equivalente a handleStartBooking), con
  // la misma función real, no debería fallar aunque el campo no existiera antes.
  const result = await updateRequestById("legacy1", (r) => {
    const chosen = (r.ofertas || []).find((o) => o.id === r.chosenOfferId);
    return applyStartBooking(r, chosen.producerAmount);
  });
  assert.equal(result.changed, true);
  assert.equal(result.request.booking.status, "pending_confirmation");
});
