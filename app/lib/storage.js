// Almacenamiento local del prototipo. No cambia claves ni formato de datos —
// sólo centraliza acceso directo a localStorage/window.storage y agrega
// helpers específicos para la colección de pedidos, que antes se repetían
// (leer todo, buscar por id, mapear y volver a guardar) en cada acción de
// ColabApp.jsx.

import { normalizeTimeSlots } from "../domain/timeSlots.js";

export const PROFILE_KEY = "colab-preview-profile-v3";
export const REQUESTS_KEY = "colab-preview-requests-v3";

export async function storageGet(key, shared) {
  try {
    if (window.storage?.get) {
      const res = await window.storage.get(key, shared);
      return res ? JSON.parse(res.value) : null;
    }
    const localValue = window.localStorage.getItem(key);
    return localValue ? JSON.parse(localValue) : null;
  } catch (e) {
    return null;
  }
}

export async function storageSet(key, value, shared) {
  try {
    if (window.storage?.set) await window.storage.set(key, JSON.stringify(value), shared);
    else window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("storage error", e);
    return false;
  }
}

export async function getAllRequests() {
  return (await storageGet(REQUESTS_KEY, true)) || [];
}

export async function getRequestById(id) {
  const all = await getAllRequests();
  return all.find((r) => r.id === id) || null;
}

export async function saveRequests(all) {
  return storageSet(REQUESTS_KEY, all, true);
}

// Aplica `updater` únicamente a la request con ese id; el resto de la
// colección queda intacta. `updater` recibe la request actual y devuelve:
// - la request actualizada, para guardar la colección completa, o
// - `null` o la misma referencia recibida, para abortar sin guardar nada.
// `changed` distingue "el updater decidió no aplicar nada" (regla de
// negocio, sin error) de `ok` que distingue si el guardado en sí falló
// (para poder mostrar un error real sólo en ese segundo caso).
export async function updateRequestById(id, updater) {
  const all = await getAllRequests();
  let nextRequest = null;
  let changed = false;
  const updatedAll = all.map((r) => {
    if (r.id !== id) return r;
    const result = updater(r);
    if (result === null || result === r) return r;
    changed = true;
    nextRequest = result;
    return result;
  });
  if (!changed) return { changed: false, ok: false, request: null };
  const ok = await saveRequests(updatedAll);
  return { changed: true, ok, request: ok ? nextRequest : null };
}

// Migración única: los pedidos guardados con el estado anterior "cerrado"
// (antes de separar "propuesta_elegida" de una futura confirmación real con
// reserva y pago) pasan a "propuesta_elegida" en el storage compartido. No
// se pierde ni se reescribe ningún otro dato del pedido.
export async function migrateLegacyClosedRequests() {
  const all = await getAllRequests();
  let changed = false;
  const migrated = all.map((r) => {
    if (r.estado !== "cerrado") return r;
    changed = true;
    return { ...r, estado: "propuesta_elegida" };
  });
  if (changed) await saveRequests(migrated);
}

// Migración idempotente: los pedidos guardados antes de admitir dos franjas
// horarias sólo tienen `franja` (string suelto, con la capitalización que
// haya quedado guardada). Les agrega `timeSlots` (array) canonicalizado con
// normalizeTimeSlots — no un envoltorio ciego de `franja` — sin tocar
// `franja` ni ningún otro campo. Un pedido que ya tiene `timeSlots` no se
// reescribe.
export async function migrateLegacyTimeSlots() {
  const all = await getAllRequests();
  let changed = false;
  const migrated = all.map((r) => {
    if (Array.isArray(r.timeSlots)) return r;
    changed = true;
    return { ...r, timeSlots: normalizeTimeSlots(r) };
  });
  if (changed) await saveRequests(migrated);
}
