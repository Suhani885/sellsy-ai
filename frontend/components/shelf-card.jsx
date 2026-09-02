function capitalize(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function ShelfCard({ product, footer }) {
  const inStock = product.inventory > 0;

  return (
    <div className="flex w-60 shrink-0 flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-sm text-muted-foreground">{capitalize(product.category)}</p>
        <h3 className="mt-0.5 font-semibold leading-snug">{product.name}</h3>
      </div>

      <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>

      <div className="mt-auto flex items-end justify-between gap-2 pt-1">
        <span className="text-lg font-semibold tabular-nums">
          ₹{Number(product.price).toLocaleString("en-IN")}
        </span>
        <span className="text-xs text-muted-foreground">
          {inStock ? `${product.inventory} left` : "Sold out"}
        </span>
      </div>

      {footer}
    </div>
  );
}

export function ShelfRow({ children }) {
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {children}
    </div>
  );
}
