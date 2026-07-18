import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI定期調査システム",
  description: "まつさか農園の柑橘定期調査入力・分析システム",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
