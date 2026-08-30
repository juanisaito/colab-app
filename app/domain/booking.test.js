import test from "node:test";
import assert from "node:assert/strict";
import {
  BOOKING_STATUS, SLOT_CONFIRMATION_DELAY_MS,
  calculateBookingAmounts, generateAvailableSlots, createInitialBooking,
  calculateBalanceDueAt, formatBalanceDueLabel,
  canStartBooking, applyStartBooking,
  canRequestSlot, applyRequestSlot,
  canConfirmSlot, applyConfirmSlot, getRemainingConfirmationDelay,
  canPayDeposit, applyPayDeposit,
  getBookingPhase,
} from "./booking.js";

test("calculateBookingAmounts calcula 25%/75% y ambas partes suman el total exacto", () => {
  for (const total of [1000, 45000, 49500, 101, 333, 0]) {
    const { depositAmount, balanceAmount } = calculateBookingAmounts(total);
    assert.equal(depositAmount, Math.round(total * 0.25));
    assert.equal(depositAmount + balanceAmount, total);
  }
});

test("generateAvailableSlots devuelve tres horarios futuros y estables para la misma fecha de referencia", () => {
  const reference = new Date("2026-08-30T12:00:00.000Z");
  const first = generateAvailableSlots(reference);
  const second = generateAvailableSlots(reference);
  assert.equal(first.length, 3);
  assert.deepEqual(first, second);
  first.forEach((slot) => {
    assert.ok(new Date(slot.isoDate).getTime() > reference.getTime());
    assert.ok(slot.label.length > 0);
    assert.ok(slot.id);
  });
});

test("los estados válidos del flujo de reserva son pending_confirmation, slot_confirmed y deposit_paid", () => {
  assert.deepEqual(
    Object.values(BOOKING_STATUS).sort(),
    ["deposit_paid", "pending_confirmation", "slot_confirmed"].sort()
  );
});

test("createInitialBooking arranca en pending_confirmation, sin horario elegido y con los montos ya calculados", () => {
  const booking = createInitialBooking(1000);
  assert.equal(booking.status, BOOKING_STATUS.PENDING_CONFIRMATION);
  assert.equal(booking.totalAmount, 1000);
  assert.equal(booking.depositAmount + booking.balanceAmount, 1000);
  assert.equal(booking.selectedSlot, null);
  assert.equal(booking.requestedAt, null);
  assert.equal(booking.confirmedAt, null);
  assert.equal(booking.depositPaidAt, null);
  assert.equal(booking.balanceDueAt, null);
  assert.equal(booking.availableSlots.length, 3);
});

test("calculateBalanceDueAt vence exactamente 24 horas antes del horario, sin modificar el slot", () => {
  const slot = { id: "slot-1", label: "x", isoDate: "2026-09-08T15:00:00.000Z" };
  const dueAt = calculateBalanceDueAt(slot.isoDate);
  assert.equal(dueAt, "2026-09-07T15:00:00.000Z");
  assert.equal(new Date(slot.isoDate).getTime() - new Date(dueAt).getTime(), 24 * 60 * 60 * 1000);
  // No debe mutar el slot recibido.
  assert.equal(slot.isoDate, "2026-09-08T15:00:00.000Z");
});

test("formatBalanceDueLabel devuelve una etiqueta legible no vacía", () => {
  const label = formatBalanceDueLabel("2026-09-07T15:00:00.000Z");
  assert.equal(typeof label, "string");
  assert.ok(label.length > 0);
});

/* ---------------- transiciones: rechazan estados incompatibles ---------------- */

const PROPUESTA_ELEGIDA = { estado: "propuesta_elegida", ofertas: [] };
const SLOT = { id: "slot-1", label: "x", isoDate: "2026-09-08T15:00:00.000Z" };
const REQUESTED_AT = new Date("2026-08-30T10:00:00.000Z");

function createStableBooking() {
  return createInitialBooking(1000, new Date("2026-09-01T12:00:00.000Z"));
}

function createRequestedRequest() {
  const booking = createStableBooking();
  return applyRequestSlot({ ...PROPUESTA_ELEGIDA, booking }, booking.availableSlots[0], REQUESTED_AT);
}

function createConfirmedRequest() {
  return applyConfirmSlot(createRequestedRequest(), new Date("2026-08-30T10:00:02.500Z"));
}

