import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SHASHA-AI — Creator Studio',
  description: 'Generate images, video, voice, music and content from a single creative workspace.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ink-900 text-white min-h-screen">{children}</body>
    </html>
  );
}
