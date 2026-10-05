/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RELAY_URL?: string;
  readonly VITE_ORG_PUBKEY?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
