import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import BottomNav from "@/components/BottomNav";
import DesktopSidebar from "@/components/DesktopSidebar";
import ThemeToggle, { ThemeProvider } from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Cal AI — Snap. Analyze. Track.",
  description: "AI-powered nutrition tracking. Login first, then track your daily dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Set theme before paint: stored choice wins, else system preference. */}
        <Script
          id="calai-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('calAi_theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.classList.toggle('light',t==='light');document.documentElement.classList.toggle('dark',t!=='light');}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          {children}
          <DesktopSidebar />
          <BottomNav />
          <ThemeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}
