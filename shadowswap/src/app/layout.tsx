import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StarknetProvider } from "@/components/StarknetProvider";
import { WalletProvider } from "@/context/WalletContext";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShadowSwap — Confidential DeFi on Starknet",
  description:
    "Trade tokens without revealing your amounts. Privacy-preserving DEX powered by Tongo encryption on Starknet.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <StarknetProvider>
          <WalletProvider>
            <Navbar />
            <main className="pt-16 min-h-screen">{children}</main>
          </WalletProvider>
        </StarknetProvider>
      </body>
    </html>
  );
}
