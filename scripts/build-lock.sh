#!/usr/bin/env bash
# Lock protocol for heavy builds on the shared 16 GB machine (PO, 2026-09-29).
# 1. If the Flair gate's lock directory exists, do not build; report and exit 75 (EX_TEMPFAIL).
# 2. Hold our own lock directory for the duration, removed on any exit.
# Usage: scripts/build-lock.sh anchor build
#        scripts/build-lock.sh anchor deploy --provider.cluster devnet
set -u
FLAIR_LOCK=/tmp/flair_health_gate.lock
OUR_LOCK=/tmp/consent_receipts_build.lock

if [ -d "$FLAIR_LOCK" ]; then
  echo "BLOCKED: $FLAIR_LOCK exists; the Flair gate's suite is running. Wait and tell the PO." >&2
  exit 75
fi
if ! mkdir "$OUR_LOCK" 2>/dev/null; then
  echo "BLOCKED: $OUR_LOCK already exists; another consent-receipts build is running." >&2
  exit 75
fi
trap 'rmdir "$OUR_LOCK" 2>/dev/null' EXIT INT TERM
echo "lock held: $OUR_LOCK" >&2
"$@"
