import { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  loading?: boolean;
};

export function Button({ variant = "primary", loading, className, children, ...rest }: Props) {
  const base = "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition active:scale-[0.98]";
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-600 shadow-sm",
    ghost: "bg-white border border-stroke-soft text-text-primary hover:bg-bg-surface",
    danger: "bg-danger-500 text-white hover:brightness-95"
  }[variant];

  return (
    <button className={clsx(base, styles, className)} disabled={loading || rest.disabled} {...rest}>
      {loading ? "..." : children}
    </button>
  );
}
