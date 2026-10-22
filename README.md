# GNS Class Library — admin-only publishing

Modern light-themed responsive static website for GitHub Pages. Public visitors can view the shared catalogue; only the Google account configured in Firebase can add/import/export/delete lesson links.

## Files
- `index.html` — page structure
- `styles.css` — design and responsive styling
- `app.js` — library UI, Firebase Auth and Firestore integration
- `firebase-config.js` — Firebase project values are prefilled; replace the admin email before deploying
- `firestore.rules` — copy into Firebase Console → Firestore Database → Rules, after replacing the admin email
- `gns-logo.svg` — GNS logo
- `FIREBASE_SETUP_SI.md` — full Sinhala setup instructions

## Important
This static version must be connected to Firebase before admin publishing works. Replace placeholders in `firebase-config.js`; replace the same admin email placeholder in `firestore.rules`; enable Google sign-in; create Firestore; publish the rules; authorize the GitHub Pages hostname. Never publish permissive `allow write: if true` rules. Videos themselves remain hosted on YouTube; only metadata and URLs are stored.
