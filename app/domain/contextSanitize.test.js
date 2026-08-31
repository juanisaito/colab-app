import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeContextForClassification } from "./contextSanitize.js";

test("cambiar el tipo a 'mezclar' descarta ubicación/horario pero conserva otros campos", () => {
  const previousContext = {
    modalidad: "presencial",
    ubicacion: "Palermo",
    coordinates: { lat: 1, lng: 2 },
    timeSlots: ["Tarde"],
    generos: ["rock"],
    referenciaLink: "http://ejemplo.com",
  };
  const next = sanitizeContextForClassification(previousContext, "grabar", { tipo: "mezclar" });
  assert.equal(next.modalidad, "online");
  assert.equal(next.ubicacion, null);
  assert.equal(next.coordinates, null);
  assert.deepEqual(next.timeSlots, []);
  // Géneros y referencia no dependen de modalidad/ubicación: se conservan.
  assert.deepEqual(next.generos, ["rock"]);
  assert.equal(next.referenciaLink, "http://ejemplo.com");
});

test("sin cambio de tipo, conserva ubicación y horario ya elegidos", () => {
  const previousContext = { modalidad: "presencial", ubicacion: "Palermo", timeSlots: ["Tarde", "Noche"] };
  const next = sanitizeContextForClassification(previousContext, "grabar", { tipo: "grabar", locationText: null, timeSlot: null });
  assert.equal(next.ubicacion, "Palermo");
  assert.deepEqual(next.timeSlots, ["Tarde", "Noche"]);
});

test("un contexto previo con la forma legada (franja string suelto) se lee igual que timeSlots", () => {
  const previousContext = { modalidad: "presencial", ubicacion: "Palermo", franja: "Tarde" };
  const next = sanitizeContextForClassification(previousContext, "grabar", { tipo: "grabar", locationText: null, timeSlot: null });
  assert.deepEqual(next.timeSlots, ["Tarde"]);
});

test("cambiar de tipo sin una franja nueva inferida limpia las franjas anteriores", () => {
  const previousContext = { modalidad: "presencial", ubicacion: "Palermo", timeSlots: ["Tarde"] };
  const next = sanitizeContextForClassification(previousContext, "hacer", { tipo: "grabar", locationText: null, timeSlot: null });
  assert.deepEqual(next.timeSlots, []);
});

test("una franja inferida por la clasificación nueva reemplaza a las anteriores, canonicalizada", () => {
  const previousContext = { modalidad: "presencial", ubicacion: "Palermo", timeSlots: ["Mañana", "Tarde"] };
  const next = sanitizeContextForClassification(previousContext, "grabar", { tipo: "grabar", locationText: null, timeSlot: "noche" });
  // classification.timeSlot llega en minúscula ("noche") — nunca debe
  // propagarse tal cual, tiene que quedar canonicalizado a "Noche".
  assert.deepEqual(next.timeSlots, ["Noche"]);
});

test("null si no había contexto previo (todavía no se completó ContextStep)", () => {
  assert.equal(sanitizeContextForClassification(null, "grabar", { tipo: "mezclar" }), null);
});
