"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Clock,
  CreditCard,
  FileText,
  IndianRupee,
  Plus,
  RadarIcon,
  RefreshCw,
  ShieldCheck,
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
  overdue_invoice: { label: "Invoice overdue", icon: Building2 },
  subscription_renewal_failed: { label: "Renewal failed", icon: RefreshCw },
};

const ROOT_CAUSE_LABELS = {
  card_declined: "Card declined",
  insufficient_funds: "Insufficient funds",
  gateway_error: "Gateway error",
  signature_mismatch: "Signature mismatch",
  checkout_abandoned: "Abandoned at checkout",
  invoice_overdue: "Invoice overdue",
  renewal_failed: "Renewal failed",
  unknown: "Unknown",
};

const OPEN_STATUSES = ["detected", "attempting"];
const TONES = [
  { value: "standard", label: "Standard" },
  { value: "hinglish", label: "Hinglish" },
  { value: "voice_hinglish", label: "Hinglish voice" },
];

const TABS = [
  { value: "cases", label: "Recovery cases" },
  { value: "receivables", label: "Receivables" },
  { value: "careplans", label: "Care plans" },
  { value: "promises", label: "Promise tracker" },
];

const PROMISE_STATUS_META = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  overdue: { label: "Overdue", variant: "destructive", icon: AlertTriangle },
  kept: { label: "Kept", variant: "success", icon: BadgeCheck },
  kept_late: { label: "Kept (late)", variant: "secondary", icon: BadgeCheck },
  broken: { label: "Broken", variant: "destructive", icon: AlertTriangle },
};

export default function RecoveryPage() {
  const [activeTab, setActiveTab] = useState("cases");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Revenue recovery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detects failed payments, abandoned checkouts, overdue B2B
          invoices, and lapsed Care Plan renewals, drafts a bounded
          recovery nudge, and tracks what actually comes back.
        </p>
      </div>

      <div className="flex w-fit rounded-md border border-input p-0.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setActiveTab(t.value)}
            className={cn(
              "rounded-[5px] px-3 py-1.5 text-sm transition-colors",
              activeTab === t.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "cases" && <CasesPanel />}
      {activeTab === "receivables" && <ReceivablesPanel />}
      {activeTab === "careplans" && <CarePlansPanel />}
      {activeTab === "promises" && <PromisesPanel />}
    </main>
  );
}

function CasesPanel() {
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
    <div className="flex flex-col gap-8">
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
              No recovery cases yet — scan for failed payments, abandoned
              checkouts, overdue invoices, and lapsed renewals to get
              started.
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
    </div>
  );
}

const EMPTY_INVOICE_FORM = {
  customerName: "",
  customerContact: "",
  description: "",
  amountDue: "",
  paymentTermsDays: "15",
};

const INVOICE_STATUS_META = {
  paid: { label: "Paid", variant: "success" },
  overdue: { label: "Overdue", variant: "destructive" },
  open: { label: "Open", variant: "secondary" },
};

