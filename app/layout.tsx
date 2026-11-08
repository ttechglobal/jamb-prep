import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { InstalledWelcome } from "@/components/pwa/installed-welcome";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { Toaster } from "@/components/ui/sonner";
import { AppStateProvider } from "@/lib/app-state";
import "./globals.css";

// Fonts live in app/fonts and ship with the app. They used to be fetched from Google at start-up,
// and when the machine was offline the app silently fell back to a plain system font.
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans.woff2",
  weight: "200 800",
  variable: "--font-sans",
  display: "swap",
});

const fredoka = localFont({
  src: "./fonts/Fredoka.woff2",
  weight: "300 700",
  variable: "--font-display",
  display: "swap",
});

/** Reading text (passages, poems, extracts) gets its own book-style face, apart from the app's UI font. */
const literata = localFont({
  src: [
    { path: "./fonts/Literata.woff2", weight: "200 900", style: "normal" },
    { path: "./fonts/Literata-Italic.woff2", weight: "200 900", style: "italic" },
  ],
  variable: "--font-reading",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "JAMB Prep — Practice Smarter. Prepare Better.",
    template: "%s · JAMB Prep",
  },
  description:
    "Free JAMB UTME practice questions. Quick Five, subject practice, timed drills and full CBT mock exams.",
  applicationName: "JAMB Prep",
  appleWebApp: { capable: true, title: "JAMB Prep", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#14532D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${fredoka.variable} ${literata.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AppStateProvider>
          <PwaProvider>
            {children}
            <InstalledWelcome />
          </PwaProvider>
        </AppStateProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
