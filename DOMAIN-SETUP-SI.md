# Domain names — සිංහලෙන්

## 1. Firebase auth domain

ඔබගේ දැනට ඇති Firebase Project ID `gnscl-1291a` එක provision වීමෙන් පසු rename කළ නොහැක. Firebase Project ID එක සහ Firebase Hosting site ID එක වෙනස් දේවල්. එම project එක ඇතුළේ වෙනත් Hosting site එකක් `gnscl` නමින් create කළ හැකියි, නමුත් `gnscl` global unique විය යුතුයි. එය ලබාගත හැකි නම් `https://gnscl.firebaseapp.com` සහ `https://gnscl.web.app` ලිපින ලබාගත හැකියි.

**කරන පිළිවෙළ:** Firebase Console → Hosting → Add another site (හෝ create site) → `gnscl` site ID. Create සාර්ථක වූ පසුව `firebase-config.js` එකේ පමණක් `authDomain` line එක `gnscl.firebaseapp.com` ලෙස වෙනස් කරන්න. Authentication → Settings → Authorized domains තුළ අදාළ hostnames add කරලා Google login පරීක්ෂා කරන්න. Site ID එක unavailable නම් `.firebaseapp.com` අවසානයට ඔබට කැමති නම පමණක් දාන්න බැහැ; වෙනත් available site ID එකක් තෝරන්න.

**මෙම package එකේ active config එක දැනට පවතින `gnscl-1291a.firebaseapp.com` අගයම තබාගෙන ඇත** — අලුත් hosting site එක create කරලා නොමැතිව authDomain මාරු කළොත් Login වැඩ නොකරන්න පුළුවන් නිසා.

## 2. GitHub Pages URL

`github.oi` typo එකක්; extension එක `github.io`. ඔබගේ වර්තමාන personal account එකෙන් URL එක `https://niwansathsara.github.io/GNSCL/` වේ. `https://gnscl.github.io/GNSCL/` ලබාගැනීමට GitHub account/organization owner එක `GNSCL` විය යුතුයි. Repository එකේ HTML ගොනුවේ නම වෙනස් කිරීමෙන් මෙය ලබාගන්න බැහැ.

අඩු අවදානම් ක්‍රමය වන්නේ `GNSCL` organization එක available නම් එය සාදා repository එක එයට transfer කිරීමයි. Transfer කිරීමට පෙර repository backup එකක් ගන්න. Transfer එකෙන් repository ownership සහ URL වෙනස් වන නිසා, transfer පසුව Settings → Pages සහ Actions deploy job සාර්ථකද කියලා තහවුරු කරන්න. අලුත් hostname එක Firebase Authentication → Settings → Authorized domains තුළ add කරන්න.
