import type { Metadata } from "next";
import FeedbackProvider from "@/components/FeedbackProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ParkControl",
  description: "Multi-building parking allocation and access control",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body suppressHydrationWarning><FeedbackProvider>{children}</FeedbackProvider></body></html>;
}