function ReceivablesPanel() {
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState(EMPTY_INVOICE_FORM);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  async function loadInvoices() {
    setError(null);
    try {
      setInvoices(await api.getInvoices());
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load invoices.");
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleIssue(e) {
    e.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      await api.issueInvoice({
        customerName: form.customerName.trim(),
        customerContact: form.customerContact.trim(),
        description: form.description.trim(),
        amountDue: Number(form.amountDue),
        paymentTermsDays: Number(form.paymentTermsDays),
      });
      setForm(EMPTY_INVOICE_FORM);
      await loadInvoices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not issue the invoice.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleMarkPaid(invoiceId) {
    setIsBusy(true);
    setError(null);
    try {
      await api.markInvoicePaid(invoiceId);
      await loadInvoices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark this invoice paid.");
    } finally {
      setIsBusy(false);
    }
  }

  const isFormValid = form.customerName.trim() && form.description.trim() && Number(form.amountDue) > 0;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form
        onSubmit={handleIssue}
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-5"
      >
        <p className="text-sm font-medium">Issue a B2B invoice</p>
        <p className="text-xs text-muted-foreground">
          For bulk/wholesale orders sold on credit terms rather than immediate
          checkout. Left unpaid past its due date, it becomes a recovery case
          automatically.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            placeholder="Customer / business name"
            value={form.customerName}
            onChange={(e) => updateField("customerName", e.target.value)}
            required
          />
          <Input
            placeholder="Contact (email or phone, optional)"
            value={form.customerContact}
            onChange={(e) => updateField("customerContact", e.target.value)}
          />
        </div>

        <Input
          placeholder="What was sold (e.g. 10x Keyboard, 5x Monitor)"
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Input
            type="number"
            min="1"
            placeholder="Amount due (₹)"
            value={form.amountDue}
            onChange={(e) => updateField("amountDue", e.target.value)}
            required
          />
          <select
            value={form.paymentTermsDays}
            onChange={(e) => updateField("paymentTermsDays", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="7">Net 7</option>
            <option value="15">Net 15</option>
            <option value="30">Net 30</option>
            <option value="45">Net 45</option>
          </select>
          <Button type="submit" disabled={isBusy || !isFormValid} className="col-span-2 gap-1.5 sm:col-span-1">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Issue
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        {invoices.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-14 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">
              No invoices yet — issue one above to start tracking a B2B receivable.
            </p>
          </div>
        )}

        {invoices.map((inv) => {
          const statusKey = inv.status === "paid" ? "paid" : inv.is_overdue ? "overdue" : "open";
          const meta = INVOICE_STATUS_META[statusKey];
          const daysOverdue = inv.is_overdue
            ? Math.max(Math.floor((now - new Date(inv.due_at).getTime()) / 86400000), 0)
            : null;

          return (
            <div key={inv.id} className="rounded-lg border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{inv.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    INV-{String(inv.id).padStart(4, "0")} · {inv.description}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  ₹{inv.amount_due.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <Badge variant={meta.variant} className="text-[10px]">
                  {meta.label}
                </Badge>
                <span>Due {new Date(inv.due_at).toLocaleDateString("en-IN")}</span>
                {daysOverdue != null && <span>{daysOverdue} day(s) overdue</span>}
                {inv.paid_at && (
                  <span>Paid {new Date(inv.paid_at).toLocaleDateString("en-IN")}</span>
                )}
              </div>

              {inv.status !== "paid" && (
                <div className="mt-3 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleMarkPaid(inv.id)}
                    disabled={isBusy}
                  >
                    Mark paid
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const EMPTY_CARE_PLAN_FORM = {
  customerName: "",
  customerContact: "",
  planName: "",
  covers: "",
  amountPerCycle: "",
  billingIntervalDays: "30",
};

const CARE_PLAN_STATUS_META = {
  cancelled: { label: "Cancelled", variant: "destructive" },
  due: { label: "Renewal due", variant: "destructive" },
  active: { label: "Active", variant: "success" },
};

function CarePlansPanel() {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(EMPTY_CARE_PLAN_FORM);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);

  async function loadPlans() {
    setError(null);
    try {
      setPlans(await api.getCarePlans());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load care plans.");
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleIssue(e) {
    e.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      await api.issueCarePlan({
        customerName: form.customerName.trim(),
        customerContact: form.customerContact.trim(),
        planName: form.planName.trim(),
        covers: form.covers.trim(),
        amountPerCycle: Number(form.amountPerCycle),
        billingIntervalDays: Number(form.billingIntervalDays),
      });
      setForm(EMPTY_CARE_PLAN_FORM);
      await loadPlans();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not issue the care plan.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRenew(planId) {
    setIsBusy(true);
    setError(null);
    try {
      await api.renewCarePlan(planId);
      await loadPlans();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not renew this plan.");
    } finally {
      setIsBusy(false);
    }
  }

  const isFormValid =
    form.customerName.trim() &&
    form.planName.trim() &&
    form.covers.trim() &&
    Number(form.amountPerCycle) > 0;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form
        onSubmit={handleIssue}
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-5"
      >
        <p className="text-sm font-medium">Sign up a device Care Plan</p>
        <p className="text-xs text-muted-foreground">
          A recurring protection/AMC subscription tied to a device. A lapsed
          renewal becomes a recovery case automatically, worked through a
          smart day-0/day-2/day-5 mandate retry sequence — exhausting it
          cancels the plan.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            placeholder="Customer name"
            value={form.customerName}
            onChange={(e) => updateField("customerName", e.target.value)}
            required
          />
          <Input
            placeholder="Contact (email or phone, optional)"
            value={form.customerContact}
            onChange={(e) => updateField("customerContact", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            placeholder="Plan name (e.g. Laptop Care+)"
            value={form.planName}
            onChange={(e) => updateField("planName", e.target.value)}
            required
          />
          <Input
            placeholder="Covers (e.g. HP Pavilion 14)"
            value={form.covers}
            onChange={(e) => updateField("covers", e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Input
            type="number"
            min="1"
            placeholder="Amount / cycle (₹)"
            value={form.amountPerCycle}
            onChange={(e) => updateField("amountPerCycle", e.target.value)}
            required
          />
          <select
            value={form.billingIntervalDays}
            onChange={(e) => updateField("billingIntervalDays", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="30">Monthly</option>
            <option value="90">Quarterly</option>
            <option value="365">Yearly</option>
          </select>
          <Button type="submit" disabled={isBusy || !isFormValid} className="col-span-2 gap-1.5 sm:col-span-1">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Sign up
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        {plans.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-14 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">
              No care plans yet — sign one up above to start tracking a
              recurring device protection subscription.
            </p>
          </div>
        )}

        {plans.map((plan) => {
          const statusKey =
            plan.status === "cancelled" ? "cancelled" : plan.is_renewal_due ? "due" : "active";
          const meta = CARE_PLAN_STATUS_META[statusKey];

          return (
            <div key={plan.id} className="rounded-lg border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{plan.plan_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.customer_name} · covers {plan.covers}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  ₹{plan.amount_per_cycle.toLocaleString("en-IN")}/cycle
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <Badge variant={meta.variant} className="text-[10px]">
                  {meta.label}
                </Badge>
                <span>Next billing {new Date(plan.next_billing_at).toLocaleDateString("en-IN")}</span>
                <span className="font-mono">{plan.mandate_id}</span>
              </div>

              {plan.status === "active" && (
                <div className="mt-3 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRenew(plan.id)}
                    disabled={isBusy}
                  >
                    Renew now
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PromisesPanel() {
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [error, setError] = useState(null);

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
      setError(err instanceof ApiError ? err.message : "Could not load promise data.");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const promisedCases = cases
    .filter((c) => c.promised_retry_at)
    .sort((a, b) => new Date(b.promised_retry_at) - new Date(a.promised_retry_at));

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Every time a case is answered with &ldquo;remind me later,&rdquo; it
        lands here. This is what actually happened against what was
        promised — not just who agreed to pay eventually.
      </p>

      {summary && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-primary/40 bg-card p-6">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              <span className="text-xs font-medium uppercase tracking-wide">Promise keep rate</span>
            </div>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {Math.round(summary.promise_keep_rate * 100)}%
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Kept ÷ (kept + kept late + broken) — {summary.promises_made} promise(s) made in total
            </p>
          </div>

          <StatGrid columns={4}>
            <StatTile icon={Clock} label="Pending" value={summary.promises_pending} />
            <StatTile
              icon={AlertTriangle}
              label="Overdue"
              value={summary.promises_overdue}
              tone={summary.promises_overdue > 0 ? "destructive" : "default"}
            />
            <StatTile
              icon={BadgeCheck}
              label="Kept"
              value={summary.promises_kept + summary.promises_kept_late}
              sublabel={summary.promises_kept_late > 0 ? `${summary.promises_kept_late} paid late` : undefined}
              tone="success"
            />
            <StatTile
              icon={AlertTriangle}
              label="Broken"
              value={summary.promises_broken}
              tone={summary.promises_broken > 0 ? "destructive" : "default"}
            />
          </StatGrid>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {promisedCases.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-14 text-center">
            <Clock className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">
              No promises made yet — they show up here as soon as a case is
              answered with &ldquo;remind me later&rdquo; from the Recovery
              cases tab.
            </p>
          </div>
        )}

        {promisedCases.map((c) => {
          const meta = PROMISE_STATUS_META[c.promise_status] || PROMISE_STATUS_META.pending;
          const source = SOURCE_META[c.source_type] || { label: c.source_type, icon: AlertTriangle };
          const SourceIcon = source.icon;
          const StatusIcon = meta.icon;

          return (
            <div key={c.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SourceIcon className="h-4 w-4 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
                  <Badge variant="secondary" className="text-[10px]">
                    {source.label}
                  </Badge>
                  <Badge variant={meta.variant} className="gap-1 text-[10px]">
                    <StatusIcon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    {meta.label}
                  </Badge>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  ₹{c.amount_at_risk.toLocaleString("en-IN")}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Promised {new Date(c.promised_retry_at).toLocaleDateString("en-IN")}
                {c.recovered_amount != null &&
                  ` · recovered ₹${c.recovered_amount.toLocaleString("en-IN")}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
