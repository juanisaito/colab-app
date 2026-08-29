"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   COLAB — prototipo navegable del flujo del artista
   Build 5 — suma edición de un pedido ya publicado (con reasignación
   simulada de productores), sobre la lógica auditada del Build 4:
   matching, recuperación, edición previa a publicar y chat.
   Ver context.md para el historial completo de decisiones.
   ============================================================ */

const COLORS = {
  bg: "#0B0B0C",
  surface: "#17171A",
  surfaceAlt: "#1F1F23",
  border: "#2A2A2E",
  text: "#F3F2EE",
  muted: "#8F8D91",
  accent: "#2E4BFF",
};

const PROFILE_KEY = "colab-preview-profile-v3";
const REQUESTS_KEY = "colab-preview-requests-v3";

// Punto 8: contador configurable de mensajes previos a la oferta.
const MAX_PRE_OFFER_MESSAGES_PER_PERSON = 4;

/* ---------------- precio: producerAmount vs artistFinalPrice (punto 4) ----------------
   La fórmula real de COLAB (comisión, procesamiento, impuestos) sigue abierta —
   esto NO es una decisión de negocio, es un valor simulado para que el
   prototipo tenga un número que mostrar. Reemplazar esta función el día que
   exista la fórmula real modelada con el equipo. */
