// Formato de moneda, sin dependencias — lo usan tanto ColabApp.jsx como
// app/features/booking/BookingFlow.jsx.
export function formatMoney(n) {
  return "$" + (Number(n) || 0).toLocaleString("es-AR");
}
