"use client";

import { useSearchParams } from "next/navigation";
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
  const scrollRef = useRef(null);
  const hasAutoSent = useRef(false);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);
    ensureCart(sid)
      .then(setCart)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const initialQuery = searchParams.get("q");
    if (initialQuery && sessionId && !hasAutoSent.current) {
      hasAutoSent.current = true;
      sendMessage(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

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
    await sendMessage(text);
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
    <main className="mx-auto flex h-screen w-full max-w-2xl flex-col px-4 py-5">
      <div className="mb-2 pb-3 border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight">Shopping assistant</h1>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pb-4">
        {messages.map((msg, i) => (
          <ChatTurn
            key={i}
            message={msg}
            cartActionState={cartActionState}
            onAddToCart={handleAddToCart}
          />
        ))}

        {isSending && <p className="text-sm text-muted-foreground">Looking that up…</p>}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border pt-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What are you looking for?"
          disabled={isSending || !sessionId}
        />
        <Button type="submit" disabled={isSending || !input.trim() || !sessionId}>
          Send
        </Button>
      </form>
    </main>
  );
}

function AddToCartButton({ product, reason, cartActionState, onAddToCart }) {
  const state = cartActionState[product.id];

  if (state === "added") {
    return (
      <Button size="sm" variant="secondary" disabled className="w-full">
        Added ✓
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
        <p className="max-w-[80%] text-right text-sm">{message.content}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-l-2 border-primary/40 pl-3">
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
        <div className="flex items-start gap-3 rounded-md bg-accent p-3">
          <div className="flex-1">
            <p className="text-sm font-medium">Pairs well: {message.upsell.product.name}</p>
            <p className="text-sm text-muted-foreground">{message.upsell.reasoning}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              ₹{Number(message.upsell.product.price).toLocaleString("en-IN")}
            </p>
          </div>
          <AddToCartButton
            product={message.upsell.product}
            reason="upsell_accepted"
            cartActionState={cartActionState}
            onAddToCart={onAddToCart}
          />
        </div>
      )}
    </div>
  );
}
