import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PageTransition } from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "FeedbackFlow AI",
  description:
    "Automated ingestion, LLM analysis, and triage of public customer feedback.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <Providers>
            <PageTransition>{children}</PageTransition>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
