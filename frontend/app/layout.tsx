import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Furniture Catalog Bot",
  description:
    "Auto-group workshop furniture photos, generate 1:1 studio perspectives, and export a ready-to-upload catalog Excel & image bundle.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
