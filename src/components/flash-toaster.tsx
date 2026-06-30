"use client";

import { useEffect } from "react";

import { useToast } from "@/components/toast";
import type { Flash } from "@/lib/flash";

/** Surfaces a server-set flash message as a toast, then clears the cookie. */
export function FlashToaster({ flash }: { flash: Flash | null }) {
  const toast = useToast();

  useEffect(() => {
    if (!flash) return;
    toast(flash.message, flash.tone);
    document.cookie = "flash=; Max-Age=0; path=/";
  }, [flash, toast]);

  return null;
}
