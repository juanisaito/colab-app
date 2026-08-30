/* ---------------- precio: producerAmount vs artistFinalPrice (punto 4) ----------------
   La fórmula real de COLAB (comisión, procesamiento, impuestos) sigue abierta —
   esto NO es una decisión de negocio, es un valor simulado para que el
   prototipo tenga un número que mostrar. Reemplazar esta función el día que
   exista la fórmula real modelada con el equipo. */
const SIMULATED_PRICING_CONFIG = {
  status: "simulado — fórmula real de COLAB todavía no definida",
  commissionRateForPrototypeOnly: 0.10,
};

export function calculateArtistFinalPrice(producerAmount) {
  const { commissionRateForPrototypeOnly } = SIMULATED_PRICING_CONFIG;
  return Math.round((producerAmount * (1 + commissionRateForPrototypeOnly)) / 100) * 100;
}
