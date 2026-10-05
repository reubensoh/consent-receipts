import type { Check, Receipt } from "@consent-receipts/receipt";
import { CheckList } from "./CheckList.js";

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,100}$/;

interface Props {
  receipt: Receipt;
  /** The browser's own read of the anchor account; null while that read is in flight. */
  check: Check | null;
  onCheckAgain: () => void;
  onRetryAnchor?: () => void;
  retrying: boolean;
}

/**
 * The fourth beat. The link is built from the transaction signature rather than taken from the
 * relay's `solscan` string, and only when that signature looks like base58.
 */
export function AnchoredBlock({ receipt, check, onCheckAgain, onRetryAnchor, retrying }: Props) {
  const a = receipt.anchor;

  if (!a) {
    return (
      <section className="anchored anchored-missing">
        <h3>Not anchored</h3>
        <p>
          The operator signed this receipt, but anchoring its hash on Solana devnet did not complete.
          The signed receipt is intact, and anchoring can be tried again.
        </p>
        {onRetryAnchor && (
          <button disabled={retrying} onClick={onRetryAnchor}>
            {retrying ? "Retrying…" : "Retry anchoring"}
          </button>
        )}
      </section>
    );
  }

  const blockTime = Number.isFinite(a.block_time) ? new Date(a.block_time * 1000).toISOString() : "unknown";
  return (
    <section className="anchored">
      <h3>Anchored on Solana devnet</h3>
      <dl className="anchor-fields">
        <dt>Transaction</dt>
        <dd>
          {B58.test(a.tx) ? (
            <a href={`https://solscan.io/tx/${a.tx}?cluster=devnet`} target="_blank" rel="noreferrer">
              View the transaction on Solscan
            </a>
          ) : (
            "link unavailable"
          )}
          <div className="mono">{a.tx}</div>
        </dd>
        <dt>Account</dt>
        <dd>
          {B58.test(a.pda) ? (
            <a href={`https://solscan.io/account/${a.pda}?cluster=devnet`} target="_blank" rel="noreferrer">
              View the anchor account on Solscan
            </a>
          ) : (
            "link unavailable"
          )}
          <div className="mono">{a.pda}</div>
        </dd>
        <dt>Slot</dt>
        <dd>{a.slot}</dd>
        <dt>Block time</dt>
        <dd>{blockTime}</dd>
      </dl>

      <h4>On-chain check, read by your browser</h4>
      {check ? <CheckList checks={[check]} /> : <p>Reading the account from devnet…</p>}
      <button className="secondary" onClick={onCheckAgain}>
        Check again
      </button>
    </section>
  );
}
