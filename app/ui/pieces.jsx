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

export function Screen({ topSlot, children, className }) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
export function BigOption({ label, selected, disabled, onClick }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
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
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
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

export function EditorialLabel({ children }) {
  return (
    <div style={{ fontFamily: EDITORIAL.fontMono, fontSize: 11, letterSpacing: 0.6, color: EDITORIAL.muted, marginBottom: 8, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

// Variante editorial de BigOption, agregada vía una pieza compartida propia
// (no una prop en BigOption) para no tocar su render en la variante oscura
// que sigue usando el resto de la app. Misma lógica de selección/deshabilitado.
export function EditorialBigOption({ label, selected, disabled, onClick }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="press"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        borderBottom: `1px solid ${EDITORIAL.border}`,
        padding: "14px 2px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{ fontFamily: EDITORIAL.fontSans, fontWeight: selected ? 700 : 500, fontSize: 16.5, color: selected ? EDITORIAL.carbon : EDITORIAL.muted }}>
        {lowerFirstLabel(label)}
      </span>
      {selected && <span style={{ width: 7, height: 7, borderRadius: "50%", background: EDITORIAL.accent, flexShrink: 0 }} />}
    </button>
  );
}

// Botón "volver" icon-only del flujo editorial: flecha real en vez del texto
// "‹ Atrás". Área táctil de 44×44 aunque el ícono sea más chico, sin cambiar
// la navegación — sólo envuelve el mismo onClick que antes recibía el link.
export function EditorialBackButton({ onClick, disabled, color = EDITORIAL.carbon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Volver"
      className="press"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        margin: "-10px 0 -10px -12px",
        background: "none",
        border: "none",
        padding: 0,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 5 L8 12 L15 19" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// Icono geométrico simple (no doodle a mano) para la acción principal de
// ubicación — un pin de trazo fino, no ilustrativo.
export function LocationPinIcon({ size = 18, color = EDITORIAL.carbon }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 21c4-4.5 7-8.14 7-11.5A7 7 0 0 0 5 9.5C5 12.86 8 16.5 12 21Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.4" stroke={color} strokeWidth={1.6} />
    </svg>
  );
}

// Chevron para acciones secundarias que expanden una lista debajo (mismo
// trazo que EditorialBackButton/EditorialCircleArrowButton, apuntando a la
// derecha por defecto y rotado cuando la lista que abren ya está abierta.
export function ChevronIcon({ direction = "right", size = 16, color = EDITORIAL.carbon }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, transform: direction === "down" ? "rotate(90deg)" : "none", transition: "transform .15s ease" }}
    >
      <path d="M9 5 L16 12 L9 19" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Acción circular de "seguir" para compositores de un solo campo (texto
// libre o nombre): reemplaza el botón de texto "Continuar" de esos casos
// puntuales por una flecha real, alineada al extremo derecho de la línea
// del campo en vez de ocupar una fila propia. Carbón mientras el valor no
// es válido (o está deshabilitado por otro motivo, ej. guardando), naranja
// apenas es válido — un único criterio (disabled) decide el color.
export function EditorialCircleArrowButton({ onClick, disabled, ariaLabel = "Seguir", color = EDITORIAL.carbon, activeColor = EDITORIAL.accent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="press"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: "50%",
        background: disabled ? color : activeColor,
        border: "none",
        padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 5 L16 12 L9 19" stroke={EDITORIAL.bg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// Flecha de envío dibujada a mano — la excepción deliberada al lenguaje
// geométrico del resto de los controles funcionales (ver EditorialBackButton,
// EditorialCircleArrowButton, ChevronIcon): sin círculo, pastilla ni fondo
// sólido, trazo levemente irregular como si estuviera hecha con marcador.
// Sólo para el envío de "¿Qué querés hacer?" (StartScreen y
// RequestComposer) — no reemplaza ningún otro botón existente.
export function EditorialHandDrawnSubmitButton({ onClick, disabled, ariaLabel = "Enviar", disabledColor = EDITORIAL.border, activeColor = EDITORIAL.accent }) {
  const strokeColor = disabled ? disabledColor : activeColor;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="press"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 48,
        height: 44,
        flexShrink: 0,
        background: "transparent",
        border: "none",
        borderRadius: 0,
        padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <svg width="38" height="26" viewBox="0 0 52 34" fill="none" aria-hidden="true">
        <path d="M3 19 C 14 22, 27 20, 40 15" stroke={strokeColor} strokeWidth={2.1} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke .15s ease" }} />
        <path d="M40 15 L28.5 10.5" stroke={strokeColor} strokeWidth={2.1} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke .15s ease" }} />
        <path d="M40 15 L32 23.5" stroke={strokeColor} strokeWidth={2.1} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke .15s ease" }} />
      </svg>
    </button>
  );
}

// Tres puntos que pulsan suavemente mientras COLAB interpreta un pedido — no
// un spinner genérico. La animación sólo corre mientras el estado "busy" que
// la muestra está activo; con prefers-reduced-motion queda estática (ver
// .thinking-dot en el <style> global de ColabApp.jsx).
export function EditorialThinkingDots({ color = EDITORIAL.muted }) {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", gap: 4, alignItems: "center", verticalAlign: "middle" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="thinking-dot"
          style={{ width: 5, height: 5, borderRadius: "50%", background: color, animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

/* ============================================================
   Doodles editoriales — trazo manual simple, mayormente carbón, como
   máximo un detalle en naranja por dibujo. SVG propio (no imágenes),
   currentColor donde no se fuerza un color puntual para poder recolorearse
   cuando exista dark mode, aria-hidden porque son decorativos. Máximo un
   doodle por pantalla, nunca dentro de cada opción individual.
   ============================================================ */

// Modalidad: caminos que se separan. A propósito muy asimétricos (ángulo,
// largo y curvatura bien distintos entre ramas, tronco con su propio
// quiebre) para que no se lea como una letra Y prolija.
export function DoodlePathsDiverging({ width = 44, color = EDITORIAL.carbon, className, style }) {
  const h = Math.round(width * 0.8);
  return (
    <svg width={width} height={h} viewBox="0 0 60 48" className={className} style={style} aria-hidden="true">
      <path d="M34 46 C 29 39, 33 33, 26 27" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M26 27 C 19 23, 11 21, 3 14" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <path d="M26 27 C 32 16, 41 10, 55 5" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Ubicación y horario: pin + reloj, levemente inclinado. El detalle en
// naranja son las agujas.
export function DoodlePinClock({ width = 44, color = EDITORIAL.carbon, accent = EDITORIAL.accent, className, style }) {
  const h = Math.round(width * 0.85);
  return (
    <svg width={width} height={h} viewBox="0 0 60 52" className={className} style={style} aria-hidden="true">
      <path
        d="M19 6 C 10 6, 5 13, 5 21 C 5 32, 19 47, 20 48 C 21 47, 35 32, 35 20 C 35 12, 28 6, 19 6 Z"
        stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
      <ellipse cx="19.5" cy="20.5" rx="5.6" ry="5.1" stroke={color} strokeWidth={1.6} fill="none" />
      <circle cx="43" cy="34" r="12" stroke={color} strokeWidth={1.8} fill="none" transform="rotate(-4 43 34)" />
      <path d="M43 28 L42.5 34 L49 37" stroke={accent} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Referencias: waveform de trazo manual — alturas, separación y línea base
// irregulares a propósito para que no se lea como un ecualizador digital.
export function DoodleWaveform({ width = 48, color = EDITORIAL.carbon, accent = EDITORIAL.accent, className, style }) {
  const h = Math.round(width * 0.5);
  const bars = [
    { h: 9, dy: 1, w: 2.8 }, { h: 17, dy: -1, w: 3.1 }, { h: 24, dy: 1.5, w: 2.7 }, { h: 14, dy: -2, w: 3 },
    { h: 28, dy: 0.5, w: 3.2 }, { h: 12, dy: 1, w: 2.8 }, { h: 19, dy: -1.5, w: 3 }, { h: 8, dy: 2, w: 2.7 },
  ];
  const gaps = [5, 6.2, 4.4, 5.6, 4.8, 6, 4.6];
  let x = 4;
  const maxH = Math.max(...bars.map((b) => b.h));
  return (
    <svg width={width} height={h} viewBox="0 0 66 32" className={className} style={style} aria-hidden="true">
      {bars.map((bar, i) => {
        const cx = x;
        x += bar.w + (gaps[i] ?? 5);
        return (
          <line
            key={i}
            x1={cx} y1={16 - bar.h / 2 + bar.dy}
            x2={cx} y2={16 + bar.h / 2 + bar.dy}
            stroke={bar.h === maxH ? accent : color}
            strokeWidth={bar.w}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

// Géneros: un par de estrellitas asimétricas, garabato sonoro, una apenas
// inclinada. Una lleva el detalle naranja.
export function DoodleSoundStars({ width = 42, color = EDITORIAL.carbon, accent = EDITORIAL.accent, className, style }) {
  const h = Math.round(width * 0.76);
  return (
    <svg width={width} height={h} viewBox="0 0 56 42" className={className} style={style} aria-hidden="true">
      <path d="M16 4 L18.5 15 L30 18 L18.5 21.5 L16 32 L13.5 21 L2 18 L13 14.5 Z" stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
      <path d="M43 14 L44.5 21 L52 23.5 L45 25 L43 32 L41.5 24.5 L34 22.5 L41 21 Z" stroke={accent} strokeWidth={1.6} fill="none" strokeLinejoin="round" transform="rotate(6 43 23)" />
    </svg>
  );
}

// Resumen: check imperfecto, un solo trazo asimétrico. Naranja completo —
// es el gesto de confirmación justo antes de la acción principal.
export function DoodleCheck({ width = 34, color = EDITORIAL.accent, className, style }) {
  const h = Math.round(width * 0.76);
  return (
    <svg width={width} height={h} viewBox="0 0 44 34" className={className} style={style} aria-hidden="true">
      <path d="M3 17 C 8 23, 12 27.5, 15 30 C 21 20.5, 27 11, 41 3.5" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Aclaración: globo de diálogo incompleto (le falta un tramo del contorno)
// con una leve inclinación manual, sugiriendo un pensamiento sin cerrar.
export function DoodleSpeechBubble({ width = 42, color = EDITORIAL.carbon, className, style }) {
  const h = Math.round(width * 0.83);
  return (
    <svg width={width} height={h} viewBox="0 0 52 43" className={className} style={style} aria-hidden="true">
      <g transform="rotate(-2 26 21)">
        <path
          d="M8 6 C 3 6, 3 11, 3 15 L 3 22 C 3 26, 3 31, 10 31 L 14 31 L 12 40 L 22 31"
          stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
        <path d="M27 31 L 41 31 C 47 31, 49 27, 49 22 L 49 15 C 49 10, 47 6, 41 6 L 20 6" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeDasharray="5 6" />
      </g>
    </svg>
  );
}
