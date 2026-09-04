"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  History,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MessageCircle,
  Package,
  ShoppingCart,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/wordmark";
import { api, CART_UPDATED_EVENT } from "@/lib/api";
import { getStoredCartId } from "@/lib/cart";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/chat", label: "Shop", icon: MessageCircle },
  { href: "/catalog", label: "Catalog", icon: Package },
  { href: "/cart", label: "Cart", icon: ShoppingCart },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/recovery", label: "Recovery", icon: LifeBuoy },
  { href: "/audit", label: "Audit trail", icon: History },
];

export function NavBar() {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const cartId = getStoredCartId();
      if (!cartId) {
        setCartCount(0);
        return;
      }
      api.getCart(cartId).then((cart) => setCartCount(cart.items.length)).catch(() => {});
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(CART_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(CART_UPDATED_EVENT, refresh);
    };
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <NavLink key={link.href} link={link} isActive={pathname === link.href} cartCount={cartCount} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((v) => !v)}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary md:hidden"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          {cartCount > 0 && !isMenuOpen && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          )}
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-t border-border bg-background px-4 py-2 md:hidden">
          {LINKS.map((link) => (
            <NavLink
              key={link.href}
              link={link}
              isActive={pathname === link.href}
              cartCount={cartCount}
              fullWidth
              onNavigate={() => setIsMenuOpen(false)}
            />
          ))}
        </div>
      )}
    </nav>
  );
}

function NavLink({ link, isActive, cartCount, fullWidth = false, onNavigate }) {
  const Icon = link.icon;
  const isCart = link.href === "/cart";

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors md:py-1.5",
        fullWidth ? "w-full" : "",
        isActive
          ? "bg-secondary font-medium text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      <span>{link.label}</span>
      {isCart && cartCount > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium tabular-nums text-primary-foreground md:ml-0">
          {cartCount}
        </span>
      )}
    </Link>
  );
}
