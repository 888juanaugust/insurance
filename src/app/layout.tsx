import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Insurhelp',
  description: 'Insurhelp — policy, collection and commission management for insurance agencies.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
