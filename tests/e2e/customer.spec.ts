import { expect, test, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, rm } from "node:fs/promises";
import { SESSION_MAX_AGE } from "../../src/lib/auth/policy";
import { e2eEnv } from "./env";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await rm(e2eEnv.PUBLISHER_DATABASE_PATH, { force: true });
  await rm(`${e2eEnv.PUBLISHER_DATABASE_PATH}-wal`, { force: true });
  await rm(`${e2eEnv.PUBLISHER_DATABASE_PATH}-shm`, { force: true });
});

async function signIn(page: Page, email = "person@anywhere.co") {
  const token = await encode({
    secret: e2eEnv.AUTH_SECRET,
    salt: "authjs.session-token",
    maxAge: SESSION_MAX_AGE,
    token: {
      sub: email,
      email,
      emailVerified: true,
      authenticatedUntil: Date.now() + SESSION_MAX_AGE * 1000,
    },
  });
  await page.context().addCookies([{
    name: "authjs.session-token",
    value: token,
    url: e2eEnv.AUTH_URL,
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

function cardLanguages(page: Page, platform: "android" | "ios", key: string) {
  return page.locator(`[data-platform="${platform}"][data-key="${key}"] [data-language]`);
}

async function showPlatform(page: Page, name: "All" | "Android" | "iOS") {
  const value = name === "All" ? "all" : name === "iOS" ? "ios" : "android";
  const select = page.getByLabel("Platform", { exact: true });
  await expect(async () => {
    if ((await select.inputValue()) !== value) await select.selectOption({ label: name });
    await expect(select).toHaveValue(value);
  }).toPass({ timeout: 15_000 });
}

async function importCsv(page: Page, filename: string, body: string, language: string) {
  await page.getByRole("button", { name: "Import" }).click();
  const dialog = page.getByRole("dialog", { name: "Import" });
  await dialog.getByRole("option", { name: language }).click();
  await dialog.getByLabel("Language file").setInputFiles({
    name: filename,
    mimeType: "text/csv",
    buffer: Buffer.from(body),
  });
  await dialog.getByRole("button", { name: "Import" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Imported");
  await expect(dialog).toBeHidden();
}

test("sends a signed-out visitor to sign-in and keeps the editor closed", async ({ page }) => {
  await page.goto("/releases");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await page.goto("/access");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
});

test("imports, edits, and keeps Android and iOS apart", async ({ page }) => {
  await signIn(page);
  await page.goto("/editor");
  await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();
  await expect(page.getByText("This catalog is empty.")).toBeVisible();

  await importCsv(page, "en.csv", "key,value\nhello,Hello\ngoodbye,Goodbye\n", "English (en)");
  await importCsv(page, "es.csv", "key,value\nhello,Hola\n", "Spanish (es)");
  await importCsv(page, "fr.csv", "key,value\nhello,Bonjour\n", "French (fr)");
  await expect(cardLanguages(page, "android", "hello")).toHaveText(["English", "Spanish", "French"]);
  await expect(page.getByLabel("Spanish value for hello")).toHaveValue("Hola");
  await expect(page.getByLabel("Spanish value for goodbye")).toHaveValue("");

  await page.getByLabel("Search", { exact: true }).fill("goodbye");
  await expect(page.getByText("hello", { exact: true })).toHaveCount(0);
  await expect(page.getByText("goodbye", { exact: true })).toBeVisible();
  await page.getByLabel("Search", { exact: true }).fill("");
  await page.getByLabel("Search", { exact: true }).fill("hell");
  await expect(page.getByText("hello", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Toggle Exact Match" }).click();
  await expect(page.getByText("hello", { exact: true })).toHaveCount(0);
  await page.getByLabel("Clear search").click();
  await expect(page.getByRole("button", { name: "Toggle Exact Match" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Toggle Exact Match" }).click();

  const hello = page.getByLabel("English value for hello");
  await hello.fill("Hello there");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(hello).toHaveValue("Hello there");
  await page.reload();
  await expect(page.getByLabel("English value for hello")).toHaveValue("Hello there");

  await page.getByLabel("English value for goodbye").fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("English value for goodbye")).toHaveAttribute("placeholder", "Empty");

  await showPlatform(page, "iOS");
  await importCsv(page, "ios.csv", "key,value\nhello,Hi\n", "English (en)");
  await expect(cardLanguages(page, "ios", "hello")).toHaveText(["English"]);
  await expect(page.getByLabel("English value for hello")).toHaveValue("Hi");
  await showPlatform(page, "Android");
  await expect(page.getByLabel("English value for hello")).toHaveValue("Hello there");
  await expect(page.getByLabel("Spanish value for hello")).toHaveValue("Hola");

  await page.getByRole("button", { name: "Add key" }).click();
  const invalidKey = page.getByRole("dialog", { name: "Add key" });
  await expect(invalidKey.getByRole("checkbox", { name: "AI translation" })).toBeChecked();
  await invalidKey.getByLabel("Key").fill("1bad");
  await invalidKey.getByRole("button", { name: "Add", exact: true }).click();
  await expect(invalidKey.getByRole("alert")).toContainText("Nothing was saved");
  await invalidKey.getByRole("checkbox", { name: "AI translation" }).uncheck();
  await invalidKey.getByLabel("Key").fill("farewell");
  await invalidKey.getByLabel("Value").fill("See you");
  await invalidKey.getByRole("button", { name: "Add", exact: true }).click();
  await expect(invalidKey).toBeHidden();
  await expect(page.locator("main").getByRole("status")).toContainText("Added farewell to android.");
  await expect(page.getByLabel("English value for farewell")).toHaveValue("See you");
  await expect(page.getByLabel("Spanish value for farewell")).toHaveValue("");
  await expect(page.getByLabel("French value for farewell")).toHaveValue("");
  await showPlatform(page, "iOS");
  await expect(page.getByText("farewell", { exact: true })).toHaveCount(0);
  await showPlatform(page, "Android");
  await page.getByLabel("Select farewell").click();
  await page.getByRole("button", { name: "Delete 1" }).click();
  await page.getByRole("dialog", { name: "Delete keys" }).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("farewell", { exact: true })).toHaveCount(0);
});

test("deleting every key removes those languages, and adding English does not bring them back", async ({ page }) => {
  await signIn(page);
  await page.goto("/editor");
  await showPlatform(page, "Android");

  await page.getByLabel("English value for hello").fill("Not saved yet");
  await page.getByLabel("Select all").click();
  await page.getByRole("button", { name: "Delete 2" }).click();
  const cancel = page.getByRole("dialog", { name: "Delete keys" });
  await cancel.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("hello", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Delete 2" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete keys" });
  await expect(confirm.getByText(/from Android/)).toBeVisible();
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByText("This catalog is empty.")).toBeVisible();
  await expect(page.locator("[data-language]")).toHaveCount(0);

  await page.getByRole("link", { name: "Releases" }).click();
  await expect(page.getByText("Save the open edits in Editor before creating a release.")).toHaveCount(0);
  await page.getByRole("button", { name: "Create release" }).click();
  const blocked = page.getByRole("dialog", { name: "Create release" });
  await expect(blocked.getByRole("button", { name: "Android", exact: true })).toHaveAttribute("aria-pressed", "true");
  await blocked.getByRole("button", { name: "Create release" }).click();
  await expect(blocked.getByRole("alert")).toContainText("no languages");
  await blocked.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("link", { name: "Editor" }).click();
  await importCsv(page, "en.csv", "key,value\nhello,Hello again\n", "English (en)");
  await expect(cardLanguages(page, "android", "hello")).toHaveText(["English"]);
  await expect(page.getByLabel("English value for hello")).toHaveValue("Hello again");
  await expect(page.getByLabel("Spanish value for hello")).toHaveCount(0);
  await expect(page.getByLabel("French value for hello")).toHaveCount(0);
  await expect(page.getByText("goodbye", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Add language" }).click();
  const supported = page.getByRole("dialog", { name: "Supported language" });
  await expect(supported.getByRole("option", { name: "English (en)" })).toHaveCount(0);
  await expect(supported.getByRole("option", { name: "Spanish (es)" })).toBeVisible();
  await supported.getByRole("button", { name: "Cancel" }).click();

  await showPlatform(page, "iOS");
  await expect(cardLanguages(page, "ios", "hello")).toHaveText(["English"]);
  await expect(page.getByLabel("English value for hello")).toHaveValue("Hi");
  await expect(page.getByLabel("Spanish value for hello")).toHaveCount(0);
});

test("a long list still shows the last key when the editor was hidden on first load", async ({ page }) => {
  await signIn(page);
  await page.goto("/editor");
  const lines = ["key,value"];
  for (let index = 0; index < 40; index += 1) lines.push(`scroll_${String(index).padStart(2, "0")},Value ${index}`);
  await importCsv(page, "scroll.csv", `${lines.join("\n")}\n`, "English (en)");
  await showPlatform(page, "Android");
  await expect(page.getByLabel("Matching keys")).toHaveText("41");

  await page.goto("/releases");
  await expect(page.getByRole("heading", { name: "Releases" })).toBeVisible();
  await page.getByRole("link", { name: "Editor" }).click();
  await expect(page.getByText("scroll_00", { exact: true })).toBeVisible();

  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    for (let y = 0; y <= document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await delay(30);
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await expect(page.getByText("scroll_39", { exact: true })).toBeVisible();
  const boxes = await page.locator("[data-index]").evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom };
  }));
  const visible = boxes.filter((box) => box.bottom > 0 && box.top < 900).sort((left, right) => left.top - right.top);
  for (let index = 1; index < visible.length; index += 1) {
    expect(visible[index].top).toBeGreaterThanOrEqual(visible[index - 1].bottom - 1);
  }
});

test("creates, renames, downloads, and serves a release without touching the other platform", async ({ page }) => {
  await signIn(page);
  await page.goto("/releases");
  await page.getByRole("button", { name: "Create release" }).click();
  const created = page.getByRole("dialog", { name: "Create release" });
  await created.getByLabel("Name").fill("Papercut");
  await created.getByRole("button", { name: "Create release" }).click();
  await expect(created).toBeHidden();
  await expect(page.getByRole("cell", { name: "Papercut" })).toBeVisible();

  await page.getByRole("button", { name: "Create release" }).click();
  const duplicate = page.getByRole("dialog", { name: "Create release" });
  await duplicate.getByRole("button", { name: "Create release" }).click();
  await expect(duplicate.getByRole("alert")).toContainText("matches the latest release");
  await duplicate.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Papercut" }).click();
  const name = page.getByLabel(/Name for android version \d+/);
  await name.fill("Papercut renamed");
  await name.press("Tab");
  await expect(page.getByRole("button", { name: "Papercut renamed" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("row", { name: /Papercut renamed/ }).getByRole("link", { name: "Download" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^android-v\d+-en\.json$/);
  const saved = await download.path();
  expect(saved).toBeTruthy();
  const text = await readFile(saved ?? "", "utf8");
  expect(text).toContain("Hello again");
  expect(text).not.toContain("Hola");
  expect(text).not.toContain("Hi");

  await page.getByRole("radio", { name: /Set android version \d+ as production/ }).click();
  const production = page.getByRole("dialog", { name: "Change production" });
  await production.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Production", { exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: /Set android version \d+ as production/ }).click();
  await page.getByRole("button", { name: "Set production" }).click();
  await expect(page.getByText("Production", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "iOS", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Papercut renamed" })).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Papercut renamed" })).toBeVisible();
});

test("adding English on one platform does not restore languages deleted there", async ({ page }) => {
  await signIn(page);
  await page.goto("/editor");
  await page.getByRole("button", { name: "Add language" }).click();
  const supported = page.getByRole("dialog", { name: "Supported language" });
  await expect(supported.getByRole("option", { name: "Vietnamese (vi)" })).toHaveCount(0);
  await supported.getByRole("option", { name: "German (de)" }).click();
  await supported.getByRole("radio", { name: "Import" }).click();
  await supported.getByLabel("Language file").setInputFiles({
    name: "de.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("key,value\nhello,Hallo\n"),
  });
  await supported.getByRole("button", { name: "Add" }).click();
  await expect(supported).toBeHidden();
  await expect(cardLanguages(page, "android", "hello")).toHaveText(["German", "English"]);

  await showPlatform(page, "iOS");
  await expect(cardLanguages(page, "ios", "hello")).toHaveText(["German", "English"]);
  await expect(page.getByLabel("German value for hello")).toHaveValue("Hallo");
  await showPlatform(page, "Android");

  await page.getByLabel("Select all").click();
  await page.getByRole("button", { name: "Delete 41" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete keys" });
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("This catalog is empty.")).toBeVisible();
  await expect(page.getByText("iOS still has saved languages.")).toBeVisible();
  await expect(page.locator("[data-language]")).toHaveCount(0);

  await importCsv(page, "en.csv", "key,value\nhello,Hello again\n", "English (en)");
  await expect(cardLanguages(page, "android", "hello")).toHaveText(["English"]);
  await expect(page.getByLabel("German value for hello")).toHaveCount(0);
  await expect(page.getByLabel("Spanish value for hello")).toHaveCount(0);
  await expect(page.getByLabel("French value for hello")).toHaveCount(0);

  await showPlatform(page, "iOS");
  await expect(cardLanguages(page, "ios", "hello")).toHaveText(["German", "English"]);
  await expect(page.getByLabel("German value for hello")).toHaveValue("Hallo");
  await expect(page.getByLabel("English value for hello")).toHaveValue("Hi");
});

test("an admin manages access, and a user cannot open it", async ({ page, browser }) => {
  await signIn(page);
  await page.goto("/access");
  await expect(page.getByRole("heading", { name: "Access" })).toBeVisible();
  await page.getByLabel("Email").fill("person@gmail.com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const denied = page.getByRole("dialog", { name: "Add access" });
  await expect(denied.getByText("person@gmail.com")).toBeVisible();
  await denied.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("cell", { name: "person@gmail.com" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await denied.getByRole("button", { name: "Add", exact: true }).click();
  await expect(denied.getByRole("alert")).toContainText("cannot be added");
  await denied.getByRole("button", { name: "Cancel" }).click();

  await page.getByLabel("Email").fill("Editor@Anywhere.co");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const added = page.getByRole("dialog", { name: "Add access" });
  await added.getByRole("button", { name: "Add", exact: true }).click();
  await expect(added).toBeHidden();
  await expect(page.getByRole("cell", { name: "editor@anywhere.co" })).toBeVisible();

  await page.getByLabel("Email").fill("editor@anywhere.co");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const duplicate = page.getByRole("dialog", { name: "Add access" });
  await duplicate.getByRole("button", { name: "Add", exact: true }).click();
  await expect(duplicate.getByRole("alert")).toContainText("already listed");
  await duplicate.getByRole("button", { name: "Cancel" }).click();

  const admin = page.getByRole("row", { name: /person@anywhere.co/ });
  await admin.getByRole("button", { name: "Remove" }).click();
  const removeAdmin = page.getByRole("dialog", { name: "Remove access" });
  await removeAdmin.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("cell", { name: "person@anywhere.co" })).toBeVisible();
  await admin.getByRole("button", { name: "Remove" }).click();
  await removeAdmin.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(removeAdmin.getByRole("alert")).toContainText("Keep at least one admin");
  await removeAdmin.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("cell", { name: "person@anywhere.co" })).toBeVisible();

  const editor = page.getByRole("row", { name: /editor@anywhere.co/ });
  await editor.getByLabel("Role for editor@anywhere.co").selectOption("admin");
  await editor.getByRole("button", { name: "Save" }).click();
  const promote = page.getByRole("dialog", { name: "Change role" });
  await expect(promote.getByText("from a user to an admin")).toBeVisible();
  await promote.getByRole("button", { name: "Change role" }).click();
  await expect(promote).toBeHidden();
  await expect(editor.getByRole("status")).toBeVisible();
  await editor.getByLabel("Role for editor@anywhere.co").selectOption("user");
  await editor.getByRole("button", { name: "Save" }).click();
  const demote = page.getByRole("dialog", { name: "Change role" });
  await expect(demote.getByText(/to a user|as a user/)).toBeVisible();
  await demote.getByRole("button", { name: "Change role" }).click();
  await expect(demote).toBeHidden();
  await expect(editor.getByLabel("Role for editor@anywhere.co")).toHaveValue("user");

  const context = await browser.newContext();
  const userPage = await context.newPage();
  await signIn(userPage, "editor@anywhere.co");
  await userPage.goto("/editor");
  await expect(userPage.getByRole("link", { name: "Access" })).toHaveCount(0);
  await expect(userPage.getByRole("heading", { name: "Editor" })).toBeVisible();
  await userPage.goto("/access");
  await expect(userPage).toHaveURL(/\/editor$/);
  await expect(userPage.getByRole("heading", { name: "Access" })).toHaveCount(0);
  await context.close();

  await editor.getByRole("button", { name: "Remove" }).click();
  const removeUser = page.getByRole("dialog", { name: "Remove access" });
  await removeUser.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(removeUser).toBeHidden();
  await expect(page.getByRole("cell", { name: "editor@anywhere.co" })).toHaveCount(0);
});

test("sign out returns to the sign-in page", async ({ page }) => {
  await signIn(page);
  await page.goto("/editor");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await page.goto("/editor");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
});
