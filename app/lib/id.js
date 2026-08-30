// Generador de id local, sin dependencias — lo usan tanto componentes React
// como módulos de dominio (ej. armar una oferta simulada) que no dependen de React.
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
