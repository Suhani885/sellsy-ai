import { cn } from "@/lib/utils";

export function ReceiptDivider({ className }) {
  return <div className={cn("border-t border-dashed border-border", className)} />;
}

export function ReceiptRow({ label, sublabel, value, emphasis = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div>
        <p className={emphasis ? "font-semibold" : "text-sm"}>{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      <span
        className={cn(
          "shrink-0 whitespace-nowrap tabular-nums",
          emphasis ? "text-lg font-semibold" : "text-sm"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// Reserved for order confirmation — not a general-purpose decorative badge.
export function StampBadge({ children, tone = "success", animate = false }) {
  const toneClasses =
    tone === "success"
      ? "border-success text-success"
      : tone === "destructive"
      ? "border-destructive text-destructive"
      : "border-foreground text-foreground";

  return (
    <div
      className={cn(
        "inline-flex w-fit shrink-0 self-start -rotate-6 items-center justify-center rounded-md border-4 px-4 py-1.5 text-lg font-bold uppercase tracking-wider",
        toneClasses,
        animate && "stamp-settle"
      )}
    >
      {children}
    </div>
  );
}
