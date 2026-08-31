import React from "react";
import { COLORS } from "../../theme.js";
import { PrimaryButton, underlineInputStyle } from "../../ui/pieces.jsx";
import AnimatedPrompt from "../../ui/AnimatedPrompt.jsx";

const REQUEST_EXAMPLES = [
  "Quiero grabar voces",
  "Quiero producir una canción desde cero",
  "Necesito mezclar y masterizar un tema",
  "Busco un sonidista para tocar en vivo",
];

export default function RequestComposer({
  title = "¿Qué querés hacer?",
  text,
  onTextChange,
  onSubmit,
  busy = false,
  error = null,
  compact = false,
  centered = false,
  fullButton = false,
  blocked = false,
  blockedMessage = null,
  onBlockedAction = null,
}) {
  const canSubmit = text.trim().length >= 3 && !busy && !blocked;

  return (
    <div style={{ width: "100%", maxWidth: centered ? 340 : "none", margin: centered ? "0 auto" : 0, textAlign: centered ? "center" : "left" }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 0.6, color: COLORS.muted, marginBottom: 9, textTransform: "uppercase" }}>
        {title}
      </div>

      {!blocked && (
        <div style={{ position: "relative" }}>
          <textarea
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            rows={compact ? 1 : 2}
            disabled={busy}
            aria-label="Contanos qué querés hacer"
            style={{
              ...underlineInputStyle,
              position: "relative",
              zIndex: 2,
              resize: "none",
              lineHeight: 1.45,
              minHeight: compact ? 46 : 62,
              maxHeight: compact ? 72 : 104,
              fontSize: compact ? 15.5 : 17,
              textAlign: centered ? "center" : "left",
            }}
          />
          {!text && (
            <div
              style={{
                position: "absolute",
                inset: "8px 0 auto",
                pointerEvents: "none",
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: compact ? 15.5 : 17,
                lineHeight: 1.45,
                textAlign: centered ? "center" : "left",
              }}
            >
              <AnimatedPrompt examples={REQUEST_EXAMPLES} />
            </div>
          )}
          <div style={{ height: 1, background: COLORS.border }} />
        </div>
      )}

      {blockedMessage && (
        <p id="request-composer-blocked" style={{ color: COLORS.muted, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, lineHeight: 1.45, margin: "12px 0 0" }}>
          {blockedMessage}
        </p>
      )}
      {!blocked && error && (
        <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, margin: "9px 0 0" }}>{error}</p>
      )}

      <div style={{ display: "flex", justifyContent: centered || compact ? "center" : "stretch", marginTop: compact ? 12 : 16 }}>
        {blocked ? (
          <PrimaryButton full={fullButton} onClick={onBlockedAction}>Completar aclaración</PrimaryButton>
        ) : (
          <PrimaryButton full={fullButton} disabled={!canSubmit} onClick={() => onSubmit(text.trim())}>
            {busy ? "Entendiendo…" : "Continuar"}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
