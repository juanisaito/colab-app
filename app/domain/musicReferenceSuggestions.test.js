import test from "node:test";
import assert from "node:assert/strict";
import {
  MUSIC_REFERENCE_SUGGESTION_LIMIT,
  MUSIC_WORLD_ADJACENCY,
  normalizeSelectedMusicWorlds,
  suggestMusicReferences,
} from "./musicReferenceSuggestions.js";
import { MUSIC_REFERENCE_CATALOG, MUSIC_WORLDS, getMusicTagsForEntry } from "./musicReferenceCatalog.js";

const WORLD_CODES = MUSIC_WORLDS.map((world) => world.code);
const EXTERNAL_MARKETS = new Set(["LATAM", "INTL"]);
const CATALOG_BY_ID = new Map(MUSIC_REFERENCE_CATALOG.map((entry) => [entry.id, entry]));

function ids(entries) {
  return entries.map((entry) => entry.id);
}

function marketCounts(entries) {
  const counts = {};
  entries.forEach((entry) => {
    counts[entry.market] = (counts[entry.market] || 0) + 1;
  });
  return counts;
}

function roleCounts(entries) {
  const counts = {};
  entries.forEach((entry) => {
    counts[entry.suggestionRole] = (counts[entry.suggestionRole] || 0) + 1;
  });
  return counts;
}

function isRelatedToWorld(entry, world) {
  const tags = getMusicTagsForEntry(entry);
  const neighbors = MUSIC_WORLD_ADJACENCY[world] || [];
  return tags.includes(world) || neighbors.some((neighbor) => tags.includes(neighbor));
}

/* ==================== normalizeSelectedMusicWorlds ==================== */

test("normalizeSelectedMusicWorlds descarta códigos inválidos", () => {
  assert.deepEqual(normalizeSelectedMusicWorlds(["trap", "no_existe", "pop"]), ["trap", "pop"]);
});

test("normalizeSelectedMusicWorlds elimina duplicados", () => {
  assert.deepEqual(normalizeSelectedMusicWorlds(["trap", "trap", "pop"]), ["trap", "pop"]);
});

test("normalizeSelectedMusicWorlds nunca devuelve más de dos mundos", () => {
  assert.deepEqual(normalizeSelectedMusicWorlds(["trap", "pop", "rock", "electronic"]), ["trap", "pop"]);
});

test("normalizeSelectedMusicWorlds respeta el orden recibido", () => {
  assert.deepEqual(normalizeSelectedMusicWorlds(["electronic", "trap"]), ["electronic", "trap"]);
});

test("normalizeSelectedMusicWorlds siempre devuelve un array nuevo y no muta la entrada", () => {
  const input = ["trap", "pop"];
  const result = normalizeSelectedMusicWorlds(input);
  assert.notEqual(result, input);
  result.push("rock");
  assert.deepEqual(input, ["trap", "pop"]);
});

test("normalizeSelectedMusicWorlds con entrada vacía o no-array devuelve array vacío", () => {
  assert.deepEqual(normalizeSelectedMusicWorlds([]), []);
  assert.deepEqual(normalizeSelectedMusicWorlds(undefined), []);
  assert.deepEqual(normalizeSelectedMusicWorlds("trap"), []);
});

/* ==================== determinismo e integridad ==================== */

test("misma entrada y página producen siempre el mismo resultado y orden", () => {
  const options = { worldCodes: ["pop", "electronic"], page: 3 };
  const a = ids(suggestMusicReferences(options));
  const b = ids(suggestMusicReferences(options));
  assert.deepEqual(a, b);
});

test("sin ningún mundo válido devuelve un array vacío", () => {
  assert.deepEqual(suggestMusicReferences({ worldCodes: [] }), []);
  assert.deepEqual(suggestMusicReferences({ worldCodes: ["no_existe"] }), []);
  assert.deepEqual(suggestMusicReferences({}), []);
});

