import React, { useState } from "react";
import { COLORS } from "../theme.js";

/* ============================================================
   Piezas visuales compartidas entre ColabApp.jsx y RootScreens.jsx.
   Viven acá (sin depender de ninguno de los dos) para que ningún módulo
   de pantallas tenga que importar del otro — ese ciclo de imports es lo
   que este archivo existe para eliminar. Sólo lo genuinamente compartido
   vive acá: no es una extracción total de estilos ni de cada elemento
   visual del prototipo.
   ============================================================ */

export function PrimaryButton({ children, onClick, disabled, full }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press"
      style={{
        background: disabled ? COLORS.surfaceAlt : COLORS.accent,
        color: disabled ? COLORS.muted : "#fff",
        border: "none",
        borderRadius: 10,
        padding: "13px 18px",
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontWeight: 700,
        fontSize: 14.5,
        width: full ? "100%" : "auto",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled, full }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press"
      style={{
        background: "transparent",
        color: disabled ? COLORS.muted : COLORS.text,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: "12px 18px",
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontWeight: 700,
        fontSize: 14.5,
        width: full ? "100%" : "auto",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function TextLink({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press"
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: disabled ? "default" : "pointer",
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 13.5,
        color: disabled ? COLORS.border : COLORS.muted,
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}
    >
      {children}
    </button>
  );
}

export function Label({ children }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 0.6, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

export const underlineInputStyle = {
  width: "100%",
  background: "transparent",
  border: "none",
  padding: "8px 0",
  color: COLORS.text,
  fontFamily: "'IBM Plex Sans', sans-serif",
  fontSize: 17,
  outline: "none",
  boxSizing: "border-box",
};

export function UnderlineField({ value, onChange, placeholder, autoFocus, onKeyDown, multiline, disabled, small, type = "text" }) {
  const [focused, setFocused] = useState(false);
  const Tag = multiline ? "textarea" : "input";
  return (
    <div>
      <Tag
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        rows={multiline ? 3 : undefined}
        type={multiline ? undefined : type}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ ...underlineInputStyle, fontSize: small ? 14.5 : 17, resize: multiline ? "none" : undefined, lineHeight: multiline ? 1.5 : undefined }}
      />
      <div style={{ height: 1, background: focused ? COLORS.accent : COLORS.border, transition: "background .15s ease" }} />
    </div>
  );
}

export function Screen({ topSlot, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 22px 0", minHeight: 20 }}>{topSlot || null}</div>
      {/* minHeight: 0 + "safe center": un flex item con flex:1 no se achica por
          debajo del alto de su contenido si no se le pone minHeight:0 — sin
          esto, una pantalla larga (ej. la lista completa de zonas) crece más
          allá de lo disponible y "centrarla" la deja por fuera del viewport,
          tapando el "‹ Atrás" de arriba sin poder scrollear para verlo. */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "safe center", padding: "0 22px 26px" }}>{children}</div>
    </div>
  );
}

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

export function ProducerPhoto({ name, width = 44, height = 44, radius = 10 }) {
  const hue = hashHue(name);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        flexShrink: 0,
        background: `radial-gradient(circle at 30% 25%, hsl(${hue},65%,42%), hsl(${(hue + 35) % 360},50%,16%) 78%)`,
      }}
    />
  );
}
