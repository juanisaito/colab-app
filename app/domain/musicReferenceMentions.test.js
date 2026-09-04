import test from "node:test";
import assert from "node:assert/strict";
import { findMentionedMusicReferenceIds } from "./musicReferenceMentions.js";

test("detecta a Duki con distintas mayúsculas", () => {
  assert.deepEqual(findMentionedMusicReferenceIds("quiero algo estilo DUKI"), ["duki"]);
  assert.deepEqual(findMentionedMusicReferenceIds("quiero algo estilo duki"), ["duki"]);
  assert.deepEqual(findMentionedMusicReferenceIds("quiero algo estilo Duki"), ["duki"]);
});

test("detecta un nombre con diacríticos aunque el texto no los tenga", () => {
  assert.deepEqual(findMentionedMusicReferenceIds("me gusta el mato a un policia motorizado"), ["el_mato"]);
  assert.deepEqual(findMentionedMusicReferenceIds("me gusta Él Mató a un Policía Motorizado"), ["el_mato"]);
});

test("detecta un nombre con &", () => {
  assert.deepEqual(findMentionedMusicReferenceIds("me gusta Jowell & Randy"), ["jowell_y_randy"]);
  assert.deepEqual(findMentionedMusicReferenceIds("algo como CA7RIEL & Paco Amoroso"), ["ca7riel_paco"]);
});

test("detecta un nombre con signo final (Miranda!)", () => {
  assert.deepEqual(findMentionedMusicReferenceIds("me gusta Miranda!"), ["miranda"]);
  assert.deepEqual(findMentionedMusicReferenceIds("me gusta Miranda, sinceramente"), ["miranda"]);
});

test("dos artistas en el mismo texto conservan el orden de aparición", () => {
  assert.deepEqual(findMentionedMusicReferenceIds("algo entre Bad Bunny y Duki"), ["bad_bunny", "duki"]);
  assert.deepEqual(findMentionedMusicReferenceIds("algo entre Duki y Bad Bunny"), ["duki", "bad_bunny"]);
});

test("los repetidos se deduplican conservando la primera aparición", () => {
  assert.deepEqual(findMentionedMusicReferenceIds("Duki, siempre Duki, nada como Duki"), ["duki"]);
});

test("'wos' no aparece dentro de 'shows'", () => {
  assert.deepEqual(findMentionedMusicReferenceIds("quiero grabar para varios shows este año"), []);
  assert.deepEqual(findMentionedMusicReferenceIds("me gusta Wos"), ["wos"]);
});

test("texto vacío o no-string devuelve un array vacío", () => {
  assert.deepEqual(findMentionedMusicReferenceIds(""), []);
  assert.deepEqual(findMentionedMusicReferenceIds("   "), []);
  assert.deepEqual(findMentionedMusicReferenceIds(null), []);
  assert.deepEqual(findMentionedMusicReferenceIds(undefined), []);
  assert.deepEqual(findMentionedMusicReferenceIds(123), []);
});

test("texto sin ninguna mención devuelve un array vacío", () => {
  assert.deepEqual(findMentionedMusicReferenceIds("quiero grabar una cancion el sabado"), []);
});

test("una coincidencia más larga le gana a una más corta que se solapa", () => {
  // "la t y la m" (id la_t_y_la_m) no debe partirse en coincidencias menores.
  assert.deepEqual(findMentionedMusicReferenceIds("quiero algo como La T y La M"), ["la_t_y_la_m"]);
});

test("no muta el catálogo ni devuelve entradas completas", () => {
  const result = findMentionedMusicReferenceIds("me gusta Duki y Bad Bunny");
  result.forEach((id) => assert.equal(typeof id, "string"));
  assert.deepEqual(result, ["duki", "bad_bunny"]);
});