WORLD_CODES.forEach((world) => {
  test(`${world}: página 0 devuelve seis IDs únicos`, () => {
    const result = suggestMusicReferences({ worldCodes: [world] });
    assert.equal(result.length, MUSIC_REFERENCE_SUGGESTION_LIMIT);
    assert.equal(new Set(ids(result)).size, MUSIC_REFERENCE_SUGGESTION_LIMIT);
  });
});

test("ningún resultado muta el catálogo ni sus entradas", () => {
  const result = suggestMusicReferences({ worldCodes: ["trap"] });
  assert.throws(() => {
    result[0].name = "mutado";
  });
  assert.notEqual(result[0].name, "mutado");
});

test("las entradas devueltas son las mismas referencias congeladas del catálogo, nunca copias", () => {
  const result = suggestMusicReferences({ worldCodes: ["pop", "electronic"] });
  result.forEach((entry) => {
    assert.equal(entry, CATALOG_BY_ID.get(entry.id), `${entry.id} no es la referencia original del catálogo`);
  });
});

WORLD_CODES.forEach((world) => {
  test(`${world}: ningún artista sugerido es ajeno al mundo o a su matriz de cercanía`, () => {
    const result = suggestMusicReferences({ worldCodes: [world] });
    result.forEach((entry) => {
      assert.ok(isRelatedToWorld(entry, world), `${entry.id} no está relacionado con ${world}`);
    });
  });
});

WORLD_CODES.forEach((world) => {
  test(`${world}: page 1 cambia al menos un resultado no reservado`, () => {
    const page0 = ids(suggestMusicReferences({ worldCodes: [world], page: 0 }));
    const page1 = ids(suggestMusicReferences({ worldCodes: [world], page: 1 }));
    const changed = page0.some((id, index) => id !== page1[index]);
    assert.ok(changed, `page 1 no cambió ningún resultado para ${world}`);
  });
});

test("page inválida (negativa, decimal, no numérica) equivale a page 0", () => {
  const base = ids(suggestMusicReferences({ worldCodes: ["trap"], page: 0 }));
  [-1, 1.5, NaN, "2", null, undefined, {}].forEach((invalidPage) => {
    const result = ids(suggestMusicReferences({ worldCodes: ["trap"], page: invalidPage }));
    assert.deepEqual(result, base, `page inválida ${String(invalidPage)} no se comportó como 0`);
  });
});

/* ==================== equilibrio con un mundo ==================== */

WORLD_CODES.forEach((world) => {
  test(`${world}: página 0 sin reservados incluye al menos dos AR y dos externos`, () => {
    const result = suggestMusicReferences({ worldCodes: [world] });
    const counts = marketCounts(result);
    const external = (counts.LATAM || 0) + (counts.INTL || 0);
    assert.ok((counts.AR || 0) >= 2, `${world}: sólo ${counts.AR || 0} AR`);
    assert.ok(external >= 2, `${world}: sólo ${external} externos`);
  });

  test(`${world}: ningún mercado exacto supera tres entradas`, () => {
    const result = suggestMusicReferences({ worldCodes: [world] });
    const counts = marketCounts(result);
    Object.entries(counts).forEach(([market, count]) => {
      assert.ok(count <= 3, `${world}: mercado ${market} tiene ${count} entradas`);
    });
  });

  test(`${world}: hay presencia de central, bridge y discovery`, () => {
    const result = suggestMusicReferences({ worldCodes: [world] });
    const counts = roleCounts(result);
    assert.ok(counts.central > 0, `${world} sin central`);
    assert.ok(counts.bridge > 0, `${world} sin bridge`);
    assert.ok(counts.discovery > 0, `${world} sin discovery`);
  });
});

/* ==================== dos mundos ==================== */

const TWO_WORLD_CASES = [
  ["indie_alternative", "trap"],
  ["reggaeton", "cumbia_tropical"],
  ["pop", "electronic"],
];

