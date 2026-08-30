// Al editar un pedido y cambiar su clasificación (ej. de "grabar" a
// "mezclar"), decide qué contexto previo (modalidad, ubicación, franja, dato
// faltante) sigue siendo válido y cuál hay que descartar por no corresponder
// más al nuevo tipo de pedido. Pura función de datos: no depende de React.
export function sanitizeContextForClassification(previousContext, previousType, nextClassification) {
  if (!previousContext) return null;
  const typeChanged = !!previousType && previousType !== nextClassification.tipo;
  const next = { ...previousContext };

  if (nextClassification.tipo === "mezclar") {
    return { ...next, modalidad: "online", ubicacion: null, coordinates: null, franja: null, datoFaltanteTexto: null, datoFaltanteConfirmado: false };
  }

  if (nextClassification.tipo === "grabar") {
    return {
      ...next,
      modalidad: "presencial",
      ubicacion: nextClassification.locationText || (typeChanged ? null : next.ubicacion),
      coordinates: nextClassification.locationText || typeChanged ? null : next.coordinates,
      franja: nextClassification.timeSlot || (typeChanged ? null : next.franja),
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
      franja: needsPlace ? nextClassification.timeSlot || (typeChanged ? null : next.franja) : null,
      datoFaltanteTexto: null,
      datoFaltanteConfirmado: false,
    };
  }

  return {
    ...next,
    modalidad: nextClassification.modalidad || "presencial",
    ubicacion: nextClassification.locationText || (typeChanged ? null : next.ubicacion),
    coordinates: nextClassification.locationText || typeChanged ? null : next.coordinates,
    franja: nextClassification.timeSlot || (typeChanged ? null : next.franja),
    datoFaltanteTexto: typeChanged ? null : next.datoFaltanteTexto,
    datoFaltanteConfirmado: typeChanged ? false : next.datoFaltanteConfirmado,
  };
}
