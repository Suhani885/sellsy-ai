import { api } from "@/lib/api";

const CART_STORAGE_KEY = "sellsy_cart_id";

function getStoredCartId() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(CART_STORAGE_KEY);
  return stored ? Number(stored) : null;
}

function storeCartId(cartId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, String(cartId));
}

export async function ensureCart(sessionId) {
  const existing = getStoredCartId();
  if (existing) {
    try {
      // Confirm the cart still exists server-side (e.g. survives a DB reset).
      return await api.getCart(existing);
    } catch {}
  }

  const cart = await api.createCart(sessionId);
  storeCartId(cart.id);
  return cart;
}

export { getStoredCartId };
