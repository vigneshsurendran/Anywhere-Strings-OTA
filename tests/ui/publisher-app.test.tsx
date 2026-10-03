/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublisherApp } from "@/src/components/publisher/publisher-app";
import type { ActionResult } from "@/src/features/catalog/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/editor",
}));

afterEach(() => cleanup());

const idle = vi.fn(async (): Promise<ActionResult> => ({ ok: true, message: "Saved." }));

describe("publisher header", () => {
  it("shows Sign out and submits it", async () => {
    const signOut = vi.fn(async () => undefined);
    render(
      <PublisherApp
        android={{ languages: [], rows: [] }}
        ios={{ languages: [], rows: [] }}
        releases={[]}
        people={[]}
        role="user"
        importAction={idle}
        saveAction={idle}
        deleteAction={idle}
        addKeyAction={idle}
        addSupportedAction={idle}
        addAccessAction={idle}
        roleAction={idle}
        removeAccessAction={idle}
        createReleaseAction={idle}
        renameReleaseAction={idle}
        setProductionAction={idle}
        signOutAction={signOut}
      />,
    );

    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button.closest("form")).toBeTruthy();
    await userEvent.setup().click(button);
    expect(signOut).toHaveBeenCalledOnce();
  });
});
