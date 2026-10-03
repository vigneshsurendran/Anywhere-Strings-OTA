import path from "node:path";

const databasePath = path.join(process.cwd(), "data", "e2e-publisher.sqlite");

export const e2eEnv = {
  AUTH_URL: "http://127.0.0.1:3100",
  AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  GCS_BUCKET: "language-ota",
  PUBLISHER_STORAGE: "memory",
  // Keep e2e on the production domain rule even when .env.local relaxes it.
  AUTH_ALLOW_ANY_VERIFIED_EMAIL: "",
  PUBLISHER_DATABASE_PATH: databasePath,
  AUTH_ADMIN_EMAILS: "person@anywhere.co",
  NEXT_DIST_DIR: ".next-e2e",
};
