# IA en COLAB

## Qué funciona en este prototipo

La interpretación del pedido usa un endpoint del servidor (`POST /api/interpret`). La clave del proveedor nunca llega a React ni se incluye en el build. En desarrollo y en `vite preview`, Vite expone ese endpoint y llama a la API de Anthropic. Si el endpoint no está configurado, tarda demasiado o devuelve una estructura inválida, la app usa el intérprete local y avisa al artista en el resumen.

Para probarlo localmente:

1. Copiar `.env.example` como `.env.local`.
2. Completar `ANTHROPIC_API_KEY` con una clave de API. La suscripción de Claude y el consumo de la API son productos y facturaciones separados.
3. Ejecutar `pnpm dev`.

La ruta incluida en Vite sirve para desarrollo y demostración. Al publicar la aplicación, el mismo contrato debe vivir en un backend o función serverless con autenticación, rate limiting, métricas y control de costos.

## Cómo completar la IA del producto

No conviene usar un único prompt para todo. Cada capacidad necesita su propio contrato, validación y evaluación:

1. **Interpretación de pedidos:** salida estructurada y validada. Es el módulo conectado ahora.
2. **Sugerencias mientras escribe:** frases breves basadas en el texto parcial, sin decidir por el artista. Primero deben validarse las sugerencias animadas estáticas antes de pagar inferencia en cada tecla.
3. **Soporte:** respuestas basadas únicamente en políticas y preguntas frecuentes versionadas, con derivación humana cuando no exista una respuesta segura. No debe inventar reglas de pagos, devoluciones o derechos.
4. **Explicación del matching:** explicar por qué una persona encaja usando señales ya calculadas; la IA no debe aprobar productores ni decidir sola quién aparece.
5. **Moderación y seguridad:** detectar datos sensibles, abuso y solicitudes riesgosas antes de enviar contenido a terceros.

Antes de un piloto real hacen falta registros sin datos sensibles, límites por usuario, presupuesto máximo, pruebas con frases reales, métricas de fallback y una suite de evaluaciones para errores frecuentes, lunfardo y faltas de ortografía.
