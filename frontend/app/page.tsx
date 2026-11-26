"use client";

import { useCallback, useEffect, useState } from "react";
import { Armchair } from "lucide-react";
import { ExportStep } from "@/components/ExportStep";
import { ReviewStep } from "@/components/ReviewStep";
import { Stepper } from "@/components/Stepper";
import { ToastContainer, ToastItem, ToastTone } from "@/components/ui/Toast";
import { UploadStep } from "@/components/UploadStep";
import {
  fetchDefaultPrompt,
  startCatalogGeneration,
  uploadAndGroupPhotos,
} from "@/lib/api";
import { PhotoGroup, UploadedImage, WizardStep } from "@/lib/types";

const DEFAULT_EXISTING_NAMES =
  "Ruma, Taj, Hamsa, Katira, Lebu, Shola, Nora, Katha, Cove, Hiroshima, Vaya, Noor, Kaya, Sitara, Rama";

export default function HomePage() {
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1 state
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState<string>("");
  const [defaultPrompt, setDefaultPrompt] = useState<string>("");
  const [existingNamesText, setExistingNamesText] = useState<string>(
    DEFAULT_EXISTING_NAMES
  );
  const [isPromptLoading, setIsPromptLoading] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Step 2 state
  const [jobId, setJobId] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [isStartingGeneration, setIsStartingGeneration] =
    useState<boolean>(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generationAttempt, setGenerationAttempt] = useState<number>(0);

  // Global toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (opts: {
      message: string;
      tone: ToastTone;
      actionLabel?: string;
      onAction?: () => void;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, ...opts }]);
      setTimeout(() => {
        dismissToast(id);
      }, 4500);
    },
    [dismissToast]
  );

  useEffect(() => {
    let active = true;
    fetchDefaultPrompt()
      .then((loadedPrompt) => {
        if (active) {
          setPrompt(loadedPrompt);
          setDefaultPrompt(loadedPrompt);
        }
      })
      .catch((err) => {
        if (active) {
          setUploadError(
            err instanceof Error
              ? `Could not load default prompt from backend: ${err.message}`
              : "Could not load default prompt from backend."
          );
        }
      })
      .finally(() => {
        if (active) setIsPromptLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleUploadAndGroup = async () => {
    setUploadError(null);
    setIsUploading(true);
    try {
      const data = await uploadAndGroupPhotos(files);
      setJobId(data.job_id);
      setImages(data.images);
      setGroups(data.groups);
      setStep(2);
      notify({
        message: `${data.groups.length} ${
          data.groups.length === 1 ? "piece" : "pieces"
        } detected`,
        tone: "success",
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to upload and group photos.";
      setUploadError(msg);
      notify({ message: msg, tone: "error" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!jobId) return;
    setGenerateError(null);
    setIsStartingGeneration(true);
    try {
      const existingNames = existingNamesText
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);

      await startCatalogGeneration(jobId, groups, prompt, existingNames);
      setGenerationAttempt((prev) => prev + 1);
      setStep(3);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to start catalog generation.";
      setGenerateError(msg);
      notify({ message: msg, tone: "error" });
    } finally {
      setIsStartingGeneration(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setJobId(null);
    setImages([]);
    setGroups([]);
    setUploadError(null);
    setGenerateError(null);
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur-xs">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-stone-50 shadow-xs">
              <Armchair className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-stone-900">
                Furniture Catalog Bot
              </h1>
              <p className="text-xs text-stone-600">
                Workshop Photos → 1:1 Studio Perspectives → Catalog ZIP
              </p>
            </div>
          </div>

          <Stepper
            currentStep={step}
            onNavigateBack={(target) => {
              if (step === 2 && target === 1) {
                setStep(1);
              }
            }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {step === 1 && (
          <UploadStep
            files={files}
            onFilesChange={setFiles}
            prompt={prompt}
            defaultPrompt={defaultPrompt}
            onPromptChange={setPrompt}
            existingNamesText={existingNamesText}
            onExistingNamesTextChange={setExistingNamesText}
            isPromptLoading={isPromptLoading}
            isSubmitting={isUploading}
            error={uploadError}
            onSubmit={handleUploadAndGroup}
          />
        )}

        {step === 2 && (
          <ReviewStep
            images={images}
            groups={groups}
            onGroupsChange={setGroups}
            onBack={() => setStep(1)}
            onGenerate={handleGenerate}
            isStarting={isStartingGeneration}
            error={generateError}
            onNotify={notify}
          />
        )}

        {step === 3 && jobId && (
          <ExportStep
            jobId={jobId}
            pieceCount={groups.length}
            attempt={generationAttempt}
            onRetry={handleGenerate}
            onStartNewBatch={handleReset}
            onNotify={notify}
          />
        )}
      </main>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
