import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

/**
 * Canonical origin is configuration, never a literal, so a preview deployment
 * emits correct metadata without editing source (DEPLOYMENT_MAP.md section 3).
 * Both variables are public by definition (SECURITY.md section 3).
 */
const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'me.palnadu.dev',
    template: '%s | me.palnadu.dev',
  },
  description:
    'Portfolio, career timeline, projects, resume, and a technical Knowledge Hub on endpoint management, MDM, and security.',
  openGraph: {
    type: 'website',
    siteName: 'me.palnadu.dev',
    url: siteUrl,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-text-primary antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-dialog focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-body-sm focus:shadow-md"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}