TWO_WORLD_CASES.forEach(([worldA, worldB]) => {
  test(`${worldA} + ${worldB}: seis únicos, con representación directa de ambos mundos`, () => {
    const result = suggestMusicReferences({ worldCodes: [worldA, worldB] });
    assert.equal(result.length, MUSIC_REFERENCE_SUGGESTION_LIMIT);
    assert.equal(new Set(ids(result)).size, MUSIC_REFERENCE_SUGGESTION_LIMIT);

    const hasA = result.some((entry) => getMusicTagsForEntry(entry).includes(worldA));
    const hasB = result.some((entry) => getMusicTagsForEntry(entry).includes(worldB));
    assert.ok(hasA, `sin representación directa de ${worldA}`);
    assert.ok(hasB, `sin representación directa de ${worldB}`);

    result.forEach((entry) => {
      const related = isRelatedToWorld(entry, worldA) || isRelatedToWorld(entry, worldB);
      assert.ok(related, `${entry.id} no está relacionado con ${worldA} ni ${worldB}`);
    });
  });

  test(`${worldA} + ${worldB}: respeta el tope de tres por mercado exacto`, () => {
    const result = suggestMusicReferences({ worldCodes: [worldA, worldB] });
    const counts = marketCounts(result);
    Object.values(counts).forEach((count) => assert.ok(count <= 3));
  });
});

test("indie_alternative + trap: usa un puente directo cuando existe (tags con ambos mundos)", () => {
  const result = suggestMusicReferences({ worldCodes: ["indie_alternative", "trap"] });
  const directBridge = result.some((entry) => {
    const tags = getMusicTagsForEntry(entry);
    return tags.includes("indie_alternative") && tags.includes("trap");
  });
  assert.ok(directBridge, "no se usó ningún puente directo entre indie_alternative y trap existiendo alternativas");
});

test("rock + cumbia_tropical: sin puentes directos en el catálogo, el orden A/B sigue representando ambos mundos", () => {
  const result = suggestMusicReferences({ worldCodes: ["rock", "cumbia_tropical"] });
  const noDirectBridge = !result.some((entry) => {
    const tags = getMusicTagsForEntry(entry);
    return tags.includes("rock") && tags.includes("cumbia_tropical");
  });
  assert.ok(noDirectBridge, "se esperaba que no existiera un puente directo real en el catálogo para este caso");

  const hasRock = result.some((entry) => getMusicTagsForEntry(entry).includes("rock"));
  const hasCumbia = result.some((entry) => getMusicTagsForEntry(entry).includes("cumbia_tropical"));
  assert.ok(hasRock, "perdió representación de rock");
  assert.ok(hasCumbia, "perdió representación de cumbia_tropical");

  result.forEach((entry) => {
    const related = isRelatedToWorld(entry, "rock") || isRelatedToWorld(entry, "cumbia_tropical");
    assert.ok(related, `${entry.id} no está relacionado ni por vecindad con rock ni con cumbia_tropical`);
  });
});

test("el orden A,B frente a B,A puede cambiar el orden pero nunca hace desaparecer un mundo", () => {
  const ab = suggestMusicReferences({ worldCodes: ["trap", "indie_alternative"] });
  const ba = suggestMusicReferences({ worldCodes: ["indie_alternative", "trap"] });
  ["trap", "indie_alternative"].forEach((world) => {
    assert.ok(ab.some((e) => getMusicTagsForEntry(e).includes(world)), `orden A,B perdió ${world}`);
    assert.ok(ba.some((e) => getMusicTagsForEntry(e).includes(world)), `orden B,A perdió ${world}`);
  });
});

/* ==================== jerarquía de relevancia: primaryWorld ancla primero ====================
 * El catálogo está agrupado por bloques de primaryWorld (trap primero,
 * luego rap_hiphop, reggaeton…). Sin una jerarquía explícita, un
 * desempate por índice global del catálogo hace que una etiqueta
 * secundaria de un bloque anterior le gane a una coincidencia real de
 * primaryWorld de un bloque posterior. Estas pruebas verifican que eso ya
 * no ocurre: la tanda debe explicar el mundo elegido con anclajes reales,
 * no con cruces que reemplacen a esos anclajes.
 */

