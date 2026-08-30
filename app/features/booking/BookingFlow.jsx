import React, { useState } from "react";
import { COLORS } from "../../theme.js";
import { Label, PrimaryButton, SecondaryButton, ProducerPhoto, BigOption } from "../../ui/pieces.jsx";
import { formatMoney } from "../../lib/format.js";
import { calculateArtistFinalPrice } from "../../domain/pricing.js";
import { getBookingPhase, formatBalanceDueLabel, calculateBalanceDueAt } from "../../domain/booking.js";

/* ============================================================
   Se muestra dentro de WaitingScreen (ColabApp.jsx) — no es una pantalla
   propia — cuando el pedido tiene un profesional elegido: cubre todo el
   primer tramo de contratación — propuesta_elegida -> coordinar horario ->
   confirmación simulada -> pagar la seña -> reservado.

   Qué fase mostrar se deriva por completo de getBookingPhase(estado,
   booking), nunca de un estado de navegación propio de este componente, así
   sobrevive un "‹ Atrás" o una recarga sin lógica aparte: cada fase
   simplemente vuelve a leer dónde quedó `booking.status`. Una combinación
   inconsistente (booking desconocido, o que no corresponde al estado real)
   nunca se interpreta como reserva confirmada por descarte — cae en su
   propia fase "inconsistent" con un aviso recuperable.
   ============================================================ */
