"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { COLORS, EDITORIAL } from "./theme.js";
import BottomNav from "./BottomNav.jsx";
import { HomeScreen, OrdersScreen, MessagesScreen, ProfileScreen, HelpScreen, PrivacyScreen, EditNameScreen } from "./RootScreens.jsx";
import {
  PrimaryButton, TextLink, UnderlineField, Screen, ProducerPhoto, ProducerSpacePhoto,
  EditorialPrimaryButton, EditorialSecondaryButton, EditorialTextLink, EditorialUnderlineField, editorialUnderlineInputStyle, HandDrawnUnderline,
  EditorialLabel, EditorialBigOption, EditorialBackButton, EditorialCloseButton, EditorialHandDrawnSubmitButton, EditorialThinkingDots,
  LocationPinIcon, ChevronIcon, MoreOptionsIcon,
  DoodlePathsDiverging, DoodlePinClock, DoodleSoundStars, DoodleCheck, DoodleSpeechBubble,
} from "./ui/pieces.jsx";
import { uid } from "./lib/id.js";
import { formatMoney } from "./lib/format.js";
import {
  PROFILE_KEY, storageGet, storageSet,
  getAllRequests, getRequestById, updateRequestById, saveRequests,
  migrateLegacyClosedRequests, migrateLegacyTimeSlots,
} from "./lib/storage.js";
import {
  esCancelado, tieneProfesionalElegido, puedeRecibirActividadDeProductores,
  puedeCancelarse, requestNeedsArtistInput,
  puedeEscribirEnConversacion, tieneLimiteDeMensajes,
} from "./domain/estado.js";
import { detectGeneros, GENRE_KEYWORDS } from "./domain/genres.js";
import { MUSIC_WORLDS, MUSIC_REFERENCE_CATALOG } from "./domain/musicReferenceCatalog.js";
import { normalizeSelectedMusicWorlds } from "./domain/musicReferenceSuggestions.js";
import { findMentionedMusicReferenceIds } from "./domain/musicReferenceMentions.js";
import MusicReferenceStep from "./features/request/MusicReferenceStep.jsx";
import { interpretRequest } from "./domain/interpretation.js";
import { calculateArtistFinalPrice } from "./domain/pricing.js";
import { pickProducers, getCuratedAlternatives, pickProducerPathForSlot, buildOfferFrom, findProducerByName } from "./domain/matching.js";
import { sanitizeContextForClassification } from "./domain/contextSanitize.js";
import {
  TIME_SLOT_OPTIONS, FLEXIBLE_TIME_SLOT,
  normalizeTimeSlots, toggleTimeSlot, isTimeSlotOptionDisabled, formatTimeSlots,
} from "./domain/timeSlots.js";
import {
  applyStartBooking, applyRequestSlot,
  canConfirmSlot, applyConfirmSlot, getRemainingConfirmationDelay,
  applyPayDeposit,
} from "./domain/booking.js";
import BookingFlow from "./features/booking/BookingFlow.jsx";
import AnimatedPrompt from "./ui/AnimatedPrompt.jsx";
import RequestComposer from "./features/request/RequestComposer.jsx";

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
  const [requestText, setRequestText] = useState("");
  const [name, setName] = useState("");
  const [nameFocused, setNameFocused] = useState(false);

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
      setStep("request");
    }, 600);
  }

  function continueWithEmail() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setGateError("Escribí un mail válido para continuar.");
      return;
    }
    setGateError(null);
    setStep("request");
  }

  async function finishGate() {
    setSaving(true);
    setGateError(null);
    const ok = await onDone(
      { name: name.trim(), provider, email: provider === "email" ? email.trim() : null },
      requestText.trim()
    );
    setSaving(false);
    if (!ok) setGateError("No pudimos preparar tu primer pedido. Probá de nuevo.");
  }

  if (step === "auth") {
    return (
      <Screen>
        <div style={{ fontFamily: EDITORIAL.fontMono, fontSize: 11, letterSpacing: 2, color: EDITORIAL.accent, marginBottom: 18 }}>COLAB</div>
        <h1 style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 800, fontSize: 40, color: EDITORIAL.carbon, lineHeight: 1.08, letterSpacing: -0.6, margin: "0 0 28px" }}>
          Para empezar,{" "}
          <span style={{ position: "relative", display: "inline-block" }}>
            conectá
            <HandDrawnUnderline width={100} color={EDITORIAL.accent} style={{ position: "absolute", left: 0, bottom: -8 }} />
          </span>{" "}
          tu cuenta.
        </h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <EditorialPrimaryButton full disabled={connecting} onClick={() => beginAuth("google")}>
            {connecting && provider === "google" ? "Conectando…" : "Continuar con Google"}
          </EditorialPrimaryButton>
          <EditorialSecondaryButton full disabled={connecting} onClick={() => beginAuth("apple")}>
            {connecting && provider === "apple" ? "Conectando…" : "Continuar con Apple"}
          </EditorialSecondaryButton>
          <EditorialSecondaryButton full disabled={connecting} onClick={() => beginAuth("email")}>Continuar con mail</EditorialSecondaryButton>
        </div>
        <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 11.5, lineHeight: 1.45, margin: "16px 0 0" }}>
          Apple Music se conecta después, si querés usarlo para compartir referencias. No es lo mismo que iniciar sesión con Apple.
        </p>
      </Screen>
    );
  }

  if (step === "email") {
    return (
      <Screen topSlot={<EditorialBackButton onClick={() => setStep("auth")} />}>
        <h1 style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 700, fontSize: 28, color: EDITORIAL.carbon, lineHeight: 1.3, margin: "0 0 22px" }}>¿Cuál es tu mail?</h1>
        <EditorialUnderlineField value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="vos@ejemplo.com" autoFocus onKeyDown={(e) => e.key === "Enter" && continueWithEmail()} />
        {gateError && <p style={{ color: EDITORIAL.error, fontFamily: EDITORIAL.fontSans, fontSize: 12.5, marginTop: 10 }}>{gateError}</p>}
        <div style={{ marginTop: 24 }}><EditorialPrimaryButton full onClick={continueWithEmail}>Continuar</EditorialPrimaryButton></div>
      </Screen>
    );
  }

  if (step === "request") {
    return (
      <Screen topSlot={<EditorialBackButton onClick={() => setStep(provider === "email" ? "email" : "auth")} />}>
        <RequestComposer
          title="¿Qué querés hacer?"
          text={requestText}
          onTextChange={setRequestText}
          onSubmit={() => setStep("name")}
          error={gateError}
          centered
        />
      </Screen>
    );
  }

  return (
    <Screen topSlot={<EditorialBackButton onClick={() => setStep("request")} />}>
      <h1 style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 700, fontSize: 28, color: EDITORIAL.carbon, lineHeight: 1.3, margin: "0 0 8px" }}>
        ¿Cómo querés que te llamemos?
      </h1>
      <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13, lineHeight: 1.5, margin: "0 0 24px" }}>
        Puede ser tu nombre artístico o como te dicen habitualmente.
      </p>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!(name.trim().length < 2 || saving)) finishGate();
                }
              }}
              placeholder="Tu nombre o cómo te dicen"
              autoFocus
              style={{ ...editorialUnderlineInputStyle, position: "relative", zIndex: 2 }}
            />
          </div>
          <EditorialHandDrawnSubmitButton ariaLabel="Seguir" disabled={name.trim().length < 2 || saving} onClick={finishGate} />
        </div>
        <div style={{ height: 1.5, background: nameFocused ? EDITORIAL.carbon : EDITORIAL.border, transition: "background .15s ease" }} />
      </div>
      {gateError && <p style={{ color: EDITORIAL.error, fontFamily: EDITORIAL.fontSans, fontSize: 12.5, marginTop: 10 }}>{gateError}</p>}
      {saving && (
        <p style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 12.5, marginTop: 10 }}>
          Preparando tu pedido <EditorialThinkingDots />
        </p>
      )}
    </Screen>
  );
}

/* ---------------- pantalla: inicio + búsqueda por IA ---------------- */

