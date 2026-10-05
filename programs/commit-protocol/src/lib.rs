use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Commit11111111111111111111111111111111111111");

#[program]
pub mod commit_protocol {
    use super::*;

    /// Initialize a new immutable commitment
    pub fn create_commitment(
        ctx: Context<CreateCommitment>,
        commitment_id: [u8; 32],
        staking_mode: u8,
        stake_amount: u64,
        verification_fee: u64,
        verifier_type: u8,
        oracle_authority: Pubkey,
        goal_hash: [u8; 32],
        start_time: i64,
        end_time: i64,
        failure_policy: u8,
        penalty_bps: u16, // Basis points (e.g. 2500 = 25%)
    ) -> Result<()> {
        require!(stake_amount > 0, CommitError::InvalidStakeAmount);
        require!(end_time > start_time, CommitError::InvalidTimeframe);
        require!(penalty_bps <= 10000, CommitError::InvalidPenaltyBps);

        let commitment = &mut ctx.accounts.commitment;
        commitment.creator = ctx.accounts.creator.key();
        commitment.commitment_id = commitment_id;
        commitment.staking_mode = staking_mode;
        commitment.stake_amount = stake_amount;
        commitment.verification_fee = verification_fee;
        commitment.verifier_type = verifier_type;
        commitment.oracle_authority = oracle_authority;
        commitment.goal_hash = goal_hash;
        commitment.start_time = start_time;
        commitment.end_time = end_time;
        commitment.failure_policy = failure_policy;
        commitment.penalty_bps = penalty_bps;
        commitment.failure_destination = ctx.accounts.failure_destination.key();
        commitment.status = CommitmentStatus::Created as u8;
        commitment.evidence_hash = [0u8; 32];
        commitment.result_code = [0u8; 32];
        commitment.is_successful = false;
        commitment.settled_at = 0;
        commitment.bump = ctx.bumps.commitment;
        commitment.vault_bump = ctx.bumps.escrow_vault;

        emit!(CommitmentCreatedEvent {
            creator: commitment.creator,
            commitment_id,
            staking_mode,
            stake_amount,
            verifier_type,
            end_time,
        });

        Ok(())
    }

    /// Fund commitment and transfer USDC stake + verification fee into PDA escrow vault
    pub fn fund_commitment(ctx: Context<FundCommitment>) -> Result<()> {
        let commitment = &mut ctx.accounts.commitment;
        require!(
            commitment.status == CommitmentStatus::Created as u8,
            CommitError::InvalidStateTransition
        );

        let total_deposit = commitment
            .stake_amount
            .checked_add(commitment.verification_fee)
            .ok_or(CommitError::MathOverflow)?;

        // Transfer funds from user token account to PDA escrow vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.escrow_vault.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), total_deposit)?;

        commitment.status = CommitmentStatus::Funded as u8;

        // Auto-activate if start_time is reached
        let clock = Clock::get()?;
        if clock.unix_timestamp >= commitment.start_time {
            commitment.status = CommitmentStatus::Active as u8;
        }

        emit!(CommitmentFundedEvent {
            commitment_id: commitment.commitment_id,
            total_deposited: total_deposit,
            funder: ctx.accounts.creator.key(),
        });

        Ok(())
    }

    /// Submit signed verification outcome from authorized Oracle / Peer Multisig
    pub fn submit_verification(
        ctx: Context<SubmitVerification>,
        evidence_hash: [u8; 32],
        result_code: [u8; 32],
        is_successful: bool,
    ) -> Result<()> {
        let commitment = &mut ctx.accounts.commitment;
        require!(
            commitment.status == CommitmentStatus::Funded as u8
                || commitment.status == CommitmentStatus::Active as u8,
            CommitError::InvalidStateTransition
        );
        require_keys_eq!(
            ctx.accounts.oracle_authority.key(),
            commitment.oracle_authority,
            CommitError::UnauthorizedOracle
        );

        commitment.evidence_hash = evidence_hash;
        commitment.result_code = result_code;
        commitment.is_successful = is_successful;
        commitment.status = CommitmentStatus::Verified as u8;

        emit!(VerificationSubmittedEvent {
            commitment_id: commitment.commitment_id,
            evidence_hash,
            result_code,
            is_successful,
        });

        Ok(())
    }

