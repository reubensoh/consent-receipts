import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { verifyReceiptOffline, receiptStatus, type Check, type Receipt, type ReceiptStatus } from "@consent-receipts/receipt";
import { checkAnchorOnChain } from "../lib/anchorCheck.js";
import { CheckList } from "./CheckList.js";
import { AnchoredBlock } from "./AnchoredBlock.js";

interface Props {
  receipt: Receipt;
  /** The mocked model's answer, as returned with the receipt. */
  answer: string;
  onRetryAnchor?: () => Promise<void>;
  onStartOver: () => void;
}

export function ReceiptView({ receipt, answer, onRetryAnchor, onStartOver }: Props) {
  const { connection } = useConnection();
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [anchorCheck, setAnchorCheck] = useState<Check | null>(null);
  const [recheck, setRecheck] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    verifyReceiptOffline(receipt).then((c) => {
      if (!cancelled) setChecks(c);
    });
    return () => {
      cancelled = true;
    };
  }, [receipt]);

  // The browser reads the anchor account itself; the relay's word that it anchored is not the check.
  const anchor = receipt.anchor;
  useEffect(() => {
    setAnchorCheck(null);
    if (!anchor) return;
    let cancelled = false;
    checkAnchorOnChain(connection, { receipt_hash: receipt.receipt_hash, org: receipt.org, anchor }).then((c) => {
      if (!cancelled) setAnchorCheck(c);
    });
    return () => {
      cancelled = true;
    };
  }, [connection, receipt.receipt_hash, receipt.org, anchor, recheck]);

  // Nothing is claimed until every check that applies has run; the headline follows their result.
  const offline = checks ? receiptStatus(checks) : null;
  const anchorPending = anchor !== null && anchorCheck === null;
  const status: ReceiptStatus | null =
    offline === null ? null
    : offline === "failed" ? "failed"
    : anchorPending ? null
    : anchorCheck && !anchorCheck.ok ? "failed"
    : offline;

  const approved = receipt.decision === "APPROVE";
  const anchoredOk = anchor !== null && anchorCheck?.ok === true;
  const headline =
    status === null ? "Checking the receipt…"
    : status === "failed" ? "Receipt failed verification"
    : status === "awaiting-operator" ? (approved ? "Consent signed (draft receipt)" : "Declined (draft receipt)")
    : (approved ? "Receipt: approved" : "Receipt: declined") + (anchoredOk ? "" : " (not anchored)");
  const who = approved ? "Signed by your wallet and by the operator" : "Asked, refused, nothing sent. Signed by the operator";
  const note =
    status === null ? ""
    : status === "failed" ? "Do not rely on this receipt. The failing checks are listed below."
    : status === "awaiting-operator"
      ? (approved
          ? "Signed by your wallet. Awaiting the operator: file hash confirmation and co-signature. Not yet anchored."
          : "Asked, refused, nothing sent. Awaiting the operator's signature. Not yet anchored.")
    : anchoredOk ? `${who}, and anchored on Solana devnet.`
    : `${who}. The operator's anchoring step did not complete; see below.`;

  const download = () => {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${receipt.request.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const retry = onRetryAnchor && (async () => {
    setRetrying(true);
    try {
      await onRetryAnchor();
    } finally {
      setRetrying(false);
    }
  });

  return (
    <section className="receipt">
      <h2 className={status === "failed" ? "receipt-failed" : undefined}>{headline}</h2>
      {note && (
        <p className={status === "failed" ? "receipt-note receipt-failed" : "receipt-note"} role={status === "failed" ? "alert" : undefined}>
          {note}
        </p>
      )}

      <div className="answer">
        <h3>Mocked model answer</h3>
        <p>{answer}</p>
      </div>

      <AnchoredBlock
        receipt={receipt}
        check={anchorCheck}
        onCheckAgain={() => setRecheck((n) => n + 1)}
        onRetryAnchor={retry}
        retrying={retrying}
      />

      <h3>Verification (offline)</h3>
      {checks ? <CheckList checks={checks} /> : <p>Running checks…</p>}

      <h3>Receipt JSON</h3>
      <pre className="receipt-json">{JSON.stringify(receipt, null, 2)}</pre>

      <div className="receipt-actions">
        <button onClick={download}>Download receipt</button>
        <button className="secondary" onClick={onStartOver}>
          Start over
        </button>
      </div>
    </section>
  );
}
