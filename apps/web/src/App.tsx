import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import type { ConsentRequest, Receipt } from "@consent-receipts/receipt";
import {
  anchorDigest, approve as approveRequest, challenge, decline as declineRequest, requestMock, verify,
  type Asked,
} from "./lib/relay.js";
import { loadFixture, toBase64, type FixtureFile } from "./lib/file.js";
import { PROGRAM_ID } from "./lib/config.js";
import { ConsentSheet } from "./components/ConsentSheet.js";
import { ReceiptView } from "./components/ReceiptView.js";

interface Sheet {
  request: ConsentRequest;   // what the relay's pending request says, plus the hash and size computed here
  asked: Asked;              // the pending request and its mac, posted back unchanged
  file: FixtureFile;
}

type Stage = { name: "idle" } | ({ name: "sheet" } & Sheet) | { name: "receipt"; receipt: Receipt; answer: string };

const isExpired = (r: ConsentRequest, now = new Date()) => now.getTime() >= Date.parse(r.expiresAt);

export default function App() {
  const { publicKey, connected, signMessage } = useWallet();
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [token, setToken] = useState<string | null>(null); // memory only — never localStorage
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A session belongs to one key. If the wallet disconnects or switches account, drop it.
  const pubkeyB58 = publicKey?.toBase58() ?? null;
  useEffect(() => {
    setToken(null);
    setStage({ name: "idle" });
    setError(null);
  }, [pubkeyB58]);

  // The mocked model asks for one file; the browser hashes it, and the sheet is raised from both.
  const raiseSheet = useCallback(async (sessionToken: string) => {
    const asked = await requestMock(sessionToken);
    const file = await loadFixture();
    setStage({ name: "sheet", asked, file, request: { ...asked.pending, sha256: file.sha256, size: file.size } });
  }, []);

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
      const { token: sessionToken } = await verify(pubkey, message, signature);
      setToken(sessionToken);
      await raiseSheet(sessionToken);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [publicKey, signMessage, raiseSheet]);

  const askAgain = useCallback(async () => {
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      await raiseSheet(token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [token, raiseSheet]);

  const approve = useCallback(
    async (consentText: string) => {
      if (!publicKey || !signMessage) {
        setError("This wallet does not support signMessage.");
        return;
      }
      if (stage.name !== "sheet" || !token) return;
      const { request, asked, file } = stage;
      if (isExpired(request)) {
        setError("This request expired before it was approved. Nothing was signed. Start over for a new request.");
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const signature = bs58.encode(await signMessage(new TextEncoder().encode(consentText)));
        const out = await approveRequest(token, {
          ...asked, sha256: file.sha256, size: file.size, consentText, signature, fileB64: toBase64(file.bytes),
        });
        setStage({ name: "receipt", receipt: out.receipt, answer: out.answer });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [publicKey, signMessage, stage, token],
  );

  // One tap, and the wallet is never called: the relay signs and anchors the decline.
  const decline = useCallback(async () => {
    if (stage.name !== "sheet" || !token) return;
    setError(null);
    setBusy(true);
    try {
      const out = await declineRequest(token, stage.asked);
      setStage({ name: "receipt", receipt: out.receipt, answer: out.answer });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [stage, token]);

  // The anchor is outside the receipt hash, so filling it in later does not touch any signature.
  const retryAnchor = useCallback(async () => {
    if (stage.name !== "receipt" || !token) return;
    setError(null);
    try {
      const r = await anchorDigest(token, stage.receipt.receipt_hash);
      if (r.slot === null || r.block_time === null) {
        throw new Error("Anchored, but the slot is not readable yet. Try again in a few seconds.");
      }
      const anchor = { cluster: "devnet" as const, program: PROGRAM_ID, pda: r.pda, tx: r.tx, slot: r.slot, block_time: r.block_time, solscan: r.solscan };
      setStage({ ...stage, receipt: { ...stage.receipt, anchor } });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [stage, token]);

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
        {connected && token && stage.name === "idle" && (
          <button disabled={busy} onClick={askAgain}>
            Request a new sheet
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
          request={stage.request}
          userPubkey={publicKey.toBase58()}
          busy={busy}
          onApprove={approve}
          onDecline={decline}
        />
      )}

      {stage.name === "receipt" && (
        <ReceiptView
          receipt={stage.receipt}
          answer={stage.answer}
          onRetryAnchor={token ? retryAnchor : undefined}
          onStartOver={startOver}
        />
      )}

      {!connected && <p className="hint">Connect Phantom or Solflare (devnet) to begin.</p>}
    </main>
  );
}
