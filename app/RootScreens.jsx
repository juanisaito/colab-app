import React, { useState, useEffect } from "react";
import { COLORS } from "./theme.js";
import { Screen, Label, TextLink, PrimaryButton, UnderlineField, ProducerPhoto } from "./ui/pieces.jsx";
import { getAllRequests } from "./lib/storage.js";
import { ESTADO_LABELS, esPropuestaElegida, esActivo } from "./domain/estado.js";

/* ============================================================
   Pantallas raíz de la navegación (Inicio / Pedidos / Mensajes / Perfil)
   más las pantallas internas de Perfil (Ayuda, Privacidad, Editar nombre).
   Reutilizan las piezas de app/ui/, app/lib/storage.js y app/domain/estado.js
   — nunca importan nada del componente raíz (ColabApp.jsx). No duplican
   lógica de matching, chat ni publicación. Cada pantalla lee sus propios
   datos de localStorage con el mismo patrón de polling que ya usa
   WaitingScreen, filtrados por artista.
   ============================================================ */

const heading1 = { fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 24, color: COLORS.text, margin: "0 0 4px", lineHeight: 1.25 };
const mutedSmall = { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: COLORS.muted, lineHeight: 1.5 };

function useMyRequests(artistName) {
  const [requests, setRequests] = useState([]);
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const all = await getAllRequests();
      if (cancelled) return;
      const mine = all
        .filter((r) => r.artistName === artistName)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequests(mine);
    }
    poll();
    const iv = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [artistName]);
  return requests;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function formatWhen(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

// Misma copia que ya usa WaitingScreen para cada situación — acá solo se
// elige cuál mostrar según los datos reales del pedido, sin inventar nada.
function ultimaNovedad(r) {
  if (esPropuestaElegida(r.estado)) {
    const chosen = (r.ofertas || []).find((o) => o.id === r.chosenOfferId);
    return chosen ? `Elegiste a ${chosen.productor}. Pendiente de coordinar horario, reserva y pago.` : "Pendiente de coordinar horario, reserva y pago.";
  }
  if ((r.ofertas || []).length > 0) {
    const n = r.ofertas.length;
    return `Tenés ${n} propuesta${n > 1 ? "s" : ""} esperando tu respuesta.`;
  }
  const pendiente = (r.intereses || []).find((it) => !it.resuelto);
  if (pendiente) return `${pendiente.productor} quiere conocer mejor tu proyecto.`;
  if (r.recovery === "curada") return "Encontramos algunas opciones con horario disponible.";
  if (r.recovery === "aclaracion") return "Necesitamos una aclaración tuya para seguir buscando.";
  return r.matchAmpliado
    ? "Estamos ampliando la búsqueda a más estilos para encontrarte opciones."
    : "Estamos seleccionando profesionales que puedan encajar con lo que querés hacer.";
}

function NavRow({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="press"
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
        textAlign: "left", background: "none", border: "none", borderBottom: `1px solid ${COLORS.border}`,
        padding: "16px 2px", cursor: "pointer",
      }}
    >
      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, color: COLORS.text, fontWeight: 500 }}>{label}</span>
      <span style={{ color: COLORS.muted, fontSize: 16 }}>›</span>
    </button>
  );
}

function RootHeader({ title, children }) {
  return (
    <div style={{ padding: "22px 22px 4px" }}>
      {title && <h1 style={heading1}>{title}</h1>}
      {children}
    </div>
  );
}

/* ---------------- Inicio ---------------- */

export function HomeScreen({ artistName, onSubmit, interpreting, error, text, onTextChange, onOpenRequest }) {
  const requests = useMyRequests(artistName);
  const active = requests.find((r) => esActivo(r.estado)) || null;

  return (
    <div style={{ padding: "22px 22px 26px", display: "flex", flexDirection: "column", gap: 26 }}>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, color: COLORS.muted, margin: 0 }}>
        Hola, <span style={{ color: COLORS.text, fontWeight: 700 }}>{artistName}</span>
      </p>

      <div>
        <Label>¿Qué querés hacer?</Label>
        <UnderlineField
          multiline
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Escribí con tus palabras…"
          disabled={interpreting}
        />
        {error && <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginTop: 10 }}>{error}</p>}
        <div style={{ marginTop: 14 }}>
          <PrimaryButton full disabled={text.trim().length < 3 || interpreting} onClick={() => onSubmit(text.trim())}>
            Continuar
          </PrimaryButton>
        </div>
      </div>

      {active && (
        <div>
          <Label>En movimiento</Label>
          <button
            onClick={() => onOpenRequest(active)}
            className="press"
            style={{ width: "100%", textAlign: "left", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, cursor: "pointer" }}
          >
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 0.5, color: COLORS.accent, textTransform: "uppercase", marginBottom: 6 }}>
              {ESTADO_LABELS[active.estado]}
            </div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 14.5, color: COLORS.text, marginBottom: 5 }}>{active.resumen}</div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.muted, fontSize: 12.5, lineHeight: 1.4, margin: "0 0 10px" }}>{ultimaNovedad(active)}</p>
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.accent, fontSize: 12.5, fontWeight: 700 }}>Ver pedido ›</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Pedidos ---------------- */

