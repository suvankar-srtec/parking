"use client";

import { useEffect, useRef } from "react";
import { useFeedback } from "@/components/FeedbackProvider";
import AppLink from "@/components/AppLink";

export default function NotFound() {
  const { notify } = useFeedback();
  const shown = useRef(false);
  useEffect(() => {
    if (!shown.current) { shown.current = true; notify("The requested page was not found.", "error"); }
  }, [notify]);
  return <main className="page-error"><section><h1>Page not found</h1><p>The page may have moved or is no longer available.</p><AppLink href="/dashboard" className="primary-button link-button">Back to dashboard</AppLink></section></main>;
}
