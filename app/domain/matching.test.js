import test from "node:test";
import assert from "node:assert/strict";
import { pickProducers } from "./matching.js";

test("una modalidad incompatible con todo el pool produce cero resultados, no el pool completo", () => {
  // Ningún productor de "mezclar" es presencial.
  const { productores } = pickProducers("mezclar", [], { modalidad: "presencial" });
  assert.deepEqual(productores, []);
});

test("un género que ningún productor del tipo pedido cubre también produce cero resultados", () => {
  // Ningún productor de "grabar" tiene "electronica" entre sus géneros.
  const { productores } = pickProducers("grabar", ["electronica"], {});
  assert.deepEqual(productores, []);
});

test("sin restricciones de género, devuelve los productores compatibles con el contexto", () => {
  const { productores } = pickProducers("grabar", [], {});
  assert.ok(productores.length > 0);
});
