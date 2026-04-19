import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import { Cormorant_Garamond, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "@/components/providers";
import { APP_URL, CONFIG } from "@/lib/config";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "ShadowFund — Confidential DeFi Vaults",
    template: "%s | ShadowFund",
  },
  description:
    "Confidential vault protocol. Managers publish their strategies openly. Depositor balances stay encrypted end-to-end via iExec Nox.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "ShadowFund",
    title: "ShadowFund — Confidential DeFi Vaults",
    description:
      "Confidential vault protocol. Managers publish their strategies openly. Depositor balances stay encrypted end-to-end via iExec Nox.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 675,
        alt: "ShadowFund",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ShadowFund — Confidential DeFi Vaults",
    description:
      "Confidential vault protocol. Managers publish their strategies openly. Depositor balances stay encrypted end-to-end via iExec Nox.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieString = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${cormorant.variable} ${instrument.variable} ${jetbrains.variable}`}
    >
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${CONFIG.gtm.id}');`,
        }}
      />
      <body className="flex min-h-screen flex-col antialiased">
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${CONFIG.gtm.id}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <Providers cookies={cookieString}>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
