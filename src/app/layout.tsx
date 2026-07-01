import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk, Inter } from "next/font/google";

import { NoPinchZoom } from "@/components/no-pinch-zoom";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const familjen = Familjen_Grotesk({
  subsets: ["latin"],
  variable: "--font-familjen",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bzor Invoice",
  description: "Invoicing for client projects",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${familjen.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NoPinchZoom />
        {children}
      </body>
    </html>
  );
}
