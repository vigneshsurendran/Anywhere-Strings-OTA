"use client";

import { useActionState, useState } from "react";
import { ChevronDown } from "lucide-react";
import { blockDismiss, PendingButton } from "@/src/components/common/pending-button";
import { FormMessage } from "@/src/components/publisher/import-form";
import type { AccessRole, AccessRow } from "@/src/server/access";
import type { ActionResult } from "@/src/features/catalog/types";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

type AccessAction = (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export function AccessScreen({ people, addAction, roleAction, removeAction }: {
  people: AccessRow[];
  addAction: AccessAction;
  roleAction: AccessAction;
  removeAction: AccessAction;
}) {
  const [formKey, setFormKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [addSession, setAddSession] = useState(0);
  const [draft, setDraft] = useState<{ email: string; role: string } | null>(null);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-6">
      <h1 className="text-xl font-semibold tracking-tight text-primary">Access</h1>
      <form
        key={formKey}
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setDraft({
            email: String(data.get("email") ?? "").trim(),
            role: String(data.get("role") ?? "user"),
          });
          setAddSession((current) => current + 1);
          setAddOpen(true);
        }}
      >
        <label className="grid gap-2 text-sm">
          Email
          <Input name="email" type="email" required autoComplete="off" className="w-72 border-secondary bg-canvas text-primary" />
        </label>
        <label className="grid gap-2 text-sm">
          Role
          <RoleSelect name="role" defaultValue="user" className="h-9 w-28" />
        </label>
        <Button type="submit" className="bg-ink text-onPrimary hover:bg-ink-hover">Add</Button>
      </form>
      {addOpen ? <ActionDialog
        key={addSession}
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add access"
        description={draft ? `Add ${draft.email} as ${rolePhrase(draft.role)}? They can sign in after this Google account is verified.` : ""}
        action={addAction}
        fields={{ email: draft?.email ?? "", role: draft?.role ?? "user" }}
        confirmLabel="Add"
        pendingLabel="Adding…"
        onDone={() => {
          setAddOpen(false);
          setFormKey((current) => current + 1);
        }}
      /> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead><span className="block text-right">Role</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((person) => (
            <AccessRowForm key={person.email} person={person} roleAction={roleAction} removeAction={removeAction} />
          ))}
        </TableBody>
      </Table>
    </main>
  );
}

function rolePhrase(role: string) {
  return role === "admin" ? "an admin" : "a user";
}

function RoleSelect({ name, value, defaultValue, onValueChange, label, className }: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: AccessRole) => void;
  label?: string;
  className: string;
}) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <select
        name={name}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        aria-label={label}
        onChange={onValueChange ? (event) => onValueChange(event.target.value === "admin" ? "admin" : "user") : undefined}
        className="h-full w-full appearance-none rounded-lg border border-secondary bg-canvas pr-7 pl-3 text-sm text-primary"
      >
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-primary" aria-hidden="true" />
    </span>
  );
}

function AccessRowForm({ person, roleAction, removeAction }: {
  person: AccessRow;
  roleAction: AccessAction;
  removeAction: AccessAction;
}) {
  const [nextRole, setNextRole] = useState(person.role);
  const [roleNotice, setRoleNotice] = useState<ActionResult | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleSession, setRoleSession] = useState(0);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeSession, setRemoveSession] = useState(0);
  const roleChanged = nextRole !== person.role;
  return (
    <TableRow>
      <TableCell>{person.email}</TableCell>
      <TableCell>
        <form
          className="flex items-center justify-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!roleChanged) return;
            setRoleNotice(null);
            setRoleSession((current) => current + 1);
            setRoleOpen(true);
          }}
        >
          <RoleSelect value={nextRole} onValueChange={setNextRole} label={`Role for ${person.email}`} className="h-8 w-28" />
          {roleChanged ? <Button type="submit" size="sm" variant="outline">Save</Button> : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setRemoveSession((current) => current + 1);
              setRemoveOpen(true);
            }}
          >
            Remove
          </Button>
        </form>
        {roleNotice ? <div className="mt-2 text-right"><FormMessage state={roleNotice} /></div> : null}
        {roleOpen ? <ActionDialog
          key={`role-${roleSession}`}
          open={roleOpen}
          onOpenChange={setRoleOpen}
          title="Change role"
          description={roleChanged
            ? `Change ${person.email} from ${rolePhrase(person.role)} to ${rolePhrase(nextRole)}?`
            : `Save ${person.email} as ${rolePhrase(nextRole)}?`}
          action={roleAction}
          fields={{ email: person.email, role: nextRole }}
          confirmLabel="Change role"
          pendingLabel="Saving…"
          onDone={(result) => {
            setRoleNotice(result);
            setRoleOpen(false);
          }}
        /> : null}
        {removeOpen ? <ActionDialog
          key={`remove-${removeSession}`}
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          title="Remove access"
          description={`Remove ${person.email}? They cannot open the publisher until an admin adds them again.`}
          action={removeAction}
          fields={{ email: person.email }}
          confirmLabel="Remove"
          pendingLabel="Removing…"
          destructive
          onDone={() => setRemoveOpen(false)}
        /> : null}
      </TableCell>
    </TableRow>
  );
}

function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  action,
  fields,
  confirmLabel,
  pendingLabel,
  destructive = false,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  action: AccessAction;
  fields: Record<string, string>;
  confirmLabel: string;
  pendingLabel: string;
  destructive?: boolean;
  onDone: (result: ActionResult) => void;
}) {
  const [state, formAction, pending] = useActionState(async (previous: ActionResult | null, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.ok) onDone(result);
    return result;
  }, null);
  return (
    <Dialog open={open} onOpenChange={blockDismiss(pending, onOpenChange)}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <FormMessage state={state} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <PendingButton
              pending={pending}
              pendingLabel={pendingLabel}
              className={destructive ? "bg-critical text-onPrimary hover:bg-critical/90" : "bg-ink text-onPrimary hover:bg-ink-hover"}
            >
              {confirmLabel}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
