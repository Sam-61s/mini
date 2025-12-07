import { createAuthClient } from "better-auth/react"

const baseURL =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_APP_URL
    : window.location.origin;
export const authClient = createAuthClient({
  ...(baseURL ? { baseURL } : {}),
});