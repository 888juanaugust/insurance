import type { Metadata } from 'next';
import './globals.css';
import { THEME_SCRIPT } from '@/components/UserMenu';

export const metadata: Metadata = {
  title: 'Insurhelp',
  description: 'Insurhelp — policy, collection and commission management for insurance agencies.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Loaded by the browser rather than fetched at build time, so a box
            with no route to Google Fonts still builds — and still renders, on
            the fallback stack. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Settles light or dark before the first paint. Without it a person
            who chose dark gets a white flash on every navigation while React
            mounts and reads the stored choice. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
