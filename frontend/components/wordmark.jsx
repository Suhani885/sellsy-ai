import { ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";

const SIZES = {
  small: { text: "text-base", badge: "h-5 w-5 rounded-[5px]", icon: "h-3 w-3" },
  default: { text: "text-xl", badge: "h-7 w-7 rounded-md", icon: "h-4 w-4" },
  large: { text: "text-3xl", badge: "h-10 w-10 rounded-lg", icon: "h-5 w-5" },
};

export function Wordmark({ className, size = "default" }) {
  const s = SIZES[size] || SIZES.default;

  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className={cn("flex shrink-0 items-center justify-center bg-primary", s.badge)}>
        <ShoppingBag className={cn("text-primary-foreground", s.icon)} strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className={s.text}>Sellsy</span>
    </span>
  );
}
