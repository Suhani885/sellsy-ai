"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/wordmark";
import { api } from "@/lib/api";
import { getStoredCartId } from "@/lib/cart";

const LINKS = [
  { href: "/chat", label: "Shop" },
  { href: "/cart", label: "Cart" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/audit", label: "Audit trail" },
];

export function NavBar() {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const cartId = getStoredCartId();
    if (!cartId) return;
    api
      .getCart(cartId)
      .then((cart) => setCartCount(cart.items.length))
      .catch(() => {});
    const onFocus = () => {
      api
        .getCart(cartId)
        .then((cart) => setCartCount(cart.items.length))
        .catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1">
          {LINKS.map((link) => {
            const isActive = pathname === link.href;
            const isCart = link.href === "/cart";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
                {isCart && cartCount > 0 ? ` (${cartCount})` : ""}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
