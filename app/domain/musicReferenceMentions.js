// Detección de menciones reales de MUSIC_REFERENCE_CATALOG dentro de texto
// libre (el pedido original, la referencia interpretada). Puro y sin
// dependencia de React: sólo lee el catálogo, nunca lo muta ni devuelve
// entradas completas — sólo los IDs mencionados, en el orden en que
// aparecen en el texto.

import { MUSIC_REFERENCE_CATALOG, normalizeArtistName } from "./musicReferenceCatalog.js";

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Construye un patrón a partir del nombre ya normalizado (minúsculas, sin
// diacríticos): espacios internos flexibles (para tolerar espacios dobles)
// y límites de palabra reales antes/después de todo el nombre, para que
// "wos" nunca coincida dentro de "shows". El único nombre del catálogo con
// puntuación de cierre (`Miranda!`) vuelve ese signo opcional, para que
// "miranda" sin el signo siga contando como mención real.
function buildMentionPattern(normalizedName) {
  const escaped = escapeRegExp(normalizedName).replace(/\s+/g, "\\s+").replace(/!$/, "!?");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, "gu");
}

const CATALOG_PATTERNS = MUSIC_REFERENCE_CATALOG.map((entry) => {
  const normalizedName = normalizeArtistName(entry.name);
  return { id: entry.id, pattern: buildMentionPattern(normalizedName) };
}).filter((item) => item.pattern.source.length > 0);

export function findMentionedMusicReferenceIds(text) {
  if (typeof text !== "string") return [];
  const normalizedText = normalizeArtistName(text);
  if (!normalizedText) return [];

  const rawMatches = [];
  CATALOG_PATTERNS.forEach(({ id, pattern }) => {
    pattern.lastIndex = 0;
    let match = pattern.exec(normalizedText);
    while (match !== null) {
      const start = match.index + (match[0].length - match[1].length);
      const end = start + match[1].length;
      rawMatches.push({ id, start, end });
      match = pattern.exec(normalizedText);
    }
  });

  if (rawMatches.length === 0) return [];

  // Coincidencias que se solapan en el texto: gana la más larga en esa
  // posición (ej. un nombre compuesto por sobre uno de sus fragmentos).
  const byLengthDesc = rawMatches
    .slice()
    .sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);

  const accepted = [];
  byLengthDesc.forEach((candidate) => {
    const overlaps = accepted.some((taken) => candidate.start < taken.end && taken.start < candidate.end);
    if (!overlaps) accepted.push(candidate);
  });

  accepted.sort((a, b) => a.start - b.start);

  const seen = new Set();
  const orderedIds = [];
  accepted.forEach(({ id }) => {
    if (seen.has(id)) return;
    seen.add(id);
    orderedIds.push(id);
  });

  return orderedIds;
}