    /// Settle commitment based on immutable rules and verification outcome
    pub fn settle_commitment(ctx: Context<SettleCommitment>) -> Result<()> {
        let commitment = &mut ctx.accounts.commitment;
        require!(
            commitment.status == CommitmentStatus::Verified as u8,
            CommitError::NotReadyForSettlement
        );

        let seeds = &[
            b"escrow_vault".as_ref(),
            commitment.commitment_id.as_ref(),
            &[commitment.vault_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        // 1. Pay verification fee to verifier payout account
        if commitment.verification_fee > 0 {
            let fee_accounts = Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.verifier_payout_account.to_account_info(),
                authority: ctx.accounts.escrow_vault.to_account_info(),
            };
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    fee_accounts,
                    signer_seeds,
                ),
                commitment.verification_fee,
            )?;
        }

        // 2. Handle Stake Settlement
        if commitment.is_successful {
            // SUCCESS: 100% of stake returned to user
            let return_accounts = Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.escrow_vault.to_account_info(),
            };
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    return_accounts,
                    signer_seeds,
                ),
                commitment.stake_amount,
            )?;
        } else {
            // FAILURE: Apply predetermined failure policy
            let penalty_amount = (commitment.stake_amount as u128)
                .checked_mul(commitment.penalty_bps as u128)
                .ok_or(CommitError::MathOverflow)?
                .checked_div(10000)
                .ok_or(CommitError::MathOverflow)? as u64;

            let return_amount = commitment
                .stake_amount
                .checked_sub(penalty_amount)
                .ok_or(CommitError::MathOverflow)?;

            // Return partial amount to creator if any
            if return_amount > 0 {
                let return_accounts = Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.escrow_vault.to_account_info(),
                };
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        return_accounts,
                        signer_seeds,
                    ),
                    return_amount,
                )?;
            }

            // Transfer penalty to failure destination (Community/Charity pool)
            if penalty_amount > 0 {
                let penalty_accounts = Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.failure_destination_token_account.to_account_info(),
                    authority: ctx.accounts.escrow_vault.to_account_info(),
                };
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        penalty_accounts,
                        signer_seeds,
                    ),
                    penalty_amount,
                )?;
            }
        }

        commitment.status = CommitmentStatus::Settled as u8;
        let clock = Clock::get()?;
        commitment.settled_at = clock.unix_timestamp;

        emit!(CommitmentSettledEvent {
            commitment_id: commitment.commitment_id,
            is_successful: commitment.is_successful,
            settled_at: commitment.settled_at,
        });

        Ok(())
    }

    /// Open dispute within challenge window
    pub fn open_dispute(ctx: Context<OpenDispute>) -> Result<()> {
        let commitment = &mut ctx.accounts.commitment;
        require!(
            commitment.status == CommitmentStatus::Verified as u8,
            CommitError::CannotDisputeAtThisState
        );
        require_keys_eq!(commitment.creator, ctx.accounts.creator.key(), CommitError::Unauthorized);

        commitment.status = CommitmentStatus::Disputed as u8;
        emit!(DisputeOpenedEvent {
            commitment_id: commitment.commitment_id,
            disputer: ctx.accounts.creator.key(),
        });
        Ok(())
    }
}

// -----------------------------------------------------------------------------
// ACCOUNT CONTEXTS (WITH SECURITY CONSTRAINTS)
// -----------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(commitment_id: [u8; 32])]
pub struct CreateCommitment<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + CommitmentAccount::LEN,
        seeds = [b"commitment", commitment_id.as_ref()],
        bump
    )]
    pub commitment: Account<'info, CommitmentAccount>,

    #[account(
        init,
        payer = creator,
        seeds = [b"escrow_vault", commitment_id.as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = escrow_vault
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, anchor_spl::token::Mint>,
    /// CHECK: Failure destination pool/charity wallet
    pub failure_destination: AccountInfo<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FundCommitment<'info> {
    #[account(
        mut,
        seeds = [b"commitment", commitment.commitment_id.as_ref()],
        bump = commitment.bump
    )]
    pub commitment: Account<'info, CommitmentAccount>,

    #[account(
        mut,
        seeds = [b"escrow_vault", commitment.commitment_id.as_ref()],
        bump = commitment.vault_bump
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.owner == creator.key() @ CommitError::Unauthorized
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub creator: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SubmitVerification<'info> {
    #[account(
        mut,
        seeds = [b"commitment", commitment.commitment_id.as_ref()],
        bump = commitment.bump
    )]
    pub commitment: Account<'info, CommitmentAccount>,

    pub oracle_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettleCommitment<'info> {
    #[account(
        mut,
        seeds = [b"commitment", commitment.commitment_id.as_ref()],
        bump = commitment.bump
    )]
    pub commitment: Account<'info, CommitmentAccount>,

    #[account(
        mut,
        seeds = [b"escrow_vault", commitment.commitment_id.as_ref()],
        bump = commitment.vault_bump
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    // SECURITY FIX: Ensure payout token account belongs to commitment creator
    #[account(
        mut,
        constraint = user_token_account.owner == commitment.creator @ CommitError::Unauthorized
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub verifier_payout_account: Account<'info, TokenAccount>,

    // SECURITY FIX: Ensure penalty token account belongs to predefined failure destination
    #[account(
        mut,
        constraint = failure_destination_token_account.owner == commitment.failure_destination @ CommitError::Unauthorized
    )]
    pub failure_destination_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    #[account(
        mut,
        seeds = [b"commitment", commitment.commitment_id.as_ref()],
        bump = commitment.bump
    )]
    pub commitment: Account<'info, CommitmentAccount>,

    pub creator: Signer<'info>,
}

