"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { COLORS } from "./theme.js";
import BottomNav from "./BottomNav.jsx";
import { HomeScreen, OrdersScreen, MessagesScreen, ProfileScreen, HelpScreen, PrivacyScreen, EditNameScreen } from "./RootScreens.jsx";
import { PrimaryButton, SecondaryButton, TextLink, Label, UnderlineField, underlineInputStyle, Screen, ProducerPhoto, BigOption } from "./ui/pieces.jsx";
import { uid } from "./lib/id.js";
import { formatMoney } from "./lib/format.js";
import {
  PROFILE_KEY, storageGet, storageSet,
  getAllRequests, getRequestById, updateRequestById, saveRequests,
  migrateLegacyClosedRequests,
} from "./lib/storage.js";
import {
  esCancelado, tieneProfesionalElegido, puedeRecibirActividadDeProductores,
  puedeCancelarse, puedeEscribirEnConversacion, tieneLimiteDeMensajes,
} from "./domain/estado.js";
import { GENRE_LABELS, detectGeneros } from "./domain/genres.js";
import { interpretRequest } from "./domain/interpretation.js";
import { calculateArtistFinalPrice } from "./domain/pricing.js";
import { pickProducers, getCuratedAlternatives, pickProducerPath, buildOfferFrom, findProducerByName } from "./domain/matching.js";
import { sanitizeContextForClassification } from "./domain/contextSanitize.js";
import {
  applyStartBooking, applyRequestSlot,
  canConfirmSlot, applyConfirmSlot, getRemainingConfirmationDelay,
  applyPayDeposit,
} from "./domain/booking.js";
import BookingFlow from "./features/booking/BookingFlow.jsx";
import { createInitialBooking } from "./domain/booking.js";

/* ============================================================
   COLAB — prototipo navegable del flujo del artista
   Build 5 — suma edición de un pedido ya publicado (con reasignación
   simulada de productores), sobre la lógica auditada del Build 4:
   matching, recuperación, edición previa a publicar y chat.
   Ver context.md para el historial completo de decisiones.
   ============================================================ */

// Punto 8: contador configurable de mensajes previos a la oferta.
const MAX_PRE_OFFER_MESSAGES_PER_PERSON = 4;

/* ---------------- piezas visuales propias de este flujo ---------------- */

function AttachRow({ label, attached, busy, onToggle }) {
  return (
    <button
      onClick={onToggle}
      disabled={busy}
      className="press"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        background: "none",
        border: "none",
        borderBottom: `1px solid ${COLORS.border}`,
        padding: "14px 2px",
        cursor: busy ? "default" : "pointer",
      }}
    >
      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, color: attached ? COLORS.text : COLORS.muted, fontWeight: attached ? 700 : 500 }}>
        {label}
      </span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: attached ? COLORS.accent : COLORS.muted }}>
        {busy ? "…" : attached ? "✓ adjuntado" : "Adjuntar"}
      </span>
    </button>
  );
}

// Punto 10: textura sutil y ESTÁTICA (sin animación, sin violeta, sin blur
// fuerte) — no un fondo decorativo, solo una insinuación de vida musical.
function Textura() {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 82% 0%, ${COLORS.accent}14, transparent 42%)` }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 5px)",
        }}
      />
    </div>
  );
}

/* ---------------- pantalla: registro mínimo ---------------- */

function Gate({ onDone }) {
  const [step, setStep] = useState("auth");
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gateError, setGateError] = useState(null);
  const [provider, setProvider] = useState(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const artistExamples = ["Duki", "Saito", "CND", "Prize", "J4mes", "Tysan", "Dillom", "K4"];

  function beginAuth(nextProvider) {
    setProvider(nextProvider);
    setGateError(null);
    if (nextProvider === "email") {
      setStep("email");
      return;
    }
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      setStep("name");
    }, 600);
  }

  function continueWithEmail() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setGateError("Escribí un mail válido para continuar.");
      return;
    }
    setGateError(null);
    setStep("name");
  }

  async function finishGate() {
    setSaving(true);
    setGateError(null);
    const ok = await onDone({ name: name.trim(), provider, email: provider === "email" ? email.trim() : null });
    setSaving(false);
    if (!ok) setGateError("No pudimos guardar tu perfil. Probá de nuevo.");
  }

  if (step === "auth") {
    return (
      <Screen>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, color: COLORS.accent, marginBottom: 14 }}>COLAB</div>
        <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 26, color: COLORS.text, lineHeight: 1.25, margin: "0 0 26px" }}>
          Para empezar, conectá tu cuenta.
        </h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <PrimaryButton full disabled={connecting} onClick={() => beginAuth("google")}>
            {connecting && provider === "google" ? "Conectando…" : "Continuar con Google"}
          </PrimaryButton>
          <SecondaryButton full disabled={connecting} onClick={() => beginAuth("apple")}>
            {connecting && provider === "apple" ? "Conectando…" : "Continuar con Apple"}
          </SecondaryButton>
          <SecondaryButton full disabled={connecting} onClick={() => beginAuth("email")}>Continuar con mail</SecondaryButton>
        </div>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 11.5, lineHeight: 1.45, margin: "16px 0 0" }}>
          Apple Music se conecta después, si querés usarlo para compartir referencias. No es lo mismo que iniciar sesión con Apple.
        </p>
      </Screen>
    );
  }

  if (step === "email") {
    return (
      <Screen topSlot={<TextLink onClick={() => setStep("auth")}>‹ Atrás</TextLink>}>
        <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 24, color: COLORS.text, lineHeight: 1.3, margin: "0 0 22px" }}>¿Cuál es tu mail?</h1>
        <UnderlineField value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="vos@ejemplo.com" autoFocus onKeyDown={(e) => e.key === "Enter" && continueWithEmail()} />
        {gateError && <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginTop: 10 }}>{gateError}</p>}
        <div style={{ marginTop: 24 }}><PrimaryButton full onClick={continueWithEmail}>Continuar</PrimaryButton></div>
      </Screen>
    );
  }

  return (
    <Screen topSlot={<TextLink onClick={() => setStep("auth")}>‹ Atrás</TextLink>}>
      <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 24, color: COLORS.text, lineHeight: 1.3, margin: "0 0 8px" }}>
        ¿Cuál es tu nombre artístico?
      </h1>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13, lineHeight: 1.5, margin: "0 0 24px" }}>
        Es el nombre con el que te van a conocer los productores.
      </p>
      <div style={{ position: "relative" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          autoFocus
          style={{ ...underlineInputStyle, position: "relative", zIndex: 2 }}
        />
        {!name && (
          <div style={{ position: "absolute", inset: "8px 0 auto", pointerEvents: "none", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 17 }}>
            <AnimatedExamples examples={artistExamples} />
          </div>
        )}
        <div style={{ height: 1, background: nameFocused ? COLORS.accent : COLORS.border, transition: "background .15s ease" }} />
      </div>
      {gateError && <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginTop: 10 }}>{gateError}</p>}
      <div style={{ marginTop: 24 }}>
        <PrimaryButton full disabled={name.trim().length < 2 || saving} onClick={finishGate}>
          {saving ? "Guardando…" : "Continuar"}
        </PrimaryButton>
      </div>
    </Screen>
  );
}

/* ---------------- pantalla: inicio + búsqueda por IA ---------------- */

export function AnimatedExamples({ examples }) {
  const [displayed, setDisplayed] = useState("");
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState("typing");

  useEffect(() => {
    const current = examples[index];
    let t;
    if (phase === "typing") {
      if (displayed.length < current.length) {
        t = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), 42);
      } else {
        t = setTimeout(() => setPhase("pausing"), 1300);
      }
    } else if (phase === "pausing") {
      t = setTimeout(() => setPhase("deleting"), 700);
    } else {
      if (displayed.length > 0) {
        t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 22);
      } else {
        setIndex((i) => (i + 1) % examples.length);
        setPhase("typing");
      }
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed, phase, index]);

  return (
    <span style={{ color: COLORS.muted }}>
      {displayed}
      <span className="blink-caret">|</span>
    </span>
  );
}

function StartScreen({ onSubmit, interpreting, error, initialText, onExit, exitLabel, confirmExitBeforeDiscard }) {
  const [text, setText] = useState(initialText || "");
  const [focused, setFocused] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  // Punto 6: solo los 4 casos principales entre los ejemplos. Tuner/sonidista/
  // camps funcionan si se escriben, pero no aparecen acá.
  const examples = ["Quiero grabar una canción", "Quiero hacer una canción", "Quiero terminar un tema", "Quiero mezclar mi canción"];

  const showAnimated = text.length === 0 && !focused;
  const showStaticHint = text.length === 0 && focused;

  function handleExitClick() {
    if (confirmExitBeforeDiscard) setConfirmingExit(true);
    else onExit();
  }

  return (
    <Screen
      topSlot={
        !onExit ? null : confirmingExit ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: COLORS.muted }}>¿Salir sin guardar tu pedido?</span>
            <TextLink onClick={onExit}>Sí, salir</TextLink>
            <TextLink onClick={() => setConfirmingExit(false)}>Seguir</TextLink>
          </div>
        ) : (
          <TextLink onClick={handleExitClick}>{exitLabel}</TextLink>
        )
      }
    >
      <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 27, color: COLORS.text, lineHeight: 1.2, margin: "0 0 8px" }}>
        Tu próxima canción, en marcha.
      </h1>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 26px" }}>
        Encontramos a quién puede resolverlo con vos.
      </p>

      {/* Punto 6: entrada principal visible, no solo un placeholder que desaparece. */}
      <Label>¿Qué querés hacer?</Label>

      <div style={{ position: "relative", marginTop: 4 }}>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.currentTarget.style.height = "64px";
            e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 104)}px`;
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={2}
          disabled={interpreting}
          style={{ ...underlineInputStyle, position: "relative", zIndex: 2, resize: "none", lineHeight: 1.45, height: 64, minHeight: 64, maxHeight: 104, overflowY: "auto" }}
        />
        {text.length === 0 && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "8px 0", pointerEvents: "none", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 17, lineHeight: 1.5 }}>
            {showStaticHint ? (
              <span style={{ color: COLORS.muted }}>Escribí con tus palabras…</span>
            ) : (
              showAnimated && <AnimatedExamples examples={examples} />
            )}
          </div>
        )}
        <div style={{ height: 1, background: focused ? COLORS.accent : COLORS.border, transition: "background .15s ease" }} />
      </div>

      {error && <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginTop: 10 }}>{error}</p>}

      <div style={{ marginTop: 30 }}>
        <PrimaryButton full disabled={text.trim().length < 3 || interpreting} onClick={() => onSubmit(text.trim())}>
          Continuar
        </PrimaryButton>
      </div>
    </Screen>
  );
}

