import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import './globals.css';

/**
 * The administration surface deliberately advertises itself as private: it must
 * never be indexed, and it must never be cached as public content.
 */
export const metadata: Metadata = {
  title: {
    default: 'Admin | me.palnadu.dev',
    template: '%s | Admin',
  },
  robots: {index: false, follow: false, nocache: true},
};

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-subtle text-text-primary antialiased">
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
