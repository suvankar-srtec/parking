import type { ButtonHTMLAttributes } from "react";

export function Spinner() {
  return <span className="loading-spinner" aria-hidden="true" />;
}

export function ActionButton({ pending, pendingText, children, disabled, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { pending: boolean; pendingText: string }) {
  return <button {...props} disabled={disabled || pending} aria-busy={pending}>
    {pending && <Spinner />}{pending ? pendingText : children}
  </button>;
}

export default function LoadingIndicator({ label = "Loading your workspace…" }: { label?: string }) {
  return <div className="loading-panel" role="status" aria-live="polite"><Spinner /><p>{label}</p></div>;
}
