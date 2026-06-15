import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GiftZone Dashboard",
  description: "Quản lý GiftZone AI Agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full">
      <body className={`${geist.className} bg-gray-50 text-gray-900 min-h-full`}>
        {children}
      </body>
    </html>
  );
}
