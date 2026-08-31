// A lightweight, unauthenticated session identifier used to group chat
// messages and (later) carts for a given browser. Not tied to a user
// account — just a correlation key, generated once and reused.
const SESSION_STORAGE_KEY = "sellsy_session_id";

export function getOrCreateSessionId() {
  if (typeof window === "undefined") return null;

  let sessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}