/* ---------------- pantalla: preguntas de contexto ---------------- */

function ContextStep({ classification, initialContext, reviewExisting, onComplete, onBack }) {
  const { tipo, modalidad, modalidad_fuente, datos_faltantes, locationText, timeSlot, referencia: referenciaTexto } = classification;

  const [modalidadElegida, setModalidadElegida] = useState(initialContext?.modalidad ?? (modalidad_fuente !== "desconocida" ? modalidad : null));
  const [modalidadReviewed, setModalidadReviewed] = useState(!reviewExisting);
  const initialLocation = initialContext?.ubicacion ?? locationText ?? null;
  const [ubicacion, setUbicacion] = useState(initialLocation);
  const [coordinates, setCoordinates] = useState(initialContext?.coordinates || null);
  const [ubicacionModo, setUbicacionModo] = useState(
    initialLocation === "Cerca mío" ? initialLocation : initialLocation ? "Elegir zona" : null
  );
  const zoneOptions = ["Palermo", "Villa Crespo", "Almagro", "Colegiales", "Belgrano", "Caballito", "Chacarita"];
  const animatedZoneExamples = ["Palermo", "Belgrano", "Villa Crespo", "Almagro", "Colegiales", "Caballito", "Chacarita", "Boedo"];
  const [customZoneVisible, setCustomZoneVisible] = useState(!!initialLocation && initialLocation !== "Cerca mío" && !zoneOptions.includes(initialLocation));
  const [locationPermissionPrompt, setLocationPermissionPrompt] = useState(false);
  const [franja, setFranja] = useState(initialContext?.franja ?? timeSlot ?? null);
  const [locationReviewed, setLocationReviewed] = useState(!reviewExisting);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [datoFaltanteTexto, setDatoFaltanteTexto] = useState(initialContext?.datoFaltanteTexto ?? "");
  const [datoFaltanteConfirmado, setDatoFaltanteConfirmado] = useState(!!initialContext?.datoFaltanteConfirmado && !reviewExisting);

  const [referenciaLink, setReferenciaLink] = useState(initialContext?.referenciaLink ?? "");
  const [archivoAdjunto, setArchivoAdjunto] = useState(!!initialContext?.archivoAdjunto);
  const [archivoNombre, setArchivoNombre] = useState(initialContext?.archivoNombre ?? null);
  const [audioAdjunto, setAudioAdjunto] = useState(!!initialContext?.audioAdjunto);
  const [adjuntando, setAdjuntando] = useState(null);
  const [referenciaConfirmada, setReferenciaConfirmada] = useState(!!initialContext?.referenciaOfrecida && !reviewExisting);
  const [showProtection, setShowProtection] = useState(false);
  const [generos, setGeneros] = useState(initialContext?.generos || []);
  const [generosConfirmados, setGenerosConfirmados] = useState(!!initialContext?.generosConfirmados && !reviewExisting);
  const [generosInferidos, setGenerosInferidos] = useState([]);
  const fileInputRef = useRef(null);
  const genreInferenceApplied = useRef(false);

  const needsModalidad = tipo === "hacer" && (!modalidadElegida || !modalidadReviewed);
  const needsUbicacionFranja = (tipo === "grabar" || (tipo === "hacer" && modalidadElegida === "presencial")) && (!ubicacion || !franja || !locationReviewed);
  const needsDatoFaltante = tipo === "especial" && (datos_faltantes || []).includes("fecha_hora") && !datoFaltanteConfirmado;
  const needsReferencia = !referenciaTexto && !referenciaConfirmada;
  const needsGeneros = !generosConfirmados;

  let phase = "done";
  if (needsModalidad) phase = "modalidad";
  else if (needsUbicacionFranja) phase = "ubicacion_franja";
  else if (needsDatoFaltante) phase = "dato_faltante";
  else if (needsReferencia) phase = "referencia";
  else if (needsGeneros) phase = "generos";

  useEffect(() => {
    if (phase === "done") {
      onComplete({
        modalidad: modalidadElegida,
        ubicacion,
        coordinates,
        franja,
        datoFaltanteTexto: datoFaltanteTexto || null,
        datoFaltanteConfirmado,
        referenciaLink: referenciaLink.trim() || null,
        archivoAdjunto,
        archivoNombre,
        audioAdjunto,
        referenciaOfrecida: true,
        generos,
        generosConfirmados: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "generos" || genreInferenceApplied.current) return;
    genreInferenceApplied.current = true;
    if (generos.length > 0) return;
    const inferenceText = [classification.originalText, classification.summary, referenciaTexto, referenciaLink, archivoNombre].filter(Boolean).join(" ");
    const inferred = detectGeneros(inferenceText).filter((genre) => GENRE_LABELS[genre]);
    if (inferred.length > 0) {
      setGeneros(inferred);
      setGenerosInferidos(inferred);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "done") return null;

  function toggleArchivo() {
    if (archivoAdjunto) {
      setArchivoAdjunto(false);
      setArchivoNombre(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    fileInputRef.current?.click();
  }
  function handleFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setArchivoNombre(file.name);
    setArchivoAdjunto(true);
  }
  function toggleAudio() {
    if (audioAdjunto) return setAudioAdjunto(false);
    setAdjuntando("audio");
    setTimeout(() => {
      setAdjuntando(null);
      setAudioAdjunto(true);
    }, 700);
  }

  function chooseLocationMode(option) {
    setUbicacionModo(option);
    setLocationError(null);
    if (option === "Elegir zona") {
      setCoordinates(null);
      setLocationPermissionPrompt(false);
      if (ubicacion === "Cerca mío") setUbicacion(null);
      return;
    }
    setUbicacion(null);
    setCoordinates(null);
    setCustomZoneVisible(false);
    setLocationPermissionPrompt(true);
  }

  function requestCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("No pudimos acceder a tu ubicación. Podés elegir una zona manualmente.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
        setUbicacion("Cerca mío");
        setLocationPermissionPrompt(false);
        setLocating(false);
      },
      () => {
        setLocationError("No pudimos acceder a tu ubicación. Podés elegir una zona manualmente.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }

  function selectZone(zone) {
    setCoordinates(null);
    setLocationError(null);
    if (zone === "Otra zona") {
      setCustomZoneVisible(true);
      setUbicacion(null);
      return;
    }
    setCustomZoneVisible(false);
    setUbicacion(zone);
  }

  const qHeading = { fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 22, color: COLORS.text, margin: "0 0 22px", lineHeight: 1.3 };
  const hayAlgunaReferencia = referenciaLink.trim() || archivoAdjunto || audioAdjunto;
  const genreOptions = [
    ["Urbano", "urbano"], ["Trap", "trap"], ["Reggaetón", "reggaeton"], ["Pop", "pop"],
    ["Rock", "rock"], ["Indie / alternativo", "alternativo"], ["Electrónica", "electronica"], ["Todavía no sé", "no_se"],
  ];
  function toggleGenero(value) {
    if (value === "no_se") return setGeneros(generos.includes("no_se") ? [] : ["no_se"]);
    setGeneros((current) => current.includes(value) ? current.filter((g) => g !== value) : [...current.filter((g) => g !== "no_se"), value]);
  }

  return (
    <Screen topSlot={<TextLink onClick={onBack}>‹ Atrás</TextLink>}>
      <div key={phase} className="q-fade">
        {phase === "modalidad" && (
          <>
            <h2 style={qHeading}>¿Cómo preferís hacerlo?</h2>
            <div>
              {["Presencial", "Online", "Puedo de las dos formas"].map((op) => {
                const val = op === "Presencial" ? "presencial" : op === "Online" ? "online" : "me_da_igual";
                return <BigOption key={op} label={op} selected={modalidadElegida === val} onClick={() => {
                  setModalidadElegida(val);
                  setModalidadReviewed(true);
                  if (val !== "presencial") {
                    setUbicacion(null);
                    setCoordinates(null);
                    setFranja(null);
                  }
                }} />;
              })}
            </div>
          </>
        )}

        {phase === "ubicacion_franja" && (
          <>
            <h2 style={qHeading}>Ubicación y horario</h2>
            <div style={{ marginBottom: 22 }}>
              <Label>Ubicación</Label>
              <div>
                {["Cerca mío", "Elegir zona"].map((op) => (
                  <BigOption
                    key={op}
                    label={op === "Cerca mío" && locating ? "Ubicando…" : op}
                    selected={ubicacionModo === op}
                    onClick={() => chooseLocationMode(op)}
                  />
                ))}
              </div>
              {ubicacionModo === "Cerca mío" && locationPermissionPrompt && (
                <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: 12, marginTop: 10 }}>
                  <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12.5, lineHeight: 1.45, margin: "0 0 10px" }}>
                    Activá tu ubicación para mostrarte estudios y productores cerca.
                  </p>
                  <SecondaryButton full disabled={locating} onClick={requestCurrentLocation}>{locating ? "ubicando…" : "activar ubicación"}</SecondaryButton>
                </div>
              )}
              {ubicacionModo === "Elegir zona" && (
                <div style={{ marginTop: 10 }}>
                  <div>
                    {[...zoneOptions, "Otra zona"].map((zone) => (
                      <BigOption key={zone} label={zone} selected={zone === "Otra zona" ? customZoneVisible : ubicacion === zone} onClick={() => selectZone(zone)} />
                    ))}
                  </div>
                  {customZoneVisible && (
                    <div style={{ marginTop: 10, position: "relative" }}>
                      <input
                        value={ubicacion || ""}
                        onChange={(e) => { setUbicacion(e.target.value); setCoordinates(null); }}
                        autoFocus
                        style={{ ...underlineInputStyle, position: "relative", zIndex: 2, fontSize: 14.5 }}
                      />
                      {!ubicacion && (
                        <div style={{ position: "absolute", inset: "8px 0 auto", pointerEvents: "none", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14.5 }}>
                          <AnimatedExamples examples={animatedZoneExamples} />
                        </div>
                      )}
                      <div style={{ height: 1, background: COLORS.accent }} />
                    </div>
                  )}
                </div>
              )}
              {locationError && <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, lineHeight: 1.4, margin: "10px 0 0" }}>{locationError}</p>}
            </div>
            <div>
              <Label>Horario</Label>
              <div>
                {["Mañana", "Tarde", "Noche", "Me adapto"].map((op) => (
                  <BigOption key={op} label={op} selected={franja === op} onClick={() => setFranja(op)} />
                ))}
              </div>
            </div>
            {reviewExisting && ubicacion && franja && !locationReviewed && (
              <div style={{ marginTop: 22 }}>
                <PrimaryButton full onClick={() => setLocationReviewed(true)}>Continuar</PrimaryButton>
              </div>
            )}
          </>
        )}

        {phase === "dato_faltante" && (
          <>
            <h2 style={qHeading}>¿Qué día y horario te queda bien?</h2>
            <UnderlineField value={datoFaltanteTexto} onChange={(e) => setDatoFaltanteTexto(e.target.value)} placeholder="Ej: sábado a la noche" autoFocus />
            <div style={{ marginTop: 26 }}>
              <PrimaryButton full disabled={datoFaltanteTexto.trim().length === 0} onClick={() => setDatoFaltanteConfirmado(true)}>
                Continuar
              </PrimaryButton>
            </div>
          </>
        )}

        {phase === "referencia" && (
          <>
            <h2 style={qHeading}>Maqueta o referencia</h2>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 20px" }}>
              La usamos para entender sonido, clima y referencias. Después te mostramos qué entendimos para que puedas confirmarlo o cambiarlo.
            </p>

            <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aiff,.flac,.zip" onChange={handleFileSelected} style={{ display: "none" }} />
            <AttachRow label={archivoNombre || "Adjuntar archivo del artista"} attached={archivoAdjunto} busy={adjuntando === "archivo"} onToggle={toggleArchivo} />
            <AttachRow label="Grabar audio" attached={audioAdjunto} busy={adjuntando === "audio"} onToggle={toggleAudio} />
            <div style={{ marginTop: 14 }}>
              <UnderlineField value={referenciaLink} onChange={(e) => setReferenciaLink(e.target.value)} placeholder="O pegá un enlace (Spotify, etc.)" small />
            </div>

            <button onClick={() => setShowProtection((v) => !v)} style={{ background: "none", border: "none", padding: "14px 0 0", color: COLORS.muted, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>
              {showProtection ? "Ocultar" : "Cómo cuidamos tu material"}
            </button>
            {showProtection && (
              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, marginTop: 10 }}>
                <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
                  No se publica en tu perfil. Sólo debería verlo la gente invitada a este pedido y COLAB no adquiere derechos sobre tu obra. En este prototipo el archivo no sale de tu dispositivo: guardamos únicamente su nombre.
                </p>
              </div>
            )}

            <div style={{ marginTop: 26 }}>
              <PrimaryButton full onClick={() => setReferenciaConfirmada(true)}>
                {hayAlgunaReferencia ? "Continuar" : "Continuar sin agregar nada"}
              </PrimaryButton>
              {!hayAlgunaReferencia && (
                <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 11.5, lineHeight: 1.45, textAlign: "center", margin: "10px 12px 0" }}>
                  Sin una referencia, puede llevarnos un poco más de tiempo encontrar productores que encajen.
                </p>
              )}
            </div>
          </>
        )}

        {phase === "generos" && (
          <>
            <h2 style={qHeading}>{generosInferidos.length > 0 ? "¿Va por acá?" : "¿Por dónde va tu música?"}</h2>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13.5, lineHeight: 1.5, margin: "-10px 0 18px" }}>
              {generosInferidos.length > 0
                ? `Detectamos ${generosInferidos.map((genre) => GENRE_LABELS[genre]).join(" y ")}. Confirmalo o cambialo antes de seguir.`
                : "Elegí todos los que quieras. Nos ayuda a acercarte productores, no te encasilla."}
            </p>
            <div>
              {genreOptions.map(([label, value]) => <BigOption key={value} label={label} selected={generos.includes(value)} onClick={() => toggleGenero(value)} />)}
            </div>
            <div style={{ marginTop: 26 }}>
              <PrimaryButton full disabled={generos.length === 0} onClick={() => setGenerosConfirmados(true)}>Continuar</PrimaryButton>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}

