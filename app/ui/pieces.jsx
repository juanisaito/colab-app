import React, { useState } from "react";
import { COLORS, EDITORIAL } from "../theme.js";

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

function lowerFirstLabel(label) {
  if (typeof label !== "string" || !label) return label;
  return label.toLocaleLowerCase("es-AR");
}

// Fila de opción grande (modalidad, ubicación, franja, géneros, horarios de
// reserva…): texto en minúscula con un punto azul cuando está seleccionada.
export function BigOption({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className="press"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        borderBottom: `1px solid ${COLORS.border}`,
        padding: "14px 2px",
        cursor: "pointer",
      }}
    >
      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: selected ? 700 : 500, fontSize: 16.5, color: selected ? COLORS.text : COLORS.muted }}>
        {lowerFirstLabel(label)}
      </span>
      {selected && <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.accent, flexShrink: 0 }} />}
    </button>
  );
}

/* ============================================================
   Piloto visual "estudio editorial" — variantes nuevas y aditivas.
   Sólo las consumen Gate, RequestComposer e Inicio mientras se evalúa el
   rediseño; todas las piezas de arriba siguen intactas para el resto de
   la app. No reemplazan nada existente.
   ============================================================ */

export function EditorialPrimaryButton({ children, onClick, disabled, full }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press"
      style={{
        background: disabled ? EDITORIAL.border : EDITORIAL.accent,
        color: disabled ? EDITORIAL.muted : EDITORIAL.bg,
        border: `1px solid ${disabled ? EDITORIAL.border : EDITORIAL.accent}`,
        borderRadius: 3,
        padding: "14px 20px",
        fontFamily: EDITORIAL.fontSans,
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

export function EditorialSecondaryButton({ children, onClick, disabled, full }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press"
      style={{
        background: "transparent",
        color: disabled ? EDITORIAL.muted : EDITORIAL.carbon,
        border: `1.5px solid ${disabled ? EDITORIAL.border : EDITORIAL.carbon}`,
        borderRadius: 3,
        padding: "13px 20px",
        fontFamily: EDITORIAL.fontSans,
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

export function EditorialTextLink({ children, onClick, disabled }) {
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
        fontFamily: EDITORIAL.fontSans,
        fontSize: 13.5,
        color: disabled ? EDITORIAL.border : EDITORIAL.muted,
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}
    >
      {children}
    </button>
  );
}

export const editorialUnderlineInputStyle = {
  width: "100%",
  background: "transparent",
  border: "none",
  padding: "8px 0",
  color: EDITORIAL.carbon,
  fontFamily: EDITORIAL.fontSans,
  fontSize: 17,
  outline: "none",
  boxSizing: "border-box",
};

export function EditorialUnderlineField({ value, onChange, placeholder, autoFocus, onKeyDown, multiline, disabled, small, type = "text" }) {
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
        style={{ ...editorialUnderlineInputStyle, fontSize: small ? 14.5 : 17, resize: multiline ? "none" : undefined, lineHeight: multiline ? 1.5 : undefined }}
      />
      <div style={{ height: 1.5, background: focused ? EDITORIAL.carbon : EDITORIAL.border, transition: "background .15s ease" }} />
    </div>
  );
}

// Marca dibujada a mano — subrayado ondulado. Sólo para momentos de
// onboarding/estados hero, nunca cerca de precios o condiciones.
export function HandDrawnUnderline({ width = 130, color = EDITORIAL.carbon, style }) {
  return (
    <svg width={width} height={Math.round(width * 0.09)} viewBox="0 0 160 14" style={{ display: "block", overflow: "visible", ...style }}>
      <path d="M2 8 Q20 4 40 9 T80 7 T120 10 T158 6" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Marca dibujada a mano — flecha direccional para pistas de onboarding.
export function HandDrawnArrow({ width = 46, color = EDITORIAL.carbon, style }) {
  return (
    <svg width={width} height={Math.round(width * 0.56)} viewBox="0 0 60 40" style={{ display: "block", overflow: "visible", ...style }}>
      <path d="M4 30 Q30 34 50 14" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 14 L39 10" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 14 L44 24" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
