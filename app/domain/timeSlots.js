// Selección de franja horaria del artista (una o dos entre Mañana/Tarde/
// Noche, o "Me adapto" en exclusiva). Toda la normalización y las reglas de
// selección viven acá — ni ContextStep ni ningún otro componente visual
// deciden por su cuenta qué combinaciones son válidas.

export const TIME_SLOT_OPTIONS = ["Mañana", "Tarde", "Noche"];
export const FLEXIBLE_TIME_SLOT = "Me adapto";
export const MAX_TIME_SLOTS = 2;

// El intérprete (IA o fallback local) devuelve "mañana"/"tarde"/"noche" en
// minúscula; la UI y el resto del dominio comparan contra estas formas
// canónicas. Cualquier variante de mayúsculas/espacios de estas mismas
// franjas, o los sinónimos "me da igual"/"me adapto", canonicaliza acá.
const CANONICAL_BY_LOWER = {
  "mañana": "Mañana",
  "tarde": "Tarde",
  "noche": "Noche",
  "me adapto": FLEXIBLE_TIME_SLOT,
  "me da igual": FLEXIBLE_TIME_SLOT,
};

function canonicalizeTimeSlot(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return CANONICAL_BY_LOWER[trimmed.toLowerCase()] || null;
}

// Única puerta de entrada real de este módulo: acepta un array crudo (útil
// para normalizar internamente el resultado de toggle/format/match), un
// objeto con `timeSlots` (la forma nueva) o un objeto legado con `franja`
// (string suelto, mayúsculas/espacios arbitrarios). Siempre devuelve un
// array nuevo, canónico, sin duplicados, sin valores inválidos, con "Me
// adapto" en exclusiva y nunca más de MAX_TIME_SLOTS franjas concretas.
export function normalizeTimeSlots(source) {
  let raw;
  if (Array.isArray(source)) raw = source;
  else if (source && Array.isArray(source.timeSlots)) raw = source.timeSlots;
  else if (source && typeof source.franja === "string") raw = [source.franja];
  else raw = [];

  const canonical = [];
  for (const value of raw) {
    const c = canonicalizeTimeSlot(value);
    if (c && !canonical.includes(c)) canonical.push(c);
  }

  if (canonical.includes(FLEXIBLE_TIME_SLOT)) return [FLEXIBLE_TIME_SLOT];
  return canonical.slice(0, MAX_TIME_SLOTS);
}

export function isTimeSlotOptionDisabled(current, option) {
  const selected = normalizeTimeSlots(current);
  const canonicalOption = canonicalizeTimeSlot(option);
  if (!canonicalOption) return true;
  if (canonicalOption === FLEXIBLE_TIME_SLOT) return false;
  if (selected.includes(canonicalOption)) return false;
  if (selected.includes(FLEXIBLE_TIME_SLOT)) return false;
  return selected.length >= MAX_TIME_SLOTS;
}

// Toca una opción: la selecciona o deselecciona. "Me adapto" es exclusiva
// (limpia las demás al elegirse; elegir una franja concreta la reemplaza).
// Tocar una tercera franja concreta cuando ya hay dos no hace nada — la UI
// ya debería deshabilitar esa opción, pero esto es la fuente de verdad. Una
// opción que no canonicaliza a nada conocido no se agrega nunca.
export function toggleTimeSlot(current, option) {
  const selected = normalizeTimeSlots(current);
  const canonicalOption = canonicalizeTimeSlot(option);
  if (!canonicalOption) return selected;

  if (canonicalOption === FLEXIBLE_TIME_SLOT) {
    return selected.includes(FLEXIBLE_TIME_SLOT) ? [] : [FLEXIBLE_TIME_SLOT];
  }
  if (selected.includes(canonicalOption)) {
    return selected.filter((slot) => slot !== canonicalOption);
  }
  const withoutFlexible = selected.filter((slot) => slot !== FLEXIBLE_TIME_SLOT);
  if (withoutFlexible.length >= MAX_TIME_SLOTS) return selected;
  return [...withoutFlexible, canonicalOption];
}

// "Mañana", "Mañana o tarde" (primera palabra tal cual, resto en minúscula).
export function formatTimeSlots(timeSlots) {
  const slots = normalizeTimeSlots(timeSlots);
  if (slots.length === 0) return null;
  if (slots.length === 1) return slots[0];
  return slots.map((slot, i) => (i === 0 ? slot : slot.toLowerCase())).join(" o ");
}

// true si el productor sirve para al menos una de las franjas pedidas (o si
// no hay franja pedida / el artista puso "Me adapto" — no filtra en ese
// caso). Normaliza los dos lados, así que no importa la capitalización con
// la que haya quedado guardada cada una.
export function timeSlotsMatch(requestedTimeSlots, availableTimeSlots) {
  const requested = normalizeTimeSlots(requestedTimeSlots);
  if (requested.length === 0 || requested.includes(FLEXIBLE_TIME_SLOT)) return true;
  const available = normalizeTimeSlots(availableTimeSlots);
  return requested.some((slot) => available.includes(slot));
}
