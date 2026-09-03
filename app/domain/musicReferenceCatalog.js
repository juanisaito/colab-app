// Biblioteca musical V1 (borrador de producto aprobado). Sólo datos de
// dominio y helpers puros: todavía no elige seis sugerencias, no rota
// resultados y no se conecta a la interfaz existente. Ver
// colab-biblioteca-musical-v1.md para el diseño de producto completo.

export const MUSIC_WORLDS = Object.freeze([
  Object.freeze({ code: "trap", label: "Trap" }),
  Object.freeze({ code: "rap_hiphop", label: "Rap / hip-hop" }),
  Object.freeze({ code: "reggaeton", label: "Reggaetón" }),
  Object.freeze({ code: "pop", label: "Pop" }),
  Object.freeze({ code: "rock", label: "Rock" }),
  Object.freeze({ code: "indie_alternative", label: "Indie / alternativo" }),
  Object.freeze({ code: "electronic", label: "Electrónica" }),
  Object.freeze({ code: "cumbia_tropical", label: "Cumbia / tropical" }),
]);

export const MARKETS = Object.freeze(["AR", "LATAM", "INTL"]);

export const SUGGESTION_ROLES = Object.freeze(["central", "bridge", "discovery"]);

const MUSIC_WORLD_CODES = MUSIC_WORLDS.map((world) => world.code);

function freezeEntry(entry) {
  return Object.freeze({ ...entry, secondaryTags: Object.freeze([...entry.secondaryTags]) });
}

