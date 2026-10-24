# GNS Class Library — සියලුම වෙනස්කම් එකවර සකස් කරන සිංහල උපදෙස්

මෙම package එකේ කලින් සකස් කළ Login/Register + Google Login, Admin controls, Main Playlist/lesson playlist, Home counters, member counters සහ About page text සියල්ල එකට ඇත. ඔබගේ දැනට තිබෙන Firebase Authentication project එක සහ Firestore video documents වෙනමම පවතී; ZIP එක upload කිරීමෙන් ඒවා මැකෙන්නේ නැහැ.

## A. ZIP එකේ files

`index.html`, `app.js`, `styles.css`, `firestore.rules` සහ setup documentation update කරලා තියෙනවා. `firebase-config.js`, `videos.json`, logo හෝ GitHub Actions workflow එක වෙනස් කළ යුතු නැහැ.

## B. GitHub එකට website files upload කරන්න

1. [GNSCL repository එක](https://github.com/Niwansathsara/GNSCL) විවෘත කරන්න.
2. `index.html`, `app.js`, `styles.css`, `firestore.rules`, `README.md`, `FIREBASE_SETUP_SI.md`, `INSTALL-ALL-CHANGES-SI.md`, `DOMAIN-SETUP-SI.md` files එකින් එක Replace/Upload කර Commit කරන්න.
3. `firebase-config.js` එක දැනටමත් project එකේ තිබෙන config එකයි; domain setup සාර්ථක වන තුරු ඒකේ `authDomain` අගය වෙනස් කරන්න එපා.
4. Repository එකේ `firebase niwan.txt` කියන පැරණි, app එකට අවශ්‍ය නොවන duplicate config file එක තිබේ නම්, GitHub මඟින් එය delete කර Commit කරන්න. App එක import කරන්නේ `firebase-config.js` පමණයි.
5. GitHub Actions workflow එක `main` branch එක publish කරන නිසා commit එකෙන් පසු **Actions** tab එකේ deploy job එක successful ද බලන්න.

## C. Firebase Rules Publish කරන්න

1. [Firestore Rules](https://console.firebase.google.com/project/gnscl-1291a/firestore/rules) විවෘත කරන්න.
2. ZIP එකේ `firestore.rules` file එකේ සම්පූර්ණ code එක Rules editor එකට paste කරන්න.
3. **Publish** ඔබන්න.
4. Rules එකේ Admin email එක සහ `firebase-config.js` හි `adminEmail` එක එකම account එක විය යුතුයි. දැනට තිබෙන `niwansathsara76@gmail.com` address එක වෙනස් කරන්න අවශ්‍ය නැතිනම් එසේම තබන්න.

## D. Login කිරීමට කලින් Home page එකේ සැබෑ library counts පෙන්වන්න

- `Videos in library` සහ `Subjects covered` සඳහා `publicStats/library` කියන Firestore document එකේ **ගණන් පමණක්** public-read වෙයි. Video title, YouTube URL, Email හෝ user UID එම public summary එකේ නොගබඩා කරයි.
- Rules Publish කරලා පසුව, website එකට Admin Google account එකෙන් එක් වරක් sign in කරන්න. Code එක දැනට තිබෙන `videos` collection එක කියවලා video count සහ subject count summary එකට ලියයි.
- එම first admin sign-in/initial load එක අවසන් වූ පසුව sign out හෝ Incognito window එකෙන් site එක බලන්න. එවිට login නොවූ අයටත් actual video/subject counts පෙන්විය යුතුයි. Summary එක මුලින්ම තවම හදලා නැත්නම් seed කරන තුරු `—` පෙන්වීම සාමාන්‍යයි.
- `Saved for later` කියන්නේ එම browser/device එකේ `localStorage` තුළ save කර ඇති videos ගණනයි. අලුත් browser එකක 0 පෙන්වීම සාමාන්‍යයි; මේක සියලුම users ගේ combined count එකක් නොවේ.

## E. Live Online සහ Total Registered counters

මෙම Home section එකේ member counters තබා ඇත. වර්තමාන code එක අනුව ඒවා sign in වී සිටින පරිශීලකයන්ට පෙන්වයි; Email ලිපින Firestore counter records වලට copy නොකරයි.

- Live Online කියන්නේ පසුගිය තත්පර 90ක් තුළ heartbeat update වූ unique signed-in accounts ගණනයි. Tab එක close කළ පසු ගණන අඩුවීමට කෙටි ප්‍රමාදයක් තිබිය හැකියි.
- Total Registered එක `libraryUsers` collection එකේ counter record එකක් ඇති unique account ගණනයි. Deployment එකට පෙර තිබුණු users ලාට counter එකට ඇතුළත් වීමට deployment එකෙන් පසු අවම වශයෙන් එක් වරක් sign in විය යුතුයි. පැරණි Auth accounts සියල්ලම වහාම backfill කිරීමට trusted Admin SDK/Cloud Function අවශ්‍යයි.

## F. About page

About පිටුවේ නව කොටස් මේ අනුපිළිවෙළට පෙන්වයි: student-built/free learning project → රතු පැහැයෙන් content ownership notice → A/L සඳහා resources භාවිත කරන උපදෙස් → කලින් About note/creator card එක අවසානයේ. කලින් තිබුණු note එකේ වචන වෙනස් කර නැත.

## G. Branded Firebase URL (`gnscl.firebaseapp.com`)

`gnscl-1291a` Project ID එක පවතින project එකේම තබාගන්න. ඒ Project ID එක rename කිරීම වෙනුවට එකම project එකට අමතර Firebase Hosting site එකක් `gnscl` නමින් සෑදීමට උත්සාහ කරන්න. එම site ID එක Firebase තුළ වෙනත් අයෙකු භාවිත කරන්නේ නැත්නම් `gnscl.firebaseapp.com` ලබාගත හැකියි. එය සාර්ථකව create කර domain එක ක්‍රියාත්මක වූ පසුව පමණක් `firebase-config.js` හි `authDomain` line එක පහත පරිදි වෙනස් කරන්න:

```js
authDomain: "gnscl.firebaseapp.com",
```

ඉන්පසු Firebase Authentication → Settings → Authorized domains හි `gnscl.firebaseapp.com` සහ website එකේ GitHub Pages hostname එකත් ඇතුළත් බව තහවුරු කරන්න. Google sign-in සඳහා අවශ්‍ය redirect/authorized domain settings ද Firebase/Google provider setup එකට ගැළපෙන බව පරීක්ෂා කරන්න. Site ID `gnscl` ලබාගන්න බැරි නම්, වෙනත් available site ID එකක් තෝරන්න; එවිට එයට ගැළපෙන `.firebaseapp.com` domain එක යොදාගත යුතුයි. Site එක සාර්ථකව හදන තුරු `authDomain` වෙනස් කළොත් Google Login බිඳෙන්න පුළුවන්.

Official guidance: https://firebase.google.com/docs/hosting/multisites and https://firebase.google.com/docs/projects/learn-more

## H. Branded GitHub Pages URL (`gnscl.github.io/GNSCL/`)

ඔබ සඳහන් කළ `http://GNSCL.github.oi/GNSCL/` ලිපිනයේ `.oi` වැරදි; අවශ්‍ය නම් නිවැරදි URL එක `https://gnscl.github.io/GNSCL/` වේ. මේ URL එක HTML/CSS code එකෙන් පමණක් සකස් කළ නොහැකියි. GitHub Pages URL එක repository එකේ owner/account/organization නම අනුව තීරණය වෙයි.

1. ඔබට `GNSCL` නමින් GitHub organization එකක් සාදන්න පුළුවන්ද බලන්න (නම available විය යුතුයි). පුද්ගලික GitHub username එක වෙනස් කිරීමට වඩා මෙය වෙන් වූ project organization එකක් ලෙස තබාගන්න පුළුවන්.
2. Organization එක නිර්මාණය කළ පසු `Niwansathsara/GNSCL` repository එකේ Settings → General → Danger Zone → Transfer ownership මඟින් repository එක `GNSCL` organization එකට transfer කරන්න. Transfer කිරීමට පෙර backup එකක් තබාගන්න; existing repository/Pages URL එක වෙනස් විය හැකියි.
3. නව repository එකේ Settings → Pages තුළ GitHub Actions publishing enabled බවත් `main` branch workflow successful බවත් පරීක්ෂා කරන්න.
4. Firebase Authentication → Settings → Authorized domains තුළ `gnscl.github.io` add කරන්න. නව website URL එක වැඩ කරන බව තහවුරු කරන තුරු පැරණි URL එකෙන් අතුරුදහන් වුණා කියලා සිතන්න එපා.

Official guidance: https://docs.github.com/pages/getting-started-with-github-pages/what-is-github-pages

## I. අවසාන පරීක්ෂාව

1. Home page එක signed-out/Incognito browser එකකින් බලන්න.
2. Admin Google account එකෙන් එක් වරක් sign in වෙලා public library summary එක seed කරන්න.
3. නැවත sign out කර Home counters බලන්න.
4. සාමාන්‍ය test account එකකින් Library, Login/Register, Google sign-in, About, Save for later පරීක්ෂා කරන්න.
5. Admin account එකෙන් Add/Delete පරීක්ෂා කරන්න. සාමාන්‍ය user account එකට Admin බලතල නොලැබිය යුතුයි.
6. URL domains වෙනස් කරන සියලු පියවර Firebase/ GitHub Console settings මඟින් වෙන වෙනම කරලා login test කළ පසුවයි current production link share කරන්න.

**දත්ත සුරැකීම:** Firestore එකේ තිබෙන existing `videos` documents වෙනස් කරන්න හෝ delete කරන්න අවශ්‍ය නැහැ. `videos.json` file එකේ contents වන්නේ cloud Firestore database එක නොවේ; Firebase video records එම database එකේම පවතී.
