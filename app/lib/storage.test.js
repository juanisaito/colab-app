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
import { esPropuestaElegida, esCancelado } from "../domain/estado.js";

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
