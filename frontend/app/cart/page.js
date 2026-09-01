"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { getStoredCartId } from "@/lib/cart";
import { openRazorpayCheckout } from "@/lib/razorpay";

export default function CartPage() {
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
    setPaymentNotice(null);
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
      setProposalError(err instanceof ApiError ? err.message : "Could not cancel payment.");
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

      const verified = await api.verifyPayment(proposal.id, result);
      setPayment(verified);
      setPaymentNotice({ type: "success", message: "Payment verified successfully!" });
    } catch (err) {
      if (err?.dismissed) {
        setPaymentNotice({
          type: "info",
          message: "Payment window closed. You can try again whenever you're ready.",
        });
      } else if (err?.paymentFailed) {
        setPaymentNotice({ type: "error", message: `Payment failed: ${err.message}` });
      } else {
        const message =
          err instanceof ApiError ? err.message : "Could not verify the payment.";
        setPaymentNotice({ type: "error", message });
      }
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">Sellsy AI</span>
          <h1 className="text-xl font-semibold tracking-tight">Your Cart</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/chat">← Back to chat</Link>
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your cart…</p>}

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
                      Qty {item.quantity} × ₹{item.unit_price.toLocaleString("en-IN")}
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
                <span className="font-mono">₹{cart.total.toLocaleString("en-IN")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!proposal && (
                <Button onClick={handleProposePayment} disabled={isProposing}>
                  {isProposing ? "Checking order…" : "Proceed to Payment"}
                </Button>
              )}
              {proposalError && <p className="text-sm text-destructive">{proposalError}</p>}
            </CardContent>
          </Card>

          {proposal && (
            <PaymentApprovalCard
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
        </>
      )}
    </main>
  );
}

function PaymentApprovalCard({
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
            <Button onClick={onReject} disabled={isDeciding} variant="outline" className="flex-1">
              Cancel
            </Button>
          </div>
        )}

        {proposal.status === "rejected" && (
          <p className="text-sm text-muted-foreground">
            Payment cancelled. Your cart is unchanged — you can adjust items and propose again.
          </p>
        )}

        {proposal.status === "approved" && payment && (
          <PaymentStatusSection
            payment={payment}
            isPaying={isPaying}
            paymentNotice={paymentNotice}
            onPayNow={onPayNow}
          />
        )}
      </CardContent>
    </Card>
  );
}

function PaymentStatusSection({ payment, isPaying, paymentNotice, onPayNow }) {
  if (payment.status === "failed" && !payment.razorpay_payment_id) {
    // Order creation itself failed — nothing to retry on this proposal.
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <p className="font-medium">Payment could not be created</p>
        <p className="mt-1">{payment.failure_reason}</p>
        <p className="mt-2 text-xs">
          No charge was attempted. Go back to your cart and try proposing payment again.
        </p>
      </div>
    );
  }

  if (payment.status === "success") {
    return (
      <div className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm">
        <p className="font-medium text-green-700">Payment successful ✓</p>
        <p className="mt-1 text-muted-foreground">
          Razorpay payment ID: <span className="font-mono">{payment.razorpay_payment_id}</span>
        </p>
      </div>
    );
  }

  // status === "created": order exists, ready for the user to pay.
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={onPayNow} disabled={isPaying}>
        {isPaying ? "Opening Razorpay…" : `Pay ₹${payment.amount.toLocaleString("en-IN")} with Razorpay`}
      </Button>
      {paymentNotice && (
        <p
          className={`text-sm ${
            paymentNotice.type === "success"
              ? "text-green-700"
              : paymentNotice.type === "error"
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {paymentNotice.message}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const variant =
    status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
