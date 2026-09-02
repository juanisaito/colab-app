# COLAB — contexto y roadmap

Actualizado: 2 de septiembre de 2026.

## Para quien recién llega (pensado para vos + una IA)

Esto alcanza para entender el proyecto y seguir escribiendo código sin leer
todo el historial de abajo, que es un log cronológico de decisiones (el más
reciente arriba, salvo esta sección).

### Qué es COLAB

Una app móvil que conecta artistas independientes con productores musicales.
El artista cuenta con sus propias palabras qué quiere hacer ("¿Qué querés
hacer?"); COLAB interpreta el pedido, selecciona productores relevantes y
facilita conversación, propuesta, reserva, pago y continuidad del proyecto.
La hipótesis central: un artista con una necesidad musical real recibe
propuestas relevantes, elige una y paga dentro de COLAB. Ver "Propósito" y
"Principios de producto" más abajo para el resto del contrato de producto —
no cambian con este rediseño visual.

### Estética actual: "estudio editorial"

- Paleta cálida y clara (no oscura): fondo `#FAF7F1`, texto principal
  ("carbón") `#1B1815`, acento naranja quemado `#C2410C` usado con
  moderación (precios, estado activo, selección), bordes suaves `#E1DCD1`.
  Tokens exactos en `app/theme.js`, export `EDITORIAL`.
- Tipografía: sans (Helvetica Neue / sistema) para todo el texto legible.
  IBM Plex Mono reservada sólo para labels en mayúscula y metadata (precios,
  timestamps, códigos de estado) — nunca para el cuerpo de una acción.
- Sin tarjetas ni sombras: las listas se separan con divisores finos
  (`border-bottom`), no con cards.
- La selección se indica con un punto naranja, no con checkmarks ni fondos
  de color.
- Doodles a mano (SVG propios en `app/ui/pieces.jsx`, prefijo `Doodle*`):
  máximo uno por pantalla, nunca dentro de una opción individual, nunca
  animados junto con su contenedor (evitar transiciones anidadas).
- Los íconos funcionales (flechas, pin de ubicación) son geométricos
  simples, no doodles — ver `EditorialBackButton`, `EditorialCircleArrowButton`,
  `LocationPinIcon`, `ChevronIcon` en `app/ui/pieces.jsx`.
- Todavía convive una paleta vieja (`COLORS`, oscura, acento azul) en las
  pantallas que faltan rediseñar (ver abajo). Las dos paletas nunca se
  mezclan dentro de una misma pantalla.

### Qué ya está rediseñado vs. qué falta

Ya en la paleta `EDITORIAL`: Gate (login/alta), `RequestComposer`, Inicio,
alta de pedido completa (`StartScreen`/`ContextStep`/`SummaryScreen`),
Pedidos (lista) y el chrome Inicio↔Pedidos, `WaitingScreen` en todos sus
estados, `OfferDetail`, `BookingFlow` (coordinar horario → seña → reservado),
el botón circular de "seguir" en los compositores de texto/nombre, y el
rediseño de los controles de ubicación (acción principal con borde propio,
acciones secundarias con flecha, barrios como lista de selección con punto
naranja).

Todavía con la paleta vieja (`COLORS`, oscura): `ConversationScreen` (el
chat), Mensajes, Perfil, Ayuda y soporte, Privacidad y términos.

Modo oscuro real (paleta negra/blanca, con toggle automático según el
sistema + manual desde Perfil) todavía NO existe como feature. Está
planeado como un bloque aparte — no se mezcla con terminar el rediseño de
las pantallas de arriba, porque es un eje de trabajo distinto (agregar un
segundo modo a pantallas ya rediseñadas, no reskinear pantallas nuevas).

### Qué SÍ y qué NO al hacer un bloque de rediseño visual

- SÍ: cambiar JSX, estilos, colores, tipografía, spacing; agregar piezas
  visuales nuevas y aditivas en `app/ui/pieces.jsx` (nunca reemplazar ni
  modificar el comportamiento de una pieza existente que siga usando otra
  pantalla).
- NO: tocar lógica de dominio (`app/domain/`), almacenamiento
  (`app/lib/storage.js`), timers/simulaciones, navegación, ni los estados o
  validaciones que ya existen. Si un cambio visual pareciera necesitar
  tocar lógica, es una señal para pausar y decidirlo aparte, no para
  resolverlo de paso.
- Cada bloque de rediseño es chico y aislado: evitar mezclar dos rediseños
  distintos en un mismo bloque (por ejemplo booking + ubicación), y evitar
  mezclar rediseño visual con la integración de IA.
- Antes de cualquier commit: `pnpm test`, `pnpm build`, `git diff --check`,
  y probar el recorrido real en mobile (390px) y desktop (1440px) —  no
  asumir que un cambio visual "obviamente funciona" sin probarlo en la app
  corriendo.

### Dónde vive cada cosa

- `app/ColabApp.jsx` — pantallas principales del flujo de creación, espera
  y contratación.
- `app/RootScreens.jsx` — Inicio, Pedidos, Mensajes, Perfil y sus
  sub-pantallas (navegación raíz).
- `app/features/booking/BookingFlow.jsx` — coordinar horario, pagar la
  seña, reserva confirmada.
- `app/features/request/RequestComposer.jsx` — el compositor de texto
  compartido ("¿Qué querés hacer?").
- `app/ui/pieces.jsx` — piezas visuales compartidas (botones, campos,
  doodles, íconos). No importa nada de `ColabApp.jsx` ni `RootScreens.jsx`
  para evitar un ciclo de imports.
- `app/theme.js` — `COLORS` (paleta vieja, oscura) y `EDITORIAL` (paleta
  nueva, clara). Viven juntas a propósito; ver el comentario del archivo.
- `app/domain/` — reglas de negocio puras (estado del pedido, booking,
  franjas horarias, matching, precios), con sus tests (`*.test.js`, corren
  con `pnpm test`).
- `app/lib/storage.js` — acceso a localStorage/almacenamiento compartido.
- `CONTRIBUTING.md` — convenciones de idioma (código en inglés, texto
  visible en español rioplatense) y checklist antes de entregar un cambio.
- `AI_ARCHITECTURE.md` — qué IA está conectada hoy (interpretación de
  pedidos) y el plan para el resto (sugerencias, soporte, explicación de
  matching, moderación) — todavía sin empezar en este prototipo.

El resto de este archivo es el log cronológico de decisiones de producto y
técnicas, del más reciente (justo abajo, con fecha del 30 de agosto) al más
viejo. Sirve como historial y como referencia de detalle — no hace falta
leerlo entero para empezar a trabajar.

## Inicio, sugerencias e integración de IA (30 de agosto de 2026)

- Las frases de ejemplo volvieron a aparecer como una sugerencia animada en el alta y en la caja principal de pedidos. El componente compartido vive en `app/ui/AnimatedPrompt.jsx`, para que el comportamiento no vuelva a duplicarse entre pantallas.
- El alta nueva sigue el orden `acceso/registro → qué querés hacer → cómo querés que te llamemos → preguntas de contexto`. El texto del primer pedido se conserva durante el alta y se interpreta recién al terminar el nombre, de modo que las aclaraciones continúan sin pasar antes por Inicio.
- El compositor compartido se extrajo a `app/features/request/RequestComposer.jsx`. En Inicio aparece centrado y antes de "En movimiento"; la tarjeta del pedido activo queda debajo y su resumen usa menor tamaño y peso visual.
- Si un pedido activo tiene `recovery === "aclaracion"`, no se puede iniciar otro: Inicio reemplaza la caja por una explicación y el CTA "Completar aclaración". La regla `requestNeedsArtistInput` también se revalida contra el storage dentro de `handleTextSubmit`, así no depende sólo de la pantalla o de que el polling ya se haya actualizado. Al responder, el compositor se habilita automáticamente.
- Se eliminó el nombre del artista del encabezado superior. El nombre sigue guardado en el perfil y disponible donde aporta contexto, pero no ocupa permanentemente la esquina de todas las pantallas.
- La interpretación ahora intenta `POST /api/interpret` mediante `interpretRequestViaBackend`; la clave del proveedor sólo se lee en el servidor. Si la ruta no está configurada, tarda demasiado o devuelve datos inválidos, se usa el intérprete local y se informa el fallback en el resumen, sin bloquear el flujo.
- `server/interpretationApi.js` implementa esa ruta para desarrollo y preview con Vite. En producción hay que mover el mismo contrato a un backend o función serverless; la arquitectura recomendada para interpretación, soporte, sugerencias, matching y moderación está en `AI_ARCHITECTURE.md`.
- Convención para el código nuevo: nombres de archivos, variables, funciones y comentarios técnicos en inglés; textos visibles para el usuario en español rioplatense. Los campos persistidos que ya existen en español no se renombran sin una migración explícita. Ver `CONTRIBUTING.md`.
- Verificación actual: 65 pruebas de dominio y almacenamiento, build de producción y recorridos visuales del alta completa, el bloqueo por aclaración y su posterior desbloqueo, con el endpoint de IA sin configurar y el fallback local activo.

## Primer tramo de contratación: propuesta_elegida → horario → seña → reservado (30 de agosto de 2026)

Implementado el primer tramo del flujo de contratación descripto en "Reserva, pago y sesión" más abajo: `propuesta_elegida → coordinación de horario → pago simulado de la seña → reservado`. Sin autenticación, backend, pagos reales, PIN, sala de canción, valoraciones, ni devoluciones — eso sigue siendo trabajo futuro (ver [Pendiente después de este bloque](#pendiente-después-de-este-bloque-30-de-agosto)).

**`app/domain/booking.js`** (puro, sin React) centraliza tanto los cálculos como las transiciones válidas del booking, para que los handlers de `ColabApp.jsx` y las pruebas usen exactamente las mismas funciones (nunca una reimplementa la condición de la otra):

- `BOOKING_STATUS` (`pending_confirmation`, `slot_confirmed`, `deposit_paid`) y `SLOT_CONFIRMATION_DELAY_MS` (2500ms, la demora simulada de la confirmación del productor).
- `calculateBookingAmounts` (seña 25% redondeada + saldo = total − seña, para que sumen siempre exacto sin arrastre de redondeo), `generateAvailableSlots` (tres horarios futuros simulados a partir de una fecha de referencia), `createInitialBooking`.
- `calculateBalanceDueAt`/`formatBalanceDueLabel`: el saldo vence exactamente 24 horas antes del horario elegido (`selectedSlot.isoDate - 24h`), no sólo "24 horas antes" en abstracto — se persiste en `booking.balanceDueAt` al solicitar el horario y se muestra como fecha y hora concretas en la revisión de pago y en la reserva confirmada, sin dejar de explicar que corresponde a 24 horas antes de la sesión.
- Un par `can*`/`apply*` por transición — `canStartBooking`/`applyStartBooking`, `canRequestSlot`/`applyRequestSlot`, `canConfirmSlot`/`applyConfirmSlot`, `canPayDeposit`/`applyPayDeposit` — donde `apply*` sólo hace algo si el `can*` correspondiente da `true`, y devuelve `null` (no cambia nada) si no. Las cuatro exigen `esPropuestaElegida(request.estado)` como condición base: un pedido en `esperando`, `con_ofertas`, `reservado`, `cancelado` o cualquier estado desconocido nunca puede saltar artificialmente a otra fase de reserva. Aplicar una transición ya aplicada (por ejemplo, confirmar un horario ya confirmado, o pagar una seña ya pagada) es un no-op idempotente, no un error.
- `getRemainingConfirmationDelay(request, now)`: cuánto falta de los `SLOT_CONFIRMATION_DELAY_MS` originales, contado desde `booking.requestedAt` — `0` si el plazo ya pasó (confirmar de inmediato) o si ya no hay nada que confirmar. Es la pieza que permite recuperar una confirmación pendiente después de una recarga (ver más abajo).
- `getBookingPhase(request)`: deriva qué fase mostrar (`not_started`, `choose_slot`, `awaiting_confirmation`, `slot_confirmed`, `confirmed`, o `inconsistent`) exclusivamente de `estado` + `booking`. Cualquier combinación que no sea una fase real y consistente —un `booking.status` desconocido, `"reservado"` sin `booking.status === "deposit_paid"`, `"deposit_paid"` con el estado principal en otra cosa, etc.— cae en `"inconsistent"`, que nunca se interpreta como reserva confirmada por descarte.

**Modelo de datos:** `request.booking` (ausente hasta que el artista toca "Coordinar reserva" — creación perezosa e idempotente vía `applyStartBooking`, así los pedidos guardados sin `booking` siguen funcionando igual):

```js
booking: {
  status: "pending_confirmation" | "slot_confirmed" | "deposit_paid",
  availableSlots: [{ id, label, isoDate }],
  selectedSlot: null | { id, label, isoDate },
  requestedAt: null | ISOString,
  confirmedAt: null | ISOString,
  depositPaidAt: null | ISOString,
  balanceDueAt: null | ISOString,  // selectedSlot.isoDate - 24h, seteado al solicitar el horario
  totalAmount: number,
  depositAmount: number,  // 25%, redondeado
  balanceAmount: number,  // = totalAmount - depositAmount
}
```

`request.estado` sigue en `"propuesta_elegida"` mientras se coordina el horario y se espera el pago; sólo pasa a **`"reservado"`** (nuevo estado, agregado a `ESTADO_LABELS` y siempre activo vía `esActivo`) cuando se confirma el pago simulado de la seña — y por construcción (`applyPayDeposit` cambia ambos campos a la vez) `"reservado"` siempre coincide con `booking.status === "deposit_paid"`.

**Experiencia:** el aviso estático "Elegiste a X" se reemplazó por `BookingFlow` (extraído a `app/features/booking/BookingFlow.jsx` — ver "Organización del código" más abajo), que deriva la fase a mostrar con `getBookingPhase` (nunca con un estado de navegación propio), así un "‹ Atrás" o una recarga siempre caen en el punto correcto:

1. **`not_started`:** resumen (profesional, trabajo incluido, modalidad/zona, precio final) con CTA "Coordinar reserva".
2. **`choose_slot`:** tres horarios simulados para elegir → "Solicitar horario".
3. **`awaiting_confirmation`:** "Esperando confirmación" — un timer simula la confirmación del productor a los pocos segundos (con recuperación tras recargar, ver más abajo).
4. **`slot_confirmed`:** resumen completo (horario, alcance, total, seña, saldo, fecha y hora concretas del vencimiento) con CTA "Pagar seña", que abre una pantalla de pago simulado con el texto explícito "Simulación: no se realizará ningún cobro".
5. **`confirmed`** (`deposit_paid` + estado `"reservado"`): vista persistente de reserva confirmada, con la aclaración de que la dirección exacta se comparte más adelante.
6. **`inconsistent`:** un aviso recuperable ("No pudimos cargar el estado de esta reserva", con botón "Reintentar") — nunca se afirma que hubo un pago si los datos no lo confirman con certeza.

Con un profesional ya elegido (`propuesta_elegida` o `reservado`) ya no se ofrece "Editar pedido" ni "Cancelar pedido" — se había detectado en una auditoría posterior que "Cancelar pedido" seguía disponible y funcionando también para `propuesta_elegida`, contradiciendo que la política de cancelación posterior a elegir una propuesta todavía no está definida (requiere modelar devoluciones). La cancelación sigue disponible únicamente antes de elegir una propuesta (`esperando`/`con_ofertas`), reforzada tanto en la interfaz (el link no se muestra) como en el propio handler (`puedeCancelarse(estado)`, en `app/domain/estado.js`, valida el estado real antes de escribir — no sólo lo que vio la interfaz).

**Recuperación de la confirmación de horario tras una recarga:** si se recarga mientras `booking.status === "pending_confirmation"` con un `selectedSlot` ya solicitado, el timer en memoria se pierde — pero al reabrir ese pedido, cada `poll()` de `WaitingScreen` vuelve a llamar a `ensureSlotConfirmationScheduled` (en `ColabApp.jsx`), que usa `getRemainingConfirmationDelay` para reprogramar sólo el tiempo que faltaba (o confirmar de inmediato si ya venció) y `canConfirmSlot`/`applyConfirmSlot` para revalidar el estado real antes de escribir. Un `Set` en memoria (`scheduledSlotConfirmations`, reservado de forma síncrona antes de cualquier `await`) garantiza un único timer en vuelo por pedido, sin importar cuántas veces se llame desde el polling o desde reaperturas repetidas.

**Regla central de estados** en `app/domain/estado.js`: `puedeRecibirActividadDeProductores(estado)` es `true` únicamente para `"esperando"` y `"con_ofertas"`. Reemplaza las comparaciones dispersas `esPropuestaElegida(r.estado) || esCancelado(r.estado)` que había en `scheduleSimulatedProducers` (los tres updaters tardíos), `generateFormalOffer`, `handleSolicitarCurado`, `handleChoose` e `isRequestStillOpen` — y de paso corrige que `handleChoose` no bloqueaba re-elegir una propuesta sobre un pedido ya `reservado` (inalcanzable hoy desde la interfaz, pero el guard ahora lo cubre igual). También se agregaron `tieneProfesionalElegido(estado)` (`propuesta_elegida`, `cerrado` legacy o `reservado`) y `puedeCancelarse(estado)` (todo lo contrario: sólo antes de elegir una propuesta).

**Chat, validado desde el dato persistido, no desde props calculadas al renderizar:** dos funciones nuevas en `app/domain/estado.js` — `puedeEscribirEnConversacion(request, productorName)` y `tieneLimiteDeMensajes(request, productorName)` — son la única fuente de verdad. El updater que guarda cada mensaje (`appendMessage`, en `ConversationScreen`) las llama con el `request` que acaba de leer `updateRequestById`, no con las props `readOnly`/`unlimited` que la pantalla ya tenía calculadas al abrirse (esas props sólo controlan la UI — deshabilitar la caja de texto, mostrar el aviso correcto — pero ya no son la validación real). Reglas: `"cancelado"` bloquea siempre; una vez `"reservado"`, sólo puede seguir escribiendo el profesional de `chosenOfferId`, y ahí sin el límite de 4 mensajes; cualquier otro profesional queda bloqueado a nivel de persistencia (no sólo de interfaz); antes de `"reservado"` (incluida `"propuesta_elegida"`) cualquier conversación existente sigue permitida, sujeta al límite de siempre.

**Pago simulado, idempotente:** `applyPayDeposit` sólo aplica si `booking.status === "slot_confirmed"` exactamente; un doble click, una reapertura o un reintento tras un fallo de guardado ven que ya no está en ese estado exacto y no hacen nada (ni duplican el pago ni pisan `depositPaidAt`). Si el guardado falla, se muestra un error y la reserva no se marca como confirmada.

**Organización del código:** `BookingFlow` se extrajo de `ColabApp.jsx` a `app/features/booking/BookingFlow.jsx` (primer módulo bajo `app/features/`) para no seguir inflando el archivo raíz con líneas de presentación — importa piezas visuales compartidas, tema y helpers de dominio, sin depender de nada de `ColabApp.jsx`. Esto requirió promover dos piezas más a módulos neutrales ya existentes, porque `BookingFlow.jsx` las necesitaba y `ColabApp.jsx` seguía necesitándolas también: `BigOption` pasó de ser local a `ColabApp.jsx` a exportarse desde `app/ui/pieces.jsx` (ya usada en selección de horario además de en `ContextStep`), y `formatMoney` se movió a un `app/lib/format.js` nuevo (mismo patrón que `app/lib/id.js`). `ColabApp.jsx` conserva la orquestación y los handlers.

**Pruebas** (`node:test`, sin dependencias nuevas; 60 en total): `app/domain/booking.test.js` cubre cálculo exacto 25%/75%, horarios estables, vencimiento del saldo exactamente 24h antes (sin mutar el slot), cada par `can*`/`apply*` rechazando estados incompatibles, recuperación de la confirmación antes y después de vencido el plazo, y que un booking desconocido o inconsistente nunca aparece como pagado (`getBookingPhase`). `app/domain/estado.test.js` ampliado (`reservado` activo, `tieneProfesionalElegido`, `puedeRecibirActividadDeProductores`). `app/lib/storage.test.js` ampliado con el recorrido completo solicitar→confirmar→pagar usando las funciones reales de `booking.js`, pago doble idempotente, rechazo de cancelación después de elegir/reservar, y las reglas de chat (elegido sin límite, otros bloqueados a nivel de persistencia) — todo usando las mismas funciones de dominio que produción, nunca una reimplementación en el test.

Verificado con Playwright de punta a punta, incluida la recuperación tras recargar: crear pedido y elegir propuesta (sin poder editar ni cancelar), coordinar reserva, elegir y solicitar horario, **recargar inmediatamente antes de los 2,5 segundos** y confirmar que el flujo igual llega a `slot_confirmed` sin duplicar la confirmación, recargar de nuevo ya confirmado y pagar la seña simulada, revisar el vencimiento concreto del saldo, volver a Inicio y Pedidos (reserva visible y en curso, no en Anteriores, sin poder cancelarla ni reabrirla), recargar una vez más y confirmar que persiste, esperar más que el máximo de los timers de productores y confirmar que no llegan ofertas/intereses tardíos, y el comportamiento de chat (elegido sin límite, otros bloqueados). Sin errores de consola.

### Pendiente después de este bloque (30 de agosto)

- Cancelación de un pedido `propuesta_elegida` o `reservado` con devolución real: sigue fuera de alcance hasta definir el esquema de reembolsos (Fase 5 del roadmap). Hoy directamente no se ofrece cancelar en esos estados (ver más arriba), en vez de ofrecer una cancelación sin reembolso modelado.
- PIN de cuatro dígitos, sala por canción, pago del saldo (75%) a las 24 horas, subida/aceptación del archivo de audio y valoraciones mutuas: todavía no implementados — son los siguientes tramos del mismo flujo.
- Aplicación real del productor (confirmar/rechazar un horario desde su propio lado) sigue simulada con un timer, no con una acción del productor.

## Refactorización técnica: eliminar el ciclo de imports y extraer dominio (30 de agosto de 2026)

Antes de seguir agregando funcionalidades, se hizo una refactorización puramente técnica del prototipo del artista — sin cambios de diseño, textos, navegación ni reglas de producto. `app/ColabApp.jsx` pasó de 2632 a 1860 líneas; `app/RootScreens.jsx` de 495 a 471. El resto del código se movió a módulos nuevos, en tres commits revisables:

- **`app/ui/pieces.jsx`**: `Screen`, `PrimaryButton`, `SecondaryButton`, `TextLink`, `Label`, `UnderlineField`, `ProducerPhoto` — las piezas visuales que `ColabApp.jsx` y `RootScreens.jsx` necesitaban de las dos direcciones. Esto elimina el ciclo de imports que documentaba la sección "Navegación por pestañas" más abajo: ahora `ColabApp.jsx` importa pantallas de `RootScreens.jsx` en una única dirección, y `RootScreens.jsx` no importa nada del componente raíz.
- **`app/lib/storage.js`**: `PROFILE_KEY`, `REQUESTS_KEY`, `storageGet`, `storageSet` (sin cambios de claves ni formato), más helpers nuevos —`getAllRequests`, `getRequestById`, `updateRequestById`, `saveRequests`, `migrateLegacyClosedRequests`— que reemplazan el patrón repetido "leer toda la colección, mapear buscando el id, volver a guardar" que aparecía en cada acción (chat, ofertas, elegir propuesta, cancelar, editar, aclaración, recuperación curada).
- **`app/domain/estado.js`**: `ESTADO_LABELS`, `esPropuestaElegida`, `esCancelado`, `esActivo` — las reglas de estado del pedido en un solo lugar, incluida la compatibilidad con el estado legacy `"cerrado"`. En esta refactorización todavía no se agregaron `reservado`/`pagado`/`en_curso`/`finalizado` (`reservado` se agregó después, el 30 de agosto, junto con el resto de reglas de la sección "Primer tramo de contratación" más arriba; `en_curso`/`finalizado` siguen sin implementarse).
- **`app/domain/interpretation.js`, `genres.js`, `matching.js`, `pricing.js`, `contextSanitize.js`** (+ `app/lib/id.js` para `uid`): la interpretación determinística, detección de géneros, datos simulados de productores y matching, cálculo de precio simulado, y sanitización de contexto al editar — todo sin depender de React, ahora testeable directamente con Node.

**Pruebas nuevas** (`node:test`, sin dependencias nuevas; `pnpm test`): compatibilidad `"cerrado"`/`"propuesta_elegida"`, activos/cancelados, interpretación de grabar/hacer/mezclar/especial, detección de géneros, matching incompatible con cero resultados, conservación de contexto al editar, y cálculo de precio simulado.

**Sin cambios de comportamiento.** Verificado con Playwright en cada uno de los tres commits: acceso, creación y publicación, edición, cancelación, conversación con el límite real de 4 mensajes (confirmado también a nivel de storage), generación de oferta, elección de propuesta, navegación Inicio/Pedidos/Mensajes/Perfil, y datos guardados con estado legacy `"cerrado"` (incluida la migración). `pnpm build` y `pnpm test` sin errores en los tres commits.

**Corregido en un commit posterior** (ver más abajo, "Fix: impedir actualizaciones tardías y cubrir almacenamiento"): la asimetría de `isRequestStillOpen` que se documentaba acá quedó resuelta.

## Fix: impedir actualizaciones tardías y cubrir almacenamiento (30 de agosto de 2026)

`isRequestStillOpen` (en `ColabApp.jsx`) comparaba el estado directamente contra `"cerrado"` en vez de usar `esPropuestaElegida`, así que un pedido con `propuesta_elegida` seguía considerándose abierto para nuevas simulaciones de productores. Ahora usa `esPropuestaElegida` + `esCancelado`, igual que el resto del código: un pedido deja de aceptar nuevas simulaciones apenas tiene `propuesta_elegida`, el estado legacy `"cerrado"` (vía `esPropuestaElegida`), o `cancelado`.

Esa comprobación sola no alcanzaba: entre `isRequestStillOpen` y el `updateRequestById` de cada timer de `scheduleSimulatedProducers`, el artista puede elegir una propuesta o cancelar el pedido mientras el timer ya está en vuelo. Los tres updaters tardíos de esa función (oferta directa, interés nuevo y recuperación) ahora repiten el mismo guard (`esPropuestaElegida || esCancelado` → `null`, sin guardar) usando el estado real que lee `updateRequestById` en ese instante, no el que vio `isRequestStillOpen` antes. En particular, una oferta directa tardía ya no puede convertir `"propuesta_elegida"` en `"con_ofertas"`. Cancelar los timers pendientes en `handleChoose`/`handleCancel` se mantiene, pero deja de ser la única protección.

Se agregaron pruebas de almacenamiento en `app/lib/storage.test.js` (stub de `localStorage` en memoria, sin dependencias nuevas): lectura/escritura básica de `getAllRequests`/`getRequestById`/`updateRequestById`, id inexistente, updater que devuelve `null` o la misma referencia, actualizaciones consecutivas, migración de `"cerrado"`, un fallo de escritura, y dos pruebas que reproducen la carrera real (elegir propuesta y cancelar antes de que "llegue" un callback de productor tardío). `pnpm test` corre ahora 33 pruebas (19 de dominio + 14 de almacenamiento).

Sin cambios de copy, matching, precios, interpretación, estados ni navegación. Verificado con Playwright: publicar, elegir una propuesta, esperar más que el tiempo máximo de los timers y confirmar que no llega ninguna oferta/interés tardío; publicar y cancelar otro pedido y confirmar lo mismo. Sin errores de consola.

## Corrección de inconsistencias de la navegación (misma sesión, más tarde)

Después de armar la navegación por pestañas, se corrigieron cuatro inconsistencias que quedaron expuestas por tener por primera vez botones de "volver" y una lista de pedidos persistente.

### 1. Ciclo de vida real del pedido

Elegir una propuesta **no** es lo mismo que confirmar una contratación — todavía no existen reserva ni pago. El estado que antes se llamaba `"cerrado"` pasó a llamarse **`propuesta_elegida`**, y sigue contando como pedido **activo**:

- Ciclo implementado en este prototipo: `esperando` → `con_ofertas` → `propuesta_elegida` → `cancelado`.
- Estado agregado el 30 de agosto: `reservado` (seña pagada, ver sección "Primer tramo de contratación" más arriba) — sigue contando como pedido **activo**, no pasa a "Anteriores". Estados futuros **todavía no implementados** (requieren sesión realizada y liberación de pago): `en_curso`, `finalizado`. Cuando exista `finalizado`, recién ahí (y no `reservado`) pasará a "Anteriores".
- `propuesta_elegida` sigue apareciendo en "En curso" (Pedidos) y como proyecto activo en Inicio, con la etiqueta "Propuesta elegida" — nunca "Confirmado".
- Al abrir un pedido con `propuesta_elegida`, `WaitingScreen` deja de mostrar el feed de intereses/ofertas y muestra en su lugar quién fue elegido y una explicación de que el siguiente paso es coordinar horario, reserva y pago (entonces vía el componente `ChosenOfferNotice` en `ColabApp.jsx`; desde el 30 de agosto ese lugar lo ocupa `BookingFlow`, en `app/features/booking/BookingFlow.jsx` — ver "Primer tramo de contratación" más arriba). Ya no existe una pantalla aparte (`ChosenScreen`) desconectada de la pestaña Pedidos: se unificó dentro de `WaitingScreen`, así "volver" siempre cae en la pestaña correcta sin tener que rastrear desde dónde se abrió.

**Migración de datos existentes:** al montar la app corre `migrateLegacyClosedRequests()` (en `ColabApp.jsx`), que lee todos los pedidos guardados y reescribe `estado: "cerrado"` → `estado: "propuesta_elegida"` — es la única migración, no destructiva (ningún otro campo se toca, y `chosenOfferId` se conserva tal cual). Por las dudas de que algún pedido se lea antes de que la migración termine de correr, todos los lugares que distinguen "propuesta elegida" (agrupación de Pedidos, módulo de Inicio, guards de `handleChoose`/`handleMessageOffer`/etc.) tratan `"cerrado"` como sinónimo de `"propuesta_elegida"`, no sólo el resultado ya migrado.

### 2. Chat después de elegir una propuesta

Elegir una propuesta **no** desbloquea chat ilimitado — eso se documenta acá como decisión pendiente de producto, para implementar recién cuando exista una contratación confirmada (reserva + pago reales). El límite de cuatro mensajes por persona sigue rigiendo igual para `propuesta_elegida` que para cualquier otro pedido activo.

**Actualizado el 30 de agosto**, una vez implementada la reserva y el pago simulados (ver "Primer tramo de contratación" más arriba): la distinción real es `propuesta_elegida` vs. `reservado`, no "elegir" vs. "no elegir". Mientras el pedido está en `propuesta_elegida` (coordinando el horario, con o sin booking iniciado) sigue rigiendo el límite de 4 mensajes para todos, tal como se documenta en este párrafo. Recién al llegar a `reservado` (seña simulada pagada) el chat con el profesional elegido queda sin límite, y los chats con cualquier otro profesional pasan a ser sólo historial de lectura.

- Un pedido `cancelado` abre su conversación en modo lectura real: sin caja de texto ni botón "Enviar", con una nota explicando que quedó así. Antes, escribir en el chat de un pedido cerrado/cancelado fallaba en silencio y mostraba "No pudimos guardar el mensaje" — un error técnico genérico para lo que en realidad era una regla de negocio. Ahora la interfaz ni siquiera ofrece la caja de texto en ese caso.
- Se encontró el mismo problema en un segundo lugar: cuando el chat de **otro** productor llegaba a su propio límite de 4 mensajes en un pedido que ya tenía `propuesta_elegida`, intentaba generar una oferta formal nueva, el guardado se rechazaba a propósito (no se puede pisar una propuesta ya elegida) y mostraba "No pudimos generar la propuesta. Probá de nuevo." — again un error técnico donde en realidad no había ningún problema real que reintentar. Ahora ese caso no muestra ningún error: el aviso de límite de mensajes ya alcanza como explicación.
- FAQ corregida (Ayuda y soporte): decía que elegir una propuesta desbloqueaba el chat sin límite. Ahora aclara que eso se habilita recién al confirmar la contratación (con reserva y pago), no al elegir.

**Decisión de producto documentada, sin implementar todavía:** el historial de chat de cada pedido se conserva **seis meses**. Falta definir el mecanismo real de borrado automático — depende de almacenamiento y backend que todavía no existen en este prototipo (hoy todo vive en `localStorage`, sin expiración).

### 3. Lenguaje: "profesionales" en las superficies generales

COLAB va a conectar con productores, sonidistas, iluminadores y otros técnicos — no sólo productores. En las superficies donde todavía no se sabe el rol concreto (Inicio, Pedidos, Mensajes, estados vacíos, y los textos de recuperación de `WaitingScreen`: "esperando…", "buscando…", FAQ genérica) se cambió "productor/productores" por "profesional/profesionales". Donde el pedido ya fue interpretado y hay un nombre de persona concreto (ej. "Tomás Ibarra quiere conocer mejor tu proyecto"), no se tocó nada — eso ya es específico, no generico. **No se tocó el matching, `OFFER_POOL` ni ningún dato hardcodeado de productores** — sigue siendo la misma base de productores simulados de siempre; sólo cambió el copy genérico.

### 4. Correcciones chicas

- `EditNameScreen`: apretar Enter con un nombre de menos de 2 caracteres ya no guarda — antes el atajo de teclado no respetaba la misma validación que el botón "Guardar" (que sí estaba bien deshabilitado).
- Ayuda y soporte: "Tengo un problema con un pedido" y "Contactar a COLAB" ya no dicen "te contactamos pronto" — como ningún mensaje se guarda ni se envía a ningún lado todavía, ahora la confirmación aclara explícitamente que es una simulación de este prototipo.
- **Deuda técnica documentada, sin resolver todavía:** `ColabApp.jsx` y `RootScreens.jsx`/`BottomNav.jsx` se importan mutuamente (uno arma la navegación con pantallas del otro; el otro reusa piezas visuales del primero). Ya causó un bug real esta sesión (`COLORS` usado en el nivel superior de ambos módulos disparaba `ReferenceError: Cannot access before initialization`), resuelto moviendo sólo `COLORS` a `theme.js`. El resto de las piezas compartidas (`Screen`, `PrimaryButton`, `storageGet`, etc.) no tiene el mismo problema porque sólo se usan dentro de cuerpos de función, pero el ciclo en sí sigue ahí. Antes del próximo bloque grande conviene resolverlo de raíz — por ejemplo, separando explícitamente una capa de "piezas compartidas" (`theme.js`, y un futuro `ui.jsx`) de la que ambos módulos importen, sin que `ColabApp.jsx` y `RootScreens.jsx` se necesiten entre sí directamente.

Verificado con Playwright (elegir una propuesta y volver a Pedidos/Inicio, abrir desde Mensajes una conversación con propuesta elegida y usar los mensajes restantes hasta 4/4, chat de pedido cancelado sin caja de texto, datos legacy con `estado: "cerrado"` sin desaparecer y migrados correctamente, Enter con nombre de 1 carácter) contra el servidor de desarrollo y también contra la **build de producción** (`pnpm build` + `vite preview`), sin diferencias. Batería de lógica y flujo existente sin regresiones.

## Navegación por pestañas (sesión del 29 de agosto de 2026 con Claude Code)

El prototipo del artista dejó de ser un flujo 100% lineal: ahora es una app navegable con una **barra inferior fija** de cuatro pestañas — Inicio, Pedidos, Mensajes, Perfil — construida sobre la misma lógica de negocio ya auditada (matching, chat con límite de 4 mensajes, edición, recuperación). No se tocó ninguna decisión de producto ya cerrada; esto es exclusivamente arquitectura de navegación.

**Archivos nuevos:**
- `app/theme.js` — `COLORS`, en un archivo sin dependencias propias. Tuvo que separarse de `ColabApp.jsx` porque `ColabApp.jsx` y `RootScreens.jsx` se importan mutuamente (`RootScreens` usa piezas visuales de `ColabApp`; `ColabApp` arma la navegación con las pantallas de `RootScreens`), y `COLORS` se usaba en el nivel superior de ambos módulos — ese ciclo con un valor usado top-level dispara un `ReferenceError: Cannot access 'COLORS' before initialization` al cargar. El resto de las piezas compartidas (`Screen`, `PrimaryButton`, `TextLink`, `Label`, `UnderlineField`, `ProducerPhoto`, `storageGet`/`storageSet`, `REQUESTS_KEY`/`PROFILE_KEY`, etc.) no tuvo ese problema porque solo se usan dentro de cuerpos de función, no en el nivel superior del módulo — se exportaron desde `ColabApp.jsx` tal cual estaban, sin moverlas.
- `app/BottomNav.jsx` — la barra inferior y sus 4 íconos (SVG en línea, sin librería).
- `app/RootScreens.jsx` — `HomeScreen`, `OrdersScreen`, `MessagesScreen`, `ProfileScreen`, `HelpScreen`, `PrivacyScreen`, `EditNameScreen`. Cada pantalla lee sus propios pedidos de `localStorage` con el mismo patrón de polling que ya usaba `WaitingScreen`, filtrados por `artistName === profile.name` (antes no existía ningún filtro por artista, porque nunca había una pantalla que listara "todos mis pedidos").

**Cómo se decide pestañas vs. flujo interno**, en `App` (`ColabApp.jsx`): un solo booleano, `inFlowMode`, es `true` si hay una creación/edición en curso, un pedido abierto (incluida una propuesta ya elegida — ver más abajo), una conversación, una oferta, Ayuda, Privacidad o edición de perfil — en ese caso se oculta la barra y se muestra la pantalla interna correspondiente con su propio "‹ Atrás". Si no, se muestra la pestaña activa (`activeTab`) con la barra visible. Cambiar de pestaña nunca toca `request`/`classification`/etc., así que la pestaña activa persiste sola mientras se navega — no hizo falta llevar un registro de "desde dónde se abrió cada pantalla".

**Bugs reales encontrados y corregidos durante esta implementación** (no eran bugs antes porque no existía forma de "volver" desde esas pantallas):
1. `handlePublish`/`handleUpdateRequest` nunca limpiaban `classification`/`context` al terminar. Con el nuevo botón "‹ Atrás" en `WaitingScreen`, volver desde un pedido recién publicado mostraba de nuevo el resumen viejo en vez de la pestaña Pedidos. Se agregó `handleCloseRequestDetail` que limpia todo correctamente.
2. Cambiar el nombre artístico (Perfil → Editar) no actualizaba el `artistName` de los pedidos ya guardados — como Pedidos/Mensajes/Inicio filtran por ese campo (no hay un id de usuario en este prototipo), renombrarse "perdía" el historial. Ahora `handleSaveProfileName` migra `artistName` en todos los pedidos existentes al guardar el nuevo nombre.
3. Un pedido cancelado con el feed vacío seguía mostrando "Tu proyecto ya está en movimiento" y "buscando profesionales", que ya no es cierto. Ahora muestra un texto acorde ("Este pedido fue cancelado…").

**Qué es real y qué sigue simulado:**
- **Real**: los pedidos, conversaciones, ofertas y estados que se listan en Pedidos/Mensajes/Inicio salen directamente de `localStorage`, no hay datos inventados. Editar, cancelar, publicar y el chat existente funcionan igual que antes, ahora alcanzables desde la navegación.
- **Simulado, sin persistencia**: "Tengo un problema con un pedido" y "Contactar a COLAB" en Ayuda no guardan nada en ningún lado — muestran una confirmación local y listo. "Privacidad y términos" es un texto fijo que dice explícitamente que la política todavía no está definida (consistente con lo que ya marcaban las "Decisiones abiertas" de este documento). El punto azul de "mensaje pendiente" en Mensajes es la única señal de estado que el modelo actual sostiene con datos reales (`!resuelto` + último mensaje del productor) — no hay leído/no leído real.
- **Cerrar sesión** borra sólo el perfil local (`colab-preview-profile-v3`); nunca toca `colab-preview-requests-v3`, así que el historial de pedidos sigue estando ahí para cualquiera que vuelva a entrar con el mismo nombre artístico.

Probado con Playwright (cuenta nueva sin pedidos, pedido activo, pedido con conversación, pedido con propuesta, pedido cerrado, pedido cancelado, cerrar sesión y volver a entrar, advertencia al descartar una creación en curso) y con la batería de lógica/flujo existente de la auditoría anterior, sin regresiones.

## Organización del repo (sesión del 29 de agosto de 2026 con Claude Code)

A partir de esta sesión, `/Users/saito/Desktop/colab app/` es la carpeta única del proyecto y tiene control de versiones real (`git`). Antes de esto había copias sueltas sin historial: `colabapp v5.jsx` acá, `colab-artista_1.jsx` a `colab-artista_5.jsx` y `colabapp v4` en Descargas, y una copia aparte del visualizador (`colab-preview/`, generada con Codex/OpenAI) desactualizada en Build 4. Esas copias de Descargas quedan sin tocar como respaldo, pero **el archivo fuente único de acá en más es `app/ColabApp.jsx`** — ya no existe un `.jsx` suelto en la raíz ni un `context vN.md` con número de versión; el historial de versiones lo lleva git.

El visualizador se unificó adentro de esta misma carpeta y se reemplazó el stack pesado que traía (Next.js vía `vinext`, Cloudflare Workers, bindings D1/R2, `wrangler` — nada de eso hacía falta para un componente cliente puro que sólo usa `localStorage`) por un proyecto **Vite + React** mínimo:

- `index.html` → `app/main.jsx` (monta `<App />`) → `app/ColabApp.jsx` (el componente, sin cambios de lógica).
- `app/index.css` reemplaza al `globals.css` con Tailwind (no se usaba: todos los estilos del prototipo son inline o vienen del `<style>` propio del componente).
- Config: `vite.config.js`, `package.json` con sólo `react`, `react-dom`, `vite` y `@vitejs/plugin-react`.

Se instaló Node.js (vía `nvm`, LTS) y `pnpm` (vía `corepack`) en esta Mac, agregado a `~/.zshrc`. Para levantar el visualizador: `pnpm install` (una vez) y después `pnpm dev`, que sirve en `http://localhost:5173/`. Verificado que arranca y sirve `ColabApp.jsx` sin errores de sintaxis tras la reorganización.

## Auditoría del flujo del artista (misma sesión, 29 de agosto de 2026)

Con el visualizador ya funcionando, se recorrieron de punta a punta los flujos de grabar, hacer/producción completa, mezclar, especial (operador de show) y pedidos escritos con errores/lunfardo — probados ejecutando la lógica real de `interpretFallback`/`pickProducers`/etc. con casos concretos en Node, y con Playwright manejando el visualizador en un navegador real (Chromium), no sólo lectura de código. Se encontraron y corrigieron 4 bugs de lógica (detalle del porqué de cada uno en el mensaje del commit `b9485b7`):

1. El regex de horario en pedidos especiales confundía cualquier número suelto del texto (cantidad de gente, un teléfono) con una hora, y saltaba la pregunta de fecha/horario cuando en realidad faltaba.
2. El chat previo a la oferta cortaba al artista en 3 mensajes reales en vez de los 4 que promete el contador en pantalla, porque el productor simulado arranca la conversación con una pregunta que ya cuenta como su primer mensaje.
3. Pedir una aclaración durante la recuperación (cuando nadie respondió) descartaba los géneros ya confirmados del pedido original al rebuscar productores.
4. Al editar un pedido publicado, dos de los cinco pasos de revisión (maqueta/referencia, y el dato faltante de pedidos especiales) no se volvían a mostrar como los otros tres (modalidad, ubicación/horario, géneros) — se saltaban en silencio.

**Quedó pendiente, no corregido** (no es un bug de lógica sino una ambigüedad de producto, para no reabrir una decisión sin el equipo): cuando el texto libre ya menciona un artista de referencia (ej. "estilo Duki"), el paso de "Maqueta o referencia" se saltea directo sin ofrecer adjuntar audio o un link — hoy el código trata "mencionó un artista" como equivalente a "ya no hace falta preguntar por una referencia", pero adjuntar una maqueta real es un dato distinto de nombrar un estilo. Vale la pena confirmar con Bato si el paso debería mostrarse igual (como pasa con géneros, que sí se pre-completa pero igual se pide confirmar) o si el salteo actual es intencional.

Herramientas usadas sólo para esta verificación (Node + Playwright/Chromium, instalados en una carpeta aparte fuera del repo) no quedaron como dependencia del proyecto ni se commitearon — es tooling de sesión, no parte de la app.

### Cierre de la auditoría (misma sesión)

Con la lógica ya auditada, se cerró la auditoría con cuatro verificaciones puntuales:

1. **Edición de pedido, verificada paso a paso en el navegador.** El test automático genérico de la sesión anterior daba 4 checks fallidos al repetir el flujo de edición en un bucle genérico — se confirmó que era una falla del propio script de prueba (una carrera al reintentar clics ya hechos), no de la app: un recorrido lineal, manual, paso por paso, confirmó que modalidad, ubicación/horario, maqueta/referencia y géneros vuelven a mostrarse para revisión, y que "Actualizar pedido" vuelve correctamente a "Tu proyecto ya está en movimiento" (12/12 pasos verificados, sin errores de consola).
2. **Recuperación de punta a punta**, forzando cero productores por incompatibilidad de género (no de ubicación) para poder confirmar el resultado real de la búsqueda: se publicó un pedido con género "Electrónica" en una zona compatible con un productor que no tiene ese género, se esperó a que dispare la recuperación, se envió una aclaración mencionando "Duki" (detecta urbano/trap), y se confirmó en el storage guardado que el pedido conserva "electronica" y suma "urbano"/"trap", que el estado de recuperación se limpia, y que con los géneros combinados aparece un interés real que antes no aparecía (el productor pasó a ser compatible).
3. **Se consolidó `context.md`** para sacar contradicciones con decisiones ya reemplazadas: "Toda CABA" ya no es una opción (se había sacado, pero seguía mencionada en la sección de "Dirección de experiencia"), "Me da igual" ya no es el label vigente (hoy es "Me adapto" para franja y "Puedo de las dos formas" para modalidad), y una referencia residual a `colab-artista_2.jsx` se corrigió a `app/ColabApp.jsx`. Sin cambios de decisiones, sólo se alineó el texto con lo que ya estaba vigente en el código.
4. **Pasada visual** de las pantallas principales con capturas reales (viewport mobile, 400×844): se encontró y corrigió un bug de layout real — a todo contenedor scrolleable con `flex: 1` le faltaba `min-height: 0`, así que cuando el contenido era más alto que lo disponible (ej. la lista completa de "elegir zona", o un feed con varias ofertas e intereses) el contenido crecía por fuera del viewport en vez de scrollear, tapando el "‹ Atrás" y el título de arriba. Se corrigió en los 6 lugares con el mismo patrón (commit `2a64148`), verificado con capturas antes/después y con contenido de sobra para forzar el caso. También se corrigió que el resumen del intérprete de respaldo partía palabras al medio al truncar a 110 caracteres (ej. "termi…") — ahora corta en el último espacio. El resto de las pantallas revisadas (gate, inicio, referencia, precio de la oferta, chat) no mostró problemas de jerarquía o navegación.

Sin cambios de lógica de negocio ni de decisiones de producto en este cierre — sólo correcciones de layout/copy y consolidación de documentación.

## Estado del prototipo del artista

El Build 5 de `app/ColabApp.jsx` suma edición de un pedido ya publicado sobre la lógica auditada del Build 4:

- Modalidad, ubicación y franja se guardan en el pedido y participan del matching.
- Una incompatibilidad explícita puede producir cero candidatos; nunca se reemplaza automáticamente por el pool completo.
- La recuperación curada lee las opciones actualizadas desde storage y respeta disponibilidad.
- Editar conserva referencias y respuestas compatibles, pero elimina contexto que deja de corresponder al cambiar el tipo de pedido.
- La conversación guarda la pregunta inicial y limita realmente cuatro mensajes por persona sin sobrescrituras por temporizadores.
- El fallback conserva modalidad, fecha, hora, franja y barrios básicos; un pedido ambiguo debe reformularse.
- Las operaciones críticas no avanzan cuando falla el guardado.
- **Nuevo en el Build 5:** desde "Tu proyecto ya está en movimiento" el artista tiene, además de "Cancelar pedido", la opción "Editar pedido" (ver [Actualización del prototipo — 29 de agosto de 2026](#actualización-del-prototipo--29-de-agosto-de-2026)).

**Superado.** El párrafo original de esta sección planteaba una dirección visual futura inspirada en el universo de Liminal Records (base monocromática, azul eléctrico como color funcional). Esa dirección quedó reemplazada por la paleta "estudio editorial" (cálida, clara, acento naranja quemado) que arrancó como piloto en Gate/RequestComposer/Inicio y ya se extendió a la mayor parte del flujo — ver "Para quien recién llega" al principio de este archivo para el estado actual y los tokens exactos.

### Visualizador local

El mismo `app/ColabApp.jsx` funciona también como app web interactiva (visualizador local, originalmente generado con Codex). Mantiene el JSX funcional, usa almacenamiento local cuando no está dentro de Claude Artifacts y activa el intérprete determinístico sin esperar una API externa. El visualizador permite recorrer onboarding, pedido, contexto, referencia opcional, publicación, espera, conversación y propuestas desde el navegador.

## Propósito

COLAB es una aplicación móvil que conecta artistas independientes con productores musicales. El artista cuenta con sus propias palabras qué quiere hacer; COLAB interpreta el pedido, selecciona productores relevantes y facilita conversación, propuesta, reserva, pago y continuidad del proyecto.

La hipótesis central continúa siendo:

> Un artista con una necesidad musical real recibe propuestas relevantes, elige una y paga dentro de COLAB.

La primera versión será una beta privada para iOS y Android, con React Native y Expo como opción recomendada. El panel operativo puede ser web. Matching, aprobación, soporte y resolución de casos pueden ser manuales durante el piloto.

## Principios de producto

- La prioridad comercial es el artista porque inicia el pedido y mueve el dinero.
- El productor debe recibir oportunidades relevantes, previsibilidad de cobro y poco trabajo administrativo.
- COLAB no debe sentirse como un directorio, un feed vacío ni una licitación.
- La IA interpreta y organiza por detrás; no domina la estética ni obliga al usuario a hablar en categorías profesionales.
- Se infiere primero y sólo se pregunta cuando la respuesta modifica materialmente el matching.
- Las decisiones técnicas sobre duración, equipamiento, alcance y forma de trabajo las propone el productor, no el artista.
- La abundancia percibida debe surgir de una experiencia curada y activa. No se muestran cantidades totales de artistas, productores, invitaciones o rechazos, y no se inventa actividad.
- La operación manual es válida si permite aprender antes de automatizar.

## Dirección de experiencia

### Entrada del artista

La pantalla principal conserva una entrada libre:

> **¿Qué querés hacer?**

La respuesta determina una pantalla breve y contextual, no un cuestionario general.

#### Si escribe “quiero grabar una canción”

COLAB infiere que busca una experiencia presencial y un productor con espacio para grabar. La siguiente pantalla ofrece controles simples:

- Ubicación: **Cerca mío** o **Elegir zona**.
- Franja: **Mañana**, **Tarde**, **Noche** o **Me adapto**.

No se pregunta si tiene estudio, equipo, cuántas horas necesita ni qué debe aportar el productor.

#### Si escribe “quiero hacer una canción”

Existe una ambigüedad real y se pregunta una sola cosa:

- **Presencial**, **Online** o **Puedo de las dos formas**.

Si corresponde, se muestran ubicación y franja en la misma pantalla.

#### Si escribe “quiero mezclar una canción”

No se pregunta ubicación, horario ni fecha de entrega. Puede adjuntar audio o referencias y publicar. El productor propone plazo y forma de trabajo.

#### Pedidos especiales o con fecha

COLAB puede interpretar pedidos como operador de sonido, tuner para vivo, productor para un camp o grabación móvil. No constituyen una categoría principal ni cambian la identidad profesional del productor. Si el usuario ya indicó fecha, hora o lugar, no se vuelve a preguntar. Sólo se solicita un dato imprescindible que falte.

### Espera del artista

Al publicar:

> **Tu proyecto ya está en movimiento**

> Estamos seleccionando productores que puedan encajar con lo que querés hacer. Podés cerrar la app; te avisamos cuando alguien quiera conocer mejor tu proyecto o enviarte una propuesta.

Reglas:

- No se muestra “0 de 4”, barras de progreso ni cantidad de productores invitados.
- El límite de hasta cuatro ofertas formales es interno.
- Las propuestas aparecen individualmente apenas llegan.
- Las preguntas previas no cuentan como ofertas.
- Si una búsqueda no avanza, COLAB amplía el matching o interviene manualmente antes de comunicar un problema.
- El artista puede editar o cancelar el pedido mientras está en curso (ver [Edición y cancelación de pedidos](#edición-y-cancelación-de-pedidos-29-de-agosto)).

### Recepción del pedido por el productor

El productor recibe una invitación seleccionada, no un feed abierto:

> **Hay un proyecto que podría interesarte**

La vista muestra:

- Lo que quiere hacer el artista.
- Sus palabras originales.
- Maqueta o referencias, si existen.
- Modalidad, cercanía y franja relevantes.
- Perfil interno del artista sin datos de contacto directo.
- Una explicación breve de por qué el pedido podría encajar.

Acciones:

- **Preguntar algo**.
- **Enviar oferta**.
- **Ahora no**, sin obligación de justificar.

La pantalla para preguntar muestra ejemplos auditados manualmente, pero siempre permite escribir libremente.

### Conversación previa

Decisión confirmada para el piloto (reunión del 29 de agosto):

> Antes de una oferta formal pueden enviarse hasta cuatro mensajes por persona. Al aceptar la oferta se habilita mensajería ilimitada.

- Cada mensaje puede contener texto y un archivo.
- La interfaz informa el límite y los mensajes restantes.
- Al agotarse, el productor envía una oferta o deja pasar el pedido.
- Después de una oferta el chat puede continuar sin límite, como canal principal de gestión del proyecto y resolución de conflictos.
- Un acuerdo escrito en el chat no modifica precio o alcance: se debe actualizar la tarjeta formal.

### Sesión base del productor

El productor no reconstruye cada oferta desde cero. Durante el onboarding configura su primera sesión habitual:

- Duración: 2, 3, 4 horas o depende del proyecto.
- Qué incluye normalmente.
- Presencial, online o ambas.
- En su espacio, a domicilio o a coordinar.
- Precio base que quiere cobrar.
- Disponibilidad general por días y franjas.
- Portfolio relacionado.

COLAB combina esta plantilla con el pedido y la conversación para preparar un borrador. El productor sólo confirma fecha, disponibilidad, precio y cambios específicos.

**Confirmado el 29 de agosto:** la sesión inicial es un requisito, no sólo un default. Un artista no puede contratar una producción musical completa sin haber pasado antes por una sesión inicial con ese productor; el objetivo es garantizar conocimiento mutuo antes de comprometer un proyecto completo.

Una producción completa no tiene plantilla obligatoria en la V1 porque requiere definir sesiones, entregables, revisiones, plazo y alcance. Los planes de trabajo y las propuestas de servicio los define exclusivamente el productor; la app actúa sólo como facilitadora y gestora del sistema, sin imponer estructuras rígidas.

### Oferta formal

Orden de la tarjeta para el artista:

1. Qué propone el productor para ese pedido.
2. Un trabajo relevante.
3. Precio final para el artista.
4. Primera sesión o producción completa.
5. Qué incluye y duración.
6. Modalidad, zona y disponibilidad.
7. Señales de confianza.

El precio debe ser visible sin dominar toda la decisión. No habrá ranking automático, porcentaje mágico de compatibilidad ni orden predeterminado por precio.

### Precios y monetización

- El productor indica cuánto quiere cobrar por su sesión.
- COLAB calcula internamente margen, procesamiento, financiación e impuestos aplicables.
- El artista ve un único precio final con todo incorporado.
- El productor no ve el precio final calculado para el artista ni un desglose comercial de COLAB.
- Una vez reservada la sesión, el productor sí conoce cuánto cobrará y cuándo.
- Si existen cuotas, el artista debe ver el total final y el valor real de cada cuota.
- **Confirmado el 29 de agosto:** COLAB muestra al productor un valor sugerido de mercado para el tipo de sesión, calculado sobre el promedio competitivo, para que pueda ajustar su precio con ese punto de referencia. No reemplaza su libertad para fijar el precio que quiera; es una guía para evitar brechas grandes entre productores similares.

Queda pendiente decidir si el margen se calcula como porcentaje del monto solicitado por el productor o del total cobrado al artista. También deben modelarse procesamiento, impuestos, devoluciones y contracargos antes de fijar el porcentaje, y la fórmula exacta del valor sugerido de mercado.

### Edición y cancelación de pedidos (29 de agosto)

> El artista puede editar o cancelar su pedido después de enviarlo. El sistema —no el artista— gestiona el presupuesto retenido y la reasignación del productor.

- Esto aplica mientras el pedido sigue abierto (esperando productores o con ofertas recibidas, sin una propuesta todavía aceptada).
- Editar un pedido después de haber aceptado una oferta formal queda pendiente: requiere modelar primero la reserva, el pago retenido y la reasignación de fondos, que todavía no existen en el prototipo (ver [Próximo bloque de trabajo](#próximo-bloque-de-trabajo)).
- Ante una cancelación **por parte del productor** (no del artista), la app debe gestionar la conexión con un nuevo proveedor o proceder con reembolso o cupón de descuento, con un esquema de reembolso parcial/total según el tiempo de anticipación (modelo tipo Airbnb). El desarrollo de esta funcionalidad se prioriza sobre la resolución de escenarios extremos.

### Falta de propuestas y agenda

Si ningún productor avanza, no se comunica que “nadie quiso” el proyecto. COLAB diagnostica manualmente si faltó información, disponibilidad, cercanía o respuesta de la oferta.

Recuperación propuesta:

1. Pedir una única aclaración si existe una duda concreta.
2. Ampliar internamente el matching.
3. Ofrecer una selección corta de productores compatibles con horarios disponibles.

La agenda permite que el artista elija una sesión base y un horario, y se muestra antes de la pantalla de pago. Para la V1:

- El productor carga bloques disponibles manualmente.
- La conexión con calendarios externos queda para después.
- La confirmación previa del productor es la opción predeterminada.
- La reserva instantánea puede ser opcional para productores aprobados.
- El horario se paga sólo después de la confirmación.

### Reserva, pago y sesión

- El artista revisa productor, alcance, fecha, duración, zona, inclusiones, política aplicable y precio final antes de pagar.
- Las otras propuestas no se cierran hasta que el pago se confirma.
- La dirección exacta se libera después del pago y de la verificación correspondiente.
- Para presencial, se registra si el artista irá acompañado.
- Cerca del horario se habilita un PIN de cuatro dígitos para iniciar la sesión.
- Después se crea una sala por canción con chat, archivos, oferta, pagos y nueva reserva.

**Esquema de pago confirmado el 29 de agosto:**

1. Seña del 25% al aceptar el presupuesto.
2. Saldo restante (75%) 24 horas antes de la sesión.
3. Liberación del pago al productor una vez finalizada la sesión y tras la subida y aceptación del archivo de audio correspondiente por parte del artista.

**Sistema de valoraciones (29 de agosto):** al finalizar la sesión, tanto el artista como el productor pueden calificarse y reseñarse mutuamente. Esto alimenta el sistema de reputación del productor (ver [Sistema de reputación del productor](#sistema-de-reputación-del-productor-29-de-agosto)).

## Onboarding y perfil del productor

Principio:

> **Cualquiera puede postularse. No cualquiera queda aprobado.**

El onboarding debe cubrir aproximadamente 10–12 bloques:

- Identidad y nombre profesional.
- Zona y movilidad.
- Presencial, online o ambas.
- Tipo de espacio y fotos reales.
- Servicios y etapas de producción.
- Géneros, sonidos e intereses.
- Tres trabajos de portfolio y rol exacto.
- Redes o perfiles verificables.
- Sesión base y precio.
- Disponibilidad general.
- Capacidades opcionales para matching: grabación móvil, sonido en vivo, tuner o efectos vocales, asistencia en shows y otras tareas.
- Verificación y aceptación de reglas.

Las capacidades opcionales son datos internos para matching. No crean profesiones separadas ni prometen trabajo de esas categorías.

La definición de qué funcionalidades de perfil habilitar (por ejemplo, subir trabajos de audio o portfolio propio) y sus implicancias de seguridad/privacidad queda postergada para profundizar en la próxima reunión (ver [Decisiones abiertas](#decisiones-abiertas)).

### Sistema de reputación del productor (29 de agosto)

- Se basa en métricas de cumplimiento: cancelaciones, reseñas y otros indicadores de calidad.
- Se representa visualmente con una barra de colores, en la línea de Mercado Libre.
- Un mejor puntaje otorga mayor visibilidad y ranking en la app; los niveles bajos reciben penalizaciones de visibilidad, con mecanismos claros para recuperar el estado mediante buenas prácticas.
- Queda pendiente definir la fórmula exacta de puntaje y los umbrales de cada nivel.

## Métricas del piloto

- Tiempo hasta el primer productor interesado.
- Tiempo hasta la primera oferta formal.
- Productores invitados, interesados y oferentes.
- Cantidad de mensajes antes de una oferta.
- Preguntas más frecuentes y efecto sobre la conversión.
- Uso y corrección de defaults de modalidad, ubicación y franja.
- Ofertas vistas, elegidas y motivos de elección.
- Diferencia entre sesión base y oferta enviada.
- Intentos de pago, pagos confirmados y abandono.
- Cancelaciones, ausencias, disputas y segundas reservas.
- Frecuencia de edición de pedidos ya publicados y su efecto sobre la conversión (nueva métrica, 29 de agosto).

Una pregunta del productor sólo se convierte en campo del producto si se repite, el artista puede responderla y reduce fricción o mejora la contratación.

## Operación manual del piloto

El equipo puede:

- Aprobar productores.
- Revisar fotos, identidad y portfolio.
- Clasificar pedidos.
- Elegir a quién invitar.
- Auditar preguntas y propuestas.
- Evitar que más de cuatro ofertas formales compitan por el mismo pedido.
- Ampliar búsquedas sin exponer problemas de liquidez.
- Resolver casos ambiguos, cancelaciones y reclamos.

## Estrategia de producto y mercado (29 de agosto)

- **Apps independientes:** se mantienen aplicaciones separadas para el mercado de audio y el mercado audiovisual. No se consolidan en una sola plataforma por el momento, para no diluir la propuesta de valor ni saturar la experiencia de un tipo de usuario con necesidades de otro mercado. Un eventual producto audiovisual sería una app distinta.
- **Facturación para productores:** la app podría facilitar que los productores formalicen sus ingresos (monotributo). Esto es un valor agregado importante, pero requiere definir con un contador o abogado el esquema legal y contractual antes de comprometerse (ver [Decisiones abiertas](#decisiones-abiertas)).
- **Metodología de validación:** en lugar de formularios, se usan entrevistas directas de ~15 minutos con artistas y productores reales, evitando preguntas que sesguen o condicionen las respuestas sobre el uso de la app. El roadmap y el flujo de usuario se documentan visualmente en una pizarra de Canva en lugar de un documento compartido.

## Roadmap recomendado

### Fase 1 — Cerrar el contrato de producto

1. Consolidar las 10–12 preguntas finales del productor y su visibilidad pública, privada o de matching.
2. Definir reglas de interpretación para grabar, hacer, producir, mezclar y pedidos con fecha.
3. Cerrar el flujo de cuatro mensajes, oferta formal y actualización de condiciones.
4. Definir sesión base, agenda manual, confirmación previa y reserva instantánea opcional.
5. Modelar el precio final, margen, procesamiento, cuotas, impuestos y devoluciones — incluyendo la fórmula del valor sugerido de mercado para el productor.
6. Definir la fórmula de reputación del productor y sus umbrales de visibilidad/penalización.
7. Cerrar con un contador o abogado el esquema legal y contractual de facturación del productor.

Resultado: especificación breve y sin contradicciones para diseñar las pantallas.

### Fase 2 — Wireflow y prototipo visual

Diseñar aproximadamente 15 pantallas centrales:

1. Inicio del artista.
2. Interpretación de “grabar una canción”.
3. Interpretación de “hacer una canción”.
4. Confirmación y publicación.
5. Proyecto en movimiento (con edición y cancelación de pedido).
6. Invitación al productor.
7. Detalle del pedido.
8. Pregunta libre y conversación limitada.
9. Sesión base del productor.
10. Borrador de oferta.
11. Oferta recibida por el artista.
12. Selección de propuestas.
13. Productores con horarios disponibles.
14. Reserva, confirmación y pago (seña 25% + saldo 24 h antes).
15. Sesión confirmada, PIN, sala de la canción y valoraciones mutuas.

Probar el prototipo con frases reales y sin explicar el flujo.

### Fase 3 — Prueba concierge sin automatización completa

- Incorporar 10–15 productores aprobados.
- Conseguir cinco artistas con necesidades musicales reales.
- Procesar pedidos y matching manualmente.
- Simular límites, notificaciones y agenda con operación humana.
- Cobrar una parte real al artista y garantizar al productor el monto acordado.
- Registrar preguntas, rechazos, tiempos y motivos de elección.

Resultado: evidencia de que existe demanda, respuesta y voluntad de pago.

### Fase 4 — Construir la beta móvil

- React Native y Expo.
- Cuentas y perfiles.
- Pedidos libres e interpretación asistida.
- Invitaciones y matching operado desde un panel.
- Chat limitado antes de oferta.
- Propuestas formales y actualizaciones.
- Edición y cancelación de pedidos publicados, con reasignación gestionada por el sistema.
- Agenda manual.
- Reserva, pago (seña + saldo) y notificaciones.
- PIN y sala básica de la canción.
- Valoraciones mutuas y reputación básica del productor.

Mantener fuera de alcance almacenamiento avanzado, splits, distribución y gestión completa de carrera.

### Fase 5 — Piloto privado con pagos reales

- Distribución mediante TestFlight y prueba privada en Android.
- Pagos, cuotas y soporte reales.
- Políticas de cancelación y devolución con reembolso parcial/total según anticipación (tipo Airbnb).
- Verificación de identidad proporcional al riesgo.
- Operación manual de disputas y conciliación.
- Facturación de productores conforme al esquema legal definido con asesores.

Antes de ampliar el acceso, validar estructura legal, contable y financiera con profesionales argentinos.

### Fase 6 — Lanzamiento limitado en CABA

Abrir por zonas sólo cuando exista suficiente densidad de artistas y productores. Automatizar matching, agenda y soporte únicamente donde el piloto demuestre una necesidad repetida.

## Decisiones abiertas

- Texto final de las sugerencias de preguntas del productor.
- Cantidad y ritmo de invitaciones internas para obtener hasta cuatro ofertas.
- Tiempo antes de ampliar una búsqueda o mostrar agenda disponible.
- Tiempo del productor para confirmar un horario y del artista para pagarlo.
- Fórmula exacta del margen de COLAB y del valor sugerido de mercado.
- Proveedor de pagos y costo concreto de cuotas.
- Umbrales y fórmula visual del sistema de reputación del productor.
- Porcentajes exactos de reembolso según anticipación en cancelaciones.
- Esquema legal y contractual de facturación (monotributo) para productores — a definir con contador/abogado.
- Alcance de identidad verificada.
- Criterios para publicar portafolios y trabajos previos de audio en el perfil de usuario — postergado a la próxima reunión.
- Color acento e identidad visual definitiva.

## Próximo bloque de trabajo

- Crear el wireflow completo de las 15 pantallas (pizarra Canva) y probarlo contra al menos diez frases distintas de artistas.
- Cerrar el onboarding definitivo del productor y preparar un prototipo navegable para testear comprensión sin explicación.
- Organizar la jornada de entrevistas a artistas y productores (formato en persona, ~15 minutos, sin preguntas sesgadas); pedir a la diseñadora Agus sugerencias de preguntas.
- Modelar el resto del flujo (saldo a 24h, liberación de fondos, PIN, sala de canción — ver "Pendiente después de este bloque" más arriba). La edición de pedidos después de elegir una propuesta sigue sin ofrecerse a propósito, no como algo por resolver: una vez hay un profesional elegido, corresponde cancelar y volver a publicar, no reabrir el matching.
- Diseñar el sistema de reputación del productor (indicadores y umbrales) y la política de reemplazo/reembolso ante cancelación del productor.
- Consultar con contador o abogado el esquema de facturación de productores.
- Definir criterios de perfil de usuario y portafolio de audio.
- Próxima reunión: martes 1 de septiembre de 2026, seguimiento de avances.

## Actualización del prototipo — 28 de agosto de 2026

### Acceso y nombre artístico

- El ingreso inicial ofrece Google, Apple y mail.
- “Iniciar sesión con Apple” y “conectar Apple Music” son funciones distintas. Apple Music queda como integración opcional posterior para referencias, no como método de autenticación.
- El nombre artístico mantiene ejemplos que se escriben y borran incluso cuando la caja está enfocada, hasta que la persona empieza a escribir. La lista actual del prototipo es Duki, Saito, CND, Prize, J4mes, Tysan, Dillom y K4.

### Interpretación del pedido

- La entrada sigue siendo texto libre y debe tolerar escritura rápida, faltas, fonética y lunfardo.
- Casos mínimos de prueba: “quiero haser una cansion”, “cuanto sale grabar un tema” y “tengo una cansion que no se cuando sacarla pero quiero gravar”.
- Nunca corregir ni juzgar al artista. Inferir intención por contexto, conservar el texto original y pedir reformulación sólo cuando no sea posible entender sin inventar.

### Referencias, archivos y confianza

- Adjuntar una maqueta, audio o enlace sigue siendo opcional.
- El archivo debe presentarse explícitamente como material del artista.
- En el prototipo local el archivo no se sube: sólo se conserva su nombre. En producto real se necesita almacenamiento privado, enlaces de acceso temporales, permisos limitados a productores invitados, registro de accesos, borrado solicitado por el artista y una política definida de eliminación automática.
- La interfaz puede explicar que el material no se publica y que COLAB no adquiere derechos. Esto no reemplaza términos, política de privacidad ni revisión legal.
- Evitar almacenamiento indefinido: la retención debe depender del estado del pedido y tener un plazo cerrado antes del piloto.

### Géneros

- Cerca del final del pedido, después de la referencia, se pregunta con qué géneros se siente cómodo el artista.
- Es selección múltiple e incluye “Todavía no sé”.
- Sirve para matching y no debe sentirse como una etiqueta rígida ni reemplazar lo que la IA detecta en el texto o las referencias.

### Conversación desde una propuesta

- Cada propuesta tiene dos acciones principales: “Enviar mensaje” y “Elegir propuesta”.
- Abrir el chat desde una propuesta no genera otra oferta ni modifica automáticamente la propuesta existente.
- Se conserva el límite visible de cuatro mensajes por persona antes de decidir. Al llegar al límite, el artista vuelve a la propuesta.
- Si todavía no había propuesta formal, la conversación puede terminar en una oferta decidida por el productor, como ya estaba definido.

### Pendientes específicos de esta actualización

- Definir duración y eliminación automática de archivos reales.
- Redactar términos de confidencialidad y prohibición de reutilización o redistribución con asesoramiento legal argentino.
- Decidir si Apple Music se integra en referencias durante el piloto o se posterga.
- Probar el intérprete con un corpus real de escritura de artistas y medir correcciones manuales.

### Ajuste de ubicación y lenguaje visual

- Se descartó el módulo rectangular para las opciones compactas (`ChoiceChip`, borde y línea azul inferior). El prototipo vuelve al listado tipo fila con línea divisoria (`BigOption`): texto en negrita y un punto azul junto a la opción seleccionada.
- Las etiquetas de las opciones se muestran en minúscula.
- Se elimina “toda CABA”. El artista puede elegir “cerca mío”, que primero explica por qué hace falta la ubicación y recién después solicita permiso, o “elegir zona”.
- La selección manual inicial ofrece Palermo, Villa Crespo, Almagro, Colegiales, Belgrano, Caballito y Chacarita, más “otra zona” con escritura libre. Esta lista es operativa para el prototipo y debe ajustarse según la oferta real del piloto.

### Inferencia y confirmación de género

- COLAB puede inferir señales de género desde el texto original, artistas mencionados, enlaces y nombres de archivos. Una maqueta real podrá aportar señales de sonido y clima cuando exista análisis de audio, pero no debe convertir una inferencia en verdad definitiva.
- Toda inferencia se muestra al artista antes de publicar. Si detecta, por ejemplo, trap y urbano, ambos aparecen preseleccionados bajo “¿Va por acá?” y el artista puede confirmarlos, quitarlos o agregar otros.
- Si no se detecta ninguna señal, la app pregunta “¿Por dónde va tu música?” sin preseleccionar nada.
- El matching combina estas señales confirmadas con modalidad, ubicación, horario, servicio pedido y capacidades del productor. El género ayuda a ordenar compatibilidad, pero no decide solo.

## Actualización del prototipo — 29 de agosto de 2026

Cambios de código en `app/ColabApp.jsx` (Build 5), a partir de la decisión de la reunión del 29 de agosto de habilitar edición de pedidos tras el envío.

### Edición de pedidos publicados

- Desde “Tu proyecto ya está en movimiento” el artista ahora tiene, junto a “Cancelar pedido”, la opción “Editar pedido”.
- Editar reabre el mismo flujo de clasificación → contexto → resumen que se usa antes de publicar, con los valores existentes precargados en modo revisión (`reviewExisting`), incluyendo la posibilidad de reescribir el texto original del pedido.
- Al confirmar la edición (“Actualizar pedido”), se actualiza el pedido existente (mismo id) en lugar de crear uno nuevo: se recalculan tipo, contexto de matching y géneros; se limpian intereses, ofertas, curados y estado de recuperación; el estado vuelve a “esperando”; y se reinicia la simulación de productores sobre los datos nuevos. El artista lo ve anunciado explícitamente antes de confirmar (“las conversaciones y propuestas que ya tenías se cierran y volvemos a buscar productores con los datos nuevos”), consistente con que es el sistema —no el artista— quien gestiona la reasignación.
- El artista puede abandonar la edición en cualquier punto y volver a su pedido sin guardar cambios (“‹ Volver a mi pedido”).
- **Fuera de alcance de este build:** editar un pedido después de haber elegido una propuesta formal (estado `propuesta_elegida`, ver sección más arriba) — la interfaz ya no ofrece "Editar pedido" en ese caso (corregido el 30 de agosto, ver "Primer tramo de contratación" más arriba). El aviso "próximo paso: coordinar horario, reserva y pago" que se mostraba acá se reemplazó por el flujo real de horario y seña simulada implementado ese mismo día; la reasignación de fondos retenidos ante una cancelación posterior a la reserva sigue pendiente de un esquema de devoluciones.
