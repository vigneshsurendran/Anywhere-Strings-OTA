export type Platform = "android" | "ios";

export const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:[_-][A-Za-z0-9]{2,8})*$/;
export const ADDED_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,199}$/;
export const MAX_IMPORT_KEY_LENGTH = 500;
export const MAX_VALUE_LENGTH = 100_000;

export function isPlatform(value: unknown): value is Platform {
  return value === "android" || value === "ios";
}

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export function assertLocale(locale: string) {
  if (!LOCALE_PATTERN.test(locale)) {
    throw new InputError("Enter a locale such as en or pt-BR. Nothing was saved.");
  }
}

export function assertAddedKey(key: string) {
  if (!ADDED_KEY_PATTERN.test(key)) {
    throw new InputError("Enter a key that starts with a letter and uses only letters, numbers, dots, underscores, or hyphens (up to 200 characters). Nothing was saved.");
  }
}

export function assertStoredValue(value: string) {
  if (value.length > MAX_VALUE_LENGTH) {
    throw new InputError("That value is longer than 100000 characters. The saved value was not changed.");
  }
}