function OrderRow({ request, onOpen }) {
  const chosen = esPropuestaElegida(request.estado) ? (request.ofertas || []).find((o) => o.id === request.chosenOfferId) : null;
  const hasOfertas = (request.ofertas || []).length > 0;
  const hasConversacion = (request.intereses || []).length > 0;
  return (
    <button
      onClick={() => onOpen(request)}
      className="press"
      style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: `1px solid ${COLORS.border}`, padding: "14px 2px", cursor: "pointer" }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: 0.5, color: COLORS.muted, textTransform: "uppercase", marginBottom: 5 }}>
          {ESTADO_LABELS[request.estado] || request.estado}
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 14.5, color: COLORS.text, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {request.resumen}
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: COLORS.muted }}>
          {formatDate(request.createdAt)}{chosen ? ` · ${chosen.productor}` : ""}
        </div>
        {(hasOfertas || hasConversacion) && (
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: COLORS.accent, marginTop: 4 }}>
            {hasOfertas ? `${request.ofertas.length} propuesta${request.ofertas.length > 1 ? "s" : ""}` : "Conversación en curso"}
          </div>
        )}
      </div>
      <span style={{ color: COLORS.muted, fontSize: 16, flexShrink: 0, marginTop: 2 }}>›</span>
    </button>
  );
}

export function OrdersScreen({ artistName, onOpenRequest, onCreate }) {
  const requests = useMyRequests(artistName);
  const enCurso = requests.filter((r) => esActivo(r.estado));
  const anteriores = requests.filter((r) => !esActivo(r.estado));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RootHeader title="Tus pedidos" />
      {requests.length === 0 ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "safe center", alignItems: "center", textAlign: "center", padding: "0 26px 26px" }}>
          <p style={{ ...mutedSmall, marginBottom: 18 }}>Todavía no tenés pedidos. Contale a COLAB qué querés hacer y te ayudamos a encontrar profesionales.</p>
          <PrimaryButton onClick={onCreate}>Crear un pedido</PrimaryButton>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 26px" }}>
          {enCurso.length > 0 && (
            <div style={{ marginBottom: anteriores.length > 0 ? 26 : 0 }}>
              <Label>En curso</Label>
              {enCurso.map((r) => <OrderRow key={r.id} request={r} onOpen={onOpenRequest} />)}
            </div>
          )}
          {anteriores.length > 0 && (
            <div>
              <Label>Anteriores</Label>
              {anteriores.map((r) => <OrderRow key={r.id} request={r} onOpen={onOpenRequest} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Mensajes ---------------- */

function ConversationRow({ request, interes, onOpen }) {
  const mensajes = interes.mensajes?.length
    ? interes.mensajes
    : [{ from: "productor", text: interes.pregunta, createdAt: interes.createdAt }];
  const last = mensajes[mensajes.length - 1];
  const pending = !interes.resuelto && last.from === "productor";
  const hasOferta = (request.ofertas || []).some((o) => o.productor === interes.productor);

  return (
    <button
      onClick={() => onOpen(request, interes)}
      className="press"
      style={{ display: "flex", gap: 12, width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: `1px solid ${COLORS.border}`, padding: "14px 2px", cursor: "pointer", alignItems: "flex-start" }}
    >
      <ProducerPhoto name={interes.productor} width={40} height={40} radius={9} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 14, color: COLORS.text }}>{interes.productor}</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: COLORS.muted, flexShrink: 0 }}>{formatWhen(last.createdAt)}</span>
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: COLORS.muted, margin: "2px 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {request.resumen}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {pending && <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.accent, flexShrink: 0 }} />}
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: pending ? COLORS.text : COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {last.text}
          </span>
        </div>
        {hasOferta && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: COLORS.accent, marginTop: 3 }}>Con propuesta</div>}
      </div>
    </button>
  );
}

