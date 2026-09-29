#![cfg(feature = "svm-tests")]
//! Integration tests on LiteSVM against the built program.
//! Run after `scripts/build-lock.sh anchor build`:
//!   cargo test -p consent_anchor --features svm-tests

use anchor_lang::{prelude::Pubkey, solana_program::instruction::Instruction, system_program, InstructionData, ToAccountMetas};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;

const ONE_SOL: u64 = 1_000_000_000;

fn svm() -> LiteSVM {
    let mut svm = LiteSVM::new();
    svm.add_program(consent_anchor::id(), include_bytes!("../../../target/deploy/consent_anchor.so")).unwrap();
    svm
}

fn pda(org: &Pubkey, hash: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(&[consent_anchor::RECEIPT_SEED, org.as_ref(), hash.as_ref()], &consent_anchor::id()).0
}

fn anchor(svm: &mut LiteSVM, org: &Keypair, hash: [u8; 32]) -> Result<(), String> {
    let ix = Instruction {
        program_id: consent_anchor::id(),
        accounts: consent_anchor::accounts::AnchorReceipt {
            anchor: pda(&org.pubkey(), &hash), org: org.pubkey(), system_program: system_program::ID,
        }.to_account_metas(None),
        data: consent_anchor::instruction::AnchorReceipt { receipt_hash: hash }.data(),
    };
    let msg = Message::new_with_blockhash(&[ix], Some(&org.pubkey()), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[org]).unwrap();
    svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e.err))
}

#[test]
fn anchors_once_per_org_and_stores_only_hash_org_slot_time_bump() {
    let mut svm = svm();
    let org = Keypair::new();
    svm.airdrop(&org.pubkey(), ONE_SOL).unwrap();
    let hash = [0xabu8; 32];

    anchor(&mut svm, &org, hash).expect("first anchor succeeds");
    let acct = svm.get_account(&pda(&org.pubkey(), &hash)).expect("account exists");
    assert_eq!(acct.owner, consent_anchor::id());
    assert_eq!(acct.data.len(), 89);
    assert_eq!(&acct.data[8..40], &hash, "digest at bytes 8..40");
    assert_eq!(&acct.data[40..72], org.pubkey().as_ref(), "org key at bytes 40..72");
    // nothing else: slot, time, bump. No user key anywhere in the data.
    assert_eq!(acct.data.len(), 8 + 32 + 32 + 8 + 8 + 1);

    svm.expire_blockhash(); // otherwise LiteSVM dedups the identical transaction before the program runs
    let err = anchor(&mut svm, &org, hash).expect_err("same org, same digest: refused");
    assert!(err.contains("already in use") || err.contains("Custom(0)"), "got: {err}");
}

#[test]
fn another_org_cannot_squat_a_digest() {
    let mut svm = svm();
    let (org_a, org_b) = (Keypair::new(), Keypair::new());
    svm.airdrop(&org_a.pubkey(), ONE_SOL).unwrap();
    svm.airdrop(&org_b.pubkey(), ONE_SOL).unwrap();
    let hash = [0xcdu8; 32];
    anchor(&mut svm, &org_b, hash).expect("a stranger anchors the digest first");
    anchor(&mut svm, &org_a, hash).expect("the real org can still anchor it under its own key");
    assert_ne!(pda(&org_a.pubkey(), &hash), pda(&org_b.pubkey(), &hash));
}

#[test]
fn unsigned_org_is_rejected() {
    let mut svm = svm();
    let (payer, org) = (Keypair::new(), Keypair::new());
    svm.airdrop(&payer.pubkey(), ONE_SOL).unwrap();
    let hash = [0x11u8; 32];
    let mut metas = consent_anchor::accounts::AnchorReceipt {
        anchor: pda(&org.pubkey(), &hash), org: org.pubkey(), system_program: system_program::ID,
    }.to_account_metas(None);
    metas[1].is_signer = false;
    let ix = Instruction { program_id: consent_anchor::id(), accounts: metas,
        data: consent_anchor::instruction::AnchorReceipt { receipt_hash: hash }.data() };
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[&payer]).unwrap();
    assert!(svm.send_transaction(tx).is_err(), "org must sign");
}