WORLD_CODES.forEach((world) => {
  test(`${world}: página 0 sin reservados incluye al menos cuatro entradas con primaryWorld === mundo elegido`, () => {
    const result = suggestMusicReferences({ worldCodes: [world] });
    const anchored = result.filter((entry) => entry.primaryWorld === world).length;
    assert.ok(anchored >= 4, `${world}: sólo ${anchored} entradas con primaryWorld === ${world} (${ids(result).join(", ")})`);
  });

  test(`${world}: page 1 mantiene al menos cuatro anclajes de primaryWorld === mundo elegido`, () => {
    const result = suggestMusicReferences({ worldCodes: [world], page: 1 });
    const anchored = result.filter((entry) => entry.primaryWorld === world).length;
    assert.ok(anchored >= 4, `${world} page 1: sólo ${anchored} anclajes (${ids(result).join(", ")})`);
  });
});

test("electronic: la tanda está anclada por artistas cuyo mundo principal es Electrónica, no por cruces de otros bloques", () => {
  const result = suggestMusicReferences({ worldCodes: ["electronic"] });
  const anchors = result.filter((entry) => entry.primaryWorld === "electronic");
  assert.ok(anchors.length >= 4, `sólo ${anchors.length} anclajes de electronic: ${ids(result).join(", ")}`);
  // Regresión puntual del defecto observado: la tanda de electronic ya no
  // debía estar dominada por Miranda!/Sara Hebe/Travis Scott/etc. — un
  // anclaje real de electrónica argentina como Hernán Cattáneo tiene que
  // volver a aparecer.
  assert.ok(ids(result).includes("hernan_cattaneo"), "faltó un anclaje esperable de electrónica argentina");
});

test("indie_alternative: la tanda está anclada por artistas cuyo mundo principal es Indie/alternativo, no por cruces de otros bloques", () => {
  const result = suggestMusicReferences({ worldCodes: ["indie_alternative"] });
  const anchors = result.filter((entry) => entry.primaryWorld === "indie_alternative");
  assert.ok(anchors.length >= 4, `sólo ${anchors.length} anclajes de indie_alternative: ${ids(result).join(", ")}`);
  // Regresión puntual: Soda Stereo (rock) y Nirvana (rock) ya no deberían
  // desplazar a artistas cuyo mundo principal sea realmente Indie/alternativo.
  assert.ok(ids(result).includes("el_mato"), "faltó un anclaje esperable de indie/alternativo argentino");
});

TWO_WORLD_CASES.forEach(([worldA, worldB]) => {
  test(`${worldA} + ${worldB}: al menos dos primaryWorld === ${worldA} y dos primaryWorld === ${worldB}`, () => {
    const result = suggestMusicReferences({ worldCodes: [worldA, worldB] });
    const countA = result.filter((entry) => entry.primaryWorld === worldA).length;
    const countB = result.filter((entry) => entry.primaryWorld === worldB).length;
    assert.ok(countA >= 2, `${worldA}: sólo ${countA} primaryWorld directo (${ids(result).join(", ")})`);
    assert.ok(countB >= 2, `${worldB}: sólo ${countB} primaryWorld directo (${ids(result).join(", ")})`);
  });

  test(`${worldA} + ${worldB}: page 1 mantiene al menos dos primaryWorld de cada mundo`, () => {
    const result = suggestMusicReferences({ worldCodes: [worldA, worldB], page: 1 });
    const countA = result.filter((entry) => entry.primaryWorld === worldA).length;
    const countB = result.filter((entry) => entry.primaryWorld === worldB).length;
    assert.ok(countA >= 2 && countB >= 2, `page 1 perdió anclajes de ${worldA}+${worldB}: A=${countA} B=${countB}`);
  });
});

test("pop + electronic: los primeros cuatro lugares no vienen de trap, rap_hiphop ni reggaeton", () => {
  const result = suggestMusicReferences({ worldCodes: ["pop", "electronic"] });
  const forbidden = new Set(["trap", "rap_hiphop", "reggaeton"]);
  result.slice(0, 4).forEach((entry) => {
    assert.ok(
      !forbidden.has(entry.primaryWorld),
      `${entry.id} (${entry.primaryWorld}) no debería estar entre los primeros cuatro lugares de pop + electronic`
    );
  });
});

