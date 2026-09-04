import React, { useState } from "react";
import { EDITORIAL } from "../../theme.js";
import { EditorialPrimaryButton, EditorialUnderlineField, HandDrawnArrow, DoodleSoundStars } from "../../ui/pieces.jsx";
import { MUSIC_REFERENCE_CATALOG, normalizeArtistName } from "../../domain/musicReferenceCatalog.js";
import { suggestMusicReferences, MUSIC_REFERENCE_SUGGESTION_LIMIT } from "../../domain/musicReferenceSuggestions.js";

const MAX_SELECTED_REFERENCES = 3;
const MAX_SEARCH_RESULTS = 6;

// Fila de un artista: mismo lenguaje visual que EditorialBigOption (punto
// naranja a la derecha, sin checkmarks ni fondos, divisor fino) pero sin
// pasar el nombre a minúscula — a diferencia de un género o una zona, un
// nombre propio como "CA7RIEL & Paco Amoroso" tiene que mostrarse tal cual.
function ArtistRow({ label, selected, disabled, onClick }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="press"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        minHeight: 48,
        textAlign: "left",
        background: "none",
        border: "none",
        borderBottom: `1px solid ${EDITORIAL.border}`,
        padding: "14px 2px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{ fontFamily: EDITORIAL.fontSans, fontWeight: selected ? 700 : 500, fontSize: 16, lineHeight: 1.35, color: selected ? EDITORIAL.carbon : EDITORIAL.muted }}>
        {label}
      </span>
      {selected && <span style={{ width: 7, height: 7, borderRadius: "50%", background: EDITORIAL.accent, flexShrink: 0 }} />}
    </button>
  );
}

