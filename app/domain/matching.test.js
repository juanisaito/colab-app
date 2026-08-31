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

// Pool real de "grabar" (matching.js): Tomás Ibarra ["Tarde"],
// Flor Medina ["Noche"], Lucas Peralta ["Mañana","Tarde"].

test("timeSlots con una franja: coincide con cualquier productor que la sirva", () => {
  const { productores } = pickProducers("grabar", [], { timeSlots: ["Tarde"] });
  const nombres = productores.map((p) => p.productor).sort();
  assert.deepEqual(nombres, ["Lucas Peralta", "Tomás Ibarra"]);
});

test("timeSlots con dos franjas: coincide si el productor sirve al menos una (unión, no intersección)", () => {
  const { productores } = pickProducers("grabar", [], { timeSlots: ["Mañana", "Noche"] });
  const nombres = productores.map((p) => p.productor).sort();
  assert.deepEqual(nombres, ["Flor Medina", "Lucas Peralta"]);
});

test("'Me adapto' no filtra por franja: coinciden todos los productores del pool", () => {
  const { productores } = pickProducers("grabar", [], { timeSlots: ["Me adapto"] });
  assert.equal(productores.length, 3);
});

test("contexto con franja legada (string suelto, sin timeSlots) sigue filtrando igual", () => {
  const { productores } = pickProducers("grabar", [], { franja: "Tarde" });
  const nombres = productores.map((p) => p.productor).sort();
  assert.deepEqual(nombres, ["Lucas Peralta", "Tomás Ibarra"]);
});

test("timeSlots en minúscula (tal como lo devuelve el intérprete) filtra igual que la forma canónica", () => {
  const { productores } = pickProducers("grabar", [], { timeSlots: ["tarde"] });
  const nombres = productores.map((p) => p.productor).sort();
  assert.deepEqual(nombres, ["Lucas Peralta", "Tomás Ibarra"]);
});
