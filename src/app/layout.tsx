import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Epic Channel Insights",
  description: "YouTube Analytics Dashboard — Managed by Revelation Inc. AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-roboto antialiased">{children}</body>
    </html>
  );
}
