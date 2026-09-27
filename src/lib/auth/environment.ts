import "server-only";

export function isAuthConfigured(): boolean {
  const { AUTH_URL, AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!AUTH_URL || !AUTH_SECRET || AUTH_SECRET.length < 32 ||
      !GOOGLE_CLIENT_ID?.trim() || !GOOGLE_CLIENT_SECRET?.trim()) return false;
  try {
    const url = new URL(AUTH_URL);
    const local = process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || (local && url.protocol === "http:")) &&
      url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
  } catch {
    return false;
  }
}
