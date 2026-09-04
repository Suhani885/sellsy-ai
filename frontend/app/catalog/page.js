"use client";

import Link from "next/link";
import { MessageCircle, PackageSearch, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShelfCard } from "@/components/shelf-card";
import { api, ApiError } from "@/lib/api";
import { ensureCart } from "@/lib/cart";
import { getOrCreateSessionId } from "@/lib/session";

function capitalize(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export default function CatalogPage() {
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [cartId, setCartId] = useState(null);
  const [cartActionState, setCartActionState] = useState({});

  useEffect(() => {
    api
      .getProducts()
      .then((data) => {
        setAllProducts(data);
        setCategories([...new Set(data.map((p) => p.category))].sort());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setError(null);
    api
      .getProducts({
        category: activeCategory === "all" ? undefined : activeCategory,
        search: debouncedSearch || undefined,
      })
      .then(setProducts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the catalog."));
  }, [activeCategory, debouncedSearch]);

  const hasFilters = activeCategory !== "all" || debouncedSearch.length > 0;

  const totalLabel = useMemo(() => {
    if (products === null) return null;
    return `${products.length} of ${allProducts.length} product${allProducts.length === 1 ? "" : "s"}`;
  }, [products, allProducts]);

  async function handleAddToCart(product) {
    setCartActionState((prev) => ({ ...prev, [product.id]: "adding" }));
    try {
      const sessionId = getOrCreateSessionId();
      const cart = cartId ? { id: cartId } : await ensureCart(sessionId);
      if (!cartId) setCartId(cart.id);
      await api.addCartItem(cart.id, { productId: product.id, addedReason: "user_selected" });
      setCartActionState((prev) => ({ ...prev, [product.id]: "added" }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that to your cart.");
      setCartActionState((prev) => ({ ...prev, [product.id]: null }));
    }
  }

  function clearFilters() {
    setActiveCategory("all");
    setSearch("");
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Every in-stock product, real prices, no chatting required. Prefer to describe what you
          need instead?{" "}
          <Link href="/chat" className="inline-flex items-center gap-1 text-primary hover:underline">
            <MessageCircle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            Ask the assistant
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2}
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="pl-9"
            aria-label="Search the catalog"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              activeCategory === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground"
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                activeCategory === category
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground"
              }`}
            >
              {capitalize(category)}
            </button>
          ))}
        </div>
      </div>

      {totalLabel && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{totalLabel}</span>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="flex items-center gap-1 hover:text-foreground">
              <X className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {products === null && <CatalogSkeleton />}

      {products !== null && products.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <PackageSearch className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Nothing matches {debouncedSearch ? `"${debouncedSearch}"` : "that filter"} right now.
          </p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}

      {products !== null && products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {products.map((product) => (
            <ShelfCard
              key={product.id}
              product={product}
              className="w-full"
              footer={<CatalogAddToCartButton product={product} state={cartActionState[product.id]} onAdd={handleAddToCart} />}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function CatalogAddToCartButton({ product, state, onAdd }) {
  if (state === "added") {
    return (
      <Button size="sm" variant="secondary" disabled className="w-full">
        Added
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className="w-full"
      disabled={state === "adding" || product.inventory <= 0}
      onClick={() => onAdd(product)}
    >
      {state === "adding" ? "Adding…" : product.inventory <= 0 ? "Sold out" : "Add to cart"}
    </Button>
  );
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex h-48 flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
          <div className="h-3 w-full animate-pulse rounded bg-secondary" />
          <div className="mt-auto h-5 w-1/3 animate-pulse rounded bg-secondary" />
        </div>
      ))}
    </div>
  );
}
