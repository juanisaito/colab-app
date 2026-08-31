import test from "node:test";
import assert from "node:assert/strict";
import {
  TIME_SLOT_OPTIONS, FLEXIBLE_TIME_SLOT, MAX_TIME_SLOTS,
  normalizeTimeSlots, toggleTimeSlot, isTimeSlotOptionDisabled, formatTimeSlots, timeSlotsMatch,
} from "./timeSlots.js";

// --- normalizeTimeSlots: canonicalización real ---

test("normalizeTimeSlots: 'mañana' en minúscula (como la devuelve el intérprete) canonicaliza a 'Mañana'", () => {
  assert.deepEqual(normalizeTimeSlots({ timeSlots: ["mañana"] }), ["Mañana"]);
});

test("normalizeTimeSlots: 'MAÑANA' en mayúsculas también canonicaliza a 'Mañana'", () => {
  assert.deepEqual(normalizeTimeSlots({ timeSlots: ["MAÑANA"] }), ["Mañana"]);
});

test("normalizeTimeSlots: espacios alrededor (' Mañana ') se recortan antes de comparar", () => {
  assert.deepEqual(normalizeTimeSlots({ timeSlots: [" Mañana "] }), ["Mañana"]);
});

test("normalizeTimeSlots: franja legado en minúscula ('noche') también canonicaliza", () => {
  assert.deepEqual(normalizeTimeSlots({ franja: "noche" }), ["Noche"]);
});

test("normalizeTimeSlots: 'me adapto' y 'me da igual' son sinónimos del mismo valor canónico", () => {
  assert.deepEqual(normalizeTimeSlots({ timeSlots: ["me adapto"] }), [FLEXIBLE_TIME_SLOT]);
  assert.deepEqual(normalizeTimeSlots({ timeSlots: ["me da igual"] }), [FLEXIBLE_TIME_SLOT]);
  assert.deepEqual(normalizeTimeSlots({ timeSlots: ["ME DA IGUAL"] }), [FLEXIBLE_TIME_SLOT]);
});

test("normalizeTimeSlots: elimina duplicados (incluso con distinta capitalización)", () => {
  assert.deepEqual(normalizeTimeSlots({ timeSlots: ["Mañana", "mañana", "MAÑANA"] }), ["Mañana"]);
});

test("normalizeTimeSlots: descarta strings vacíos y valores desconocidos", () => {
  assert.deepEqual(normalizeTimeSlots({ timeSlots: ["", "   ", "Mediodía", "Tarde"] }), ["Tarde"]);
});

test("normalizeTimeSlots: nunca deja pasar más de dos franjas concretas", () => {
  assert.deepEqual(normalizeTimeSlots({ timeSlots: ["Mañana", "Tarde", "Noche"] }), ["Mañana", "Tarde"]);
});

test("normalizeTimeSlots: 'Me adapto' es exclusiva incluso si aparece junto con otras (sin importar el orden)", () => {
  assert.deepEqual(normalizeTimeSlots({ timeSlots: [FLEXIBLE_TIME_SLOT, "Tarde"] }), [FLEXIBLE_TIME_SLOT]);
  assert.deepEqual(normalizeTimeSlots({ timeSlots: ["Tarde", FLEXIBLE_TIME_SLOT] }), [FLEXIBLE_TIME_SLOT]);
});

test("normalizeTimeSlots: array crudo directo (uso interno) funciona igual que un objeto con timeSlots", () => {
  assert.deepEqual(normalizeTimeSlots(["tarde", "tarde"]), ["Tarde"]);
});

test("normalizeTimeSlots: timeSlots array (aunque esté vacío) tiene prioridad sobre franja", () => {
  assert.deepEqual(normalizeTimeSlots({ timeSlots: [], franja: "Tarde" }), []);
});

test("normalizeTimeSlots: sin ninguno de los dos campos, devuelve array vacío", () => {
  assert.deepEqual(normalizeTimeSlots({}), []);
  assert.deepEqual(normalizeTimeSlots(null), []);
});

test("normalizeTimeSlots: siempre devuelve un array nuevo, no la misma referencia recibida", () => {
  const input = ["Tarde"];
  const out = normalizeTimeSlots(input);
  assert.notEqual(out, input);
});

// --- toggleTimeSlot ---

test("toggleTimeSlot: una selección", () => {
  assert.deepEqual(toggleTimeSlot([], "Mañana"), ["Mañana"]);
});

test("toggleTimeSlot: dos selecciones", () => {
  assert.deepEqual(toggleTimeSlot(["Mañana"], "Tarde"), ["Mañana", "Tarde"]);
});

test("toggleTimeSlot: tercer intento con dos ya elegidas no hace nada", () => {
  const current = ["Mañana", "Tarde"];
  assert.deepEqual(toggleTimeSlot(current, "Noche"), current);
});

test("toggleTimeSlot: deselección de una franja ya elegida", () => {
  assert.deepEqual(toggleTimeSlot(["Mañana", "Tarde"], "Mañana"), ["Tarde"]);
});

