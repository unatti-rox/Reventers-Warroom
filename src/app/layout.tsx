import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Insomniacs Kitchen",
  description: "Cohort Leader → Brand → IP CS → IP → Designer → Editor → Output",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