test("canStartBooking / applyStartBooking: sólo desde propuesta_elegida (o legacy 'cerrado') y sin booking previo", () => {
  assert.equal(canStartBooking({ estado: "propuesta_elegida" }), true);
  assert.equal(canStartBooking({ estado: "cerrado" }), true); // legacy
  assert.equal(canStartBooking({ estado: "propuesta_elegida", booking: {} }), false); // ya existe
  for (const estado of ["esperando", "con_ofertas", "reservado", "cancelado", undefined]) {
    assert.equal(canStartBooking({ estado }), false, `no debería permitir crear booking desde "${estado}"`);
  }
  assert.equal(applyStartBooking({ estado: "esperando" }, 1000), null);
  const started = applyStartBooking(PROPUESTA_ELEGIDA, 1000);
  assert.equal(started.booking.status, BOOKING_STATUS.PENDING_CONFIRMATION);
});

test("canRequestSlot / applyRequestSlot: sólo con booking pendiente y sin horario ya solicitado", () => {
  const booking = createStableBooking();
  const conBooking = { ...PROPUESTA_ELEGIDA, booking };
  const availableSlot = booking.availableSlots[0];
  assert.equal(canRequestSlot(conBooking, availableSlot.id), true);
  assert.equal(canRequestSlot(conBooking, "slot-inventado"), false);
  assert.equal(canRequestSlot({ ...conBooking, booking: { ...booking, selectedSlot: availableSlot } }, availableSlot.id), false); // ya solicitado
  assert.equal(canRequestSlot({ ...conBooking, booking: { ...booking, status: "slot_confirmed" } }, availableSlot.id), false);
  assert.equal(canRequestSlot({ estado: "reservado", booking }, availableSlot.id), false);
  assert.equal(applyRequestSlot({ estado: "cancelado", booking }, SLOT), null);
  assert.equal(applyRequestSlot(conBooking, { id: "slot-inventado", label: "falso", isoDate: SLOT.isoDate }), null);
  const requested = applyRequestSlot(conBooking, { ...availableSlot, label: "texto manipulado" }, REQUESTED_AT);
  assert.deepEqual(requested.booking.selectedSlot, availableSlot, "debe persistir el slot canónico, no el objeto recibido desde la UI");
  assert.ok(requested.booking.requestedAt);
  assert.equal(requested.booking.balanceDueAt, calculateBalanceDueAt(availableSlot.isoDate));
});

test("canConfirmSlot / applyConfirmSlot: sólo con horario solicitado y sin confirmar todavía", () => {
  const conHorario = createRequestedRequest();
  const { booking } = conHorario;
  assert.equal(canConfirmSlot(conHorario), true);
  assert.equal(canConfirmSlot({ ...conHorario, booking: { ...booking, confirmedAt: new Date().toISOString() } }), false); // ya confirmado
  assert.equal(canConfirmSlot({ ...conHorario, booking: { ...booking, selectedSlot: null } }), false); // sin horario
  assert.equal(canConfirmSlot({
    ...conHorario,
    booking: {
      ...booking,
      selectedSlot: { ...booking.selectedSlot, isoDate: "2099-01-01T10:00:00.000Z" },
      balanceDueAt: calculateBalanceDueAt("2099-01-01T10:00:00.000Z"),
    },
  }), false); // el horario elegido debe coincidir con el slot canónico disponible
  assert.equal(canConfirmSlot({ estado: "cancelado", booking }), false);
  const confirmed = applyConfirmSlot(conHorario);
  assert.equal(confirmed.booking.status, BOOKING_STATUS.SLOT_CONFIRMED);
  // Aplicarlo una segunda vez sobre el resultado ya confirmado es un no-op:
  // esto es lo que evita que dos timers de confirmación duplicados (uno real
  // y uno que debería haberse desprogramado) corrompan el estado.
  assert.equal(applyConfirmSlot(confirmed), null);
});

test("canPayDeposit / applyPayDeposit: sólo con el horario ya confirmado", () => {
  const listo = createConfirmedRequest();
  const bookingConfirmado = listo.booking;
  assert.equal(canPayDeposit(listo), true);
  assert.equal(canPayDeposit({ ...listo, booking: { ...bookingConfirmado, status: "pending_confirmation" } }), false);
  assert.equal(canPayDeposit({ estado: "cancelado", booking: bookingConfirmado }), false);
  assert.equal(canPayDeposit({ ...listo, booking: { ...bookingConfirmado, confirmedAt: null } }), false);
  assert.equal(canPayDeposit({ ...listo, booking: { ...bookingConfirmado, selectedSlot: null } }), false);
  assert.equal(canPayDeposit({ ...listo, booking: { ...bookingConfirmado, balanceAmount: 999 } }), false);
  const paid = applyPayDeposit(listo);
  assert.equal(paid.estado, "reservado");
  assert.equal(paid.booking.status, BOOKING_STATUS.DEPOSIT_PAID);
});

