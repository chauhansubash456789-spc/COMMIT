import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('server/verifiers/githubVerifier.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Enhance classifyResultCode
old_classification = """    const verifiedMetric = qualifying.length;
    const isSuccessful = verifiedMetric >= requiredCommits;
    const resultCode = isSuccessful ? 'GH_PASS' : 'GH_FAIL';"""

new_classification = """    const verifiedMetric = qualifying.length;
    const isSuccessful = verifiedMetric >= requiredCommits;
    
    let resultCode = 'GH_FAIL';
    let failureReason = null;

    if (isSuccessful) {
      resultCode = 'GH_PASS';
    } else if (!repoOwner || !repoName) {
      resultCode = 'GH_REPOSITORY_MISMATCH';
      failureReason = 'Invalid repository specifications';
    } else if (!authorUsername) {
      resultCode = 'GH_IDENTITY_MISMATCH';
      failureReason = 'Missing registered author identity';
    } else if (commits.length === 0) {
      resultCode = 'GH_API_ERROR';
      failureReason = 'No commits found or API unreachable';
    } else if (commits.every(c => c.author && c.author.toLowerCase() !== authorUsername.toLowerCase())) {
      resultCode = 'GH_IDENTITY_MISMATCH';
      failureReason = 'Commit author does not match registered GitHub identity';
    } else if (commits.every(c => c.isMerge)) {
      resultCode = 'GH_MERGE_COMMIT';
      failureReason = 'All provided commits are merge commits with no net source changes';
    } else if (seenShas.size === 1 && commits.length > 1) {
      resultCode = 'GH_DUPLICATE_COMMIT';
      failureReason = 'Duplicate git commit SHAs detected';
    } else if (commits.every(c => !c.message || c.message.trim().length <= 3)) {
      resultCode = 'GH_TRIVIAL_COMMIT';
      failureReason = 'Commits classified as trivial or empty';
    } else {
      resultCode = 'GH_FAIL';
      failureReason = `Insufficient qualifying commits: ${verifiedMetric}/${requiredCommits}`;
    }"""

if old_classification in code:
    code = code.replace(old_classification, new_classification)
    with open('server/verifiers/githubVerifier.js', 'w', encoding='utf-8') as f:
        f.write(code)
    print('Updated githubVerifier.js with granular result codes')
else:
    print('old_classification not found in githubVerifier.js')
