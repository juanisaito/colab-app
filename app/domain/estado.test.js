import test from "node:test";
import assert from "node:assert/strict";
import {
  esPropuestaElegida, esCancelado, esActivo, tieneProfesionalElegido,
  puedeRecibirActividadDeProductores, puedeCancelarse, requestNeedsArtistInput,
  puedeEscribirEnConversacion,
} from "./estado.js";

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

test("puedeCancelarse usa una lista permitida y rechaza estados desconocidos", () => {
  assert.equal(puedeCancelarse("esperando"), true);
  assert.equal(puedeCancelarse("con_ofertas"), true);
  for (const status of ["propuesta_elegida", "cerrado", "reservado", "cancelado", "desconocido", undefined]) {
    assert.equal(puedeCancelarse(status), false);
  }
});

test("requestNeedsArtistInput bloquea otro pedido sólo mientras falta una aclaración activa", () => {
  assert.equal(requestNeedsArtistInput({ estado: "esperando", recovery: "aclaracion" }), true);
  assert.equal(requestNeedsArtistInput({ estado: "con_ofertas", recovery: "aclaracion" }), true);
  assert.equal(requestNeedsArtistInput({ estado: "esperando", recovery: null }), false);
  assert.equal(requestNeedsArtistInput({ estado: "reservado", recovery: "aclaracion" }), false);
  assert.equal(requestNeedsArtistInput(null), false);
});

test("puedeEscribirEnConversacion rechaza pedidos ausentes o con estados desconocidos", () => {
  assert.equal(puedeEscribirEnConversacion(null, "A"), false);
  assert.equal(puedeEscribirEnConversacion({ estado: "desconocido", ofertas: [] }, "A"), false);
  assert.equal(puedeEscribirEnConversacion({ estado: "esperando", ofertas: [] }, "A"), true);
  assert.equal(puedeEscribirEnConversacion({ estado: "propuesta_elegida", ofertas: [] }, "A"), true);
});
