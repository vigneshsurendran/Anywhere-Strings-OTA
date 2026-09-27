import "server-only";
import NextAuth from "next-auth";
import { createAuthConfig } from "./config";

export const { auth, handlers, signIn, signOut } = NextAuth(createAuthConfig);
