"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, UploadCloud, X } from "lucide-react";

interface UploadStepProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  existingNamesText: string;
  onExistingNamesTextChange: (text: string) => void;
  isPromptLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: () => void;
}

export function UploadStep({
  files,
  onFilesChange,
  prompt,
  onPromptChange,
  existingNamesText,
  onExistingNamesTextChange,
  isPromptLoading,
  isSubmitting,
  error,
  onSubmit,
}: UploadStepProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const appendFiles = (incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter((file) =>
      file.type.startsWith("image/")
    );
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

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              Workshop Furniture Photos
            </h2>
            <p className="text-sm text-stone-500">
              Upload a bulk batch of raw workshop photos (any number of angles per
              piece). Gemini Vision will automatically sort and cluster them.
            </p>
          </div>
          {files.length > 0 && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
              {files.length} {files.length === 1 ? "photo" : "photos"} selected
            </span>
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
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            isDragging
              ? "border-stone-800 bg-stone-100"
              : "border-stone-300 bg-stone-50/70 hover:border-stone-400 hover:bg-stone-100/60"
          }`}
        >
          <UploadCloud className="mb-3 h-9 w-9 text-stone-500" />
          <p className="text-sm font-medium text-stone-800">
            Drag & drop workshop photos here, or click to browse
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Supports JPG, PNG, and WebP • Multiple files allowed
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                appendFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </div>

        {/* Removable preview chips */}
        {files.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${file.size}-${idx}`}
                className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-700"
              >
                <ImagePlus className="h-3.5 w-3.5 text-stone-400" />
                <span className="max-w-[180px] truncate font-medium">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  aria-label={`Remove ${file.name}`}
                  className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Studio Style Prompt */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <label
              htmlFor="studio-prompt"
              className="text-lg font-semibold text-stone-900"
            >
              Studio Style Prompt
            </label>
            <p className="text-sm text-stone-500">
              Applied consistently across every Front & Side studio image in this
              batch.
            </p>
          </div>
          {isPromptLoading && (
            <span className="flex items-center gap-1.5 text-xs text-stone-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading default...
            </span>
          )}
        </div>
        <textarea
          id="studio-prompt"
          rows={7}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Enter your studio photography prompt..."
          className="w-full rounded-xl border border-stone-300 bg-stone-50/50 p-3.5 text-sm leading-relaxed text-stone-800 focus:border-stone-800 focus:bg-white focus:outline-none"
        />
      </section>

      {/* Existing Catalog Names */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
        <label
          htmlFor="existing-names"
          className="block text-lg font-semibold text-stone-900"
        >
          Existing Catalog Names (Avoid Duplicates)
        </label>
        <p className="mt-0.5 mb-3 text-sm text-stone-500">
          Comma-separated artisan names already in your catalog so new
          suggestions stay 100% unique.
        </p>
        <input
          id="existing-names"
          type="text"
          value={existingNamesText}
          onChange={(e) => onExistingNamesTextChange(e.target.value)}
          className="w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-800 focus:border-stone-800 focus:bg-white focus:outline-none"
        />
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={files.length === 0 || isSubmitting || !prompt.trim()}
          onClick={onSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3 text-sm font-medium text-stone-50 shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading & Auto-Grouping...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Upload & Auto-Group Photos
            </>
          )}
        </button>
      </div>
    </div>
  );
}
