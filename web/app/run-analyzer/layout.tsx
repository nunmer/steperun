import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Running Coach",
  description: "Upload your running video for AI-powered biomechanics analysis",
};

export default function RunAnalyzerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
