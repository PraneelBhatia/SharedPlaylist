import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "SharedPlaylist",
  description: "Cross-service playlist sync for two people.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
