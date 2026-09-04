import React, { useState, useRef, useLayoutEffect } from "react";
import { EDITORIAL } from "../../theme.js";
import { EditorialPrimaryButton, EditorialHandDrawnSubmitButton, editorialUnderlineInputStyle, EditorialThinkingDots } from "../../ui/pieces.jsx";
import AnimatedPrompt from "../../ui/AnimatedPrompt.jsx";

const REQUEST_EXAMPLES = [
  "Quiero grabar voces",
  "Quiero producir una canción desde cero",
  "Necesito mezclar y masterizar un tema",
  "Busco un sonidista para tocar en vivo",
];

// Auto-grow: arranca en una línea y crece hasta MAX_ROWS a medida que se
// escribe, después scrollea en vez de seguir creciendo. Mide con el DOM
// real (computed line-height/padding + scrollHeight) en vez de estimar a
// mano, para que el límite de 3 líneas nunca recorte la última línea ni
// deje huecos — misma técnica que un textarea auto-resize sin dependencias.
const MAX_ROWS = 3;

function resizeComposerTextarea(el) {
  if (!el) return;
  const style = window.getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.45;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const maxHeight = lineHeight * MAX_ROWS + paddingTop + paddingBottom;
  el.style.height = "auto";
  const next = Math.min(el.scrollHeight, maxHeight);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > maxHeight + 0.5 ? "auto" : "hidden";
}

export default function RequestComposer({
  title = "¿Qué querés hacer?",
  text,
  onTextChange,
  onSubmit,
  busy = false,
  error = null,
  compact = false,
  centered = false,
  blocked = false,
  blockedMessage = null,
  onBlockedAction = null,
}) {
  const [focused, setFocused] = useState(false);
  const canSubmit = text.trim().length >= 3 && !busy && !blocked;
  // Fijo (no responsive: este código base no usa media queries en ningún
  // otro lado, ver app/index.css) pero siempre dentro de 15–16px en mobile,
  // tanto compacto como no — antes el modo centrado/no-compacto (Inicio sin
  // pedido activo, a 390px) quedaba en 17px.
  const fontSize = compact ? 15.5 : 16;
  const textareaRef = useRef(null);

  useLayoutEffect(() => {
    resizeComposerTextarea(textareaRef.current);
  }, [text, fontSize]);

  return (
    <div style={{ width: "100%", maxWidth: centered ? 340 : "none", margin: centered ? "0 auto" : 0, textAlign: centered ? "center" : "left" }}>
      <div style={{ fontFamily: EDITORIAL.fontMono, fontSize: 11, letterSpacing: 0.6, color: EDITORIAL.muted, marginBottom: 9, textTransform: "uppercase" }}>
        {title}
      </div>

      {!blocked && (
        <div style={{ position: "relative" }}>
          {/* alignItems: flex-end deja la flecha pegada a la línea de
              escritura real: como el textarea ahora crece con el contenido
              (auto-grow, hasta 3 líneas) en vez de tener una altura fija,
              "abajo de la fila" siempre coincide con la última línea
              escrita — ya no queda centrada en un bloque vacío alto. */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(event) => onTextChange(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (canSubmit) onSubmit(text.trim());
                  }
                }}
                rows={1}
                disabled={busy}
                aria-label="Contanos qué querés hacer"
                style={{
                  ...editorialUnderlineInputStyle,
                  position: "relative",
                  zIndex: 2,
                  resize: "none",
                  overflowY: "hidden",
                  // Un poco más de padding vertical que el default (8px) —
                  // así la caja de una sola línea queda casi a la misma
                  // altura que la flecha (48×44), y "alignItems: flex-end"
                  // en la fila la deja alineada con la línea real en vez de
                  // sobresalir por arriba (ver nota de alineación abajo).
                  padding: "10px 0",
                  lineHeight: 1.45,
                  fontSize,
                  textAlign: centered ? "center" : "left",
                }}
              />
              {!text && !focused && (
                <div
                  className="q-fade"
                  style={{
                    position: "absolute",
                    inset: "10px 0 auto",
                    pointerEvents: "none",
                    fontFamily: EDITORIAL.fontSans,
                    fontSize,
                    lineHeight: 1.45,
                    textAlign: centered ? "center" : "left",
                  }}
                >
                  <AnimatedPrompt examples={REQUEST_EXAMPLES} color={EDITORIAL.muted} />
                </div>
              )}
            </div>
            <EditorialHandDrawnSubmitButton disabled={!canSubmit} onClick={() => onSubmit(text.trim())} />
          </div>
          <div style={{ height: 1.5, background: focused ? EDITORIAL.carbon : EDITORIAL.border, transition: "background .15s ease" }} />
        </div>
      )}

      {blockedMessage && (
        <p id="request-composer-blocked" style={{ color: EDITORIAL.muted, fontFamily: EDITORIAL.fontSans, fontSize: 12.5, lineHeight: 1.45, margin: "12px 0 0" }}>
          {blockedMessage}
        </p>
      )}
      {!blocked && error && (
        <p style={{ color: EDITORIAL.error, fontFamily: EDITORIAL.fontSans, fontSize: 12.5, margin: "9px 0 0" }}>{error}</p>
      )}
      {!blocked && busy && (
        <p style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 12.5, margin: "9px 0 0", justifyContent: centered ? "center" : "flex-start" }}>
          Entendiendo <EditorialThinkingDots color={EDITORIAL.muted} />
        </p>
      )}

      {blocked && (
        <div style={{ display: "flex", justifyContent: centered || compact ? "center" : "stretch", marginTop: compact ? 12 : 16 }}>
          <EditorialPrimaryButton onClick={onBlockedAction}>Completar aclaración</EditorialPrimaryButton>
        </div>
      )}
    </div>
  );
}