test("rock + cumbia_tropical: los lugares de puente conectan directo con al menos un mundo, no sólo por vecindad con ambos", () => {
  const result = suggestMusicReferences({ worldCodes: ["rock", "cumbia_tropical"] });
  const anchors = result.filter((entry) => entry.primaryWorld === "rock" || entry.primaryWorld === "cumbia_tropical");
  const bridgeSlots = result.filter((entry) => !anchors.includes(entry));
  assert.ok(bridgeSlots.length >= 1, "se esperaban lugares de puente para auditar en rock + cumbia_tropical");
  bridgeSlots.forEach((entry) => {
    const tags = getMusicTagsForEntry(entry);
    const directRock = tags.includes("rock");
    const directCumbia = tags.includes("cumbia_tropical");
    assert.ok(
      directRock || directCumbia,
      `${entry.id} es sólo vecino de ambos mundos, existiendo candidatos con coincidencia directa a uno de los dos`
    );
  });
});

/* ==================== seleccionados y fijados ==================== */

test("hasta tres selectedArtistIds válidos se conservan primero y en orden", () => {
  const result = suggestMusicReferences({
    worldCodes: ["trap"],
    selectedArtistIds: ["nirvana", "bad_bunny", "soda_stereo"],
  });
  assert.deepEqual(ids(result).slice(0, 3), ["nirvana", "bad_bunny", "soda_stereo"]);
  assert.equal(result.length, MUSIC_REFERENCE_SUGGESTION_LIMIT);
});

test("selectedArtistIds duplicados e IDs desconocidos se ignoran sin mutar la entrada", () => {
  const options = { worldCodes: ["trap"], selectedArtistIds: ["duki", "duki", "no_existe", "khea"] };
  const snapshotBefore = JSON.stringify(options);
  const result = suggestMusicReferences(options);
  assert.deepEqual(ids(result).slice(0, 2), ["duki", "khea"]);
  assert.equal(JSON.stringify(options), snapshotBefore);
});

test("una selección explícita fuera del mundo elegido se conserva de todas formas", () => {
  const result = suggestMusicReferences({ worldCodes: ["trap"], selectedArtistIds: ["soda_stereo"] });
  assert.equal(ids(result)[0], "soda_stereo");
  assert.equal(result.length, MUSIC_REFERENCE_SUGGESTION_LIMIT);
});

test("pinnedArtistIds válidos aparecen después de los seleccionados y no se duplican", () => {
  const result = suggestMusicReferences({
    worldCodes: ["trap"],
    selectedArtistIds: ["duki"],
    pinnedArtistIds: ["duki", "khea", "khea"],
  });
  assert.deepEqual(ids(result).slice(0, 2), ["duki", "khea"]);
  assert.equal(new Set(ids(result)).size, MUSIC_REFERENCE_SUGGESTION_LIMIT);
});

test("cambiar de página nunca elimina seleccionados ni fijados", () => {
  const options = { worldCodes: ["trap"], selectedArtistIds: ["nirvana"], pinnedArtistIds: ["soda_stereo"] };
  const page0 = ids(suggestMusicReferences({ ...options, page: 0 }));
  const page2 = ids(suggestMusicReferences({ ...options, page: 2 }));
  assert.deepEqual(page0.slice(0, 2), ["nirvana", "soda_stereo"]);
  assert.deepEqual(page2.slice(0, 2), ["nirvana", "soda_stereo"]);
});

test("cuatro selecciones recibidas conservan sólo las primeras tres válidas y únicas", () => {
  const result = suggestMusicReferences({
    worldCodes: ["trap"],
    selectedArtistIds: ["duki", "khea", "cazzu", "future"],
  });
  assert.deepEqual(ids(result).slice(0, 3), ["duki", "khea", "cazzu"]);
  assert.notEqual(ids(result)[3], undefined);
  assert.equal(result.length, MUSIC_REFERENCE_SUGGESTION_LIMIT);
});