const SIMULATED_PRICING_CONFIG = {
  status: "simulado — fórmula real de COLAB todavía no definida",
  commissionRateForPrototypeOnly: 0.10,
};
function calculateArtistFinalPrice(producerAmount) {
  const { commissionRateForPrototypeOnly } = SIMULATED_PRICING_CONFIG;
  return Math.round((producerAmount * (1 + commissionRateForPrototypeOnly)) / 100) * 100;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatMoney(n) {
  return "$" + (Number(n) || 0).toLocaleString("es-AR");
}

async function storageGet(key, shared) {
  try {
    if (window.storage?.get) {
      const res = await window.storage.get(key, shared);
      return res ? JSON.parse(res.value) : null;
    }
    const localValue = window.localStorage.getItem(key);
    return localValue ? JSON.parse(localValue) : null;
  } catch (e) {
    return null;
  }
}

async function storageSet(key, value, shared) {
  try {
    if (window.storage?.set) await window.storage.set(key, JSON.stringify(value), shared);
    else window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("storage error", e);
    return false;
  }
}

/* ---------------- interpretación asistida (adaptador reemplazable) ----------------
   Punto 11: validación de respuesta + fallback local + sin secretos en el
   frontend (la llamada no usa ni expone ninguna API key) + error visible
   y recuperable (ver usedFallback más abajo, mostrado en el resumen). */

const CLASSIFIER_SYSTEM_PROMPT = `Sos el módulo de interpretación de pedidos de COLAB, una app que conecta artistas independientes con productores musicales. Vas a recibir el texto libre de un artista. Tu trabajo es inferir lo más posible y señalar solo lo que realmente falte — nunca convertir esto en un formulario, y nunca inventar un dato que el texto no sostiene.

El texto puede venir escrito rápido, con faltas, fonética o lunfardo (por ejemplo "haser", "cansion", "gravar"). Interpretá la intención por contexto y no corrijas ni juzgues cómo escribe el artista.

Respondé ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, sin backticks.

Campos exactos:
- "tipo": "grabar" (grabar una canción o voces — la modalidad es presencial porque requiere micrófono y espacio; no preguntes modalidad), "hacer" (hacer o crear una canción desde cero — la modalidad puede ser ambigua), "mezclar" (mezcla o masterización — nunca presencial, nunca hace falta ubicación ni horario), "especial" (pedido puntual: sonidista, tuner, grabación móvil, camp, u otro que no encaje arriba).
- "title": título breve y natural, ej "Grabar una canción", "Mezclar un tema". No es una categoría técnica, es una frase corta que el artista pueda leer.
- "summary": resumen en primera persona o formulación neutral, conservando el espíritu de las palabras del artista. Nunca uses la forma "[Nombre/Sujeto implícito] + quiere + verbo" en tercera persona. Ejemplo correcto: "Quiero grabar un tema con una referencia cercana a Duki".
- "modalidad": "presencial" o "online", o null si de verdad no se puede inferir (esto solo debería pasar en tipo "hacer").
- "modalidad_fuente": "explicita", "inferida" o "desconocida".
- "dateText": el texto EXACTO que usó el artista para el día, si lo dijo (ej: "sábado"). Si no dijo nada, null. Nunca lo inventes ni lo normalices a una fecha de calendario.
- "dateConfidence": "alta", "media" o "baja" — null si dateText es null.
- "timeText": el texto EXACTO para el horario, si lo dijo (ej: "a las 21"). Si no dijo nada, null.
- "timeConfidence": "alta", "media" o "baja" — null si timeText es null.
- "locationText": zona o barrio EXACTO si lo mencionó, si no null.
- "locationConfidence": "alta", "media" o "baja" — null si locationText es null.
- "timeSlot": "mañana", "tarde" o "noche" SOLO si se puede inferir con una base real (de timeText o de que lo haya dicho directamente). Si no hay base real, null — no adivines.
- "timeSlotConfidence": "alta", "media" o "baja" — null si timeSlot es null.
- "referencia": artistas o estilos que mencionó, o null.
- "datos_faltantes": array con lo que realmente falta y es imprescindible para publicar. Para tipo "especial" sin dateText ni timeText, incluí "fecha_hora". Para "hacer" sin poder inferir modalidad, incluí "modalidad". Dejalo vacío si no falta nada crítico.
- "confianza": "alta", "media" o "baja" — qué tan segura es la interpretación en general.

Ejemplo para "necesito un tuner el sábado a las 21 en Palermo":
{"tipo":"especial","title":"Tuner para show en vivo","summary":"Necesito un tuner para tocar en vivo el sábado a las 21 en Palermo.","modalidad":"presencial","modalidad_fuente":"inferida","dateText":"sábado","dateConfidence":"alta","timeText":"a las 21","timeConfidence":"alta","locationText":"Palermo","locationConfidence":"alta","timeSlot":"noche","timeSlotConfidence":"alta","referencia":null,"datos_faltantes":[],"confianza":"alta"}

Ejemplo para "quiero grabar un tema estilo Duki":
{"tipo":"grabar","title":"Grabar una canción","summary":"Quiero grabar un tema con una referencia cercana a Duki.","modalidad":"presencial","modalidad_fuente":"inferida","dateText":null,"dateConfidence":null,"timeText":null,"timeConfidence":null,"locationText":null,"locationConfidence":null,"timeSlot":null,"timeSlotConfidence":null,"referencia":"Duki","datos_faltantes":[],"confianza":"alta"}`;

const VALID_TIPOS = ["grabar", "hacer", "mezclar", "especial"];
const OPTIONAL_STRING_FIELDS = ["dateText", "timeText", "locationText", "timeSlot", "referencia"];
const OPTIONAL_CONFIDENCE_FIELDS = ["dateConfidence", "timeConfidence", "locationConfidence", "timeSlotConfidence"];

function validateClassification(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (!VALID_TIPOS.includes(obj.tipo)) return false;
  if (typeof obj.title !== "string" || !obj.title.trim()) return false;
  if (typeof obj.summary !== "string" || !obj.summary.trim()) return false;
  return true;
}

// Completa campos opcionales ausentes con null, para que el resto del código
// nunca tenga que lidiar con "undefined" si el modelo omitió alguno.
function normalizeClassification(obj) {
  const out = { ...obj };
  OPTIONAL_STRING_FIELDS.forEach((f) => { if (out[f] === undefined) out[f] = null; });
  OPTIONAL_CONFIDENCE_FIELDS.forEach((f) => { if (out[f] === undefined) out[f] = null; });
  if (!Array.isArray(out.datos_faltantes)) out.datos_faltantes = [];
  if (!out.modalidad_fuente) out.modalidad_fuente = "desconocida";
  if (!out.confianza) out.confianza = "media";
  return out;
}

// Fallback local determinístico: se usa solo si la llamada a la API falla o
// devuelve algo inválido. Conserva datos explícitos básicos y, ante un pedido
// ambiguo, pide reformular en lugar de inventar una intención.
function interpretFallback(text) {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let tipo = null;
  if (t.includes("mezcl") || t.includes("mescl") || t.includes("masteriz")) tipo = "mezclar";
  else if (t.includes("grab") || t.includes("grav")) tipo = "grabar";
  else if (t.includes("tuner") || t.includes("sonidist") || t.includes("operador") || t.includes("vivo") || t.includes("show") || t.includes("camp")) tipo = "especial";
  else if (t.includes("hac") || t.includes("has") || t.includes("aser") || t.includes("crea") || t.includes("produc") || t.includes("termin") || t.includes("compon")) tipo = "hacer";
  if (!tipo) throw new Error("El respaldo local no puede clasificar este pedido sin inventar una intención");

  const explicitOnline = /\b(online|remoto|remota|a distancia)\b/i.test(text);
  const explicitPresencial = /\b(presencial|en persona|estudio)\b/i.test(text);
  let modalidad = null;
  let modalidad_fuente = "desconocida";
  if (tipo === "grabar") {
    modalidad = "presencial";
    modalidad_fuente = "inferida";
  } else if (explicitOnline) {
    modalidad = "online";
    modalidad_fuente = "explicita";
  } else if (explicitPresencial) {
    modalidad = "presencial";
    modalidad_fuente = "explicita";
  } else if (tipo === "especial") {
    modalidad = "presencial";
    modalidad_fuente = "inferida";
  } else if (tipo === "mezclar") {
    modalidad = "online";
    modalidad_fuente = "inferida";
  }

  const dateMatch = text.match(/\b(hoy|mañana|pasado mañana|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|este fin de semana|el fin de semana)\b/i);
  // Un número suelto (ej. "15 personas", "11-2233-4455") no alcanza para asumir un
  // horario: exigimos "a las", minutos con ":" o el sufijo horario, para no inventar
  // una hora que el artista no dijo.
  const timeMatch =
    text.match(/\ba las\s*([01]?\d|2[0-3])(?::([0-5]\d))?\s*(?:h|hs|horas)?\b/i) ||
    text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(?:h|hs|horas)?\b/i) ||
    text.match(/\b([01]?\d|2[0-3])\s*(?:h|hs|horas)\b/i);
  // "mañana" sola se interpreta como día, no como franja. Para la franja de
  // mañana exigimos una formulación explícita como "por la mañana".
  const slotMatch = text.match(/\b(a la mañana|por la mañana|de mañana|a la tarde|por la tarde|tarde|a la noche|por la noche|noche)\b/i);
  const barrios = ["Palermo", "Almagro", "Villa Crespo", "Colegiales", "Belgrano", "Núñez", "Nuñez", "Chacarita", "Caballito", "Flores", "San Telmo", "Recoleta", "Balvanera", "Boedo", "Saavedra", "Paternal"];
  const locationText = barrios.find((barrio) => t.includes(barrio.toLowerCase())) || null;
  let timeSlot = null;
  if (slotMatch) {
    const slot = slotMatch[0].toLowerCase();
    timeSlot = slot.includes("mañana") ? "mañana" : slot.includes("tarde") ? "tarde" : "noche";
  } else if (timeMatch) {
    const hour = Number(timeMatch[1]);
    timeSlot = hour < 13 ? "mañana" : hour < 19 ? "tarde" : "noche";
  }

  const titleByTipo = { grabar: "Grabar una canción", hacer: "Hacer una canción", mezclar: "Mezclar un tema", especial: "Pedido especial" };
  const referencedArtists = Object.keys(ARTIST_GENRE_HINTS).filter((artist) => t.includes(artist));
  const datos_faltantes = [];
  if (tipo === "hacer" && !modalidad) datos_faltantes.push("modalidad");
  if (tipo === "especial" && !dateMatch && !timeMatch) datos_faltantes.push("fecha_hora");
  return normalizeClassification({
    tipo,
    title: titleByTipo[tipo],
    summary: text.length > 110 ? text.slice(0, 110) + "…" : text,
    modalidad,
    modalidad_fuente,
    dateText: dateMatch ? dateMatch[0] : null,
    dateConfidence: dateMatch ? "alta" : null,
    timeText: timeMatch ? timeMatch[0] : slotMatch ? slotMatch[0] : null,
    timeConfidence: timeMatch || slotMatch ? "alta" : null,
    locationText,
    locationConfidence: locationText ? "alta" : null,
    timeSlot,
    timeSlotConfidence: timeSlot ? "alta" : null,
    referencia: referencedArtists.length ? referencedArtists.join(", ") : null,
    datos_faltantes,
    confianza: "baja",
  });
}

