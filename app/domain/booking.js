// Primer tramo del flujo de contratación:
// propuesta_elegida -> coordinación de horario -> pago simulado de la seña -> reservado.
// Funciones puras de cálculo, validación y transición — la orquestación con
// efectos (timers, persistencia) vive en ColabApp.jsx, que llama a estas
// mismas funciones en vez de duplicar sus reglas. Los tests también las usan
// directamente, así producción y pruebas nunca pueden divergir.
import { esPropuestaElegida } from "./estado.js";

export const BOOKING_STATUS = {
  PENDING_CONFIRMATION: "pending_confirmation",
  SLOT_CONFIRMED: "slot_confirmed",
  DEPOSIT_PAID: "deposit_paid",
};

// Tiempo simulado que tarda el productor en confirmar un horario solicitado.
export const SLOT_CONFIRMATION_DELAY_MS = 2500;

const DEPOSIT_RATE = 0.25;
const BALANCE_DUE_OFFSET_MS = 24 * 60 * 60 * 1000;

// La seña es el 25% del precio final; el saldo es el resto (no el 75%
// calculado por separado), para que ambas partes sumen siempre exactamente
// el total sin arrastre de redondeo.
export function calculateBookingAmounts(totalAmount) {
  const depositAmount = Math.round(totalAmount * DEPOSIT_RATE);
  const balanceAmount = totalAmount - depositAmount;
  return { totalAmount, depositAmount, balanceAmount };
}

// El saldo vence 24 horas antes del horario elegido. No modifica el slot
// recibido — sólo lee su isoDate y devuelve una fecha nueva.
export function calculateBalanceDueAt(slotIsoDate) {
  return new Date(new Date(slotIsoDate).getTime() - BALANCE_DUE_OFFSET_MS).toISOString();
}

function formatDateTimeLabel(isoDate, hour, minute) {
  const date = new Date(isoDate);
  const h = hour ?? date.getHours();
  const m = minute ?? date.getMinutes();
  return `${date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })} · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}hs`;
}

export function formatBalanceDueLabel(balanceDueAtIso) {
  return formatDateTimeLabel(balanceDueAtIso);
}

// Tres horarios futuros simulados y comprensibles a partir de una fecha de
// referencia. Se llama una única vez, al coordinar la reserva, y el
// resultado se persiste en booking.availableSlots — por eso no hace falta
// que sea determinística entre pedidos distintos, sólo estable una vez
// generada (no debe recalcularse en cada render).
const SLOT_OFFSETS = [
  { days: 2, hour: 15 },
  { days: 3, hour: 11 },
  { days: 5, hour: 19 },
];

export function generateAvailableSlots(referenceDate = new Date()) {
  return SLOT_OFFSETS.map(({ days, hour }, index) => {
    const date = new Date(referenceDate);
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return { id: `slot-${index + 1}`, label: formatDateTimeLabel(date.toISOString(), hour, 0), isoDate: date.toISOString() };
  });
}

// Estructura inicial de reserva para un pedido recién en "propuesta_elegida".
// Mientras no se pague la seña, el estado principal del pedido sigue siendo
// "propuesta_elegida" — sólo booking.status avanza.
export function createInitialBooking(totalAmount, referenceDate = new Date()) {
  const { depositAmount, balanceAmount } = calculateBookingAmounts(totalAmount);
  return {
    status: BOOKING_STATUS.PENDING_CONFIRMATION,
    availableSlots: generateAvailableSlots(referenceDate),
    selectedSlot: null,
    requestedAt: null,
    confirmedAt: null,
    depositPaidAt: null,
    balanceDueAt: null,
    totalAmount,
    depositAmount,
    balanceAmount,
  };
}

/* ---------------- transiciones válidas ----------------
   Cada par can-/apply- (canRequestSlot/applyRequestSlot, etc.) es la única
   fuente de verdad sobre qué transición es válida desde qué estado. Los
   handlers de ColabApp.jsx y las pruebas usan exactamente estas funciones —
   nunca reimplementan la condición aparte. Un estado incompatible
   (esperando, con_ofertas, reservado, cancelado o cualquier otro
   desconocido) nunca puede saltar a otra fase de reserva: todas exigen
   esPropuestaElegida(request.estado) primero. */

