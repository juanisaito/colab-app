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
