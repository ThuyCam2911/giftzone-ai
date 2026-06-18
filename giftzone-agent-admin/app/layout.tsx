import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "GiftZone Dashboard",
  description: "Quản lý GiftZone AI Agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full">
      <body className={`${manrope.variable} font-manrope bg-gray-50 text-gray-900 min-h-full`}>
        {children}
      </body>
    </html>
  );
}
