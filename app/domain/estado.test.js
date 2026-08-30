import test from "node:test";
import assert from "node:assert/strict";
import { esPropuestaElegida, esCancelado, esActivo, tieneProfesionalElegido, puedeRecibirActividadDeProductores } from "./estado.js";

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
  assert.equal(esActivo("reservado"), true);
  assert.equal(esActivo("cancelado"), false);
});

test("tieneProfesionalElegido cubre propuesta_elegida, el legacy 'cerrado' y 'reservado'", () => {
  assert.equal(tieneProfesionalElegido("propuesta_elegida"), true);
  assert.equal(tieneProfesionalElegido("cerrado"), true);
  assert.equal(tieneProfesionalElegido("reservado"), true);
  assert.equal(tieneProfesionalElegido("esperando"), false);
  assert.equal(tieneProfesionalElegido("con_ofertas"), false);
  assert.equal(tieneProfesionalElegido("cancelado"), false);
});

test("puedeRecibirActividadDeProductores sólo es true para 'esperando' y 'con_ofertas'", () => {
  assert.equal(puedeRecibirActividadDeProductores("esperando"), true);
  assert.equal(puedeRecibirActividadDeProductores("con_ofertas"), true);
  assert.equal(puedeRecibirActividadDeProductores("propuesta_elegida"), false);
  assert.equal(puedeRecibirActividadDeProductores("reservado"), false);
  assert.equal(puedeRecibirActividadDeProductores("cerrado"), false);
  assert.equal(puedeRecibirActividadDeProductores("cancelado"), false);
});
