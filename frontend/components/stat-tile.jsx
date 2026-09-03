import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  default: "text-foreground",
  success: "text-success",
  destructive: "text-destructive",
};

export function StatTile({ icon: Icon, label, value, sublabel, tone = "default" }) {
  return (
    <div className="flex flex-col gap-2 bg-card p-5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className={cn("text-2xl font-semibold tabular-nums", TONE_CLASSES[tone])}>
        {value}
      </span>
      {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
    </div>
  );
}

export function StatGrid({ children, columns = 2, className }) {
  const columnClass =
    columns === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : columns === 3
      ? "sm:grid-cols-3"
      : "sm:grid-cols-2";

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border",
        columnClass,
        className
      )}
    >
      {children}
    </div>
  );
}
