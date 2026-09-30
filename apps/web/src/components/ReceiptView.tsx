import { useEffect, useState } from "react";
import { verifyReceiptOffline, type Check, type Receipt } from "@consent-receipts/receipt";
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

  const orgCheck = checks?.find((c) => c.name === "org signature over receipt_hash");
  const failing = checks?.filter((c) => !c.ok) ?? [];
  const onlyOrgFails = checks !== null && failing.length === 1 && failing[0] === orgCheck;

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
      <h2>{receipt.decision === "APPROVE" ? "Receipt: approved" : "Receipt: declined"}</h2>

      {receipt.decision === "DECLINE" && (
        <p className="receipt-note">Asked, refused, nothing sent.</p>
      )}

      {receipt.decision === "APPROVE" && (
        <p className="receipt-note">
          Signed, timestamped, verifiable — not yet anchored.
          {onlyOrgFails && " Not yet co-signed by the operator; that happens in a later step."}
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
