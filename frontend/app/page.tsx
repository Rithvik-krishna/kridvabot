"use client";

import { useEffect, useState } from "react";
import { Armchair } from "lucide-react";
import { ExportStep } from "@/components/ExportStep";
import { ReviewStep } from "@/components/ReviewStep";
import { Stepper } from "@/components/Stepper";
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

  useEffect(() => {
    let active = true;
    fetchDefaultPrompt()
      .then((defaultPrompt) => {
        if (active) setPrompt(defaultPrompt);
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
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload and group photos."
      );
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
      setGenerateError(
        err instanceof Error ? err.message : "Failed to start catalog generation."
      );
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
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-xs">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-stone-50">
              <Armchair className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-stone-900">
                Furniture Catalog Bot
              </h1>
              <p className="text-xs text-stone-500">
                Workshop Photos → 1:1 Studio Perspectives → Catalog ZIP
              </p>
            </div>
          </div>

          <Stepper currentStep={step} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {step === 1 && (
          <UploadStep
            files={files}
            onFilesChange={setFiles}
            prompt={prompt}
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
          />
        )}

        {step === 3 && jobId && (
          <ExportStep
            jobId={jobId}
            attempt={generationAttempt}
            onRetry={handleGenerate}
            onStartNewBatch={handleReset}
          />
        )}
      </main>
    </div>
  );
}
