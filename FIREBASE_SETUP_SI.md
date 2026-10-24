# GNS Class Library — Login/Register සහ Admin setup (සිංහල)

මෙම version එකේ මුල් Home පිටුව සහ About පිටුව account එකක් නැතිව බලන්න පුළුවන්. **Class Library** වෙත යාමට Email/Password හෝ Google account එකකින් sign in/register විය යුතුයි. Login වූ පසු Home පිටුවේ `Explore the library` නැවත ඔබලා collection එක විවෘත කරන්න. සාමාන්‍ය පරිශීලකයන්ට videos බලන්න පුළුවන්; video Add/Import/Export/Delete බලතල ලබා දෙන්නේ Firebase හි allowlist කර ඇති Admin Google account එකට පමණයි.

## 1. Firebase Authentication

1. Firebase Console තුළ දැනට ඇති `GNSCL` / `gnscl-1291a` project එක විවෘත කරන්න.
2. **Authentication → Sign-in method** වෙත යන්න.
3. **Email/Password** provider එක enable කර **Save** කරන්න.
4. **Google** provider එකත් enable කර project support email එක තෝරා **Save** කරන්න.
5. **Authentication → Settings → Authorized domains** තුළ `niwansathsara.github.io` තිබෙන බව තහවුරු කරන්න. නැත්නම් add කරන්න.

## 2. Firestore access rules — අත්‍යවශ්‍ය

1. Firebase Console → **Firestore Database → Rules** යන්න.
2. Repository එකේ `firestore.rules` file එකේ සම්පූර්ණ අන්තර්ගතය Rules editor එකට paste කරන්න.
3. **Publish** ඔබන්න. GitHub එකට `firestore.rules` upload කිරීමෙන් Firebase rules ස්වයංක්‍රීයව publish වෙන්නේ නැහැ.
4. `firebase-config.js` හි `adminEmail` අගය සහ `firestore.rules` හි `isSiteAdmin()` email අගය එකම Admin Google email එක විය යුතුයි. Admin email එක නොවෙනස් කරන්නේ නම් ඒවා වෙනස් කරන්න අවශ්‍ය නැහැ.

මෙම rules මඟින් Firestore video records කියවීමට sign-in අවශ්‍ය කරයි. Create/update/delete සඳහා verified Admin email එක පමණක් අවසර ලබයි. Rules එකේ `allow read: if request.auth != null;` සහ `isSiteAdmin()` කොටස් ඉවත් නොකරන්න.

## 3. GitHub Pages files update කිරීම

Repository එකේ root එකට ZIP එකේ files extract කර, වෙනස් වූ files replace කර commit කරන්න. Website එක සඳහා වැදගත් files:

- `index.html`
- `app.js`
- `styles.css`
- `firestore.rules` (Firebase Console එකේත් publish කළ යුතුයි)
- `FIREBASE_SETUP_SI.md`, `README.md` (setup උපදෙස්)

`firebase-config.js`, `gns-logo.svg` සහ `videos.json` ගොනුත් repository එකේ තබාගන්න. `firebase-config.js` හි දැනට තිබෙන project values වෙනත් project එකකට මාරු නොකරන්න. Firestore cloud collection එකේ දැනට තිබෙන videos මේ ZIP එකේ `videos.json` ගොනුවට පිටපත් නොවේ; ඒවා Firestore තුළම පවතිනවා.

Commit කරලා `https://niwansathsara.github.io/GNSCL/` open කර `Ctrl + F5` ඔබන්න.

## 4. පරීක්ෂා කිරීම

1. Sign out කරලා website එක refresh කරන්න. Home page එක පෙන්විය යුතුයි; Library/Subjects වෙත හෝ `Explore the library` වෙත ගිය විට Login/Register window එක පෙන්විය යුතුයි.
2. Email/Password වලින් register/login කරන්න, නැතිනම් **Continue with Google** භාවිත කරන්න. Login එකෙන් පසු profile icon එක පෙන්විය යුතුයි; `Explore the library` නැවත ඔබද්දී Main Playlist cards පෙන්විය යුතුයි.
3. About link එක වෙනම About view එක විවෘත කළ යුතුයි.
4. සාමාන්‍ය account එකකින් sign in කරද්දී Add/Import/Export/Delete controls නොපෙන්විය යුතුයි.
5. Admin Google account එකෙන් sign in වුණාම Admin controls පෙන්විය යුතුයි. Upload/delete permissions Firestore rules වලින්ද ආරක්ෂා කර ඇත.

## වැදගත් ආරක්ෂක කරුණු

- Firebase Web App config එක client-side code එකේ තිබීම සාමාන්‍යයි; නමුත් Firestore rules ආරක්ෂිතව publish කළ යුතුයි.
- Class Library videos සඳහා `request.auth != null` කියවීමේ නියමය නිසා sign-in අත්‍යවශ්‍යයි. Signed-in users හට library metadata සහ video links බලන්න පුළුවන්.
- YouTube videos මෙහි upload කරන්නේ නැහැ; වීඩියෝ YouTube මතම තිබෙන අතර මෙහි save වන්නේ link සහ metadata පමණයි. Private/restricted class recordings share කිරීමට පෙර අවසර ලබාගන්න.
