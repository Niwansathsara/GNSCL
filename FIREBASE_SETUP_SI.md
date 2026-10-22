# GNS Class Library — admin-only upload setup (සිංහල)

මෙම version එකේ website එක ඕනෑම කෙනෙකුට බලන්න පුළුවන්. Video එකක් add/delete කරන්න පුළුවන් ඔබගේ Google account email එකට පමණයි. ඒ අවසරය Firestore Security Rules මඟින් enforce කරනවා; button hide කරන එක මත පමණක් රඳා නොපවතී. YouTube video එක YouTube මතම තිබෙන අතර මෙහි save වන්නේ link සහ විස්තර පමණයි.

## 1. Firebase project එකක් හදන්න
1. https://console.firebase.google.com/ වෙත ගොස් Google account එකෙන් sign in කරන්න.
2. **Create a project / Add project** තෝරන්න. Project එකකට නමක් දෙන්න (උදා: `gns-class-library`) සහ project එක සාදන්න. Analytics අවශ්‍ය නැත්නම් disable කළ හැකියි.
3. Project overview තුළ **Web (</>)** icon එක තෝරලා web app එකක් register කරන්න.
4. Firebase පෙන්වන config object එකේ `apiKey`, `authDomain`, `projectId`, `appId` values ගන්න.
5. මෙම package එකේ `firebase-config.js` තුළ screenshot එකේ Firebase project values දැනටමත් ඇතුළත් කරලා තියෙනවා. `adminEmail` එකට videos upload කරන්න භාවිතා කරන exact Google email එක දාන්න.

## 2. Google sign-in enable කරන්න
1. Firebase Console → **Authentication** → **Get started** → **Sign-in method** යන්න.
2. **Google** provider එක enable කරලා project support email එක තෝරන්න, save කරන්න.
3. Authentication → **Settings** → **Authorized domains** තුළ `niwansathsara.github.io` තියෙන බව බලන්න. නැත්නම් add කරන්න. ඔබේ GitHub Pages hostname වෙනස් නම් ඒ hostname එකම add කරන්න.

## 3. Firestore database සහ permissions
1. Firebase Console → **Firestore Database** → **Create database** යන්න. Production mode තෝරන්න. Location එක තෝරලා create කරන්න.
2. Firestore → **Rules** tab එක open කරන්න.
3. මේ folder එකේ `firestore.rules` file එකේ `YOUR_GOOGLE_EMAIL@gmail.com` යන placeholder එක occurrences දෙකක් තිබෙනවා. දෙකම `firebase-config.js` තුළ දැමූ exact Google email එකෙන් replace කරන්න.
4. ඒ file එකේ සම්පූර්ණ rules copy කර Firestore Console → Rules editor එකට paste කරලා **Publish** කරන්න. GitHub එකට file එක upload කිරීමෙන් rules auto-deploy වෙන්නේ නැහැ; Console එකේ Publish කිරීම අත්‍යවශ්‍යයි.

## 4. GitHub Pages එක update කරන්න
ඔබේ `GNSCL` repository root එකට මෙම version එකේ files upload/replace කරන්න:
- `index.html`
- `styles.css`
- `app.js`
- `firebase-config.js`
- `gns-logo.svg`

`firestore.rules`, `FIREBASE_SETUP_SI.md`, `README.md` repository එකේ තබාගන්න පුළුවන්; website display සඳහා rules file එක browser එකෙන් භාවිතා නොවේ. Commit changes කරලා `https://niwansathsara.github.io/GNSCL/` open කර `Ctrl + F5` කරන්න.

## 5. Test කරන්න
- Website එක සාමාන්‍ය visitor විදිහට open කරන්න: videos බැලීමට පුළුවන්, **Add a video** / import / export buttons නොපෙන්විය යුතුයි.
- **Admin login** click කරලා setup එකේ දාපු exact Google account එකෙන් sign in වෙන්න. එවිට Add, Import, Export සහ Delete controls පෙන්විය යුතුයි.
- වෙනත් Google account එකකින් sign in කරන්න උත්සාහ කළොත් access ලබා නොදේ. Firestore rules එකත් ඒ account එකේ writes deny කරනවා.
- Video add කළ පසු එය Firestore තුළ save වෙනවා; වෙනත් visitor කෙනෙකුට page එක refresh නොකරම list එක update වෙන්න පුළුවන්.

## වැදගත් ආරක්ෂක කරුණු
- `firebase-config.js` තුළ Firebase web config public වීම සාමාන්‍ය දෙයක්. **Firestore rules** තමයි writes ආරක්ෂා කරන්නේ. Admin email එක `firebase-config.js` සහ `firestore.rules` දෙකේම එකම විය යුතුයි.
- `firestore.rules` වල `allow write: if true` හෝ test-mode public writes භාවිතා කරන්න එපා.
- Firebase no-cost quota/usage limits apply; Firebase Console → Usage and billing කොටසෙන් usage monitor කරන්න. Quota limit ඉක්මэрුවොත් service errors ඇතිවිය හැකියි.
- Public video catalogue එක public read නිසා video links/metadata ඕනෑම කෙනෙකුට බලන්න පුළුවන් බව සැලකිල්ලට ගන්න. Private class recordings share කරන්න කලින් අවසර ගන්න.
- Admin account email එක අන් අය සමඟ බෙදාගන්න එපා; Google account එකට strong security/2-Step Verification භාවිතා කරන්න.
