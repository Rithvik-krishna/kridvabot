"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Images,
  Loader2,
  PackageCheck,
  RotateCcw,
} from "lucide-react";
import { fetchJobStatus, resolveBackendUrl } from "@/lib/api";
import { JobStatusResponse } from "@/lib/types";
import { Button } from "./ui/Button";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { ToastTone } from "./ui/Toast";

interface ExportStepProps {
  jobId: string;
  pieceCount: number;
  attempt: number;
  onRetry: () => void;
  onStartNewBatch: () => void;
  onNotify?: (opts: { message: string; tone: ToastTone }) => void;
}

const ROTATING_HINTS = [
  "Composing 1:1 studio framing and natural floor shadows...",
  "Preserving wood grain, cane weave, and original proportions...",
  "Rendering clean Front & Side catalog perspectives...",
  "Generating unique artisan names and editorial copy...",
];

export function ExportStep({
  jobId,
  pieceCount,
  attempt,
  onRetry,
  onStartNewBatch,
  onNotify,
}: ExportStepProps) {
  const [status, setStatus] = useState<JobStatusResponse>({
    status: "processing",
    completed: 0,
    total: Math.max(1, pieceCount + 1),
    message: "Starting studio photo generation...",
    error: null,
    download_url: null,
  });
  const [pollError, setPollError] = useState<string | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [confirmNewBatch, setConfirmNewBatch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let notifiedTerminal = false;

    const poll = async () => {
      try {
        const nextStatus = await fetchJobStatus(jobId);
        if (cancelled) return;
        setStatus(nextStatus);
        setPollError(null);

        if (nextStatus.status === "done" && !notifiedTerminal) {
          notifiedTerminal = true;
          onNotify?.({
            message: "Catalog ZIP ready for download",
            tone: "success",
          });
        } else if (nextStatus.status === "error" && !notifiedTerminal) {
          notifiedTerminal = true;
          onNotify?.({
            message: nextStatus.error || "Catalog generation failed",
            tone: "error",
          });
        }

        if (
          nextStatus.status === "processing" ||
          nextStatus.status === "grouped"
        ) {
          timer = setTimeout(poll, 2000);
        }
      } catch (err) {
        if (cancelled) return;
        setPollError(
          err instanceof Error ? err.message : "Failed to fetch job status."
        );
        timer = setTimeout(poll, 2000);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, attempt, onNotify]);

  useEffect(() => {
    if (status.status !== "processing" && status.status !== "grouped") return;
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % ROTATING_HINTS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [status.status]);

  const percent =
    status.total > 0
      ? Math.min(100, Math.round((status.completed / status.total) * 100))
      : 0;

  const piecesDone = Math.min(status.completed, pieceCount);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-xs">
        {status.status === "done" ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-stone-900">
                Your Furniture Catalog Bundle Is Ready
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Includes{" "}
                <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-800">
                  furniture_catalog.xlsx
                </code>{" "}
                with embedded front thumbnails, 2 name options, HTML features,
                editorial copy, and all 1:1 Front & Side PNGs.
              </p>
            </div>

            {/* Results summary */}
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-left">
              <div className="flex items-center gap-2.5">
                <PackageCheck
                  className="h-5 w-5 shrink-0 text-emerald-700"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-base font-semibold text-stone-900">
                    {pieceCount}
                  </p>
                  <p className="text-xs text-stone-600">Pieces generated</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Images
                  className="h-5 w-5 shrink-0 text-stone-700"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-base font-semibold text-stone-900">
                    {pieceCount * 2}
                  </p>
                  <p className="text-xs text-stone-600">1:1 Studio PNGs</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet
                  className="h-5 w-5 shrink-0 text-emerald-700"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-base font-semibold text-stone-900">0</p>
                  <p className="text-xs text-stone-600">Failures</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              {status.download_url && (
                <a
                  href={resolveBackendUrl(status.download_url)}
                  download="catalog_bundle.zip"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-6 py-3 text-sm font-medium text-stone-50 shadow-xs hover:bg-stone-800"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download catalog_bundle.zip
                </a>
              )}
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setConfirmNewBatch(true)}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Start New Batch
              </Button>
            </div>
          </div>
        ) : status.status === "error" ? (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700">
              <AlertCircle className="h-8 w-8" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-stone-900">
                Generation Failed
              </h2>
              <p
                role="alert"
                className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900"
              >
                {status.error ||
                  status.message ||
                  "An unexpected error occurred."}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button variant="primary" onClick={onRetry}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Retry Failed Generation
              </Button>
              <Button variant="secondary" onClick={onStartNewBatch}>
                Start New Batch
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6" aria-busy="true" aria-live="polite">
            <div className="flex items-start gap-3">
              <Loader2
                className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-emerald-700"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-lg font-semibold text-stone-900">
                  Generating Studio Catalog...
                </h2>
                <p className="text-sm font-medium text-stone-700">
                  {status.message}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {ROTATING_HINTS[hintIndex]}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-stone-700">
                <span>
                  {piecesDone} of {pieceCount}{" "}
                  {pieceCount === 1 ? "piece" : "pieces"} done ({status.completed}{" "}
                  / {status.total} steps)
                </span>
                <span className="text-emerald-800">{percent}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-3 w-full overflow-hidden rounded-full bg-stone-100"
              >
                <div
                  className="h-full rounded-full bg-emerald-700 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            {/* Warning not to close tab */}
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-amber-700"
                aria-hidden="true"
              />
              <span>
                Please keep this tab open while your studio images and Excel
                catalog are being generated.
              </span>
            </div>

            {pollError && (
              <p className="text-xs text-amber-800">
                Connection hiccup ({pollError}) — retrying automatically...
              </p>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmNewBatch}
        title="Start a new batch?"
        description="Starting a new batch will clear your current catalog results from this screen. Make sure you have downloaded catalog_bundle.zip first."
        confirmLabel="Start New Batch"
        cancelLabel="Stay Here"
        onCancel={() => setConfirmNewBatch(false)}
        onConfirm={() => {
          setConfirmNewBatch(false);
          onStartNewBatch();
        }}
      />
    </div>
  );
}
