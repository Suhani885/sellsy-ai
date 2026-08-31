"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { getStoredCartId } from "@/lib/cart";

export default function CartPage() {
  const [cart, setCart] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    const cartId = getStoredCartId();
    if (!cartId) {
      setIsLoading(false);
      return;
    }

    api
      .getCart(cartId)
      .then(setCart)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Could not load your cart.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function handleRemove(itemId) {
    if (!cart) return;
    setRemovingId(itemId);
    try {
      const updated = await api.removeCartItem(cart.id, itemId);
      setCart(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that item.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">
            Sellsy AI
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Your Cart</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/chat">← Back to chat</Link>
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading your cart…</p>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!isLoading && !cart && !error && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Your cart is empty. Head to the{" "}
            <Link href="/chat" className="underline">
              chat assistant
            </Link>{" "}
            to find something.
          </CardContent>
        </Card>
      )}

      {cart && cart.items.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Your cart is empty.
          </CardContent>
        </Card>
      )}

      {cart && cart.items.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {cart.items.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-start justify-between gap-4 pt-6">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty {item.quantity} × ₹
                      {item.unit_price.toLocaleString("en-IN")}
                    </p>
                    {item.added_reason === "upsell_accepted" && (
                      <Badge variant="outline" className="w-fit text-[10px]">
                        Added as suggested add-on
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-mono text-sm">
                      ₹{item.line_total.toLocaleString("en-IN")}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={removingId === item.id}
                      onClick={() => handleRemove(item.id)}
                    >
                      {removingId === item.id ? "Removing…" : "Remove"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>Total</span>
                <span className="font-mono">
                  ₹{cart.total.toLocaleString("en-IN")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Checkout isn't wired up yet — this total is calculated
              server-side from live product prices, ready for the payment
              phase.
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
