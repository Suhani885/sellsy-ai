import { Badge } from "@/components/ui/badge";

export function ProductCard({ product, footer }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug">{product.name}</p>
        <span className="whitespace-nowrap font-mono text-sm">
          ₹{Number(product.price).toLocaleString("en-IN")}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{product.description}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {product.tags?.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px]">
            {tag}
          </Badge>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {product.inventory > 0
          ? `${product.inventory} in stock`
          : "Out of stock"}
      </p>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}
