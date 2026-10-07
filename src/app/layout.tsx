import type { Metadata, Viewport } from "next";
import { Saira_Condensed } from "next/font/google";
import { AppProvider } from "@/components/providers/app-provider";
import { ServiceWorker } from "@/components/providers/service-worker";
import { SideRail, TabBar } from "@/components/shell/nav";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// Text uses the platform UI font (SF on Apple devices) for legibility at every size.
// Saira Condensed is reserved for numbers and the day-type hero, where the brand lives.
const saira = Saira_Condensed({
  variable: "--font-saira",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Alfred", template: "%s · Alfred" },
  description: "A personal training, nutrition and recovery log. Offline-first, built for one-handed use in the gym.",
  applicationName: "Alfred",
  appleWebApp: { capable: true, title: "Alfred", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#07090c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${saira.variable} antialiased`}>
      <body>
        <ToastProvider>
          <AppProvider>
            <div className="flex min-h-dvh">
              <SideRail />
              {children}
            </div>
            <TabBar />
          </AppProvider>
        </ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
