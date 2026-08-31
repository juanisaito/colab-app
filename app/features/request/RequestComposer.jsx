import React, { useState } from "react";
import { EDITORIAL } from "../../theme.js";
import { EditorialPrimaryButton, editorialUnderlineInputStyle } from "../../ui/pieces.jsx";
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
  const [focused, setFocused] = useState(false);
  const canSubmit = text.trim().length >= 3 && !busy && !blocked;

  return (
    <div style={{ width: "100%", maxWidth: centered ? 340 : "none", margin: centered ? "0 auto" : 0, textAlign: centered ? "center" : "left" }}>
      <div style={{ fontFamily: EDITORIAL.fontMono, fontSize: 11, letterSpacing: 0.6, color: EDITORIAL.muted, marginBottom: 9, textTransform: "uppercase" }}>
        {title}
      </div>

      {!blocked && (
        <div style={{ position: "relative" }}>
          <textarea
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            rows={compact ? 1 : 2}
            disabled={busy}
            aria-label="Contanos qué querés hacer"
            style={{
              ...editorialUnderlineInputStyle,
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
          {!text && !focused && (
            <div
              className="q-fade"
              style={{
                position: "absolute",
                inset: "8px 0 auto",
                pointerEvents: "none",
                fontFamily: EDITORIAL.fontSans,
                fontSize: compact ? 15.5 : 17,
                lineHeight: 1.45,
                textAlign: centered ? "center" : "left",
              }}
            >
              <AnimatedPrompt examples={REQUEST_EXAMPLES} color={EDITORIAL.muted} />
            </div>
          )}
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

      <div style={{ display: "flex", justifyContent: centered || compact ? "center" : "stretch", marginTop: compact ? 12 : 16 }}>
        {blocked ? (
          <EditorialPrimaryButton full={fullButton} onClick={onBlockedAction}>Completar aclaración</EditorialPrimaryButton>
        ) : (
          <EditorialPrimaryButton full={fullButton} disabled={!canSubmit} onClick={() => onSubmit(text.trim())}>
            {busy ? "Entendiendo…" : "Continuar"}
          </EditorialPrimaryButton>
        )}
      </div>
    </div>
  );
}
