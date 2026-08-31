import React from "react";
import { COLORS, EDITORIAL } from "./theme.js";

/* Iconos de línea minimalistas, sin librería externa — mismo espíritu
   editorial del resto del prototipo (sin relleno, trazo fino). */

function HomeIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function OrdersIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7a1 1 0 0 1 1-1h4l1.6 2H19a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Z" />
    </svg>
  );
}

function MessagesIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V17H5.5A1.5 1.5 0 0 1 4 15.5v-9Z" />
    </svg>
  );
}

function ProfileIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8.3" r="3.3" />
      <path d="M5 20c.9-3.6 3.8-5.8 7-5.8s6.1 2.2 7 5.8" />
    </svg>
  );
}

export const TABS = [
  { id: "inicio", label: "Inicio", Icon: HomeIcon },
  { id: "pedidos", label: "Pedidos", Icon: OrdersIcon },
  { id: "mensajes", label: "Mensajes", Icon: MessagesIcon },
  { id: "perfil", label: "Perfil", Icon: ProfileIcon },
];

// `light` habilita la versión "estudio editorial" del nav — piloto
// limitado a la pestaña Inicio mientras se evalúa el rediseño; las demás
// pestañas siguen mostrando el nav oscuro sin ningún cambio.
export default function BottomNav({ active, onChange, light }) {
  const palette = light
    ? { bg: EDITORIAL.bg, border: EDITORIAL.border, activeColor: EDITORIAL.accent, mutedColor: EDITORIAL.muted, font: EDITORIAL.fontSans }
    : { bg: COLORS.bg, border: COLORS.border, activeColor: COLORS.accent, mutedColor: COLORS.muted, font: "'IBM Plex Sans', sans-serif" };
  return (
    <nav
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        background: palette.bg,
        borderTop: `1px solid ${palette.border}`,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        flexShrink: 0,
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        const color = isActive ? palette.activeColor : palette.mutedColor;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="press"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              padding: "10px 4px 8px",
              cursor: "pointer",
            }}
          >
            <Icon color={color} />
            <span style={{ fontFamily: palette.font, fontSize: 11, fontWeight: isActive ? 700 : 500, color }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
