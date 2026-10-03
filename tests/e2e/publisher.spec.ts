import { expect, test, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { rm } from "node:fs/promises";
import { SESSION_MAX_AGE } from "../../src/lib/auth/policy";
import { e2eEnv } from "./env";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await rm(e2eEnv.PUBLISHER_DATABASE_PATH, { force: true });
  await rm(`${e2eEnv.PUBLISHER_DATABASE_PATH}-wal`, { force: true });
  await rm(`${e2eEnv.PUBLISHER_DATABASE_PATH}-shm`, { force: true });
});

async function showPlatform(page: Page, name: "All" | "Android" | "iOS") {
  const value = name === "All" ? "all" : name === "iOS" ? "ios" : "android";
  const select = page.getByLabel("Platform", { exact: true });
  await expect(async () => {
    if ((await select.inputValue()) !== value) await select.selectOption({ label: name });
    await expect(select).toHaveValue(value);
  }).toPass({ timeout: 15_000 });
}

test("sends a signed-out visitor to sign-in", async ({ page }) => {
  await page.goto("/editor");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
});

test("imports, edits, adds languages and keys, and serves a release", async ({ page }) => {
  const token = await encode({
    secret: e2eEnv.AUTH_SECRET,
    salt: "authjs.session-token",
    maxAge: SESSION_MAX_AGE,
    token: {
      sub: "e2e-user",
      email: "person@anywhere.co",
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
  await page.goto("/editor");
  await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Access" })).toBeVisible();
  await expect(page.getByText("This catalog is empty.")).toBeVisible();

  await page.getByRole("button", { name: "Import" }).click();
  const importDialog = page.getByRole("dialog", { name: "Import" });
  await importDialog.getByLabel("Language file").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a language file"),
  });
  await importDialog.getByRole("option", { name: "English (en)" }).click();
  await importDialog.getByRole("button", { name: "Import" }).click();
  await expect(importDialog.getByRole("alert")).toContainText("Nothing was imported.");
  await expect(page.getByText("This catalog is empty.")).toBeVisible();

  await importDialog.getByLabel("Language file").setInputFiles({
    name: "en.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("key,value\nhello,Hello\n"),
  });
  await importDialog.getByRole("button", { name: "Import" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Imported 1 translations into android / en.");
  await expect(importDialog).toBeHidden();
  await expect(page.getByText("hello", { exact: true })).toBeVisible();
  await expect(page.getByLabel("English value for hello")).toHaveValue("Hello");

  await showPlatform(page, "iOS");
  await page.getByRole("button", { name: "Import" }).click();
  const iosImport = page.getByRole("dialog", { name: "Import" });
  await iosImport.getByRole("option", { name: "English (en)" }).click();
  await iosImport.getByLabel("Language file").setInputFiles({
    name: "ios.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("key,value\nhello,Hi\n"),
  });
  await iosImport.getByRole("button", { name: "Import" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Imported 1 translations into ios / en.");
  await expect(iosImport).toBeHidden();
  await showPlatform(page, "Android");

  const hello = page.getByLabel("English value for hello");
  await hello.fill("Updated hello");
  await page.getByRole("button", { name: "Save" }).click();
  await page.reload();
  await showPlatform(page, "Android");
  await expect(page.getByLabel("English value for hello")).toHaveValue("Updated hello");

  await page.getByLabel("Search", { exact: true }).fill("updated");
  await expect(page.getByText("hello", { exact: true })).toBeVisible();
  await page.getByLabel("Search", { exact: true }).fill("");

  await page.getByRole("button", { name: "Add language" }).click();
  const supported = page.getByRole("dialog", { name: "Supported language" });
  await expect(supported.getByRole("radio", { name: "AI translated" })).toBeChecked();
  await supported.getByRole("option", { name: "Spanish (es)" }).click();
  await supported.getByRole("radio", { name: "Import" }).click();
  await supported.getByLabel("Language file").setInputFiles({
    name: "es.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("key,value\nhello,Hola\n"),
  });
  await supported.getByRole("button", { name: "Add" }).click();
  await expect(supported).toBeHidden();
  await expect(page.getByLabel("Spanish value for hello")).toHaveValue("Hola");

  await page.getByRole("link", { name: "Access" }).click();
  await expect(page.getByRole("heading", { name: "Access" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "person@anywhere.co" })).toBeVisible();
  await page.getByLabel("Email").fill("editor@anywhere.co");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const access = page.getByRole("dialog", { name: "Add access" });
  await access.getByRole("button", { name: "Add", exact: true }).click();
  await expect(access).toBeHidden();
  await expect(page.getByRole("cell", { name: "editor@anywhere.co" })).toBeVisible();

  await page.getByRole("link", { name: "Releases" }).click();
  await page.getByRole("button", { name: "Create release" }).click();
  const releaseDialog = page.getByRole("dialog", { name: "Create release" });
  await releaseDialog.getByLabel("Name").fill("Papercut");
  await releaseDialog.getByRole("button", { name: "Create release" }).click();
  await expect(page.getByRole("cell", { name: "Papercut" })).toBeVisible();
  await page.getByRole("radio", { name: /Set android version \d+ as production/ }).click();
  await page.getByRole("button", { name: "Set production" }).click();
  await expect(page.getByRole("dialog", { name: "Change production" })).toBeHidden();
  await expect(page.getByText("Production", { exact: true })).toBeVisible();
});
