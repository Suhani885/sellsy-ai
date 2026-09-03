"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ReceiptDivider, ReceiptRow } from "@/components/receipt";
import { api, ApiError } from "@/lib/api";
import { getStoredCartId } from "@/lib/cart";
import { openRazorpayCheckout } from "@/lib/razorpay";

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const [proposal, setProposal] = useState(null);
  const [payment, setPayment] = useState(null);
  const [razorpayKeyId, setRazorpayKeyId] = useState(null);
  const [isProposing, setIsProposing] = useState(false);
  const [isDeciding, setIsDeciding] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [proposalError, setProposalError] = useState(null);
  const [paymentNotice, setPaymentNotice] = useState(null);

  useEffect(() => {
    const cartId = getStoredCartId();
    if (!cartId) {
      setIsLoading(false);
      return;
    }
    api
      .getCart(cartId)
      .then(setCart)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your cart."))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleRemove(itemId) {
    if (!cart) return;
    setRemovingId(itemId);
    try {
      const updated = await api.removeCartItem(cart.id, itemId);
      setCart(updated);
      setProposal(null);
      setPayment(null);
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
      setPayment(null);
    } catch (err) {
      setProposalError(
        err instanceof ApiError ? err.message : "Could not put this order together."
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
      const result = await api.approvePayment(proposal.id);
      setProposal(result.proposal);
      setPayment(result.payment);
      setRazorpayKeyId(result.razorpay_key_id);
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
      setProposalError(err instanceof ApiError ? err.message : "Could not cancel.");
    } finally {
      setIsDeciding(false);
    }
  }

  async function handlePayNow() {
    if (!payment || !razorpayKeyId) return;
    setIsPaying(true);
    setPaymentNotice(null);
    try {
      const result = await openRazorpayCheckout({
        keyId: razorpayKeyId,
        orderId: payment.razorpay_order_id,
        amount: Math.round(payment.amount * 100),
        currency: payment.currency,
        name: "Sellsy AI",
        description: `Order for proposal #${proposal.id}`,
      });
      await api.verifyPayment(proposal.id, result);
      router.push(`/order/${proposal.id}`);
    } catch (err) {
      if (err?.dismissed) {
        setPaymentNotice({ type: "info", message: "Payment window closed. You can try again." });
      } else if (err?.paymentFailed) {
        setPaymentNotice({ type: "error", message: `Payment failed: ${err.message}` });
      } else {
        setPaymentNotice({
          type: "error",
          message: err instanceof ApiError ? err.message : "Could not verify the payment.",
        });
      }
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Your cart</h1>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your cart…</p>}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!isLoading && (!cart || cart.items.length === 0) && !error && (
        <p className="text-sm text-muted-foreground">
          Nothing here yet.{" "}
          <Link href="/chat" className="underline underline-offset-2">
            Go find something
          </Link>
          .
        </p>
      )}

      {cart && cart.items.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Your order</p>

          <div className="mt-2">
            {cart.items.map((item) => (
              <div key={item.id}>
                <ReceiptRow
                  label={item.product.name}
                  sublabel={
                    item.added_reason === "upsell_accepted"
                      ? `Qty ${item.quantity} · suggested add-on`
                      : `Qty ${item.quantity}`
                  }
                  value={`₹${item.line_total.toLocaleString("en-IN")}`}
                />
                <button
                  onClick={() => handleRemove(item.id)}
                  disabled={removingId === item.id || Boolean(proposal)}
                  className="mb-1 -mt-2 text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-40"
                >
                  {removingId === item.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </div>

          <ReceiptDivider className="my-1" />
          <ReceiptRow label="Total" value={`₹${cart.total.toLocaleString("en-IN")}`} emphasis />

          {!proposal && (
            <Button onClick={handleProposePayment} disabled={isProposing} className="mt-4 w-full">
              {isProposing ? "Putting your order together…" : "Review & pay"}
            </Button>
          )}
          {proposalError && <p className="mt-2 text-sm text-destructive">{proposalError}</p>}
        </div>
      )}

      {proposal && (
        <PaymentProposalCard
          proposal={proposal}
          payment={payment}
          isDeciding={isDeciding}
          isPaying={isPaying}
          paymentNotice={paymentNotice}
          onApprove={handleApprove}
          onReject={handleReject}
          onPayNow={handlePayNow}
        />
      )}
    </main>
  );
}

function summarizeReasoning(reasoning) {
  // The full reasoning is itemized text meant for an audit trail. The
  // items are already visible in the receipt above this card, so only
  // surface the closing assurance line here to avoid repeating them.
  const lines = reasoning.trim().split("\n");
  return lines[lines.length - 1];
}

function PaymentProposalCard({
  proposal,
  payment,
  isDeciding,
  isPaying,
  paymentNotice,
  onApprove,
  onReject,
  onPayNow,
}) {
  return (
    <div className="rounded-lg border border-primary/40 bg-card p-6">
      <p className="text-sm font-medium">Before we charge anything</p>
      <p className="mt-2 text-sm text-muted-foreground">{summarizeReasoning(proposal.reasoning)}</p>

      {proposal.status === "proposed" && (
        <div className="mt-4 flex gap-2">
          <Button onClick={onApprove} disabled={isDeciding} className="flex-1">
            {isDeciding ? "Approving…" : "Approve payment"}
          </Button>
          <Button onClick={onReject} disabled={isDeciding} variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      )}

      {proposal.status === "rejected" && (
        <p className="mt-4 text-sm text-muted-foreground">
          Cancelled — your cart is unchanged.
        </p>
      )}

      {proposal.status === "approved" && payment && (
        <div className="mt-4">
          {payment.status === "failed" && !payment.razorpay_payment_id && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">Payment couldn't be started</p>
              <p className="mt-1">{payment.failure_reason}</p>
              <p className="mt-2 text-xs">
                Nothing was charged. Go back to your cart and try again.
              </p>
            </div>
          )}

          {payment.status === "created" && (
            <div className="flex flex-col gap-2">
              <Button variant="success" onClick={onPayNow} disabled={isPaying} className="w-full">
                {isPaying
                  ? "Opening Razorpay…"
                  : `Pay ₹${payment.amount.toLocaleString("en-IN")}`}
              </Button>
              {paymentNotice && (
                <p
                  className={`text-sm ${
                    paymentNotice.type === "error" ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {paymentNotice.message}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
