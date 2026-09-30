import { useEffect, useState } from "react";
import { verifyReceiptOffline, receiptStatus, type Check, type Receipt } from "@consent-receipts/receipt";
import { CheckList } from "./CheckList.js";

export function ReceiptView({ receipt, onStartOver }: { receipt: Receipt; onStartOver: () => void }) {
  const [checks, setChecks] = useState<Check[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    verifyReceiptOffline(receipt).then((c) => {
      if (!cancelled) setChecks(c);
    });
    return () => {
      cancelled = true;
    };
  }, [receipt]);

  // Nothing is claimed until the checks have run; the headline follows their result.
  const status = checks ? receiptStatus(checks) : null;
  const approved = receipt.decision === "APPROVE";
  const headline =
    status === null ? "Checking the receipt…"
    : status === "failed" ? "Receipt failed verification"
    : status === "awaiting-operator" ? (approved ? "Consent signed (draft receipt)" : "Declined (draft receipt)")
    : approved ? "Receipt: approved" : "Receipt: declined";
  const note =
    status === null ? ""
    : status === "failed" ? "Do not rely on this receipt. The failing checks are listed below."
    : status === "awaiting-operator"
      ? (approved
          ? "Signed by your wallet. Awaiting the operator: file hash confirmation and co-signature. Not yet anchored."
          : "Asked, refused, nothing sent. Awaiting the operator's signature. Not yet anchored.")
    : (approved ? "Signed by your wallet and by the operator." : "Asked, refused, nothing sent. Signed by the operator.");

  const download = () => {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${receipt.request.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="receipt">
      <h2 className={status === "failed" ? "receipt-failed" : undefined}>{headline}</h2>
      {note && (
        <p className={status === "failed" ? "receipt-note receipt-failed" : "receipt-note"} role={status === "failed" ? "alert" : undefined}>
          {note}
        </p>
      )}

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