const RAW_ENTRIES = [
  { id: "duki", name: "Duki", market: "AR", primaryWorld: "trap", secondaryTags: ["rap_hiphop", "urbano", "pop_rap"], suggestionRole: "central", curationNote: "Referencia central del trap argentino" },
  { id: "khea", name: "Khea", market: "AR", primaryWorld: "trap", secondaryTags: ["urbano", "melodic", "reggaeton"], suggestionRole: "central", curationNote: "Trap melódico y cruce urbano" },
  { id: "cazzu", name: "Cazzu", market: "AR", primaryWorld: "trap", secondaryTags: ["reggaeton", "urbano", "folk_crossover"], suggestionRole: "bridge", curationNote: "Puente entre trap latino reggaetón y búsquedas folklóricas" },
  { id: "neo_pistea", name: "Neo Pistea", market: "AR", primaryWorld: "trap", secondaryTags: ["rap_hiphop", "urbano"], suggestionRole: "central", curationNote: "Escena fundacional del trap argentino" },
  { id: "ysy_a", name: "YSY A", market: "AR", primaryWorld: "trap", secondaryTags: ["rap_hiphop", "urbano", "experimental"], suggestionRole: "central", curationNote: "Trap argentino con variación rítmica y conceptual" },
  { id: "bhavi", name: "Bhavi", market: "AR", primaryWorld: "trap", secondaryTags: ["pop", "urbano", "melodic"], suggestionRole: "bridge", curationNote: "Puente entre trap pop y canción melódica" },
  { id: "future", name: "Future", market: "INTL", primaryWorld: "trap", secondaryTags: ["rap_hiphop", "melodic"], suggestionRole: "central", curationNote: "Referencia internacional central del trap" },
  { id: "travis_scott", name: "Travis Scott", market: "INTL", primaryWorld: "trap", secondaryTags: ["rap_hiphop", "psychedelic", "electronic"], suggestionRole: "central", curationNote: "Trap internacional con producción expansiva" },
  { id: "playboi_carti", name: "Playboi Carti", market: "INTL", primaryWorld: "trap", secondaryTags: ["rap_hiphop", "experimental"], suggestionRole: "discovery", curationNote: "Referencia para vertientes minimalistas y experimentales" },
  { id: "eladio_carrion", name: "Eladio Carrión", market: "LATAM", primaryWorld: "trap", secondaryTags: ["rap_hiphop", "reggaeton", "urbano"], suggestionRole: "central", curationNote: "Puente latino entre trap rap y reggaetón" },
  { id: "wos", name: "Wos", market: "AR", primaryWorld: "rap_hiphop", secondaryTags: ["rock", "indie_alternative", "trap"], suggestionRole: "bridge", curationNote: "Puente argentino entre rap rock y canción" },
  { id: "trueno", name: "Trueno", market: "AR", primaryWorld: "rap_hiphop", secondaryTags: ["trap", "urbano", "funk"], suggestionRole: "central", curationNote: "Rap argentino contemporáneo con raíz hip-hop" },
  { id: "acru", name: "Acru", market: "AR", primaryWorld: "rap_hiphop", secondaryTags: ["trap", "lyrical"], suggestionRole: "central", curationNote: "Referencia de rap lírico argentino" },
  { id: "sara_hebe", name: "Sara Hebe", market: "AR", primaryWorld: "rap_hiphop", secondaryTags: ["punk", "cumbia_tropical", "electronic"], suggestionRole: "bridge", curationNote: "Cruce entre rap punk cumbia y electrónica" },
  { id: "dillom", name: "Dillom", market: "AR", primaryWorld: "rap_hiphop", secondaryTags: ["trap", "indie_alternative", "rock", "experimental"], suggestionRole: "bridge", curationNote: "Puente fuerte para combinaciones de trap y alternativo" },
  { id: "ca7riel_paco", name: "CA7RIEL & Paco Amoroso", market: "AR", primaryWorld: "rap_hiphop", secondaryTags: ["funk", "electronic", "pop", "trap"], suggestionRole: "bridge", curationNote: "Cruce argentino entre rap funk electrónica y pop" },
  { id: "milo_j", name: "Milo J", market: "AR", primaryWorld: "rap_hiphop", secondaryTags: ["trap", "folk_crossover", "melodic"], suggestionRole: "bridge", curationNote: "Puente entre urbano canción y raíz folklórica" },
  { id: "kendrick_lamar", name: "Kendrick Lamar", market: "INTL", primaryWorld: "rap_hiphop", secondaryTags: ["alternative", "funk", "jazz_crossover"], suggestionRole: "central", curationNote: "Referencia internacional de rap autoral" },
  { id: "tyler_creator", name: "Tyler, the Creator", market: "INTL", primaryWorld: "rap_hiphop", secondaryTags: ["indie_alternative", "pop", "experimental"], suggestionRole: "bridge", curationNote: "Puente internacional entre rap pop y alternativo" },
  { id: "little_simz", name: "Little Simz", market: "INTL", primaryWorld: "rap_hiphop", secondaryTags: ["indie_alternative", "soul", "electronic"], suggestionRole: "discovery", curationNote: "Rap alternativo con cruces de soul y electrónica" },
  { id: "bad_bunny", name: "Bad Bunny", market: "LATAM", primaryWorld: "reggaeton", secondaryTags: ["trap", "pop", "urbano"], suggestionRole: "central", curationNote: "Referencia central del reggaetón y trap latino contemporáneo" },
  { id: "feid", name: "Feid", market: "LATAM", primaryWorld: "reggaeton", secondaryTags: ["pop", "urbano", "melodic"], suggestionRole: "central", curationNote: "Reggaetón melódico contemporáneo" },
  { id: "karol_g", name: "Karol G", market: "LATAM", primaryWorld: "reggaeton", secondaryTags: ["pop", "urbano"], suggestionRole: "central", curationNote: "Cruce masivo entre reggaetón y pop latino" },
  { id: "rauw_alejandro", name: "Rauw Alejandro", market: "LATAM", primaryWorld: "reggaeton", secondaryTags: ["pop", "electronic", "rnb_soul"], suggestionRole: "bridge", curationNote: "Puente entre reggaetón pop R&B y electrónica" },
  { id: "j_balvin", name: "J Balvin", market: "LATAM", primaryWorld: "reggaeton", secondaryTags: ["pop", "urbano", "electronic"], suggestionRole: "central", curationNote: "Referencia global del reggaetón contemporáneo" },
  { id: "daddy_yankee", name: "Daddy Yankee", market: "LATAM", primaryWorld: "reggaeton", secondaryTags: ["rap_hiphop", "urbano", "legacy"], suggestionRole: "central", curationNote: "Referencia histórica del reggaetón" },
  { id: "wisin_y_yandel", name: "Wisin & Yandel", market: "LATAM", primaryWorld: "reggaeton", secondaryTags: ["urbano", "legacy"], suggestionRole: "central", curationNote: "Referencia de dúo y reggaetón de otra generación" },
  { id: "jowell_y_randy", name: "Jowell & Randy", market: "LATAM", primaryWorld: "reggaeton", secondaryTags: ["urbano", "legacy", "perreo"], suggestionRole: "discovery", curationNote: "Vertiente de perreo y reggaetón clásico" },
  { id: "young_miko", name: "Young Miko", market: "LATAM", primaryWorld: "reggaeton", secondaryTags: ["trap", "rap_hiphop", "urbano"], suggestionRole: "bridge", curationNote: "Puente entre reggaetón trap y rap latino" },
  { id: "maria_becerra", name: "María Becerra", market: "AR", primaryWorld: "reggaeton", secondaryTags: ["pop", "urbano", "cumbia_tropical"], suggestionRole: "bridge", curationNote: "Referencia argentina de pop urbano y reggaetón" },
  { id: "emilia", name: "Emilia", market: "AR", primaryWorld: "pop", secondaryTags: ["reggaeton", "urbano", "electronic"], suggestionRole: "bridge", curationNote: "Pop argentino con cruces urbanos y electrónicos" },
  { id: "tini", name: "TINI", market: "AR", primaryWorld: "pop", secondaryTags: ["reggaeton", "urbano", "dance"], suggestionRole: "central", curationNote: "Pop argentino contemporáneo con cruces latinos" },
  { id: "lali", name: "Lali", market: "AR", primaryWorld: "pop", secondaryTags: ["dance", "electronic", "rock"], suggestionRole: "bridge", curationNote: "Pop argentino escénico con cruces electrónicos y rock" },
  { id: "miranda", name: "Miranda!", market: "AR", primaryWorld: "pop", secondaryTags: ["electronic", "synthpop"], suggestionRole: "central", curationNote: "Referencia argentina de pop electrónico" },
  { id: "zoe_gotusso", name: "Zoe Gotusso", market: "AR", primaryWorld: "pop", secondaryTags: ["indie_alternative", "acoustic", "songwriter"], suggestionRole: "bridge", curationNote: "Puente entre pop canción e indie" },
  { id: "conociendo_rusia", name: "Conociendo Rusia", market: "AR", primaryWorld: "pop", secondaryTags: ["rock", "indie_alternative", "songwriter"], suggestionRole: "bridge", curationNote: "Cruce argentino de pop rock y canción" },
  { id: "billie_eilish", name: "Billie Eilish", market: "INTL", primaryWorld: "pop", secondaryTags: ["indie_alternative", "electronic", "experimental"], suggestionRole: "bridge", curationNote: "Pop minimalista con producción alternativa" },
  { id: "dua_lipa", name: "Dua Lipa", market: "INTL", primaryWorld: "pop", secondaryTags: ["dance", "electronic", "disco"], suggestionRole: "central", curationNote: "Referencia internacional de pop bailable" },
  { id: "the_weeknd", name: "The Weeknd", market: "INTL", primaryWorld: "pop", secondaryTags: ["rnb_soul", "electronic", "synthpop"], suggestionRole: "bridge", curationNote: "Puente entre pop R&B y electrónica" },
  { id: "rosalia", name: "ROSALÍA", market: "INTL", primaryWorld: "pop", secondaryTags: ["reggaeton", "experimental", "flamenco_crossover", "electronic"], suggestionRole: "bridge", curationNote: "Cruce internacional entre pop urbano y experimentación" },
  { id: "soda_stereo", name: "Soda Stereo", market: "AR", primaryWorld: "rock", secondaryTags: ["pop", "indie_alternative", "new_wave", "legacy"], suggestionRole: "central", curationNote: "Referencia central del rock argentino y latinoamericano" },
  { id: "charly_garcia", name: "Charly García", market: "AR", primaryWorld: "rock", secondaryTags: ["pop", "songwriter", "experimental", "legacy"], suggestionRole: "central", curationNote: "Referencia histórica de rock canción y experimentación" },
  { id: "spinetta", name: "Luis Alberto Spinetta", market: "AR", primaryWorld: "rock", secondaryTags: ["jazz_crossover", "songwriter", "experimental", "legacy"], suggestionRole: "central", curationNote: "Referencia histórica de canción y sofisticación armónica" },
  { id: "los_redondos", name: "Patricio Rey y sus Redonditos de Ricota", market: "AR", primaryWorld: "rock", secondaryTags: ["indie_alternative", "legacy"], suggestionRole: "central", curationNote: "Referencia central del rock argentino" },
  { id: "divididos", name: "Divididos", market: "AR", primaryWorld: "rock", secondaryTags: ["folk_crossover", "funk", "legacy"], suggestionRole: "bridge", curationNote: "Puente entre rock funk y raíz argentina" },
  { id: "airbag", name: "Airbag", market: "AR", primaryWorld: "rock", secondaryTags: ["pop", "hard_rock"], suggestionRole: "central", curationNote: "Rock argentino contemporáneo de alcance masivo" },
  { id: "eruca_sativa", name: "Eruca Sativa", market: "AR", primaryWorld: "rock", secondaryTags: ["indie_alternative", "hard_rock"], suggestionRole: "discovery", curationNote: "Rock alternativo argentino contemporáneo" },
  { id: "nirvana", name: "Nirvana", market: "INTL", primaryWorld: "rock", secondaryTags: ["indie_alternative", "grunge", "legacy"], suggestionRole: "central", curationNote: "Referencia internacional de rock alternativo" },
  { id: "foo_fighters", name: "Foo Fighters", market: "INTL", primaryWorld: "rock", secondaryTags: ["indie_alternative", "hard_rock"], suggestionRole: "central", curationNote: "Rock internacional contemporáneo de banda" },
  { id: "paramore", name: "Paramore", market: "INTL", primaryWorld: "rock", secondaryTags: ["pop", "indie_alternative", "pop_punk"], suggestionRole: "bridge", curationNote: "Puente entre rock alternativo pop y punk" },
  { id: "el_mato", name: "Él Mató a un Policía Motorizado", market: "AR", primaryWorld: "indie_alternative", secondaryTags: ["rock", "noise_pop"], suggestionRole: "central", curationNote: "Referencia central del indie argentino" },
  { id: "bandalos_chinos", name: "Bandalos Chinos", market: "AR", primaryWorld: "indie_alternative", secondaryTags: ["pop", "funk", "synthpop"], suggestionRole: "bridge", curationNote: "Puente argentino entre indie pop funk y sintetizadores" },
  { id: "usted_senalemelo", name: "Usted Señálemelo", market: "AR", primaryWorld: "indie_alternative", secondaryTags: ["rock", "pop", "psychedelic"], suggestionRole: "central", curationNote: "Indie argentino con psicodelia y canción" },
  { id: "marilina_bertoldi", name: "Marilina Bertoldi", market: "AR", primaryWorld: "indie_alternative", secondaryTags: ["rock", "pop", "songwriter"], suggestionRole: "bridge", curationNote: "Puente entre rock alternativo pop y canción" },
  { id: "juana_aguirre", name: "Juana Aguirre", market: "AR", primaryWorld: "indie_alternative", secondaryTags: ["folk_crossover", "electronic", "songwriter"], suggestionRole: "discovery", curationNote: "Canción alternativa con textura electrónica y acústica" },
  { id: "las_ligas_menores", name: "Las Ligas Menores", market: "AR", primaryWorld: "indie_alternative", secondaryTags: ["rock", "noise_pop"], suggestionRole: "central", curationNote: "Indie rock argentino de guitarras" },
  { id: "tame_impala", name: "Tame Impala", market: "INTL", primaryWorld: "indie_alternative", secondaryTags: ["rock", "electronic", "psychedelic", "pop"], suggestionRole: "bridge", curationNote: "Puente internacional entre psicodelia pop y electrónica" },
  { id: "the_strokes", name: "The Strokes", market: "INTL", primaryWorld: "indie_alternative", secondaryTags: ["rock", "garage"], suggestionRole: "central", curationNote: "Referencia internacional de indie rock" },
  { id: "clairo", name: "Clairo", market: "INTL", primaryWorld: "indie_alternative", secondaryTags: ["pop", "bedroom_pop", "songwriter"], suggestionRole: "discovery", curationNote: "Puente entre indie íntimo pop y canción" },
  { id: "beach_house", name: "Beach House", market: "INTL", primaryWorld: "indie_alternative", secondaryTags: ["dream_pop", "electronic"], suggestionRole: "discovery", curationNote: "Referencia de dream pop y atmósfera" },
  { id: "hernan_cattaneo", name: "Hernán Cattáneo", market: "AR", primaryWorld: "electronic", secondaryTags: ["progressive_house", "club"], suggestionRole: "central", curationNote: "Referencia argentina de electrónica y progressive house" },
  { id: "peces_raros", name: "Peces Raros", market: "AR", primaryWorld: "electronic", secondaryTags: ["indie_alternative", "rock", "live_electronic"], suggestionRole: "bridge", curationNote: "Puente argentino entre electrónica indie y formato banda" },
  { id: "chancha_via_circuito", name: "Chancha Vía Circuito", market: "AR", primaryWorld: "electronic", secondaryTags: ["folk_crossover", "cumbia_tropical", "experimental"], suggestionRole: "bridge", curationNote: "Cruce entre electrónica folclore y ritmos latinoamericanos" },
  { id: "tayhana", name: "Tayhana", market: "AR", primaryWorld: "electronic", secondaryTags: ["club", "experimental", "urbano"], suggestionRole: "discovery", curationNote: "Electrónica de club con cruces urbanos y experimentales" },
  { id: "lucca_saettone", name: "Lucca Saettone", market: "AR", primaryWorld: "electronic", secondaryTags: ["afro_house", "melodic_house", "latin_electronic"], suggestionRole: "discovery", curationNote: "Nueva electrónica argentina de cruce latino" },
  { id: "ezequiel_arias", name: "Ezequiel Arias", market: "AR", primaryWorld: "electronic", secondaryTags: ["progressive_house", "melodic_house"], suggestionRole: "discovery", curationNote: "Producción argentina de progressive y melodic house" },
  { id: "fred_again", name: "Fred again..", market: "INTL", primaryWorld: "electronic", secondaryTags: ["house", "pop", "ambient"], suggestionRole: "central", curationNote: "Electrónica contemporánea entre club canción y ambient" },
  { id: "disclosure", name: "Disclosure", market: "INTL", primaryWorld: "electronic", secondaryTags: ["house", "pop", "rnb_soul"], suggestionRole: "central", curationNote: "Puente entre house pop y R&B" },
  { id: "kaytranada", name: "KAYTRANADA", market: "INTL", primaryWorld: "electronic", secondaryTags: ["rnb_soul", "rap_hiphop", "funk", "house"], suggestionRole: "bridge", curationNote: "Puente entre electrónica hip-hop R&B y funk" },
  { id: "bicep", name: "Bicep", market: "INTL", primaryWorld: "electronic", secondaryTags: ["house", "techno", "ambient"], suggestionRole: "discovery", curationNote: "Electrónica de club con dimensión melódica y atmosférica" },
  { id: "la_t_y_la_m", name: "La T y La M", market: "AR", primaryWorld: "cumbia_tropical", secondaryTags: ["cumbia_pop", "urbano"], suggestionRole: "central", curationNote: "Referencia argentina contemporánea de cumbia" },
  { id: "ke_personajes", name: "Ke Personajes", market: "AR", primaryWorld: "cumbia_tropical", secondaryTags: ["cumbia_pop", "melodic"], suggestionRole: "central", curationNote: "Cumbia argentina melódica contemporánea" },
  { id: "damas_gratis", name: "Damas Gratis", market: "AR", primaryWorld: "cumbia_tropical", secondaryTags: ["cumbia_villera", "legacy"], suggestionRole: "central", curationNote: "Referencia histórica de cumbia villera" },
  { id: "gilda", name: "Gilda", market: "AR", primaryWorld: "cumbia_tropical", secondaryTags: ["melodic", "legacy"], suggestionRole: "central", curationNote: "Referencia histórica y melódica de cumbia argentina" },
  { id: "la_delio_valdez", name: "La Delio Valdez", market: "AR", primaryWorld: "cumbia_tropical", secondaryTags: ["orchestral", "latin", "live_band"], suggestionRole: "bridge", curationNote: "Cumbia orquestal y formato de banda en vivo" },
  { id: "los_palmeras", name: "Los Palmeras", market: "AR", primaryWorld: "cumbia_tropical", secondaryTags: ["santafesina", "legacy"], suggestionRole: "central", curationNote: "Referencia histórica de cumbia santafesina" },
  { id: "l_gante", name: "L-Gante", market: "AR", primaryWorld: "cumbia_tropical", secondaryTags: ["urbano", "trap", "cumbia_420"], suggestionRole: "bridge", curationNote: "Puente argentino entre cumbia y urbano" },
  { id: "luck_ra", name: "Luck Ra", market: "AR", primaryWorld: "cumbia_tropical", secondaryTags: ["cuarteto", "pop", "urbano"], suggestionRole: "bridge", curationNote: "Cruce entre cuarteto pop y urbano" },
  { id: "los_angeles_azules", name: "Los Ángeles Azules", market: "LATAM", primaryWorld: "cumbia_tropical", secondaryTags: ["cumbia_pop", "legacy"], suggestionRole: "central", curationNote: "Referencia internacional de cumbia popular" },
  { id: "bomba_estereo", name: "Bomba Estéreo", market: "LATAM", primaryWorld: "cumbia_tropical", secondaryTags: ["electronic", "alternative", "latin"], suggestionRole: "bridge", curationNote: "Puente entre ritmos tropicales electrónica y alternativo" },
];

