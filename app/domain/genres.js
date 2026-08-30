// Detección de géneros a partir de texto libre (pedido, referencias,
// aclaraciones). Sin dependencia de React: la usan tanto el intérprete de
// pedidos como la pantalla de contexto para sugerir géneros.

export const GENRE_KEYWORDS = {
  urbano: ["urbano", "urbana"],
  trap: ["trap"],
  reggaeton: ["reggaeton", "reggaetón"],
  pop: ["pop"],
  rock: ["rock", "punk"],
  alternativo: ["alternative", "alternativo", "indie", "post punk", "postpunk"],
  electronica: ["electronica", "electrónica", "house", "techno"],
};

export const GENRE_LABELS = {
  urbano: "urbano",
  trap: "trap",
  reggaeton: "reggaetón",
  pop: "pop",
  rock: "rock",
  alternativo: "indie / alternativo",
  electronica: "electrónica",
};

export const ARTIST_GENRE_HINTS = {
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

export function detectGeneros(text) {
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
