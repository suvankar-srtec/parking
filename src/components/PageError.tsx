"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFeedback } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";
import AppLink from "./AppLink";

export default function PageError({ error, reset }: { error: Error; reset: () => void }) {
  const { notify } = useFeedback();
  const router = useRouter();
  const shown = useRef<Error | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (shown.current !== error) {
      shown.current = error;
      notify("This page could not be loaded. Please try again.", "error");
    }
  }, [error, notify]);
  return <main className="page-error"><section>
    <h1>Unable to load this page</h1><p>Please try again in a moment.</p>
    <div className="detail-actions">
      <ActionButton className="primary-button" pending={pending} pendingText="Retrying…" onClick={() => startTransition(() => { router.refresh(); reset(); })}>Try again</ActionButton>
      <AppLink className="secondary-button link-button" href="/dashboard">Back to dashboard</AppLink>
    </div>
  </section></main>;
}