/* ---------------- pantalla: resumen editable ---------------- */

function SummaryScreen({ classification, context, onEdit, onPublish, publishing, publishError, editing }) {
  const { title, summary, originalText, referencia: referenciaClasif, usedFallback } = classification;
  const detalles = [];
  if (context.ubicacion) detalles.push(context.ubicacion);
  if (context.franja) detalles.push(context.franja);
  if (context.datoFaltanteTexto) detalles.push(context.datoFaltanteTexto);
  if (context.modalidad === "online") detalles.push("Online");

  const refBits = [];
  if (context.referenciaLink) refBits.push(context.referenciaLink);
  if (context.archivoAdjunto) refBits.push(context.archivoNombre || "archivo adjunto");
  if (context.audioAdjunto) refBits.push("audio adjunto");
  const refTexto = referenciaClasif || (refBits.length ? refBits.join(" · ") : null);
  const genreLabels = { urbano: "Urbano", trap: "Trap", reggaeton: "Reggaetón", pop: "Pop", rock: "Rock", alternativo: "Indie / alternativo", electronica: "Electrónica", no_se: "Sin definir" };
  const generosTexto = (context.generos || []).map((g) => genreLabels[g] || g).join(" · ");

  return (
    <Screen topSlot={<TextLink onClick={onEdit}>‹ Atrás</TextLink>}>
      <Label>{title}</Label>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 16.5, lineHeight: 1.5, margin: "0 0 12px" }}>{summary}</p>
      {refTexto && <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13, margin: "0 0 6px" }}>Referencia: {refTexto}</p>}
      {generosTexto && <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13, margin: "0 0 6px" }}>Géneros: {generosTexto}</p>}
      {detalles.length > 0 && (
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13, margin: 0 }}>{detalles.join(" · ")}</p>
      )}

      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12, lineHeight: 1.4, marginTop: 22 }}>
        Tu texto original: “{originalText}”
      </p>

      {usedFallback && (
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 11.5, lineHeight: 1.4, marginTop: 10 }}>
          No pudimos usar la interpretación asistida esta vez — usamos una versión simplificada. Revisá que esté bien antes de publicar.
        </p>
      )}
      {publishError && (
        <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginTop: 14 }}>
          {editing ? "No pudimos actualizar tu pedido. Probá de nuevo." : "No pudimos publicar tu pedido. Probá de nuevo."}
        </p>
      )}
      {editing && (
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 11.5, lineHeight: 1.45, marginTop: 10 }}>
          Al actualizar, las conversaciones y propuestas que ya tenías se cierran y volvemos a buscar productores con los datos nuevos.
        </p>
      )}

      <div style={{ marginTop: 26 }}>
        <PrimaryButton full disabled={publishing} onClick={onPublish}>
          {publishing ? (editing ? "Actualizando…" : "Publicando…") : editing ? "Actualizar pedido" : "Publicar pedido"}
        </PrimaryButton>
      </div>
    </Screen>
  );
}

/* ---------------- pantalla: conversación limitada previa a la oferta ---------------- */

const CANNED_PRODUCER_REPLIES = [
  "Buenísimo. ¿Qué es lo que más te importa cuidar de la canción?",
  "Dale, me sirve. ¿Tenés alguna referencia aunque sea de sonido o clima?",
  "Perfecto, con eso ya entiendo mejor por dónde encararlo.",
];

