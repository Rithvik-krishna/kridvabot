"use client";

import { Check } from "lucide-react";
import { WizardStep } from "@/lib/types";

interface StepperProps {
  currentStep: WizardStep;
  onNavigateBack?: (targetStep: WizardStep) => void;
}

const STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "1. Upload" },
  { step: 2, label: "2. Review Groups" },
  { step: 3, label: "3. Export ZIP" },
];

export function Stepper({ currentStep, onNavigateBack }: StepperProps) {
  return (
    <nav aria-label="Workflow progress" className="flex flex-wrap items-center gap-2 sm:gap-3">
      {STEPS.map((item, index) => {
        const isCompleted = currentStep > item.step;
        const isActive = currentStep === item.step;
        // Back navigation is only allowed from Step 2 -> Step 1 (matching Back button logic)
        const canClickBack =
          currentStep === 2 && item.step === 1 && Boolean(onNavigateBack);

        const baseClasses = `flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-medium ${
          isActive
            ? "bg-stone-900 text-stone-50 shadow-xs"
            : isCompleted
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-stone-100 text-stone-500 border border-stone-200"
        }`;

        return (
          <div key={item.step} className="flex items-center gap-2 sm:gap-3">
            {canClickBack ? (
              <button
                type="button"
                onClick={() => onNavigateBack?.(item.step)}
                title="Go back to Upload"
                className={`${baseClasses} cursor-pointer hover:bg-emerald-100`}
              >
                <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ) : (
              <span
                aria-current={isActive ? "step" : undefined}
                className={`${baseClasses} select-none`}
              >
                {isCompleted && (
                  <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                )}
                <span>{item.label}</span>
              </span>
            )}
            {index < STEPS.length - 1 && (
              <span className="text-stone-300 select-none" aria-hidden="true">
                →
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
