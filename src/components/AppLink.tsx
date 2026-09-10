"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useFeedback } from "./FeedbackProvider";

export default function AppLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const { navigate } = useFeedback();
  return <Link href={href} className={className} onClick={(event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }}>{children}</Link>;
}
