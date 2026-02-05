import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { I18nProvider } from "@/components/i18n-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "rehab delevery",
  description: "Created with v0",
  generator: "rehab dev team",
  icons: {
    icon: [
      {
        url: "/rehab.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/rehab.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/rehab.png",
        type: "image/svg+xml",
      },
    ],
    apple: "/rehab.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <I18nProvider>
            {children}
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
