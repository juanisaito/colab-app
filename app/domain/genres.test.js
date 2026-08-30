import test from "node:test";
import assert from "node:assert/strict";
import { detectGeneros } from "./genres.js";

test("detecta géneros por keyword directa en el texto", () => {
  const generos = detectGeneros("quiero hacer un tema de trap y reggaeton");
  assert.ok(generos.includes("trap"));
  assert.ok(generos.includes("reggaeton"));
});

test("detecta géneros a partir de un artista de referencia mencionado", () => {
  const generos = detectGeneros("quiero algo estilo Duki");
  assert.ok(generos.includes("urbano"));
  assert.ok(generos.includes("trap"));
});

test("no detecta nada en un texto sin señales de género", () => {
  const generos = detectGeneros("quiero grabar una cancion el sabado");
  assert.deepEqual(generos, []);
});
