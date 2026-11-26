"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "./ui/Button";

interface UploadStepProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  prompt: string;
  defaultPrompt?: string;
  onPromptChange: (prompt: string) => void;
  existingNamesText: string;
  onExistingNamesTextChange: (text: string) => void;
  isPromptLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: () => void;
}

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACCEPTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function isSupportedImageFile(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.has(file.type)) return true;
  const lower = file.name.toLowerCase();
  return Array.from(ACCEPTED_EXTENSIONS).some((ext) => lower.endsWith(ext));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function UploadStep({
  files,
  onFilesChange,
  prompt,
  defaultPrompt,
  onPromptChange,
  existingNamesText,
  onExistingNamesTextChange,
  isPromptLoading,
  isSubmitting,
  error,
  onSubmit,
}: UploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [chipDraft, setChipDraft] = useState("");
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);

  // Build object URLs for file thumbnails and revoke on change/unmount
  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  // Rotate grouping progress message while submitting
  useEffect(() => {
    if (!isSubmitting) {
      setLoadingStageIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setLoadingStageIndex((prev) => (prev === 0 ? 1 : 0));
    }, 2200);
    return () => clearInterval(timer);
  }, [isSubmitting]);

  const totalSize = useMemo(
    () => files.reduce((acc, file) => acc + file.size, 0),
    [files]
  );

  const nameChips = useMemo(
    () =>
      existingNamesText
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean),
    [existingNamesText]
  );

  const appendFiles = (incoming: FileList | File[]) => {
    const all = Array.from(incoming);
    const valid: File[] = [];
    const rejected: string[] = [];

    for (const file of all) {
      if (isSupportedImageFile(file)) {
        valid.push(file);
      } else {
        rejected.push(file.name);
      }
    }

    if (rejected.length > 0) {
      setRejectedMessage(
        `Skipped ${rejected.length} unsupported ${
          rejected.length === 1 ? "file" : "files"
        } (${rejected.slice(0, 3).join(", ")}${
          rejected.length > 3 ? ", ..." : ""
        }). Please upload JPG, PNG, or WebP images.`
      );
    } else {
      setRejectedMessage(null);
    }

    if (valid.length === 0) return;

    const existingKeys = new Set(
      files.map((f) => `${f.name}:${f.size}:${f.lastModified}`)
    );
    const deduped = valid.filter(
      (f) => !existingKeys.has(`${f.name}:${f.size}:${f.lastModified}`)
    );
    onFilesChange([...files, ...deduped]);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const updateChips = (nextChips: string[]) => {
    onExistingNamesTextChange(nextChips.join(", "));
  };

  const addChipFromDraft = (raw: string) => {
    const cleaned = raw.replace(/,/g, "").trim();
    if (!cleaned) return;
    const exists = nameChips.some(
      (c) => c.toLowerCase() === cleaned.toLowerCase()
    );
    if (!exists) {
      updateChips([...nameChips, cleaned]);
    }
    setChipDraft("");
  };

  const handleChipKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChipFromDraft(chipDraft);
    } else if (e.key === "Backspace" && !chipDraft && nameChips.length > 0) {
      e.preventDefault();
      updateChips(nameChips.slice(0, -1));
    }
  };

  const promptSummary = useMemo(() => {
    if (isPromptLoading) return "Loading default studio prompt...";
    const firstLine = prompt.split("\n")[0]?.trim() || "";
    return firstLine.length > 88 ? `${firstLine.slice(0, 88)}...` : firstLine;
  }, [prompt, isPromptLoading]);

  const isCustomPrompt = defaultPrompt
    ? prompt.trim() !== defaultPrompt.trim()
    : false;

  if (isSubmitting) {
    const stageText =
      loadingStageIndex === 0
        ? "Analysing photos..."
        : "Grouping similar pieces...";

    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <Loader2
              className="h-5 w-5 animate-spin text-emerald-700"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-semibold text-stone-900">
                {stageText}
              </h2>
              <p className="text-sm text-stone-600">
                Processing {files.length} workshop{" "}
                {files.length === 1 ? "photo" : "photos"} with Gemini Vision
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-200">
            Auto-grouping
          </span>
        </div>

        {/* Review grid skeleton to prevent layout shift */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[1, 2, 3, 4].map((skeletonIdx) => (
            <div
              key={skeletonIdx}
              className="animate-pulse rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="h-5 w-24 rounded-md bg-stone-200" />
                <div className="h-5 w-16 rounded-full bg-stone-100" />
              </div>
              <div className="aspect-[16/10] w-full rounded-xl bg-stone-200/80" />
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="aspect-square rounded-lg bg-stone-100" />
                <div className="aspect-square rounded-lg bg-stone-100" />
                <div className="aspect-square rounded-lg bg-stone-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Dropzone & Thumbnail Grid */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              Workshop Furniture Photos
            </h2>
            <p className="text-sm text-stone-600">
              Upload all angles of each piece. We&apos;ll group them for you.
            </p>
          </div>
          {files.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                {files.length} {files.length === 1 ? "photo" : "photos"} •{" "}
                {formatBytes(totalSize)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onFilesChange([]);
                  setRejectedMessage(null);
                }}
                className="text-stone-600 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Clear all
              </Button>
            </div>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) {
              appendFiles(e.dataTransfer.files);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload workshop furniture photos"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center ${
            isDragging
              ? "border-stone-900 bg-stone-100 ring-2 ring-stone-900/15"
              : "border-stone-300 bg-stone-50/70 hover:border-stone-400 hover:bg-stone-100/60"
          }`}
        >
          <UploadCloud
            className={`mb-3 h-9 w-9 ${
              isDragging ? "text-stone-900" : "text-stone-500"
            }`}
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-stone-800">
            Drag & drop workshop photos here, or click to browse
          </p>
          <p className="mt-1 text-xs text-stone-600">
            Supports JPG, PNG, and WebP • Multiple files allowed
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                appendFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </div>

        {rejectedMessage && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>{rejectedMessage}</span>
          </div>
        )}

        {/* Thumbnail grid */}
        {previews.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {previews.map((item, idx) => (
              <div
                key={`${item.file.name}-${item.file.size}-${idx}`}
                className="group relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
              >
                <div className="aspect-square w-full">
                  <img
                    src={item.url}
                    alt={item.file.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  aria-label={`Remove ${item.file.name}`}
                  title={`Remove ${item.file.name}`}
                  className="absolute top-1.5 right-1.5 rounded-full bg-stone-900/80 p-1 text-white shadow-xs hover:bg-red-700"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <div className="border-t border-stone-200 bg-white px-2 py-1">
                  <p
                    className="truncate text-[11px] font-medium text-stone-700"
                    title={item.file.name}
                  >
                    {item.file.name}
                  </p>
                  <p className="text-[10px] text-stone-500">
                    {formatBytes(item.file.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Collapsible Studio Style Prompt */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-stone-900">
                Studio style (applied to every image)
              </h2>
              {isCustomPrompt && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">
                  Edited
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-stone-600">
              {promptSummary}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isCustomPrompt && defaultPrompt && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPromptChange(defaultPrompt)}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset to default
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={isPromptExpanded}
              onClick={() => setIsPromptExpanded((prev) => !prev)}
            >
              {isPromptExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  Done
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit
                </>
              )}
            </Button>
          </div>
        </div>

        {isPromptExpanded && (
          <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
            <label
              htmlFor="studio-prompt"
              className="block text-xs font-medium text-stone-700"
            >
              Prompt template sent to Gemini Image Generation
            </label>
            <textarea
              id="studio-prompt"
              rows={7}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="Enter your studio photography prompt..."
              className="w-full rounded-xl border border-stone-300 bg-stone-50/50 p-3.5 text-sm leading-relaxed text-stone-800 focus:border-stone-800 focus:bg-white focus:outline-none"
            />
          </div>
        )}
      </section>

      {/* Existing Catalog Names (Chips Input) */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
        <label
          htmlFor="existing-names-input"
          className="block text-base font-semibold text-stone-900"
        >
          Existing Catalog Names (Avoid Duplicates)
        </label>
        <p className="mt-0.5 mb-3 text-xs text-stone-600">
          Press <kbd className="rounded border border-stone-300 bg-stone-100 px-1 py-0.5 text-[10px]">Enter</kbd> or <kbd className="rounded border border-stone-300 bg-stone-100 px-1 py-0.5 text-[10px]">,</kbd> to add a name chip. Press <kbd className="rounded border border-stone-300 bg-stone-100 px-1 py-0.5 text-[10px]">Backspace</kbd> to remove the last chip.
        </p>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-300 bg-stone-50/50 p-2.5 focus-within:border-stone-800 focus-within:bg-white">
          {nameChips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-800 shadow-2xs"
            >
              <span>{chip}</span>
              <button
                type="button"
                onClick={() =>
                  updateChips(nameChips.filter((c) => c !== chip))
                }
                aria-label={`Remove ${chip}`}
                className="rounded-full p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-900"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            id="existing-names-input"
            type="text"
            value={chipDraft}
            onChange={(e) => setChipDraft(e.target.value)}
            onKeyDown={handleChipKeyDown}
            onBlur={() => {
              if (chipDraft.trim()) addChipFromDraft(chipDraft);
            }}
            placeholder={
              nameChips.length === 0
                ? "Type an existing name and press Enter..."
                : "Add name..."
            }
            className="min-w-[140px] flex-1 bg-transparent px-1.5 py-1 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none"
          />
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {/* Sticky Bottom Action Bar */}
      <div className="sticky bottom-3 z-20 rounded-2xl border border-stone-200 bg-white/95 px-5 py-3.5 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-stone-700">
            {files.length > 0 ? (
              <span>
                <strong className="font-semibold text-stone-900">
                  {files.length} {files.length === 1 ? "photo" : "photos"}
                </strong>{" "}
                ready ({formatBytes(totalSize)})
              </span>
            ) : (
              <span className="text-stone-500">
                Add at least one workshop photo to continue
              </span>
            )}
          </div>

          <span
            title={
              files.length === 0
                ? "Add at least one workshop photo to enable auto-grouping"
                : !prompt.trim()
                  ? "Studio style prompt cannot be empty"
                  : undefined
            }
          >
            <Button
              variant="primary"
              size="lg"
              disabled={files.length === 0 || isSubmitting || !prompt.trim()}
              onClick={onSubmit}
              className="w-full sm:w-auto"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Upload & Auto-Group Photos
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