function StartScreen({ onSubmit, interpreting, error, initialText, onExit, exitLabel, confirmExitBeforeDiscard }) {
  const [text, setText] = useState(initialText || "");
  const [focused, setFocused] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  // Punto 6: solo los 4 casos principales entre los ejemplos. Tuner/sonidista/
  // camps funcionan si se escriben, pero no aparecen acá.
  const examples = ["Quiero grabar una canción", "Quiero hacer una canción", "Quiero terminar un tema", "Quiero mezclar mi canción"];

  function handleExitClick() {
    if (confirmExitBeforeDiscard) setConfirmingExit(true);
    else onExit();
  }

  return (
    <Screen
      className="q-fade"
      topSlot={
        !onExit ? null : confirmingExit ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontFamily: EDITORIAL.fontSans, fontSize: 13, color: EDITORIAL.muted }}>¿Salir sin guardar tu pedido?</span>
            <EditorialTextLink onClick={onExit}>Sí, salir</EditorialTextLink>
            <EditorialTextLink onClick={() => setConfirmingExit(false)}>Seguir</EditorialTextLink>
          </div>
        ) : (
          <EditorialTextLink onClick={handleExitClick}>{exitLabel}</EditorialTextLink>
        )
      }
    >
      <h1 style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 800, fontSize: 28, color: EDITORIAL.carbon, lineHeight: 1.2, letterSpacing: -0.3, margin: "0 0 8px" }}>
        Tu próxima canción, en marcha.
      </h1>
      <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 26px" }}>
        Encontramos a quién puede resolverlo con vos.
      </p>

      {/* Punto 6: entrada principal visible, no solo un placeholder que desaparece. */}
      <EditorialLabel>¿Qué querés hacer?</EditorialLabel>

      <div style={{ position: "relative", marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                e.currentTarget.style.height = "64px";
                e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 104)}px`;
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (text.trim().length >= 3 && !interpreting) onSubmit(text.trim());
                }
              }}
              aria-label="Contanos qué querés hacer"
              rows={2}
              disabled={interpreting}
              style={{ ...editorialUnderlineInputStyle, position: "relative", zIndex: 2, resize: "none", lineHeight: 1.45, height: 64, minHeight: 64, maxHeight: 104, overflowY: "auto" }}
            />
            {text.length === 0 && !focused && (
              <div className="q-fade" style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "8px 0", pointerEvents: "none", fontFamily: EDITORIAL.fontSans, fontSize: 17, lineHeight: 1.5 }}>
                <AnimatedPrompt examples={examples} color={EDITORIAL.muted} />
              </div>
            )}
          </div>
          <EditorialHandDrawnSubmitButton disabled={text.trim().length < 3 || interpreting} onClick={() => onSubmit(text.trim())} />
        </div>
        <div style={{ height: 1.5, background: focused ? EDITORIAL.carbon : EDITORIAL.border, transition: "background .15s ease" }} />
      </div>

      {error && <p style={{ color: EDITORIAL.error, fontFamily: EDITORIAL.fontSans, fontSize: 12.5, marginTop: 10 }}>{error}</p>}

      {interpreting && (
        <p style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 12.5, marginTop: 10 }}>
          Interpretando tu pedido <EditorialThinkingDots />
        </p>
      )}
    </Screen>
  );
}

/* ---------------- pantalla: preguntas de contexto ---------------- */

const DEFAULT_CLARIFICATION_QUESTION = "¿Qué día y horario te queda bien?";
const MAX_CLARIFICATION_QUESTION_LENGTH = 140;

// Nombre de contrato acordado para cuando la interpretación (hoy el
// fallback local, más adelante una IA real) pueda sugerir su propia
// pregunta de aclaración: classification.clarificationQuestion. Este
// componente no sabe nada de qué la generó — sólo valida la forma antes de
// mostrarla, y conserva la pregunta por defecto ante cualquier valor
// ausente o defectuoso, para que una respuesta rota nunca rompa la pantalla.
function resolveClarificationQuestion(raw) {
  if (typeof raw !== "string") return DEFAULT_CLARIFICATION_QUESTION;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_CLARIFICATION_QUESTION_LENGTH) return DEFAULT_CLARIFICATION_QUESTION;
  return trimmed;
}

// Adaptador local y explícito de los códigos legacy de detectGeneros() a
// los mundos musicales del catálogo aprobado — sólo para preseleccionar la
// pantalla nueva (inferencia en pedidos nuevos, derivación al editar un
// pedido legacy sin musicWorlds). No migra ni reemplaza context.generos:
// esa colección sigue existiendo tal cual para el matching actual.
const LEGACY_GENRE_TO_MUSIC_WORLD = {
  urbano: "rap_hiphop",
  trap: "trap",
  reggaeton: "reggaeton",
  pop: "pop",
  rock: "rock",
  alternativo: "indie_alternative",
  electronica: "electronic",
};

function adaptGenreCodesToMusicWorlds(genreCodes) {
  const mapped = (genreCodes || []).map((code) => LEGACY_GENRE_TO_MUSIC_WORLD[code]).filter(Boolean);
  return normalizeSelectedMusicWorlds(mapped);
}

// Mundos escritos explícitamente en el texto — reutiliza las keywords de
// GENRE_KEYWORDS (sin duplicarlas) pero, a diferencia de detectGeneros(),
// ignora "urbano" (no es uno de los ocho mundos visibles) y no considera
// ARTIST_GENRE_HINTS: acá sólo importa lo que la persona escribió, no un
// hint legacy asociado a un artista. Se ordena por la primera aparición de
// cada keyword en el texto, para respetar el orden real de lo escrito.
function detectExplicitMusicWorldsFromText(text) {
  const lower = (text || "").toLowerCase();
  const matches = [];
  Object.entries(GENRE_KEYWORDS).forEach(([code, keywords]) => {
    if (code === "urbano") return;
    let firstIndex = -1;
    keywords.forEach((keyword) => {
      const idx = lower.indexOf(keyword);
      if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) firstIndex = idx;
    });
    if (firstIndex !== -1) matches.push({ code, index: firstIndex });
  });
  matches.sort((a, b) => a.index - b.index);
  return adaptGenreCodesToMusicWorlds(matches.map((match) => match.code));
}

// Mundo principal de artistas del catálogo mencionados en el texto, en el
// mismo orden de aparición que ya devuelve findMentionedMusicReferenceIds.
function detectMusicWorldsFromCatalogMentions(text) {
  const mentionedIds = findMentionedMusicReferenceIds(text);
  const worlds = mentionedIds
    .map((id) => MUSIC_REFERENCE_CATALOG.find((entry) => entry.id === id)?.primaryWorld)
    .filter(Boolean);
  return normalizeSelectedMusicWorlds(worlds);
}

// Prioridad de inferencia para preseleccionar la pantalla de mundos
// musicales: 1) señales explícitas escritas en el texto ("trap",
// "electrónica"…) — si existe al menos una, no se agrega nada más, ni
// siquiera el mundo de un artista mencionado; 2) si no hay ninguna señal
// explícita, el mundo principal de artistas del catálogo mencionados; 3)
// sólo si ninguna de las dos anteriores encontró algo, el fallback legacy
// de siempre (detectGeneros, que sí incluye "urbano" y ARTIST_GENRE_HINTS).
function inferInitialMusicWorlds(text) {
  const explicit = detectExplicitMusicWorldsFromText(text);
  if (explicit.length > 0) return explicit;

  const fromMentions = detectMusicWorldsFromCatalogMentions(text);
  if (fromMentions.length > 0) return fromMentions;

  return adaptGenreCodesToMusicWorlds(detectGeneros(text));
}

// Normalización defensiva de una selección de artistas ya guardada (pedido
// legacy o corrupto): sólo IDs reales del catálogo, deduplicados
// respetando el orden, como máximo tres. Nunca muta el array recibido.
const VALID_MUSIC_REFERENCE_IDS = new Set(MUSIC_REFERENCE_CATALOG.map((entry) => entry.id));

function sanitizeStoredMusicReferenceIds(ids) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const result = [];
  for (const id of ids) {
    if (typeof id !== "string" || !VALID_MUSIC_REFERENCE_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= 3) break;
  }
  return result;
}

// Cada fase de ContextStep guarda su propio progreso en un booleano
// "confirmado/revisado" (modalidadReviewed, locationReviewed, etc.) — eso ya
// funciona como una pila implícita: confirmar una fase avanza a la
// siguiente todavía sin confirmar, y "des-confirmar" la fase inmediatamente
// anterior (ver goToPreviousPhase más abajo) vuelve un paso atrás sin tocar
// ningún dato ya cargado. `resumeAtPhase` es el único caso que necesita un
// punto de entrada explícito en vez de "la primera sin confirmar": al volver
// desde el resumen (ver goBackToLastContextPhase en App), ContextStep se
// remonta de cero y perdería en qué fase estaba, así que el padre le pasa
// cuál reabrir y esta función decide, fase por fase, si arranca ya
// confirmada (se salta) o no (es la que se muestra).
function resumesAt(resumeAtPhase, phaseKey, fallbackWhenNoResume) {
  if (!resumeAtPhase) return fallbackWhenNoResume;
  return phaseKey !== resumeAtPhase;
}

function ContextStep({ classification, initialContext, reviewExisting, resumeAtPhase = null, onComplete, onBack }) {
  const { tipo, modalidad, modalidad_fuente, datos_faltantes, locationText, timeSlot, referencia: referenciaTexto } = classification;

  const [modalidadElegida, setModalidadElegida] = useState(initialContext?.modalidad ?? (modalidad_fuente !== "desconocida" ? modalidad : null));
  const [modalidadReviewed, setModalidadReviewed] = useState(() => resumesAt(resumeAtPhase, "modalidad", !reviewExisting));
  const initialLocation = initialContext?.ubicacion ?? locationText ?? null;
  const [ubicacion, setUbicacion] = useState(initialLocation);
  const [coordinates, setCoordinates] = useState(initialContext?.coordinates || null);
  const zoneOptions = ["Palermo", "Villa Crespo", "Almagro", "Colegiales", "Belgrano", "Caballito", "Chacarita"];
  // Modo de ubicación: sólo decide qué panel mostrar y a qué categoría
  // pertenece la selección — nunca se persiste este estado en sí mismo, la
  // única fuente de verdad de CUÁL es la selección efectiva sigue siendo
  // `ubicacion`. "legacy" es de sólo lectura: un pedido guardado antes de
  // que se sacara "Escribir otra zona" con una `ubicacion` de texto libre
  // (no "Cerca mío" ni un barrio de `zoneOptions`) entra acá para mostrarse
  // tal cual, sin ofrecer forma de escribir una zona libre nueva — sólo
  // cambiar a ubicación aproximada o a uno de los barrios de la lista.
  const [locationMode, setLocationMode] = useState(() => {
    if (initialLocation === "Cerca mío") return "aproximada";
    if (initialLocation && zoneOptions.includes(initialLocation)) return "elegir_zona";
    if (initialLocation) return "legacy";
    return null;
  });
  // Si ya hay una ubicación cargada (pedido nuevo con logística inferida, o
  // reedición de uno existente), arranca colapsada en la fila de
  // confirmación — el panel/lista sólo se expande al tocar "Cambiar" o al
  // elegir una fuente desde cero. Estado transitorio, nunca se persiste.
  const [locationExpanded, setLocationExpanded] = useState(() => !initialLocation);
  const [timeSlots, setTimeSlots] = useState(() => {
    const fromContext = normalizeTimeSlots(initialContext);
    if (fromContext.length > 0) return fromContext;
    // timeSlot viene del intérprete en minúscula ("noche"): normalizeTimeSlots
    // lo canonicaliza a "Noche" acá para que BigOption lo muestre seleccionado.
    return normalizeTimeSlots(timeSlot ? [timeSlot] : []);
  });
  // Siempre requiere el botón "Continuar" explícito antes de avanzar — no
  // sólo al reeditar un pedido existente, también en uno nuevo — porque
  // ahora elegir la primera franja ya no debe avanzar la pantalla sola.
  // (resumesAt igual puede saltearla: si se vuelve desde el resumen a una
  // fase posterior, ubicación ya fue revisada en la vuelta anterior.)
  const [locationReviewed, setLocationReviewed] = useState(() => resumesAt(resumeAtPhase, "ubicacion_franja", false));
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  // "denied" | "unavailable" | "timeout" | "unsupported" | "generic" | null
  const [locationErrorKind, setLocationErrorKind] = useState(null);
  const [datoFaltanteTexto, setDatoFaltanteTexto] = useState(initialContext?.datoFaltanteTexto ?? "");
  const [datoFaltanteConfirmado, setDatoFaltanteConfirmado] = useState(() => resumesAt(resumeAtPhase, "dato_faltante", !!initialContext?.datoFaltanteConfirmado && !reviewExisting));

  // Campos de la vieja pantalla "Maqueta o referencia" (eliminada — ver
  // context.md, bloque "Limpiar el flujo de creación musical"): ya no hay
  // forma de crearlos desde acá (sin adjuntar archivo/audio, sin pegar un
  // link), pero un pedido guardado antes de este bloque los conserva tal
  // cual al pasar por ContextStep de nuevo — sólo lectura/pass-through,
  // nunca estado editable ni una fase propia.
  const legacyReferenciaLink = initialContext?.referenciaLink ?? null;
  const legacyArchivoAdjunto = !!initialContext?.archivoAdjunto;
  const legacyArchivoNombre = initialContext?.archivoNombre ?? null;
  const legacyAudioAdjunto = !!initialContext?.audioAdjunto;
  // context.generos (legacy) ya no tiene una pantalla propia acá: se
  // conserva tal cual para el matching actual (buildMatchResult, igual que
  // antes), pero la fuente de verdad de la interfaz nueva es musicWorlds.
  const generos = initialContext?.generos || [];
  const initialMusicWorlds = initialContext?.musicWorlds
    ? normalizeSelectedMusicWorlds(initialContext.musicWorlds)
    : reviewExisting
      ? adaptGenreCodesToMusicWorlds(initialContext?.generos)
      : [];
  const [musicWorlds, setMusicWorlds] = useState(initialMusicWorlds);
  const [musicWorldsConfirmed, setMusicWorldsConfirmed] = useState(() => resumesAt(resumeAtPhase, "musica", !!initialContext?.musicWorldsConfirmed && !reviewExisting));
  const [musicWorldsUndecided, setMusicWorldsUndecided] = useState(!!initialContext?.musicWorldsUndecided);
  const [musicWorldsWereInferred, setMusicWorldsWereInferred] = useState(false);
  const [otherFieldOpen, setOtherFieldOpen] = useState(!!initialContext?.otherMusicWorld);
  const [otherMusicWorldText, setOtherMusicWorldText] = useState(initialContext?.otherMusicWorld ?? "");
  // Menciones reales del catálogo dentro del texto original + la referencia
  // ya interpretada: se usan como `pinnedArtistIds` en MusicReferenceStep,
  // nunca como selección automática (ver contrato del selector aprobado).
  const pinnedArtistIds = findMentionedMusicReferenceIds([classification.originalText, referenciaTexto].filter(Boolean).join(" "));
  const [musicReferenceIds, setMusicReferenceIds] = useState(() => sanitizeStoredMusicReferenceIds(initialContext?.musicReferenceIds));
  const [musicReferencesConfirmed, setMusicReferencesConfirmed] = useState(() => resumesAt(resumeAtPhase, "artistas", !!initialContext?.musicReferencesConfirmed && !reviewExisting));
  const [musicReferencesUndecided, setMusicReferencesUndecided] = useState(!!initialContext?.musicReferencesUndecided);
  const musicWorldsInferenceApplied = useRef(false);
  // Última fase (no "done") que se mostró — ver goBackToLastContextPhase en
  // App: al volver desde el resumen, ContextStep se remonta de cero, así que
  // el padre necesita saber cuál fue la última fase real antes de "done"
  // para reabrir ahí (resumeAtPhase) en vez de reconstruir desde el
  // principio. Se actualiza en cada fase que no sea "done" (nunca al
  // llegar a "done" en sí), así que siempre queda con el valor correcto sin
  // importar cuántas idas y vueltas hubo dentro de esta misma sesión.
  const lastPhaseRef = useRef(null);

  // Para "hacer" (modalidad puede ser presencial u online) y para pedidos
  // puntuales "especial" (sonidista, tuner, etc. — ver Shows en el roadmap):
  // esta pantalla no pregunta género ni artistas de referencia. La
  // definición completa de qué preguntar para "especial" es un bloque
  // aparte (branching Música/Shows); por ahora sólo evita mostrar prompts
  // musicales que no aplican a un pedido puntual.
  const asksAboutMusic = tipo !== "especial";

  const needsModalidad = tipo === "hacer" && (!modalidadElegida || !modalidadReviewed);
  const needsUbicacionFranja = (tipo === "grabar" || (tipo === "hacer" && modalidadElegida === "presencial")) && (!ubicacion || timeSlots.length === 0 || !locationReviewed);
  const needsDatoFaltante = tipo === "especial" && (datos_faltantes || []).includes("fecha_hora") && !datoFaltanteConfirmado;
  const needsMusicWorlds = asksAboutMusic && !musicWorldsConfirmed;
  const needsMusicReferences = asksAboutMusic && !musicReferencesConfirmed;

  let phase = "done";
  if (needsModalidad) phase = "modalidad";
  else if (needsUbicacionFranja) phase = "ubicacion_franja";
  else if (needsDatoFaltante) phase = "dato_faltante";
  else if (needsMusicWorlds) phase = "musica";
  else if (needsMusicReferences) phase = "artistas";

  // Orden real de las fases que aplican a este pedido puntual, en el mismo
  // orden que la cadena de arriba — equivale a la pila de fases visitadas
  // (push implícito al confirmar una fase y avanzar, pop al volver, ver
  // goToPreviousPhase). Se recalcula en cada render a partir del mismo
  // estado que ya decide `phase`, así nunca puede desincronizarse de él.
  const phaseOrder = [];
  if (tipo === "hacer") phaseOrder.push("modalidad");
  if (tipo === "grabar" || (tipo === "hacer" && modalidadElegida === "presencial")) phaseOrder.push("ubicacion_franja");
  if (tipo === "especial" && (datos_faltantes || []).includes("fecha_hora")) phaseOrder.push("dato_faltante");
  if (asksAboutMusic) phaseOrder.push("musica", "artistas");

  // Flecha "‹" de ContextStep: un paso atrás dentro del flujo, no "abandonar
  // todo el alta". Sólo en la primera fase que realmente aplica delega en
  // onBack (vuelve al compositor de texto libre, con el texto intacto — ver
  // goBackToStart en App). En cualquier otra fase, "des-confirma" únicamente
  // la fase inmediatamente anterior: como esa fase es la que ya se había
  // completado para llegar a la actual, sus datos siguen ahí tal cual.
  function goToPreviousPhase() {
    const idx = phaseOrder.indexOf(phase);
    if (idx <= 0) {
      onBack();
      return;
    }
    const previousPhase = phaseOrder[idx - 1];
    if (previousPhase === "modalidad") setModalidadReviewed(false);
    else if (previousPhase === "ubicacion_franja") setLocationReviewed(false);
    else if (previousPhase === "dato_faltante") setDatoFaltanteConfirmado(false);
    else if (previousPhase === "musica") setMusicWorldsConfirmed(false);
    else if (previousPhase === "artistas") setMusicReferencesConfirmed(false);
  }

  useEffect(() => {
    if (phase !== "done") lastPhaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase === "done") {
      onComplete(
        {
          modalidad: modalidadElegida,
          ubicacion,
          coordinates,
          timeSlots,
          datoFaltanteTexto: datoFaltanteTexto || null,
          datoFaltanteConfirmado,
          referenciaLink: legacyReferenciaLink,
          archivoAdjunto: legacyArchivoAdjunto,
          archivoNombre: legacyArchivoNombre,
          audioAdjunto: legacyAudioAdjunto,
          generos,
          musicWorlds,
          musicWorldsConfirmed: true,
          musicWorldsUndecided,
          otherMusicWorld: otherFieldOpen && otherMusicWorldText.trim() ? otherMusicWorldText.trim() : null,
          musicReferenceIds,
          musicReferencesConfirmed: true,
          musicReferencesUndecided,
        },
        lastPhaseRef.current
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "musica" || musicWorldsInferenceApplied.current) return;
    musicWorldsInferenceApplied.current = true;
    if (musicWorlds.length > 0 || musicWorldsUndecided) return;
    const inferenceText = [classification.originalText, classification.summary, referenciaTexto, legacyReferenciaLink, legacyArchivoNombre].filter(Boolean).join(" ");
    const inferred = inferInitialMusicWorlds(inferenceText);
    if (inferred.length > 0) {
      setMusicWorlds(inferred);
      setMusicWorldsWereInferred(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "done") return null;

  // Las dos fuentes de nivel superior son mutuamente excluyentes: elegir una
  // limpia el valor de `ubicacion` sólo si pertenecía a otra fuente, para no
  // perder una selección real al simplemente pasar de una a otra. Las dos
  // dejan `locationExpanded` como estaba (ya es `true` para poder tocar
  // estos botones — sólo se ocultan detrás de la fila compacta una vez
  // confirmada la selección).
  function chooseAproximada() {
    setLocationMode("aproximada");
    setLocationError(null);
    setLocationErrorKind(null);
    if (ubicacion !== "Cerca mío") {
      setUbicacion(null);
      setCoordinates(null);
    }
  }

  function chooseElegirZona() {
    setLocationMode("elegir_zona");
    setLocationError(null);
    setLocationErrorKind(null);
    setCoordinates(null);
    if (!zoneOptions.includes(ubicacion)) setUbicacion(null);
  }

  // Distingue el resultado real de la geolocalización: permiso denegado o
  // API no soportada no vuelven a ofrecer el mismo botón (no tiene sentido
  // reintentar algo que no va a cambiar) — timeout o un error temporal sí
  // permiten reintentar, y en los dos casos la alternativa manual sigue
  // disponible y no bloquea el flujo.
  function requestCurrentLocation() {
    setLocationError(null);
    setLocationErrorKind(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Tu navegador no admite ubicación automática acá.");
      setLocationErrorKind("unsupported");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
        setUbicacion("Cerca mío");
        setLocating(false);
        // Éxito: colapsa a la fila de confirmación, igual que elegir un
        // barrio — ver `selectZone` más abajo.
        setLocationExpanded(false);
      },
      (err) => {
        setLocating(false);
        const code = err && err.code;
        if (code === 1) {
          setLocationError("No nos diste permiso para acceder a tu ubicación.");
          setLocationErrorKind("denied");
        } else if (code === 2) {
          setLocationError("No pudimos determinar tu ubicación en este momento.");
          setLocationErrorKind("unavailable");
        } else if (code === 3) {
          setLocationError("La búsqueda de ubicación tardó demasiado.");
          setLocationErrorKind("timeout");
        } else {
          setLocationError("No pudimos acceder a tu ubicación.");
          setLocationErrorKind("generic");
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }

  function selectZone(zone) {
    setCoordinates(null);
    setLocationError(null);
    setUbicacion(zone);
    // Elegir un barrio colapsa la lista a la fila de confirmación — volver a
    // abrirla es la única forma de cambiarlo (ver la fila "Cambiar" abajo).
    setLocationExpanded(false);
  }

  // Valor legible de la ubicación ya confirmada, o null si todavía no hay
  // una selección válida para el modo activo — es la única condición que
  // decide si se muestra la fila compacta (en vez del panel/lista) y si
  // "Horario" ya puede aparecer.
  const confirmedLocationLabel =
    locationMode === "legacy" && ubicacion
      ? ubicacion
      : locationMode === "aproximada" && ubicacion === "Cerca mío"
        ? "Ubicación aproximada"
        : locationMode === "elegir_zona" && zoneOptions.includes(ubicacion)
          ? ubicacion
          : null;
  const showCompactLocation = !locationExpanded && !!confirmedLocationLabel;

  const qHeading = { fontFamily: EDITORIAL.fontSans, fontWeight: 800, fontSize: 24, color: EDITORIAL.carbon, margin: 0, lineHeight: 1.25, letterSpacing: -0.2 };
  // Cuántos de los dos lugares disponibles ya están ocupados: cada mundo
  // elegido cuenta uno, y "Otro" activado (con o sin texto todavía) cuenta
  // el suyo — así no hace falta esperar a que tenga texto para bloquear el
  // resto de las alternativas.
  const musicSelectionCount = musicWorlds.length + (otherFieldOpen ? 1 : 0);
  const hasConcreteMusicSelection = musicWorlds.length > 0 || (otherFieldOpen && otherMusicWorldText.trim().length > 0);
  const canContinueMusica = musicWorldsUndecided || hasConcreteMusicSelection;

  function toggleMusicWorld(code) {
    if (musicWorldsUndecided) setMusicWorldsUndecided(false);
    setMusicWorlds((current) => {
      if (current.includes(code)) return current.filter((c) => c !== code);
      if (current.length + (otherFieldOpen ? 1 : 0) >= 2) return current;
      return normalizeSelectedMusicWorlds([...current, code]);
    });
  }

  function toggleMusicWorldsUndecided() {
    if (musicWorldsUndecided) {
      setMusicWorldsUndecided(false);
      return;
    }
    setMusicWorldsUndecided(true);
    setMusicWorlds([]);
    setOtherFieldOpen(false);
    setOtherMusicWorldText("");
  }

  function toggleOtherMusicWorldField() {
    if (otherFieldOpen) {
      setOtherFieldOpen(false);
      setOtherMusicWorldText("");
      return;
    }
    if (musicWorlds.length >= 2) return;
    if (musicWorldsUndecided) setMusicWorldsUndecided(false);
    setOtherFieldOpen(true);
  }
  // Placeholder de hoy: el fallback local todavía no manda una pregunta
  // puntual (classification.clarificationQuestion queda undefined), así que
  // esto resuelve siempre a la pregunta por defecto sin cambiar nada visible.
  const aclaracionPregunta = resolveClarificationQuestion(classification.clarificationQuestion);
  // Encabezado de cada fase: título + a lo sumo un doodle editorial, nunca
  // dentro de una opción individual.
  // `size` es aditivo (default: el tamaño compartido `qHeading.fontSize`,
  // 24) — sólo "Ubicación y horario" lo pisa con un valor menor (ver más
  // abajo), el resto de las fases sigue con el tamaño de siempre.
  function PhaseHeading({ children, doodle, size }) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
        <h2 style={{ ...qHeading, fontSize: size || qHeading.fontSize }}>{children}</h2>
        {doodle}
      </div>
    );
  }

  return (
    <Screen className="q-fade" topSlot={<EditorialBackButton onClick={goToPreviousPhase} />}>
      <div key={phase} className="q-fade">
        {phase === "modalidad" && (
          <>
            <PhaseHeading doodle={<DoodlePathsDiverging width={44} />}>¿Cómo preferís hacerlo?</PhaseHeading>
            <div>
              {["Presencial", "Online", "Puedo de las dos formas"].map((op) => {
                const val = op === "Presencial" ? "presencial" : op === "Online" ? "online" : "me_da_igual";
                return <EditorialBigOption key={op} label={op} selected={modalidadElegida === val} onClick={() => {
                  setModalidadElegida(val);
                  setModalidadReviewed(true);
                  if (val !== "presencial") {
                    setUbicacion(null);
                    setCoordinates(null);
                    setTimeSlots([]);
                  }
                }} />;
              })}
            </div>
          </>
        )}

        {phase === "ubicacion_franja" && (
          <>
            <PhaseHeading doodle={<DoodlePinClock width={40} />} size={21}>Ubicación y horario</PhaseHeading>
            <div style={{ marginBottom: 18 }}>
              <EditorialLabel>Ubicación</EditorialLabel>
              {showCompactLocation ? (
                // Fila de confirmación: reemplaza tanto la acción principal
                // como las filas secundarias de abajo una vez que hay una
                // selección válida (aproximada, un barrio, o legacy de sólo
                // lectura) — "Cambiar" es la única forma de volver a abrir el
                // panel/lista correspondiente.
                <button
                  onClick={() => setLocationExpanded(true)}
                  className="press"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    width: "100%",
                    minHeight: 48,
                    padding: "0 14px",
                    textAlign: "left",
                    background: "none",
                    border: `1px solid ${EDITORIAL.border}`,
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <LocationPinIcon size={16} />
                    <span style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 600, fontSize: 14.5, color: EDITORIAL.carbon, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {confirmedLocationLabel}
                    </span>
                  </span>
                  <span style={{ fontFamily: EDITORIAL.fontSans, fontSize: 12.5, color: EDITORIAL.muted, textDecoration: "underline", textUnderlineOffset: 3, flexShrink: 0 }}>
                    Cambiar
                  </span>
                </button>
              ) : (
                <>
                  <p style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 600, color: EDITORIAL.carbon, fontSize: 14.5, lineHeight: 1.4, margin: "-2px 0 10px" }}>
                    ¿En qué zona te sirve trabajar?
                  </p>
                  <div>
                    {/* Acción principal: única fila con borde propio (no un
                        divisor compartido con la lista de abajo), para que se
                        lea como LA acción de la sección y no como un ítem más
                        de una lista de barrios. */}
                    <button
                      onClick={chooseAproximada}
                      className="press"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        minHeight: 48,
                        padding: "0 14px",
                        textAlign: "left",
                        background: "none",
                        border: `1px solid ${EDITORIAL.border}`,
                        borderRadius: 3,
                        cursor: "pointer",
                      }}
                    >
                      <LocationPinIcon size={16} />
                      <span style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 600, fontSize: 14.5, color: EDITORIAL.carbon }}>
                        Usar mi ubicación aproximada
                      </span>
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0" }}>
                      <div style={{ flex: 1, height: 1, background: EDITORIAL.border }} />
                      <span style={{ fontFamily: EDITORIAL.fontSans, fontSize: 11.5, color: EDITORIAL.muted }}>o</span>
                      <div style={{ flex: 1, height: 1, background: EDITORIAL.border }} />
                    </div>

                    {/* Acción secundaria: mismo peso de texto (carbón) que la
                        acción principal, pero sin caja — se distingue de las
                        filas de selección (barrios) de abajo, que siguen
                        grises hasta que se eligen. */}
                    <button
                      onClick={chooseElegirZona}
                      className="press"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        borderBottom: `1px solid ${EDITORIAL.border}`,
                        padding: "14px 2px",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 600, fontSize: 14.5, color: EDITORIAL.carbon }}>Elegir barrio o zona</span>
                      <ChevronIcon direction={locationMode === "elegir_zona" ? "down" : "right"} />
                    </button>
                  </div>

                  {locationMode === "aproximada" && (
                    <div style={{ background: EDITORIAL.surface, border: `1px solid ${EDITORIAL.border}`, padding: 12, marginTop: 10 }}>
                      {locating && (
                        <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 12.5, lineHeight: 1.45, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                          Buscando ubicación<EditorialThinkingDots />
                        </p>
                      )}
                      {!locating && ubicacion === "Cerca mío" && (
                        <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.accent, fontWeight: 700, fontSize: 12.5, margin: "0 0 8px" }}>
                          Ubicación detectada
                        </p>
                      )}
                      {!locating && ubicacion !== "Cerca mío" && locationError && (
                        <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.error, fontSize: 12.5, lineHeight: 1.45, margin: "0 0 8px" }}>
                          {locationError}
                        </p>
                      )}
                      {!locating && (
                        <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 12, lineHeight: 1.45, margin: ubicacion === "Cerca mío" ? 0 : "0 0 10px" }}>
                          Usamos una zona aproximada para buscar profesionales cerca. No compartimos tu dirección exacta.
                        </p>
                      )}
                      {!locating && ubicacion === "Cerca mío" && (
                        <div style={{ marginTop: 10 }}>
                          <EditorialTextLink onClick={chooseElegirZona}>Elegir zona manualmente</EditorialTextLink>
                        </div>
                      )}
                      {!locating && ubicacion !== "Cerca mío" && (locationErrorKind === "denied" || locationErrorKind === "unsupported") && (
                        <div style={{ marginTop: 10 }}>
                          <EditorialSecondaryButton full onClick={chooseElegirZona}>Elegir zona manualmente</EditorialSecondaryButton>
                        </div>
                      )}
                      {!locating && ubicacion !== "Cerca mío" && (locationErrorKind === "timeout" || locationErrorKind === "generic") && (
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                          <EditorialSecondaryButton full onClick={requestCurrentLocation}>Reintentar ubicación</EditorialSecondaryButton>
                          <EditorialTextLink onClick={chooseElegirZona}>Elegir zona manualmente</EditorialTextLink>
                        </div>
                      )}
                      {!locating && ubicacion !== "Cerca mío" && !locationErrorKind && (
                        <div style={{ marginTop: 10 }}>
                          <EditorialSecondaryButton full onClick={requestCurrentLocation}>Activar ubicación</EditorialSecondaryButton>
                        </div>
                      )}
                    </div>
                  )}

                  {locationMode === "elegir_zona" && (
                    <div style={{ marginTop: 10 }}>
                      {zoneOptions.map((zone) => (
                        <EditorialBigOption key={zone} dense label={zone} selected={ubicacion === zone} onClick={() => selectZone(zone)} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            {showCompactLocation && (
              <div className="q-fade">
                <EditorialLabel>Horario</EditorialLabel>
                <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 12, lineHeight: 1.4, margin: "-4px 0 10px" }}>
                  Podés elegir hasta dos opciones
                </p>
                <div>
                  {TIME_SLOT_OPTIONS.map((op) => (
                    <EditorialBigOption
                      key={op}
                      label={op}
                      selected={timeSlots.includes(op)}
                      disabled={isTimeSlotOptionDisabled(timeSlots, op)}
                      onClick={() => setTimeSlots((current) => toggleTimeSlot(current, op))}
                    />
                  ))}
                  <EditorialBigOption
                    label={FLEXIBLE_TIME_SLOT}
                    selected={timeSlots.includes(FLEXIBLE_TIME_SLOT)}
                    onClick={() => setTimeSlots((current) => toggleTimeSlot(current, FLEXIBLE_TIME_SLOT))}
                  />
                </div>
                {timeSlots.length > 0 && !locationReviewed && (
                  <div style={{ marginTop: 18 }}>
                    <EditorialPrimaryButton full onClick={() => setLocationReviewed(true)}>Continuar</EditorialPrimaryButton>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {phase === "dato_faltante" && (
          <>
            <PhaseHeading doodle={<DoodleSpeechBubble width={40} />}>Necesitamos una aclaración</PhaseHeading>

            <EditorialLabel>Tu pedido</EditorialLabel>
            <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.carbon, fontSize: 14.5, lineHeight: 1.5, fontStyle: "italic", margin: "0 0 20px" }}>
              “{classification.originalText}”
            </p>

            <div style={{ height: 1, background: EDITORIAL.border, margin: "0 0 20px" }} />

            <EditorialLabel>Una cosa más</EditorialLabel>
            <p style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 700, color: EDITORIAL.carbon, fontSize: 17, lineHeight: 1.35, margin: "0 0 18px" }}>
              {aclaracionPregunta}
            </p>

            <EditorialUnderlineField value={datoFaltanteTexto} onChange={(e) => setDatoFaltanteTexto(e.target.value)} placeholder="Ej: sábado a la noche" autoFocus />
            <div style={{ marginTop: 26 }}>
              <EditorialPrimaryButton full disabled={datoFaltanteTexto.trim().length === 0} onClick={() => setDatoFaltanteConfirmado(true)}>
                Continuar
              </EditorialPrimaryButton>
            </div>
          </>
        )}

        {phase === "musica" && (
          <>
            <PhaseHeading doodle={<DoodleSoundStars width={42} />}>¿Por dónde va tu música?</PhaseHeading>
            <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13.5, lineHeight: 1.5, margin: "-10px 0 18px" }}>
              {musicWorldsWereInferred
                ? "Marcamos lo que entendimos de tu pedido. Podés cambiarlo."
                : "Elegí hasta dos. Nos ayuda a encontrar productores que hablan el mismo idioma musical."}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 20 }}>
              {MUSIC_WORLDS.map((world) => (
                <EditorialBigOption
                  key={world.code}
                  label={world.label}
                  selected={musicWorlds.includes(world.code)}
                  disabled={musicSelectionCount >= 2 && !musicWorlds.includes(world.code)}
                  onClick={() => toggleMusicWorld(world.code)}
                />
              ))}
            </div>
            {musicSelectionCount >= 2 && (
              <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 11.5, lineHeight: 1.4, margin: "10px 0 0" }}>
                Podés elegir hasta dos.
              </p>
            )}
            <div style={{ display: "flex", gap: 22, marginTop: 18 }}>
              <button
                onClick={toggleMusicWorldsUndecided}
                className="press"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: EDITORIAL.fontSans,
                  fontSize: 13.5,
                  fontWeight: musicWorldsUndecided ? 700 : 400,
                  color: musicWorldsUndecided ? EDITORIAL.accent : EDITORIAL.muted,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Todavía no sé
              </button>
              <button
                onClick={toggleOtherMusicWorldField}
                disabled={!otherFieldOpen && musicWorlds.length >= 2}
                className="press"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: !otherFieldOpen && musicWorlds.length >= 2 ? "default" : "pointer",
                  fontFamily: EDITORIAL.fontSans,
                  fontSize: 13.5,
                  fontWeight: otherFieldOpen ? 700 : 400,
                  color: !otherFieldOpen && musicWorlds.length >= 2 ? EDITORIAL.border : otherFieldOpen ? EDITORIAL.accent : EDITORIAL.muted,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Otro
              </button>
            </div>
            {otherFieldOpen && (
              <div style={{ marginTop: 14 }}>
                <EditorialUnderlineField
                  value={otherMusicWorldText}
                  onChange={(e) => setOtherMusicWorldText(e.target.value)}
                  placeholder="Escribí el género"
                  autoFocus
                  small
                />
              </div>
            )}
            <div style={{ marginTop: 26 }}>
              <EditorialPrimaryButton full disabled={!canContinueMusica} onClick={() => setMusicWorldsConfirmed(true)}>Continuar</EditorialPrimaryButton>
            </div>
          </>
        )}

        {phase === "artistas" && (
          <MusicReferenceStep
            musicWorlds={musicWorlds}
            pinnedArtistIds={pinnedArtistIds}
            selectedArtistIds={musicReferenceIds}
            onChangeSelectedArtistIds={setMusicReferenceIds}
            undecided={musicReferencesUndecided}
            onChangeUndecided={setMusicReferencesUndecided}
            onContinue={() => setMusicReferencesConfirmed(true)}
          />
        )}
      </div>
    </Screen>
  );
}

/* ---------------- pantalla: resumen editable ---------------- */

function SummaryScreen({ classification, context, onEdit, onPublish, publishing, publishError, editing }) {
  const { summary, originalText, referencia: referenciaClasif } = classification;
  const detalles = [];
  if (context.ubicacion) detalles.push(context.ubicacion);
  const timeSlotsLabel = formatTimeSlots(context);
  if (timeSlotsLabel) detalles.push(timeSlotsLabel);
  if (context.datoFaltanteTexto) detalles.push(context.datoFaltanteTexto);
  if (context.modalidad === "online") detalles.push("Online");

  const refBits = [];
  if (context.referenciaLink) refBits.push(context.referenciaLink);
  if (context.archivoAdjunto) refBits.push(context.archivoNombre || "archivo adjunto");
  if (context.audioAdjunto) refBits.push("audio adjunto");
  const refTexto = referenciaClasif || (refBits.length ? refBits.join(" · ") : null);
  // Fallback legible sólo para pedidos legacy sin musicWorlds: la fuente de
  // verdad de la interfaz nueva son los labels de MUSIC_WORLDS, no este mapa.
  const legacyGenreLabels = { urbano: "Urbano", trap: "Trap", reggaeton: "Reggaetón", pop: "Pop", rock: "Rock", alternativo: "Indie / alternativo", electronica: "Electrónica", no_se: "Sin definir" };
  const musicWorldLabelByCode = Object.fromEntries(MUSIC_WORLDS.map((world) => [world.code, world.label]));
  let musicaTexto = null;
  if (context.musicWorldsUndecided) {
    musicaTexto = "Música: Todavía no lo tengo definido";
  } else if ((context.musicWorlds || []).length > 0 || context.otherMusicWorld) {
    const labels = (context.musicWorlds || []).map((code) => musicWorldLabelByCode[code]).filter(Boolean);
    if (context.otherMusicWorld) labels.push(context.otherMusicWorld);
    if (labels.length > 0) musicaTexto = `Música: ${labels.join(" · ")}`;
  } else if ((context.generos || []).length > 0) {
    const labels = context.generos.map((g) => legacyGenreLabels[g] || g);
    musicaTexto = `Música: ${labels.join(" · ")}`;
  }

  // Resuelve nombres reales desde el catálogo — nunca IDs. Un pedido legacy
  // sin musicReferenceIds (o la decisión explícita de no tener referencia)
  // simplemente no muestra esta línea, sin renderizar nada negativo.
  const musicReferenceCatalogById = new Map(MUSIC_REFERENCE_CATALOG.map((entry) => [entry.id, entry]));
  const artistasNombres = (context.musicReferenceIds || [])
    .map((id) => musicReferenceCatalogById.get(id)?.name)
    .filter(Boolean);
  const artistasTexto = artistasNombres.length > 0 ? `Artistas: ${artistasNombres.join(" · ")}` : null;

  return (
    <Screen className="q-fade" topSlot={<EditorialBackButton onClick={onEdit} />}>
      {/* La pantalla arranca directamente con la formulación en lenguaje
          natural del pedido (classification.summary) — antes había además
          un kicker en mayúscula con classification.title (ej. "GRABAR UNA
          CANCIÓN") que era redundante con esto mismo. */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.carbon, fontSize: 16.5, lineHeight: 1.5, margin: "0 0 12px", flex: 1 }}>{summary}</p>
        <DoodleCheck width={30} />
      </div>
      {refTexto && <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13, margin: "0 0 6px" }}>Referencia: {refTexto}</p>}
      {musicaTexto && <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13, margin: "0 0 6px" }}>{musicaTexto}</p>}
      {artistasTexto && <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13, margin: "0 0 6px" }}>{artistasTexto}</p>}
      {detalles.length > 0 && (
        <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13, margin: 0 }}>{detalles.join(" · ")}</p>
      )}

      <div style={{ height: 1, background: EDITORIAL.border, margin: "22px 0" }} />

      <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 12, lineHeight: 1.4, margin: 0 }}>
        Tu texto original: “{originalText}”
      </p>

      {publishError && (
        <p style={{ color: EDITORIAL.error, fontFamily: EDITORIAL.fontSans, fontSize: 12.5, marginTop: 14 }}>
          {editing ? "No pudimos actualizar tu pedido. Probá de nuevo." : "No pudimos publicar tu pedido. Probá de nuevo."}
        </p>
      )}
      {editing && (
        <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 11.5, lineHeight: 1.45, marginTop: 10 }}>
          Al actualizar, las conversaciones y propuestas que ya tenías se cierran y volvemos a buscar productores con los datos nuevos.
        </p>
      )}

      <div style={{ marginTop: 26 }}>
        <EditorialPrimaryButton full disabled={publishing} onClick={onPublish}>
          {publishing ? (editing ? "Actualizando…" : "Publicando…") : editing ? "Actualizar pedido" : "Publicar pedido"}
        </EditorialPrimaryButton>
        {/* Acción secundaria: vuelve a la última fase editable del flujo sin
            perder nada ya cargado (ni el draft ni la interpretación) y sin
            publicar — mismo handler que la flecha de arriba (onEdit). */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          <EditorialTextLink disabled={publishing} onClick={onEdit}>Editar pedido</EditorialTextLink>
        </div>
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
  // Bloque 4: "Editar pedido"/"Cancelar pedido" pasaron de dos links siempre
  // visibles a un menú discreto (tres puntos) — mismas dos acciones, mismas
  // condiciones de cuándo se ofrecen (ver el bloque estado==="cancelado" /
  // "reservado" / confirmingCancel / showBookingArea más abajo), sólo detrás
  // de un toque extra. optionsMenuOpen es puramente de UI, nunca se persiste.
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const optionsMenuRef = useRef(null);
  const optionsButtonRef = useRef(null);

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

  // Cerrar el menú de opciones del pedido al tocar afuera, con Escape (foco
  // vuelve al botón que lo abrió), y enfocar el primer ítem al abrirlo — el
  // resto de la navegación por teclado (Tab entre ítems) sale gratis porque
  // son <button> reales dentro del menú.
  useEffect(() => {
    if (!optionsMenuOpen) return;
    const first = optionsMenuRef.current?.querySelector('[role="menuitem"]');
    first?.focus();
    function handlePointerDown(e) {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target) && optionsButtonRef.current && !optionsButtonRef.current.contains(e.target)) {
        setOptionsMenuOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setOptionsMenuOpen(false);
        optionsButtonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [optionsMenuOpen]);

  function handleOptionsMenuKeyDown(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(optionsMenuRef.current?.querySelectorAll('[role="menuitem"]') || []);
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement);
    const next = e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
    items[next]?.focus();
  }

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
    <div className="q-fade" style={{ display: "flex", flexDirection: "column", height: "100%", background: EDITORIAL.bg }}>
      <div style={{ padding: "20px 22px 0", minHeight: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <EditorialBackButton disabled={cancelling} onClick={onBack} />
        </div>
        {estado === "cancelado" ? (
          <span style={{ fontFamily: EDITORIAL.fontMono, fontSize: 11, letterSpacing: 0.6, color: EDITORIAL.muted, textTransform: "uppercase" }}>
            Pedido cancelado
          </span>
        ) : estado === "reservado" ? (
          // Reservado no ofrece editar ni cancelar: editar dejó de tener
          // sentido con un profesional confirmado, y cancelar con seña
          // pagada requiere un esquema de devoluciones que no existe en este
          // prototipo (ver context.md).
          <span style={{ fontFamily: EDITORIAL.fontMono, fontSize: 11, letterSpacing: 0.6, color: EDITORIAL.accent, textTransform: "uppercase" }}>
            Reserva confirmada
          </span>
        ) : confirmingCancel ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontFamily: EDITORIAL.fontSans, fontSize: 13, color: EDITORIAL.muted }}>¿Cancelar este pedido?</span>
            <EditorialTextLink disabled={cancelling} onClick={confirmarCancelacion}>{cancelling ? "Cancelando…" : "Sí, cancelar"}</EditorialTextLink>
            <EditorialTextLink disabled={cancelling} onClick={() => setConfirmingCancel(false)}>No</EditorialTextLink>
          </div>
        ) : showBookingArea ? (
          // Con una propuesta ya elegida tampoco se ofrece editar ni
          // cancelar: la política de cancelación posterior todavía no está
          // definida (requiere modelar devoluciones), así que sólo queda
          // disponible antes de elegir una propuesta (ver puedeCancelarse).
          null
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", position: "relative" }}>
            <button
              ref={optionsButtonRef}
              type="button"
              aria-label="Opciones del pedido"
              aria-haspopup="menu"
              aria-expanded={optionsMenuOpen}
              onClick={() => setOptionsMenuOpen((v) => !v)}
              className="press"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, margin: "-6px -6px -6px 0", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              <MoreOptionsIcon />
            </button>
            {optionsMenuOpen && (
              <div
                ref={optionsMenuRef}
                role="menu"
                aria-label="Opciones del pedido"
                onKeyDown={handleOptionsMenuKeyDown}
                style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 176, zIndex: 5,
                  background: EDITORIAL.bg, border: `1px solid ${EDITORIAL.border}`, borderRadius: 4,
                  boxShadow: "0 8px 22px rgba(27,24,21,0.14)", padding: 4,
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setOptionsMenuOpen(false); onEdit(); }}
                  className="press"
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderRadius: 3, padding: "10px 12px", fontFamily: EDITORIAL.fontSans, fontSize: 13.5, color: EDITORIAL.carbon, cursor: "pointer" }}
                >
                  Editar pedido
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setOptionsMenuOpen(false); setConfirmingCancel(true); }}
                  className="press"
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderRadius: 3, padding: "10px 12px", fontFamily: EDITORIAL.fontSans, fontSize: 13.5, color: EDITORIAL.error, cursor: "pointer" }}
                >
                  Cancelar pedido
                </button>
              </div>
            )}
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
          <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
            Este pedido fue cancelado. Ya no se están buscando profesionales para él.
          </p>
        </div>
      ) : feedVacio && recovery === "aclaracion" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 26px 26px" }}>
          <h2 style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 800, fontSize: 22, color: EDITORIAL.carbon, margin: "0 0 10px", lineHeight: 1.25, letterSpacing: -0.2 }}>
            Una aclaración más
          </h2>
          <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 20px" }}>
            ¿Hay algún estilo o artista de referencia que ayude a encontrar mejores opciones?
          </p>
          <EditorialUnderlineField value={aclaracionTexto} onChange={(e) => setAclaracionTexto(e.target.value)} placeholder="Ej: algo parecido a..." autoFocus />
          <div style={{ marginTop: 22 }}>
            <EditorialPrimaryButton full disabled={!aclaracionTexto.trim() || enviandoAclaracion} onClick={enviarAclaracion}>
              {enviandoAclaracion ? "Buscando…" : "Buscar de nuevo"}
            </EditorialPrimaryButton>
          </div>
          {actionError && <p style={{ color: EDITORIAL.error, fontFamily: EDITORIAL.fontSans, fontSize: 12.5, marginTop: 14 }}>{actionError}</p>}
        </div>
      ) : feedVacio && recovery === "curada" ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 26px" }}>
          <h2 style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 800, fontSize: 21, color: EDITORIAL.carbon, margin: "0 0 10px", lineHeight: 1.25, letterSpacing: -0.2 }}>
            Algunas opciones con horario disponible
          </h2>
          <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
            No es un match perfecto de estilo, pero tienen disponibilidad ahora.
          </p>
          <div>
            {curados.map((p) => (
              <div key={p.productor} style={{ display: "flex", gap: 12, borderBottom: `1px solid ${EDITORIAL.border}`, padding: "16px 0" }}>
                <ProducerPhoto name={p.productor} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 700, color: EDITORIAL.carbon, fontSize: 14, marginBottom: 3 }}>{p.productor}</div>
                  <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 12.5, lineHeight: 1.4, margin: "0 0 10px" }}>{p.disponibilidad}</p>
                  <EditorialPrimaryButton full disabled={solicitando === p.productor} onClick={() => solicitarHorario(p)}>
                    {solicitando === p.productor ? "Solicitando…" : "Solicitar este horario"}
                  </EditorialPrimaryButton>
                </div>
              </div>
            ))}
          </div>
          {actionError && <p style={{ color: EDITORIAL.error, fontFamily: EDITORIAL.fontSans, fontSize: 12.5, marginTop: 14 }}>{actionError}</p>}
        </div>
      ) : feedVacio ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "safe center", alignItems: "center", textAlign: "center", padding: "0 26px 26px" }}>
          <h2 style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 800, fontSize: 22, color: EDITORIAL.carbon, margin: "0 0 10px", lineHeight: 1.25, letterSpacing: -0.2 }}>
            Tu proyecto ya está en movimiento
          </h2>
          <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
            {ampliado
              ? "Estamos ampliando la búsqueda a más estilos para encontrarte opciones. Podés cerrar la app; te avisamos acá."
              : "Estamos seleccionando profesionales que puedan encajar con lo que querés hacer. Podés cerrar la app; te avisamos cuando alguien quiera conocer mejor tu proyecto o enviarte una propuesta."}
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 26px" }}>
          <h2 style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 800, fontSize: 20, color: EDITORIAL.carbon, margin: "0 0 20px", lineHeight: 1.25, letterSpacing: -0.2 }}>
            Tu proyecto ya está en movimiento
          </h2>

          <div>
            {intereses
              .filter((it) => !it.resuelto)
              .map((it) => (
                <button
                  key={it.id}
                  onClick={() => onOpenInteres(it)}
                  className="press offer-in"
                  style={{ display: "flex", gap: 12, textAlign: "left", width: "100%", background: "none", border: "none", borderBottom: `1px solid ${EDITORIAL.border}`, padding: "16px 0", cursor: "pointer" }}
                >
                  <ProducerPhoto name={it.productor} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 700, color: EDITORIAL.carbon, fontSize: 14, marginBottom: 3 }}>
                      {it.productor} quiere conocer mejor tu proyecto
                    </div>
                    <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 12.5, lineHeight: 1.4, margin: 0 }}>{it.porQueEncaja}</p>
                  </div>
                </button>
              ))}

            {/* Punto 9: lo que propone primero, el precio no compite por atención. */}
            {ofertas.map((o) => (
              <button
                key={o.id}
                onClick={() => onSelectOffer(o)}
                className="press offer-in"
                style={{ display: "flex", gap: 12, textAlign: "left", width: "100%", background: "none", border: "none", borderBottom: `1px solid ${EDITORIAL.border}`, padding: "16px 0", cursor: "pointer" }}
              >
                <ProducerPhoto name={o.productor} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 700, color: EDITORIAL.carbon, fontSize: 14.5, marginBottom: 4 }}>{o.productor}</div>
                  <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.carbon, fontSize: 12.5, lineHeight: 1.4, margin: "0 0 6px" }}>{o.propuesta}</p>
                  <span style={{ fontFamily: EDITORIAL.fontMono, color: EDITORIAL.muted, fontSize: 11.5 }}>
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
  // Bloque 4: `experiencia` es el campo vigente (lista); `trabajo` es la
  // forma vieja (string suelto) que puede seguir viviendo tal cual en una
  // oferta ya guardada en storage desde antes de este bloque — se envuelve
  // en un array de un solo elemento para que el render de abajo sea uno solo
  // para las dos formas. Sin ninguna de las dos, la sección no se muestra.
  const experiencia = offer.experiencia || (offer.trabajo ? [offer.trabajo] : []);
  const equipo = offer.equipo || [];
  const espacioFotos = offer.modalidadTipo === "Presencial" ? (offer.espacioFotos || []) : [];
  const [openPhotoIndex, setOpenPhotoIndex] = useState(null);

  useEffect(() => {
    if (openPhotoIndex === null) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpenPhotoIndex(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openPhotoIndex]);

  return (
    <div className="q-fade" style={{ display: "flex", flexDirection: "column", height: "100%", background: EDITORIAL.bg }}>
      <div style={{ padding: "20px 22px 0", minHeight: 20 }}>
        <EditorialBackButton onClick={onBack} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 22px 12px" }}>
        {/* Profesional y encaje. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <ProducerPhoto name={offer.productor} width={52} height={52} radius={12} />
          <div>
            <div style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 700, color: EDITORIAL.carbon, fontSize: 17 }}>{offer.productor}</div>
            <div style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13 }}>{offer.zona ? offer.zona : offer.modalidadTipo}</div>
          </div>
        </div>

        {/* Punto 9: la propuesta va antes que el precio. */}
        <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.carbon, fontSize: 15, lineHeight: 1.55, margin: "18px 0 20px" }}>{offer.propuesta}</p>

        <div style={{ marginBottom: 20 }}>
          <EditorialLabel>Su sonido</EditorialLabel>
          <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.carbon, fontSize: 14, lineHeight: 1.5, margin: "0 0 6px" }}>{offer.topArtists.join(" · ")}</p>
          {offer.spotifyConnected && (
            <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 12.5, margin: 0 }}>
              <span style={{ color: EDITORIAL.accent }}>✓</span> Spotify conectado
            </p>
          )}
        </div>

        <div style={{ height: 1, background: EDITORIAL.border, margin: "0 0 18px" }} />

        {/* Precio. */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: EDITORIAL.fontMono, fontSize: 26, color: EDITORIAL.carbon, fontWeight: 600 }}>{formatMoney(precioFinal)}</div>
          <div style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 12.5, marginTop: 2 }}>{offer.unidad}</div>
        </div>

        {/* Qué incluye. */}
        <div style={{ marginBottom: 18 }}>
          <EditorialLabel>Qué incluye</EditorialLabel>
          <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.carbon, fontSize: 13.5, margin: 0 }}>{offer.incluye}</p>
        </div>

        <div style={{ height: 1, background: EDITORIAL.border, margin: "0 0 18px" }} />

        {/* Disponibilidad. */}
        <div style={{ marginBottom: 18 }}>
          <EditorialLabel>Zona y disponibilidad</EditorialLabel>
          <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.carbon, fontSize: 13.5, margin: "0 0 4px" }}>
            {offer.modalidadTipo}{offer.zona ? ` · ${offer.zona}` : ""}
          </p>
          <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13, margin: 0 }}>{offer.disponibilidad}</p>
        </div>

        {(experiencia.length > 0 || equipo.length > 0 || espacioFotos.length > 0) && (
          <div style={{ height: 1, background: EDITORIAL.border, margin: "0 0 18px" }} />
        )}

        {/* Bloque 4: experiencia / equipamiento / espacio — cada sección se
            oculta del todo si el offer no trae ese campo (nunca un
            placeholder vacío), para no romper con ofertas viejas guardadas
            antes de este bloque. */}
        {experiencia.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <EditorialLabel>Experiencia</EditorialLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {experiencia.map((item, i) => (
                <p key={i} style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.carbon, fontSize: 13.5, lineHeight: 1.4, margin: 0 }}>{item}</p>
              ))}
            </div>
          </div>
        )}

        {equipo.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <EditorialLabel>Equipamiento</EditorialLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {equipo.map((item, i) => (
                <span key={i} style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.carbon, fontSize: 13.5, lineHeight: 1.4 }}>{item}</span>
              ))}
            </div>
          </div>
        )}

        {espacioFotos.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <EditorialLabel>Espacio de trabajo</EditorialLabel>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
              {espacioFotos.map((caption, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setOpenPhotoIndex(i)}
                  className="press"
                  style={{ flexShrink: 0, background: "none", border: "none", padding: 0, cursor: "pointer", borderRadius: 6 }}
                >
                  <ProducerSpacePhoto
                    seed={`${offer.productor}-espacio-${i}`}
                    width={112}
                    height={84}
                    radius={6}
                    alt={`Espacio de trabajo de ${offer.productor}: ${caption}`}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Confianza. */}
        <div style={{ marginBottom: 8 }}>
          <EditorialLabel>Señales de confianza</EditorialLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {offer.confianza.map((c) => (
              <span key={c} style={{ fontFamily: EDITORIAL.fontSans, fontSize: 13, color: EDITORIAL.carbon }}>
                <span style={{ color: EDITORIAL.accent }}>✓</span> {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 22px 20px" }}>
        {chooseError && <p style={{ color: EDITORIAL.error, fontFamily: EDITORIAL.fontSans, fontSize: 12.5, margin: "0 0 10px" }}>{chooseError}</p>}
        <div style={{ display: "flex", gap: 9 }}>
          <EditorialSecondaryButton full disabled={choosing || messaging} onClick={onMessage}>{messaging ? "Abriendo…" : "Enviar mensaje"}</EditorialSecondaryButton>
          <EditorialPrimaryButton full disabled={choosing || messaging} onClick={onChoose}>
            {choosing ? "Eligiendo…" : "Elegir propuesta"}
          </EditorialPrimaryButton>
        </div>
      </div>

      {openPhotoIndex !== null && espacioFotos[openPhotoIndex] !== undefined && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ampliada — ${espacioFotos[openPhotoIndex]}`}
          onClick={() => setOpenPhotoIndex(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(27,24,21,0.94)", zIndex: 20, display: "flex", flexDirection: "column" }}
        >
          <div style={{ padding: "20px 22px 0" }} onClick={(e) => e.stopPropagation()}>
            <EditorialCloseButton onClick={() => setOpenPhotoIndex(null)} color={EDITORIAL.bg} ariaLabel="Cerrar foto" />
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <ProducerSpacePhoto
              seed={`${offer.productor}-espacio-${openPhotoIndex}`}
              width={280}
              height={210}
              radius={8}
              alt={`Espacio de trabajo de ${offer.productor}: ${espacioFotos[openPhotoIndex]}`}
            />
          </div>
          <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.bg, fontSize: 13, textAlign: "center", padding: "0 22px 26px", margin: 0 }}>
            {espacioFotos[openPhotoIndex]}
          </p>
        </div>
      )}
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
  // Última fase de ContextStep mostrada antes de llegar al resumen — la usa
  // goBackToLastContextPhase (volver desde SummaryScreen o "Editar pedido")
  // para reabrir ContextStep justo donde se lo dejó, en vez de reiniciar
  // todo el flujo desde el compositor de texto libre (eso es lo que hacía
  // goBackToStart, pensado para "abandonar el paso actual", no para esto).
  const [contextLastPhase, setContextLastPhase] = useState(null);
  const [editingLiveRequestId, setEditingLiveRequestId] = useState(null);
  const [activeTab, setActiveTab] = useState("inicio");
  const [startedCreating, setStartedCreating] = useState(false);
  const [conversationOpenedFromMensajes, setConversationOpenedFromMensajes] = useState(false);
  // Bloque 4: mismo patrón que conversationOpenedFromMensajes, pero para una
  // oferta directa (sin interés/conversación previa) abierta desde Mensajes
  // — al volver de OfferDetail hay que ir a la lista de Mensajes, no al
  // detalle del pedido (ver handleOpenOfferFromMensajes más abajo).
  const [offerOpenedFromMensajes, setOfferOpenedFromMensajes] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [editingProfileName, setEditingProfileName] = useState(false);
  const timers = useRef([]);
  // Ids de pedidos con un timer de confirmación de horario ya en vuelo — ver
  // ensureSlotConfirmationScheduled más abajo.
  const scheduledSlotConfirmations = useRef(new Set());

  // Fuente de verdad de "el onboarding ya terminó": si el artista tiene al
  // menos un pedido persistido. No es un booleano duplicado que pueda
  // desincronizarse — se deriva de getAllRequests(), la misma colección que
  // ya usan useMyRequests (Home) y el chequeo de blockingRequest más abajo.
  // undefined mientras no se pudo determinar todavía (recién montado).
  const [hasPublishedRequest, setHasPublishedRequest] = useState(undefined);

  useEffect(() => {
    (async () => {
      const p = await storageGet(PROFILE_KEY, false);
      setProfile(p);
      if (p) {
        const all = await getAllRequests();
        setHasPublishedRequest(all.some((r) => r.artistName === p.name));
      }
    })();
    migrateLegacyClosedRequests();
    migrateLegacyTimeSlots();
    return () => timers.current.forEach(clearTimeout);
  }, []);

  async function handleGateDone(profileData, initialRequestText) {
    const ok = await storageSet(PROFILE_KEY, profileData, false);
    if (!ok) return false;
    const interpreted = await handleTextSubmit(initialRequestText);
    setProfile(profileData);
    // Recalculado para este perfil (no heredado del anterior): importa sobre
    // todo tras un cierre de sesión seguido de un registro nuevo, y sigue
    // siendo la misma fuente de verdad — pedidos realmente persistidos.
    const all = await getAllRequests();
    setHasPublishedRequest(all.some((r) => r.artistName === profileData.name));
    // El perfil ya quedó guardado incluso si esto da false: se lo devolvemos
    // a Gate para que muestre un error y deje reintentar, en vez de avanzar
    // en silencio con una interpretación que nunca se guardó.
    return interpreted;
  }

  async function handleTextSubmit(t) {
    if (profile && !editingLiveRequestId) {
      const requests = await getAllRequests();
      const blockingRequest = requests.find((item) => item.artistName === profile.name && requestNeedsArtistInput(item));
      if (blockingRequest) {
        setError("Primero completá la aclaración del pedido que ya está en movimiento.");
        return false;
      }
    }
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
      // Nueva clasificación: cualquier "última fase" que se recordara de una
      // sesión anterior de ContextStep ya no corresponde a este pedido.
      setContextLastPhase(null);
      return true;
    } catch (e) {
      setError("No pudimos interpretar el pedido. Probá de nuevo.");
      return false;
    } finally {
      setInterpreting(false);
    }
  }

  function handleContextComplete(ctx, lastPhase) {
    setContext(ctx);
    setContextReviewRequired(false);
    setReviewingEdit(false);
    setContextLastPhase(lastPhase ?? null);
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
    setContextLastPhase(null);
    setStartedCreating(false);
    setActiveTab("inicio");
  }

  // Abandona la fase actual de ContextStep y vuelve al compositor de texto
  // libre (StartScreen), con el texto tal cual quedó — se llama sólo desde
  // la primera fase real de ContextStep (ver goToPreviousPhase ahí), nunca
  // como "un paso atrás" genérico dentro del resto del flujo.
  function goBackToStart() {
    setEditingFromType(classification?.tipo || null);
    setReviewingEdit(true);
    setClassification(null);
    setContextReviewRequired(true);
    setContextLastPhase(null);
  }

  // Vuelve del resumen (o de "Editar pedido" ahí mismo) a la última fase
  // editable de ContextStep, sin tocar classification/context ni disparar
  // una nueva interpretación: a diferencia de goBackToStart, el draft y la
  // interpretación quedan exactamente como estaban, y nada se publica.
  function goBackToLastContextPhase() {
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
    const contextTimeSlots = normalizeTimeSlots(context);
    const matchingContext = {
      modalidad: context.modalidad || classification.modalidad,
      ubicacion: context.ubicacion || classification.locationText,
      coordinates: context.coordinates || null,
      timeSlots: contextTimeSlots.length > 0 ? contextTimeSlots : normalizeTimeSlots(classification.timeSlot ? [classification.timeSlot] : []),
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
    setContextLastPhase(null);
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
      timeSlots: matchingContext.timeSlots,
      franja: matchingContext.timeSlots[0] || null,
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
    setHasPublishedRequest(true);
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
    setContextLastPhase(null);
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
      timeSlots: matchingContext.timeSlots,
      franja: matchingContext.timeSlots[0] || null,
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
        const path = pickProducerPathForSlot(i, productores.length);
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
      // Se vuelve a validar el estado real antes de escribir: entre
      // programar este timer y que corra, el booking podría haber avanzado
      // o el pedido podría ya no aceptar esta transición — applyConfirmSlot
      // exige exactamente propuesta_elegida (o su legacy) + booking pendiente
      // + horario solicitado + sin confirmar todavía.
      try {
        await updateRequestById(reqId, (r) => applyConfirmSlot(r));
      } finally {
        scheduledSlotConfirmations.current.delete(reqId);
      }
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
      // Revalidar desde el pedido recién leído evita abrir o reactivar chats
      // que ya quedaron en modo lectura por cancelación o por una reserva con
      // otro profesional.
      if (!puedeEscribirEnConversacion(r, offer.productor)) return null;
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

  // Bloque 4: mismo patrón que handleOpenConversationFromMensajes, para una
  // oferta directa (sin `interes` previo) listada en Mensajes. `request` se
  // necesita igual (elegir/mensajear la oferta escribe contra ese id), pero
  // volver del detalle debe ir a Mensajes, no al pedido — ver el onBack de
  // OfferDetail más abajo.
  function handleOpenOfferFromMensajes(requestObj, offerObj) {
    setClassification(null);
    setContext(null);
    setRequest(requestObj);
    setOfferOpenedFromMensajes(true);
    setSelectedOffer(offerObj);
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
    setContextLastPhase(null);
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
    setHasPublishedRequest(undefined);
    setActiveTab("inicio");
  }

  // Modo pestañas (barra inferior visible) vs. modo flujo (una pantalla
  // interna, con su propia flecha de volver, sin barra). Cambiar de pestaña
  // nunca toca classification/request/openInteres/etc., así que la pestaña
  // activa persiste sola mientras se navega dentro de un pedido o chat.
  const inFlowMode = startedCreating || !!request || !!openInteres || !!selectedOffer || showHelp || showPrivacy || editingProfileName;

  // Un artista con perfil pero sin ningún pedido publicado todavía retoma el
  // onboarding (Gate) en vez de entrar a la app con pestañas — pero sólo
  // cuando además no hay un pedido en construcción (startedCreating/request):
  // cubre una recarga a mitad de camino o una interpretación que falló justo
  // después de guardar el perfil, sin interrumpir a alguien que ya está dentro
  // del flujo de contexto/resumen avanzando hacia su primera publicación.
  // true sólo para las tres pantallas del flujo de creación/edición de un
  // pedido (StartScreen, ContextStep, SummaryScreen) — nunca para
  // WaitingScreen ni el resto de la app. Se fija explícitamente dentro de
  // cada una de esas tres ramas de `body`, en vez de recalcularse con una
  // condición aparte que podría desincronizarse de cuál pantalla se eligió.
  let creationFlowActive = false;
  // true cuando el body es WaitingScreen (que ahora es editorial en todos
  // sus estados, BookingFlow incluido) o OfferDetail.
  let waitingScreenActive = false;
  let offerDetailActive = false;
  let body = null;
  if (profile === undefined || (profile && hasPublishedRequest === undefined)) {
    body = null;
  } else if (profile === null || (hasPublishedRequest === false && !inFlowMode)) {
    body = <Gate onDone={handleGateDone} />;
  } else if (selectedOffer) {
    offerDetailActive = true;
    body = (
      <OfferDetail
        offer={selectedOffer}
        choosing={choosing}
        messaging={messaging}
        chooseError={chooseError}
        onBack={() => {
          setSelectedOffer(null);
          setChooseError(null);
          // Si esta oferta se abrió desde Mensajes (oferta directa, sin
          // conversación previa), volver debe ir a Mensajes — no quedar en
          // WaitingScreen, que es a donde cae por defecto (`request` sigue
          // seteado) cuando se abrió desde el pedido.
          if (offerOpenedFromMensajes) {
            setRequest(null);
            setOfferOpenedFromMensajes(false);
          }
        }}
        onMessage={() => handleMessageOffer(selectedOffer)}
        onChoose={() => handleChoose(selectedOffer)}
      />
    );
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
    waitingScreenActive = true;
    body = (
      <WaitingScreen
        request={request}
        onOpenInteres={setOpenInteres}
        onSelectOffer={(offer) => {
          // Abrir una oferta desde el pedido mismo (no desde Mensajes): si
          // offerOpenedFromMensajes había quedado en true por una apertura
          // anterior sin resetear (ver handleOpenOfferFromMensajes), hay que
          // limpiarlo acá para que el onBack de OfferDetail no mande por
          // error a Mensajes en vez de quedarse en este pedido.
          setOfferOpenedFromMensajes(false);
          setSelectedOffer(offer);
        }}
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
    creationFlowActive = true;
    body = (
      <SummaryScreen
        classification={classification}
        context={context}
        publishing={publishing}
        publishError={publishError}
        editing={!!editingLiveRequestId}
        onEdit={goBackToLastContextPhase}
        onPublish={editingLiveRequestId ? handleUpdateRequest : handlePublish}
      />
    );
  } else if (classification) {
    creationFlowActive = true;
    body = (
      <ContextStep
        classification={classification}
        initialContext={context}
        reviewExisting={reviewingEdit}
        resumeAtPhase={contextLastPhase}
        onComplete={handleContextComplete}
        onBack={goBackToStart}
      />
    );
  } else if (startedCreating) {
    // Se volvió al primer paso (texto libre) desde ContextStep, editando un
    // pedido existente o re-escribiendo uno nuevo antes de reclasificar.
    creationFlowActive = true;
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
    body = <MessagesScreen artistName={profile.name} onOpenConversation={handleOpenConversationFromMensajes} onOpenOffer={handleOpenOfferFromMensajes} onGoToOrders={() => setActiveTab("pedidos")} />;
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

  // Piloto visual "estudio editorial": Gate (sin perfil todavía) e Inicio
  // (sin ningún otro flujo abierto) usan el chrome claro nuevo; el resto de
  // las pestañas y pantallas conserva el chrome oscuro sin ningún cambio.
  const editorialChrome = profile === null
    || (hasPublishedRequest === false && !inFlowMode)
    || creationFlowActive
    || waitingScreenActive
    || offerDetailActive
    || (!!profile && (activeTab === "inicio" || activeTab === "pedidos") && !inFlowMode);
  const chrome = editorialChrome
    ? { bg: EDITORIAL.bg, border: EDITORIAL.border, accent: EDITORIAL.accent, fontMono: EDITORIAL.fontMono }
    : { bg: COLORS.bg, border: COLORS.border, accent: COLORS.accent, fontMono: "'IBM Plex Mono', monospace" };

  return (
    <div style={{ width: "100%", height: "100vh", minHeight: 560, display: "flex", alignItems: "center", justifyContent: "center", background: chrome.bg }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          margin: "0 auto",
          maxHeight: 840,
          minHeight: 560,
          height: "90vh",
          background: chrome.bg,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 18,
          border: `1px solid ${chrome.border}`,
        }}
      >
        {!editorialChrome && <Textura />}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
          * { box-sizing: border-box; }
          input::placeholder, textarea::placeholder { color: #8F8D8F88; }
          input:focus, textarea:focus, button:focus-visible { outline: 2px solid ${chrome.accent}; outline-offset: 1px; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-thumb { background: ${chrome.border}; border-radius: 4px; }
          .press { transition: opacity .1s ease; }
          .press:active { opacity: .7; }
          .offer-in { animation: offerIn .25s ease; }
          @keyframes offerIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          .q-fade { animation: qFade .16s ease; }
          @keyframes qFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          .blink-caret { animation: blink 1s step-end infinite; color: ${chrome.accent}; }
          @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
          .thinking-dot { display: inline-block; animation: thinkingPulse 1s ease-in-out infinite; }
          @keyframes thinkingPulse { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }
          @media (prefers-reduced-motion: reduce) {
            .press, .offer-in, .q-fade, .blink-caret, .thinking-dot { animation: none !important; transition: none !important; }
            .thinking-dot { opacity: .6 !important; }
          }
        `}</style>

        {profile !== undefined && (
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${chrome.border}` }}>
            <span style={{ fontFamily: chrome.fontMono, fontSize: 11, letterSpacing: 2, color: chrome.accent }}>COLAB</span>
          </div>
        )}

        {/* minHeight: 0 es necesario para que este contenedor realmente se
            recorte a su alto disponible y scrollee — sin esto, un flex item
            con overflow no se achica por debajo del alto de su contenido, y
            una pantalla larga (ej. la lista completa de zonas) termina
            centrada por fuera del viewport, tapando el "‹ Atrás" de arriba. */}
        <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, overflowY: "auto" }}>{body}</div>

        {profile && hasPublishedRequest && !inFlowMode && <BottomNav active={activeTab} onChange={setActiveTab} light={activeTab === "inicio" || activeTab === "pedidos"} />}
      </div>
    </div>
  );
}
