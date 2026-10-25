import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { firebaseConfig, adminEmail } from "./firebase-config.js";

(() => {
  'use strict';

  const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const firebaseConfigured = requiredConfigKeys.every((key) => {
    const value = String(firebaseConfig?.[key] || '').trim();
    return value && !/PASTE_|YOUR_PROJECT_ID|YOUR_/i.test(value);
  }) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(adminEmail || '').trim())
    && !/YOUR_GOOGLE_EMAIL/i.test(String(adminEmail || ''));
  const normalizedAdminEmail = String(adminEmail || '').trim().toLowerCase();
  let firebaseApp = null;
  let auth = null;
  let db = null;
  if (firebaseConfigured) {
    firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
  }

  const VIDEO_STORAGE = 'gns-class-library-local-v1';
  const SAVED_STORAGE = 'gns-class-library-saved-v1';
  const SUBJECT_ORDER = ['Physics', 'Chemistry', 'Biology', 'Combined Maths', 'ICT', 'English', 'Other'];
  const SUBJECT_ART = {
    'Physics': { cls: 'thumb-physics', symbol: '∑' },
    'Chemistry': { cls: 'thumb-chemistry', symbol: '⚗' },
    'Biology': { cls: 'thumb-biology', symbol: '⌬' },
    'Combined Maths': { cls: 'thumb-maths', symbol: '∫' },
    'ICT': { cls: 'thumb-other', symbol: '</>' },
    'English': { cls: 'thumb-other', symbol: 'Aa' },
    'Other': { cls: 'thumb-other', symbol: '✦' }
  };

  const els = {
    videoGrid: document.getElementById('videoGrid'),
    emptyState: document.getElementById('emptyState'),
    search: document.getElementById('searchInput'),
    sort: document.getElementById('sortSelect'),
    filters: document.getElementById('subjectFilters'),
    resultsLabel: document.getElementById('resultsLabel'),
    clearFilters: document.getElementById('clearFilters'),
    favoritesToggle: document.getElementById('favoritesToggle'),
    allCount: document.getElementById('allCount'),
    statVideos: document.getElementById('statVideos'),
    statSubjects: document.getElementById('statSubjects'),
    statSaved: document.getElementById('statSaved'),
    statOnline: document.getElementById('statOnline'),
    statRegistered: document.getElementById('statRegistered'),
    memberStatsNoteText: document.getElementById('memberStatsNoteText'),
    addModal: document.getElementById('addModal'),
    addForm: document.getElementById('addVideoForm'),
    formError: document.getElementById('formError'),
    playerModal: document.getElementById('playerModal'),
    videoFrame: document.getElementById('videoFrame'),
    videoPasswordModal: document.getElementById('videoPasswordModal'),
    videoPasswordForm: document.getElementById('videoPasswordForm'),
    videoUnlockPassword: document.getElementById('videoUnlockPassword'),
    videoPasswordError: document.getElementById('videoPasswordError'),
    videoPasswordVideoTitle: document.getElementById('videoPasswordVideoTitle'),
    toast: document.getElementById('toast'),
    toastText: document.getElementById('toastText'),
    importFile: document.getElementById('importFile'),
    userAuthBtn: document.getElementById('userAuthBtn'),
    userAccountWrap: document.getElementById('userAccountWrap'),
    userAccountBtn: document.getElementById('userAccountBtn'),
    userAccountAvatar: document.getElementById('userAccountAvatar'),
    userAccountDropdown: document.getElementById('userAccountDropdown'),
    userAccountEmail: document.getElementById('userAccountEmail'),
    userSignOutBtn: document.getElementById('userSignOutBtn')
  };

  let sharedVideos = [];
  let currentUser = null;
  let isAdmin = false;
  let firestoreUnsubscribe = null;
  let publicLibraryStatsUnsubscribe = null;
  let publicLibraryStats = null;
  let hasLoadedSharedVideos = false;
  let registeredUsersUnsubscribe = null;
  let presenceUnsubscribe = null;
  let presenceHeartbeatTimer = null;
  let presenceRefreshTimer = null;
  let memberStatsUid = null;
  let registeredAccountsCount = null;
  let presenceRecords = [];
  const PRESENCE_ACTIVE_WINDOW_MS = 90 * 1000;
  let localVideos = readJSON(VIDEO_STORAGE, []);
  if (!Array.isArray(localVideos)) localVideos = [];
  let saved = new Set(readJSON(SAVED_STORAGE, []));
  const openPlaylists = new Set();
  let activePlaylistKey = null;
  let activeMainCategoryKey = null;
  let activeSubjectModal = null;
  let selectedSubject = 'all';
  let onlySaved = false;
  let toastTimer;
  let lastFocus = null;
  let pendingPasswordVideo = null;
  let currentPage = 'home';
  let activeNavTarget = 'home';
  let pendingPageAfterAuth = null;
  let pendingSubjectAfterAuth = null;
  let pendingFromInitialHash = false;
  let userInitiatedAuthInProgress = false;
  let pageBeforeAuthModal = 'home';

  function readJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed === null ? fallback : parsed;
    } catch (_) { return fallback; }
  }

  function storeLocalVideos() {
    try { localStorage.setItem(VIDEO_STORAGE, JSON.stringify(localVideos)); }
    catch (_) { notify('Browser storage is full. Export your library to keep a copy.'); }
  }

  function storeSaved() {
    try { localStorage.setItem(SAVED_STORAGE, JSON.stringify([...saved])); } catch (_) { /* Optional preference. */ }
  }

  function getAllVideos() {
    const source = firebaseConfigured ? sharedVideos : [...sharedVideos, ...localVideos];
    const ids = new Set();
    return source.filter((video) => {
      if (!video || !video.id || ids.has(video.id)) return false;
      ids.add(video.id);
      return true;
    }).map((video) => ({ ...video, isLocal: !firebaseConfigured && localVideos.some((local) => local.id === video.id) }));
  }

  async function loadSharedVideos() {
    // Before Firebase is configured, keep public videos.json compatibility for an existing static site.
    // In the secured version, Firestore is the shared source of truth.
    if (firebaseConfigured) return;
    try {
      const response = await fetch(`videos.json?v=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) sharedVideos = data.map(normalizeVideo).filter(Boolean);
      }
    } catch (_) { /* Expected when opened straight from the file system. */ }
    render();
  }

  function startPublicLibraryStatsListener() {
    if (!db || publicLibraryStatsUnsubscribe) return;
    // Only this aggregate document is publicly readable; it contains counts, not video records or emails.
    publicLibraryStatsUnsubscribe = onSnapshot(doc(db, 'publicStats', 'library'), (snapshot) => {
      publicLibraryStats = snapshot.exists() ? snapshot.data() : null;
      render();
    }, (error) => {
      console.error('Public library summary could not load:', error);
      publicLibraryStats = null;
      render();
    });
  }

  async function publishPublicLibraryStats(videos = sharedVideos) {
    if (!db || !isAdmin) return;
    const subjects = new Set(
      videos.map((video) => String(video.subject || 'Other').trim()).filter(Boolean)
    );
    try {
      // Publish counts only. Never place titles, URLs, account IDs, or email addresses in this public document.
      await setDoc(doc(db, 'publicStats', 'library'), {
        videoCount: videos.length,
        subjectCount: subjects.size,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Could not update public library counters:', error);
    }
  }

  function startFirestoreListener() {
    if (!db || !currentUser) return;
    if (firestoreUnsubscribe) {
      if (isAdmin && hasLoadedSharedVideos) {
        publishPublicLibraryStats(sharedVideos);
      }
      return;
    }
    firestoreUnsubscribe = onSnapshot(collection(db, 'videos'), (snapshot) => {
      sharedVideos = snapshot.docs.map((item) => normalizeVideo({ ...item.data(), id: item.id })).filter(Boolean);
      hasLoadedSharedVideos = true;
      render();
      // An authorised Admin's first load also seeds the public summary with the existing real counts.
      if (isAdmin) publishPublicLibraryStats(sharedVideos);
    }, (error) => {
      console.error('Firestore read failed:', error);
      notify('Could not load the shared library. Check Firebase Firestore rules and setup.');
    });
  }

  function stopFirestoreListener() {
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
      firestoreUnsubscribe = null;
    }
    sharedVideos = [];
    hasLoadedSharedVideos = false;
  }

  function updateMemberStats() {
    if (!els.statOnline || !els.statRegistered || !els.memberStatsNoteText) return;

    // The member-count panel and its underlying records are admin-only.
    if (!currentUser || !isAdmin || !db) {
      els.statOnline.textContent = '—';
      els.statRegistered.textContent = '—';
      els.memberStatsNoteText.textContent = 'Member counts are available to the site administrator only.';
      return;
    }

    const cutoff = Date.now() - PRESENCE_ACTIVE_WINDOW_MS;
    const activeUserIds = new Set();
    presenceRecords.forEach((record) => {
      const lastSeenMillis = record.lastSeen && typeof record.lastSeen.toMillis === 'function'
        ? record.lastSeen.toMillis()
        : 0;
      if (lastSeenMillis >= cutoff) activeUserIds.add(record.uid);
    });

    els.statOnline.textContent = String(activeUserIds.size);
    els.statRegistered.textContent = registeredAccountsCount === null
      ? '…'
      : String(registeredAccountsCount);
    els.memberStatsNoteText.textContent = 'Live count updates while signed-in members use the website.';
  }

  async function writePresenceHeartbeat(userId) {
    if (!db || !userId || !currentUser || currentUser.uid !== userId) return;
    if (document.visibilityState !== 'visible') return;
    await setDoc(doc(db, 'sitePresence', userId), {
      lastSeen: serverTimestamp()
    }, { merge: true });
  }

  function startAdminMemberCountListeners(user) {
    if (!isAdmin || !db || !user || !currentUser || currentUser.uid !== user.uid) return;

    if (!registeredUsersUnsubscribe) {
      registeredUsersUnsubscribe = onSnapshot(collection(db, 'libraryUsers'), (snapshot) => {
        registeredAccountsCount = snapshot.size;
        updateMemberStats();
      }, (error) => {
        console.error('Registered-account counter failed:', error);
        els.memberStatsNoteText.textContent = 'Registered count unavailable. Check Firestore Rules.';
      });
    }

    if (!presenceUnsubscribe) {
      presenceUnsubscribe = onSnapshot(collection(db, 'sitePresence'), (snapshot) => {
        presenceRecords = snapshot.docs.map((item) => ({
          uid: item.id,
          lastSeen: item.data().lastSeen || null
        }));
        updateMemberStats();
      }, (error) => {
        console.error('Online-presence counter failed:', error);
        els.memberStatsNoteText.textContent = 'Live count unavailable. Check Firestore Rules.';
      });
    }

    if (!presenceRefreshTimer) {
      // Recalculate locally so inactive sessions expire even if no Firestore document changes.
      presenceRefreshTimer = setInterval(updateMemberStats, 10000);
    }
  }

  function stopMemberStats() {
    if (registeredUsersUnsubscribe) {
      registeredUsersUnsubscribe();
      registeredUsersUnsubscribe = null;
    }
    if (presenceUnsubscribe) {
      presenceUnsubscribe();
      presenceUnsubscribe = null;
    }
    if (presenceHeartbeatTimer) {
      clearInterval(presenceHeartbeatTimer);
      presenceHeartbeatTimer = null;
    }
    if (presenceRefreshTimer) {
      clearInterval(presenceRefreshTimer);
      presenceRefreshTimer = null;
    }
    memberStatsUid = null;
    registeredAccountsCount = null;
    presenceRecords = [];
    updateMemberStats();
  }

  async function startMemberStats(user) {
    if (!db || !user) return;

    if (memberStatsUid === user.uid) {
      writePresenceHeartbeat(user.uid).catch((error) => {
        console.warn('Could not refresh online presence:', error);
      });
      // The same account may become verified/admin after an auth token refresh.
      if (isAdmin) startAdminMemberCountListeners(user);
      return;
    }

    stopMemberStats();
    memberStatsUid = user.uid;
    registeredAccountsCount = null;
    updateMemberStats();

    try {
      // Store only the Firebase UID as the document ID and a timestamp. No email is copied into Firestore.
      // A user can write only their own UID document; only Admin can list/read the collection.
      // Merge avoids adding duplicate records and the collection size counts unique accounts.
      await setDoc(doc(db, 'libraryUsers', user.uid), {
        createdAt: serverTimestamp()
      }, { merge: true });
      await writePresenceHeartbeat(user.uid);
    } catch (error) {
      console.error('Could not initialise member counters:', error);
      if (isAdmin) {
        els.memberStatsNoteText.textContent = 'Member counts could not load. Check Firestore Rules and try again.';
      }
    }

    if (memberStatsUid !== user.uid || !currentUser || currentUser.uid !== user.uid) return;

    // Every signed-in account contributes a UID-only presence heartbeat. Only Admin subscribes to all records.
    if (isAdmin) startAdminMemberCountListeners(user);

    presenceHeartbeatTimer = setInterval(() => {
      if (currentUser && currentUser.uid === user.uid && document.visibilityState === 'visible') {
        writePresenceHeartbeat(user.uid).catch((error) => {
          console.warn('Could not refresh online presence:', error);
        });
      }
    }, 30000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser) {
      writePresenceHeartbeat(currentUser.uid).catch((error) => {
        console.warn('Could not refresh online presence:', error);
      });
    }
    updateMemberStats();
  });

  function applyAdminControls() {
    document.querySelectorAll('[data-admin-only]').forEach((element) => {
      element.classList.toggle('hidden', !isAdmin);
    });

    const signedIn = Boolean(currentUser);
    els.userAuthBtn.classList.toggle('hidden', signedIn);
    els.userAccountWrap.classList.toggle('hidden', !signedIn);

    if (signedIn) {
      const email = String(currentUser.email || 'Signed-in user');
      const display = String(currentUser.displayName || email.split('@')[0] || 'Account');
      els.userAccountEmail.textContent = email;
      els.userAccountAvatar.textContent = Array.from(display.trim())[0]?.toUpperCase() || 'U';
      els.userAccountBtn.title = `Signed in as ${email}`;
      els.userAccountBtn.setAttribute('aria-label', `Account menu for ${email}`);
    }

    document.body.classList.toggle('is-admin', isAdmin);
  }

  function initializeAdminAccess() {
    applyAdminControls();

    if (!firebaseConfigured || !auth) {
      loadSharedVideos();
      return;
    }

    // Load the public aggregate while signed out so the Home page can show true library counts.
    startPublicLibraryStatsListener();

    onAuthStateChanged(auth, (user) => {
      currentUser = user || null;
      isAdmin = Boolean(user)
        && String(user.email || '').trim().toLowerCase() === normalizedAdminEmail
        && user.emailVerified === true;

      applyAdminControls();

      if (currentUser) {
        startFirestoreListener();
        startMemberStats(currentUser);
        if (pendingPageAfterAuth) {
          const requestedPage = pendingPageAfterAuth;
          pendingPageAfterAuth = null;
          if (pendingFromInitialHash) {
            pendingFromInitialHash = false;
            showPage(requestedPage, { push: false, scroll: true });
          } else if (userInitiatedAuthInProgress) {
            // A new sign-in/register just completed: stay on Home until Explore is clicked again.
            userInitiatedAuthInProgress = false;
          } else {
            // The visitor was already signed in when they clicked Explore; honour that click.
            if (pendingSubjectAfterAuth) {
              selectedSubject = pendingSubjectAfterAuth;
              pendingSubjectAfterAuth = null;
            }
            userAuthModal?.classList.add('hidden');
            document.body.style.overflow = '';
            showPage(requestedPage, { push: true, scroll: true });
          }
        }
      } else {
        stopFirestoreListener();
        stopMemberStats();
        if (currentPage === 'library') {
          showPage('home', { push: true, scroll: true });
        }
        if (pendingPageAfterAuth) {
          pendingFromInitialHash = false;
          openUserAuthModal('login', pendingPageAfterAuth, true);
        }
      }

      render();
    });
  }

  function normalizeVideo(input) {  
  if (!input || typeof input !== 'object') return null;

  const title = String(input.title || '').trim().slice(0, 100);

  const subject = String(input.subject || 'Other')
    .trim().slice(0, 40) || 'Other';
    
  const rawMainPlaylist = String(input.mainPlaylist || 'General')
  .trim()
  .replace(/\s+/g, ' ')
  .slice(0, 80) || 'General';

const mainPlaylist = (() => {
  const key = rawMainPlaylist.toLowerCase();
  if (key === 'season paper discussion 2027' || key === 'amila sir(ch) paper discussion 2027' || key === 'amila sir (ch) paper discussion 2027') {
    return 'Amila Sir Paper Discussion 2027';
  }
  if (key === 'home work discussion' || key === 'anuradha sir home work discussion') {
    return 'Anuradha sir Home Work Discussion 2027';
  }
  return rawMainPlaylist;
})();

  const playlist = String(input.playlist || 'General videos')
    .trim().slice(0, 80) || 'General videos';

  const url = String(input.url || '').trim();
  const passwordSalt = String(input.passwordSalt || '').trim().toLowerCase();
  const passwordHash = String(input.passwordHash || '').trim().toLowerCase();
  const hasValidPasswordLock = /^[a-f0-9]{32}$/.test(passwordSalt)
    && /^[a-f0-9]{64}$/.test(passwordHash);

  if (!title || !isValidYouTubeUrl(url)) return null;

  return {
    id: String(input.id || makeId()),
    title,
    subject,
    mainPlaylist,
    playlist,
    teacher: String(input.teacher || '').trim().slice(0, 80),
    url,
    description: String(input.description || '').trim().slice(0, 180),
    createdAt: Number(input.createdAt) || Date.now(),
    ...(hasValidPasswordLock ? { passwordSalt, passwordHash } : {})
  };
}

  function makeId() {
    return `gns-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createVideoPasswordSalt() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  async function hashVideoPassword(password, saltHex) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: new TextEncoder().encode(saltHex),
      iterations: 120000,
      hash: 'SHA-256'
    }, keyMaterial, 256);
    return Array.from(new Uint8Array(bits))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function passwordHashesMatch(actual, expected) {
    if (typeof actual !== 'string' || typeof expected !== 'string' || actual.length !== expected.length) return false;
    let difference = 0;
    for (let i = 0; i < actual.length; i += 1) {
      difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return difference === 0;
  }


  function hasVideoPasswordLock(video) {
    return /^[a-f0-9]{32}$/i.test(String(video?.passwordSalt || ''))
      && /^[a-f0-9]{64}$/i.test(String(video?.passwordHash || ''));
  }

  function getYoutubeId(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || '';
      if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) return '';
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v') || '';
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live', 'v'].includes(segments[0])) return segments[1] || '';
      return '';
    } catch (_) { return ''; }
  }

  function isValidYouTubeUrl(url) {
    const id = getYoutubeId(url);
    return /^[A-Za-z0-9_-]{11}$/.test(id);
  }

  function safeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function getArt(subject) { return SUBJECT_ART[subject] || SUBJECT_ART.Other; }

  function thumbnailMarkup(video) {
    const videoId = getYoutubeId(video.url);
    const art = getArt(video.subject);
    const locked = hasVideoPasswordLock(video);
    const blurredClass = locked ? ' video-password-locked-media' : '';
    const lockOverlay = locked ? `
      <span class="video-password-lock-overlay" aria-hidden="true">
        <span class="video-password-lock-icon">🔒</span>
        <span class="video-password-lock-label">PASSWORD LOCKED</span>
      </span>
    ` : '';

    if (videoId) {
      return `<img class="${locked ? 'video-password-locked-media' : ''}" loading="lazy" src="https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg" alt="" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden')" /><div class="thumb-subject-art ${art.cls} fallback-art hidden${blurredClass}"><span class="thumb-equation">${safeText(art.symbol)}</span></div>${lockOverlay}`;
    }
    return `<div class="thumb-subject-art ${art.cls}${blurredClass}"><span class="thumb-equation">${safeText(art.symbol)}</span></div>${lockOverlay}`;
  }

  function renderVideoCard(video, index) {
    const teacher = video.teacher || 'Class resource';
    const teacherInitial = teacher.trim().charAt(0).toUpperCase() || 'G';
    const isSaved = saved.has(video.id);
    const subject = video.subject || 'Other';
    const description = video.description || 'A class video to revisit whenever you are ready to study.';
    const dateLabel = formatDate(video.createdAt);
    const sourceBadge = video.isLocal ? '<span class="local-tag">LOCAL DRAFT</span>' : '';
    const localDelete = isAdmin ? `<button class="delete-local" data-delete="${safeText(video.id)}" type="button">Remove video</button>` : '';
    return `<article class="video-card" style="animation-delay:${Math.min(index * 45, 240)}ms">
      <div class="video-thumbnail${hasVideoPasswordLock(video) ? ' has-video-password-lock' : ''}" data-play="${safeText(video.id)}" aria-label="Play ${safeText(video.title)}">
        ${thumbnailMarkup(video)}
        <span class="thumb-overlay"><span class="thumb-play">▶</span></span>
        <span class="video-top-badges"><span class="category-badge">${safeText(subject.toUpperCase())}</span><button class="bookmark-button ${isSaved ? 'saved' : ''}" data-save="${safeText(video.id)}" type="button" aria-label="${isSaved ? 'Remove saved video' : 'Save video'}" aria-pressed="${isSaved}">${isSaved ? '♥' : '♡'}</button></span>
        ${sourceBadge}
      </div>
      <div class="video-card-body">
        <div class="card-meta"><span>${safeText(dateLabel)}</span><span class="meta-dot"></span><span>YOUTUBE</span></div>
        <h3 class="video-title">${safeText(video.title)}</h3>
        <p class="video-description">${safeText(description)}</p>
        <div class="card-bottom"><div class="teacher-info"><span class="teacher-avatar">${safeText(teacherInitial)}</span><span class="teacher-name" title="${safeText(teacher)}">${safeText(teacher)}</span></div><button class="card-play-link" data-play="${safeText(video.id)}" type="button">Watch lesson <span>↗</span></button></div>
        ${localDelete}
      </div>
    </article>`;
  }

  function formatDate(value) {
    const date = new Date(Number(value) || Date.now());
    if (Number.isNaN(date.getTime())) return 'Just added';
    return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  function currentFilteredVideos() {
    const all = getAllVideos();
    const query = els.search.value.trim().toLocaleLowerCase();
    let list = all.filter((video) => {
      const text = [   video.title,   video.subject,   video.teacher,   video.description,   video.playlist ].join(' ').toLocaleLowerCase();
      return (!query || text.includes(query)) && (selectedSubject === 'all' || video.subject === selectedSubject) && (!onlySaved || saved.has(video.id));
    });
    if (els.sort.value === 'oldest') list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    else if (els.sort.value === 'az') list.sort((a, b) => a.title.localeCompare(b.title));
    else list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  }

  function renderFilters(all) {
    const subjectCounts = new Map();
    all.forEach((video) => subjectCounts.set(video.subject, (subjectCounts.get(video.subject) || 0) + 1));
    const actualSubjects = [...subjectCounts.keys()].sort((a, b) => {
      const ai = SUBJECT_ORDER.indexOf(a), bi = SUBJECT_ORDER.indexOf(b);
      if (ai < 0 && bi < 0) return a.localeCompare(b);
      if (ai < 0) return 1;
      if (bi < 0) return -1;
      return ai - bi;
    });
    const chips = [{ subject: 'all', label: 'All videos', count: all.length }, ...actualSubjects.map((subject) => ({ subject, label: subject, count: subjectCounts.get(subject) }))];
    els.filters.innerHTML = chips.map((chip) => `<button class="filter-chip ${selectedSubject === chip.subject ? 'active' : ''}" data-subject="${safeText(chip.subject)}" type="button">${safeText(chip.label)} <span>${chip.count}</span></button>`).join('');
    els.allCount.textContent = String(all.length);
    document.querySelectorAll('[data-subject-count]').forEach((node) => {
      const subject = node.getAttribute('data-subject-count');
      const count = subjectCounts.get(subject) || 0;
      node.textContent = `${count} ${count === 1 ? 'lesson' : 'lessons'}`;
    });
  }

function renderPlaylistGroups(videos) {
  const mainGroups = new Map();

  function getTime(value) {
    if (typeof value === 'number') return value;

    if (typeof value === 'string') {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return n;

      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (value && typeof value === 'object') {
      if (typeof value.toMillis === 'function') return value.toMillis();
      if (Number.isFinite(Number(value.seconds))) return Number(value.seconds) * 1000;
    }

    return 0;
  }

  videos.forEach((video) => {
    const subject = String(video.subject || 'Other').trim() || 'Other';
    const rawMainName = String(video.mainPlaylist || 'General')
  .trim()
  .replace(/\s+/g, ' ') || 'General';

const mainName = (() => {
  const key = rawMainName.toLowerCase();
  if (key === 'season paper discussion 2027' || key === 'amila sir(ch) paper discussion 2027' || key === 'amila sir (ch) paper discussion 2027') {
    return 'Amila Sir Paper Discussion 2027';
  }
  if (key === 'home work discussion' || key === 'anuradha sir home work discussion') {
    return 'Anuradha sir Home Work Discussion 2027';
  }
  return rawMainName;
})();
    const lessonName = String(video.playlist || 'General videos').trim() || 'General videos';

    const mainKey = `${subject.toLowerCase()}::${mainName.toLowerCase()}`;
    const lessonKey = `${mainKey}::${lessonName.toLowerCase()}`;

    if (!mainGroups.has(mainKey)) {
      mainGroups.set(mainKey, {
        key: mainKey,
        subject,
        name: mainName,
        items: [],
        lessons: new Map()
      });
    }

    const main = mainGroups.get(mainKey);
    main.items.push(video);

    if (!main.lessons.has(lessonKey)) {
      main.lessons.set(lessonKey, {
        key: lessonKey,
        name: lessonName,
        items: []
      });
    }

    main.lessons.get(lessonKey).items.push(video);
  });

  const categories = [...mainGroups.values()].map((main) => ({
    ...main,
    items: [...main.items].sort(
      (a, b) => getTime(b.createdAt) - getTime(a.createdAt)
    ),
    lessons: [...main.lessons.values()].map((lesson) => ({
      ...lesson,
      items: [...lesson.items].sort(
        (a, b) => getTime(b.createdAt) - getTime(a.createdAt)
      )
    }))
  }));

  let activeCategory = categories.find(
    (category) => category.key === activeMainCategoryKey
  );

  if (activeMainCategoryKey && !activeCategory) {
    activeMainCategoryKey = null;
    activeCategory = null;
  }

  let activeLesson = activeCategory?.lessons.find(
    (lesson) => lesson.key === activePlaylistKey
  );

  if (activePlaylistKey && !activeLesson) {
    activePlaylistKey = null;
    activeLesson = null;
  }

  const mainCards = categories.map((main) => {
    const title = selectedSubject === 'all'
      ? `${main.subject} · ${main.name}`
      : main.name;

    const newest = main.items[0];

    return `
      <article class="playlist-catalog-card">
        <button
          class="playlist-catalog-preview"
          data-open-main-category="${safeText(main.key)}"
          type="button"
          aria-label="Open ${safeText(title)}"
        >
          ${newest ? thumbnailMarkup(newest) : ''}
          <span class="playlist-catalog-preview-overlay">View playlists ↗</span>
        </button>

        <div class="playlist-catalog-info">
          <button
            class="playlist-catalog-title"
            data-open-main-category="${safeText(main.key)}"
            type="button"
          >${safeText(title)}</button>

          <div class="playlist-catalog-footer">
            <span>${main.lessons.length} playlists</span>
            <button
              class="playlist-toggle"
              data-open-main-category="${safeText(main.key)}"
              type="button"
            >View playlists ↗</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  const lessonCards = activeCategory
    ? activeCategory.lessons.map((lesson) => {
        const newest = lesson.items[0];

        return `
          <article class="playlist-catalog-card">
            <button
              class="playlist-catalog-preview"
              data-open-lesson-playlist="${safeText(lesson.key)}"
              type="button"
              aria-label="Open ${safeText(lesson.name)}"
            >
              ${newest ? thumbnailMarkup(newest) : ''}
              <span class="playlist-catalog-preview-overlay">View videos ↗</span>
            </button>

            <div class="playlist-catalog-info">
              <button
                class="playlist-catalog-title"
                data-open-lesson-playlist="${safeText(lesson.key)}"
                type="button"
              >${safeText(lesson.name)}</button>

              <div class="playlist-catalog-footer">
                <span>${lesson.items.length} videos</span>
                <button
                  class="playlist-toggle"
                  data-open-lesson-playlist="${safeText(lesson.key)}"
                  type="button"
                >View videos ↗</button>
              </div>
            </div>
          </article>
        `;
      }).join('')
    : '';

  const mainWindow = activeCategory ? `
    <div class="subject-playlists-backdrop" data-close-main-category>
      <section class="subject-playlists-dialog" role="dialog" aria-modal="true">
        <header class="subject-playlists-header">
          <div>
            <span class="playlist-eyebrow">MAIN PLAYLIST</span>
            <h2>${safeText(activeCategory.name)}</h2>
            <p>Choose a lesson playlist to view its videos.</p>
          </div>
          <button class="subject-playlists-close"
            data-close-main-category type="button">✕ Close</button>
        </header>
        <div class="playlist-catalog-grid">${lessonCards}</div>
      </section>
    </div>
  ` : '';

  const videoWindow = activeLesson ? `
    <div class="playlist-view-backdrop" data-close-lesson-playlist>
      <section class="playlist-view-dialog" role="dialog" aria-modal="true">
        <header class="playlist-view-header">
          <div>
            <span class="playlist-eyebrow">${safeText(activeCategory.subject)}</span>
            <h2>${safeText(activeLesson.name)}</h2>
            <p>${activeLesson.items.length} videos</p>
          </div>
          <button class="playlist-view-close"
            data-close-lesson-playlist type="button">✕ Close</button>
        </header>
        <div class="playlist-view-grid">
          ${activeLesson.items.map((video, index) =>
            renderVideoCard(video, index)
          ).join('')}
        </div>
      </section>
    </div>
  ` : '';

  return `
    <div class="playlist-catalog-root">
      <div class="playlist-catalog-grid">${mainCards}</div>
      ${mainWindow}
      ${videoWindow}
    </div>
  `;
}
  function render() {
    const all = getAllVideos();
    const filtered = currentFilteredVideos();
    renderFilters(all);
    const publicVideoCount = Number.isInteger(publicLibraryStats?.videoCount)
      ? publicLibraryStats.videoCount
      : null;
    const publicSubjectCount = Number.isInteger(publicLibraryStats?.subjectCount)
      ? publicLibraryStats.subjectCount
      : null;
    const displayedVideoCount = !firebaseConfigured
      ? all.length
      : currentUser
        ? (hasLoadedSharedVideos ? all.length : '…')
        : (publicVideoCount === null ? '—' : publicVideoCount);
    const displayedSubjectCount = !firebaseConfigured
      ? new Set(all.map((video) => video.subject)).size
      : currentUser
        ? (hasLoadedSharedVideos ? new Set(all.map((video) => video.subject)).size : '…')
        : (publicSubjectCount === null ? '—' : publicSubjectCount);
    const displayedSavedCount = currentUser && hasLoadedSharedVideos
      ? all.filter((video) => saved.has(video.id)).length
      : saved.size;
    els.statVideos.textContent = String(displayedVideoCount);
    els.statSubjects.textContent = String(displayedSubjectCount);
    els.statSaved.textContent = String(displayedSavedCount);
    els.videoGrid.innerHTML = renderPlaylistGroups(filtered);
    const noVideosAtAll = all.length === 0;
    els.videoGrid.classList.toggle('hidden', noVideosAtAll || filtered.length === 0);
    els.emptyState.classList.toggle('hidden', !noVideosAtAll && filtered.length !== 0);
    if (noVideosAtAll) {
      if (isAdmin) {
        els.emptyState.querySelector('h3').textContent = 'Your next great lesson starts here.';
        els.emptyState.querySelector('p').textContent = 'Add a YouTube lesson and it will be published to the shared library for everyone.';
        els.emptyState.querySelector('.empty-tip').textContent = 'Only your authorised Google account can publish or remove videos.';
      } else {
        els.emptyState.querySelector('h3').textContent = firebaseConfigured ? 'No lessons published yet.' : 'The library is being set up.';
        els.emptyState.querySelector('p').textContent = firebaseConfigured
          ? 'New class videos will appear here after the library owner publishes them.'
          : 'The library owner is setting up secure publishing. Please check back soon.';
        els.emptyState.querySelector('.empty-tip').textContent = '';
      }
    } else if (filtered.length === 0) {
      els.emptyState.querySelector('h3').textContent = onlySaved ? 'Nothing saved just yet.' : 'No videos match this search.';
      els.emptyState.querySelector('p').textContent = onlySaved ? 'Tap the heart on any lesson to keep it here for your next revision session.' : 'Try another keyword or subject, or clear the filters to see the full library.';
      els.emptyState.querySelector('.empty-tip').textContent = '';
      els.videoGrid.classList.add('hidden');
      els.emptyState.classList.remove('hidden');
    }
    if (noVideosAtAll) els.resultsLabel.textContent = 'A fresh start — add your first lesson';
    else els.resultsLabel.textContent = `Showing ${filtered.length} of ${all.length} ${all.length === 1 ? 'video' : 'videos'}`;
    const changed = !!els.search.value || selectedSubject !== 'all' || onlySaved;
    els.clearFilters.classList.toggle('hidden', !changed);
    els.favoritesToggle.setAttribute('aria-pressed', String(onlySaved));
    els.favoritesToggle.innerHTML = onlySaved ? '<span>♥</span>' : '<span>♡</span>';
    els.favoritesToggle.title = onlySaved ? 'Show all videos' : 'Show saved videos';
    document.querySelectorAll('.filter-chip').forEach((chip) => chip.classList.toggle('active', chip.dataset.subject === selectedSubject));
  }

  function openAddModal(subject = '') {
    if (!isAdmin || !db) {
      notify(firebaseConfigured ? 'Only the authorised site owner can add videos.' : 'Admin uploads are not configured yet. Follow FIREBASE_SETUP_SI.md.');
      return;
    }
    lastFocus = document.activeElement;
    if (subject) {
      const subjectSelect = document.getElementById('videoSubject');
      const exists = [...subjectSelect.options].some((option) => option.value === subject || option.text === subject);
      if (!exists) {
        const option = document.createElement('option'); option.textContent = subject; option.value = subject; subjectSelect.appendChild(option);
      }
      subjectSelect.value = subject;
    }
    els.formError.classList.add('hidden');
    els.addModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('videoTitle').focus(), 25);
  }

  function closeModal(modal) {
    modal.classList.add('hidden');
    if (els.addModal.classList.contains('hidden') && els.playerModal.classList.contains('hidden')
      && els.videoPasswordModal.classList.contains('hidden')) document.body.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function requestVideoPlayback(video) {
    if (!hasVideoPasswordLock(video)) {
      openPlayer(video);
      return;
    }

    lastFocus = document.activeElement;
    pendingPasswordVideo = video;
    els.videoUnlockPassword.value = '';
    els.videoPasswordError.textContent = '';
    els.videoPasswordError.classList.add('hidden');
    els.videoPasswordVideoTitle.textContent = video.title || 'Class video';
    els.videoPasswordModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => els.videoUnlockPassword.focus(), 25);
  }

  function closeVideoPasswordModal(keepScrollLocked = false) {
    els.videoPasswordModal.classList.add('hidden');
    els.videoPasswordForm.reset();
    els.videoPasswordError.textContent = '';
    els.videoPasswordError.classList.add('hidden');
    pendingPasswordVideo = null;
    if (!keepScrollLocked && els.addModal.classList.contains('hidden')
      && els.playerModal.classList.contains('hidden')) document.body.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  async function unlockVideo(event) {
    event.preventDefault();
    const video = pendingPasswordVideo;
    if (!video) return;

    const enteredPassword = String(els.videoUnlockPassword.value || '');
    if (!enteredPassword) {
      els.videoPasswordError.textContent = 'Enter the password for this video.';
      els.videoPasswordError.classList.remove('hidden');
      els.videoUnlockPassword.focus();
      return;
    }

    const submitButton = els.videoPasswordForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.textContent = 'Checking…';

    try {
      const enteredHash = await hashVideoPassword(enteredPassword, video.passwordSalt);
      if (!passwordHashesMatch(enteredHash, video.passwordHash)) {
        els.videoPasswordError.textContent = 'That password is incorrect. Please try again.';
        els.videoPasswordError.classList.remove('hidden');
        els.videoUnlockPassword.select();
        return;
      }

      closeVideoPasswordModal(true);
      openPlayer(video);
    } catch (error) {
      console.error('Video password check failed:', error);
      els.videoPasswordError.textContent = 'Could not check the password. Please refresh the site and try again.';
      els.videoPasswordError.classList.remove('hidden');
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonText;
    }
  }

function openPlayer(video) {
  const videoId = getYoutubeId(video.url);

  if (!videoId) {
    window.open(video.url, '_blank', 'noopener,noreferrer');
    return;
  }

  document.body.classList.add('video-playing');

  lastFocus = document.activeElement;

  document.getElementById('playerTitle').textContent = video.title;
  document.getElementById('playerSubject').textContent =
    video.subject.toUpperCase();
  document.getElementById('playerTeacher').textContent =
    video.teacher || 'GNS Class Library';
  document.getElementById('playerDescription').textContent =
    video.description || '';
  document.getElementById('openYoutubeLink').href = video.url;

  if (els.playerModal.parentElement !== document.body) {
    document.body.appendChild(els.playerModal);
  }

  els.playerModal.style.setProperty('position', 'fixed', 'important');
  els.playerModal.style.setProperty('inset', '0', 'important');
  els.playerModal.style.setProperty(
    'z-index',
    '2147483647',
    'important'
  );

  els.videoFrame.src =
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;

  els.playerModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  els.playerModal.querySelector('.modal-close').focus();
}

function closePlayer() {
  document.body.classList.remove('video-playing');
  els.videoFrame.src = '';
  closeModal(els.playerModal);
}

  function notify(message) {
    els.toastText.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3000);
  }

  function exportLibrary() {
    if (!isAdmin) { notify('Only the authorised site owner can export the library.'); return; }
    const all = getAllVideos().map(({ isLocal, ...video }) => video);
    const blob = new Blob([`${JSON.stringify(all, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'videos.json'; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Library exported as videos.json');
  }

  function clearFilters() {
    els.search.value = '';
    selectedSubject = 'all';
    onlySaved = false;
    render();
  }

  async function addVideo(event) {
    event.preventDefault();
    if (!isAdmin || !db) { notify('Only the authorised site owner can publish videos.'); return; }
    const form = new FormData(els.addForm);
    const url = String(form.get('url') || '').trim();
    if (!isValidYouTubeUrl(url)) {
      els.formError.textContent = 'Please enter a valid YouTube video URL, such as youtube.com/watch?v=… or youtu.be/…';
      els.formError.classList.remove('hidden');
      document.getElementById('videoUrl').focus();
      return;
    }
    const videoPassword = String(form.get('videoPassword') || '');
    if (videoPassword.length < 4) {
      els.formError.textContent = 'Please set a video password with at least 4 characters.';
      els.formError.classList.remove('hidden');
      document.getElementById('videoPassword').focus();
      return;
    }

    let passwordSalt;
    let passwordHash;
    try {
      passwordSalt = createVideoPasswordSalt();
      passwordHash = await hashVideoPassword(videoPassword, passwordSalt);
    } catch (error) {
      console.error('Could not create video password lock:', error);
      els.formError.textContent = 'Could not create the video password lock. Please open the website over HTTPS and try again.';
      els.formError.classList.remove('hidden');
      return;
    }

    const next = normalizeVideo({
      id: makeId(), title: form.get('title'), subject: form.get('subject'), mainPlaylist: form.get('mainPlaylist'), playlist: form.get('playlist'), teacher: form.get('teacher'),
      url, description: form.get('description'), createdAt: Date.now(), passwordSalt, passwordHash
    });
    if (!next) return;
    try {
      await setDoc(doc(db, 'videos', next.id), next);
      selectedSubject = next.subject;
      onlySaved = false;
      els.search.value = '';
      els.sort.value = 'newest';
      els.addForm.reset();
      closeModal(els.addModal);
      notify('Video published to the shared library.');
      document.getElementById('library').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      console.error('Publishing failed:', error);
      els.formError.textContent = 'Could not publish the video. Check Firestore rules, admin email and sign-in setup.';
      els.formError.classList.remove('hidden');
    }
  }

  function importLibraryFile(file) {
    if (!file) return;
    if (!isAdmin || !db) { notify('Only the authorised site owner can import videos.'); els.importFile.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data)) throw new Error('The JSON file must contain a list of videos.');
        const normalized = data.map(normalizeVideo).filter(Boolean);
        if (data.length && normalized.length === 0) throw new Error('No valid YouTube video entries were found in that file.');
        if (normalized.length > 2000) throw new Error('Please import at most 2,000 videos at a time.');
        for (let i = 0; i < normalized.length; i += 400) {
          const batch = writeBatch(db);
          normalized.slice(i, i + 400).forEach((video) => {
            batch.set(doc(db, 'videos', video.id), video);
          });
          await batch.commit();
        }
        selectedSubject = 'all'; onlySaved = false;
        notify(`Published ${normalized.length} video${normalized.length === 1 ? '' : 's'} to the shared library.`);
      } catch (error) {
        console.error('Import failed:', error);
        notify(error.message || 'Could not import that JSON file. Check Firestore permissions.');
      }
      els.importFile.value = '';
    };
    reader.onerror = () => { notify('Could not read the selected file.'); els.importFile.value = ''; };
    reader.readAsText(file);
  }

  async function deletePublishedVideo(id) {
    if (!isAdmin || !db) { notify('Only the authorised site owner can remove videos.'); return; }
    if (!window.confirm('Remove this video from the public library?')) return;
    try {
      await deleteDoc(doc(db, 'videos', id));
      saved.delete(id); storeSaved();
      notify('Video removed from the shared library.');
    } catch (error) {
      console.error('Delete failed:', error);
      notify('Could not remove this video. Check Firestore rules and admin sign-in.');
    }
  }

  let userAuthMode = 'login';

  const userAuthModal = document.getElementById('userAuthModal');
  const userAuthForm = document.getElementById('userAuthForm');
  const userAuthTitle = document.getElementById('userAuthTitle');
  const userAuthDescription = document.getElementById('userAuthDescription');
  const userAuthSubmit = document.getElementById('userAuthSubmit');
  const userAuthToggle = document.getElementById('userAuthToggle');
  const userAuthCloseIcon = document.getElementById('userAuthCloseIcon');
  const userAuthGoogleBtn = document.getElementById('userAuthGoogleBtn');
  const userAuthReset = document.getElementById('userAuthReset');
  const userAuthMessage = document.getElementById('userAuthMessage');
  const userAuthEmail = document.getElementById('userAuthEmail');
  const userAuthPassword = document.getElementById('userAuthPassword');

  function setUserAuthMode(mode) {
    userAuthMode = mode === 'register' ? 'register' : 'login';
    const registering = userAuthMode === 'register';
    userAuthTitle.textContent = registering ? 'Create your account' : 'Login';
    userAuthDescription.textContent = registering
      ? 'Create an account to access class playlists.'
      : 'Sign in to explore your class playlists.';
    userAuthSubmit.textContent = registering ? 'Create account' : 'Login';
    userAuthToggle.textContent = registering
      ? 'Already have an account? Login'
      : 'New here? Create an account';
    userAuthPassword.autocomplete = registering ? 'new-password' : 'current-password';
    userAuthMessage.textContent = '';
    userAuthMessage.classList.remove('is-error', 'is-success');
  }

  function setUserAuthMessage(message, type = 'error') {
    userAuthMessage.textContent = message;
    userAuthMessage.classList.toggle('is-error', type === 'error');
    userAuthMessage.classList.toggle('is-success', type === 'success');
  }

  function openUserAuthModal(mode = 'login', requestedPage = 'library', keepPending = false) {
    pageBeforeAuthModal = currentPage;
    if (!keepPending) pendingPageAfterAuth = requestedPage;
    setUserAuthMode(mode);
    userAuthModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => userAuthEmail.focus(), 40);
  }

  function closeUserAuthModal() {
    userAuthModal.classList.add('hidden');
    if (els.addModal.classList.contains('hidden') && els.playerModal.classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
    pendingPageAfterAuth = null;
    pendingSubjectAfterAuth = null;
    pendingFromInitialHash = false;
    const returnHash = activeNavTarget === 'home' ? 'top' : activeNavTarget;
    history.replaceState({ page: currentPage }, '', `${location.pathname}${location.search}#${returnHash}`);
    if (currentPage !== pageBeforeAuthModal) {
      showPage(pageBeforeAuthModal, { push: false, scroll: false });
    }
  }

  function showPage(target, options = {}) {
    const { push = false, scroll = true } = options;
    const allowedTargets = ['home', 'library', 'subjects', 'about'];
    if (!allowedTargets.includes(target)) target = 'home';

    if ((target === 'library' || target === 'subjects') && !currentUser) {
      pendingPageAfterAuth = target;
      openUserAuthModal('login', target, true);
      if (!firebaseConfigured) {
        setUserAuthMessage('The site owner needs to finish Firebase Authentication setup before accounts can sign in.');
      }
      return;
    }

    activeNavTarget = target;
    currentPage = target === 'subjects' ? 'library' : target;
    document.body.dataset.activePage = currentPage;

    const homeVisible = currentPage === 'home';
    document.querySelector('.hero')?.classList.toggle('page-view-hidden', !homeVisible);
    document.querySelector('.quick-stats')?.classList.toggle('page-view-hidden', !homeVisible);
    document.querySelector('.member-stats')?.classList.toggle('page-view-hidden', !homeVisible);
    document.getElementById('library')?.classList.toggle('page-view-hidden', currentPage !== 'library');
    document.getElementById('subjects')?.classList.toggle('page-view-hidden', currentPage !== 'library');
    document.getElementById('about')?.classList.toggle('page-view-hidden', currentPage !== 'about');

    document.querySelectorAll('.main-nav [data-page-target]').forEach((link) => {
      link.classList.toggle('active', link.dataset.pageTarget === activeNavTarget);
    });

    if (push) {
      const hash = target === 'home' ? 'top' : target;
      history.pushState({ page: target }, '', `${location.pathname}${location.search}#${hash}`);
    }

    if (scroll) {
      const section = target === 'home'
        ? document.getElementById('top')
        : target === 'about'
          ? document.getElementById('about')
          : target === 'subjects'
            ? document.getElementById('subjects')
            : document.getElementById('library');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (target === 'library' || target === 'subjects') render();
  }

  function navigateTo(target) {
    if (target === 'library' || target === 'subjects') {
      if (!currentUser) {
        pendingPageAfterAuth = target;
        openUserAuthModal('login', target, true);
        if (!firebaseConfigured) {
          setUserAuthMessage('The site owner needs to finish Firebase Authentication setup before accounts can sign in.');
        }
        return;
      }
      if (pendingSubjectAfterAuth) {
        selectedSubject = pendingSubjectAfterAuth;
        pendingSubjectAfterAuth = null;
      }
      showPage(target, { push: true, scroll: true });
      return;
    }
    pendingPageAfterAuth = null;
    if (target === 'home' || target === 'about') {
      showPage(target, { push: true, scroll: true });
    }
  }

  els.userAuthBtn.addEventListener('click', () => openUserAuthModal('login', 'library'));
  userAuthToggle.addEventListener('click', () => setUserAuthMode(userAuthMode === 'login' ? 'register' : 'login'));
  userAuthCloseIcon.addEventListener('click', closeUserAuthModal);

  userAuthForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!firebaseConfigured || !auth) {
      setUserAuthMessage('Firebase is not configured. Please contact the site owner.');
      return;
    }

    const email = userAuthEmail.value.trim();
    const password = userAuthPassword.value;
    userAuthSubmit.disabled = true;
    userInitiatedAuthInProgress = true;
    setUserAuthMessage('');

    try {
      if (userAuthMode === 'register') {
        await createUserWithEmailAndPassword(auth, email, password);
        notify('Account created. Click “Explore the library” to continue.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        notify('Login successful. Click “Explore the library” to continue.');
      }
      userAuthModal.classList.add('hidden');
      document.body.style.overflow = '';
      userAuthForm.reset();
    } catch (error) {
      userInitiatedAuthInProgress = false;
      console.error('User authentication failed:', error);
      const messages = {
        'auth/email-already-in-use': 'This email already has an account. Please log in instead.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Choose a stronger password with at least 6 characters.',
        'auth/invalid-credential': 'Email or password is incorrect.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/network-request-failed': 'Network connection failed. Check your internet and try again.'
      };
      setUserAuthMessage(messages[error.code] || 'Could not sign in. Please check your details and try again.');
    } finally {
      userAuthSubmit.disabled = false;
    }
  });

  userAuthGoogleBtn.addEventListener('click', async () => {
    if (!firebaseConfigured || !auth) {
      setUserAuthMessage('Firebase is not configured. Please contact the site owner.');
      return;
    }
    userAuthGoogleBtn.disabled = true;
    userInitiatedAuthInProgress = true;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      userAuthModal.classList.add('hidden');
      document.body.style.overflow = '';
      notify('Google sign-in successful. Click “Explore the library” to continue.');
    } catch (error) {
      userInitiatedAuthInProgress = false;
      console.error('Google sign-in failed:', error);
      const messages = {
        'auth/popup-blocked': 'Your browser blocked the Google sign-in popup. Allow popups and try again.',
        'auth/unauthorized-domain': 'Add niwansathsara.github.io under Firebase Authentication → Settings → Authorized domains.',
        'auth/popup-closed-by-user': 'The Google sign-in window was closed before finishing.'
      };
      setUserAuthMessage(messages[error.code] || 'Google sign-in failed. Check that Google sign-in is enabled in Firebase.');
    } finally {
      userAuthGoogleBtn.disabled = false;
    }
  });

  userAuthReset.addEventListener('click', async () => {
    if (!firebaseConfigured || !auth) {
      setUserAuthMessage('Firebase is not configured. Please contact the site owner.');
      return;
    }
    const email = userAuthEmail.value.trim();
    if (!email) {
      setUserAuthMessage('Enter your email address first.');
      userAuthEmail.focus();
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setUserAuthMessage('If an account uses this email, password reset instructions have been sent.', 'success');
    } catch (error) {
      console.error('Password reset failed:', error);
      setUserAuthMessage('Could not send reset instructions. Check the email and try again.');
    }
  });

  els.userAccountBtn.addEventListener('click', () => {
    const open = els.userAccountBtn.getAttribute('aria-expanded') === 'true';
    els.userAccountBtn.setAttribute('aria-expanded', String(!open));
    els.userAccountDropdown.classList.toggle('hidden', open);
  });

  els.userSignOutBtn.addEventListener('click', async () => {
    els.userAccountDropdown.classList.add('hidden');
    els.userAccountBtn.setAttribute('aria-expanded', 'false');
    if (!auth) return;
    try {
      if (db && currentUser?.uid) {
        try { await deleteDoc(doc(db, 'sitePresence', currentUser.uid)); } catch (_) { /* Presence naturally expires if cleanup is blocked. */ }
      }
      await signOut(auth);
      notify('You have signed out.');
    } catch (error) {
      console.error('Sign-out failed:', error);
      notify('Could not sign out. Please try again.');
    }
  });

  document.addEventListener('click', (event) => {
    if (!els.userAccountWrap.contains(event.target)) {
      els.userAccountDropdown.classList.add('hidden');
      els.userAccountBtn.setAttribute('aria-expanded', 'false');
    }
  });

  document.querySelectorAll('[data-page-target]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigateTo(link.dataset.pageTarget);
      const mobileMenu = document.getElementById('mobileMenu');
      mobileMenu?.setAttribute('aria-expanded', 'false');
      document.querySelector('.main-nav')?.classList.remove('menu-open');
      if (document.querySelector('.main-nav')) document.querySelector('.main-nav').style.display = '';
    });
  });

  window.addEventListener('popstate', () => {
    const target = String(location.hash || '#top').slice(1);
    if (target === 'about' || target === 'top') {
      pendingPageAfterAuth = null;
      showPage(target === 'top' ? 'home' : 'about', { push: false, scroll: true });
    } else if (target === 'library' || target === 'subjects') {
      if (!currentUser) {
        pendingPageAfterAuth = target;
        openUserAuthModal('login', target, true);
      } else {
        showPage(target, { push: false, scroll: true });
      }
    }
  });

  userAuthModal.addEventListener('click', (event) => {
    if (event.target === userAuthModal) closeUserAuthModal();
  });

  document.getElementById('openAddModal').addEventListener('click', () => openAddModal());
  ['heroAddBtn', 'sectionAddBtn', 'emptyAddBtn', 'subjectsAddBtn'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => openAddModal()));
  document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(els.addModal)));
  document.querySelector('[data-close-player]').addEventListener('click', closePlayer);
  els.addForm.addEventListener('submit', addVideo);
  els.videoPasswordForm.addEventListener('submit', unlockVideo);
  document.getElementById('closeVideoPasswordModal').addEventListener('click', () => closeVideoPasswordModal());
  document.getElementById('cancelVideoPassword').addEventListener('click', () => closeVideoPasswordModal());
  document.getElementById('exportBtn').addEventListener('click', exportLibrary);
  document.getElementById('importBtn').addEventListener('click', () => els.importFile.click());
  els.search.addEventListener('input', render);
  els.sort.addEventListener('change', render);
  els.favoritesToggle.addEventListener('click', () => { onlySaved = !onlySaved; render(); });
  els.clearFilters.addEventListener('click', clearFilters);
