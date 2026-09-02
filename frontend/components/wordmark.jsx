import { cn } from "@/lib/utils";

export function Wordmark({ className, size = "default" }) {
  const textSize = size === "large" ? "text-3xl" : size === "small" ? "text-base" : "text-xl";

  return (
    <span className={cn("inline-flex items-baseline gap-1.5 font-semibold tracking-tight", className)}>
      <span className={textSize}>Sellsy</span>
      <span className="h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-primary" aria-hidden="true" />
    </span>
  );
}