function ConversationScreen({ request, interes, onBack, onOfferGenerated, formalOfferExists = false, returnLabel, readOnly = false, readOnlyMessage, unlimited = false }) {
  const initialMessages = interes.mensajes?.length
    ? interes.mensajes
    : [{ from: "productor", text: interes.pregunta, createdAt: interes.createdAt || new Date().toISOString() }];
  const [mensajes, setMensajes] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [requestingOffer, setRequestingOffer] = useState(false);
  const [conversationError, setConversationError] = useState(null);
  const [offerJustGenerated, setOfferJustGenerated] = useState(false);
  const scrollRef = useRef(null);
  const replyTimerRef = useRef(null);

  const misMensajes = mensajes.filter((m) => m.from === "artista").length;
  const mensajesProductor = mensajes.filter((m) => m.from === "productor").length;
  // Tras pagar la seña, el chat con el profesional elegido queda sin límite
  // de mensajes (unlimited=true) — el resto de los profesionales quedan como
  // historial de sólo lectura (readOnly), no por límite de mensajes.
  const atLimit = !unlimited && misMensajes >= MAX_PRE_OFFER_MESSAGES_PER_PERSON;
  // El productor arranca la conversación con una pregunta "gratis" que ya cuenta
  // como uno de sus cuatro mensajes. Por eso su límite se cumple un mensaje antes
  // que el del artista: la oferta puede generarse automáticamente sin que el
  // artista haya llegado todavía a su propio límite visible.
  const offerAvailable = formalOfferExists || offerJustGenerated;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes]);

  useEffect(() => () => {
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
  }, []);

  // Cada escritura parte del estado persistido más reciente. Así dos callbacks
  // nunca pisan mensajes anteriores y el límite se aplica a ambos participantes.
  async function appendMessage(message) {
    let nextMessages = null;
    const { ok } = await updateRequestById(request.id, (r) => {
      // No confiamos en `readOnly`/`unlimited` (props calculadas al
      // renderizar, con el estado que tenía la request cuando se abrió la
      // pantalla) — volvemos a decidir con el estado real que acaba de leer
      // updateRequestById: "cancelado" bloquea siempre; "reservado" sólo
      // permite escribir al profesional elegido (chosenOfferId), y ahí sin
      // límite de mensajes; antes de "reservado" (incluida
      // "propuesta_elegida") cualquier conversación existente sigue
      // permitida, sujeta al límite de 4 mensajes de siempre.
      if (!puedeEscribirEnConversacion(r, interes.productor)) return null;
      const sinLimite = !tieneLimiteDeMensajes(r, interes.productor);
      const intereses = r.intereses.map((it) => {
        if (it.id !== interes.id) return it;
        const currentMessages = it.mensajes?.length
          ? it.mensajes
          : [{ from: "productor", text: it.pregunta, createdAt: it.createdAt || new Date().toISOString() }];
        const senderCount = currentMessages.filter((m) => m.from === message.from).length;
        if (!sinLimite && senderCount >= MAX_PRE_OFFER_MESSAGES_PER_PERSON) {
          nextMessages = currentMessages;
          return it;
        }
        nextMessages = [...currentMessages, message];
        return { ...it, mensajes: nextMessages };
      });
      if (nextMessages === null) return null;
      return { ...r, intereses };
    });
    return ok ? nextMessages : null;
  }

  async function send() {
    const t = input.trim();
    if (!t || sending || atLimit || readOnly) return;
    setSending(true);
    setConversationError(null);
    const withArtista = await appendMessage({ from: "artista", text: t, createdAt: new Date().toISOString() });
    if (!withArtista) {
      setConversationError("No pudimos guardar el mensaje. Probá de nuevo.");
      setSending(false);
      return;
    }
    setMensajes(withArtista);
    setInput("");
    const producerCountNow = withArtista.filter((m) => m.from === "productor").length;
    if (!unlimited && producerCountNow >= MAX_PRE_OFFER_MESSAGES_PER_PERSON) {
      setSending(false);
      return;
    }
    replyTimerRef.current = setTimeout(async () => {
      const idx = Math.min(withArtista.filter((m) => m.from === "artista").length - 1, CANNED_PRODUCER_REPLIES.length - 1);
      const withProductor = await appendMessage({ from: "productor", text: CANNED_PRODUCER_REPLIES[idx], createdAt: new Date().toISOString() });
      if (withProductor) {
        setMensajes(withProductor);
        setSending(false);
        replyTimerRef.current = null;
        if (!offerAvailable && withProductor.filter((m) => m.from === "productor").length >= MAX_PRE_OFFER_MESSAGES_PER_PERSON) {
          await generateFormalOffer();
        }
      } else {
        setConversationError("No pudimos guardar la respuesta. Podés volver atrás y reintentar.");
        setSending(false);
        replyTimerRef.current = null;
      }
    }, 900);
  }

  // En el flujo vigente decide el productor: la oferta se genera después de
  // reunir suficiente información, no porque el artista la fuerce con un botón.
  // No saca al artista del chat: como el productor arranca con una pregunta que
  // ya cuenta como su primer mensaje, este momento puede llegar antes de que el
  // artista haya usado sus propios cuatro mensajes, y sacarlo de golpe se los
  // cortaría sin aviso.
  async function generateFormalOffer() {
    if (offerAvailable) return;
    if (replyTimerRef.current) {
      clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }
    setRequestingOffer(true);
    setConversationError(null);
    const oferta = buildOfferFrom(interes);
    const { changed, ok } = await updateRequestById(request.id, (r) => {
      // Una oferta nueva de otro productor no debe pisar una propuesta ya
      // elegida, un pedido reservado ni reabrir uno cancelado.
      if (!puedeRecibirActividadDeProductores(r.estado)) return null;
      const intereses = r.intereses.map((it) => (it.id === interes.id ? { ...it, resuelto: true } : it));
      const alreadyOffered = r.ofertas.some((item) => item.productor === interes.productor);
      return { ...r, intereses, ofertas: alreadyOffered ? r.ofertas : [...r.ofertas, oferta], estado: "con_ofertas" };
    });
    if (!changed) {
      // El pedido ya tiene una decisión tomada (propuesta elegida o
      // cancelado) — no es una falla técnica, así que no hace falta un
      // mensaje de error: el aviso de límite de mensajes ya alcanza.
      setRequestingOffer(false);
      return;
    }
    setRequestingOffer(false);
    if (!ok) {
      setConversationError("No pudimos generar la propuesta. Probá de nuevo.");
      return;
    }
    setOfferJustGenerated(true);
    onOfferGenerated();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 22px 0" }}>
        <TextLink disabled={sending || requestingOffer} onClick={onBack}>‹ Atrás</TextLink>
      </div>

      <div style={{ padding: "14px 22px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <ProducerPhoto name={interes.productor} width={38} height={38} />
        <div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, color: COLORS.text, fontSize: 14.5 }}>{interes.productor}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: COLORS.muted }}>
            {unlimited
              ? `Vos ${misMensajes} mensajes · ${interes.productor} ${mensajesProductor} mensajes`
              : `Vos ${misMensajes}/${MAX_PRE_OFFER_MESSAGES_PER_PERSON} · ${interes.productor} ${mensajesProductor}/${MAX_PRE_OFFER_MESSAGES_PER_PERSON}`}
          </div>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 22px 8px" }}>
        {mensajes.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.from === "artista" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div
              style={{
                maxWidth: "82%",
                background: m.from === "artista" ? COLORS.accent : COLORS.surface,
                color: m.from === "artista" ? "#fff" : COLORS.text,
                borderRadius: m.from === "artista" ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
                padding: "9px 12px",
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 13.5,
                lineHeight: 1.45,
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 22px 20px" }}>
        {readOnly && (
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>
            {readOnlyMessage || "Esta conversación quedó en modo lectura."}
          </p>
        )}
        {!readOnly && atLimit && (
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>
            {offerAvailable
              ? `Llegaste al límite de ${MAX_PRE_OFFER_MESSAGES_PER_PERSON} mensajes. Ya podés volver a la propuesta y decidir.`
              : `Llegaste al límite de ${MAX_PRE_OFFER_MESSAGES_PER_PERSON} mensajes. Si ${interes.productor} avanza, su propuesta aparece en el pedido.`}
          </p>
        )}
        {!readOnly && conversationError && (
          <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, marginBottom: 8 }}>{conversationError}</p>
        )}
        {!readOnly && (
          <div style={{ marginBottom: 10 }}>
            <UnderlineField
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={atLimit ? "Sin mensajes disponibles" : "Escribí acá… (texto o archivo simulado)"}
              disabled={sending || atLimit}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          {!readOnly && !atLimit && (
            <PrimaryButton full disabled={sending || !input.trim()} onClick={send}>
              Enviar
            </PrimaryButton>
          )}
          <PrimaryButton full disabled={requestingOffer || sending} onClick={onBack}>
            {requestingOffer ? "Preparando propuesta…" : returnLabel ? returnLabel : offerAvailable ? "Volver a la propuesta" : "Volver al pedido"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------- pantalla: espera + feed + recuperación (punto 5) ---------------- */

function WaitingScreen({ request, onOpenInteres, onSelectOffer, onCancel, onEdit, onAclaracion, onSolicitarCurado, onStartBooking, onRequestSlot, onPayDeposit, onEnsureSlotConfirmation, onBack }) {
  const [intereses, setIntereses] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [curados, setCurados] = useState([]);
  const [ampliado, setAmpliado] = useState(false);
  const [recovery, setRecovery] = useState(null);
  const [estado, setEstado] = useState(request.estado);
  const [chosenOfferId, setChosenOfferId] = useState(request.chosenOfferId || null);
  const [booking, setBooking] = useState(request.booking || null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [aclaracionTexto, setAclaracionTexto] = useState("");
  const [enviandoAclaracion, setEnviandoAclaracion] = useState(false);
  const [solicitando, setSolicitando] = useState(null);
  const [actionError, setActionError] = useState(null);

  const poll = useCallback(async () => {
    const mine = await getRequestById(request.id);
    if (mine) {
      setIntereses(mine.intereses || []);
      setOfertas(mine.ofertas || []);
      setCurados(mine.curados || []);
      setAmpliado(!!mine.matchAmpliado);
      setRecovery(mine.recovery || null);
      setEstado(mine.estado);
      setChosenOfferId(mine.chosenOfferId || null);
      setBooking(mine.booking || null);
      // Recuperación tras una recarga (o simplemente al reabrir el pedido):
      // si quedó pendiente de confirmar un horario, reprogramamos ese timer.
      // onEnsureSlotConfirmation ya es idempotente (no crea uno duplicado si
      // ya hay uno en vuelo, ni si ya no corresponde) — llamarla en cada
      // poll es seguro y barato.
      if (tieneProfesionalElegido(mine.estado)) onEnsureSlotConfirmation(request.id);
    }
  }, [request.id, onEnsureSlotConfirmation]);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 1500);
    return () => clearInterval(iv);
  }, [poll]);

  const feedVacio = intereses.length === 0 && ofertas.length === 0;
  // Cubre tanto "propuesta_elegida" (coordinando la reserva) como
  // "reservado" (seña ya pagada): en los dos casos ya hay un profesional
  // elegido y se muestra BookingFlow en vez del feed de intereses/ofertas.
  const showBookingArea = tieneProfesionalElegido(estado);
  const chosenOffer = showBookingArea ? ofertas.find((o) => o.id === chosenOfferId) || null : null;

  async function enviarAclaracion() {
    if (!aclaracionTexto.trim()) return;
    setEnviandoAclaracion(true);
    setActionError(null);
    const ok = await onAclaracion(aclaracionTexto.trim());
    if (!ok) setActionError("No pudimos actualizar la búsqueda. Probá de nuevo.");
    setEnviandoAclaracion(false);
  }

  async function solicitarHorario(productor) {
    setSolicitando(productor.productor);
    setActionError(null);
    const ok = await onSolicitarCurado(productor);
    if (!ok) setActionError("No pudimos solicitar ese horario. Probá de nuevo.");
    setSolicitando(null);
  }

  async function confirmarCancelacion() {
    setCancelling(true);
    setActionError(null);
    const ok = await onCancel();
    if (!ok) {
      setActionError("No pudimos cancelar el pedido. Probá de nuevo.");
      setCancelling(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 22px 0", minHeight: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <TextLink disabled={cancelling} onClick={onBack}>‹ Atrás</TextLink>
        </div>
        {estado === "cancelado" ? (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 0.6, color: COLORS.muted, textTransform: "uppercase" }}>
            Pedido cancelado
          </span>
        ) : estado === "reservado" ? (
          // Reservado no ofrece editar ni cancelar: editar dejó de tener
          // sentido con un profesional confirmado, y cancelar con seña
          // pagada requiere un esquema de devoluciones que no existe en este
          // prototipo (ver context.md).
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 0.6, color: COLORS.accent, textTransform: "uppercase" }}>
            Reserva confirmada
          </span>
        ) : confirmingCancel ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: COLORS.muted }}>¿Cancelar este pedido?</span>
            <TextLink disabled={cancelling} onClick={confirmarCancelacion}>{cancelling ? "Cancelando…" : "Sí, cancelar"}</TextLink>
            <TextLink disabled={cancelling} onClick={() => setConfirmingCancel(false)}>No</TextLink>
          </div>
        ) : showBookingArea ? (
          // Con una propuesta ya elegida tampoco se ofrece editar ni
          // cancelar: la política de cancelación posterior todavía no está
          // definida (requiere modelar devoluciones), así que sólo queda
          // disponible antes de elegir una propuesta (ver puedeCancelarse).
          null
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <TextLink onClick={onEdit}>Editar pedido</TextLink>
            <TextLink onClick={() => setConfirmingCancel(true)}>Cancelar pedido</TextLink>
          </div>
        )}
      </div>

      {showBookingArea ? (
        <BookingFlow
          estado={estado}
          booking={booking}
          chosenOffer={chosenOffer}
          onStartBooking={onStartBooking}
          onRequestSlot={onRequestSlot}
          onPayDeposit={onPayDeposit}
          onRefresh={poll}
        />
      ) : feedVacio && estado === "cancelado" ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "safe center", alignItems: "center", textAlign: "center", padding: "0 26px 26px" }}>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
            Este pedido fue cancelado. Ya no se están buscando profesionales para él.
          </p>
        </div>
      ) : feedVacio && recovery === "aclaracion" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 26px 26px" }}>
          <h2 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 20, color: COLORS.text, margin: "0 0 10px", lineHeight: 1.3 }}>
            Una aclaración más
          </h2>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 20px" }}>
            ¿Hay algún estilo o artista de referencia que ayude a encontrar mejores opciones?
          </p>
          <UnderlineField value={aclaracionTexto} onChange={(e) => setAclaracionTexto(e.target.value)} placeholder="Ej: algo parecido a..." autoFocus />
          <div style={{ marginTop: 22 }}>
            <PrimaryButton full disabled={!aclaracionTexto.trim() || enviandoAclaracion} onClick={enviarAclaracion}>
              {enviandoAclaracion ? "Buscando…" : "Buscar de nuevo"}
            </PrimaryButton>
          </div>
          {actionError && <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginTop: 14 }}>{actionError}</p>}
        </div>
      ) : feedVacio && recovery === "curada" ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 26px" }}>
          <h2 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 19, color: COLORS.text, margin: "0 0 10px", lineHeight: 1.3 }}>
            Algunas opciones con horario disponible
          </h2>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
            No es un match perfecto de estilo, pero tienen disponibilidad ahora.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {curados.map((p) => (
              <div key={p.productor} style={{ display: "flex", gap: 12, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 }}>
                <ProducerPhoto name={p.productor} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, color: COLORS.text, fontSize: 14, marginBottom: 3 }}>{p.productor}</div>
                  <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12.5, lineHeight: 1.4, margin: "0 0 8px" }}>{p.disponibilidad}</p>
                  <PrimaryButton full disabled={solicitando === p.productor} onClick={() => solicitarHorario(p)}>
                    {solicitando === p.productor ? "Solicitando…" : "Solicitar este horario"}
                  </PrimaryButton>
                </div>
              </div>
            ))}
          </div>
          {actionError && <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginTop: 14 }}>{actionError}</p>}
        </div>
      ) : feedVacio ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "safe center", alignItems: "center", textAlign: "center", padding: "0 26px 26px" }}>
          <h2 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 21, color: COLORS.text, margin: "0 0 10px", lineHeight: 1.3 }}>
            Tu proyecto ya está en movimiento
          </h2>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
            {ampliado
              ? "Estamos ampliando la búsqueda a más estilos para encontrarte opciones. Podés cerrar la app; te avisamos acá."
              : "Estamos seleccionando profesionales que puedan encajar con lo que querés hacer. Podés cerrar la app; te avisamos cuando alguien quiera conocer mejor tu proyecto o enviarte una propuesta."}
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 26px" }}>
          <h2 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 19, color: COLORS.text, margin: "0 0 20px", lineHeight: 1.3 }}>
            Tu proyecto ya está en movimiento
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {intereses
              .filter((it) => !it.resuelto)
              .map((it) => (
                <button
                  key={it.id}
                  onClick={() => onOpenInteres(it)}
                  className="press offer-in"
                  style={{ display: "flex", gap: 12, textAlign: "left", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, cursor: "pointer" }}
                >
                  <ProducerPhoto name={it.productor} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, color: COLORS.text, fontSize: 14, marginBottom: 3 }}>
                      {it.productor} quiere conocer mejor tu proyecto
                    </div>
                    <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12.5, lineHeight: 1.4, margin: 0 }}>{it.porQueEncaja}</p>
                  </div>
                </button>
              ))}

            {/* Punto 9: lo que propone primero, el precio no compite por atención. */}
            {ofertas.map((o) => (
              <button
                key={o.id}
                onClick={() => onSelectOffer(o)}
                className="press offer-in"
                style={{ display: "flex", gap: 12, textAlign: "left", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, cursor: "pointer" }}
              >
                <ProducerPhoto name={o.productor} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, color: COLORS.text, fontSize: 14.5, marginBottom: 4 }}>{o.productor}</div>
                  <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 12.5, lineHeight: 1.4, margin: "0 0 6px" }}>{o.propuesta}</p>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.muted, fontSize: 11.5 }}>
                    {formatMoney(calculateArtistFinalPrice(o.producerAmount))}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- pantalla: detalle de oferta ---------------- */