test("si seleccionados y fijados ya ocupan las seis plazas, no se agregan más artistas", () => {
  const result = suggestMusicReferences({
    worldCodes: ["trap"],
    selectedArtistIds: ["duki", "khea", "cazzu"],
    pinnedArtistIds: ["future", "travis_scott", "playboi_carti", "eladio_carrion"],
  });
  assert.deepEqual(ids(result), ["duki", "khea", "cazzu", "future", "travis_scott", "playboi_carti"]);
});

test("selectedArtistIds y pinnedArtistIds ausentes se comportan igual que arrays vacíos", () => {
  const withUndefined = ids(suggestMusicReferences({ worldCodes: ["trap"] }));
  const withEmpty = ids(suggestMusicReferences({ worldCodes: ["trap"], selectedArtistIds: [], pinnedArtistIds: [] }));
  assert.deepEqual(withUndefined, withEmpty);
});

/* ==================== reservados cubren grupos, no se vuelven a llenar ====================
 * Un seleccionado o fijado que ya representa un grupo (ej. Duki como
 * referencia AR central de trap) no debe hacer que el algoritmo vuelva a
 * llenar ese mismo grupo con un candidato nuevo — si no se descuenta,
 * sobra un lugar y el que se pierde es siempre el último de la lista
 * (descubrimiento), como se observó con "Ver otras seis".
 */

test("trap + seleccionado duki: lo conserva primero, seis únicos, y sigue habiendo central, bridge y discovery", () => {
  const result = suggestMusicReferences({ worldCodes: ["trap"], selectedArtistIds: ["duki"] });
  assert.equal(ids(result)[0], "duki");
  assert.equal(result.length, MUSIC_REFERENCE_SUGGESTION_LIMIT);
  assert.equal(new Set(ids(result)).size, MUSIC_REFERENCE_SUGGESTION_LIMIT);
  const roles = roleCounts(result);
  assert.ok(roles.central > 0, "sin central");
  assert.ok(roles.bridge > 0, "sin bridge");
  assert.ok(roles.discovery > 0, "sin discovery — el grupo de Duki (AR central) se volvió a llenar y desplazó el lugar de descubrimiento");
});

test("trap + seleccionados duki y future: conserva ambos primero y todavía incluye un bridge y un discovery", () => {
  const result = suggestMusicReferences({ worldCodes: ["trap"], selectedArtistIds: ["duki", "future"] });
  assert.deepEqual(ids(result).slice(0, 2), ["duki", "future"]);
  assert.equal(result.length, MUSIC_REFERENCE_SUGGESTION_LIMIT);
  assert.equal(new Set(ids(result)).size, MUSIC_REFERENCE_SUGGESTION_LIMIT);
  const roles = roleCounts(result);
  assert.ok(roles.bridge > 0, "sin bridge");
  assert.ok(roles.discovery > 0, "sin discovery — los grupos de Duki y Future se volvieron a llenar y desplazaron descubrimiento");
});

test("electronic + seleccionado hernan_cattaneo: conserva la selección y no pierde discovery, en página 0 y 1", () => {
  [0, 1].forEach((page) => {
    const result = suggestMusicReferences({ worldCodes: ["electronic"], selectedArtistIds: ["hernan_cattaneo"], page });
    assert.equal(ids(result)[0], "hernan_cattaneo", `page ${page}`);
    assert.equal(result.length, MUSIC_REFERENCE_SUGGESTION_LIMIT, `page ${page}`);
    assert.equal(new Set(ids(result)).size, MUSIC_REFERENCE_SUGGESTION_LIMIT, `page ${page}`);
    assert.ok(roleCounts(result).discovery > 0, `page ${page}: sin discovery`);
  });
});

