import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import { LayoutClient } from "@/components/layout-client";
import { UI_ENGINE_CANVAS_CLASS } from "@/ui_engine/tokens";
import { UISettingsInjector } from "@/ui_engine/components/UISettingsInjector";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter-base",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora-base",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudioFlow",
  description: "RAD SAAS workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${lora.variable} h-screen overflow-hidden antialiased`}
      suppressHydrationWarning
    >
      <head>
        <UISettingsInjector />
      </head>
      <body
        suppressHydrationWarning
        className={`h-screen overflow-hidden ${UI_ENGINE_CANVAS_CLASS} font-sans text-slate-900 antialiased`}
      >
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