/* ---------------- recuperación del timer de confirmación tras una recarga ---------------- */

test("getRemainingConfirmationDelay: reabrir un pedido pendiente antes de vencer devuelve el tiempo restante real", () => {
  const now = new Date(REQUESTED_AT.getTime() + 1000); // pasó 1s de los 2.5s originales
  const request = createRequestedRequest();
  assert.equal(getRemainingConfirmationDelay(request, now), SLOT_CONFIRMATION_DELAY_MS - 1000);
});

test("getRemainingConfirmationDelay: reabrir un pedido pendiente después de vencido el plazo confirma de inmediato (0ms)", () => {
  const now = new Date(REQUESTED_AT.getTime() + 10000); // pasaron 10s, mucho más que 2.5s
  const request = createRequestedRequest();
  assert.equal(getRemainingConfirmationDelay(request, now), 0);
  // Y esa confirmación "inmediata" sigue siendo una transición válida.
  assert.equal(canConfirmSlot(request), true);
});

test("getRemainingConfirmationDelay es 0 si ya no hay nada que confirmar (evita programar un timer de más)", () => {
  const requestedAt = new Date("2026-08-30T10:00:00.000Z");
  const bookingYaConfirmado = { ...createInitialBooking(1000), selectedSlot: SLOT, requestedAt: requestedAt.toISOString(), status: BOOKING_STATUS.SLOT_CONFIRMED, confirmedAt: requestedAt.toISOString() };
  assert.equal(getRemainingConfirmationDelay({ ...PROPUESTA_ELEGIDA, booking: bookingYaConfirmado }), 0);
});

/* ---------------- fase visual: nunca "confirmado" por descarte ---------------- */

test("getBookingPhase: un booking desconocido o inconsistente nunca aparece como reserva confirmada", () => {
  // estado "reservado" pero booking no está en deposit_paid.
  assert.equal(getBookingPhase({ estado: "reservado", booking: { status: "slot_confirmed", selectedSlot: SLOT } }), "inconsistent");
  // booking.status desconocido.
  assert.equal(getBookingPhase({ estado: "propuesta_elegida", booking: { status: "algo_raro" } }), "inconsistent");
  // deposit_paid pero el estado principal no es "reservado" (no debería poder pasar, pero si pasa no debe mostrarse como pagado).
  assert.equal(getBookingPhase({ estado: "propuesta_elegida", booking: { status: "deposit_paid", selectedSlot: SLOT } }), "inconsistent");
  // deposit_paid sin selectedSlot.
  assert.equal(getBookingPhase({ estado: "reservado", booking: { status: "deposit_paid", selectedSlot: null } }), "inconsistent");
  // slot_confirmed sin selectedSlot.
  assert.equal(getBookingPhase({ estado: "propuesta_elegida", booking: { status: "slot_confirmed", selectedSlot: null } }), "inconsistent");
  // Estado esperando/con_ofertas/cancelado con un booking presente (no debería darse) nunca es una fase real.
  assert.equal(getBookingPhase({ estado: "esperando", booking: createInitialBooking(1000) }), "inconsistent");
  assert.equal(getBookingPhase({ estado: "cancelado", booking: createInitialBooking(1000) }), "inconsistent");
});

test("getBookingPhase: la única fase 'confirmed' es deposit_paid + estado reservado + horario presente", () => {
  const paid = applyPayDeposit(createConfirmedRequest(), new Date("2026-08-30T10:00:03.000Z"));
  assert.equal(getBookingPhase(paid), "confirmed");
  assert.equal(getBookingPhase({ ...paid, booking: { ...paid.booking, depositPaidAt: null } }), "inconsistent");
});

test("getBookingPhase: fases normales del recorrido", () => {
  assert.equal(getBookingPhase({ estado: "propuesta_elegida", booking: null }), "not_started");
  const initial = { ...PROPUESTA_ELEGIDA, booking: createStableBooking() };
  assert.equal(getBookingPhase(initial), "choose_slot");
  const conHorario = createRequestedRequest();
  assert.equal(getBookingPhase(conHorario), "awaiting_confirmation");
  const confirmado = createConfirmedRequest();
  assert.equal(getBookingPhase(confirmado), "slot_confirmed");
});
