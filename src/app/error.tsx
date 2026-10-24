"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const db = /DATABASE_URL|ECONNREFUSED|connect|getaddrinfo|password authentication/i.test(error.message);
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-warning-soft text-warning">
        <AlertTriangle className="size-5" />
      </div>
      <h1 className="mt-4 text-lg font-semibold tracking-tight">{db ? "Harbor can't reach its database" : "Something went wrong"}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {db ? "Check DATABASE_URL (Tiger Cloud connection string) and run npm run db:setup." : error.message}
      </p>
      <Button className="mt-5" variant="outline" onClick={reset}>
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}
