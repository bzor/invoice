"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type Tone = "success" | "error";
type Toast = { id: number; message: string; tone: Tone };

const ToastCtx = createContext<(message: string, tone?: Tone) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((message: string, tone: Tone = "success") => {
    const id = ++seq;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      3500,
    );
  }, []);

  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto border px-4 py-2.5 text-sm font-medium shadow-sm ${
              t.tone === "error"
                ? "border-alert bg-surface text-alert"
                : "border-ink bg-ink text-surface"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