async function interpretRequestViaClaudeAPI(text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      // Sin API key en el frontend: el runtime de artifacts la maneja del otro lado.
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: CLASSIFIER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: text }],
      }),
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`API de interpretación: ${response.status}`);
  const data = await response.json();
  const raw = (data.content || [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("")
    .trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Respuesta sin JSON");
  const parsed = JSON.parse(match[0]);
  if (!validateClassification(parsed)) throw new Error("Clasificación inválida");
  return normalizeClassification(parsed);
}

// Adaptador reemplazable: interpretRequest es el único punto de entrada que
// usa el resto de la app. Devuelve además si tuvo que usar el respaldo local,
// para poder avisarlo (error visible y recuperable, no oculto).
async function interpretRequest(text) {
  // El visualizador local no tiene el proxy autenticado de Claude Artifacts.
  // Usamos el respaldo inmediatamente para que la interacción sea instantánea.
  if (typeof window !== "undefined" && !window.storage) {
    return { ...interpretFallback(text), originalText: text, usedFallback: true };
  }
  try {
    const result = await interpretRequestViaClaudeAPI(text);
    return { ...result, originalText: text, usedFallback: false };
  } catch (e) {
    console.warn("Interpretación por API falló, uso respaldo determinístico:", e);
    return { ...interpretFallback(text), originalText: text, usedFallback: true };
  }
}

/* ---------------- datos simulados de productores ---------------- */

const OFFER_POOL = {
  grabar: [
    {
      productor: "Tomás Ibarra",
      zona: "Villa Crespo",
      coordinates: { lat: -34.5965, lng: -58.435 },
      modalidadTipo: "Presencial",
      disponibilidad: "Miércoles y jueves por la tarde",
      franjas: ["Tarde"],
      spotifyConnected: true,
      topArtists: ["Duki", "Bizarrap", "C.R.O"],
      generos: ["urbano", "trap", "reggaeton"],
      portfolioBlurb: "Grabación de voces para 3 EPs independientes en el último año.",
      porQueEncaja: "Trabaja seguido con voces urbanas y tiene estudio propio en tu zona.",
      pregunta: "Hola! Vi tu pedido — ¿ya tenés una base grabada o arrancamos de cero con la voz?",
      trabajo: "Grabación de voces — EP independiente, 2025",
      unidad: "Sesión inicial",
      incluye: "3 horas de grabación + edición básica de voces",
      producerAmount: 45000,
      propuesta: "Puedo grabarte esta semana en mi estudio de Villa Crespo. Buen tratamiento acústico para voces y experiencia en urbano/trap.",
      confianza: ["Identidad verificada", "Portfolio verificado"],
    },
    {
      productor: "Flor Medina",
      zona: "Almagro",
      coordinates: { lat: -34.609, lng: -58.421 },
      modalidadTipo: "Presencial",
      disponibilidad: "Hoy después de las 18h",
      franjas: ["Noche"],
      spotifyConnected: true,
      topArtists: ["Nicki Nicole", "Emilia", "Wos"],
      generos: ["urbano", "pop"],
      portfolioBlurb: "Especializada en placement de voces para pop urbano.",
      porQueEncaja: "Su estudio está tratado acústicamente y tiene turnos hoy mismo.",
      pregunta: "Hola! ¿Tenés referencia de algún tema o artista para orientar el tratamiento de la voz?",
      trabajo: "Grabación y producción — single 'Marea'",
      unidad: "Sesión inicial",
      incluye: "3 horas de grabación + placement de voces",
      producerAmount: 52000,
      propuesta: "Tengo un espacio tratado acústicamente en Almagro, especializada en voces urbanas y pop. Puedo recibirte esta semana.",
      confianza: ["Identidad verificada", "Instagram conectado"],
    },
    {
      productor: "Lucas Peralta",
      zona: "Colegiales",
      coordinates: { lat: -34.5745, lng: -58.449 },
      modalidadTipo: "Presencial",
      disponibilidad: "Lunes y martes",
      franjas: ["Mañana", "Tarde"],
      spotifyConnected: true,
      topArtists: ["Él Mató a un Policía Motorizado", "Eruca Sativa", "Airbag"],
      generos: ["rock", "alternativo", "indie"],
      portfolioBlurb: "Grabó banda completa para un LP de rock independiente en 2024.",
      porQueEncaja: "Tiene experiencia grabando bandas en vivo, no solo voces sueltas.",
      pregunta: "¿Vas a venir solo o con más gente de la banda para la sesión?",
      trabajo: "Grabación de banda — LP 'Marte', 2024",
      unidad: "Sesión inicial",
      incluye: "3 horas de grabación + mezcla de referencia",
      producerAmount: 48000,
      propuesta: "Estudio chico en Colegiales, especializado en bandas y voces rockeras. Grabo en vivo y por capas, como prefieras.",
      confianza: ["Identidad verificada", "Portfolio verificado"],
    },
  ],
  hacer: [
    {
      productor: "Nico Ferreyra",
      zona: "Núñez",
      coordinates: { lat: -34.545, lng: -58.465 },
      modalidadTipo: "Presencial",
      disponibilidad: "Este fin de semana",
      franjas: ["Mañana", "Tarde", "Noche"],
      spotifyConnected: true,
      topArtists: ["Wos", "Él Mató a un Policía Motorizado", "Trueno"],
      generos: ["trap", "rock", "alternativo"],
      portfolioBlurb: "Produjo un EP de fusión trap/rock en 2024.",
      porQueEncaja: "Le gusta trabajar cruzando géneros distintos, como plantea tu pedido.",
      pregunta: "Me copa la idea — ¿tenés alguna letra o idea de melodía arrancada, o salimos de cero?",
      trabajo: "Producción — EP fusión trap/rock, 2024",
      unidad: "Sesión inicial",
      incluye: "3 horas de composición y producción exploratoria",
      producerAmount: 60000,
      propuesta: "Me gusta la idea de mezclar géneros. Podemos arrancar con una sesión para probar dirección antes de comprometernos a una producción completa.",
      confianza: ["Identidad verificada", "Portfolio verificado"],
    },
    {
      productor: "Bruno Sasso",
      zona: "Belgrano",
      coordinates: { lat: -34.562, lng: -58.456 },
      modalidadTipo: "Presencial",
      disponibilidad: "Martes y jueves",
      franjas: ["Mañana", "Tarde", "Noche"],
      spotifyConnected: true,
      topArtists: ["Emilia", "Tini", "Nicki Nicole"],
      generos: ["pop", "urbano"],
      portfolioBlurb: "Produjo un single de pop urbano lanzado en 2025.",
      porQueEncaja: "Arma la base instrumental completa, no solo mezcla lo que ya existe.",
      pregunta: "¿Tenés en mente algún tempo o clima particular, o lo definimos juntos en la sesión?",
      trabajo: "Producción — single 'Ya no vuelvo', 2025",
      unidad: "Sesión inicial",
      incluye: "3 horas de producción + base instrumental",
      producerAmount: 65000,
      propuesta: "Produzco pop urbano de punta a punta, desde la base hasta la voz final. Contame la idea y armamos juntos el tema.",
      confianza: ["Identidad verificada", "Portfolio verificado"],
    },
  ],
  mezclar: [
    {
      productor: "Caro Suárez",
      zona: null,
      modalidadTipo: "Online",
      disponibilidad: "Entrega en 4 días",
      franjas: ["Mañana", "Tarde", "Noche"],
      spotifyConnected: true,
      topArtists: ["Bandalos Chinos", "Usted Señálemelo", "Conociendo Rusia"],
      generos: ["alternativo", "indie", "rock"],
      portfolioBlurb: "Mezcló 'Horizonte', un lanzamiento independiente reciente.",
      porQueEncaja: "Trabaja bien la mezcla de bandas alternativas/indie.",
      pregunta: "¿Tenés los stems por separado o me pasás el proyecto completo?",
      trabajo: "Mezcla — 'Horizonte', lanzamiento independiente",
      unidad: "Mezcla completa",
      incluye: "Mezcla + 2 rondas de correcciones",
      producerAmount: 38000,
      propuesta: "Escuché tu referencia. Puedo tener una primera versión de mezcla en 4 días y ajustar con tus devoluciones.",
      confianza: ["Identidad verificada"],
    },
    {
      productor: "Fede Lang",
      zona: null,
      modalidadTipo: "Online",
      disponibilidad: "Entrega en 3 días",
      franjas: ["Mañana", "Tarde", "Noche"],
      spotifyConnected: true,
      topArtists: ["Duki", "Bizarrap", "Milo j"],
      generos: ["urbano", "trap", "reggaeton"],
      portfolioBlurb: "Mezcla mixtapes urbanas hace 4 años.",
      porQueEncaja: "Entiende el peso que necesita el bajo en trap/urbano.",
      pregunta: "¿Tenés alguna mezcla de referencia que te guste para el volumen de la voz?",
      trabajo: "Mezcla — mixtape independiente, 2025",
      unidad: "Mezcla completa",
      incluye: "Mezcla + 1 ronda de correcciones",
      producerAmount: 42000,
      propuesta: "Mezclo urbano y trap hace 4 años, entiendo bien el peso que tiene que tener el bajo en ese estilo.",
      confianza: ["Identidad verificada"],
    },
  ],
  especial: [
    {
      productor: "Diego Roldán",
      zona: "A coordinar",
      modalidadTipo: "Presencial",
      disponibilidad: "A confirmar según fecha",
      franjas: ["Mañana", "Tarde", "Noche"],
      spotifyConnected: false,
      topArtists: ["Turf", "Airbag", "La Vela Puerca"],
      generos: ["rock", "pop", "urbano", "alternativo"],
      portfolioBlurb: "Sonido en vivo para shows chicos y medianos hace 6 años.",
      porQueEncaja: "Cubre eventos de cualquier estilo, no solo un género particular.",
      pregunta: "Contame un poco del evento — ¿cuánta gente esperan y qué tipo de lugar es?",
      trabajo: "Operación de sonido — ciclo de bares, 2025",
      unidad: "Servicio puntual",
      incluye: "Armado, operación y desarme de equipo",
      producerAmount: 40000,
      propuesta: "Hago sonido en vivo hace 6 años, cubro shows chicos y medianos de cualquier estilo. Contame más del evento y coordinamos.",
      confianza: ["Identidad verificada", "Referencias verificadas"],
    },
  ],
};

const GENRE_KEYWORDS = {
  urbano: ["urbano", "urbana"],
  trap: ["trap"],
  reggaeton: ["reggaeton", "reggaetón"],
  pop: ["pop"],
  rock: ["rock", "punk"],
  alternativo: ["alternative", "alternativo", "indie", "post punk", "postpunk"],
  electronica: ["electronica", "electrónica", "house", "techno"],
};

const GENRE_LABELS = {
  urbano: "urbano",
  trap: "trap",
  reggaeton: "reggaetón",
  pop: "pop",
  rock: "rock",
  alternativo: "indie / alternativo",
  electronica: "electrónica",
};

const ARTIST_GENRE_HINTS = {
  duki: ["urbano", "trap"],
  bizarrap: ["urbano", "trap"],
  "nicki nicole": ["urbano", "pop"],
  emilia: ["pop", "urbano"],
  wos: ["alternativo", "trap"],
  trueno: ["urbano", "trap"],
  "el mató": ["rock", "alternativo"],
  airbag: ["rock"],
  turf: ["rock"],
};

function detectGeneros(text) {
  const t = (text || "").toLowerCase();
  const found = new Set();
  Object.entries(GENRE_KEYWORDS).forEach(([tag, kws]) => {
    if (kws.some((k) => t.includes(k))) found.add(tag);
  });
  Object.entries(ARTIST_GENRE_HINTS).forEach(([artist, tags]) => {
    if (t.includes(artist)) tags.forEach((tag) => found.add(tag));
  });
  return Array.from(found);
}

function distanceInKm(a, b) {
  const toRad = (degrees) => degrees * Math.PI / 180;
  const earthRadius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function producerMatchesContext(productor, context = {}) {
  const requestedModality = context.modalidad;
  if (requestedModality && requestedModality !== "me_da_igual") {
    if ((productor.modalidadTipo || "").toLowerCase() !== requestedModality.toLowerCase()) return false;
  }

  const requestedSlot = (context.franja || "").toLowerCase();
  if (requestedSlot && !["me da igual", "me adapto"].includes(requestedSlot)) {
    const availableSlots = (productor.franjas || []).map((slot) => slot.toLowerCase());
    if (!availableSlots.includes(requestedSlot)) return false;
  }

  const requestedLocation = (context.ubicacion || "").trim().toLowerCase();
  if (requestedLocation === "cerca mío" && context.coordinates && productor.modalidadTipo !== "Online") {
    if (!productor.coordinates || distanceInKm(context.coordinates, productor.coordinates) > 8) return false;
  } else if (requestedLocation && requestedLocation !== "toda caba" && requestedLocation !== "cerca mío" && productor.modalidadTipo !== "Online") {
    const producerLocation = (productor.zona || "").toLowerCase();
    if (!producerLocation.includes(requestedLocation) && !requestedLocation.includes(producerLocation)) return false;
  }
  return true;
}

// Un dato explícito incompatible nunca se resuelve mostrando el pool completo.
// El array vacío es una salida válida y activa el flujo de recuperación.
function pickProducers(tipo, generos, context = {}) {
  const pool = OFFER_POOL[tipo] || OFFER_POOL.especial;
  const compatibleByContext = pool.filter((producer) => producerMatchesContext(producer, context));
  const matched = !generos || generos.length === 0
    ? compatibleByContext
    : compatibleByContext.filter((producer) => producer.generos.some((genre) => generos.includes(genre)));
  return { productores: matched.slice(0, 4), ampliado: false };
}

function getCuratedAlternatives(requestData) {
  const pool = OFFER_POOL[requestData.tipo] || OFFER_POOL.especial;
  return pool.filter((producer) => producerMatchesContext(producer, requestData)).slice(0, 2);
}

// Punto 1: cada productor simulado elige un camino, no siempre pregunta primero.
const PRODUCER_PATHS = [
  { path: "pregunta", weight: 0.4 },
  { path: "oferta_directa", weight: 0.35 },
  { path: "ahora_no", weight: 0.25 },
];
function pickProducerPath() {
  const r = Math.random();
  let acc = 0;
  for (const { path, weight } of PRODUCER_PATHS) {
    acc += weight;
    if (r <= acc) return path;
  }
  return "pregunta";
}

function buildOfferFrom(producerData) {
  const { productor, zona, modalidadTipo, disponibilidad, spotifyConnected, topArtists, trabajo, unidad, incluye, producerAmount, propuesta, confianza } = producerData;
  return { id: uid(), productor, zona, modalidadTipo, disponibilidad, spotifyConnected, topArtists, trabajo, unidad, incluye, producerAmount, propuesta, confianza, createdAt: new Date().toISOString() };
}

function findProducerByName(name) {
  return Object.values(OFFER_POOL).flat().find((producer) => producer.productor === name) || null;
}

/* ---------------- piezas visuales ---------------- */

function PrimaryButton({ children, onClick, disabled, full }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press"
      style={{
        background: disabled ? COLORS.surfaceAlt : COLORS.accent,
        color: disabled ? COLORS.muted : "#fff",
        border: "none",
        borderRadius: 10,
        padding: "13px 18px",
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontWeight: 700,
        fontSize: 14.5,
        width: full ? "100%" : "auto",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled, full }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press"
      style={{
        background: "transparent",
        color: disabled ? COLORS.muted : COLORS.text,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: "12px 18px",
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontWeight: 700,
        fontSize: 14.5,
        width: full ? "100%" : "auto",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function TextLink({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press"
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: disabled ? "default" : "pointer",
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 13.5,
        color: disabled ? COLORS.border : COLORS.muted,
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}
    >
      {children}
    </button>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 0.6, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function lowerFirstLabel(label) {
  if (typeof label !== "string" || !label) return label;
  return label.toLocaleLowerCase("es-AR");
}

function BigOption({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className="press"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        borderBottom: `1px solid ${COLORS.border}`,
        padding: "14px 2px",
        cursor: "pointer",
      }}
    >
      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: selected ? 700 : 500, fontSize: 16.5, color: selected ? COLORS.text : COLORS.muted }}>
        {lowerFirstLabel(label)}
      </span>
      {selected && <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.accent, flexShrink: 0 }} />}
    </button>
  );
}

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

const underlineInputStyle = {
  width: "100%",
  background: "transparent",
  border: "none",
  padding: "8px 0",
  color: COLORS.text,
  fontFamily: "'IBM Plex Sans', sans-serif",
  fontSize: 17,
  outline: "none",
  boxSizing: "border-box",
};

function UnderlineField({ value, onChange, placeholder, autoFocus, onKeyDown, multiline, disabled, small, type = "text" }) {
  const [focused, setFocused] = useState(false);
  const Tag = multiline ? "textarea" : "input";
  return (
    <div>
      <Tag
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        rows={multiline ? 3 : undefined}
        type={multiline ? undefined : type}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ ...underlineInputStyle, fontSize: small ? 14.5 : 17, resize: multiline ? "none" : undefined, lineHeight: multiline ? 1.5 : undefined }}
      />
      <div style={{ height: 1, background: focused ? COLORS.accent : COLORS.border, transition: "background .15s ease" }} />
    </div>
  );
}

