//! consent_anchor: one PDA per consent receipt hash.
//!
//! What goes on chain: the 32-byte receipt hash (as the PDA seed and stored field), the
//! organisation key that paid and signed, the slot and unix time. Nothing else. Never the
//! user's key, never the item name, never a hash of the file itself.
//!
//! The PDA is scoped by the organisation key: seeds = ["receipt", org, receipt_hash]. So a
//! digest can be anchored once per organisation, and nobody can occupy another
//! organisation's slot for a digest (brief 001, check 5). Creating the same PDA twice fails at
//! the system program, which is the uniqueness proof.

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
        // No event: the account itself is the proof, and the binary must stay small enough
        // to upgrade in place (devnet rejects program extension for this account).
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
        seeds = [RECEIPT_SEED, org.key().as_ref(), receipt_hash.as_ref()],
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_is_89_bytes_and_holds_nothing_about_the_user() {
        // 8 discriminator + 32 hash + 32 org + 8 slot + 8 time + 1 bump
        assert_eq!(8 + ReceiptAnchor::INIT_SPACE, 89);
        assert_eq!(ReceiptAnchor::INIT_SPACE, 32 + 32 + 8 + 8 + 1);
    }

    #[test]
    fn pda_is_scoped_by_org_and_digest() {
        let hash = [7u8; 32];
        let org_a = Pubkey::new_unique();
        let org_b = Pubkey::new_unique();
        let pda = |org: &Pubkey, h: &[u8; 32]| {
            Pubkey::find_program_address(&[RECEIPT_SEED, org.as_ref(), h.as_ref()], &crate::ID).0
        };
        assert_eq!(pda(&org_a, &hash), pda(&org_a, &hash), "deterministic");
        assert_ne!(pda(&org_a, &hash), pda(&org_b, &hash), "different org, different slot");
        assert_ne!(pda(&org_a, &hash), pda(&org_a, &[8u8; 32]), "different digest, different slot");
    }
}
