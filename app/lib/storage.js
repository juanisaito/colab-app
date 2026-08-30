// Almacenamiento local del prototipo, en un módulo neutral sin dependencias
// propias. Vive acá (y no en ColabApp.jsx) para que RootScreens.jsx pueda
// leer pedidos sin importar nada del componente raíz — eso es lo que
// cerraba el ciclo de imports entre ambos módulos.
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
