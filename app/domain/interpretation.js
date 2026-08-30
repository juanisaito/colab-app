import { ARTIST_GENRE_HINTS } from "./genres.js";

/* ---------------- interpretación asistida (adaptador reemplazable) ----------------
   Punto 11: validación de respuesta + fallback local + sin secretos en el
   frontend (la llamada no usa ni expone ninguna API key) + error visible
   y recuperable (ver usedFallback más abajo, mostrado en el resumen). */

export const CLASSIFIER_SYSTEM_PROMPT = `Sos el módulo de interpretación de pedidos de COLAB, una app que conecta artistas independientes con productores musicales. Vas a recibir el texto libre de un artista. Tu trabajo es inferir lo más posible y señalar solo lo que realmente falte — nunca convertir esto en un formulario, y nunca inventar un dato que el texto no sostiene.

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

export function validateClassification(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (!VALID_TIPOS.includes(obj.tipo)) return false;
  if (typeof obj.title !== "string" || !obj.title.trim()) return false;
  if (typeof obj.summary !== "string" || !obj.summary.trim()) return false;
  return true;
}

// Completa campos opcionales ausentes con null, para que el resto del código
// nunca tenga que lidiar con "undefined" si el modelo omitió alguno.
export function normalizeClassification(obj) {
  const out = { ...obj };
  OPTIONAL_STRING_FIELDS.forEach((f) => { if (out[f] === undefined) out[f] = null; });
  OPTIONAL_CONFIDENCE_FIELDS.forEach((f) => { if (out[f] === undefined) out[f] = null; });
  if (!Array.isArray(out.datos_faltantes)) out.datos_faltantes = [];
  if (!out.modalidad_fuente) out.modalidad_fuente = "desconocida";
  if (!out.confianza) out.confianza = "media";
  return out;
}

// Corta en el último espacio antes del límite para no partir una palabra al
// medio (ej. "termi…" en vez de "terminada…").
export function truncateAtWord(text, maxLen) {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

// Fallback local determinístico: se usa solo si la llamada a la API falla o
// devuelve algo inválido. Conserva datos explícitos básicos y, ante un pedido
// ambiguo, pide reformular en lugar de inventar una intención.
export function interpretFallback(text) {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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
    summary: truncateAtWord(text, 110),
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

export async function interpretRequestViaBackend(text, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const configuredEndpoint = typeof import.meta !== "undefined" ? import.meta.env?.VITE_AI_INTERPRET_URL : null;
  const endpoint = options.endpoint || configuredEndpoint || "/api/interpret";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      signal: controller.signal,
      body: JSON.stringify({ text }),
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`Backend de interpretación: ${response.status}`);
  const data = await response.json();
  const classification = data.classification || data;
  if (!validateClassification(classification)) throw new Error("Clasificación inválida");
  return normalizeClassification(classification);
}

// Adaptador reemplazable: interpretRequest es el único punto de entrada que
// usa el resto de la app. Devuelve además si tuvo que usar el respaldo local,
// para poder avisarlo (error visible y recuperable, no oculto).
export async function interpretRequest(text) {
  try {
    const result = await interpretRequestViaBackend(text);
    return { ...result, originalText: text, usedFallback: false };
  } catch (e) {
    console.warn("Interpretación por IA no disponible, uso respaldo determinístico:", e);
    return { ...interpretFallback(text), originalText: text, usedFallback: true };
  }
}
