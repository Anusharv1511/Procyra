import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Procyra — the repeatable 80% of IE, PE & QE work, automated",
  description:
    "Control charts, capability, OEE, Pareto, CAPA, FMEA, and time studies with automatic monitoring — so engineers spend time on judgment calls, not spreadsheets.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Procyra" },
};

export const viewport: Viewport = {
  themeColor: "#22262b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(()=>{})); }`,
          }}
        />
      </body>
    </html>
  );
}
