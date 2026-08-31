"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/product-card";
import { api, ApiError } from "@/lib/api";
import { ensureCart } from "@/lib/cart";
import { getOrCreateSessionId } from "@/lib/session";

const WELCOME_MESSAGE = {
  role: "agent",
  content:
    "Hi! I'm the Sellsy AI shopping assistant. Tell me what you're looking for — e.g. \"I need a laptop for college under ₹50,000\" — and I'll find some options.",
  recommended_products: [],
  upsell: null,
};

export default function ChatPage() {
  const [sessionId, setSessionId] = useState(null);
  const [cart, setCart] = useState(null);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  // Tracks per-product "adding..." / "added" UI state, keyed by product id.
  const [cartActionState, setCartActionState] = useState({});
  const scrollRef = useRef(null);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);
    ensureCart(sid)
      .then(setCart)
      .catch(() => {
        /* cart will be created lazily on first add-to-cart attempt */
      });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending || !sessionId) return;

    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
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
      const message =
        err instanceof ApiError
          ? err.message
          : "Something went wrong talking to the assistant.";
      setError(message);
    } finally {
      setIsSending(false);
    }
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
      const message =
        err instanceof ApiError ? err.message : "Could not add that to your cart.";
      setError(message);
      setCartActionState((prev) => ({ ...prev, [product.id]: null }));
    }
  }

  const itemCount = cart?.items?.length ?? 0;

  return (
    <main className="mx-auto flex h-screen w-full max-w-2xl flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">
            Sellsy AI
          </span>
          <h1 className="text-xl font-semibold tracking-tight">
            Shopping Assistant
          </h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/cart">Cart {itemCount > 0 ? `(${itemCount})` : ""}</Link>
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border bg-muted/20 p-4">
        {messages.map((msg, i) => (
          <ChatBubble
            key={i}
            message={msg}
            cartActionState={cartActionState}
            onAddToCart={handleAddToCart}
          />
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
              Thinking…
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about laptops, phones, headphones…"
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
        Added to cart ✓
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

function ChatBubble({ message, cartActionState, onAddToCart }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[85%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-lg px-3 py-2 text-sm shadow-sm ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card text-card-foreground"
          }`}
        >
          {message.content}
        </div>

        {message.recommended_products?.length > 0 && (
          <div className="flex w-full flex-col gap-2">
            {message.recommended_products.map((product) => (
              <ProductCard
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
          </div>
        )}

        {message.upsell && (
          <div className="flex w-full flex-col gap-1 rounded-lg border border-dashed p-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                Suggested add-on
              </Badge>
            </div>
            <ProductCard
              product={message.upsell.product}
              footer={
                <AddToCartButton
                  product={message.upsell.product}
                  reason="upsell_accepted"
                  cartActionState={cartActionState}
                  onAddToCart={onAddToCart}
                />
              }
            />
            <p className="text-xs text-muted-foreground">
              {message.upsell.reasoning}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
