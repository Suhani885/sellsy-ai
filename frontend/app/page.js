import Link from "next/link";
import {
  BadgeCheck,
  IndianRupee,
  LifeBuoy,
  MessageSquareText,
  PackageSearch,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { StatGrid, StatTile } from "@/components/stat-tile";
import { api, API_BASE_URL } from "@/lib/api";

const EXAMPLE_PROMPTS = [
  "A laptop for college under ₹50,000",
  "Wireless headphones under ₹2,000",
  "A gift for someone who games on PC",
];

const STEPS = [
  {
    icon: MessageSquareText,
    title: "Say what you need",
    body: "In plain words — a budget, an occasion, a use case. No filters to configure.",
  },
  {
    icon: PackageSearch,
    title: "Get real options",
    body: "Every recommendation is pulled from live stock and priced from the catalog, not guessed.",
  },
  {
    icon: ShieldCheck,
    title: "Approve before you pay",
    body: "You see the full order and reasoning first. Nothing is charged without your yes.",
  },
];

export default async function HomePage() {
  let statusLabel = "Checking connection…";
  let statusOk = false;

  try {
    const health = await api.getHealth();
    const products = await api.getProducts();
    statusOk = health.status === "ok";
    statusLabel = statusOk
      ? `Connected · ${products.length} products in stock`
      : "Backend reachable but reporting issues";
  } catch {
    statusLabel = `Can't reach the backend at ${API_BASE_URL}`;
  }

  let recoverySummary = null;
  try {
    recoverySummary = await api.getRecoverySummary();
  } catch {
    // Recovery stats are a bonus on the homepage, not load-bearing —
    // the section below just hides itself if this fails.
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-57px)] w-full max-w-4xl flex-col justify-between px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-12 sm:gap-16">
        <div className="flex flex-col gap-6">
          <h1 className="max-w-lg text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Tell us what you&rsquo;re shopping for. We&rsquo;ll find it, explain why, and ring it up.
          </h1>
          <p className="max-w-md text-muted-foreground">
            An AI shopping assistant for electronics — laptops, phones, headphones, and more —
            with real prices and a payment step you&rsquo;re always in control of.
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Try asking
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <Link
                  key={prompt}
                  href={`/chat?q=${encodeURIComponent(prompt)}`}
                  className="w-fit rounded-md border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-primary hover:bg-primary/10"
                >
                  &ldquo;{prompt}&rdquo;
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/chat"
            className="w-fit rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:py-2.5"
          >
            Start shopping
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <step.icon className="h-4 w-4 text-primary" strokeWidth={2} aria-hidden="true" />
                <span className="text-xs font-medium text-muted-foreground">
                  Step {i + 1}
                </span>
              </div>
              <h2 className="font-medium">{step.title}</h2>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-6 border-t border-border pt-12 sm:pt-16">
          <div className="flex flex-col gap-3">
            <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Also built in — revenue recovery
            </span>
            <h2 className="max-w-lg text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              When a sale doesn&rsquo;t go through, this doesn&rsquo;t give up on it.
            </h2>
            <p className="max-w-md text-muted-foreground">
              A declined card, an abandoned checkout, an overdue B2B invoice, a lapsed Care
              Plan renewal — one bounded pipeline detects it, diagnoses why, drafts a
              tracked recovery nudge, and knows when to stop. Nothing here is silent
              revenue loss.
            </p>
          </div>

          {recoverySummary && recoverySummary.total_cases > 0 && (
            <StatGrid columns={3}>
              <StatTile
                icon={IndianRupee}
                label="Recovered so far"
                value={`₹${recoverySummary.recovered_amount.toLocaleString("en-IN")}`}
                tone="success"
              />
              <StatTile
                icon={BadgeCheck}
                label="Cases recovered"
                value={recoverySummary.recovered_cases}
                tone="success"
              />
              <StatTile
                icon={TrendingUp}
                label="Recovery rate"
                value={`${Math.round(recoverySummary.recovery_rate * 100)}%`}
              />
            </StatGrid>
          )}

          <Link
            href="/recovery"
            className="flex w-fit items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/10"
          >
            <LifeBuoy className="h-4 w-4 text-primary" strokeWidth={2} aria-hidden="true" />
            Open the recovery engine
          </Link>
        </div>
      </div>

      <div className="mt-16 flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusOk ? "bg-success" : "bg-destructive"}`}
          aria-hidden="true"
        />
        {statusLabel}
      </div>
    </main>
  );
}