export function MessagesScreen({ artistName, onOpenConversation, onGoToOrders }) {
  const requests = useMyRequests(artistName);
  const conversations = requests
    .flatMap((r) => (r.intereses || []).map((it) => ({ request: r, interes: it })))
    .sort((a, b) => {
      const at = a.interes.mensajes?.length ? a.interes.mensajes[a.interes.mensajes.length - 1].createdAt : a.interes.createdAt;
      const bt = b.interes.mensajes?.length ? b.interes.mensajes[b.interes.mensajes.length - 1].createdAt : b.interes.createdAt;
      return new Date(bt).getTime() - new Date(at).getTime();
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RootHeader title="Mensajes" />
      {conversations.length === 0 ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "safe center", alignItems: "center", textAlign: "center", padding: "0 26px 26px" }}>
          <p style={{ ...mutedSmall, marginBottom: 18 }}>
            Tus conversaciones van a aparecer acá cuando un profesional quiera preguntarte algo o enviarte una propuesta.
          </p>
          <TextLink onClick={onGoToOrders}>Ver tus pedidos</TextLink>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 22px 26px" }}>
          {conversations.map(({ request, interes }) => (
            <ConversationRow key={interes.id} request={request} interes={interes} onOpen={onOpenConversation} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Perfil ---------------- */

export function ProfileScreen({ profile, onEdit, onHelp, onPrivacy, onSignOut }) {
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const accountLine =
    profile.provider === "email" ? profile.email
    : profile.provider === "google" ? "Conectado con Google"
    : profile.provider === "apple" ? "Conectado con Apple"
    : "Cuenta conectada";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <RootHeader title="Perfil" />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 22px 26px" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 17, color: COLORS.text, marginBottom: 3 }}>{profile.name}</div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: COLORS.muted, marginBottom: 12 }}>{accountLine}</div>
          <TextLink onClick={onEdit}>Editar</TextLink>
        </div>

        <div>
          <NavRow label="Ayuda y soporte" onClick={onHelp} />
          <NavRow label="Privacidad y términos" onClick={onPrivacy} />
        </div>

        <div style={{ marginTop: 34 }}>
          {confirmingSignOut ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: COLORS.muted }}>¿Cerrar sesión?</span>
              <TextLink onClick={onSignOut}>Sí, salir</TextLink>
              <TextLink onClick={() => setConfirmingSignOut(false)}>No</TextLink>
            </div>
          ) : (
            <TextLink onClick={() => setConfirmingSignOut(true)}>Cerrar sesión</TextLink>
          )}
        </div>
      </div>
    </div>
  );
}

export function EditNameScreen({ currentName, onSave, onBack }) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const nameValid = name.trim().length >= 2;

  async function handleSave() {
    if (!nameValid || saving) return;
    setSaving(true);
    setSaveError(null);
    const ok = await onSave(name.trim());
    setSaving(false);
    if (!ok) setSaveError("No pudimos guardar el cambio. Probá de nuevo.");
  }

  return (
    <Screen topSlot={<TextLink disabled={saving} onClick={onBack}>‹ Atrás</TextLink>}>
      <h1 style={{ ...heading1, marginBottom: 22 }}>Editar nombre artístico</h1>
      <UnderlineField value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && handleSave()} />
      {saveError && <p style={{ color: "#FF6B5A", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginTop: 10 }}>{saveError}</p>}
      <div style={{ marginTop: 24 }}>
        <PrimaryButton full disabled={!nameValid || saving} onClick={handleSave}>
          {saving ? "Guardando…" : "Guardar"}
        </PrimaryButton>
      </div>
    </Screen>
  );
}

/* ---------------- Ayuda y soporte ---------------- */

const FAQ_ITEMS = [
  {
    q: "¿Puedo editar un pedido después de publicarlo?",
    a: "Sí. Desde tu pedido tocá \"Editar pedido\". Al actualizar, las conversaciones y propuestas anteriores se cierran y volvemos a buscar profesionales con los datos nuevos.",
  },
  {
    q: "¿Cuántos mensajes puedo mandar antes de recibir una propuesta?",
    a: "Hasta cuatro mensajes por persona antes de una oferta formal. El chat sin límite se habilita después de confirmar la contratación (con reserva y pago) — elegir una propuesta todavía no lo desbloquea.",
  },
  {
    q: "¿Qué pasa si ningún profesional responde?",
    a: "Te pedimos una aclaración o te mostramos profesionales con horario disponible ahora, según el caso.",
  },
  {
    q: "¿Puedo cancelar un pedido?",
    a: "Sí, desde el pedido activo, mientras todavía no hayas elegido una propuesta.",
  },
];

