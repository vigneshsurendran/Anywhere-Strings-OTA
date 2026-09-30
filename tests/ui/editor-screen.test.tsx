/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorScreen } from "@/src/components/publisher/editor-screen";
import type { ActionResult } from "@/src/features/catalog/types";

afterEach(() => cleanup());

const idle = vi.fn(async (): Promise<ActionResult> => ({ ok: true, message: "Saved." }));

const languages = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
];

function renderEditor(
  saveAction: (state: ActionResult | null, formData: FormData) => Promise<ActionResult> = idle,
) {
  return render(
    <EditorScreen
      platform="android"
      onPlatform={() => undefined}
      catalogs={{
        android: { languages, rows: [{ key: "yes_change", values: { en: "YES, CHANGE", fr: null } }] },
        ios: { languages: [], rows: [] },
      }}
      importAction={idle}
      saveAction={saveAction}
      deleteAction={idle}
      addKeyAction={idle}
      addSupportedAction={idle}
    />,
  );
}

describe("editor screen", () => {
  it("shows the frame layout and filters keys without saving", async () => {
    renderEditor();
    expect(screen.getByRole("heading", { name: "Editor" })).toBeTruthy();
    const platform = screen.getByLabelText("Platform") as HTMLSelectElement;
    expect(platform.value).toBe("all");
    expect(screen.queryByText("Supported languages")).toBeNull();
    expect(screen.getByRole("button", { name: "Import" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add language" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add key" })).toBeTruthy();
    expect(screen.getAllByText("English").length).toBeGreaterThan(0);
    expect(screen.getAllByText("French").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.getByLabelText("Matching keys").textContent).toBe("1");
    expect((screen.getByLabelText("Sort") as HTMLSelectElement).value).toBe("az");
    expect(screen.getByText("yes_change")).toBeTruthy();
    expect(screen.getByLabelText("Android").querySelector("svg")).toBeTruthy();
    expect(screen.getByLabelText("French value for yes_change").getAttribute("placeholder")).toBe("Empty");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search"), "missing");
    expect(screen.queryByText("yes_change")).toBeNull();
    expect(screen.getByText("No keys match that search.")).toBeTruthy();
    expect(idle).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Search"));
    await user.type(screen.getByLabelText("Search"), "yes");
    expect(screen.getByText("yes_change")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Toggle Exact Match" }));
    expect(screen.queryByText("yes_change")).toBeNull();
    await user.clear(screen.getByLabelText("Search"));
    await user.type(screen.getByLabelText("Search"), "YES, CHANGE");
    expect(screen.getByText("yes_change")).toBeTruthy();
    await user.clear(screen.getByLabelText("Search"));
    await user.type(screen.getByLabelText("Search"), "yes_change");
    expect(screen.getByText("yes_change")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Case sensitive" }));
    expect((screen.getByRole("button", { name: "Case sensitive" }) as HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByLabelText("Clear search"));
    expect(screen.getByText("yes_change")).toBeTruthy();
  });

  it("filters empty or unsaved values and sorts key names", async () => {
    const onPlatform = vi.fn();
    render(
      <EditorScreen
        platform="android"
        onPlatform={onPlatform}
        catalogs={{
          android: {
            languages,
            rows: [
              { key: "alpha", values: { en: "A", fr: "A" }, updatedAt: "2026-01-02T00:00:00.000Z" },
              { key: "zeta", values: { en: "Z", fr: null }, updatedAt: "2026-01-01T00:00:00.000Z" },
            ],
          },
          ios: { languages: [], rows: [] },
        }}
        importAction={idle}
        saveAction={idle}
        deleteAction={idle}
        addKeyAction={idle}
        addSupportedAction={idle}
      />,
    );
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Filter"), "empty");
    expect(screen.queryByText("alpha")).toBeNull();
    expect(screen.getByText("zeta")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Filter"), "all");
    const alpha = screen.getByLabelText("English value for alpha");
    await user.clear(alpha);
    await user.type(alpha, "Draft");
    await user.selectOptions(screen.getByLabelText("Filter"), "unsaved");
    expect(screen.getByText("alpha")).toBeTruthy();
    expect(screen.queryByText("zeta")).toBeNull();
    await user.selectOptions(screen.getByLabelText("Filter"), "all");
    await user.selectOptions(screen.getByLabelText("Sort"), "za");
    expect(screen.getAllByRole("checkbox", { name: /^Select (alpha|zeta)$/ }).map((node) => node.getAttribute("aria-label"))).toEqual([
      "Select zeta",
      "Select alpha",
    ]);
    await user.selectOptions(screen.getByLabelText("Sort"), "modified");
    expect(screen.getAllByRole("checkbox", { name: /^Select (alpha|zeta)$/ }).map((node) => node.getAttribute("aria-label"))).toEqual([
      "Select alpha",
      "Select zeta",
    ]);
    await user.selectOptions(screen.getByLabelText("Platform"), "ios");
    expect(onPlatform).toHaveBeenCalledWith("ios");
    expect(screen.getByText(/This catalog is empty/)).toBeTruthy();
    expect(screen.getByText(/Android still has saved languages/)).toBeTruthy();
  });

  it("deletes the checked keys on each platform in view", async () => {
    const deleteAction = vi.fn(async (_state: ActionResult | null, formData: FormData): Promise<ActionResult> => {
      return { ok: true, message: `Deleted ${formData.get("platform")}.` };
    });
    render(
      <EditorScreen
        platform="android"
        onPlatform={() => undefined}
        catalogs={{
          android: { languages, rows: [{ key: "hello", values: { en: "Hello", fr: null } }] },
          ios: { languages, rows: [{ key: "hello", values: { en: "Hi", fr: null } }] },
        }}
        importAction={idle}
        saveAction={idle}
        deleteAction={deleteAction}
        addKeyAction={idle}
        addSupportedAction={idle}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Select all"));
    await user.click(screen.getByRole("button", { name: "Delete 2" }));
    const dialog = screen.getByRole("dialog", { name: "Delete keys" });
    expect(dialog.textContent).toContain("1 key from Android and 1 key from iOS");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete keys" })).toBeNull();
    });
    expect(deleteAction).toHaveBeenCalledTimes(2);
    const platforms = deleteAction.mock.calls.map((call) => String(call[1].get("platform")));
    expect(platforms).toEqual(["android", "ios"]);
  });

  it("saves a changed value from the button beside that field", async () => {
    const save = vi.fn(async (_state: ActionResult | null, formData: FormData): Promise<ActionResult> => {
      expect(formData.get("key")).toBe("yes_change");
      expect(formData.get("locale")).toBe("en");
      expect(formData.get("value")).toBe("YES");
      return { ok: true, message: "Saved." };
    });
    renderEditor(save);
    const user = userEvent.setup();
    const input = screen.getByLabelText("English value for yes_change");
    await user.clear(input);
    await user.type(input, "YES");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledOnce();
  });

  it("keeps a rejected value and shows the error", async () => {
    const save = vi.fn(async (): Promise<ActionResult> => ({
      ok: false,
      error: "That value is longer than 100000 characters. The saved value was not changed.",
    }));
    renderEditor(save);
    const user = userEvent.setup();
    const input = screen.getByLabelText("English value for yes_change");
    await user.clear(input);
    await user.type(input, "Not stored");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/not changed/i);
    expect((input as HTMLInputElement).value).toBe("Not stored");
  });

  it("adds a key on the platform on screen and rejects an invalid key", async () => {
    const addKey = vi.fn(async (_state: ActionResult | null, formData: FormData): Promise<ActionResult> => {
      const key = String(formData.get("key"));
      if (key === "1bad") return { ok: false, error: "Enter a key that starts with a letter. Nothing was saved." };
      expect(formData.get("platform")).toBe("android");
      expect(formData.get("value")).toBe("Hello there");
      expect(formData.get("translate")).toBe("on");
      return { ok: true, message: `Added ${key} to android.` };
    });
    render(
      <EditorScreen
        platform="android"
        onPlatform={() => undefined}
        catalogs={{
          android: { languages, rows: [{ key: "yes_change", values: { en: "YES, CHANGE", fr: null } }] },
          ios: { languages: [], rows: [] },
        }}
        importAction={idle}
        saveAction={idle}
        deleteAction={idle}
        addKeyAction={addKey}
        addSupportedAction={idle}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add key" }));
    const first = screen.getByRole("dialog", { name: "Add key" });
    expect(first.textContent).toContain("Android only");
    expect((within(first).getByRole("checkbox", { name: "AI translation" }) as HTMLInputElement).checked).toBe(true);
    await user.click(within(first).getByRole("button", { name: "Cancel" }));
    expect(addKey).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Add key" })).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Add key" }));
    const dialog = screen.getByRole("dialog", { name: "Add key" });
    await user.type(within(dialog).getByLabelText("Key"), "1bad");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/Nothing was saved/);
    expect(addKey).toHaveBeenCalledOnce();

    await user.clear(within(dialog).getByLabelText("Key"));
    await user.type(within(dialog).getByLabelText("Key"), "welcome_title");
    await user.type(within(dialog).getByLabelText("Value"), "Hello there");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Add key" })).toBeNull();
    });
    expect(screen.getByRole("status").textContent).toContain("Added welcome_title to android.");
    expect(addKey).toHaveBeenCalledTimes(2);
  });

  it("asks before deleting and shows a loader until the delete finishes", async () => {
    let finish: (result: ActionResult) => void = () => undefined;
    const deleteAction = vi.fn(() => new Promise<ActionResult>((resolve) => {
      finish = resolve;
    }));
    render(
      <EditorScreen
        platform="android"
        onPlatform={() => undefined}
        catalogs={{
          android: { languages, rows: [{ key: "yes_change", values: { en: "YES, CHANGE", fr: null } }] },
          ios: { languages: [], rows: [] },
        }}
        importAction={idle}
        saveAction={idle}
        deleteAction={deleteAction}
        addKeyAction={idle}
        addSupportedAction={idle}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Select yes_change"));
    await user.click(screen.getByRole("button", { name: "Delete 1" }));
    expect(screen.getByRole("dialog", { name: "Delete keys" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteAction).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete keys" })).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Delete 1" }));
    const clickDelete = user.click(screen.getByRole("button", { name: "Delete" }));
    const deleting = await screen.findByRole("button", { name: "Deleting…" });
    expect(deleting.querySelector(".animate-spin")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    expect(deleteAction).toHaveBeenCalledOnce();
    finish({ ok: true, message: "Deleted 1 key." });
    await clickDelete;
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete keys" })).toBeNull();
    });
  });

  it("selects the keys currently shown", async () => {
    renderEditor();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Select all"));
    expect((screen.getByLabelText("Select yes_change") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("button", { name: "Delete 1" })).toBeTruthy();
    await user.click(screen.getByLabelText("Select all"));
    expect((screen.getByLabelText("Select yes_change") as HTMLInputElement).checked).toBe(false);
  });

  it("mounts only the cards in view and still selects every search match", async () => {
    const rows = Array.from({ length: 2000 }, (_, index) => ({
      key: `key_${String(index).padStart(4, "0")}`,
      values: {
        en: index === 1999 ? "unique-tail" : `value ${index}`,
        fr: "shared",
      },
    }));
    render(
      <EditorScreen
        platform="android"
        onPlatform={() => undefined}
        catalogs={{
          android: { languages, rows },
          ios: { languages: [], rows: [] },
        }}
        importAction={idle}
        saveAction={idle}
        deleteAction={idle}
        addKeyAction={idle}
        addSupportedAction={idle}
      />,
    );

    expect(screen.getByLabelText("Matching keys").textContent).toBe("2000");
    const mounted = screen.getAllByRole("checkbox", { name: /Select key_/ });
    expect(mounted.length).toBeGreaterThan(0);
    expect(mounted.length).toBeLessThan(40);
    expect(screen.queryByText("key_1999")).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Select all"));
    expect(screen.getByRole("button", { name: "Delete 2000" })).toBeTruthy();

    await user.type(screen.getByLabelText("Search"), "unique-tail");
    expect((await screen.findByLabelText("Matching keys")).textContent).toBe("1");
    expect(screen.getByText("key_1999")).toBeTruthy();
    expect(screen.getAllByRole("checkbox", { name: /Select key_/ })).toHaveLength(1);
    await user.click(screen.getByLabelText("Select all"));
    expect(screen.getByRole("button", { name: "Delete 1999" })).toBeTruthy();
  });

  it("forgets an unsaved edit when that key is removed", async () => {
    const onUnsavedCount = vi.fn();
    const filled = {
      android: { languages, rows: [{ key: "yes_change", values: { en: "YES, CHANGE", fr: "OUI" } }] },
      ios: { languages: [] as typeof languages, rows: [] },
    };
    const props = {
      platform: "android" as const,
      onPlatform: () => undefined,
      importAction: idle,
      saveAction: idle,
      deleteAction: idle,
      addKeyAction: idle,
      addSupportedAction: idle,
      onUnsavedCount,
    };
    const view = render(<EditorScreen {...props} catalogs={filled} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("English value for yes_change");
    await user.clear(input);
    await user.type(input, "Draft");
    expect(onUnsavedCount.mock.calls.at(-1)?.[0]).toBe(1);

    view.rerender(<EditorScreen {...props} catalogs={{ android: { languages: [], rows: [] }, ios: { languages: [], rows: [] } }} />);
    expect(onUnsavedCount.mock.calls.at(-1)?.[0]).toBe(0);

    view.rerender(<EditorScreen {...props} catalogs={filled} />);
    expect((screen.getByLabelText("English value for yes_change") as HTMLInputElement).value).toBe("YES, CHANGE");
    expect(onUnsavedCount.mock.calls.at(-1)?.[0]).toBe(0);
  });

  it("opens supported languages on AI translated and searches the catalog", async () => {
    renderEditor();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add language" }));
    expect(screen.getByRole("heading", { name: "Supported language" })).toBeTruthy();
    expect((screen.getByRole("radio", { name: "AI translated" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("option", { name: "Spanish (es)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Vietnamese (vi)" })).toBeNull();
    expect(screen.queryByRole("option", { name: "English (en)" })).toBeNull();
    await user.type(screen.getByLabelText("Search languages"), "viet");
    expect(screen.getByRole("option", { name: "Vietnamese (vi)" })).toBeTruthy();
    await user.clear(screen.getByLabelText("Search languages"));
    await user.type(screen.getByLabelText("Search languages"), "finn");
    expect(screen.getByRole("option", { name: "Finnish (fi)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Spanish (es)" })).toBeNull();
  });
});
