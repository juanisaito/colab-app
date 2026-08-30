import test from "node:test";
import assert from "node:assert/strict";
import { calculateArtistFinalPrice } from "./pricing.js";

test("agrega la comisión simulada del 10% y redondea a centenas", () => {
  assert.equal(calculateArtistFinalPrice(45000), 49500);
  assert.equal(calculateArtistFinalPrice(52000), 57200);
});

test("con monto 0, el precio final simulado es 0", () => {
  assert.equal(calculateArtistFinalPrice(0), 0);
});
