"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastTone = "success" | "warning" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-red-200 bg-red-50 text-red-950",
  info: "border-stone-200 bg-white text-stone-900",
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  switch (tone) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />;
    case "error":
      return <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />;
    default:
      return <Info className="h-4 w-4 shrink-0 text-stone-600" aria-hidden="true" />;
  }
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-4 bottom-20 z-50 flex w-full max-w-sm flex-col gap-2 sm:right-6 sm:bottom-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${TONE_STYLES[toast.tone]}`}
        >
          <div className="flex items-center gap-2.5">
            <ToneIcon tone={toast.tone} />
            <span className="font-medium leading-snug">{toast.message}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  onDismiss(toast.id);
                }}
                className="rounded-md px-2 py-1 text-xs font-semibold underline underline-offset-2 hover:bg-black/5"
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-md p-1 opacity-70 hover:bg-black/5 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
