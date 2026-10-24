# GNS Class Library

A light, student-built class-video library for organising teacher lesson links and playlists. The site uses Firebase Authentication and Cloud Firestore. Videos remain hosted on their original YouTube pages.

## Key files
- `index.html`: Home, Login/Register, Library and About views. About includes the free-education purpose, a red content ownership notice, A/L study guidance, and the original About note at the bottom.
- `styles.css`: design and responsive styling.
- `app.js`: Email/Password and Google sign-in, Library and playlists, Admin controls, public Home library summary, and signed-in member counters.
- `firebase-config.js`: client-side Firebase web configuration. Leave the current `authDomain` until an alternate Firebase Hosting site is successfully created.
- `firestore.rules`: publish its exact contents in Firebase Console → Firestore Database → Rules.
- `INSTALL-ALL-CHANGES-SI.md`: Sinhala deployment guide for all requested changes.
- `DOMAIN-SETUP-SI.md`: Firebase/GitHub Pages naming limitations and setup steps.

## Home-page counts
`Videos in library` and `Subjects covered` read only aggregate counts from Firestore document `publicStats/library`, so the real values can be shown before login without publishing video titles, URLs, emails, or user IDs. The authorised Admin account seeds/refreshes this document after login by reading the existing videos collection. `Saved for later` is the count stored locally in that visitor's browser, not a global total.

`Live online now` and `Total registered accounts` member counters are shown to signed-in users. Presence records contain only Firebase UIDs and timestamps. Historical Authentication accounts enter the `libraryUsers` counter registry when they sign in after this feature is deployed; an Admin SDK backfill is required to count dormant old accounts immediately.

## Publish
Use GitHub Pages and publish `main`. Separately publish `firestore.rules` through the Firebase Console; uploading the Rules file to GitHub does not publish the rules. Follow `INSTALL-ALL-CHANGES-SI.md` before changing the auth domain or transferring the repository to a new GitHub organization.
