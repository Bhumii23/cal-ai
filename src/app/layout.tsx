import type { Metadata, Viewport } from "next";
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
  manifest: "/manifest.webmanifest",
  applicationName: "Cal AI",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cal AI",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Set theme before paint: stored choice wins, else system preference.
            Plain <script> (not next/script) so it always runs synchronously
            before first paint, avoiding a dark->light flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('calAi_theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}var r=document.documentElement;r.classList.toggle('light',t==='light');r.classList.toggle('dark',t!=='light');r.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
