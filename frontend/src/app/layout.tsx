import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinTrader — AI Trading Workstation",
  description: "AI-powered simulated trading terminal",
};

const themeScript = `
  try {
    var t = localStorage.getItem('fintrader-theme');
    if (t === 'dark' || (t === null)) document.documentElement.classList.add('dark');
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
