import {
  BadgeCheck,
  CreditCard,
  IndianRupee,
  MessagesSquare,
  PackageSearch,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";

import { StatGrid, StatTile } from "@/components/stat-tile";
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
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
        <div className="flex flex-col gap-8">
          <div className="rounded-lg border border-primary/40 bg-card p-6">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              <span className="text-xs font-medium uppercase tracking-wide">Conversion rate</span>
            </div>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {Math.round(analytics.conversion_rate * 100)}%
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Successful payments ÷ conversations
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Conversations &amp; recommendations
            </h2>
            <StatGrid columns={4}>
              <StatTile icon={MessagesSquare} label="Conversations" value={analytics.total_conversations} />
              <StatTile
                icon={PackageSearch}
                label="Products recommended"
                value={analytics.products_recommended}
              />
              <StatTile icon={Sparkles} label="Add-ons suggested" value={analytics.upsells_proposed} />
              <StatTile icon={BadgeCheck} label="Add-ons accepted" value={analytics.upsells_accepted} />
            </StatGrid>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Payments</h2>
            <StatGrid columns={4}>
              <StatTile icon={CreditCard} label="Payments started" value={analytics.payments_initiated} />
              <StatTile
                icon={BadgeCheck}
                label="Successful"
                value={analytics.successful_payments}
                tone="success"
              />
              <StatTile
                icon={XCircle}
                label="Failed"
                value={analytics.failed_payments}
                tone={analytics.failed_payments > 0 ? "destructive" : "default"}
              />
              <StatTile
                icon={IndianRupee}
                label="Extra revenue from add-ons"
                value={`₹${analytics.estimated_additional_revenue.toLocaleString("en-IN")}`}
                tone="success"
              />
            </StatGrid>
          </div>
        </div>
      )}
    </main>
  );
}
