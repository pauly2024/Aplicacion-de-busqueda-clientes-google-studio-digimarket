import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Radar de Clientes | DigiMarket RD',
  description:
    'Aplicación de prospección inteligente B2B y auditoría de presencia digital para negocios locales con Google Places, PageSpeed, NVIDIA NIM y Nemotron 3 Ultra.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#070b14] text-slate-100 font-sans selection:bg-orange-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
