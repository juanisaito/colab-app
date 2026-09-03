import test from "node:test";
import assert from "node:assert/strict";
import {
  MUSIC_WORLDS,
  MARKETS,
  SUGGESTION_ROLES,
  MUSIC_REFERENCE_CATALOG,
  normalizeArtistName,
  getMusicTagsForEntry,
  validateMusicReferenceCatalog,
} from "./musicReferenceCatalog.js";

function validEntry(overrides = {}) {
  return {
    id: "sample_artist",
    name: "Sample Artist",
    market: "AR",
    primaryWorld: "trap",
    secondaryTags: ["urbano"],
    suggestionRole: "central",
    curationNote: "Motivo de inclusión.",
    ...overrides,
  };
}

/* ---------------- validación: casos inválidos chicos ---------------- */

test("valida un catálogo mínimo correcto", () => {
  const result = validateMusicReferenceCatalog([validEntry()]);
  assert.deepEqual(result, { valid: true, errors: [] });
});

test("rechaza un catálogo que no es un array", () => {
  const result = validateMusicReferenceCatalog({ not: "an array" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("rechaza un id vacío", () => {
  const result = validateMusicReferenceCatalog([validEntry({ id: "" })]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("id vacío")));
});

test("rechaza ids duplicados", () => {
  const result = validateMusicReferenceCatalog([validEntry(), validEntry({ name: "Otro Nombre" })]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("id duplicado")));
});

test("rechaza un nombre vacío", () => {
  const result = validateMusicReferenceCatalog([validEntry({ name: "   " })]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("nombre vacío")));
});

test("rechaza nombres duplicados ignorando mayúsculas, acentos y espacios exteriores", () => {
  const result = validateMusicReferenceCatalog([
    validEntry({ id: "a", name: "María Becerra" }),
    validEntry({ id: "b", name: "  MARIA becerra  " }),
  ]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("nombre duplicado")));
});

test("rechaza un mercado desconocido", () => {
  const result = validateMusicReferenceCatalog([validEntry({ market: "EU" })]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("mercado desconocido")));
});

test("rechaza un mundo principal desconocido", () => {
  const result = validateMusicReferenceCatalog([validEntry({ primaryWorld: "folklore" })]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("mundo principal desconocido")));
});

test("rechaza un rol de sugerencia desconocido", () => {
  const result = validateMusicReferenceCatalog([validEntry({ suggestionRole: "headliner" })]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("rol de sugerencia desconocido")));
});

test("rechaza secondaryTags que no es un array", () => {
  const result = validateMusicReferenceCatalog([validEntry({ secondaryTags: "urbano" })]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("secondaryTags")));
});

test("rechaza secondaryTags vacío", () => {
  const result = validateMusicReferenceCatalog([validEntry({ secondaryTags: [] })]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("secondaryTags")));
});

test("rechaza secondaryTags con un string vacío", () => {
  const result = validateMusicReferenceCatalog([validEntry({ secondaryTags: ["urbano", "  "] })]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("secondaryTags")));
});

test("rechaza un tag secundario idéntico al mundo principal", () => {
  const result = validateMusicReferenceCatalog([validEntry({ primaryWorld: "trap", secondaryTags: ["trap"] })]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("repetir el mundo principal")));
});

test("rechaza una nota de curaduría vacía", () => {
  const result = validateMusicReferenceCatalog([validEntry({ curationNote: "" })]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("curationNote vacía")));
});

test("no muta el catálogo recibido", () => {
  const input = [validEntry()];
  const snapshot = JSON.parse(JSON.stringify(input));
  validateMusicReferenceCatalog(input);
  assert.deepEqual(input, snapshot);
});

/* ---------------- helper de tags ---------------- */

test("getMusicTagsForEntry incluye el mundo principal y los tags secundarios", () => {
  const entry = validEntry({ primaryWorld: "trap", secondaryTags: ["urbano", "melodic"] });
  assert.deepEqual(getMusicTagsForEntry(entry), ["trap", "urbano", "melodic"]);
});

test("getMusicTagsForEntry no muta la entrada ni su array de tags", () => {
  const entry = validEntry({ secondaryTags: ["urbano", "melodic"] });
  const tagsSnapshot = [...entry.secondaryTags];
  const result = getMusicTagsForEntry(entry);
  result.push("algo_nuevo");
  assert.deepEqual(entry.secondaryTags, tagsSnapshot);
});

/* ---------------- catálogo real ---------------- */

test("el catálogo real tiene exactamente 80 entradas", () => {
  assert.equal(MUSIC_REFERENCE_CATALOG.length, 80);
});

test("el catálogo real tiene 80 ids únicos", () => {
  const ids = new Set(MUSIC_REFERENCE_CATALOG.map((entry) => entry.id));
  assert.equal(ids.size, 80);
});

test("el catálogo real tiene 80 nombres únicos según la normalización definida", () => {
  const names = new Set(MUSIC_REFERENCE_CATALOG.map((entry) => normalizeArtistName(entry.name)));
  assert.equal(names.size, 80);
});

test("el catálogo real cubre exactamente los ocho mundos principales", () => {
  const worldsInCatalog = new Set(MUSIC_REFERENCE_CATALOG.map((entry) => entry.primaryWorld));
  const expectedWorlds = new Set(MUSIC_WORLDS.map((world) => world.code));
  assert.equal(worldsInCatalog.size, 8);
  assert.deepEqual(worldsInCatalog, expectedWorlds);
});

test("cada uno de los ocho mundos principales tiene diez entradas", () => {
  MUSIC_WORLDS.forEach((world) => {
    const count = MUSIC_REFERENCE_CATALOG.filter((entry) => entry.primaryWorld === world.code).length;
    assert.equal(count, 10, `mundo ${world.code} debería tener 10 entradas, tiene ${count}`);
  });
});

test("el catálogo real respeta la distribución de mercado del borrador (47 AR, 12 LATAM, 21 INTL)", () => {
  const counts = { AR: 0, LATAM: 0, INTL: 0 };
  MUSIC_REFERENCE_CATALOG.forEach((entry) => {
    counts[entry.market] += 1;
  });
  assert.deepEqual(counts, { AR: 47, LATAM: 12, INTL: 21 });
});

test("el catálogo real respeta la distribución de roles del borrador (39 central, 30 bridge, 11 discovery)", () => {
  const counts = { central: 0, bridge: 0, discovery: 0 };
  MUSIC_REFERENCE_CATALOG.forEach((entry) => {
    counts[entry.suggestionRole] += 1;
  });
  assert.deepEqual(counts, { central: 39, bridge: 30, discovery: 11 });
});

test("todas las entradas del catálogo real son válidas", () => {
  const result = validateMusicReferenceCatalog(MUSIC_REFERENCE_CATALOG);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test("todas las entradas del catálogo real usan valores de mercado y rol permitidos", () => {
  MUSIC_REFERENCE_CATALOG.forEach((entry) => {
    assert.ok(MARKETS.includes(entry.market), `market inválido en ${entry.id}`);
    assert.ok(SUGGESTION_ROLES.includes(entry.suggestionRole), `suggestionRole inválido en ${entry.id}`);
  });
});
