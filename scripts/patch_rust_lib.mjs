import fs from 'fs';

let content = fs.readFileSync('programs/commit-protocol/src/lib.rs', 'utf8');

// 1. Add instructions before the closing brace of pub mod commit_protocol
const targetInstructions = `        commitment.status = CommitmentStatus::Disputed as u8;
        emit!(DisputeOpenedEvent {
            commitment_id: commitment.commitment_id,
            disputer: ctx.accounts.creator.key(),
        });
        Ok(())
    }
}`;

const newInstructions = `        commitment.status = CommitmentStatus::Disputed as u8;
        emit!(DisputeOpenedEvent {
            commitment_id: commitment.commitment_id,
            disputer: ctx.accounts.creator.key(),
        });
        Ok(())
    }

    /// Explicitly activate commitment once start time is reached
    pub fn activate_commitment(ctx: Context<ActivateCommitment>) -> Result<()> {
        let commitment = &mut ctx.accounts.commitment;
        require!(
            commitment.status == CommitmentStatus::Funded as u8,
            CommitError::InvalidStateTransition
        );
        let clock = Clock::get()?;
        require!(clock.unix_timestamp >= commitment.start_time, CommitError::InvalidTimeframe);
        commitment.status = CommitmentStatus::Active as u8;

        emit!(CommitmentActivatedEvent {
            commitment_id: commitment.commitment_id,
            activated_at: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Resolve an open dispute by authorized dispute resolver / admin
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        resolution: u8, // 1 = RESOLVED_USER (Overturn to PASS), 2 = RESOLVED_VERIFIER (Uphold FAIL)
    ) -> Result<()> {
        let commitment = &mut ctx.accounts.commitment;
        require!(
            commitment.status == CommitmentStatus::Disputed as u8,
            CommitError::InvalidStateTransition
        );
        require_keys_eq!(
            ctx.accounts.dispute_resolver.key(),
            commitment.oracle_authority,
            CommitError::Unauthorized
        );

        if resolution == 1 {
            // Overturn to PASS
            commitment.is_successful = true;
            commitment.status = CommitmentStatus::Verified as u8;
        } else {
            // Uphold FAIL
            commitment.is_successful = false;
            commitment.status = CommitmentStatus::Verified as u8;
        }

        emit!(DisputeResolvedEvent {
            commitment_id: commitment.commitment_id,
            resolution,
            is_successful: commitment.is_successful,
        });

        Ok(())
    }
}`;

if (content.includes(targetInstructions)) {
  content = content.replace(targetInstructions, newInstructions);
  console.log('Added activate_commitment and resolve_dispute instructions');
} else {
  console.log('Target instructions not found');
}

// 2. Add Account Contexts for ActivateCommitment and ResolveDispute
const targetAccount = `#[derive(Accounts)]
pub struct OpenDispute<'info> {
    #[account(
        mut,
        seeds = [b"commitment", commitment.commitment_id.as_ref()],
        bump = commitment.bump
    )]
    pub commitment: Account<'info, CommitmentAccount>,
    pub creator: Signer<'info>,
}`;

const newAccount = `#[derive(Accounts)]
pub struct OpenDispute<'info> {
    #[account(
        mut,
        seeds = [b"commitment", commitment.commitment_id.as_ref()],
        bump = commitment.bump
    )]
    pub commitment: Account<'info, CommitmentAccount>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct ActivateCommitment<'info> {
    #[account(
        mut,
        seeds = [b"commitment", commitment.commitment_id.as_ref()],
        bump = commitment.bump
    )]
    pub commitment: Account<'info, CommitmentAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(
        mut,
        seeds = [b"commitment", commitment.commitment_id.as_ref()],
        bump = commitment.bump
    )]
    pub commitment: Account<'info, CommitmentAccount>,
    pub dispute_resolver: Signer<'info>,
}`;

if (content.includes(targetAccount)) {
  content = content.replace(targetAccount, newAccount);
  console.log('Added ActivateCommitment and ResolveDispute structs');
} else {
  console.log('Target account struct not found');
}

// 3. Add Events
const targetEvent = `#[event]
pub struct DisputeOpenedEvent {
    pub commitment_id: [u8; 32],
    pub disputer: Pubkey,
}`;

const newEvent = `#[event]
pub struct DisputeOpenedEvent {
    pub commitment_id: [u8; 32],
    pub disputer: Pubkey,
}

#[event]
pub struct CommitmentActivatedEvent {
    pub commitment_id: [u8; 32],
    pub activated_at: i64,
}

#[event]
pub struct DisputeResolvedEvent {
    pub commitment_id: [u8; 32],
    pub resolution: u8,
    pub is_successful: bool,
}`;

if (content.includes(targetEvent)) {
  content = content.replace(targetEvent, newEvent);
  console.log('Added CommitmentActivatedEvent and DisputeResolvedEvent');
} else {
  console.log('Target event not found');
}

fs.writeFileSync('programs/commit-protocol/src/lib.rs', content, 'utf8');
console.log('Successfully updated programs/commit-protocol/src/lib.rs');
