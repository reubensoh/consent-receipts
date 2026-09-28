//! consent_anchor: one PDA per consent receipt hash.
//!
//! What goes on chain: the 32-byte receipt hash (as the PDA seed and stored field), the
//! organisation key that paid and signed, the slot and unix time. Nothing else. Never the
//! user's key, never the item name, never a hash of the file itself.
//!
//! Creating the same PDA twice fails at the system program, which is the uniqueness proof.

use anchor_lang::prelude::*;

declare_id!("72NKbS2kpoxzwAyznfzmq6GuKqS1yQtdnBLzWxhfbbCh");

pub const RECEIPT_SEED: &[u8] = b"receipt";

#[program]
pub mod consent_anchor {
    use super::*;

    /// Anchor a receipt hash. `receipt_hash` is sha256(canonical receipt body), see
    /// docs/RECEIPT-FORMAT.md. The org key must sign and pays rent.
    pub fn anchor_receipt(ctx: Context<AnchorReceipt>, receipt_hash: [u8; 32]) -> Result<()> {
        let clock = Clock::get()?;
        let a = &mut ctx.accounts.anchor;
        a.receipt_hash = receipt_hash;
        a.org = ctx.accounts.org.key();
        a.slot = clock.slot;
        a.unix_time = clock.unix_timestamp;
        a.bump = ctx.bumps.anchor;
        emit!(ReceiptAnchored { receipt_hash, org: a.org, slot: a.slot, unix_time: a.unix_time });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(receipt_hash: [u8; 32])]
pub struct AnchorReceipt<'info> {
    #[account(
        init,
        payer = org,
        space = 8 + ReceiptAnchor::INIT_SPACE,
        seeds = [RECEIPT_SEED, receipt_hash.as_ref()],
        bump
    )]
    pub anchor: Account<'info, ReceiptAnchor>,
    /// The organisation signing key. It pays, so the user's wallet never appears.
    #[account(mut)]
    pub org: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct ReceiptAnchor {
    pub receipt_hash: [u8; 32],
    pub org: Pubkey,
    pub slot: u64,
    pub unix_time: i64,
    pub bump: u8,
}

#[event]
pub struct ReceiptAnchored {
    pub receipt_hash: [u8; 32],
    pub org: Pubkey,
    pub slot: u64,
    pub unix_time: i64,
}
