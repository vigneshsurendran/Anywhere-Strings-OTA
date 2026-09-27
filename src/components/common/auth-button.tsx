"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export function AuthButton({ children, pendingLabel, disabled = false, className }: {
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} aria-busy={pending || undefined}
      className={className ?? "rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"}>
      <span className="inline-flex items-center justify-center gap-2">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? pendingLabel : children}
      </span>
    </button>
  );
}
