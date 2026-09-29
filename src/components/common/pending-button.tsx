"use client";

import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/src/components/ui/button";

export function PendingButton({
  pending,
  pendingLabel,
  children,
  disabled = false,
  ...props
}: ComponentProps<typeof Button> & {
  pending: boolean;
  pendingLabel: string;
}) {
  return (
    <Button type="submit" aria-busy={pending || undefined} disabled={disabled || pending} {...props}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function blockDismiss(pending: boolean, onOpenChange: (open: boolean) => void) {
  return (open: boolean) => {
    if (!open && pending) return;
    onOpenChange(open);
  };
}
