import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "../components/navbar";
import { AuthProvider } from "../contexts/AuthContext";
import { IOSPointerProvider } from "../contexts/IOSPointerContext";
import IOSPointer from "../components/IOSPointer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Masterwork - Community Oriented Fight Club",
  description: "5v5 Queue System for League of Legends teams and individual players. Track champion picks, team compositions, and compete in organized battles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="masterwork">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <AuthProvider>
          <IOSPointerProvider>
            <IOSPointer />
            <Navbar />
            <main className="flex-grow">
              {children}
            </main>
          </IOSPointerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
