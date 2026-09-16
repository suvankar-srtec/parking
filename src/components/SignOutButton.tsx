"use client";

import { useState, type FormEvent } from "react";
import { ActionButton } from "./LoadingIndicator";

export default function SignOutButton({ className = "logout-button" }: { className?: string }) {
  const [pending, setPending] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    setPending(true);
  }

  return (
    <form action="/api/logout" method="post" onSubmit={submit}>
      <ActionButton
        type="submit"
        className={className}
        pending={pending}
        pendingText="Signing out…"
      >
        Sign out
      </ActionButton>
    </form>
  );
}