els.filters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-subject]');
  if (!button) return;

  selectedSubject = button.dataset.subject;
  onlySaved = false;
  activeMainCategoryKey = null;
  activePlaylistKey = null;

  render();
});
  els.videoGrid.addEventListener('click', (event) => {
  const closeMain = event.target.closest('[data-close-main-category]');

if (closeMain && (
  closeMain.tagName === 'BUTTON' ||
  event.target === closeMain
)) {
  activeMainCategoryKey = null;
  activePlaylistKey = null;
  render();
  return;
}

const openMain = event.target.closest('[data-open-main-category]');

if (openMain) {
  activeMainCategoryKey = openMain.dataset.openMainCategory;
  activePlaylistKey = null;
  render();
  return;
}

const closeLesson = event.target.closest('[data-close-lesson-playlist]');

if (closeLesson && (
  closeLesson.tagName === 'BUTTON' ||
  event.target === closeLesson
)) {
  activePlaylistKey = null;
  render();
  return;
}

const openLesson = event.target.closest('[data-open-lesson-playlist]');

if (openLesson) {
  activePlaylistKey = openLesson.dataset.openLessonPlaylist;
  render();
  return;
}
    const saveButton = event.target.closest('[data-save]');
    if (saveButton) {
      event.stopPropagation();
      const id = saveButton.dataset.save;
      if (saved.has(id)) { saved.delete(id); notify('Removed from saved videos'); }
      else { saved.add(id); notify('Saved for your next revision'); }
      storeSaved(); render(); return;
    }
    const deleteButton = event.target.closest('[data-delete]');
    if (deleteButton) {
      const id = deleteButton.dataset.delete;
      deletePublishedVideo(id);
      return;
    }
const playButton = event.target.closest('[data-play]');

if (playButton) {
  const video = getAllVideos().find(
    (item) => item.id === playButton.dataset.play
  );

  if (video) {
    requestVideoPlayback(video);
  }

  return;
}
  });
  document.querySelectorAll('[data-quick-subject]').forEach((button) => button.addEventListener('click', () => {
    const subject = button.dataset.quickSubject;
    onlySaved = false;
    if (!currentUser) {
      pendingSubjectAfterAuth = subject;
      navigateTo('library');
      return;
    }
    selectedSubject = subject;
    navigateTo('library');
    render();
  }));
  els.importFile.addEventListener('change', () => importLibraryFile(els.importFile.files?.[0]));

  const mobileMenu = document.getElementById('mobileMenu');
  mobileMenu.addEventListener('click', () => {
    const isOpen = mobileMenu.getAttribute('aria-expanded') === 'true';
    mobileMenu.setAttribute('aria-expanded', String(!isOpen));
    document.querySelector('.main-nav').classList.toggle('menu-open', !isOpen);
    document.querySelector('.main-nav').style.display = isOpen ? '' : 'flex';
  });


  [els.addModal, els.playerModal, els.videoPasswordModal].forEach((modal) => modal.addEventListener('click', (event) => {
    if (event.target !== modal) return;
    if (modal === els.playerModal) closePlayer();
    else if (modal === els.videoPasswordModal) closeVideoPasswordModal();
    else closeModal(modal);
  }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!els.playerModal.classList.contains('hidden')) closePlayer();
      else if (!els.videoPasswordModal.classList.contains('hidden')) closeVideoPasswordModal();
      else if (!els.addModal.classList.contains('hidden')) closeModal(els.addModal);
      else if (!userAuthModal.classList.contains('hidden')) closeUserAuthModal();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); els.search.focus(); }
  });

  // A hidden import control is also callable by Ctrl/⌘+Shift+I; keeps the header uncluttered.
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'i') {
      event.preventDefault(); els.importFile.click();
    }
  });
  document.getElementById('yearNow').textContent = String(new Date().getFullYear());
  document.body.dataset.activePage = 'home';
  applyAdminControls();
  render();

  const initialTarget = String(location.hash || '#top').slice(1);
  if (initialTarget === 'about') {
    showPage('about', { push: false, scroll: false });
  } else if (initialTarget === 'library' || initialTarget === 'subjects') {
    pendingPageAfterAuth = initialTarget;
    pendingFromInitialHash = true;
  }

  initializeAdminAccess();
})();
