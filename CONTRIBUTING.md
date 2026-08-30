# Convenciones de desarrollo de COLAB

## Idioma del código

- Usar inglés para archivos, variables, funciones, componentes, tipos y comentarios técnicos nuevos.
- Usar español rioplatense para el texto que ve la persona dentro de la aplicación.
- La documentación de producto puede estar en español; la documentación de APIs puede usar inglés si facilita el trabajo con proveedores externos.

## Compatibilidad con datos existentes

El prototipo ya guarda campos y estados en español, por ejemplo `estado`, `esperando` y `propuesta_elegida`. No deben renombrarse de forma mecánica: `localStorage` y, más adelante, el backend pueden contener esos valores. Cualquier cambio de esquema requiere:

1. una versión nueva del modelo;
2. una migración idempotente;
3. compatibilidad temporal con datos anteriores;
4. pruebas de lectura y escritura para ambas versiones.

La regla para código nuevo es inglés, pero preservar un contrato persistido es más importante que lograr uniformidad visual inmediata.

## Antes de entregar un cambio

- Ejecutar `pnpm test`.
- Ejecutar `pnpm build`.
- Verificar el recorrido afectado en tamaño móvil.
- Documentar decisiones de producto o migraciones en `context.md`.
- No incluir claves, tokens ni secretos en React, variables `VITE_*`, commits o capturas.
