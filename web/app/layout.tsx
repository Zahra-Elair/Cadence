import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://cadencecalendar.vercel.app";
const DESCRIPTION =
  "Cadence is an AI assistant for Google Calendar: create, move, and delete events in plain language — or straight from a photo of a schedule — with a confirmation step before anything changes.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Cadence — AI calendar assistant",
    template: "%s · Cadence",
  },
  description: DESCRIPTION,
  applicationName: "Cadence",
  keywords: [
    "Cadence",
    "AI calendar",
    "calendar assistant",
    "Google Calendar",
    "AI scheduling",
    "natural language calendar",
    "schedule from a photo",
  ],
  authors: [{ name: "Zahra Elair" }],
  creator: "Zahra Elair",
  category: "productivity",
  openGraph: {
    type: "website",
    siteName: "Cadence",
    url: SITE_URL,
    title: "Cadence — AI calendar assistant",
    description:
      "Manage your Google Calendar by chatting — or from a photo of a schedule. Every change is confirmed first.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cadence — AI calendar assistant",
    description: "Manage your Google Calendar by chatting — or from a photo of a schedule.",
  },
  robots: { index: true, follow: true },
};

// Machine-readable identity for search engines and AI crawlers.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Cadence",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Zahra Elair" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
