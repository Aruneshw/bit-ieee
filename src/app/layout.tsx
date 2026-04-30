import type { Metadata } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeInitScript } from "@/components/theme-init-script";
import { ThemeToggle } from "@/components/theme-toggle";
import { SessionProfileProvider } from "@/components/session-profile-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BIT IEEE Hub Portal",
  description: "Official IEEE Society Hub for Bannari Amman Institute of Technology — Manage societies, track activity points, build resumes, and engage in events.",
  keywords: ["IEEE", "BITS Sathy", "Bannari Amman", "Society Hub", "Activity Points"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bebasNeue.variable} h-full antialiased`}
    >
      <head>
        <ThemeInitScript />
      </head>
      <body className="min-h-full flex flex-col font-body">
        <div className="fixed bottom-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <SessionProfileProvider>{children}</SessionProfileProvider>
        <Toaster
          position="top-right"
          richColors
          theme="system"
        />
      </body>
    </html>
  );
}