test("toggleTimeSlot: elegir 'Me adapto' limpia cualquier franja concreta", () => {
  assert.deepEqual(toggleTimeSlot(["Mañana", "Tarde"], FLEXIBLE_TIME_SLOT), [FLEXIBLE_TIME_SLOT]);
});

test("toggleTimeSlot: elegir una franja concreta desactiva 'Me adapto'", () => {
  assert.deepEqual(toggleTimeSlot([FLEXIBLE_TIME_SLOT], "Noche"), ["Noche"]);
});

test("toggleTimeSlot: volver a tocar 'Me adapto' ya elegido lo deselecciona", () => {
  assert.deepEqual(toggleTimeSlot([FLEXIBLE_TIME_SLOT], FLEXIBLE_TIME_SLOT), []);
});

test("toggleTimeSlot: valores duplicados en el estado de entrada no rompen nada al deseleccionar", () => {
  assert.deepEqual(toggleTimeSlot(["Mañana", "Mañana"], "Mañana"), []);
});

test("toggleTimeSlot: una opción desconocida nunca se agrega", () => {
  assert.deepEqual(toggleTimeSlot(["Mañana"], "Mediodía"), ["Mañana"]);
});

test("toggleTimeSlot: opción en minúscula ('noche') se toca igual, canonicalizada", () => {
  assert.deepEqual(toggleTimeSlot(["Mañana"], "noche"), ["Mañana", "Noche"]);
});

// --- isTimeSlotOptionDisabled ---

test("isTimeSlotOptionDisabled: con menos de dos elegidas, ninguna opción no elegida está deshabilitada", () => {
  assert.equal(isTimeSlotOptionDisabled(["Mañana"], "Tarde"), false);
});

test("isTimeSlotOptionDisabled: con dos elegidas, la tercera opción queda deshabilitada", () => {
  assert.equal(isTimeSlotOptionDisabled(["Mañana", "Tarde"], "Noche"), true);
});

test("isTimeSlotOptionDisabled: una opción ya elegida nunca está deshabilitada (se puede destildar)", () => {
  assert.equal(isTimeSlotOptionDisabled(["Mañana", "Tarde"], "Mañana"), false);
});

test("isTimeSlotOptionDisabled: 'Me adapto' nunca está deshabilitada", () => {
  assert.equal(isTimeSlotOptionDisabled(["Mañana", "Tarde"], FLEXIBLE_TIME_SLOT), false);
});

test("isTimeSlotOptionDisabled: una opción desconocida se considera deshabilitada", () => {
  assert.equal(isTimeSlotOptionDisabled(["Mañana"], "Mediodía"), true);
});

// --- formatTimeSlots ---

test("formatTimeSlots: una sola franja", () => {
  assert.equal(formatTimeSlots(["Mañana"]), "Mañana");
});

test("formatTimeSlots: dos franjas quedan unidas con 'o', sólo la primera en mayúscula", () => {
  assert.equal(formatTimeSlots(["Mañana", "Tarde"]), "Mañana o tarde");
});

test("formatTimeSlots: una franja en minúscula (classification.timeSlot) se muestra canonicalizada", () => {
  assert.equal(formatTimeSlots(["noche"]), "Noche");
});

test("formatTimeSlots: sin franjas, no hay texto que mostrar", () => {
  assert.equal(formatTimeSlots([]), null);
  assert.equal(formatTimeSlots(null), null);
});

// --- timeSlotsMatch ---

test("timeSlotsMatch: sin franja pedida, coincide con cualquier disponibilidad", () => {
  assert.equal(timeSlotsMatch([], ["Tarde"]), true);
});

test("timeSlotsMatch: 'Me adapto' coincide sin filtrar", () => {
  assert.equal(timeSlotsMatch([FLEXIBLE_TIME_SLOT], ["Mañana"]), true);
});

test("timeSlotsMatch: coincide si el productor sirve alguna de las franjas pedidas", () => {
  assert.equal(timeSlotsMatch(["Mañana", "Tarde"], ["Tarde", "Noche"]), true);
});

test("timeSlotsMatch: no coincide si el productor no sirve ninguna de las franjas pedidas", () => {
  assert.equal(timeSlotsMatch(["Mañana"], ["Tarde", "Noche"]), false);
});

test("timeSlotsMatch: coincide sin importar la capitalización de ninguno de los dos lados", () => {
  assert.equal(timeSlotsMatch(["tarde"], ["TARDE"]), true);
  assert.equal(timeSlotsMatch(["Tarde"], ["tarde"]), true);
});

test("TIME_SLOT_OPTIONS y MAX_TIME_SLOTS quedan expuestos para la UI", () => {
  assert.deepEqual(TIME_SLOT_OPTIONS, ["Mañana", "Tarde", "Noche"]);
  assert.equal(MAX_TIME_SLOTS, 2);
});
