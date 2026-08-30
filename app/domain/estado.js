// Reglas del ciclo de vida del pedido, en un solo lugar. El ciclo real de
// este prototipo es esperando -> con_ofertas -> propuesta_elegida ->
// cancelado. "reservado", "en_curso" y "finalizado" quedan documentados en
// context.md pero no existen todavía porque reserva y pago no están
// implementados — no se agregan acá.
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
// todavía un estado "finalizado" real que mover a "Anteriores".
export function esActivo(estado) {
  return !esCancelado(estado);
}