function OfferDetail({ offer, onBack, onChoose, onMessage, choosing, messaging, chooseError }) {
  const precioFinal = calculateArtistFinalPrice(offer.producerAmount);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 22px 0", minHeight: 20 }}>
        <TextLink onClick={onBack}>‹ Atrás</TextLink>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 22px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <ProducerPhoto name={offer.productor} width={52} height={52} radius={12} />
          <div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, color: COLORS.text, fontSize: 17 }}>{offer.productor}</div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13 }}>{offer.zona ? offer.zona : offer.modalidadTipo}</div>
          </div>
        </div>

        {/* Punto 9: la propuesta y el trabajo relacionado van antes que el precio. */}
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 15, lineHeight: 1.55, margin: "18px 0 20px" }}>{offer.propuesta}</p>

        <div style={{ marginBottom: 18 }}>
          <Label>Trabajo relevante</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 13.5, margin: 0 }}>{offer.trabajo}</p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <Label>Su sonido</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 14, lineHeight: 1.5, margin: "0 0 6px" }}>{offer.topArtists.join(" · ")}</p>
          {offer.spotifyConnected && (
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12.5, margin: 0 }}>
              <span style={{ color: COLORS.accent }}>✓</span> Spotify conectado
            </p>
          )}
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, color: COLORS.text, fontWeight: 600 }}>{formatMoney(precioFinal)}</div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12.5, marginTop: 2 }}>{offer.unidad}</div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <Label>Qué incluye</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 13.5, margin: 0 }}>{offer.incluye}</p>
        </div>

        <div style={{ marginBottom: 18 }}>
          <Label>Zona y disponibilidad</Label>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text, fontSize: 13.5, margin: "0 0 4px" }}>
            {offer.modalidadTipo}{offer.zona ? ` · ${offer.zona}` : ""}
          </p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13, margin: 0 }}>{offer.disponibilidad}</p>
        </div>

        <div style={{ marginBottom: 8 }}>
          <Label>Señales de confianza</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {offer.confianza.map((c) => (
              <span key={c} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: COLORS.text }}>
                <span style={{ color: COLORS.accent }}>✓</span> {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 22px 20px" }}>
        {chooseError && <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, margin: "0 0 10px" }}>{chooseError}</p>}
        <div style={{ display: "flex", gap: 9 }}>
          <SecondaryButton full disabled={choosing || messaging} onClick={onMessage}>{messaging ? "Abriendo…" : "Enviar mensaje"}</SecondaryButton>
          <PrimaryButton full disabled={choosing || messaging} onClick={onChoose}>
            {choosing ? "Eligiendo…" : "Elegir propuesta"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------- raíz ---------------- */

export default function App() {
  const [profile, setProfile] = useState(undefined);
  const [text, setText] = useState("");
  const [classification, setClassification] = useState(null);
  const [context, setContext] = useState(null);
  const [request, setRequest] = useState(null);
  const [openInteres, setOpenInteres] = useState(null);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [conversationReturnOffer, setConversationReturnOffer] = useState(null);
  const [interpreting, setInterpreting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [chooseError, setChooseError] = useState(null);
  const [error, setError] = useState(null);
  const [contextReviewRequired, setContextReviewRequired] = useState(false);
  const [editingFromType, setEditingFromType] = useState(null);
  const [reviewingEdit, setReviewingEdit] = useState(false);
  const [editingLiveRequestId, setEditingLiveRequestId] = useState(null);
  const [activeTab, setActiveTab] = useState("inicio");
  const [startedCreating, setStartedCreating] = useState(false);
  const [conversationOpenedFromMensajes, setConversationOpenedFromMensajes] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [editingProfileName, setEditingProfileName] = useState(false);
  const timers = useRef([]);
  // Ids de pedidos con un timer de confirmación de horario ya en vuelo — ver
  // ensureSlotConfirmationScheduled más abajo.
  const scheduledSlotConfirmations = useRef(new Set());

  useEffect(() => {
    (async () => {
      const p = await storageGet(PROFILE_KEY, false);
      setProfile(p);
    })();
    migrateLegacyClosedRequests();
    return () => timers.current.forEach(clearTimeout);
  }, []);

  async function handleGateDone(profileData) {
    const ok = await storageSet(PROFILE_KEY, profileData, false);
    if (!ok) return false;
    setProfile(profileData);
    return true;
  }

  async function handleTextSubmit(t) {
    setText(t);
    setInterpreting(true);
    setError(null);
    try {
      const result = await interpretRequest(t);
      setContext((previous) => sanitizeContextForClassification(previous, editingFromType, result));
      setClassification(result);
      setContextReviewRequired(true);
      setEditingFromType(null);
      setStartedCreating(true);
    } catch (e) {
      setError("No pudimos interpretar el pedido. Probá de nuevo.");
    } finally {
      setInterpreting(false);
    }
  }

  function handleContextComplete(ctx) {
    setContext(ctx);
    setContextReviewRequired(false);
    setReviewingEdit(false);
  }

  // Descarta un pedido nuevo (no una edición) que todavía no se publicó.
  // Se llega acá solo después de una clasificación exitosa, así que siempre
  // hay progreso real para perder — StartScreen ya pide confirmación antes
  // de llamar a esto.
  function handleExitCreation() {
    setClassification(null);
    setContext(null);
    setText("");
    setError(null);
    setContextReviewRequired(false);
    setEditingFromType(null);
    setReviewingEdit(false);
    setStartedCreating(false);
    setActiveTab("inicio");
  }

  function goBackToStart() {
    setEditingFromType(classification?.tipo || null);
    setReviewingEdit(true);
    setClassification(null);
    setContextReviewRequired(true);
  }

  async function isRequestStillOpen(reqId) {
    const mine = await getRequestById(reqId);
    return mine && puedeRecibirActividadDeProductores(mine.estado);
  }

  // Compartido entre publicar (pedido nuevo) y actualizar (pedido ya publicado
  // que el artista está editando): el resultado de matching se calcula igual
  // en los dos casos a partir de classification + context.
  function buildMatchResult() {
    const referenciaSignal = [classification.summary, context.referenciaLink, classification.referencia].filter(Boolean).join(" ");
    const generosDeclarados = (context.generos || []).filter((g) => g !== "no_se");
    const generos = Array.from(new Set([...generosDeclarados, ...detectGeneros(referenciaSignal)]));
    const matchingContext = {
      modalidad: context.modalidad || classification.modalidad,
      ubicacion: context.ubicacion || classification.locationText,
      coordinates: context.coordinates || null,
      franja: context.franja || classification.timeSlot,
    };
    const { productores, ampliado } = pickProducers(classification.tipo, generos, matchingContext);
    const tieneReferencia = !!(classification.referencia || context.referenciaLink || context.archivoAdjunto || context.audioAdjunto);
    return { generos, matchingContext, productores, ampliado, tieneReferencia };
  }

  function exitEditingMode() {
    setClassification(null);
    setContext(null);
    setContextReviewRequired(false);
    setReviewingEdit(false);
    setEditingFromType(null);
    setEditingLiveRequestId(null);
    setStartedCreating(false);
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(false);
    const { generos, matchingContext, productores, ampliado, tieneReferencia } = buildMatchResult();
    const newRequest = {
      id: uid(),
      artistName: profile.name,
      createdAt: new Date().toISOString(),
      tipo: classification.tipo,
      textoOriginal: classification.originalText,
      resumen: classification.summary,
      modalidad: matchingContext.modalidad,
      ubicacion: matchingContext.ubicacion,
      coordinates: matchingContext.coordinates,
      franja: matchingContext.franja,
      dateText: classification.dateText || null,
      timeText: classification.timeText || null,
      estado: "esperando",
      matchAmpliado: ampliado,
      tieneReferencia,
      generos,
      classification,
      context,
      recovery: null,
      curados: [],
      intereses: [],
      ofertas: [],
      chosenOfferId: null,
    };
    const all = await getAllRequests();
    const ok = await saveRequests([newRequest, ...all]);
    setPublishing(false);
    if (!ok) {
      setPublishError(true);
      return;
    }
    setRequest(newRequest);
    setStartedCreating(false);
    setActiveTab("pedidos");
    scheduleSimulatedProducers(newRequest, productores);
  }

  // Punto de la reunión del 29/8: el artista puede editar un pedido ya
  // publicado. El sistema —no el artista— se encarga de la reasignación:
  // se limpian intereses/ofertas previos y se vuelve a correr el matching
  // sobre los datos actualizados, conservando el mismo id de pedido.
  function handleEditRequest() {
    // Editar deja de ofrecerse (y de funcionar) una vez que hay un
    // profesional elegido: el botón ya no se muestra en ese caso, pero este
    // guard evita que una llamada residual reabra el flujo de edición.
    if (!request || tieneProfesionalElegido(request.estado)) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setEditingLiveRequestId(request.id);
    setText(request.textoOriginal);
    setClassification(request.classification || null);
    setContext(request.context || null);
    setEditingFromType(request.tipo);
    setReviewingEdit(true);
    setContextReviewRequired(true);
    setStartedCreating(true);
  }

  function cancelLiveEdit() {
    exitEditingMode();
    setText(request?.textoOriginal || "");
  }

  async function handleUpdateRequest() {
    if (!editingLiveRequestId) return handlePublish();
    setPublishing(true);
    setPublishError(false);
    const { generos, matchingContext, productores, ampliado, tieneReferencia } = buildMatchResult();
    const { ok, request: updatedRequest } = await updateRequestById(editingLiveRequestId, (r) => ({
      ...r,
      tipo: classification.tipo,
      textoOriginal: classification.originalText,
      resumen: classification.summary,
      modalidad: matchingContext.modalidad,
      ubicacion: matchingContext.ubicacion,
      coordinates: matchingContext.coordinates,
      franja: matchingContext.franja,
      dateText: classification.dateText || null,
      timeText: classification.timeText || null,
      estado: "esperando",
      matchAmpliado: ampliado,
      tieneReferencia,
      generos,
      classification,
      context,
      recovery: null,
      curados: [],
      intereses: [],
      ofertas: [],
      chosenOfferId: null,
    }));
    setPublishing(false);
    if (!ok) {
      setPublishError(true);
      return;
    }
    setRequest(updatedRequest);
    exitEditingMode();
    scheduleSimulatedProducers(updatedRequest, productores);
  }

  // Punto 1: cada productor matcheado elige pregunta / oferta directa / pasar.
  // Punto 5: si al final nadie respondió, se activa el estado de recuperación.
  function scheduleSimulatedProducers(req, productores) {
    productores.forEach((p, i) => {
      const t = setTimeout(async () => {
        if (!(await isRequestStillOpen(req.id))) return;
        const path = pickProducerPath();
        if (path === "ahora_no") return;
        if (path === "oferta_directa") {
          const oferta = buildOfferFrom(p);
          // isRequestStillOpen ya se comprobó arriba, pero entre esa lectura y
          // este updateRequestById el artista puede haber elegido una
          // propuesta o cancelado el pedido — repetimos el guard adentro del
          // updater para que esa escritura tardía nunca pise el estado real
          // (en particular, que una oferta directa tardía nunca convierta
          // "propuesta_elegida" en "con_ofertas").
          await updateRequestById(req.id, (r) => {
            if (!puedeRecibirActividadDeProductores(r.estado)) return null;
            return { ...r, ofertas: [...r.ofertas, oferta], estado: "con_ofertas" };
          });
        } else {
          const createdAt = new Date().toISOString();
          const interes = {
            id: uid(),
            ...p,
            mensajes: [{ from: "productor", text: p.pregunta, createdAt }],
            resuelto: false,
            createdAt,
          };
          await updateRequestById(req.id, (r) => {
            if (!puedeRecibirActividadDeProductores(r.estado)) return null;
            return { ...r, intereses: [...r.intereses, interes] };
          });
        }
      }, 3000 + i * 4000);
      timers.current.push(t);
    });

    const recoveryDelay = 3000 + productores.length * 4000 + 2500;
    const rt = setTimeout(async () => {
      if (!(await isRequestStillOpen(req.id))) return;
      const mine = await getRequestById(req.id);
      if (!mine || mine.intereses.length > 0 || mine.ofertas.length > 0) return;
      const curados = mine.tieneReferencia ? getCuratedAlternatives(mine) : [];
      const recoveryTipo = mine.tieneReferencia && curados.length > 0 ? "curada" : "aclaracion";
      // Mismo motivo que arriba: repetimos el guard adentro del updater para
      // que una recuperación tardía no se aplique sobre un pedido que ya
      // tiene propuesta elegida o fue cancelado entre la lectura y la escritura.
      await updateRequestById(req.id, (r) => {
        if (!puedeRecibirActividadDeProductores(r.estado)) return null;
        return { ...r, recovery: recoveryTipo, curados };
      });
    }, recoveryDelay);
    timers.current.push(rt);
  }

  async function handleAclaracion(textoAclaracion) {
    let matchResult = null;
    // La aclaración suma información, no la reemplaza: se combinan los géneros ya
    // confirmados del pedido original con lo nuevo que se detecte en el texto.
    const { changed, ok } = await updateRequestById(request.id, (r) => {
      const generos = Array.from(new Set([...(r.generos || []), ...detectGeneros(textoAclaracion)]));
      const { productores, ampliado } = pickProducers(r.tipo, generos, r);
      matchResult = { productores, ampliado };
      return { ...r, recovery: null, curados: [], matchAmpliado: ampliado, tieneReferencia: true, generos };
    });
    if (!changed || !ok) return false;
    scheduleSimulatedProducers({ id: request.id }, matchResult.productores);
    return true;
  }

  async function handleSolicitarCurado(productorData) {
    const oferta = buildOfferFrom(productorData);
    const { changed, ok } = await updateRequestById(request.id, (r) => {
      if (!puedeRecibirActividadDeProductores(r.estado)) return null;
      return { ...r, recovery: null, curados: [], ofertas: [...r.ofertas, oferta], estado: "con_ofertas" };
    });
    return changed && ok;
  }

  // Elegir una propuesta no confirma la contratación todavía: falta coordinar
  // horario y pagar la seña (ver BookingFlow) antes de pasar a "reservado".
  // El pedido sigue "en curso" con estado "propuesta_elegida" mientras tanto.
  async function handleChoose(offer) {
    setChoosing(true);
    setChooseError(null);
    const { changed, ok } = await updateRequestById(request.id, (r) => {
      if (!puedeRecibirActividadDeProductores(r.estado)) return null;
      return { ...r, estado: "propuesta_elegida", chosenOfferId: offer.id };
    });
    setChoosing(false);
    if (!(changed && ok)) {
      setChooseError("No pudimos guardar tu elección. Probá de nuevo.");
      return;
    }
    // Los timers de simulación de productores ya no tienen sentido para este
    // pedido (no se van a generar más ofertas ni intereses nuevos).
    timers.current.forEach(clearTimeout);
    timers.current = [];
    // No hace falta un estado aparte: `request` sigue seteado, así que al
    // cerrar OfferDetail cae de nuevo en WaitingScreen, que ya sabe mostrar
    // el aviso de "propuesta elegida" según el estado recién guardado.
    setSelectedOffer(null);
  }

  // Primer tramo de contratación (propuesta_elegida -> horario -> seña ->
  // reservado). "Coordinar reserva" crea el booking la primera vez que se
  // toca — es idempotente: si ya existe (por ejemplo, se volvió a entrar
  // después de un back o una recarga), applyStartBooking no lo pisa ni
  // regenera los horarios (ver domain/booking.js para la condición exacta).
  async function handleStartBooking() {
    if (!request) return false;
    const { ok, request: updated } = await updateRequestById(request.id, (r) => {
      const chosen = (r.ofertas || []).find((o) => o.id === r.chosenOfferId);
      if (!chosen) return null;
      return applyStartBooking(r, calculateArtistFinalPrice(chosen.producerAmount));
    });
    if (ok && updated) return true;
    const mine = await getRequestById(request.id);
    return !!mine?.booking;
  }

  async function handleRequestSlot(slot) {
    if (!request) return false;
    const { changed, ok } = await updateRequestById(request.id, (r) => applyRequestSlot(r, slot));
    if (!(changed && ok)) return false;
    ensureSlotConfirmationScheduled(request.id);
    return true;
  }

  // Garantiza un único timer de confirmación de horario en vuelo por pedido,
  // sin importar cuántas veces se llame (cada solicitud de horario, cada
  // poll de WaitingScreen al abrir/reabrir el pedido, o después de una
  // recarga). `scheduledSlotConfirmations` se reserva de forma síncrona
  // antes de cualquier await, así dos llamadas casi simultáneas no pueden
  // programar dos timers para el mismo id (una carrera análoga a la que ya
  // resuelve updateRequestById, pero acá sobre el propio Set en memoria).
  //
  // La recuperación después de una recarga sale gratis: como el timer vive
  // en memoria del tab, se pierde igual que los de scheduleSimulatedProducers
  // — pero acá, a diferencia de aquellos, WaitingScreen vuelve a llamar a
  // esta función en cada poll mientras el pedido siga con un profesional
  // elegido, así que apenas se reabre el pedido (o el mount inicial tras la
  // recarga hace el primer poll) se vuelve a programar, usando
  // requestedAt para calcular cuánto falta de los 2,5 segundos originales —
  // o confirmando de inmediato si el plazo ya pasó.
  async function ensureSlotConfirmationScheduled(reqId) {
    if (scheduledSlotConfirmations.current.has(reqId)) return;
    scheduledSlotConfirmations.current.add(reqId);
    const mine = await getRequestById(reqId);
    if (!mine || !canConfirmSlot(mine)) {
      scheduledSlotConfirmations.current.delete(reqId);
      return;
    }
    const delayMs = getRemainingConfirmationDelay(mine);
    const t = setTimeout(async () => {
      scheduledSlotConfirmations.current.delete(reqId);
      // Se vuelve a validar el estado real antes de escribir: entre
      // programar este timer y que corra, el booking podría haber avanzado
      // o el pedido podría ya no aceptar esta transición — applyConfirmSlot
      // exige exactamente propuesta_elegida (o su legacy) + booking pendiente
      // + horario solicitado + sin confirmar todavía.
      await updateRequestById(reqId, (r) => applyConfirmSlot(r));
    }, delayMs);
    timers.current.push(t);
  }

  // Pago simulado de la seña. Idempotente: applyPayDeposit sólo aplica si el
  // booking está exactamente en "slot_confirmed"; un doble click, una
  // reapertura o un reintento después de un fallo de guardado ven que ya no
  // está en ese estado y no hacen nada (changed: false), sin duplicar ni
  // alterar `depositPaidAt`.
  async function handlePayDeposit() {
    if (!request) return { changed: false, ok: false };
    const { changed, ok } = await updateRequestById(request.id, (r) => applyPayDeposit(r));
    return { changed, ok };
  }

  async function handleMessageOffer(offer) {
    setMessaging(true);
    setChooseError(null);
    let conversation = null;
    const { changed, ok } = await updateRequestById(request.id, (r) => {
      // A diferencia de elegir una propuesta o generar una oferta nueva,
      // mandar un mensaje sigue permitido con "propuesta_elegida" — todavía
      // no hay contratación confirmada, así que el límite de 4 mensajes
      // sigue rigiendo en vez de bloquear el chat directamente.
      if (esCancelado(r.estado)) return null;
      const existing = r.intereses.find((it) => it.productor === offer.productor);
      if (existing) {
        conversation = { ...existing, formalOfferExists: true };
        return r;
      }
      const producerData = findProducerByName(offer.productor) || offer;
      const createdAt = new Date().toISOString();
      conversation = {
        ...producerData,
        id: uid(),
        pregunta: "Hola, gracias por mirar mi propuesta. Preguntame lo que necesites antes de decidir.",
        mensajes: [{ from: "productor", text: "Hola, gracias por mirar mi propuesta. Preguntame lo que necesites antes de decidir.", createdAt }],
        resuelto: false,
        formalOfferExists: true,
        createdAt,
      };
      return { ...r, intereses: [...r.intereses, conversation] };
    });
    const okOverall = !changed || ok;
    setMessaging(false);
    if (!okOverall || !conversation) {
      setChooseError("No pudimos abrir la conversación. Probá de nuevo.");
      return;
    }
    setConversationReturnOffer(offer);
    setSelectedOffer(null);
    setOpenInteres(conversation);
  }

  function closeConversation() {
    setOpenInteres(null);
    if (conversationReturnOffer) {
      setSelectedOffer(conversationReturnOffer);
      setConversationReturnOffer(null);
      return;
    }
    // Si se abrió desde Mensajes (no desde el pedido ni desde una oferta),
    // volver debe ir a la lista de Mensajes, no al detalle del pedido.
    if (conversationOpenedFromMensajes) {
      setRequest(null);
      setConversationOpenedFromMensajes(false);
    }
  }

  async function handleCancel() {
    const cancelledId = request ? request.id : null;
    if (!cancelledId) return false;
    // La política de cancelación posterior a elegir una propuesta (o a
    // reservado) todavía no está definida — el botón ya no se muestra en
    // esos casos, pero este guard persistido rechaza igual una cancelación
    // residual si de algún modo se invoca.
    const { changed, ok } = await updateRequestById(cancelledId, (r) => {
      if (!puedeCancelarse(r.estado)) return null;
      return { ...r, estado: "cancelado" };
    });
    if (!(changed && ok)) return false;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRequest(null);
    setOpenInteres(null);
    setSelectedOffer(null);
    setConversationReturnOffer(null);
    setClassification(null);
    setContext(null);
    setText("");
    setContextReviewRequired(false);
    setEditingFromType(null);
    setReviewingEdit(false);
    setEditingLiveRequestId(null);
    return true;
  }

  // Abre el detalle de un pedido ya existente (desde Pedidos o desde el
  // módulo "En movimiento" de Inicio). No dispara la simulación de
  // productores de nuevo — eso solo pasa al publicar/editar/aclarar.
  function handleOpenExistingRequest(requestObj) {
    setClassification(null);
    setContext(null);
    // "propuesta_elegida" (y su antecesor "cerrado") se abre igual que
    // cualquier otro pedido activo: WaitingScreen decide qué mostrar según
    // el estado real, sin una pantalla aparte desconectada de la pestaña.
    setRequest(requestObj);
  }

  // Abre una conversación existente desde Mensajes, sin pasar por el detalle
  // del pedido: se necesita `request` para poder seguir escribiendo (el chat
  // guarda mensajes contra ese id), pero volver debe ir a Mensajes.
  function handleOpenConversationFromMensajes(requestObj, interesObj) {
    setClassification(null);
    setContext(null);
    setRequest(requestObj);
    setConversationOpenedFromMensajes(true);
    setOpenInteres(interesObj);
  }

  // Sale del detalle de un pedido (WaitingScreen). No alcanza con limpiar
  // `request`: si se venía de publicar o actualizar recién, `classification`/
  // `context` siguen con el valor del pedido que se acaba de guardar (nunca
  // hacía falta limpiarlos antes porque WaitingScreen no tenía botón volver),
  // y dejarlos así hace que al volver se vuelva a mostrar el resumen viejo.
  function handleCloseRequestDetail() {
    setRequest(null);
    setClassification(null);
    setContext(null);
    setContextReviewRequired(false);
    setEditingFromType(null);
    setReviewingEdit(false);
    setText("");
  }

  async function handleSaveProfileName(newName) {
    const oldName = profile.name;
    const updated = { ...profile, name: newName };
    const ok = await storageSet(PROFILE_KEY, updated, false);
    if (!ok) return false;
    // Pedidos/Mensajes/Inicio filtran por artistName (no hay un id de usuario
    // en este prototipo). Sin esta migración, cambiar el nombre artístico
    // "perdería" el historial ya guardado con el nombre anterior.
    if (newName !== oldName) {
      const all = await getAllRequests();
      const migrated = all.map((r) => (r.artistName === oldName ? { ...r, artistName: newName } : r));
      await saveRequests(migrated);
    }
    setProfile(updated);
    setEditingProfileName(false);
    return true;
  }

  // No borra REQUESTS_KEY: cerrar sesión no elimina el historial local.
  async function handleSignOut() {
    await storageSet(PROFILE_KEY, null, false);
    setProfile(null);
    setActiveTab("inicio");
  }

  // Modo pestañas (barra inferior visible) vs. modo flujo (una pantalla
  // interna, con su propia flecha de volver, sin barra). Cambiar de pestaña
  // nunca toca classification/request/openInteres/etc., así que la pestaña
  // activa persiste sola mientras se navega dentro de un pedido o chat.
  const inFlowMode = startedCreating || !!request || !!openInteres || !!selectedOffer || showHelp || showPrivacy || editingProfileName;

  let body = null;
  if (profile === undefined) {
    body = null;
  } else if (profile === null) {
    body = <Gate onDone={handleGateDone} />;
  } else if (selectedOffer) {
    body = <OfferDetail offer={selectedOffer} choosing={choosing} messaging={messaging} chooseError={chooseError} onBack={() => { setSelectedOffer(null); setChooseError(null); }} onMessage={() => handleMessageOffer(selectedOffer)} onChoose={() => handleChoose(selectedOffer)} />;
  } else if (openInteres) {
    // Estas dos props sólo controlan la UI (deshabilitar la caja de texto,
    // mostrar el aviso correcto) — la validación real vuelve a hacerse desde
    // el dato persistido, dentro del updater que guarda cada mensaje
    // (appendMessage en ConversationScreen), usando las mismas funciones.
    body = (
      <ConversationScreen
        request={request}
        interes={openInteres}
        formalOfferExists={!!conversationReturnOffer || !!openInteres.formalOfferExists}
        onBack={closeConversation}
        onOfferGenerated={() => {}}
        returnLabel={conversationOpenedFromMensajes ? "Volver a mensajes" : null}
        readOnly={!request || !puedeEscribirEnConversacion(request, openInteres.productor)}
        readOnlyMessage={
          esCancelado(request?.estado)
            ? "Este pedido fue cancelado. La conversación quedó en modo lectura."
            : "Esta conversación quedó como historial: elegiste a otro profesional para este pedido."
        }
        unlimited={!!request && !tieneLimiteDeMensajes(request, openInteres.productor)}
      />
    );
  } else if (request && !editingLiveRequestId) {
    body = (
      <WaitingScreen
        request={request}
        onOpenInteres={setOpenInteres}
        onSelectOffer={setSelectedOffer}
        onCancel={handleCancel}
        onEdit={handleEditRequest}
        onAclaracion={handleAclaracion}
        onSolicitarCurado={handleSolicitarCurado}
        onStartBooking={handleStartBooking}
        onRequestSlot={handleRequestSlot}
        onPayDeposit={handlePayDeposit}
        onEnsureSlotConfirmation={ensureSlotConfirmationScheduled}
        onBack={handleCloseRequestDetail}
      />
    );
  } else if (classification && context && !contextReviewRequired) {
    body = (
      <SummaryScreen
        classification={classification}
        context={context}
        publishing={publishing}
        publishError={publishError}
        editing={!!editingLiveRequestId}
        onEdit={goBackToStart}
        onPublish={editingLiveRequestId ? handleUpdateRequest : handlePublish}
      />
    );
  } else if (classification) {
    body = <ContextStep classification={classification} initialContext={context} reviewExisting={reviewingEdit} onComplete={handleContextComplete} onBack={goBackToStart} />;
  } else if (startedCreating) {
    // Se volvió al primer paso (texto libre) desde ContextStep, editando un
    // pedido existente o re-escribiendo uno nuevo antes de reclasificar.
    body = (
      <StartScreen
        onSubmit={handleTextSubmit}
        interpreting={interpreting}
        error={error}
        initialText={text}
        onExit={editingLiveRequestId ? cancelLiveEdit : handleExitCreation}
        exitLabel={editingLiveRequestId ? "‹ Volver a mi pedido" : "‹ Salir"}
        confirmExitBeforeDiscard={!editingLiveRequestId}
      />
    );
  } else if (showHelp) {
    body = <HelpScreen artistName={profile.name} onBack={() => setShowHelp(false)} />;
  } else if (showPrivacy) {
    body = <PrivacyScreen onBack={() => setShowPrivacy(false)} />;
  } else if (editingProfileName) {
    body = <EditNameScreen currentName={profile.name} onSave={handleSaveProfileName} onBack={() => setEditingProfileName(false)} />;
  } else if (activeTab === "pedidos") {
    body = <OrdersScreen artistName={profile.name} onOpenRequest={handleOpenExistingRequest} onCreate={() => setActiveTab("inicio")} />;
  } else if (activeTab === "mensajes") {
    body = <MessagesScreen artistName={profile.name} onOpenConversation={handleOpenConversationFromMensajes} onGoToOrders={() => setActiveTab("pedidos")} />;
  } else if (activeTab === "perfil") {
    body = (
      <ProfileScreen
        profile={profile}
        onEdit={() => setEditingProfileName(true)}
        onHelp={() => setShowHelp(true)}
        onPrivacy={() => setShowPrivacy(true)}
        onSignOut={handleSignOut}
      />
    );
  } else {
    body = (
      <HomeScreen
        artistName={profile.name}
        onSubmit={handleTextSubmit}
        interpreting={interpreting}
        error={error}
        text={text}
        onTextChange={setText}
        onOpenRequest={handleOpenExistingRequest}
      />
    );
  }

  return (
    <div style={{ width: "100%", height: "100vh", minHeight: 560, display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.bg }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          margin: "0 auto",
          maxHeight: 840,
          minHeight: 560,
          height: "90vh",
          background: COLORS.bg,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 18,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <Textura />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
          * { box-sizing: border-box; }
          input::placeholder, textarea::placeholder { color: #8F8D8F88; }
          input:focus, textarea:focus, button:focus-visible { outline: 2px solid ${COLORS.accent}; outline-offset: 1px; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 4px; }
          .press { transition: opacity .1s ease; }
          .press:active { opacity: .7; }
          .offer-in { animation: offerIn .25s ease; }
          @keyframes offerIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          .q-fade { animation: qFade .2s ease; }
          @keyframes qFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          .blink-caret { animation: blink 1s step-end infinite; color: ${COLORS.accent}; }
          @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
          @media (prefers-reduced-motion: reduce) {
            .press, .offer-in, .q-fade, .blink-caret { animation: none !important; transition: none !important; }
          }
        `}</style>

        {profile !== undefined && (
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, color: COLORS.accent }}>COLAB</span>
            {profile && <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: COLORS.muted }}>{profile.name}</span>}
          </div>
        )}

        {/* minHeight: 0 es necesario para que este contenedor realmente se
            recorte a su alto disponible y scrollee — sin esto, un flex item
            con overflow no se achica por debajo del alto de su contenido, y
            una pantalla larga (ej. la lista completa de zonas) termina
            centrada por fuera del viewport, tapando el "‹ Atrás" de arriba. */}
        <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, overflowY: "auto" }}>{body}</div>

        {profile && !inFlowMode && <BottomNav active={activeTab} onChange={setActiveTab} />}
      </div>
    </div>
  );
}
