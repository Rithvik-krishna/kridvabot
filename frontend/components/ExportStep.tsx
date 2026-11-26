"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { fetchJobStatus, resolveBackendUrl } from "@/lib/api";
import { JobStatusResponse } from "@/lib/types";

interface ExportStepProps {
  jobId: string;
  attempt: number;
  onRetry: () => void;
  onStartNewBatch: () => void;
}

export function ExportStep({
  jobId,
  attempt,
  onRetry,
  onStartNewBatch,
}: ExportStepProps) {
  const [status, setStatus] = useState<JobStatusResponse>({
    status: "processing",
    completed: 0,
    total: 1,
    message: "Starting studio photo generation...",
    error: null,
    download_url: null,
  });
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const nextStatus = await fetchJobStatus(jobId);
        if (cancelled) return;
        setStatus(nextStatus);
        setPollError(null);

        if (nextStatus.status === "processing" || nextStatus.status === "grouped") {
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
  }, [jobId, attempt]);

  const percent =
    status.total > 0
      ? Math.min(100, Math.round((status.completed / status.total) * 100))
      : 0;

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-8 shadow-xs">
      {status.status === "done" ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-stone-900">
              Your Furniture Catalog Bundle Is Ready
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Includes <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">furniture_catalog.xlsx</code> with embedded front thumbnails, 2 name options, HTML features, editorial copy, and all 1:1 Front & Side PNGs.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            {status.download_url && (
              <a
                href={resolveBackendUrl(status.download_url)}
                download="catalog_bundle.zip"
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3 text-sm font-medium text-stone-50 shadow-sm transition hover:bg-stone-800"
              >
                <Download className="h-4 w-4" />
                Download catalog_bundle.zip
              </a>
            )}
            <button
              type="button"
              onClick={onStartNewBatch}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
            >
              <RotateCcw className="h-4 w-4" />
              Start New Batch
            </button>
          </div>
        </div>
      ) : status.status === "error" ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-700">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-stone-900">
              Generation Failed
            </h2>
            <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {status.error || status.message || "An unexpected error occurred."}
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
            >
              <RotateCcw className="h-4 w-4" />
              Retry Failed Generation
            </button>
            <button
              type="button"
              onClick={onStartNewBatch}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
            >
              Start New Batch
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-stone-800" />
            <div>
              <h2 className="text-lg font-semibold text-stone-900">
                Generating Studio Catalog...
              </h2>
              <p className="text-sm text-stone-600">{status.message}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-stone-600">
              <span>
                Progress: {status.completed} / {status.total}
              </span>
              <span>{percent}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-stone-900 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {pollError && (
            <p className="text-xs text-amber-700">
              Connection hiccup ({pollError}) — retrying automatically...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
