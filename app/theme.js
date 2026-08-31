// Constantes de color compartidas. Viven en un archivo sin dependencias
// propias a propósito: ColabApp.jsx y RootScreens.jsx se importan mutuamente
// (RootScreens usa piezas de ColabApp; ColabApp arma la navegación con
// RootScreens), y COLORS se usa en el nivel superior de ambos módulos —
// si viviera dentro de ColabApp.jsx, ese ciclo dispara un
// "Cannot access before initialization" al cargar.
export const COLORS = {
  bg: "#0B0B0C",
  surface: "#17171A",
  surfaceAlt: "#1F1F23",
  border: "#2A2A2E",
  text: "#F3F2EE",
  muted: "#8F8D91",
  accent: "#2E4BFF",
};

// Paleta "estudio editorial" en evaluación como piloto (variante B
// controlada, aprobada para Gate, RequestComposer e Inicio). Vive junto a
// COLORS sin reemplazarla: el resto de las pantallas sigue usando COLORS
// sin ningún cambio mientras se evalúa este rediseño.
export const EDITORIAL = {
  bg: "#FAF7F1",
  surface: "#F2EDE4",
  border: "#E1DCD1",
  carbon: "#1B1815",
  muted: "#8B8579",
  accent: "#C2410C",
  accentAlt: "#E15412",
  error: "#8C3A2B",
  fontMono: "'IBM Plex Mono', ui-monospace, monospace",
  fontSans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
};
