import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EconomistDock from "@/components/EconomistDock";
import AuthGate from "@/components/AuthGate";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://lpiu.gov.lb"),
  title: "Lebanon Prices Intelligence Unit — Ministry of Economy & Trade",
  description:
    "Strategic price-intelligence portal for the Office of the Minister of Economy & Trade: Lebanon's non-core daily CPI, retail & wholesale analytics, and an AI advisor.",
  keywords: ["Lebanon", "Ministry of Economy and Trade", "CPI", "inflation", "price intelligence", "strategic", "LBP", "USD"],
  openGraph: {
    title: "Lebanon Prices Intelligence Unit",
    description: "Prepared for the Office of the Minister of Economy & Trade, Lebanon.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <AuthGate>
          <Navbar />
          <main className="flex-1 flex flex-col min-h-0">{children}</main>
          <Footer />
          <EconomistDock />
        </AuthGate>
      </body>
    </html>
  );
}
