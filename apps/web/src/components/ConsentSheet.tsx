import { useMemo, useState } from "react";
import { buildConsentText, formatSize, type ConsentRequest } from "@consent-receipts/receipt";
import { ORG_PUBKEY } from "../lib/consentRequest.js";

interface Props {
  request: ConsentRequest;
  userPubkey: string;
  busy: boolean;
  onApprove: (consentText: string) => void;
  onDecline: () => void;
}

/**
 * OUR sheet (docs/CLAIMS.md, "Sheet header, fixed"). `buildConsentText` validates every field
 * and throws on anything that could split or impersonate a line (fixed after brief 001's check
 * 3) — a throw here means we refuse to render rather than show a partial sheet.
 */
export function ConsentSheet({ request, userPubkey, busy, onApprove, onDecline }: Props) {
  const [showRaw, setShowRaw] = useState(false);

  const text = useMemo(() => {
    try {
      return {
        ok: true as const,
        value: buildConsentText({ request, decision: "APPROVE", orgPubkey: ORG_PUBKEY, userPubkey }),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [request, userPubkey]);

  if (!text.ok) {
    return (
      <div className="sheet sheet-error" role="alert">
        <h2>Consent sheet refused to render</h2>
        <p>
          A field failed validation, so nothing is shown rather than a partial sheet:{" "}
          <code>{text.error}</code>
        </p>
      </div>
    );
  }

  return (
    <section className="sheet">
      <header>
        <p className="sheet-service">Service: Flair Health consent receipts (prototype).</p>
        <p className="sheet-operator">Operator: Regal Pines Pte. Ltd.</p>
      </header>

      <dl className="sheet-fields">
        <dt>Item</dt>
        <dd>{request.item}</dd>
        <dt>SHA-256</dt>
        <dd className="mono">{request.sha256}</dd>
        <dt>Size</dt>
        <dd>{formatSize(request.size)}</dd>
        <dt>Purpose</dt>
        <dd>{request.purpose}</dd>
        <dt>Provider</dt>
        <dd>{request.provider}</dd>
        <dt>Model</dt>
        <dd>{request.model}</dd>
        <dt>Terms (ours)</dt>
        <dd>
          <ul>
            {request.terms.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </dd>
        <dt>Expires at</dt>
        <dd>{request.expiresAt}</dd>
      </dl>

      <details open={showRaw} onToggle={(e) => setShowRaw(e.currentTarget.open)}>
        <summary>What you will sign</summary>
        <pre className="consent-text">{text.value}</pre>
      </details>

      <p className="sheet-note">
        Whatever is not on this sheet was not consented. Approving asks your wallet to sign the
        exact text above; declining sends nothing and asks for no signature.
      </p>

      <div className="sheet-actions">
        <button disabled={busy} onClick={() => onApprove(text.value)}>
          Approve — sign with wallet
        </button>
        <button disabled={busy} className="secondary" onClick={onDecline}>
          Decline
        </button>
      </div>
    </section>
  );
}
