"use client";

import { Check } from "lucide-react";
import { WizardStep } from "@/lib/types";

interface StepperProps {
  currentStep: WizardStep;
}

const STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "1. Upload" },
  { step: 2, label: "2. Review Groups" },
  { step: 3, label: "3. Export ZIP" },
];

export function Stepper({ currentStep }: StepperProps) {
  return (
    <nav aria-label="Workflow progress" className="flex items-center gap-2 sm:gap-4">
      {STEPS.map((item, index) => {
        const isCompleted = currentStep > item.step;
        const isActive = currentStep === item.step;

        return (
          <div key={item.step} className="flex items-center gap-2 sm:gap-4">
            <div
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                isActive
                  ? "bg-stone-900 text-stone-50 shadow-sm"
                  : isCompleted
                    ? "bg-stone-200 text-stone-800"
                    : "bg-stone-100 text-stone-400 border border-stone-200"
              }`}
            >
              {isCompleted && <Check className="h-3.5 w-3.5 text-stone-700" />}
              <span>{item.label}</span>
            </div>
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
