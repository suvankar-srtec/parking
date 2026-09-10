"use client";

import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";
import { requestJson } from "@/lib/client-request";

export default function SignOutButton({ className = "logout-button" }: { className?: string }) {
  const { notify, navigate } = useFeedback();
  const { pending, execute } = useMutation();
  return <ActionButton type="button" className={className} pending={pending} pendingText="Signing out…" onClick={() => execute(async () => {
    await requestJson("/api/logout", "POST");
    notify("You have been signed out.");
    navigate("/", true);
  })}>Sign out</ActionButton>;
}