function SecondaryTextAction({ children, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className="press"
      style={{
        background: "none",
        border: "none",
        padding: 0,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: EDITORIAL.fontSans,
        fontSize: 13.5,
        fontWeight: active ? 700 : 400,
        color: active ? EDITORIAL.accent : EDITORIAL.muted,
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}
    >
      {children}
    </button>
  );
}

function formatPinnedNote(names) {
  if (!names || names.length === 0) return null;
  if (names.length === 1) return `Incluimos a ${names[0]} porque lo mencionaste.`;
  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(", ");
  return `Incluimos a ${rest} y ${last} porque los mencionaste.`;
}

// Pantalla "¿Qué artistas debería entender el productor?". Componente de
// presentación puro: recibe los datos ya resueltos (mundos confirmados,
// menciones detectadas en el texto) y callbacks para reportar cambios de
// selección — no escribe storage, no conoce matching y nunca llama a nada
// fuera de suggestMusicReferences (el selector de dominio ya aprobado).
export default function MusicReferenceStep({
  musicWorlds,
  pinnedArtistIds,
  selectedArtistIds,
  onChangeSelectedArtistIds,
  undecided,
  onChangeUndecided,
  onContinue,
}) {
  const hasKnownWorld = Array.isArray(musicWorlds) && musicWorlds.length > 0;
  const [page, setPage] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  // La tanda visible es su propio estado: se calcula una vez al entrar (o
  // al pedir "Ver otras seis") y de ahí en más queda fija — tocar/destildar
  // un artista sólo cambia selectedArtistIds (prop del padre), nunca vuelve
  // a llamar a suggestMusicReferences ni reordena filas por su cuenta. Si
  // no hay mundo conocido arranca vacía: no hay tanda algorítmica que
  // mostrar, sólo lo que se sume después a mano desde la búsqueda.
  const [visibleEntries, setVisibleEntries] = useState(() =>
    hasKnownWorld ? suggestMusicReferences({ worldCodes: musicWorlds, selectedArtistIds, pinnedArtistIds, page: 0 }) : []
  );

  const atLimit = selectedArtistIds.length >= MAX_SELECTED_REFERENCES;

  // Selecciona o destilda `entry`. Si ya estaba visible (venga de la tanda
  // o de una búsqueda anterior), sólo cambia la selección. Si es nueva
  // (recién elegida desde búsqueda), se incorpora a la tanda visible sin
  // recalcular todo: las selecciones van primero, respetando su orden, y
  // el resto de las filas actuales sin seleccionar completa hasta el
  // límite visual de seis.
  function toggleArtist(entry) {
    const id = entry.id;
    if (undecided) onChangeUndecided(false);

    if (selectedArtistIds.includes(id)) {
      onChangeSelectedArtistIds(selectedArtistIds.filter((existing) => existing !== id));
      return;
    }
    if (selectedArtistIds.length >= MAX_SELECTED_REFERENCES) return;

    const nextSelected = [...selectedArtistIds, id];
    onChangeSelectedArtistIds(nextSelected);

    const alreadyVisible = visibleEntries.some((visible) => visible.id === id);
    if (alreadyVisible) return;

    setVisibleEntries((current) => {
      const byId = new Map([...current, entry].map((item) => [item.id, item]));
      const selectedFirst = nextSelected.map((selectedId) => byId.get(selectedId)).filter(Boolean);
      const remainingUnselected = current.filter((item) => !nextSelected.includes(item.id));
      return [...selectedFirst, ...remainingUnselected].slice(0, MUSIC_REFERENCE_SUGGESTION_LIMIT);
    });
  }

  function handleSeeOtherSix() {
    const nextPage = page + 1;
    setPage(nextPage);
    setVisibleEntries(
      hasKnownWorld ? suggestMusicReferences({ worldCodes: musicWorlds, selectedArtistIds, pinnedArtistIds, page: nextPage }) : []
    );
  }

  function toggleUndecided() {
    if (undecided) {
      onChangeUndecided(false);
      return;
    }
    onChangeUndecided(true);
    onChangeSelectedArtistIds([]);
    setSearchOpen(false);
    setQuery("");
  }

  const pinnedNamesShown = (pinnedArtistIds || [])
    .map((id) => visibleEntries.find((entry) => entry.id === id))
    .filter(Boolean)
    .map((entry) => entry.name);
  const pinnedNote = hasKnownWorld ? formatPinnedNote(pinnedNamesShown) : null;

  const trimmedQuery = query.trim();
  const searchResults = trimmedQuery
    ? MUSIC_REFERENCE_CATALOG.filter((entry) => normalizeArtistName(entry.name).includes(normalizeArtistName(trimmedQuery))).slice(0, MAX_SEARCH_RESULTS)
    : [];

  const canContinue = undecided || selectedArtistIds.length > 0;

  const mutedNoteStyle = { fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 12, lineHeight: 1.45, margin: "10px 0 0" };

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
        <h2 style={{ fontFamily: EDITORIAL.fontSans, fontWeight: 800, fontSize: 24, color: EDITORIAL.carbon, margin: 0, lineHeight: 1.25, letterSpacing: -0.2 }}>
          ¿Qué artistas debería entender el productor?
        </h2>
        <DoodleSoundStars width={42} />
      </div>
      <p style={{ fontFamily: EDITORIAL.fontSans, color: EDITORIAL.muted, fontSize: 13.5, lineHeight: 1.5, margin: "-10px 0 18px" }}>
        Elegí hasta tres para este proyecto. No significa que quieras copiarlos.
      </p>

      {hasKnownWorld ? (
        <>
          {pinnedNote && <p style={{ ...mutedNoteStyle, margin: "0 0 14px" }}>{pinnedNote}</p>}
          <div>
            {visibleEntries.map((entry) => (
              <ArtistRow
                key={entry.id}
                label={entry.name}
                selected={selectedArtistIds.includes(entry.id)}
                disabled={atLimit && !selectedArtistIds.includes(entry.id)}
                onClick={() => toggleArtist(entry)}
              />
            ))}
          </div>
          {atLimit && <p style={mutedNoteStyle}>Podés elegir hasta tres.</p>}
          <button
            onClick={handleSeeOtherSix}
            className="press"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              padding: "16px 0 0",
              cursor: "pointer",
              fontFamily: EDITORIAL.fontSans,
              fontWeight: 700,
              fontSize: 14,
              color: EDITORIAL.carbon,
            }}
          >
            <HandDrawnArrow width={20} color={EDITORIAL.accent} />
            Ver otras seis
          </button>
        </>
      ) : (
        <>
          <p style={mutedNoteStyle}>Como no elegiste un género, podés buscar una referencia o seguir sin elegir.</p>
          {visibleEntries.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {visibleEntries.map((entry) => (
                <ArtistRow
                  key={entry.id}
                  label={entry.name}
                  selected={selectedArtistIds.includes(entry.id)}
                  disabled={atLimit && !selectedArtistIds.includes(entry.id)}
                  onClick={() => toggleArtist(entry)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: hasKnownWorld ? 20 : 14 }}>
        <SecondaryTextAction active={searchOpen} onClick={() => setSearchOpen((current) => !current)}>
          Buscar otro artista
        </SecondaryTextAction>
        <SecondaryTextAction active={undecided} onClick={toggleUndecided}>
          Todavía no tengo una referencia clara
        </SecondaryTextAction>
      </div>

      {searchOpen && (
        <div style={{ marginTop: 14 }}>
          <EditorialUnderlineField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre" autoFocus small />
          {trimmedQuery && searchResults.length === 0 && (
            <p style={mutedNoteStyle}>No encontramos ese artista en esta primera biblioteca.</p>
          )}
          {searchResults.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {searchResults.map((entry) => (
                <ArtistRow
                  key={entry.id}
                  label={entry.name}
                  selected={selectedArtistIds.includes(entry.id)}
                  disabled={atLimit && !selectedArtistIds.includes(entry.id)}
                  onClick={() => toggleArtist(entry)}
                />
              ))}
            </div>
          )}
          {searchResults.length > 0 && atLimit && <p style={mutedNoteStyle}>Podés elegir hasta tres.</p>}
        </div>
      )}

      <div style={{ marginTop: 26 }}>
        <EditorialPrimaryButton full disabled={!canContinue} onClick={onContinue}>Continuar</EditorialPrimaryButton>
      </div>
    </>
  );
}
