import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'COLAB — prototipo interactivo',
  description: 'Prototipo del flujo de artistas de COLAB.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
