"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-stone-900 text-stone-50 shadow-xs hover:bg-stone-800 active:scale-[0.99] disabled:bg-stone-300 disabled:text-stone-500",
  secondary:
    "border border-stone-300 bg-white text-stone-800 shadow-xs hover:bg-stone-100 active:scale-[0.99] disabled:border-stone-200 disabled:text-stone-400",
  ghost:
    "bg-transparent text-stone-700 hover:bg-stone-100 hover:text-stone-900 active:bg-stone-200/70 disabled:text-stone-400",
  destructive:
    "bg-red-700 text-white shadow-xs hover:bg-red-800 active:scale-[0.99] disabled:bg-red-200 disabled:text-red-400",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-sm rounded-xl gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      loadingText,
      disabled,
      className = "",
      children,
      type = "button",
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center font-medium select-none disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        <span>{isLoading && loadingText ? loadingText : children}</span>
      </button>
    );
  }
);
