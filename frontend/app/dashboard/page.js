import { ReceiptDivider, ReceiptRow } from "@/components/receipt";
import { api } from "@/lib/api";

export default async function DashboardPage() {
  let analytics = null;
  let error = null;

  try {
    analytics = await api.getAnalytics();
  } catch (err) {
    error = err.message || "Could not load analytics.";
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">The ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How the assistant is doing across every conversation so far.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {analytics && (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Conversations & recommendations</p>
          <div className="mt-1">
            <ReceiptRow label="Conversations" value={analytics.total_conversations} />
            <ReceiptRow label="Products recommended" value={analytics.products_recommended} />
            <ReceiptRow label="Add-ons suggested" value={analytics.upsells_proposed} />
            <ReceiptRow label="Add-ons accepted" value={analytics.upsells_accepted} />
          </div>

          <ReceiptDivider className="my-4" />

          <p className="text-sm text-muted-foreground">Payments</p>
          <div className="mt-1">
            <ReceiptRow label="Payments started" value={analytics.payments_initiated} />
            <ReceiptRow label="Successful" value={analytics.successful_payments} />
            <ReceiptRow label="Failed" value={analytics.failed_payments} />
            <ReceiptRow
              label="Extra revenue from add-ons"
              value={`₹${analytics.estimated_additional_revenue.toLocaleString("en-IN")}`}
            />
          </div>

          <ReceiptDivider className="my-1" />
          <ReceiptRow
            label="Conversion rate"
            sublabel="Successful payments ÷ conversations"
            value={`${Math.round(analytics.conversion_rate * 100)}%`}
            emphasis
          />
        </div>
      )}
    </main>
  );
}
