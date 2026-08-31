import { normalizeTimeSlots } from "./timeSlots.js";

// Al editar un pedido y cambiar su clasificación (ej. de "grabar" a
// "mezclar"), decide qué contexto previo (modalidad, ubicación, franja
// horaria, dato faltante) sigue siendo válido y cuál hay que descartar por no
// corresponder más al nuevo tipo de pedido. Pura función de datos: no
// depende de React.
//
// previousContext puede venir en la forma nueva (`timeSlots`, array) o en la
// legada (`franja`, string suelto) si es el contexto embebido de un pedido
// viejo que se está reeditando — normalizeTimeSlots tolera las dos.
export function sanitizeContextForClassification(previousContext, previousType, nextClassification) {
  if (!previousContext) return null;
  const typeChanged = !!previousType && previousType !== nextClassification.tipo;
  const next = { ...previousContext };
  // normalizeTimeSlots canonicaliza el "mañana"/"tarde"/"noche" en minúscula
  // que devuelve el intérprete — nunca se debe propagar tal cual llega.
  const nextTimeSlot = nextClassification.timeSlot ? normalizeTimeSlots([nextClassification.timeSlot]) : [];

  if (nextClassification.tipo === "mezclar") {
    return { ...next, modalidad: "online", ubicacion: null, coordinates: null, timeSlots: [], datoFaltanteTexto: null, datoFaltanteConfirmado: false };
  }

  if (nextClassification.tipo === "grabar") {
    return {
      ...next,
      modalidad: "presencial",
      ubicacion: nextClassification.locationText || (typeChanged ? null : next.ubicacion),
      coordinates: nextClassification.locationText || typeChanged ? null : next.coordinates,
      timeSlots: nextTimeSlot.length > 0 ? nextTimeSlot : (typeChanged ? [] : normalizeTimeSlots(next)),
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
      timeSlots: needsPlace ? (nextTimeSlot.length > 0 ? nextTimeSlot : (typeChanged ? [] : normalizeTimeSlots(next))) : [],
      datoFaltanteTexto: null,
      datoFaltanteConfirmado: false,
    };
  }

  return {
    ...next,
    modalidad: nextClassification.modalidad || "presencial",
    ubicacion: nextClassification.locationText || (typeChanged ? null : next.ubicacion),
    coordinates: nextClassification.locationText || typeChanged ? null : next.coordinates,
    timeSlots: nextTimeSlot.length > 0 ? nextTimeSlot : (typeChanged ? [] : normalizeTimeSlots(next)),
    datoFaltanteTexto: typeChanged ? null : next.datoFaltanteTexto,
    datoFaltanteConfirmado: typeChanged ? false : next.datoFaltanteConfirmado,
  };
}
