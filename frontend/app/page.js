import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { API_BASE_URL, api } from "@/lib/api";

// This page is a Server Component: it calls the FastAPI backend directly
// on the server at request time (no client-side loading state needed for
// this foundation check). cache: "no-store" in lib/api.js keeps it dynamic.
export default async function HomePage() {
  let health = null;
  let healthError = null;
  try {
    health = await api.getHealth();
  } catch (err) {
    healthError = err.message;
  }

  let products = [];
  let productsError = null;
  try {
    products = await api.getProducts();
  } catch (err) {
    productsError = err.message;
  }

  const backendReachable = Boolean(health) && !healthError;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Sellsy AI — Foundation Check
        </span>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            Frontend ↔ Backend Connectivity
          </h1>
          <Button asChild size="sm">
            <Link href="/chat">Open chat →</Link>
          </Button>
        </div>
        <p className="text-muted-foreground">
          This page calls the FastAPI backend directly from a Next.js server
          component to confirm the two services can talk to each other.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Backend health</CardTitle>
            <Badge variant={backendReachable ? "default" : "destructive"}>
              {backendReachable ? "Connected" : "Unreachable"}
            </Badge>
          </div>
          <CardDescription>
            GET {API_BASE_URL}/health
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backendReachable ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Service</dt>
              <dd className="font-mono">{health.service}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-mono">{health.status}</dd>
              <dt className="text-muted-foreground">Database</dt>
              <dd className="font-mono">{health.database}</dd>
            </dl>
          ) : (
            <p className="text-sm text-destructive">
              Could not reach the backend: {healthError}. Make sure the
              FastAPI server is running and NEXT_PUBLIC_API_BASE_URL is set
              correctly.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Product catalog</CardTitle>
            <Badge variant="secondary">{products.length} products</Badge>
          </div>
          <CardDescription>GET {API_BASE_URL}/api/products</CardDescription>
        </CardHeader>
        <CardContent>
          {productsError ? (
            <p className="text-sm text-destructive">
              Could not load products: {productsError}
            </p>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products yet — this is expected on a fresh database. Seed a
              few rows in the `products` table to see them listed here.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between gap-4 rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.category} · {product.inventory} in stock
                    </p>
                  </div>
                  <p className="font-mono text-sm">₹{product.price}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Next phases will add the AI agent, cart interactions, guardrails, and
        Razorpay test-mode checkout on top of this foundation.
      </p>
    </main>
  );
}
