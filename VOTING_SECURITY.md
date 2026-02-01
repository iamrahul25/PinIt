# Voting – Authenticated Users

Voting is tied to **logged-in users** (Firebase Authentication).

- Each user can cast one upvote or one downvote per pin (by Firebase UID).
- Device fingerprint and IP-based voting have been removed in favor of login/signup.
- Voting, comments, and “reported by” name use the authenticated account (uid, displayName/email).

See the app’s Login/Signup flow and `backend/routes/votes.js` for implementation details.