// -----------------------------------------------------------------------------
// STATE & ENUMS
// -----------------------------------------------------------------------------

#[account]
pub struct CommitmentAccount {
    pub creator: Pubkey,
    pub commitment_id: [u8; 32],
    pub staking_mode: u8,
    pub stake_amount: u64,
    pub verification_fee: u64,
    pub verifier_type: u8,
    pub oracle_authority: Pubkey,
    pub goal_hash: [u8; 32],
    pub start_time: i64,
    pub end_time: i64,
    pub failure_policy: u8,
    pub penalty_bps: u16,
    pub failure_destination: Pubkey,
    pub status: u8,
    pub evidence_hash: [u8; 32],
    pub result_code: [u8; 32],
    pub is_successful: bool,
    pub settled_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl CommitmentAccount {
    pub const LEN: usize = 32 // creator
        + 32 // commitment_id
        + 1 // staking_mode
        + 8 // stake_amount
        + 8 // verification_fee
        + 1 // verifier_type
        + 32 // oracle_authority
        + 32 // goal_hash
        + 8 // start_time
        + 8 // end_time
        + 1 // failure_policy
        + 2 // penalty_bps
        + 32 // failure_destination
        + 1 // status
        + 32 // evidence_hash
        + 32 // result_code
        + 1 // is_successful
        + 8 // settled_at
        + 1 // bump
        + 1; // vault_bump
}

#[repr(u8)]
pub enum CommitmentStatus {
    Created = 0,
    Funded = 1,
    Active = 2,
    PendingVerification = 3,
    Verified = 4,
    Settled = 5,
    Disputed = 6,
    Cancelled = 7,
}

// -----------------------------------------------------------------------------
// EVENTS
// -----------------------------------------------------------------------------

#[event]
pub struct CommitmentCreatedEvent {
    pub creator: Pubkey,
    pub commitment_id: [u8; 32],
    pub staking_mode: u8,
    pub stake_amount: u64,
    pub verifier_type: u8,
    pub end_time: i64,
}

#[event]
pub struct CommitmentFundedEvent {
    pub commitment_id: [u8; 32],
    pub total_deposited: u64,
    pub funder: Pubkey,
}

#[event]
pub struct VerificationSubmittedEvent {
    pub commitment_id: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub result_code: [u8; 32],
    pub is_successful: bool,
}

#[event]
pub struct CommitmentSettledEvent {
    pub commitment_id: [u8; 32],
    pub is_successful: bool,
    pub settled_at: i64,
}

#[event]
pub struct DisputeOpenedEvent {
    pub commitment_id: [u8; 32],
    pub disputer: Pubkey,
}

// -----------------------------------------------------------------------------
// ERRORS
// -----------------------------------------------------------------------------

#[error_code]
pub enum CommitError {
    #[msg("Stake amount must be greater than zero")]
    InvalidStakeAmount,
    #[msg("End time must be after start time")]
    InvalidTimeframe,
    #[msg("Penalty basis points cannot exceed 10000 (100%)")]
    InvalidPenaltyBps,
    #[msg("Invalid state transition")]
    InvalidStateTransition,
    #[msg("Calculation overflow")]
    MathOverflow,
    #[msg("Unauthorized oracle signer")]
    UnauthorizedOracle,
    #[msg("Commitment is not in verified state ready for settlement")]
    NotReadyForSettlement,
    #[msg("Commitment cannot be disputed at current state")]
    CannotDisputeAtThisState,
    #[msg("Unauthorized account or signature")]
    Unauthorized,
}
