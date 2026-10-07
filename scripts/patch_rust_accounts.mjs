import fs from 'fs';

let content = fs.readFileSync('programs/commit-protocol/src/lib.rs', 'utf8');

const target = `#[derive(Accounts)]
pub struct OpenDispute<'info> {
    #[account(
        mut,
        seeds = [b"commitment", commitment.commitment_id.as_ref()],
        bump = commitment.bump
    )]
    pub commitment: Account<'info, CommitmentAccount>,

    pub creator: Signer<'info>,
}`;

const replacement = `${target}

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

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('programs/commit-protocol/src/lib.rs', content, 'utf8');
  console.log('Successfully added ActivateCommitment and ResolveDispute account contexts!');
} else {
  console.error('Target OpenDispute not matched');
}
