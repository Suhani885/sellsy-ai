"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReceiptDivider, ReceiptRow } from "@/components/receipt";
import { api, ApiError } from "@/lib/api";

const STATUS_LABELS = {
  detected: "Detected",
  attempting: "In progress",
  recovered: "Recovered",
  expired: "Expired",
  stopped: "Stopped",
};

const STATUS_BADGE_VARIANT = {
  detected: "secondary",
  attempting: "secondary",
  recovered: "success",
  expired: "destructive",
  stopped: "destructive",
};

const SOURCE_LABELS = {
  failed_payment: "Payment failed",
  abandoned_checkout: "Checkout abandoned",
};

const ROOT_CAUSE_LABELS = {
  card_declined: "Card declined",
  insufficient_funds: "Insufficient funds",
  gateway_error: "Gateway error",
  signature_mismatch: "Signature mismatch",
  checkout_abandoned: "Abandoned at checkout",
  unknown: "Unknown",
};

const OPEN_STATUSES = ["detected", "attempting"];

export default function RecoveryPage() {
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [tone, setTone] = useState("standard");
  const [expandedId, setExpandedId] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);
  const [promiseDrafts, setPromiseDrafts] = useState({});

  async function loadAll() {
    setError(null);
    try {
      const [summaryData, casesData] = await Promise.all([
        api.getRecoverySummary(),
        api.getRecoveryCases(),
      ]);
      setSummary(summaryData);
      setCases(casesData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load recovery data.");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function withBusy(fn) {
    setIsBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleScan() {
    await withBusy(async () => {
      await api.scanRecoveryCases();
      await loadAll();
    });
  }

  async function handleRunBatch() {
    await withBusy(async () => {
      await api.runRecoveryBatch(tone);
      await loadAll();
    });
  }

  async function toggleExpand(caseId) {
    if (expandedId === caseId) {
      setExpandedId(null);
      setCaseDetail(null);
      return;
    }
    setExpandedId(caseId);
    try {
      setCaseDetail(await api.getRecoveryCase(caseId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load case detail.");
    }
  }

  async function handlePromise(caseId) {
    const days = Number(promiseDrafts[caseId] ?? 2);
    const promisedRetryAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    await withBusy(async () => {
      await api.promiseToPay(caseId, promisedRetryAt);
      await loadAll();
      if (expandedId === caseId) setCaseDetail(await api.getRecoveryCase(caseId));
    });
  }

  async function handleStop(caseId) {
    await withBusy(async () => {
      await api.stopRecoveryCase(caseId);
      await loadAll();
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Revenue recovery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detects failed payments and abandoned checkouts, drafts a bounded
          recovery nudge, and tracks what actually comes back.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {summary && (
        <div className="rounded-lg border border-border bg-card p-6">
          <ReceiptRow label="Open cases" value={summary.open_cases} />
          <ReceiptRow
            label="Amount at risk"
            value={`₹${summary.amount_at_risk.toLocaleString("en-IN")}`}
          />
          <ReceiptDivider className="my-4" />
          <ReceiptRow label="Recovered cases" value={summary.recovered_cases} />
          <ReceiptRow
            label="Amount recovered"
            value={`₹${summary.recovered_amount.toLocaleString("en-IN")}`}
          />
          <ReceiptDivider className="my-1" />
          <ReceiptRow
            label="Recovery rate"
            sublabel="Recovered ÷ (recovered + expired + stopped)"
            value={`${Math.round(summary.recovery_rate * 100)}%`}
            emphasis
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={handleScan} disabled={isBusy}>
          Scan for at-risk revenue
        </Button>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="standard">Standard tone</option>
          <option value="hinglish">Hinglish tone</option>
        </select>
        <Button onClick={handleRunBatch} disabled={isBusy}>
          Run recovery batch
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {cases.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No recovery cases yet — click &quot;Scan for at-risk revenue&quot; to
            detect failed payments and abandoned checkouts.
          </p>
        )}

        {cases.map((c) => {
          const isOpen = OPEN_STATUSES.includes(c.status);
          return (
            <div key={c.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {SOURCE_LABELS[c.source_type] || c.source_type}
                  </Badge>
                  <Badge variant={STATUS_BADGE_VARIANT[c.status] || "secondary"} className="text-[10px]">
                    {STATUS_LABELS[c.status] || c.status}
                  </Badge>
                  {c.root_cause && (
                    <span className="text-xs text-muted-foreground">
                      {ROOT_CAUSE_LABELS[c.root_cause] || c.root_cause}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium tabular-nums">
                  ₹{c.amount_at_risk.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{c.attempts} attempt(s)</span>
                {c.promised_retry_at && (
                  <span>
                    Promised retry: {new Date(c.promised_retry_at).toLocaleDateString("en-IN")}
                  </span>
                )}
                {c.recovered_amount != null && (
                  <span>Recovered: ₹{c.recovered_amount.toLocaleString("en-IN")}</span>
                )}
                <button
                  type="button"
                  onClick={() => toggleExpand(c.id)}
                  className="underline underline-offset-2"
                >
                  {expandedId === c.id ? "Hide timeline" : "View timeline"}
                </button>
              </div>

              {expandedId === c.id && caseDetail && caseDetail.id === c.id && (
                <ol className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  {caseDetail.actions.length === 0 && (
                    <li className="text-xs text-muted-foreground">No actions recorded yet.</li>
                  )}
                  {caseDetail.actions.map((a) => (
                    <li key={a.id} className="text-xs">
                      <span className="font-medium">{a.action_type}</span>
                      {a.tone && <span className="text-muted-foreground"> ({a.tone})</span>}
                      <span className="text-muted-foreground">
                        {" "}
                        — {new Date(a.created_at).toLocaleString("en-IN")}
                      </span>
                      {a.message && <p className="mt-0.5 text-foreground">{a.message}</p>}
                    </li>
                  ))}
                </ol>
              )}

              {isOpen && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Input
                    type="number"
                    min="1"
                    max="14"
                    value={promiseDrafts[c.id] ?? 2}
                    onChange={(e) =>
                      setPromiseDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                    className="h-8 w-16 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">days —</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePromise(c.id)}
                    disabled={isBusy}
                  >
                    Remind me later
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleStop(c.id)} disabled={isBusy}>
                    Stop
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
