import Link from "next/link";

import { api, API_BASE_URL } from "@/lib/api";

const EXAMPLE_PROMPTS = [
  "A laptop for college under ₹50,000",
  "Wireless headphones under ₹2,000",
  "A gift for someone who games on PC",
];

const STEPS = [
  {
    title: "Say what you need",
    body: "In plain words — a budget, an occasion, a use case. No filters to configure.",
  },
  {
    title: "Get real options",
    body: "Every recommendation is pulled from live stock and priced from the catalog, not guessed.",
  },
  {
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

  return (
    <main className="mx-auto flex min-h-[calc(100vh-57px)] w-full max-w-3xl flex-col justify-between px-6 py-12">
      <div className="flex flex-col gap-14">
        <div className="flex flex-col gap-6">
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Tell us what you're shopping for. We'll find it, explain why, and ring it up.
          </h1>
          <p className="max-w-md text-muted-foreground">
            An AI shopping assistant for electronics — laptops, phones, headphones, and more —
            with real prices and a payment step you're always in control of.
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Try asking:</p>
            {EXAMPLE_PROMPTS.map((prompt) => (
              <Link
                key={prompt}
                href={`/chat?q=${encodeURIComponent(prompt)}`}
                className="w-fit rounded-md border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-primary hover:bg-primary/10"
              >
                "{prompt}"
              </Link>
            ))}
          </div>

          <Link
            href="/chat"
            className="w-fit rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start shopping
          </Link>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">{i + 1}</span>
              <h2 className="font-medium">{step.title}</h2>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-16 flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={`h-1.5 w-1.5 rounded-full ${statusOk ? "bg-success" : "bg-destructive"}`}
          aria-hidden="true"
        />
        {statusLabel}
      </div>
    </main>
  );
}
