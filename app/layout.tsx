import type { Metadata } from "next";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { WalletContext } from "./providers";

export const metadata: Metadata = {
  title: "DREADTIDE | Naval strategy on Solana",
  description: "Commit your fleet. Prove every shot. Win on Solana Devnet.",
  icons: { icon: "/logomark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <WalletContext>{children}</WalletContext>
      </body>
    </html>
  );
}
