# COLAB — contexto y roadmap

Actualizado: 29 de agosto de 2026.

## Navegación por pestañas (sesión del 29 de agosto de 2026 con Claude Code)

El prototipo del artista dejó de ser un flujo 100% lineal: ahora es una app navegable con una **barra inferior fija** de cuatro pestañas — Inicio, Pedidos, Mensajes, Perfil — construida sobre la misma lógica de negocio ya auditada (matching, chat con límite de 4 mensajes, edición, recuperación). No se tocó ninguna decisión de producto ya cerrada; esto es exclusivamente arquitectura de navegación.

**Archivos nuevos:**
- `app/theme.js` — `COLORS`, en un archivo sin dependencias propias. Tuvo que separarse de `ColabApp.jsx` porque `ColabApp.jsx` y `RootScreens.jsx` se importan mutuamente (`RootScreens` usa piezas visuales de `ColabApp`; `ColabApp` arma la navegación con las pantallas de `RootScreens`), y `COLORS` se usaba en el nivel superior de ambos módulos — ese ciclo con un valor usado top-level dispara un `ReferenceError: Cannot access 'COLORS' before initialization` al cargar. El resto de las piezas compartidas (`Screen`, `PrimaryButton`, `TextLink`, `Label`, `UnderlineField`, `ProducerPhoto`, `storageGet`/`storageSet`, `REQUESTS_KEY`/`PROFILE_KEY`, etc.) no tuvo ese problema porque solo se usan dentro de cuerpos de función, no en el nivel superior del módulo — se exportaron desde `ColabApp.jsx` tal cual estaban, sin moverlas.
- `app/BottomNav.jsx` — la barra inferior y sus 4 íconos (SVG en línea, sin librería).
- `app/RootScreens.jsx` — `HomeScreen`, `OrdersScreen`, `MessagesScreen`, `ProfileScreen`, `HelpScreen`, `PrivacyScreen`, `EditNameScreen`. Cada pantalla lee sus propios pedidos de `localStorage` con el mismo patrón de polling que ya usaba `WaitingScreen`, filtrados por `artistName === profile.name` (antes no existía ningún filtro por artista, porque nunca había una pantalla que listara "todos mis pedidos").

**Cómo se decide pestañas vs. flujo interno**, en `App` (`ColabApp.jsx`): un solo booleano, `inFlowMode`, es `true` si hay una creación/edición en curso, un pedido abierto, una conversación, una oferta, "elegiste a X", Ayuda, Privacidad o edición de perfil — en ese caso se oculta la barra y se muestra la pantalla interna correspondiente con su propio "‹ Atrás". Si no, se muestra la pestaña activa (`activeTab`) con la barra visible. Cambiar de pestaña nunca toca `request`/`classification`/etc., así que la pestaña activa persiste sola mientras se navega — no hizo falta llevar un registro de "desde dónde se abrió cada pantalla".

**Bugs reales encontrados y corregidos durante esta implementación** (no eran bugs antes porque no existía forma de "volver" desde esas pantallas):
1. `handlePublish`/`handleUpdateRequest` nunca limpiaban `classification`/`context` al terminar. Con el nuevo botón "‹ Atrás" en `WaitingScreen`, volver desde un pedido recién publicado mostraba de nuevo el resumen viejo en vez de la pestaña Pedidos. Se agregó `handleCloseRequestDetail` que limpia todo correctamente.
2. Cambiar el nombre artístico (Perfil → Editar) no actualizaba el `artistName` de los pedidos ya guardados — como Pedidos/Mensajes/Inicio filtran por ese campo (no hay un id de usuario en este prototipo), renombrarse "perdía" el historial. Ahora `handleSaveProfileName` migra `artistName` en todos los pedidos existentes al guardar el nuevo nombre.
3. Un pedido cancelado con el feed vacío seguía mostrando "Tu proyecto ya está en movimiento" y "buscando productores", que ya no es cierto. Ahora muestra un texto acorde ("Este pedido fue cancelado…").

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

La dirección visual futura incorpora parte del universo de Liminal Records: base monocromática, composición editorial, fotografía musical cruda, grano controlado y tipografía mono para metadata. COLAB conserva identidad propia y usa azul eléctrico como color funcional; no copia mecánicamente el logo ni la estrella de Liminal.

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
- Modelar reserva, pago retenido, agenda y liberación de fondos en el prototipo, para poder extender la edición de pedidos a después de una oferta aceptada.
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
- **Fuera de alcance de este build:** editar un pedido después de haber elegido una propuesta formal. `ChosenScreen` sigue siendo un placeholder a la espera del prototipo de reserva, pago y agenda; recién ahí tiene sentido modelar la reasignación de fondos retenidos que pide la decisión de la reunión (seña del 25%, saldo y liberación post-sesión).
