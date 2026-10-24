# GNS Class Library — admin-only publishing

Modern light-themed responsive static website for GitHub Pages. The Home and About views are public. Users must sign in with Email/Password or Google before entering the library; only the authorised Google account can add/import/export/delete lesson links.

## Files
- `index.html` — page structure
- `styles.css` — design and responsive styling
- `app.js` — library UI, Firebase Auth and Firestore integration
- `firebase-config.js` — Firebase project values are prefilled; replace the admin email before deploying
- `firestore.rules` — copy into Firebase Console → Firestore Database → Rules, after replacing the admin email
- `gns-logo.svg` — GNS logo
- `FIREBASE_SETUP_SI.md` — full Sinhala setup instructions

## Important
- Library access is gated by Firebase Authentication. Make sure Email/Password and Google providers are enabled, and publish `firestore.rules` in Firebase Console (GitHub Pages does not deploy Firestore rules automatically).
This static version must be connected to Firebase before authentication and admin publishing work. Enable Email/Password and Google sign-in, make sure the GitHub Pages hostname is authorized, and publish `firestore.rules` in Firebase Console. Library reads require authentication; video writes require the verified, allowlisted admin email. Never publish permissive public write rules. Videos remain hosted on YouTube; only metadata and URLs are stored.
