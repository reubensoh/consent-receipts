import type { Check } from "@consent-receipts/receipt";

export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="check-list">
      {checks.map((c) => (
        <li key={c.name} className={c.ok ? "check-pass" : "check-fail"}>
          <span className="check-mark">{c.ok ? "PASS" : "FAIL"}</span>
          <span className="check-name">{c.name}</span>
          {c.detail ? <span className="check-detail">{c.detail}</span> : null}
        </li>
      ))}
    </ul>
  );
}
