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

  const [proposal, setProposal] = useState(null);
  const [isProposing, setIsProposing] = useState(false);
  const [isDeciding, setIsDeciding] = useState(false);
  const [proposalError, setProposalError] = useState(null);

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
      setProposal(null); // cart changed — any existing proposal is stale
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that item.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleProposePayment() {
    if (!cart) return;
    setIsProposing(true);
    setProposalError(null);
    try {
      const newProposal = await api.proposePayment(cart.id);
      setProposal(newProposal);
    } catch (err) {
      setProposalError(
        err instanceof ApiError ? err.message : "Could not create a payment proposal."
      );
    } finally {
      setIsProposing(false);
    }
  }

  async function handleApprove() {
    if (!proposal) return;
    setIsDeciding(true);
    setProposalError(null);
    try {
      const updated = await api.approvePayment(proposal.id);
      setProposal(updated);
    } catch (err) {
      setProposalError(err instanceof ApiError ? err.message : "Could not approve payment.");
    } finally {
      setIsDeciding(false);
    }
  }

  async function handleReject() {
    if (!proposal) return;
    setIsDeciding(true);
    setProposalError(null);
    try {
      const updated = await api.rejectPayment(proposal.id);
      setProposal(updated);
    } catch (err) {
      setProposalError(err instanceof ApiError ? err.message : "Could not cancel payment.");
    } finally {
      setIsDeciding(false);
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
                      disabled={removingId === item.id || Boolean(proposal)}
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
            <CardContent className="flex flex-col gap-3">
              {!proposal && (
                <Button onClick={handleProposePayment} disabled={isProposing}>
                  {isProposing ? "Checking order…" : "Proceed to Payment"}
                </Button>
              )}
              {proposalError && (
                <p className="text-sm text-destructive">{proposalError}</p>
              )}
            </CardContent>
          </Card>

          {proposal && <PaymentApprovalCard
            proposal={proposal}
            isDeciding={isDeciding}
            onApprove={handleApprove}
            onReject={handleReject}
          />}
        </>
      )}
    </main>
  );
}

function PaymentApprovalCard({ proposal, isDeciding, onApprove, onReject }) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Payment Proposal</span>
          <StatusBadge status={proposal.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-sans text-sm">
          {proposal.reasoning}
        </pre>

        {proposal.status === "proposed" && (
          <div className="flex gap-2">
            <Button onClick={onApprove} disabled={isDeciding} className="flex-1">
              {isDeciding ? "Processing…" : "Approve Payment"}
            </Button>
            <Button
              onClick={onReject}
              disabled={isDeciding}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        )}

        {proposal.status === "approved" && (
          <p className="text-sm text-muted-foreground">
            Payment approved. Razorpay checkout will be wired up in the next
            phase — no charge has been made yet.
          </p>
        )}

        {proposal.status === "rejected" && (
          <p className="text-sm text-muted-foreground">
            Payment cancelled. Your cart is unchanged — you can adjust items
            and propose again.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  const variant =
    status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
