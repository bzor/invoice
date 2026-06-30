import "server-only";

import { cookies } from "next/headers";

export type Flash = { message: string; tone: "success" | "error" };

/** Set a one-shot flash message (call inside a Server Action). */
export async function setFlash(
  message: string,
  tone: Flash["tone"] = "success",
) {
  (await cookies()).set("flash", JSON.stringify({ message, tone }), {
    path: "/",
    maxAge: 15,
    sameSite: "lax",
    // Readable by the client so the toaster can clear it after showing.
    httpOnly: false,
  });
}

/** Read the flash message (call in a layout/page render). */
export async function readFlash(): Promise<Flash | null> {
  const c = (await cookies()).get("flash");
  if (!c) return null;
  try {
    return JSON.parse(c.value) as Flash;
  } catch {
    return null;
  }
}
