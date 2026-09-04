// Selector determinístico de referencias musicales (bloque 2 de la
// biblioteca musical V1). Puro y sin dependencia de React: dado uno o dos
// mundos musicales, arma una tanda de seis artistas de
// MUSIC_REFERENCE_CATALOG siguiendo las reglas de equilibrio y fallback del
// documento de producto. Todavía no se conecta a ninguna pantalla.

import { MUSIC_REFERENCE_CATALOG, MUSIC_WORLDS, getMusicTagsForEntry } from "./musicReferenceCatalog.js";

export const MUSIC_REFERENCE_SUGGESTION_LIMIT = 6;

const MAX_SELECTED_ARTISTS = 3;

const MUSIC_WORLD_CODES = MUSIC_WORLDS.map((world) => world.code);

const RAW_ADJACENCY = {
  trap: ["rap_hiphop", "reggaeton", "electronic", "indie_alternative"],
  rap_hiphop: ["trap", "indie_alternative", "electronic", "rock", "cumbia_tropical"],
  reggaeton: ["trap", "pop", "cumbia_tropical"],
  pop: ["reggaeton", "indie_alternative", "electronic", "rock", "cumbia_tropical"],
  rock: ["indie_alternative", "pop", "rap_hiphop"],
  indie_alternative: ["rock", "pop", "electronic", "rap_hiphop", "trap"],
  electronic: ["pop", "indie_alternative", "trap", "cumbia_tropical", "rap_hiphop"],
  cumbia_tropical: ["reggaeton", "electronic", "pop", "rap_hiphop"],
};

export const MUSIC_WORLD_ADJACENCY = Object.freeze(
  Object.fromEntries(
    Object.entries(RAW_ADJACENCY).map(([world, neighbors]) => [world, Object.freeze([...neighbors])])
  )
);

// La matriz se escribe a mano en RAW_ADJACENCY; esta comprobación evita que
// una relación agregada de un solo lado (ej. A vecino de B sin B vecino de
// A) pase desapercibida.
function assertSymmetricAdjacency(adjacency) {
  Object.entries(adjacency).forEach(([world, neighbors]) => {
    neighbors.forEach((neighbor) => {
      const reciprocal = adjacency[neighbor];
      if (!reciprocal || !reciprocal.includes(world)) {
        throw new Error(`MUSIC_WORLD_ADJACENCY no es simétrica: ${world} -> ${neighbor}`);
      }
    });
  });
}
assertSymmetricAdjacency(MUSIC_WORLD_ADJACENCY);

const CATALOG_BY_ID = new Map(MUSIC_REFERENCE_CATALOG.map((entry) => [entry.id, entry]));
const CATALOG_INDEX = new Map(MUSIC_REFERENCE_CATALOG.map((entry, index) => [entry.id, index]));

export function normalizeSelectedMusicWorlds(worldCodes) {
  const input = Array.isArray(worldCodes) ? worldCodes : [];
  const result = [];
  for (const code of input) {
    if (typeof code !== "string") continue;
    if (!MUSIC_WORLD_CODES.includes(code)) continue;
    if (result.includes(code)) continue;
    result.push(code);
    if (result.length === 2) break;
  }
  return result;
}

function normalizePage(page) {
  return Number.isInteger(page) && page >= 0 ? page : 0;
}

function resolveUniqueEntries(ids, maxCount) {
  const input = Array.isArray(ids) ? ids : [];
  const result = [];
  const seen = new Set();
  for (const rawId of input) {
    if (typeof rawId !== "string") continue;
    if (seen.has(rawId)) continue;
    const entry = CATALOG_BY_ID.get(rawId);
    if (!entry) continue;
    seen.add(rawId);
    result.push(entry);
    if (maxCount != null && result.length >= maxCount) break;
  }
  return result;
}

function isExternalMarket(market) {
  return market === "LATAM" || market === "INTL";
}