function Screen({ topSlot, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 22px 0", minHeight: 20 }}>{topSlot || null}</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 22px 26px" }}>{children}</div>
    </div>
  );
}

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

function ProducerPhoto({ name, width = 44, height = 44, radius = 10 }) {
  const hue = hashHue(name);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        flexShrink: 0,
        background: `radial-gradient(circle at 30% 25%, hsl(${hue},65%,42%), hsl(${(hue + 35) % 360},50%,16%) 78%)`,
      }}
    />
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

function AnimatedExamples({ examples }) {
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

function StartScreen({ onSubmit, interpreting, error, initialText, onCancelLiveEdit }) {
  const [text, setText] = useState(initialText || "");
  const [focused, setFocused] = useState(false);
  // Punto 6: solo los 4 casos principales entre los ejemplos. Tuner/sonidista/
  // camps funcionan si se escriben, pero no aparecen acá.
  const examples = ["Quiero grabar una canción", "Quiero hacer una canción", "Quiero terminar un tema", "Quiero mezclar mi canción"];

  const showAnimated = text.length === 0 && !focused;
  const showStaticHint = text.length === 0 && focused;

  return (
    <Screen topSlot={onCancelLiveEdit ? <TextLink onClick={onCancelLiveEdit}>‹ Volver a mi pedido</TextLink> : null}>
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

function ConversationScreen({ request, interes, onBack, onOfferGenerated, formalOfferExists = false }) {
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
  const atLimit = misMensajes >= MAX_PRE_OFFER_MESSAGES_PER_PERSON;
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
    const all = (await storageGet(REQUESTS_KEY, true)) || [];
    let nextMessages = null;
    const updated = all.map((r) => {
      if (r.id !== request.id) return r;
      if (r.estado === "cerrado" || r.estado === "cancelado") return r;
      const intereses = r.intereses.map((it) => {
        if (it.id !== interes.id) return it;
        const currentMessages = it.mensajes?.length
          ? it.mensajes
          : [{ from: "productor", text: it.pregunta, createdAt: it.createdAt || new Date().toISOString() }];
        const senderCount = currentMessages.filter((m) => m.from === message.from).length;
        if (senderCount >= MAX_PRE_OFFER_MESSAGES_PER_PERSON) {
          nextMessages = currentMessages;
          return it;
        }
        nextMessages = [...currentMessages, message];
        return { ...it, mensajes: nextMessages };
      });
      return { ...r, intereses };
    });
    if (!nextMessages) return null;
    const ok = await storageSet(REQUESTS_KEY, updated, true);
    return ok ? nextMessages : null;
  }

  async function send() {
    const t = input.trim();
    if (!t || sending || atLimit) return;
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
    if (producerCountNow >= MAX_PRE_OFFER_MESSAGES_PER_PERSON) {
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
    const all = (await storageGet(REQUESTS_KEY, true)) || [];
    let changed = false;
    const updated = all.map((r) => {
      if (r.id !== request.id) return r;
      if (r.estado === "cerrado" || r.estado === "cancelado") return r;
      const intereses = r.intereses.map((it) => (it.id === interes.id ? { ...it, resuelto: true } : it));
      const alreadyOffered = r.ofertas.some((item) => item.productor === interes.productor);
      changed = true;
      return { ...r, intereses, ofertas: alreadyOffered ? r.ofertas : [...r.ofertas, oferta], estado: "con_ofertas" };
    });
    const ok = changed && await storageSet(REQUESTS_KEY, updated, true);
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
            Vos {misMensajes}/{MAX_PRE_OFFER_MESSAGES_PER_PERSON} · {interes.productor} {mensajesProductor}/{MAX_PRE_OFFER_MESSAGES_PER_PERSON}
          </div>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 22px 8px" }}>
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
        {atLimit && (
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>
            {offerAvailable
              ? `Llegaste al límite de ${MAX_PRE_OFFER_MESSAGES_PER_PERSON} mensajes. Ya podés volver a la propuesta y decidir.`
              : `Llegaste al límite de ${MAX_PRE_OFFER_MESSAGES_PER_PERSON} mensajes. Si ${interes.productor} avanza, su propuesta aparece en el pedido.`}
          </p>
        )}
        {conversationError && (
          <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, marginBottom: 8 }}>{conversationError}</p>
        )}
        <div style={{ marginBottom: 10 }}>
          <UnderlineField
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={atLimit ? "Sin mensajes disponibles" : "Escribí acá… (texto o archivo simulado)"}
            disabled={sending || atLimit}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!atLimit && (
            <PrimaryButton full disabled={sending || !input.trim()} onClick={send}>
              Enviar
            </PrimaryButton>
          )}
          <PrimaryButton full disabled={requestingOffer || sending} onClick={onBack}>
            {requestingOffer ? "Preparando propuesta…" : offerAvailable ? "Volver a la propuesta" : "Volver al pedido"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------- pantalla: espera + feed + recuperación (punto 5) ---------------- */

function WaitingScreen({ request, onOpenInteres, onSelectOffer, onCancel, onEdit, onAclaracion, onSolicitarCurado }) {
  const [intereses, setIntereses] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [curados, setCurados] = useState([]);
  const [ampliado, setAmpliado] = useState(false);
  const [recovery, setRecovery] = useState(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [aclaracionTexto, setAclaracionTexto] = useState("");
  const [enviandoAclaracion, setEnviandoAclaracion] = useState(false);
  const [solicitando, setSolicitando] = useState(null);
  const [actionError, setActionError] = useState(null);

  const poll = useCallback(async () => {
    const all = (await storageGet(REQUESTS_KEY, true)) || [];
    const mine = all.find((r) => r.id === request.id);
    if (mine) {
      setIntereses(mine.intereses || []);
      setOfertas(mine.ofertas || []);
      setCurados(mine.curados || []);
      setAmpliado(!!mine.matchAmpliado);
      setRecovery(mine.recovery || null);
    }
  }, [request.id]);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 1500);
    return () => clearInterval(iv);
  }, [poll]);

  const feedVacio = intereses.length === 0 && ofertas.length === 0;

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
        {confirmingCancel ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: COLORS.muted }}>¿Cancelar este pedido?</span>
            <TextLink disabled={cancelling} onClick={confirmarCancelacion}>{cancelling ? "Cancelando…" : "Sí, cancelar"}</TextLink>
            <TextLink disabled={cancelling} onClick={() => setConfirmingCancel(false)}>No</TextLink>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <TextLink onClick={onEdit}>Editar pedido</TextLink>
            <TextLink onClick={() => setConfirmingCancel(true)}>Cancelar pedido</TextLink>
          </div>
        )}
      </div>

      {feedVacio && recovery === "aclaracion" ? (
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
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 22px 26px" }}>
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 26px 26px" }}>
          <h2 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 21, color: COLORS.text, margin: "0 0 10px", lineHeight: 1.3 }}>
            Tu proyecto ya está en movimiento
          </h2>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
            {ampliado
              ? "Estamos ampliando la búsqueda a más estilos para encontrarte opciones. Podés cerrar la app; te avisamos acá."
              : "Estamos seleccionando productores que puedan encajar con lo que querés hacer. Podés cerrar la app; te avisamos cuando alguien quiera conocer mejor tu proyecto o enviarte una propuesta."}
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 22px 26px" }}>
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

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px 12px" }}>
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

