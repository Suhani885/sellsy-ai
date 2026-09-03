"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  CreditCard,
  IndianRupee,
  RadarIcon,
  ShoppingCart,
  TrendingUp,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatGrid, StatTile } from "@/components/stat-tile";
import { api, ApiError } from "@/lib/api";
import { isSpeechSupported, speakText, stopSpeaking } from "@/lib/speech";
import { cn } from "@/lib/utils";

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

const SOURCE_META = {
  failed_payment: { label: "Payment failed", icon: CreditCard },
  abandoned_checkout: { label: "Checkout abandoned", icon: ShoppingCart },
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
const TONES = [
  { value: "standard", label: "Standard" },
  { value: "hinglish", label: "Hinglish" },
  { value: "voice_hinglish", label: "Hinglish voice" },
];

export default function RecoveryPage() {
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [tone, setTone] = useState("standard");
  const [expandedId, setExpandedId] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);
  const [promiseDrafts, setPromiseDrafts] = useState({});
  const [playingActionId, setPlayingActionId] = useState(null);

  function handleTogglePlay(action) {
    if (playingActionId === action.id) {
      stopSpeaking();
      setPlayingActionId(null);
      return;
    }
    setPlayingActionId(action.id);
    speakText(action.message, { onEnd: () => setPlayingActionId(null) });
  }

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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
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
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-primary/40 bg-card p-6">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              <span className="text-xs font-medium uppercase tracking-wide">Recovery rate</span>
            </div>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {Math.round(summary.recovery_rate * 100)}%
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Recovered ÷ (recovered + expired + stopped)
            </p>
          </div>

          <StatGrid columns={4}>
            <StatTile icon={RadarIcon} label="Open cases" value={summary.open_cases} />
            <StatTile
              icon={IndianRupee}
              label="Amount at risk"
              value={`₹${summary.amount_at_risk.toLocaleString("en-IN")}`}
              tone={summary.amount_at_risk > 0 ? "destructive" : "default"}
            />
            <StatTile icon={BadgeCheck} label="Recovered cases" value={summary.recovered_cases} tone="success" />
            <StatTile
              icon={IndianRupee}
              label="Amount recovered"
              value={`₹${summary.recovered_amount.toLocaleString("en-IN")}`}
              tone="success"
            />
          </StatGrid>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={handleScan} disabled={isBusy} className="gap-1.5">
          <RadarIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Scan for at-risk revenue
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex overflow-x-auto rounded-md border border-input p-0.5">
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTone(t.value)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-[5px] px-2.5 py-1.5 text-xs transition-colors sm:px-3 sm:text-sm",
                  tone === t.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button onClick={handleRunBatch} disabled={isBusy} className="gap-1.5">
            <Zap className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Run recovery batch
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {cases.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-14 text-center">
            <RadarIcon className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">
              No recovery cases yet — scan for failed payments and abandoned checkouts to get started.
            </p>
          </div>
        )}

        {cases.map((c) => {
          const isOpen = OPEN_STATUSES.includes(c.status);
          const source = SOURCE_META[c.source_type] || { label: c.source_type, icon: AlertTriangle };
          const SourceIcon = source.icon;

          return (
            <div key={c.id} className="rounded-lg border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SourceIcon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
                  <Badge variant="secondary" className="text-[10px]">
                    {source.label}
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

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{c.attempts} attempt(s)</span>
                {c.promised_retry_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    Promised retry: {new Date(c.promised_retry_at).toLocaleDateString("en-IN")}
                  </span>
                )}
                {c.recovered_amount != null && (
                  <span className="font-medium text-success">
                    Recovered: ₹{c.recovered_amount.toLocaleString("en-IN")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggleExpand(c.id)}
                  className="underline underline-offset-2 hover:text-foreground"
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
                      {a.message && (
                        <div className="mt-0.5 flex items-start gap-2">
                          <p className="flex-1 text-foreground">{a.message}</p>
                          {a.tone === "voice_hinglish" && isSpeechSupported() && (
                            <button
                              type="button"
                              onClick={() => handleTogglePlay(a)}
                              className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-1 text-muted-foreground hover:border-primary hover:text-foreground"
                            >
                              {playingActionId === a.id ? (
                                <>
                                  <VolumeX className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                                  Stop
                                </>
                              ) : (
                                <>
                                  <Volume2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                                  Play
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
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
                    className="h-9 w-20 text-sm"
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
