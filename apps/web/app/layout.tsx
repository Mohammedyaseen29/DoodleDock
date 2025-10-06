import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { SignInDialog } from "@/components/modals/SignIn";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Doodle Dock",
  description: "Real-time collaborative drawing application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider>
          {children}
          <SignInDialog/>
        </AuthProvider>
      </body>
    </html>
  );
}