function ChosenScreen({ offer }) {
  return (
    <div style={{ padding: "50px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", height: "100%" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <span style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>✓</span>
      </div>
      <h2 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 20, color: COLORS.text, margin: "0 0 10px" }}>
        Elegiste a {offer.productor}
      </h2>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 13.5, lineHeight: 1.5, maxWidth: 280 }}>
        Reserva, pago y coordinación de horario van en el próximo prototipo — esta pantalla es un placeholder de dónde continúa el flujo.
      </p>
    </div>
  );
}

function sanitizeContextForClassification(previousContext, previousType, nextClassification) {
  if (!previousContext) return null;
  const typeChanged = !!previousType && previousType !== nextClassification.tipo;
  const next = { ...previousContext };

  if (nextClassification.tipo === "mezclar") {
    return { ...next, modalidad: "online", ubicacion: null, coordinates: null, franja: null, datoFaltanteTexto: null, datoFaltanteConfirmado: false };
  }

  if (nextClassification.tipo === "grabar") {
    return {
      ...next,
      modalidad: "presencial",
      ubicacion: nextClassification.locationText || (typeChanged ? null : next.ubicacion),
      coordinates: nextClassification.locationText || typeChanged ? null : next.coordinates,
      franja: nextClassification.timeSlot || (typeChanged ? null : next.franja),
      datoFaltanteTexto: null,
      datoFaltanteConfirmado: false,
    };
  }

  if (nextClassification.tipo === "hacer") {
    const nextModality = nextClassification.modalidad || (typeChanged ? null : next.modalidad);
    const needsPlace = nextModality === "presencial";
    return {
      ...next,
      modalidad: nextModality,
      ubicacion: needsPlace ? nextClassification.locationText || (typeChanged ? null : next.ubicacion) : null,
      coordinates: needsPlace && !nextClassification.locationText && !typeChanged ? next.coordinates : null,
      franja: needsPlace ? nextClassification.timeSlot || (typeChanged ? null : next.franja) : null,
      datoFaltanteTexto: null,
      datoFaltanteConfirmado: false,
    };
  }

  return {
    ...next,
    modalidad: nextClassification.modalidad || "presencial",
    ubicacion: nextClassification.locationText || (typeChanged ? null : next.ubicacion),
    coordinates: nextClassification.locationText || typeChanged ? null : next.coordinates,
    franja: nextClassification.timeSlot || (typeChanged ? null : next.franja),
    datoFaltanteTexto: typeChanged ? null : next.datoFaltanteTexto,
    datoFaltanteConfirmado: typeChanged ? false : next.datoFaltanteConfirmado,
  };
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
  const [chosenOffer, setChosenOffer] = useState(null);
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
  const timers = useRef([]);

  useEffect(() => {
    (async () => {
      const p = await storageGet(PROFILE_KEY, false);
      setProfile(p);
    })();
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

  function goBackToStart() {
    setEditingFromType(classification?.tipo || null);
    setReviewingEdit(true);
    setClassification(null);
    setContextReviewRequired(true);
  }

  async function isRequestStillOpen(reqId) {
    const all = (await storageGet(REQUESTS_KEY, true)) || [];
    const mine = all.find((r) => r.id === reqId);
    return mine && mine.estado !== "cerrado" && mine.estado !== "cancelado";
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
    const all = (await storageGet(REQUESTS_KEY, true)) || [];
    const ok = await storageSet(REQUESTS_KEY, [newRequest, ...all], true);
    setPublishing(false);
    if (!ok) {
      setPublishError(true);
      return;
    }
    setRequest(newRequest);
    scheduleSimulatedProducers(newRequest, productores);
  }

  // Punto de la reunión del 29/8: el artista puede editar un pedido ya
  // publicado. El sistema —no el artista— se encarga de la reasignación:
  // se limpian intereses/ofertas previos y se vuelve a correr el matching
  // sobre los datos actualizados, conservando el mismo id de pedido.
  function handleEditRequest() {
    if (!request) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setEditingLiveRequestId(request.id);
    setText(request.textoOriginal);
    setClassification(request.classification || null);
    setContext(request.context || null);
    setEditingFromType(request.tipo);
    setReviewingEdit(true);
    setContextReviewRequired(true);
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
    const all = (await storageGet(REQUESTS_KEY, true)) || [];
    let updatedRequest = null;
    const updated = all.map((r) => {
      if (r.id !== editingLiveRequestId) return r;
      updatedRequest = {
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
      };
      return updatedRequest;
    });
    const ok = updatedRequest && (await storageSet(REQUESTS_KEY, updated, true));
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
        const all = (await storageGet(REQUESTS_KEY, true)) || [];
        if (path === "ahora_no") return;
        if (path === "oferta_directa") {
          const oferta = buildOfferFrom(p);
          const updated = all.map((r) => (r.id === req.id ? { ...r, ofertas: [...r.ofertas, oferta], estado: "con_ofertas" } : r));
          await storageSet(REQUESTS_KEY, updated, true);
        } else {
          const createdAt = new Date().toISOString();
          const interes = {
            id: uid(),
            ...p,
            mensajes: [{ from: "productor", text: p.pregunta, createdAt }],
            resuelto: false,
            createdAt,
          };
          const updated = all.map((r) => (r.id === req.id ? { ...r, intereses: [...r.intereses, interes] } : r));
          await storageSet(REQUESTS_KEY, updated, true);
        }
      }, 3000 + i * 4000);
      timers.current.push(t);
    });

    const recoveryDelay = 3000 + productores.length * 4000 + 2500;
    const rt = setTimeout(async () => {
      if (!(await isRequestStillOpen(req.id))) return;
      const all = (await storageGet(REQUESTS_KEY, true)) || [];
      const mine = all.find((r) => r.id === req.id);
      if (!mine || mine.intereses.length > 0 || mine.ofertas.length > 0) return;
      const curados = mine.tieneReferencia ? getCuratedAlternatives(mine) : [];
      const recoveryTipo = mine.tieneReferencia && curados.length > 0 ? "curada" : "aclaracion";
      const updated = all.map((r) => (r.id === req.id ? { ...r, recovery: recoveryTipo, curados } : r));
      await storageSet(REQUESTS_KEY, updated, true);
    }, recoveryDelay);
    timers.current.push(rt);
  }

  async function handleAclaracion(textoAclaracion) {
    const all = (await storageGet(REQUESTS_KEY, true)) || [];
    const mine = all.find((r) => r.id === request.id);
    if (!mine) return;
    // La aclaración suma información, no la reemplaza: se combinan los géneros ya
    // confirmados del pedido original con lo nuevo que se detecte en el texto.
    const generos = Array.from(new Set([...(mine.generos || []), ...detectGeneros(textoAclaracion)]));
    const { productores, ampliado } = pickProducers(mine.tipo, generos, mine);
    const updated = all.map((r) => (r.id === request.id ? { ...r, recovery: null, curados: [], matchAmpliado: ampliado, tieneReferencia: true, generos } : r));
    const ok = await storageSet(REQUESTS_KEY, updated, true);
    if (!ok) return false;
    scheduleSimulatedProducers({ id: request.id }, productores);
    return true;
  }

  async function handleSolicitarCurado(productorData) {
    const oferta = buildOfferFrom(productorData);
    const all = (await storageGet(REQUESTS_KEY, true)) || [];
    let changed = false;
    const updated = all.map((r) => {
      if (r.id !== request.id || r.estado === "cerrado" || r.estado === "cancelado") return r;
      changed = true;
      return { ...r, recovery: null, curados: [], ofertas: [...r.ofertas, oferta], estado: "con_ofertas" };
    });
    return changed && await storageSet(REQUESTS_KEY, updated, true);
  }

  async function handleChoose(offer) {
    setChoosing(true);
    setChooseError(null);
    const all = (await storageGet(REQUESTS_KEY, true)) || [];
    let changed = false;
    const updated = all.map((r) => {
      if (r.id !== request.id || r.estado === "cerrado" || r.estado === "cancelado") return r;
      changed = true;
      return { ...r, estado: "cerrado", chosenOfferId: offer.id };
    });
    const ok = changed && await storageSet(REQUESTS_KEY, updated, true);
    setChoosing(false);
    if (!ok) {
      setChooseError("No pudimos guardar tu elección. Probá de nuevo.");
      return;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setChosenOffer(offer);
  }

  async function handleMessageOffer(offer) {
    setMessaging(true);
    setChooseError(null);
    const all = (await storageGet(REQUESTS_KEY, true)) || [];
    let conversation = null;
    let changed = false;
    const updated = all.map((r) => {
      if (r.id !== request.id || r.estado === "cerrado" || r.estado === "cancelado") return r;
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
      changed = true;
      return { ...r, intereses: [...r.intereses, conversation] };
    });
    const ok = !changed || await storageSet(REQUESTS_KEY, updated, true);
    setMessaging(false);
    if (!ok || !conversation) {
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
    }
  }

  async function handleCancel() {
    const cancelledId = request ? request.id : null;
    if (!cancelledId) return false;
    const all = (await storageGet(REQUESTS_KEY, true)) || [];
    let changed = false;
    const updated = all.map((r) => {
      if (r.id !== cancelledId) return r;
      changed = true;
      return { ...r, estado: "cancelado" };
    });
    const ok = changed && await storageSet(REQUESTS_KEY, updated, true);
    if (!ok) return false;
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

  let body = null;
  if (profile === undefined) {
    body = null;
  } else if (profile === null) {
    body = <Gate onDone={handleGateDone} />;
  } else if (chosenOffer) {
    body = <ChosenScreen offer={chosenOffer} />;
  } else if (selectedOffer) {
    body = <OfferDetail offer={selectedOffer} choosing={choosing} messaging={messaging} chooseError={chooseError} onBack={() => { setSelectedOffer(null); setChooseError(null); }} onMessage={() => handleMessageOffer(selectedOffer)} onChoose={() => handleChoose(selectedOffer)} />;
  } else if (openInteres) {
    body = <ConversationScreen request={request} interes={openInteres} formalOfferExists={!!conversationReturnOffer || !!openInteres.formalOfferExists} onBack={closeConversation} onOfferGenerated={() => {}} />;
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
  } else {
    body = (
      <StartScreen
        onSubmit={handleTextSubmit}
        interpreting={interpreting}
        error={error}
        initialText={text}
        onCancelLiveEdit={editingLiveRequestId ? cancelLiveEdit : null}
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

        <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto" }}>{body}</div>
      </div>
    </div>
  );
}
