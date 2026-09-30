import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import type { Receipt } from "@consent-receipts/receipt";
import { challenge, verify } from "./lib/relay.js";
import { makeConsentRequest } from "./lib/consentRequest.js";
import { buildApproveReceipt, buildDeclineReceipt } from "./lib/buildReceipt.js";
import { ConsentSheet } from "./components/ConsentSheet.js";
import { ReceiptView } from "./components/ReceiptView.js";

type Stage = { name: "idle" } | { name: "sheet" } | { name: "receipt"; receipt: Receipt };

export default function App() {
  const { publicKey, connected, signMessage } = useWallet();
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [token, setToken] = useState<string | null>(null); // memory only — never localStorage
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [request] = useState(makeConsentRequest); // one hardcoded request per page load

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("This wallet does not support signMessage.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const pubkey = publicKey.toBase58();
      const { message } = await challenge(pubkey);
      const signatureBytes = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(signatureBytes);
      const { token } = await verify(pubkey, message, signature);
      setToken(token);
      setStage({ name: "sheet" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [publicKey, signMessage]);

  const approve = useCallback(
    async (consentText: string) => {
      if (!publicKey || !signMessage) {
        setError("This wallet does not support signMessage.");
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const signatureBytes = await signMessage(new TextEncoder().encode(consentText));
        const signature = bs58.encode(signatureBytes);
        const receipt = await buildApproveReceipt(request, consentText, publicKey.toBase58(), signature);
        setStage({ name: "receipt", receipt });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [publicKey, signMessage, request],
  );

  const decline = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const receipt = await buildDeclineReceipt(request, publicKey.toBase58());
      setStage({ name: "receipt", receipt });
    } finally {
      setBusy(false);
    }
  }, [publicKey, request]);

  const startOver = useCallback(() => {
    setToken(null);
    setStage({ name: "idle" });
  }, []);

  return (
    <main className="app">
      <h1>Flair Health consent receipts (prototype)</h1>
      <p className="tagline">Working title. Not a brand. Devnet only.</p>

      <div className="wallet-row">
        <WalletMultiButton />
        {connected && !token && (
          <button disabled={busy} onClick={signIn}>
            Sign in with wallet
          </button>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {connected && token && stage.name === "sheet" && publicKey && (
        <ConsentSheet
          request={request}
          userPubkey={publicKey.toBase58()}
          busy={busy}
          onApprove={approve}
          onDecline={decline}
        />
      )}

      {stage.name === "receipt" && <ReceiptView receipt={stage.receipt} onStartOver={startOver} />}

      {!connected && <p className="hint">Connect Phantom or Solflare (devnet) to begin.</p>}
    </main>
  );
}
