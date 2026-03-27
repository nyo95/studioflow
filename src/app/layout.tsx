import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import { LayoutClient } from "@/components/layout-client";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
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
      <body
        suppressHydrationWarning
        className="h-screen overflow-hidden bg-white font-sans text-slate-900 antialiased"
      >
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