export function canStartBooking(request) {
  return !!request && esPropuestaElegida(request.estado) && !request.booking;
}

export function applyStartBooking(request, totalAmount, referenceDate = new Date()) {
  if (!canStartBooking(request)) return null;
  return { ...request, booking: createInitialBooking(totalAmount, referenceDate) };
}

export function canRequestSlot(request) {
  return !!request
    && esPropuestaElegida(request.estado)
    && !!request.booking
    && request.booking.status === BOOKING_STATUS.PENDING_CONFIRMATION
    && !request.booking.selectedSlot;
}

export function applyRequestSlot(request, slot, now = new Date()) {
  if (!canRequestSlot(request)) return null;
  return {
    ...request,
    booking: {
      ...request.booking,
      selectedSlot: slot,
      requestedAt: now.toISOString(),
      balanceDueAt: calculateBalanceDueAt(slot.isoDate),
    },
  };
}

export function canConfirmSlot(request) {
  return !!request
    && esPropuestaElegida(request.estado)
    && !!request.booking
    && request.booking.status === BOOKING_STATUS.PENDING_CONFIRMATION
    && !!request.booking.selectedSlot
    && !request.booking.confirmedAt;
}

export function applyConfirmSlot(request, now = new Date()) {
  if (!canConfirmSlot(request)) return null;
  return {
    ...request,
    booking: { ...request.booking, status: BOOKING_STATUS.SLOT_CONFIRMED, confirmedAt: now.toISOString() },
  };
}

// Cuánto falta de los SLOT_CONFIRMATION_DELAY_MS originales, contados desde
// booking.requestedAt. 0 si el plazo ya pasó (confirmar de inmediato) o si
// la transición ya no es válida (nada que confirmar).
export function getRemainingConfirmationDelay(request, now = new Date()) {
  if (!canConfirmSlot(request)) return 0;
  const elapsed = now.getTime() - new Date(request.booking.requestedAt).getTime();
  return Math.max(0, SLOT_CONFIRMATION_DELAY_MS - elapsed);
}

export function canPayDeposit(request) {
  return !!request
    && esPropuestaElegida(request.estado)
    && !!request.booking
    && request.booking.status === BOOKING_STATUS.SLOT_CONFIRMED;
}

export function applyPayDeposit(request, now = new Date()) {
  if (!canPayDeposit(request)) return null;
  return {
    ...request,
    estado: "reservado",
    booking: { ...request.booking, status: BOOKING_STATUS.DEPOSIT_PAID, depositPaidAt: now.toISOString() },
  };
}

/* ---------------- fase visual ----------------
   Deriva qué pantalla de BookingFlow corresponde mostrar, a partir
   exclusivamente de request.estado y request.booking — nunca de un estado
   de navegación propio del componente. Cualquier combinación que no
   corresponda a una fase real y consistente cae en "inconsistent": nunca se
   interpreta como reserva confirmada por descarte. */
export function getBookingPhase(request) {
  const estado = request?.estado;
  const booking = request?.booking;

  if (!booking) {
    return esPropuestaElegida(estado) ? "not_started" : "inconsistent";
  }
  if (!esPropuestaElegida(estado) && estado !== "reservado") return "inconsistent";

  switch (booking.status) {
    case BOOKING_STATUS.PENDING_CONFIRMATION:
      if (estado === "reservado") return "inconsistent";
      return booking.selectedSlot ? "awaiting_confirmation" : "choose_slot";
    case BOOKING_STATUS.SLOT_CONFIRMED:
      if (estado === "reservado" || !booking.selectedSlot) return "inconsistent";
      return "slot_confirmed";
    case BOOKING_STATUS.DEPOSIT_PAID:
      return estado === "reservado" && !!booking.selectedSlot ? "confirmed" : "inconsistent";
    default:
      return "inconsistent";
  }
}
