import { uid } from "../lib/id.js";
import { timeSlotsMatch } from "./timeSlots.js";

/* ---------------- datos simulados de productores ---------------- */

export const OFFER_POOL = {
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
      experiencia: ["Grabación de voces — EP independiente, 2025", "Grabación de coros — separata para banda tributo, 2024"],
      equipo: ["Neumann U87", "Interfaz Universal Audio Apollo Twin", "Preamplificador Neve 1073 (réplica)", "Monitores Yamaha HS8"],
      espacioFotos: ["Cabina de grabación", "Sala de control", "Rack de outboard"],
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
      experiencia: ["Grabación y producción — single 'Marea'"],
      equipo: ["Micrófono AKG C414", "Interfaz Focusrite Scarlett 18i20", "Tratamiento acústico a medida"],
      espacioFotos: ["Sala principal", "Zona de escucha", "Detalle del tratamiento acústico", "Cabina vocal"],
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
      experiencia: ["Grabación de banda — LP 'Marte', 2024", "Grabación en vivo — sesión acústica para EP compilado, 2023"],
      equipo: ["Consola Allen & Heath", "Set de microfonía para batería (Shure/AKG)", "Amplificadores de guitarra propios"],
      espacioFotos: ["Sala de ensayo/grabación", "Zona de amplificadores"],
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
      experiencia: ["Producción — EP fusión trap/rock, 2024"],
      equipo: ["Estación MIDI con controlador Native Instruments", "Monitores Adam Audio T7V", "Librería de samples propia"],
      espacioFotos: ["Sala de producción", "Escritorio de trabajo"],
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
      // A propósito sin `equipo` ni `espacioFotos`: trabaja presencial pero sin
      // un estudio propio fijo para mostrar (coordina el lugar caso a caso) —
      // sirve además para probar que OfferDetail oculta esas secciones del
      // todo cuando no hay datos, sin dejar un placeholder vacío.
      experiencia: ["Producción — single 'Ya no vuelvo', 2025"],
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
      experiencia: ["Mezcla — 'Horizonte', lanzamiento independiente"],
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
      experiencia: ["Mezcla — mixtape independiente, 2025", "Mezcla — EP colaborativo urbano, 2024"],
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
      // Sin `equipo`/`espacioFotos`: zona "A coordinar" — no tiene un espacio
      // propio fijo, trabaja en el lugar del evento.
      experiencia: ["Operación de sonido — ciclo de bares, 2025"],
      unidad: "Servicio puntual",
      incluye: "Armado, operación y desarme de equipo",
      producerAmount: 40000,
      propuesta: "Hago sonido en vivo hace 6 años, cubro shows chicos y medianos de cualquier estilo. Contame más del evento y coordinamos.",
      confianza: ["Identidad verificada", "Referencias verificadas"],
    },
  ],
};

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

  if (!timeSlotsMatch(context, productor.franjas)) return false;

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
export function pickProducers(tipo, generos, context = {}) {
  const pool = OFFER_POOL[tipo] || OFFER_POOL.especial;
  const compatibleByContext = pool.filter((producer) => producerMatchesContext(producer, context));
  const matched = !generos || generos.length === 0
    ? compatibleByContext
    : compatibleByContext.filter((producer) => producer.generos.some((genre) => generos.includes(genre)));
  return { productores: matched.slice(0, 4), ampliado: false };
}

export function getCuratedAlternatives(requestData) {
  const pool = OFFER_POOL[requestData.tipo] || OFFER_POOL.especial;
  return pool.filter((producer) => producerMatchesContext(producer, requestData)).slice(0, 2);
}

// Punto 1: cada productor simulado elige un camino, no siempre pregunta primero.
const PRODUCER_PATHS = [
  { path: "pregunta", weight: 0.4 },
  { path: "oferta_directa", weight: 0.35 },
  { path: "ahora_no", weight: 0.25 },
];
export function pickProducerPath() {
  const r = Math.random();
  let acc = 0;
  for (const { path, weight } of PRODUCER_PATHS) {
    acc += weight;
    if (r <= acc) return path;
  }
  return "pregunta";
}

// Bloque 4: pickProducerPath es 100% azar, lo que significa que un recorrido
// manual (o de demo) puede terminar mostrando sólo pregunta primero, sólo
// oferta directa, o ninguna de las dos — no hay forma de verificar "las dos
// clases de contacto existen" sin repetir la corrida hasta tener suerte.
// pickProducerPathForSlot no reemplaza el azar en general: sólo fija la
// primera posición del pool matcheado en "pregunta" y, si hay al menos dos
// productores, la segunda en "oferta_directa" — el resto de las posiciones
// sigue usando pickProducerPath tal cual. Alcanza para que cualquier pedido
// con al menos un productor matcheado produzca de forma reproducible las dos
// clases de contacto (cuando hay dos o más productores) sin tocar los pesos
// ni el resto de la lógica de matching.
export function pickProducerPathForSlot(index, total) {
  if (index === 0) return "pregunta";
  if (index === 1 && total >= 2) return "oferta_directa";
  return pickProducerPath();
}

export function buildOfferFrom(producerData) {
  const { productor, zona, modalidadTipo, disponibilidad, spotifyConnected, topArtists, trabajo, experiencia, equipo, espacioFotos, unidad, incluye, producerAmount, propuesta, confianza } = producerData;
  // `experiencia` (lista) es el campo vigente; `trabajo` (string suelto) es
  // el campo previo a este bloque — se sigue aceptando acá por si algo
  // todavía construye una oferta con esa forma antigua, envolviéndolo en un
  // array de un solo elemento. Las ofertas ya guardadas en storage desde
  // antes de este bloque conservan `trabajo` tal cual (no vuelven a pasar
  // por acá) — OfferDetail sabe leer las dos formas.
  const experienciaFinal = experiencia || (trabajo ? [trabajo] : undefined);
  return {
    id: uid(), productor, zona, modalidadTipo, disponibilidad, spotifyConnected, topArtists,
    experiencia: experienciaFinal, equipo, espacioFotos,
    unidad, incluye, producerAmount, propuesta, confianza, createdAt: new Date().toISOString(),
  };
}

export function findProducerByName(name) {
  return Object.values(OFFER_POOL).flat().find((producer) => producer.productor === name) || null;
}
