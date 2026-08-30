import test from "node:test";
import assert from "node:assert/strict";
import { interpretFallback } from "./interpretation.js";

test("interpreta 'grabar' como presencial siempre", () => {
  const result = interpretFallback("quiero grabar una cancion el sabado en Palermo");
  assert.equal(result.tipo, "grabar");
  assert.equal(result.modalidad, "presencial");
});

test("interpreta 'hacer' sin poder inferir modalidad, y la marca como dato faltante", () => {
  const result = interpretFallback("quiero haser una cansion");
  assert.equal(result.tipo, "hacer");
  assert.equal(result.modalidad, null);
  assert.ok(result.datos_faltantes.includes("modalidad"));
});

test("interpreta 'mezclar' como online, sin pedir ubicación", () => {
  const result = interpretFallback("quiero mezclar mi cancion");
  assert.equal(result.tipo, "mezclar");
  assert.equal(result.modalidad, "online");
});

test("interpreta un pedido especial sin fecha ni horario y marca el dato faltante", () => {
  const result = interpretFallback("necesito un sonidista para un show");
  assert.equal(result.tipo, "especial");
  assert.ok(result.datos_faltantes.includes("fecha_hora"));
});

test("un pedido especial con fecha y horario explícitos no pide más datos", () => {
  const result = interpretFallback("necesito un tuner el sabado a las 21 en Palermo");
  assert.equal(result.tipo, "especial");
  assert.equal(result.dateText, "sabado");
  assert.ok(!result.datos_faltantes.includes("fecha_hora"));
});
