import test from "node:test";
import assert from "node:assert/strict";
import { esPropuestaElegida, esCancelado, esActivo } from "./estado.js";

test("esPropuestaElegida trata el estado legacy 'cerrado' igual que 'propuesta_elegida'", () => {
  assert.equal(esPropuestaElegida("propuesta_elegida"), true);
  assert.equal(esPropuestaElegida("cerrado"), true);
  assert.equal(esPropuestaElegida("esperando"), false);
  assert.equal(esPropuestaElegida("con_ofertas"), false);
  assert.equal(esPropuestaElegida("cancelado"), false);
});

test("esCancelado sólo es true para el estado 'cancelado'", () => {
  assert.equal(esCancelado("cancelado"), true);
  assert.equal(esCancelado("esperando"), false);
  assert.equal(esCancelado("propuesta_elegida"), false);
  assert.equal(esCancelado("cerrado"), false);
});

test("esActivo es true para cualquier estado salvo 'cancelado' (no hay 'finalizado' todavía)", () => {
  assert.equal(esActivo("esperando"), true);
  assert.equal(esActivo("con_ofertas"), true);
  assert.equal(esActivo("propuesta_elegida"), true);
  assert.equal(esActivo("cerrado"), true);
  assert.equal(esActivo("cancelado"), false);
});
