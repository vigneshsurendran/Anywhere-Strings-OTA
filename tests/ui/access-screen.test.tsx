/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessScreen } from "@/src/components/publisher/access-screen";
import type { ActionResult } from "@/src/features/catalog/types";

afterEach(() => cleanup());

const idle = vi.fn(async (): Promise<ActionResult> => ({ ok: true, message: "Saved." }));

function renderAccess(
  removeAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult> = idle,
) {
  return render(
    <AccessScreen
      people={[{ email: "person@anywhere.co", role: "admin" }, { email: "editor@anywhere.co", role: "user" }]}
      addAction={idle}
      roleAction={idle}
      removeAction={removeAction}
    />,
  );
}

describe("access screen", () => {
  it("asks before removing someone and does nothing on cancel", async () => {
    const remove = vi.fn(async (): Promise<ActionResult> => ({ ok: true, message: "Removed editor@anywhere.co." }));
    renderAccess(remove);
    const user = userEvent.setup();
    const row = screen.getByRole("row", { name: /editor@anywhere.co/ });
    await user.click(within(row).getByRole("button", { name: "Remove" }));
    const dialog = screen.getByRole("dialog", { name: "Remove access" });
    expect(dialog.textContent).toContain("editor@anywhere.co");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(remove).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Remove access" })).toBeNull();
    });
    expect(screen.getByRole("cell", { name: "editor@anywhere.co" })).toBeTruthy();
  });

  it("shows a loader while a confirmed removal is processing", async () => {
    let finish: (result: ActionResult) => void = () => undefined;
    const remove = vi.fn((_state: ActionResult | null, formData: FormData) => {
      expect(formData.get("email")).toBe("editor@anywhere.co");
      return new Promise<ActionResult>((resolve) => {
        finish = resolve;
      });
    });
    renderAccess(remove);
    const user = userEvent.setup();
    await user.click(within(screen.getByRole("row", { name: /editor@anywhere.co/ })).getByRole("button", { name: "Remove" }));
    const dialog = screen.getByRole("dialog", { name: "Remove access" });
    const clickRemove = user.click(within(dialog).getByRole("button", { name: "Remove" }));
    const removing = await screen.findByRole("button", { name: "Removing…" });
    expect(removing.querySelector(".animate-spin")).toBeTruthy();
    expect(remove).toHaveBeenCalledOnce();
    finish({ ok: true, message: "Removed editor@anywhere.co." });
    await clickRemove;
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Remove access" })).toBeNull();
    });
  });
});
