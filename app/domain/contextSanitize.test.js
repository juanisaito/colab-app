import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeContextForClassification } from "./contextSanitize.js";

test("cambiar el tipo a 'mezclar' descarta ubicación/franja pero conserva otros campos", () => {
  const previousContext = {
    modalidad: "presencial",
    ubicacion: "Palermo",
    coordinates: { lat: 1, lng: 2 },
    franja: "Tarde",
    generos: ["rock"],
    referenciaLink: "http://ejemplo.com",
  };
  const next = sanitizeContextForClassification(previousContext, "grabar", { tipo: "mezclar" });
  assert.equal(next.modalidad, "online");
  assert.equal(next.ubicacion, null);
  assert.equal(next.coordinates, null);
  assert.equal(next.franja, null);
  // Géneros y referencia no dependen de modalidad/ubicación: se conservan.
  assert.deepEqual(next.generos, ["rock"]);
  assert.equal(next.referenciaLink, "http://ejemplo.com");
});

test("sin cambio de tipo, conserva ubicación y franja ya elegidas", () => {
  const previousContext = { modalidad: "presencial", ubicacion: "Palermo", franja: "Tarde" };
  const next = sanitizeContextForClassification(previousContext, "grabar", { tipo: "grabar", locationText: null, timeSlot: null });
  assert.equal(next.ubicacion, "Palermo");
  assert.equal(next.franja, "Tarde");
});

test("null si no había contexto previo (todavía no se completó ContextStep)", () => {
  assert.equal(sanitizeContextForClassification(null, "grabar", { tipo: "mezclar" }), null);
});