export function HelpScreen({ artistName, onBack }) {
  const [view, setView] = useState("menu");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [problemText, setProblemText] = useState("");
  const [contactText, setContactText] = useState("");
  const requests = useMyRequests(artistName);

  const backHandler = view === "menu" ? onBack : () => setView("menu");

  return (
    <Screen topSlot={<TextLink onClick={backHandler}>‹ Atrás</TextLink>}>
      {view === "menu" && (
        <>
          <h1 style={{ ...heading1, marginBottom: 18 }}>Ayuda y soporte</h1>
          <NavRow label="Preguntas frecuentes" onClick={() => setView("faq")} />
          <NavRow label="Tengo un problema con un pedido" onClick={() => setView("problema-elegir")} />
          <NavRow label="Contactar a COLAB" onClick={() => setView("contactar")} />
        </>
      )}

      {view === "faq" && (
        <>
          <h2 style={{ ...heading1, fontSize: 20, marginBottom: 18 }}>Preguntas frecuentes</h2>
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 14, color: COLORS.text, marginBottom: 4 }}>{item.q}</div>
              <p style={mutedSmall}>{item.a}</p>
            </div>
          ))}
        </>
      )}

      {view === "problema-elegir" && (
        <>
          <h2 style={{ ...heading1, fontSize: 20, marginBottom: 18 }}>Elegí el pedido</h2>
          {requests.length === 0 ? (
            <p style={mutedSmall}>Todavía no tenés pedidos.</p>
          ) : (
            requests.map((r) => (
              <NavRow key={r.id} label={r.resumen} onClick={() => { setSelectedRequest(r); setView("problema-texto"); }} />
            ))
          )}
        </>
      )}

      {view === "problema-texto" && (
        <>
          <h2 style={{ ...heading1, fontSize: 20, marginBottom: 6 }}>Contanos qué pasó</h2>
          <p style={{ ...mutedSmall, marginBottom: 16 }}>{selectedRequest?.resumen}</p>
          <UnderlineField multiline value={problemText} onChange={(e) => setProblemText(e.target.value)} placeholder="Describí el problema…" />
          <div style={{ marginTop: 20 }}>
            <PrimaryButton full disabled={!problemText.trim()} onClick={() => setView("problema-enviado")}>Enviar</PrimaryButton>
          </div>
        </>
      )}
      {view === "problema-enviado" && (
        <p style={mutedSmall}>
          Esto es una simulación de este prototipo: tu mensaje sobre "{selectedRequest?.resumen}" no se guardó ni se envió a ningún lado. Todavía no tenemos definidos los plazos ni el proceso de resolución para este tipo de casos.
        </p>
      )}

      {view === "contactar" && (
        <>
          <h2 style={{ ...heading1, fontSize: 20, marginBottom: 16 }}>Contactar a COLAB</h2>
          <UnderlineField multiline value={contactText} onChange={(e) => setContactText(e.target.value)} placeholder="Escribinos acá…" />
          <div style={{ marginTop: 20 }}>
            <PrimaryButton full disabled={!contactText.trim()} onClick={() => setView("contactar-enviado")}>Enviar</PrimaryButton>
          </div>
        </>
      )}
      {view === "contactar-enviado" && (
        <p style={mutedSmall}>Esto es una simulación de este prototipo: tu mensaje no se guardó ni se envió a ningún lado.</p>
      )}
    </Screen>
  );
}

export function PrivacyScreen({ onBack }) {
  return (
    <Screen topSlot={<TextLink onClick={onBack}>‹ Atrás</TextLink>}>
      <h1 style={{ ...heading1, marginBottom: 16 }}>Privacidad y términos</h1>
      <p style={mutedSmall}>
        Todavía no definimos los términos de uso ni la política de privacidad definitiva de COLAB — es uno de los puntos pendientes del producto. Por ahora, tu perfil y tus pedidos se guardan únicamente en este dispositivo.
      </p>
    </Screen>
  );
}
