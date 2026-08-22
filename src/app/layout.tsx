import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Insurance Helper',
  description: 'Insurance Helper — agency management for motor and non-motor portfolios.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