export const MUSIC_REFERENCE_CATALOG = Object.freeze(RAW_ENTRIES.map(freezeEntry));

// Trim + minúsculas + sin diacríticos, para comparar nombres ignorando esas
// diferencias sin tratar "Duki" y "duki " como artistas distintos.
export function normalizeArtistName(name) {
  return (name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getMusicTagsForEntry(entry) {
  return [entry.primaryWorld, ...entry.secondaryTags];
}

export function validateMusicReferenceCatalog(catalog) {
  const errors = [];

  if (!Array.isArray(catalog)) {
    return { valid: false, errors: ["El catálogo debe ser un array."] };
  }

  const seenIds = new Set();
  const seenNames = new Set();

  catalog.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      errors.push(`Entrada #${index}: debe ser un objeto.`);
      return;
    }

    const label = typeof entry.id === "string" && entry.id.trim() !== "" ? entry.id : `#${index}`;

    if (typeof entry.id !== "string" || entry.id.trim() === "") {
      errors.push(`Entrada ${label}: id vacío o inválido.`);
    } else if (seenIds.has(entry.id)) {
      errors.push(`Entrada ${label}: id duplicado "${entry.id}".`);
    } else {
      seenIds.add(entry.id);
    }

    if (typeof entry.name !== "string" || entry.name.trim() === "") {
      errors.push(`Entrada ${label}: nombre vacío o inválido.`);
    } else {
      const normalizedName = normalizeArtistName(entry.name);
      if (seenNames.has(normalizedName)) {
        errors.push(`Entrada ${label}: nombre duplicado "${entry.name}".`);
      } else {
        seenNames.add(normalizedName);
      }
    }

    if (!MARKETS.includes(entry.market)) {
      errors.push(`Entrada ${label}: mercado desconocido "${entry.market}".`);
    }

    if (!MUSIC_WORLD_CODES.includes(entry.primaryWorld)) {
      errors.push(`Entrada ${label}: mundo principal desconocido "${entry.primaryWorld}".`);
    }

    if (!SUGGESTION_ROLES.includes(entry.suggestionRole)) {
      errors.push(`Entrada ${label}: rol de sugerencia desconocido "${entry.suggestionRole}".`);
    }

    const hasValidSecondaryTags = Array.isArray(entry.secondaryTags)
      && entry.secondaryTags.length > 0
      && entry.secondaryTags.every((tag) => typeof tag === "string" && tag.trim() !== "");

    if (!hasValidSecondaryTags) {
      errors.push(`Entrada ${label}: secondaryTags debe ser un array de strings no vacíos.`);
    } else if (entry.secondaryTags.includes(entry.primaryWorld)) {
      errors.push(`Entrada ${label}: secondaryTags no puede repetir el mundo principal "${entry.primaryWorld}".`);
    }

    if (typeof entry.curationNote !== "string" || entry.curationNote.trim() === "") {
      errors.push(`Entrada ${label}: curationNote vacía.`);
    }
  });

  return { valid: errors.length === 0, errors };
}
