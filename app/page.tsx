"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { GameConsole } from "./game-console";

const PROGRAM = "BNFQudgxvwLNZNhj1aSTVXqzXpBn68jifArJ5xRCGUE4";
const MATCH = "4pkJGNKMSVBzw6EVqJake9PhaiYQwg2A9tnt9qP45zHVDJvtmJ5ZurH5fsWHtPZfiGretNa8crres2mbHVkqDqaD";

const cells = Array.from({ length: 64 }, (_, index) => index);

export default function Home() {
  const { connected, publicKey } = useWallet();

  return (
    <main>
      <nav className="nav-shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="DREADTIDE home">
          <img src="/dreadtide-logo.png" alt="DREADTIDE" />
        </a>
        <div className="network"><i /> SOLANA DEVNET</div>
        <WalletMultiButton className="wallet-button" />
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">VERIFIABLE NAVAL WARFARE</p>
          <h1>Command the unseen.</h1>
          <p className="lede">Deploy a hidden fleet, challenge a rival, and settle victory on Solana.</p>
          <div className="hero-actions">
            <WalletMultiButton className="primary-action" />
            <a className="secondary-action" href={`https://explorer.solana.com/address/${PROGRAM}?cluster=devnet`} target="_blank" rel="noreferrer">
              Inspect program
            </a>
          </div>
        </div>

        <div className="sonar-stage" aria-label="Eight by eight naval grid preview">
          <div className="sweep" />
          <div className="coordinates top">A B C D E F G H</div>
          <div className="coordinates side">1<br />2<br />3<br />4<br />5<br />6<br />7<br />8</div>
          <div className="grid-board">
            {cells.map((cell) => <span key={cell} className={[10, 18, 26, 27, 28, 44, 45, 46, 52, 53, 54, 55].includes(cell) ? "occupied" : ""} />)}
          </div>
          <p className="grid-caption">COMMITTED FLEET // ROOT LOCKED</p>
        </div>
      </section>

      <section className="mission-panel" aria-labelledby="mission-title">
        <div>
          <h2 id="mission-title">{connected ? "Wallet online. Ready for orders." : "Connect a Devnet wallet to enter."}</h2>
          <p>{connected ? `Operator ${publicKey?.toBase58().slice(0, 4)}...${publicKey?.toBase58().slice(-4)} is authenticated.` : "Phantom and Solflare are supported. Set your wallet network to Devnet before signing."}</p>
        </div>
        <div className="mission-status">
          <span>PROGRAM</span><strong>DEPLOYED</strong>
          <span>FULL MATCH</span><strong>VERIFIED</strong>
          <span>AUDIT COST</span><strong>37,026 CU</strong>
        </div>
      </section>

      <GameConsole />

      <section className="protocol" aria-labelledby="protocol-title">
        <h2 id="protocol-title">The battle protocol</h2>
        <div className="protocol-grid">
          <article><span>01</span><h3>Commit</h3><p>Your fleet becomes a private Merkle commitment. The board stays hidden.</p></article>
          <article><span>02</span><h3>Fire</h3><p>Each response carries a proof tied to the original board commitment.</p></article>
          <article><span>03</span><h3>Audit</h3><p>The claimant reveals and verifies their own legal fleet before victory settles.</p></article>
        </div>
      </section>

      <footer>
        <p>DREADTIDE // DEVNET</p>
        <a href={`https://explorer.solana.com/tx/${MATCH}?cluster=devnet`} target="_blank" rel="noreferrer">View verified match</a>
      </footer>
    </main>
  );
}
