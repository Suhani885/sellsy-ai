"use client";

import { useSearchParams } from "next/navigation";
import { SendHorizonal, X } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShelfCard, ShelfRow } from "@/components/shelf-card";
import { api, ApiError } from "@/lib/api";
import { ensureCart } from "@/lib/cart";
import { getOrCreateSessionId } from "@/lib/session";

const WELCOME_MESSAGE = {
  role: "agent",
  content:
    "Hi, I'm here to help you find something. Tell me what you're looking for — a budget, an occasion, anything specific in mind — and I'll pull real options from stock.",
  recommended_products: [],
  upsell: null,
};

const TIP_DISMISSED_KEY = "sellsy_chat_tip_dismissed";

function capitalize(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function toDisplayMessage(m) {
  if (m.role === "user") {
    return { role: "user", content: m.content };
  }
  return {
    role: "agent",
    content: m.content,
    recommended_products: m.structured_output?.recommended_products || [],
    upsell: m.structured_output?.upsell || null,
  };
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = useState(null);
  const [cart, setCart] = useState(null);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [cartActionState, setCartActionState] = useState({});
  const [categories, setCategories] = useState([]);
  const [showTip, setShowTip] = useState(false);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const hasAutoSent = useRef(false);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);
    ensureCart(sid)
      .then(setCart)
      .catch(() => {});

    api
      .getChatHistory(sid)
      .then((history) => {
        if (history.length > 0) {
          setMessages(history.map(toDisplayMessage));
        }
      })
      .catch(() => {})
      .finally(() => setIsHistoryLoaded(true));

    api
      .getProducts()
      .then((products) => {
        const unique = [...new Set(products.map((p) => p.category))].sort();
        setCategories(unique);
      })
      .catch(() => {});

    try {
      setShowTip(window.localStorage.getItem(TIP_DISMISSED_KEY) !== "1");
    } catch {
      setShowTip(true);
    }
  }, []);

  useEffect(() => {
    const initialQuery = searchParams.get("q");
    if (initialQuery && sessionId && isHistoryLoaded && !hasAutoSent.current) {
      hasAutoSent.current = true;
      sendMessage(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isHistoryLoaded]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  function dismissTip() {
    setShowTip(false);
    try {
      window.localStorage.setItem(TIP_DISMISSED_KEY, "1");
    } catch {}
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || !sessionId) return;

    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setIsSending(true);

    try {
      const response = await api.sendChatMessage(sessionId, trimmed);
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: response.message_to_user,
          recommended_products: response.recommended_products,
          upsell: response.upsell,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong reaching the assistant."
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSending) return;
    const text = input;
    setInput("");
    inputRef.current?.focus();
    await sendMessage(text);
    inputRef.current?.focus();
  }

  function handleCategoryClick(category) {
    if (isSending) return;
    sendMessage(`Show me your ${category}`);
  }

  async function handleAddToCart(product, addedReason) {
    setCartActionState((prev) => ({ ...prev, [product.id]: "adding" }));
    try {
      const activeCart = cart ?? (await ensureCart(sessionId));
      const updatedCart = await api.addCartItem(activeCart.id, {
        productId: product.id,
        addedReason,
      });
      setCart(updatedCart);
      setCartActionState((prev) => ({ ...prev, [product.id]: "added" }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that to your cart.");
      setCartActionState((prev) => ({ ...prev, [product.id]: null }));
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-57px)] w-full max-w-2xl flex-col px-4 sm:px-6">
      <div className="border-b border-border py-4">
        <h1 className="text-lg font-semibold tracking-tight">Shopping assistant</h1>
        <p className="text-xs text-muted-foreground">Grounded in real stock and prices — never guessed.</p>
        {categories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => handleCategoryClick(category)}
                disabled={isSending}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
              >
                {capitalize(category)}
              </button>
            ))}
          </div>
        )}
      </div>

      {showTip && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-accent px-3 py-2 text-xs text-accent-foreground">
          <p className="flex-1">
            <strong className="font-medium">New here?</strong> Say what you need — a budget, a
            category, an occasion. You&rsquo;ll review real picks, add what you like to your cart,
            and approve payment yourself; nothing is ever charged automatically.
          </p>
          <button
            type="button"
            onClick={dismissTip}
            aria-label="Dismiss tip"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex-1 space-y-5 overflow-y-auto py-4">
        {messages.map((msg, i) => (
          <ChatTurn
            key={i}
            message={msg}
            cartActionState={cartActionState}
            onAddToCart={handleAddToCart}
          />
        ))}

        {isSending && <TypingIndicator />}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border py-4">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What are you looking for?"
          disabled={!sessionId}
          autoFocus
          className="flex-1"
        />
        <Button type="submit" disabled={isSending || !input.trim() || !sessionId} className="gap-1.5">
          <span className="hidden sm:inline">Send</span>
          <SendHorizonal className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </Button>
      </form>
    </main>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 border-l-2 border-primary/40 pl-3 py-1" aria-live="polite">
      <span className="sr-only">Assistant is typing</span>
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </span>
    </div>
  );
}

function AddToCartButton({ product, reason, cartActionState, onAddToCart }) {
  const state = cartActionState[product.id];

  if (state === "added") {
    return (
      <Button size="sm" variant="secondary" disabled className="w-full">
        Added
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="w-full"
      disabled={state === "adding" || product.inventory <= 0}
      onClick={() => onAddToCart(product, reason)}
    >
      {state === "adding" ? "Adding…" : "Add to cart"}
    </Button>
  );
}

function ChatTurn({ message, cartActionState, onAddToCart }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-secondary px-4 py-2 text-sm sm:max-w-[75%]">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-l-2 border-primary/40 pl-3 sm:pl-4">
      <p className="text-sm leading-relaxed">{message.content}</p>

      {message.recommended_products?.length > 0 && (
        <ShelfRow>
          {message.recommended_products.map((product) => (
            <ShelfCard
              key={product.id}
              product={product}
              footer={
                <AddToCartButton
                  product={product}
                  reason="user_selected"
                  cartActionState={cartActionState}
                  onAddToCart={onAddToCart}
                />
              }
            />
          ))}
        </ShelfRow>
      )}

      {message.upsell && (
        <div className="flex flex-col gap-3 rounded-md bg-accent p-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <p className="text-sm font-medium">Pairs well: {message.upsell.product.name}</p>
            <p className="text-sm text-muted-foreground">{message.upsell.reasoning}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              ₹{Number(message.upsell.product.price).toLocaleString("en-IN")}
            </p>
          </div>
          <div className="sm:w-32">
            <AddToCartButton
              product={message.upsell.product}
              reason="upsell_accepted"
              cartActionState={cartActionState}
              onAddToCart={onAddToCart}
            />
          </div>
        </div>
      )}
    </div>
  );
}
