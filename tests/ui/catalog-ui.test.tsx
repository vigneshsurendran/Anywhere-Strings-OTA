/** @vitest-environment happy-dom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ImportForm } from "@/src/components/publisher/import-form";
import { WorkingSet } from "@/src/components/publisher/working-set";
import { BuildPanel } from "@/src/components/publisher/build-panel";
import type { ActionResult } from "@/src/features/catalog/types";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a>,
}));

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
  }
});

afterEach(() => cleanup());

const idle = vi.fn(async (): Promise<ActionResult> => ({ ok: true, message: "Saved." }));

describe("working set UI", () => {
  it("shows the empty catalog and filters the visible rows without saving", async () => {
    const { rerender } = render(
      <WorkingSet platform="android" languages={[]} locale={null} rows={[]} saveAction={idle} addLanguageAction={idle} addKeyAction={idle} />,
    );
    expect(screen.getByText("This catalog is empty.")).toBeTruthy();

    rerender(
      <WorkingSet
        platform="android"
        languages={["en", "fr"]}
        locale="en"
        rows={[{ key: "greeting", value: "Hello there" }, { key: "other", value: "Stay" }]}
        saveAction={idle}
        addLanguageAction={idle}
        addKeyAction={idle}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search"), "there");
    expect(screen.getByText("greeting")).toBeTruthy();
    expect(screen.queryByText("other")).toBeNull();
    await user.clear(screen.getByLabelText("Search"));
    expect(screen.getByText("other")).toBeTruthy();
    expect(idle).not.toHaveBeenCalled();
  });

  it("keeps a rejected value on screen and shows the error", async () => {
    const save = vi.fn(async (): Promise<ActionResult> => ({
      ok: false,
      error: "That value is longer than 100000 characters. The saved value was not changed.",
    }));
    render(
      <WorkingSet
        platform="android"
        languages={["en"]}
        locale="en"
        rows={[{ key: "hello", value: "Hello" }]}
        saveAction={save}
        addLanguageAction={idle}
        addKeyAction={idle}
      />,
    );
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: "Value for hello" });
    await user.clear(input);
    await user.type(input, "Not stored");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/not changed/i);
    expect((input as HTMLInputElement).value).toBe("Not stored");
  });

  it("shows a missing value differently from an empty stored value", () => {
    render(
      <WorkingSet
        platform="ios"
        languages={["en"]}
        locale="en"
        rows={[{ key: "missing", value: null }, { key: "blank", value: "" }]}
        saveAction={idle}
        addLanguageAction={idle}
        addKeyAction={idle}
      />,
    );
    expect(screen.getByText("No value")).toBeTruthy();
    expect(screen.getAllByText("No value")).toHaveLength(1);
  });
});

describe("import and publish UI", () => {
  it("asks for a platform, locale, and file, then shows an import error", async () => {
    const action = vi.fn(async (): Promise<ActionResult> => ({ ok: false, error: "Nothing was imported." }));
    render(<ImportForm action={action} platform="android" />);
    const platformField = screen.getByLabelText("Platform");
    expect(platformField.querySelector("svg")).toBeTruthy();
    expect(within(screen.getByRole("listbox", { name: "Language" })).getAllByRole("option")).toHaveLength(10);
    expect(screen.getByRole("option", { name: "English (en)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Vietnamese (vi)" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Finnish (fi)" })).toBeNull();
    expect(screen.getByLabelText("Language file")).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("option", { name: "English (en)" }));
    const file = new File(["key,value\nhello,Hello\n"], "en.csv", { type: "text/csv" });
    await user.upload(screen.getByLabelText("Language file"), file);
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Nothing was imported.");
  });

  it("reviews a publish without accepting a checksum, object path, or file body", async () => {
    render(
      <BuildPanel
        platform="android"
        locale="en"
        builds={[{ id: 7, createdAt: "2026-09-28T15:04:00.123Z", publishedAt: null }]}
        selected={{
          id: 7,
          createdAt: "2026-09-28T15:04:00.123Z",
          publishedAt: null,
          rows: [{ locale: "en", key: "hello", value: "Hello" }],
        }}
        createAction={idle}
        saveAction={idle}
        publishAction={idle}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Review publish" }));
    expect(screen.getByRole("heading", { name: "Publish build 7" })).toBeTruthy();
    expect(screen.queryByLabelText(/checksum/i)).toBeNull();
    expect(screen.queryByLabelText(/object path/i)).toBeNull();
    expect(document.querySelector("input[name='checksum'], input[name='objectPath'], input[name='body']")).toBeNull();
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
  });
});
