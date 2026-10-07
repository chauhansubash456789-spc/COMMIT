import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('server/verifiers/studyTimerVerifier.js', 'r', encoding='utf-8') as f:
    code = f.read()

old_finish = """    const isSuccessful = session.verifiedActiveSeconds >= session.requiredSeconds;
    const resultCode = isSuccessful ? 'STUDY_PASS' : 'STUDY_FAIL';"""

new_finish = """    const isSuccessful = session.verifiedActiveSeconds >= session.requiredSeconds;
    let resultCode = isSuccessful ? 'STUDY_PASS' : 'STUDY_FAIL';

    if (!isSuccessful) {
      if (!session.walletAddress || session.walletAddress.includes('UNKNOWN')) {
        resultCode = 'STUDY_IDENTITY_MISMATCH';
      } else if (session.focusLostCount >= 10) {
        resultCode = 'STUDY_FOCUS_LOST';
      } else if (session.idleSeconds > session.verifiedActiveSeconds && session.idleSeconds > 60) {
        resultCode = 'STUDY_IDLE_EXCLUDED';
      } else if (session.verifiedActiveSeconds > 14400) {
        resultCode = 'STUDY_MAX_SESSION_REACHED';
      } else {
        resultCode = 'STUDY_FAIL';
      }
    }"""

if old_finish in code:
    code = code.replace(old_finish, new_finish)
    with open('server/verifiers/studyTimerVerifier.js', 'w', encoding='utf-8') as f:
        f.write(code)
    print('Updated studyTimerVerifier.js with granular result codes')
else:
    print('old_finish not found in studyTimerVerifier.js')