function countBy(entries, keyFn) {
  const counts = {};
  entries.forEach((entry) => {
    const key = keyFn(entry);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function directMatch(candidate, world) {
  return candidate.tags.includes(world);
}

function neighborMatch(candidate, world) {
  return (MUSIC_WORLD_ADJACENCY[world] || []).some((neighbor) => candidate.tags.includes(neighbor));
}

// Pool de candidatos: cualquier entrada del catálogo (no reservada) que
// coincida directamente con alguno de los mundos elegidos o, en su
// defecto, con un vecino declarado en la matriz. Nunca se sale de este
// conjunto, así ningún artista completamente ajeno puede colarse por un
// nivel de fallback más adelante.
function buildRelatedPool(worlds, excludeIds) {
  const pool = [];
  MUSIC_REFERENCE_CATALOG.forEach((entry) => {
    if (excludeIds.has(entry.id)) return;
    const tags = getMusicTagsForEntry(entry);
    const candidate = { entry, tags, index: CATALOG_INDEX.get(entry.id) };
    const related = worlds.some((world) => directMatch(candidate, world) || neighborMatch(candidate, world));
    if (related) pool.push(candidate);
  });
  return pool;
}

// Jerarquía de relevancia de un candidato frente a UN mundo puntual, usada
// para desempatar dentro de un mismo nivel de grupo (mercado/rol) sin que
// el orden global del catálogo (que está agrupado por bloques de
// primaryWorld) termine premiando una etiqueta secundaria de un bloque
// anterior por sobre una coincidencia real de mundo principal de un bloque
// posterior:
//   1. primaryWorld === mundo pedido (el anclaje "real" del mundo).
//   2. Coincidencia directa pero sólo como etiqueta secundaria.
//   3. primaryWorld de un mundo vecino, respetando el orden editorial de
//      MUSIC_WORLD_ADJACENCY[mundo] (primer vecino declarado > segundo…).
//   4. Etiqueta secundaria de un mundo vecino (último recurso).
function relevanceForWorld(candidate, world) {
  if (candidate.entry.primaryWorld === world) return { level: 1, rank: 0 };
  if (candidate.tags.includes(world)) return { level: 2, rank: 0 };

  const neighbors = MUSIC_WORLD_ADJACENCY[world] || [];
  const primaryNeighborRank = neighbors.indexOf(candidate.entry.primaryWorld);
  if (primaryNeighborRank !== -1) return { level: 3, rank: primaryNeighborRank };

  let secondaryNeighborRank = -1;
  neighbors.forEach((neighbor, idx) => {
    if (secondaryNeighborRank === -1 && candidate.tags.includes(neighbor)) secondaryNeighborRank = idx;
  });
  if (secondaryNeighborRank !== -1) return { level: 4, rank: secondaryNeighborRank };

  return { level: 99, rank: 99 };
}

function compareByRelevance(world) {
  return (a, b) => {
    const relA = relevanceForWorld(a, world);
    const relB = relevanceForWorld(b, world);
    if (relA.level !== relB.level) return relA.level - relB.level;
    return relA.rank - relB.rank;
  };
}

// Dentro de un conjunto ya filtrado por nivel (y por tope de mercado),
// primero se restringe a la mejor franja de relevancia presente (ver
// relevanceForWorld) — así `page` nunca puede rotar un candidato vecino
// por encima de uno directo, ni una etiqueta secundaria por encima de un
// primaryWorld real — y sólo dentro de esa franja se aplica, como último
// desempate, el orden editorial rotado por `page`. Las cuotas de
// mercado/rol ya las cubren los predicados explícitos de cada grupo (y el
// tope de mercado en `pickOne`); no hace falta un puntaje genérico de
// cantidades que además distorsionaría ese orden editorial.
function bestOf(candidates, page, relevanceCompare) {
  let pool = candidates;
  if (relevanceCompare) {
    const sortedByRelevance = candidates.slice().sort(relevanceCompare);
    const best = sortedByRelevance[0];
    pool = sortedByRelevance.filter((candidate) => relevanceCompare(candidate, best) === 0);
  }

  const sorted = pool.slice().sort((a, b) => a.index - b.index);
  const offset = page % sorted.length;
  return sorted[offset];
}

// Recorre los niveles de un grupo (del más estricto al más relajado)
// buscando, en cada uno, algún candidato que todavía no supere el tope de
// mercado — así un nivel que por definición es de un solo mercado (ej.
// "referencia argentina central") no fuerza una cuarta entrada de ese
// mercado si un nivel más relajado más adelante sí tiene alternativas de
// otro mercado. Sólo si ningún nivel ofrece una opción dentro del tope se
// usa la mejor del nivel más estricto que haya tenido candidatos,
// aceptando el exceso porque el catálogo no permite evitarlo.
//
// Cada nivel puede ser una función predicado simple, o un objeto
// `{ predicate, relevanceCompare }` cuando además hace falta desempatar
// por relevancia de mundo dentro de ese nivel (ver bestOf).
function pickOne(levels, pool, usedIds, marketCounts, page, marketCap = 3) {
  let stricterFallback = null;

  for (const level of levels) {
    const predicate = typeof level === "function" ? level : level.predicate;
    const relevanceCompare = typeof level === "function" ? null : level.relevanceCompare;

    const atLevel = pool.filter((candidate) => !usedIds.has(candidate.entry.id) && predicate(candidate));
    if (atLevel.length === 0) continue;

    const withinCap = atLevel.filter((candidate) => (marketCounts[candidate.entry.market] || 0) < marketCap);
    if (withinCap.length > 0) {
      return bestOf(withinCap, page, relevanceCompare);
    }
    if (!stricterFallback) {
      stricterFallback = bestOf(atLevel, page, relevanceCompare);
    }
  }

  return stricterFallback;
}

// Cada grupo algorítmico (índice 0-5, mismo orden que buildOneWorldGroups
// / buildTwoWorldGroups) puede llegar ya "cubierto" por un seleccionado o
// fijado que lo represente genuinamente — ver assignReservedCoverage. Ese
// grupo se salta por completo: no se vuelve a llenar con un candidato
// nuevo, así una reservada realmente cuenta como uno de los seis lugares
// en vez de sumarse aparte y desplazar a otro grupo (típicamente
// descubrimiento, el último de la lista).
function runGroups(groupsLevels, pool, reserved, remaining, page, coveredGroupIndices) {
  const usedIds = new Set(reserved.map((entry) => entry.id));
  const marketCounts = countBy(reserved, (entry) => entry.market);
  const picks = [];

  function takePick(candidate) {
    usedIds.add(candidate.entry.id);
    marketCounts[candidate.entry.market] = (marketCounts[candidate.entry.market] || 0) + 1;
    picks.push(candidate.entry);
  }

  groupsLevels.forEach((levels, groupIndex) => {
    if (picks.length >= remaining) return;
    if (coveredGroupIndices.has(groupIndex)) return;
    const candidate = pickOne(levels, pool, usedIds, marketCounts, page);
    if (candidate) takePick(candidate);
  });

  // Último recurso: si los grupos no cubiertos no alcanzaron a llenar los
  // lugares que faltaban (catálogo insuficiente para ese cruce puntual),
  // se sigue completando con cualquier candidato relacionado restante, en
  // vez de devolver menos de lo posible.
  while (picks.length < remaining) {
    const candidate = pickOne([() => true], pool, usedIds, marketCounts, page);
    if (!candidate) break;
    takePick(candidate);
  }

  return picks;
}

// Cascada genérica para un lugar anclado a UN mundo y, opcionalmente, un
// mercado (`"AR"`, `"external"` o `null` para cualquiera) y una lista de
// roles preferidos:
//   1. mercado + rol exacto + primaryWorld === mundo.
//   2. mercado + primaryWorld === mundo (rol relajado — se prueba antes
//      de aceptar una etiqueta secundaria, tal como pide el contrato).
//   3. mercado + coincidencia directa (incluye ahora etiqueta secundaria).
//   4. mercado + mundo o vecino declarado (recién acá entran vecinos).
//   5. cualquier mercado + coincidencia directa (ancla musical mínima).
//   6. cualquier mercado + mundo o vecino (última red de seguridad).
function buildWorldSlotLevels(world, market, preferredRoles) {
  const marketPredicate =
    market === "AR" ? (c) => c.entry.market === "AR"
    : market === "external" ? (c) => isExternalMarket(c.entry.market)
    : () => true;
  const rolePredicate = preferredRoles && preferredRoles.length > 0
    ? (c) => preferredRoles.includes(c.entry.suggestionRole)
    : () => true;
  const isPrimary = (c) => c.entry.primaryWorld === world;
  const isDirect = (c) => directMatch(c, world);
  const isRelated = (c) => isDirect(c) || neighborMatch(c, world);
  const relevanceCompare = compareByRelevance(world);

  return [
    { predicate: (c) => marketPredicate(c) && rolePredicate(c) && isPrimary(c), relevanceCompare },
    { predicate: (c) => marketPredicate(c) && isPrimary(c), relevanceCompare },
    { predicate: (c) => marketPredicate(c) && isDirect(c), relevanceCompare },
    { predicate: (c) => marketPredicate(c) && isRelated(c), relevanceCompare },
    { predicate: (c) => isDirect(c), relevanceCompare },
    { predicate: (c) => isRelated(c), relevanceCompare },
  ];
}

// Lugar 5 del caso de un mundo: puente (rol `bridge`), preferentemente
// argentino. El rol es la condición fuerte (como en el resto de los
// grupos); "preferentemente argentino" se prueba antes de soltar el
// mercado, no al revés.
function buildBridgeSlotLevels(world) {
  const isBridge = (c) => c.entry.suggestionRole === "bridge";
  const isAR = (c) => c.entry.market === "AR";
  const isPrimary = (c) => c.entry.primaryWorld === world;
  const isDirect = (c) => directMatch(c, world);
  const isRelated = (c) => isDirect(c) || neighborMatch(c, world);
  const relevanceCompare = compareByRelevance(world);

  return [
    { predicate: (c) => isBridge(c) && isAR(c) && isPrimary(c), relevanceCompare },
    { predicate: (c) => isBridge(c) && isAR(c) && isDirect(c), relevanceCompare },
    { predicate: (c) => isBridge(c) && isPrimary(c), relevanceCompare },
    { predicate: (c) => isBridge(c) && isDirect(c), relevanceCompare },
    { predicate: (c) => isBridge(c) && isRelated(c), relevanceCompare },
    { predicate: (c) => isDirect(c), relevanceCompare },
    { predicate: (c) => isRelated(c), relevanceCompare },
  ];
}

// Lugar 6 del caso de un mundo: descubrimiento del propio mundo primero,
// después etiqueta secundaria directa, después un vecino declarado
// (respetando el orden de la matriz vía relevanceCompare) y, como último
// recurso, cualquier candidato directo musicalmente justificable aunque
// no sea `discovery`.
function buildDiscoverySlotLevels(world) {
  const isDiscovery = (c) => c.entry.suggestionRole === "discovery";
  const isPrimary = (c) => c.entry.primaryWorld === world;
  const isDirect = (c) => directMatch(c, world);
  const isRelated = (c) => isDirect(c) || neighborMatch(c, world);
  const relevanceCompare = compareByRelevance(world);

  return [
    { predicate: (c) => isDiscovery(c) && isPrimary(c), relevanceCompare },
    { predicate: (c) => isDiscovery(c) && isDirect(c), relevanceCompare },
    { predicate: (c) => isDiscovery(c) && isRelated(c), relevanceCompare },
    { predicate: (c) => isDirect(c), relevanceCompare },
    { predicate: (c) => isRelated(c), relevanceCompare },
  ];
}

function buildOneWorldGroups(world) {
  return [
    buildWorldSlotLevels(world, "AR", ["central"]),
    buildWorldSlotLevels(world, "AR", ["central", "bridge"]),
    buildWorldSlotLevels(world, "external", ["central"]),
    buildWorldSlotLevels(world, "external", ["central", "bridge"]),
    buildBridgeSlotLevels(world),
    buildDiscoverySlotLevels(world),
  ];
}

// Lugares 5 y 6 del caso de dos mundos: puente con coincidencia directa en
// ambos (rol y mercado preferidos primero, después relajados) y, recién si
// no alcanza, un candidato directo de un lado + vecino declarado del otro
// — nunca "vecino de ambos" mientras exista esa opción más legible.
// `anchorPreference` decide qué lado se prueba primero en ese nivel
// intermedio, para que si los dos lugares (5 y 6) necesitan este fallback
// no se apoyen siempre en el mismo mundo.
function buildDualBridgeSlotLevels(worldA, worldB, marketPref, anchorPreference) {
  const marketPredicate = marketPref === "arLatam"
    ? (c) => c.entry.market === "AR" || c.entry.market === "LATAM"
    : (c) => isExternalMarket(c.entry.market);
  const isBridge = (c) => c.entry.suggestionRole === "bridge";
  const dA = (c) => directMatch(c, worldA);
  const dB = (c) => directMatch(c, worldB);
  const nA = (c) => neighborMatch(c, worldA);
  const nB = (c) => neighborMatch(c, worldB);
  const bothDirect = (c) => dA(c) && dB(c);

  const oneDirectOtherNeighbor = anchorPreference === "A"
    ? [(c) => dA(c) && !dB(c) && nB(c), (c) => dB(c) && !dA(c) && nA(c)]
    : [(c) => dB(c) && !dA(c) && nA(c), (c) => dA(c) && !dB(c) && nB(c)];

  return [
    (c) => isBridge(c) && marketPredicate(c) && bothDirect(c),
    (c) => marketPredicate(c) && bothDirect(c),
    bothDirect,
    oneDirectOtherNeighbor[0],
    oneDirectOtherNeighbor[1],
    (c) => nA(c) && nB(c),
  ];
}

// Los dos lugares de puente (índices 4 y 5) no se deciden de forma
// independiente: cuando no hay ningún candidato con coincidencia directa
// en ambos mundos, cada lugar sólo puede anclar uno de los dos (directo a
// uno + vecino del otro) y hace falta decidir los DOS juntos para que, si
// el catálogo lo permite, terminen anclando mundos distintos — no por una
// cuota genérica, sino porque cada lugar sigue prefiriendo su propio
// mercado (AR/LATAM el primero, externo el segundo) y se elige la
// asignación de anclajes que deja a cada uno con una opción de su propio
// mercado disponible.
function pickBridgePair(worldA, worldB, pool, usedIds, marketCounts, page) {
  const dA = (c) => directMatch(c, worldA);
  const dB = (c) => directMatch(c, worldB);
  const nA = (c) => neighborMatch(c, worldA);
  const nB = (c) => neighborMatch(c, worldB);
  const isArLatam = (c) => c.entry.market === "AR" || c.entry.market === "LATAM";
  const isExternal = (c) => isExternalMarket(c.entry.market);
  const bothDirect = (c) => dA(c) && dB(c);
  const anchorA = (c) => dA(c) && !dB(c) && nB(c);
  const anchorB = (c) => dB(c) && !dA(c) && nA(c);
  const bothNeighbor = (c) => nA(c) && nB(c);

  const localUsed = new Set(usedIds);
  const localCounts = { ...marketCounts };

  function take(candidate) {
    if (!candidate) return null;
    localUsed.add(candidate.entry.id);
    localCounts[candidate.entry.market] = (localCounts[candidate.entry.market] || 0) + 1;
    return candidate;
  }

  function available(predicate) {
    return pool.filter((c) => !localUsed.has(c.entry.id) && predicate(c));
  }

  function bestOfTiers(tiers) {
    const tier = tiers.find((t) => t.length > 0);
    return tier ? bestOf(tier, page, null) : null;
  }

  if (available(bothDirect).length > 0) {
    // Hay al menos un puente real (coincide directo con los dos mundos).
    // Cada lugar primero busca uno de esos en su propio mercado; si el
    // mercado que le toca no tiene ningún puente real disponible, antes
    // de forzar el único puente real que quede (y quizás romper el tope),
    // prueba un candidato directo-a-uno + vecino-del-otro de su propio
    // mercado — así el lugar externo no termina empujado a un puente real
    // que sólo existe en AR/LATAM cuando el catálogo sí ofrece una
    // alternativa externa por otro camino.
    function bestForSlot(marketPreferred) {
      const bothDirectNow = available(bothDirect);
      const oneDirectNow = [...available(anchorA), ...available(anchorB)];
      return bestOfTiers([
        bothDirectNow.filter((c) => marketPreferred(c) && (localCounts[c.entry.market] || 0) < 3),
        oneDirectNow.filter((c) => marketPreferred(c) && (localCounts[c.entry.market] || 0) < 3),
        bothDirectNow.filter((c) => (localCounts[c.entry.market] || 0) < 3),
        oneDirectNow.filter((c) => (localCounts[c.entry.market] || 0) < 3),
        bothDirectNow,
        oneDirectNow,
      ]);
    }

    const pick4 = take(bestForSlot(isArLatam));
    const pick5 = take(bestForSlot(isExternal));
    return [pick4, pick5];
  }

  // Sin ningún puente real: cada lugar sólo puede anclar uno de los dos
  // mundos (directo a uno + vecino del otro). Se elige qué lugar ancla
  // cuál mundo según la asignación que deja a cada uno con una opción de
  // su propio mercado preferido disponible — así "uno se apoya en A, el
  // otro en B" no depende del orden global del catálogo.
  const anchorAPool = available(anchorA);
  const anchorBPool = available(anchorB);
  const arLatamWantsB = anchorBPool.some(isArLatam) && anchorAPool.some(isExternal);
  const arLatamWantsA = anchorAPool.some(isArLatam) && anchorBPool.some(isExternal);

  let arLatamSlotPredicate = anchorA;
  let externalSlotPredicate = anchorB;
  if (arLatamWantsB && !arLatamWantsA) {
    arLatamSlotPredicate = anchorB;
    externalSlotPredicate = anchorA;
  }

  function bestForAnchor(predicate, marketPreferred) {
    const candidates = available(predicate);
    return bestOfTiers([
      candidates.filter((c) => marketPreferred(c) && (localCounts[c.entry.market] || 0) < 3),
      candidates.filter((c) => (localCounts[c.entry.market] || 0) < 3),
      candidates.filter(marketPreferred),
      candidates,
    ]);
  }

  const pick4 = take(bestForAnchor(arLatamSlotPredicate, isArLatam));
  const pick5 = take(bestForAnchor(externalSlotPredicate, isExternal));
  if (pick4 && pick5) return [pick4, pick5];

  // Última red, sólo para el lugar que todavía falte: vecino de ambos.
  const finalPick4 = pick4 || take(bestForAnchor(bothNeighbor, isArLatam));
  const finalPick5 = pick5 || take(bestForAnchor(bothNeighbor, isExternal));
  return [finalPick4, finalPick5];
}

function buildTwoWorldGroups(worldA, worldB) {
  return [
    buildWorldSlotLevels(worldA, "AR", ["central", "bridge"]),
    buildWorldSlotLevels(worldA, "external", ["central", "bridge"]),
    buildWorldSlotLevels(worldB, "AR", ["central", "bridge"]),
    buildWorldSlotLevels(worldB, "external", ["central", "bridge"]),
  ];
}

// Qué grupo(s) del caso de UN mundo representa genuinamente una entrada
// reservada, en orden de especificidad (se prueba el primero; si ya está
// cubierto por otra reservada, se prueba el siguiente). Sólo cuenta una
// coincidencia DIRECTA (primaryWorld o etiqueta secundaria) — una relación
// sólo por vecindad no alcanza para dar un grupo por cubierto. El rol de
// la propia entrada decide la familia de grupos: `bridge` apunta primero
// al puente (grupo 5, índice 4) antes que a la segunda plaza genérica del
// mismo mercado; `discovery` apunta sólo a descubrimiento (grupo 6, índice
// 5); `central` apunta a su anclaje de mercado (grupo 1 o 3) y, si ya está
// tomado, a la segunda plaza de ese mismo mercado (grupo 2 o 4).
function candidateGroupsForOneWorld(candidate, world) {
  if (!directMatch(candidate, world)) return [];
  const isAR = candidate.entry.market === "AR";
  switch (candidate.entry.suggestionRole) {
    case "discovery":
      return [5];
    case "bridge":
      return isAR ? [4, 1] : [4, 3];
    default: // "central"
      return isAR ? [0, 1] : [2, 3];
  }
}

// Equivalente para el caso de DOS mundos (índices 0-5: AR-A, externa-A,
// AR-B, externa-B, puente AR/LATAM, puente externo — mismo orden que
// buildTwoWorldGroups). Una reservada que coincide directo con ambos
// mundos es, por definición, un puente: cubre primero el grupo de puente
// compatible con su mercado. Una que sólo ancla A o B cubre ese anclaje.
function candidateGroupsForTwoWorlds(candidate, worldA, worldB) {
  const dA = directMatch(candidate, worldA);
  const dB = directMatch(candidate, worldB);
  const isAR = candidate.entry.market === "AR";
  const isArLatam = isAR || candidate.entry.market === "LATAM";

  if (dA && dB) return isArLatam ? [4] : [5];
  if (dA && !dB) return [isAR ? 0 : 1];
  if (!dA && dB) return [isAR ? 2 : 3];
  return [];
}

// Recorre los reservados (seleccionados primero, fijados después, en ese
// orden) y le asigna a cada uno como máximo un grupo — el primero que le
// corresponda y todavía no esté cubierto por una reservada anterior. Una
// entrada sin relación directa con los mundos elegidos no cubre nada.
function assignReservedCoverage(reserved, candidateGroupsFn) {
  const covered = new Set();
  reserved.forEach((entry) => {
    const candidate = { entry, tags: getMusicTagsForEntry(entry) };
    const groupOptions = candidateGroupsFn(candidate);
    const groupIndex = groupOptions.find((index) => !covered.has(index));
    if (groupIndex !== undefined) covered.add(groupIndex);
  });
  return covered;
}

// Caso de dos mundos: los cuatro anclajes (índices 0-3) se llenan igual
// que en runGroups, salteando los que ya están cubiertos. Los dos lugares
// de puente (índices 4 y 5) se deciden juntos con pickBridgePair cuando
// ninguno de los dos está cubierto — si sólo falta uno, alcanza con la
// cascada simple de buildDualBridgeSlotLevels para ese lugar puntual.
function runTwoWorldGroups(worldA, worldB, pool, reserved, remaining, page, coveredGroupIndices) {
  const usedIds = new Set(reserved.map((entry) => entry.id));
  const marketCounts = countBy(reserved, (entry) => entry.market);
  const picks = [];

  function takePick(candidate) {
    if (!candidate) return;
    usedIds.add(candidate.entry.id);
    marketCounts[candidate.entry.market] = (marketCounts[candidate.entry.market] || 0) + 1;
    picks.push(candidate.entry);
  }

  buildTwoWorldGroups(worldA, worldB).forEach((levels, groupIndex) => {
    if (picks.length >= remaining) return;
    if (coveredGroupIndices.has(groupIndex)) return;
    takePick(pickOne(levels, pool, usedIds, marketCounts, page));
  });

  const need4 = !coveredGroupIndices.has(4) && picks.length < remaining;
  const need5 = !coveredGroupIndices.has(5) && picks.length < remaining;

  if (need4 && need5) {
    const [pick4, pick5] = pickBridgePair(worldA, worldB, pool, usedIds, marketCounts, page);
    takePick(pick4);
    if (picks.length < remaining) takePick(pick5);
  } else if (need4) {
    takePick(pickOne(buildDualBridgeSlotLevels(worldA, worldB, "arLatam", "A"), pool, usedIds, marketCounts, page));
  } else if (need5) {
    takePick(pickOne(buildDualBridgeSlotLevels(worldA, worldB, "external", "B"), pool, usedIds, marketCounts, page));
  }

  while (picks.length < remaining) {
    const candidate = pickOne([() => true], pool, usedIds, marketCounts, page);
    if (!candidate) break;
    takePick(candidate);
  }

  return picks;
}

function pickAlgorithmicSuggestions(worlds, reserved, remaining, page) {
  const excludeIds = new Set(reserved.map((entry) => entry.id));
  const pool = buildRelatedPool(worlds, excludeIds);

  if (worlds.length === 1) {
    const groups = buildOneWorldGroups(worlds[0]);
    const covered = assignReservedCoverage(reserved, (candidate) => candidateGroupsForOneWorld(candidate, worlds[0]));
    return runGroups(groups, pool, reserved, remaining, page, covered);
  }

  const [worldA, worldB] = worlds;
  const covered = assignReservedCoverage(reserved, (candidate) => candidateGroupsForTwoWorlds(candidate, worldA, worldB));
  return runTwoWorldGroups(worldA, worldB, pool, reserved, remaining, page, covered);
}

export function suggestMusicReferences(options) {
  const opts = options || {};
  const worlds = normalizeSelectedMusicWorlds(opts.worldCodes);
  if (worlds.length === 0) return [];

  const page = normalizePage(opts.page);

  const selected = resolveUniqueEntries(opts.selectedArtistIds, MAX_SELECTED_ARTISTS);
  const selectedIds = new Set(selected.map((entry) => entry.id));
  const pinnedCandidates = resolveUniqueEntries(opts.pinnedArtistIds, null).filter((entry) => !selectedIds.has(entry.id));

  const reserved = selected.slice();
  for (const entry of pinnedCandidates) {
    if (reserved.length >= MUSIC_REFERENCE_SUGGESTION_LIMIT) break;
    reserved.push(entry);
  }

  if (reserved.length >= MUSIC_REFERENCE_SUGGESTION_LIMIT) {
    return reserved.slice(0, MUSIC_REFERENCE_SUGGESTION_LIMIT);
  }

  const remaining = MUSIC_REFERENCE_SUGGESTION_LIMIT - reserved.length;
  const picks = pickAlgorithmicSuggestions(worlds, reserved, remaining, page);

  return reserved.concat(picks);
}
