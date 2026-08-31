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

/**
 * Returns the existing cart ID for this browser, or creates a new cart
 * (tied to the given session ID) if none exists yet. Safe to call
 * repeatedly — it only ever creates one cart per browser.
 */
export async function ensureCart(sessionId) {
  const existing = getStoredCartId();
  if (existing) {
    try {
      // Confirm the cart still exists server-side (e.g. survives a DB reset).
      return await api.getCart(existing);
    } catch {
      // Fall through and create a fresh one.
    }
  }

  const cart = await api.createCart(sessionId);
  storeCartId(cart.id);
  return cart;
}

export { getStoredCartId };
