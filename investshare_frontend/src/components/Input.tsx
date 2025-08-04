import { InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        "h-10 w-full rounded-md border border-stroke-soft px-3 text-sm outline-none",
        "focus:border-brand focus:ring-2 focus:ring-brand/30",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
