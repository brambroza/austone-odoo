import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Inter, Inter_Tight, Noto_Sans_Thai } from 'next/font/google';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/app-shell';
import { Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { FlashListener } from '@/components/flash-listener';
import { SITE, siteUrl } from '@/lib/seo';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight', display: 'swap' });
const notoThai = Noto_Sans_Thai({ subsets: ['thai', 'latin'], variable: '--font-noto-thai', display: 'swap' }); // variable font (100–900); listing weights makes Google return /l/font?kit= URLs that break the Turbopack build

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE.name, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1319' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={cn('font-sans', inter.variable, interTight.variable, notoThai.variable)}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground">ข้ามไปเนื้อหาหลัก</a>
        <AppShell>{children}</AppShell>
        <Toaster position="top-right" />
        <Suspense><FlashListener /></Suspense>
      </body>
    </html>
  );
}
