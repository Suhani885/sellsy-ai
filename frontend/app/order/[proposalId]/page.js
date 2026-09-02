"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { ReceiptDivider, ReceiptRow, StampBadge } from "@/components/receipt";
import { api, ApiError } from "@/lib/api";

export default function OrderResultPage({ params }) {
  const { proposalId } = use(params);
  const [proposal, setProposal] = useState(null);
  const [payment, setPayment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getPaymentProposal(proposalId), api.getPaymentTransaction(proposalId)])
      .then(([proposalData, paymentData]) => {
        setProposal(proposalData);
        setPayment(paymentData);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load this order.")
      )
      .finally(() => setIsLoading(false));
  }, [proposalId]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <Link href="/">
          <Wordmark />
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link href="/chat">Continue shopping</Link>
        </Button>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading order…</p>}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {proposal && (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Order #{proposal.id}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(proposal.created_at).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
            {payment?.status === "success" && (
              <StampBadge tone="success" animate>
                Paid
              </StampBadge>
            )}
          </div>

          <ReceiptDivider className="my-4" />

          {proposal.cart_snapshot.map((item) => (
            <ReceiptRow
              key={item.id}
              label={item.product.name}
              sublabel={
                item.added_reason === "upsell_accepted"
                  ? `Qty ${item.quantity} · suggested add-on`
                  : `Qty ${item.quantity}`
              }
              value={`₹${item.line_total.toLocaleString("en-IN")}`}
            />
          ))}

          <ReceiptDivider className="my-1" />
          <ReceiptRow
            label="Total"
            value={`₹${proposal.total_amount.toLocaleString("en-IN")}`}
            emphasis
          />

          <div className="mt-6">
            {payment?.status === "success" && (
              <p className="text-sm text-muted-foreground">
                Payment ID: <span className="tabular-nums">{payment.razorpay_payment_id}</span>
              </p>
            )}

            {payment?.status === "failed" && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Payment wasn't completed. {payment.failure_reason}
              </div>
            )}

            {(!payment || payment.status === "created") && (
              <p className="text-sm text-muted-foreground">
                This order hasn't been paid yet.{" "}
                <Link href="/cart" className="underline underline-offset-2">
                  Go back to your cart
                </Link>{" "}
                to complete it.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