export default function BookingFlow({ estado, booking, chosenOffer, onStartBooking, onRequestSlot, onPayDeposit, onRefresh }) {
  const [pickedSlotId, setPickedSlotId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (!chosenOffer) return null;
  const precioFinal = calculateArtistFinalPrice(chosenOffer.producerAmount);
  const phase = getBookingPhase({ estado, booking });

  async function startBooking() {
    setStarting(true);
    setActionError(null);
    const ok = await onStartBooking();
    setStarting(false);
    if (!ok) {
      setActionError("No pudimos empezar a coordinar la reserva. Probá de nuevo.");
      return;
    }
    await onRefresh();
  }

  async function requestSlot() {
    const slot = (booking.availableSlots || []).find((s) => s.id === pickedSlotId);
    if (!slot) return;
    setRequesting(true);
    setActionError(null);
    const ok = await onRequestSlot(slot);
    setRequesting(false);
    if (!ok) {
      setActionError("No pudimos solicitar ese horario. Probá de nuevo.");
      return;
    }
    await onRefresh();
  }

  async function confirmPayment() {
    setPaying(true);
    setActionError(null);
    const { changed, ok } = await onPayDeposit();
    setPaying(false);
    // changed: false puede ser un reintento sobre un pago que ya se había
    // confirmado (idempotente) — en ese caso no es un error, sólo refrescamos.
    if (changed && !ok) {
      setActionError("No pudimos confirmar el pago simulado. Probá de nuevo.");
      return;
    }
    await onRefresh();
  }

  const producerHeader = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
      <ProducerPhoto name={chosenOffer.productor} width={48} height={48} radius={11} />
      <div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, color: COLORS.text, fontSize: 16 }}>{chosenOffer.productor}</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12.5 }}>
          {chosenOffer.modalidadTipo}{chosenOffer.zona ? ` · ${chosenOffer.zona}` : ""}
        </div>
      </div>
    </div>
  );

  // El saldo vence 24hs antes del horario — booking.balanceDueAt ya viene
  // calculado desde que se solicitó el horario; el fallback sólo cubre un
  // booking creado antes de que existiera ese campo.
  function balanceDueLabel() {
    if (!booking?.selectedSlot) return null;
    return formatBalanceDueLabel(booking.balanceDueAt || calculateBalanceDueAt(booking.selectedSlot.isoDate));
  }

  if (phase === "not_started") {
    return (
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 26px" }}>
        {producerHeader}
        <div style={{ marginBottom: 18 }}>
          <Label>Trabajo incluido</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>{chosenOffer.incluye}</p>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, color: COLORS.text, fontWeight: 600 }}>{formatMoney(precioFinal)}</div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12.5, marginTop: 2 }}>Precio final</div>
        </div>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12.5, lineHeight: 1.5, marginBottom: 20 }}>
          Todavía no está confirmado. El siguiente paso es coordinar horario, reserva y pago con {chosenOffer.productor}.
        </p>
        {actionError && <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginBottom: 12 }}>{actionError}</p>}
        <PrimaryButton full disabled={starting} onClick={startBooking}>{starting ? "Un momento…" : "Coordinar reserva"}</PrimaryButton>
      </div>
    );
  }

  if (phase === "choose_slot") {
    return (
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 26px" }}>
        <h2 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 19, color: COLORS.text, margin: "0 0 8px", lineHeight: 1.3 }}>Elegí un horario</h2>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
          Horarios simulados para este prototipo — {chosenOffer.productor} todavía tiene que confirmarlo.
        </p>
        <div>
          {(booking.availableSlots || []).map((slot) => (
            <BigOption key={slot.id} label={slot.label} selected={pickedSlotId === slot.id} onClick={() => setPickedSlotId(slot.id)} />
          ))}
        </div>
        {actionError && <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, margin: "14px 0 0" }}>{actionError}</p>}
        <div style={{ marginTop: 22 }}>
          <PrimaryButton full disabled={!pickedSlotId || requesting} onClick={requestSlot}>{requesting ? "Solicitando…" : "Solicitar horario"}</PrimaryButton>
        </div>
      </div>
    );
  }

  if (phase === "awaiting_confirmation") {
    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "safe center", alignItems: "center", textAlign: "center", padding: "0 26px 26px" }}>
        <h2 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 19, color: COLORS.text, margin: "0 0 10px", lineHeight: 1.3 }}>
          Esperando confirmación
        </h2>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
          Le avisamos a {chosenOffer.productor} que pediste {booking.selectedSlot.label}. Te confirmamos apenas responda.
        </p>
      </div>
    );
  }

  if (phase === "slot_confirmed") {
    if (showPayment) {
      return (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 26px" }}>
          <h2 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 19, color: COLORS.text, margin: "0 0 4px", lineHeight: 1.3 }}>
            Pagar seña
          </h2>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 0.4, color: COLORS.accent, margin: "0 0 18px", textTransform: "uppercase" }}>
            Simulación: no se realizará ningún cobro
          </p>
          <div style={{ marginBottom: 14 }}>
            <Label>Total final</Label>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 15, margin: 0 }}>{formatMoney(booking.totalAmount)}</p>
          </div>
          <div style={{ marginBottom: 14 }}>
            <Label>Seña a pagar ahora</Label>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 15, margin: 0 }}>{formatMoney(booking.depositAmount)}</p>
          </div>
          <div style={{ marginBottom: 22 }}>
            <Label>Saldo pendiente</Label>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 15, margin: 0 }}>{formatMoney(booking.balanceAmount)}</p>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12, marginTop: 4 }}>
              Vence el {balanceDueLabel()} (24 horas antes de la sesión).
            </p>
          </div>
          {actionError && <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginBottom: 12 }}>{actionError}</p>}
          <div style={{ display: "flex", gap: 9 }}>
            <SecondaryButton full disabled={paying} onClick={() => setShowPayment(false)}>Volver</SecondaryButton>
            <PrimaryButton full disabled={paying} onClick={confirmPayment}>{paying ? "Confirmando…" : "Confirmar pago (simulado)"}</PrimaryButton>
          </div>
        </div>
      );
    }
    return (
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 26px" }}>
        {producerHeader}
        <div style={{ marginBottom: 14 }}>
          <Label>Horario confirmado</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 14, margin: 0 }}>{booking.selectedSlot.label}</p>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Label>Alcance</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>{chosenOffer.incluye}</p>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Label>Total final</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 15, margin: 0 }}>{formatMoney(booking.totalAmount)}</p>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Label>Seña (25%)</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 15, margin: 0 }}>{formatMoney(booking.depositAmount)}</p>
        </div>
        <div style={{ marginBottom: 22 }}>
          <Label>Saldo (75%)</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 15, margin: 0 }}>{formatMoney(booking.balanceAmount)}</p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12, marginTop: 4 }}>
            El saldo vence el {balanceDueLabel()} (24 horas antes de la sesión).
          </p>
        </div>
        <PrimaryButton full onClick={() => setShowPayment(true)}>Pagar seña</PrimaryButton>
      </div>
    );
  }

  if (phase === "confirmed") {
    return (
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>✓</span>
          </div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 0.6, color: COLORS.accent, textTransform: "uppercase" }}>Reserva confirmada</span>
        </div>
        {producerHeader}
        <div style={{ marginBottom: 14 }}>
          <Label>Horario</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 14, margin: 0 }}>{booking.selectedSlot?.label}</p>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Label>Total</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 15, margin: 0 }}>{formatMoney(booking.totalAmount)}</p>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Label>Seña pagada</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 15, margin: 0 }}>{formatMoney(booking.depositAmount)}</p>
        </div>
        <div style={{ marginBottom: 22 }}>
          <Label>Saldo pendiente</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 15, margin: 0 }}>{formatMoney(booking.balanceAmount)}</p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12, marginTop: 4 }}>
            Vence el {balanceDueLabel()} (24 horas antes de la sesión).
          </p>
        </div>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
          La dirección exacta se comparte más adelante, cuando corresponda.
        </p>
      </div>
    );
  }

  // phase === "inconsistent": un booking desconocido o que no corresponde al
  // estado real del pedido nunca se muestra como reserva confirmada por
  // descarte — se ofrece un estado recuperable, sin afirmar ningún pago.
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "safe center", alignItems: "center", textAlign: "center", padding: "0 26px 26px" }}>
      <h2 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 19, color: COLORS.text, margin: "0 0 10px", lineHeight: 1.3 }}>
        No pudimos cargar el estado de esta reserva
      </h2>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 20px" }}>
        Volvé a intentarlo en un momento. Si el problema sigue, contactanos desde Ayuda y soporte.
      </p>
      <SecondaryButton full onClick={onRefresh}>Reintentar</SecondaryButton>
    </div>
  );
}
