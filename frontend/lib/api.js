// Central API client for the Sellsy AI backend.
//
// NEXT_PUBLIC_API_BASE_URL is the only backend-related env var the frontend
// needs. It's safe to expose to the browser (it's just a URL, not a secret).
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    // Never cache API calls — this is dynamic data, not static content.
    cache: "no-store",
    ...options,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (isJson && body?.error?.message) || `Request to ${path} failed (${res.status})`;
    throw new ApiError(message, res.status, body);
  }

  return body;
}

export const api = {
  getHealth: () => request("/health"),

  getProducts: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.set("category", params.category);
    if (params.search) query.set("search", params.search);
    if (params.limit) query.set("limit", params.limit);
    const qs = query.toString();
    return request(`/api/products${qs ? `?${qs}` : ""}`);
  },

  getProduct: (productId) => request(`/api/products/${productId}`),

  createCart: (sessionId) =>
    request("/api/cart", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId ?? null }),
    }),

  getCart: (cartId) => request(`/api/cart/${cartId}`),

  addCartItem: (cartId, { productId, quantity = 1, addedReason = "user_selected" }) =>
    request(`/api/cart/${cartId}/items`, {
      method: "POST",
      body: JSON.stringify({
        product_id: productId,
        quantity,
        added_reason: addedReason,
      }),
    }),

  removeCartItem: (cartId, itemId) =>
    request(`/api/cart/${cartId}/items/${itemId}`, { method: "DELETE" }),

  proposePayment: (cartId) =>
    request("/api/payment/propose", {
      method: "POST",
      body: JSON.stringify({ cart_id: cartId }),
    }),

  approvePayment: (proposalId) =>
    request(`/api/payment/${proposalId}/approve`, { method: "POST" }),

  rejectPayment: (proposalId) =>
    request(`/api/payment/${proposalId}/reject`, { method: "POST" }),

  sendChatMessage: (sessionId, message) =>
    request("/api/chat", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, message }),
    }),

  getChatHistory: (sessionId) => request(`/api/chat/${sessionId}/history`),
};

export { ApiError, API_BASE_URL };