test("pop + electronic + seleccionados emilia y hernan_cattaneo: cada reservado cubre su anclaje y la tanda llega a los lugares de puente", () => {
  const result = suggestMusicReferences({
    worldCodes: ["pop", "electronic"],
    selectedArtistIds: ["emilia", "hernan_cattaneo"],
  });
  assert.deepEqual(ids(result).slice(0, 2), ["emilia", "hernan_cattaneo"]);
  assert.equal(result.length, MUSIC_REFERENCE_SUGGESTION_LIMIT);
  assert.equal(new Set(ids(result)).size, MUSIC_REFERENCE_SUGGESTION_LIMIT);

  const countPop = result.filter((entry) => entry.primaryWorld === "pop").length;
  const countElectronic = result.filter((entry) => entry.primaryWorld === "electronic").length;
  assert.ok(countPop >= 2, `sólo ${countPop} primaryWorld === pop`);
  assert.ok(countElectronic >= 2, `sólo ${countElectronic} primaryWorld === electronic`);

  // emilia (tags incluyen pop y electronic directo) ya es en sí misma un
  // puente entre ambos mundos, así que además de los anclajes primarios la
  // tanda debe seguir llegando a un lugar de puente adicional.
  const bridgeLikePicks = result.slice(2).filter((entry) => {
    const tags = getMusicTagsForEntry(entry);
    return tags.includes("pop") && tags.includes("electronic");
  });
  assert.ok(bridgeLikePicks.length >= 1, "no se alcanzó ningún lugar de puente adicional entre pop y electronic");
});

test("un fijado relevante cubre grupos igual que un seleccionado, pero sigue apareciendo después", () => {
  const withSelected = suggestMusicReferences({ worldCodes: ["trap"], selectedArtistIds: ["duki"] });
  const withPinned = suggestMusicReferences({ worldCodes: ["trap"], pinnedArtistIds: ["duki"] });
  assert.deepEqual(ids(withSelected), ids(withPinned));

  const selectedThenPinned = suggestMusicReferences({
    worldCodes: ["trap"],
    selectedArtistIds: ["future"],
    pinnedArtistIds: ["duki"],
  });
  assert.deepEqual(ids(selectedThenPinned).slice(0, 2), ["future", "duki"]);
  assert.ok(roleCounts(selectedThenPinned).discovery > 0, "el fijado no liberó el lugar de descubrimiento");
});

test("una selección fuera de género se conserva pero no cubre falsamente un grupo musical", () => {
  const result = suggestMusicReferences({ worldCodes: ["trap"], selectedArtistIds: ["soda_stereo"] });
  assert.equal(ids(result)[0], "soda_stereo");
  // Como soda_stereo no representa ningún grupo de trap, el anclaje AR
  // central del propio mundo se sigue generando entre los picks
  // algorítmicos — no queda "cubierto" gratis por tratarse también de un
  // artista AR.
  const arCentralTrap = result.slice(1).some((entry) => entry.market === "AR" && entry.suggestionRole === "central" && entry.primaryWorld === "trap");
  assert.ok(arCentralTrap, "el grupo de AR central de trap no se generó: soda_stereo lo dio falsamente por cubierto");
});

test("rock + cumbia_tropical: los dos lugares de puente (result.slice(4)) anclan directo cada uno a un mundo distinto", () => {
  const result = suggestMusicReferences({ worldCodes: ["rock", "cumbia_tropical"] });
  const bridgeSlots = result.slice(4);
  assert.equal(bridgeSlots.length, 2);

  const directRock = bridgeSlots.filter((entry) => getMusicTagsForEntry(entry).includes("rock"));
  const directCumbia = bridgeSlots.filter((entry) => getMusicTagsForEntry(entry).includes("cumbia_tropical"));
  assert.ok(directRock.length >= 1, "ningún lugar de puente ancla directo con rock");
  assert.ok(directCumbia.length >= 1, "ningún lugar de puente ancla directo con cumbia_tropical");

  bridgeSlots.forEach((entry) => {
    const tags = getMusicTagsForEntry(entry);
    assert.ok(tags.includes("rock") || tags.includes("cumbia_tropical"), `${entry.id} es sólo vecino de ambos mundos, no directo de ninguno`);
  });
});
