"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { getOrCreateSessionId } from "@/lib/session";

const EVENT_LABELS = {
  USER_REQUEST: "Message",
  PRODUCT_SEARCH: "Search",
  PRODUCT_RECOMMENDATION: "Recommendation",
  UPSELL_PROPOSED: "Add-on suggested",
  AGENT_RESPONSE: "Reply",
  POLICY_VALIDATION: "Guardrail check",
  PAYMENT_PROPOSAL: "Payment proposed",
  USER_APPROVAL: "Approved",
  USER_REJECTION: "Cancelled",
  RAZORPAY_ORDER_CREATED: "Order created",
  PAYMENT_SUCCESS: "Payment succeeded",
  PAYMENT_FAILED: "Payment failed",
};

export default function AuditPage() {
  const [sessionId, setSessionId] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [trail, setTrail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);
    setInputValue(sid);
  }, []);

  async function loadTrail(id) {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getAuditTrail(id);
      setTrail(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the audit trail.");
      setTrail(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (sessionId) loadTrail(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function handleSubmit(e) {
    e.preventDefault();
    loadTrail(inputValue.trim());
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Audit trail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every recommendation, approval, and payment event for a session, in order.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Session ID"
        />
        <Button type="submit" disabled={isLoading || !inputValue.trim()}>
          View
        </Button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {trail && trail.events.length === 0 && (
        <p className="text-sm text-muted-foreground">No events recorded for this session yet.</p>
      )}

      {trail && trail.events.length > 0 && (
        <ol className="flex flex-col">
          {trail.events.map((event, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                {i < trail.events.length - 1 && (
                  <span className="w-px flex-1 bg-border" />
                )}
              </div>
              <div className="pb-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {EVENT_LABELS[event.event_type] || event.event_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="mt-1 text-sm">{event.summary}</p>
                {event.payload && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
                      Details
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-muted/50 p-2 font-mono text-xs">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
