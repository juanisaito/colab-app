// Reglas del ciclo de vida del pedido, en un solo lugar. El ciclo real de
// este prototipo es esperando -> con_ofertas -> propuesta_elegida ->
// reservado -> cancelado (cancelado sólo alcanzable antes de "propuesta
// elegida"; ver puedeCancelarse). "en_curso" y "finalizado" quedan
// documentados en context.md pero no existen todavía porque la sesión real
// y la liberación del pago no están implementadas — no se agregan acá.
//
// "cerrado" es el nombre anterior de "propuesta_elegida" (antes de separar
// "elegir una propuesta" de una futura confirmación real con reserva y
// pago). Un pedido guardado con ese estado legacy se trata igual que
// "propuesta_elegida" en todo el código, no sólo el resultado ya migrado
// por migrateLegacyClosedRequests — por eso esPropuestaElegida existe como
// función en vez de comparar el string en cada lugar.

export const ESTADO_LABELS = {
  esperando: "Esperando profesionales",
  con_ofertas: "Con propuestas",
  propuesta_elegida: "Propuesta elegida",
  reservado: "Reserva confirmada",
  cerrado: "Propuesta elegida",
  cancelado: "Cancelado",
};

export function esPropuestaElegida(estado) {
  return estado === "propuesta_elegida" || estado === "cerrado";
}

export function esCancelado(estado) {
  return estado === "cancelado";
}

// Todo lo que no esté cancelado sigue "en curso" en este prototipo — no hay
// todavía un estado "finalizado" real que mover a "Anteriores". "reservado"
// también cuenta como activo: todavía no existe sesión realizada ni cierre.
export function esActivo(estado) {
  return !esCancelado(estado);
}

// Un pedido "tiene profesional elegido" si ya se decidió con quién trabajar,
// esté todavía coordinando la reserva (propuesta_elegida) o ya reservado con
// la seña pagada.
export function tieneProfesionalElegido(estado) {
  return esPropuestaElegida(estado) || estado === "reservado";
}

// Regla central: sólo un pedido en "esperando" o "con_ofertas" puede recibir
// nueva actividad de productores simulados (pregunta, oferta directa,
// recuperación) o volver a "con_ofertas". Un pedido con propuesta elegida,
// reservado o cancelado nunca la recibe — evita tener que acumular
// comparaciones sueltas de "no es esto ni aquello" en cada updater.
export function puedeRecibirActividadDeProductores(estado) {
  return estado === "esperando" || estado === "con_ofertas";
}

// La política de cancelación posterior a elegir una propuesta (o a
// reservado) todavía no está definida — requiere modelar devoluciones. Hasta
// entonces, cancelar sólo está disponible antes de elegir una propuesta.
export function puedeCancelarse(estado) {
  return estado === "esperando" || estado === "con_ofertas";
}

// A new request must not be started while COLAB is explicitly waiting for
// information required to continue an existing search. Keeping this rule in
// the domain layer prevents Home from treating it as a merely visual lock.
export function requestNeedsArtistInput(request) {
  return !!request
    && puedeRecibirActividadDeProductores(request.estado)
    && request.recovery === "aclaracion";
}

// Sólo puede seguir escribiendo en la conversación con `productorName` si:
// - el pedido no está cancelado, y
// - una vez "reservado", únicamente el profesional elegido (según
//   chosenOfferId) — el resto queda como historial de sólo lectura.
// Antes de "reservado" (incluida "propuesta_elegida"), cualquier
// conversación existente puede seguir escribiendo, sujeta al límite de
// mensajes de tieneLimiteDeMensajes. Recibe la request completa (no sólo el
// estado) porque necesita mirar chosenOfferId/ofertas para saber quién es
// "el profesional elegido".
export function puedeEscribirEnConversacion(request, productorName) {
  if (!request) return false;
  if (esCancelado(request.estado)) return false;
  if (request.estado === "reservado") {
    const chosen = (request.ofertas || []).find((o) => o.id === request.chosenOfferId);
    return !!chosen && chosen.productor === productorName;
  }
  return request.estado === "esperando"
    || request.estado === "con_ofertas"
    || esPropuestaElegida(request.estado);
}

// El límite de 4 mensajes por persona rige siempre, salvo la única
// excepción: la conversación con el profesional elegido, una vez
// "reservado" (seña pagada) — ver puedeEscribirEnConversacion para si
// además puede escribir en absoluto.
export function tieneLimiteDeMensajes(request, productorName) {
  if (request.estado !== "reservado") return true;
  const chosen = (request.ofertas || []).find((o) => o.id === request.chosenOfferId);
  return !(chosen && chosen.productor === productorName);
}
