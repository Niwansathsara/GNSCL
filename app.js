import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
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
    addModal: document.getElementById('addModal'),
    addForm: document.getElementById('addVideoForm'),
    formError: document.getElementById('formError'),
    playerModal: document.getElementById('playerModal'),
    videoFrame: document.getElementById('videoFrame'),
    toast: document.getElementById('toast'),
    toastText: document.getElementById('toastText'),
    importFile: document.getElementById('importFile'),
    adminLoginBtn: document.getElementById('adminLoginBtn'),
    adminLogoutBtn: document.getElementById('adminLogoutBtn')
  };

  let sharedVideos = [];
  let currentUser = null;
  let isAdmin = false;
  let firestoreUnsubscribe = null;
  let localVideos = readJSON(VIDEO_STORAGE, []);
  if (!Array.isArray(localVideos)) localVideos = [];
  let saved = new Set(readJSON(SAVED_STORAGE, []));
  const openPlaylists = new Set();
  let activePlaylistKey = null;
  let selectedSubject = 'all';
  let onlySaved = false;
  let toastTimer;
  let lastFocus = null;

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

  function startFirestoreListener() {
    if (!db || firestoreUnsubscribe) return;
    firestoreUnsubscribe = onSnapshot(collection(db, 'videos'), (snapshot) => {
      sharedVideos = snapshot.docs.map((item) => normalizeVideo({ ...item.data(), id: item.id })).filter(Boolean);
      render();
    }, (error) => {
      console.error('Firestore read failed:', error);
      notify('Could not load the shared library. Check Firebase Firestore rules and setup.');
    });
  }

  function applyAdminControls() {
    document.querySelectorAll('[data-admin-only]').forEach((element) => {
      element.classList.toggle('hidden', !isAdmin);
    });
    els.adminLoginBtn.classList.toggle('hidden', isAdmin);
    els.adminLogoutBtn.classList.toggle('hidden', !isAdmin);
    els.adminLoginBtn.textContent = firebaseConfigured ? 'Admin login' : 'Admin setup needed';
    els.adminLogoutBtn.textContent = 'Sign out';
    els.adminLogoutBtn.title = currentUser?.email ? `Signed in as ${currentUser.email}` : 'Sign out of admin mode';
    document.body.classList.toggle('is-admin', isAdmin);
  }

  function initializeAdminAccess() {
    applyAdminControls();
    if (!firebaseConfigured || !auth) {
      loadSharedVideos();
      return;
    }
    onAuthStateChanged(auth, async (user) => {
      const matchesAdmin = !!user
        && String(user.email || '').trim().toLowerCase() === normalizedAdminEmail
        && user.emailVerified === true;
      if (user && !matchesAdmin) {
        currentUser = null;
        isAdmin = false;
        applyAdminControls();
        try { await signOut(auth); } catch (_) { /* Ignore sign-out cleanup errors. */ }
        notify('This Google account is not authorised to manage GNS Class Library.');
        startFirestoreListener();
        render();
        return;
      }
      currentUser = matchesAdmin ? user : null;
      isAdmin = matchesAdmin;
      applyAdminControls();
      startFirestoreListener();
      render();
    });
  }

  function normalizeVideo(input) {  
  if (!input || typeof input !== 'object') return null;

  const title = String(input.title || '').trim().slice(0, 100);

  const subject = String(input.subject || 'Other')
    .trim().slice(0, 40) || 'Other';

  const playlist = String(input.playlist || 'General videos')
    .trim().slice(0, 80) || 'General videos';

  const url = String(input.url || '').trim();

  if (!title || !isValidYouTubeUrl(url)) return null;

  return {
    id: String(input.id || makeId()),
    title,
    subject,
    playlist,
    teacher: String(input.teacher || '').trim().slice(0, 80),
    url,
    description: String(input.description || '').trim().slice(0, 180),
    createdAt: Number(input.createdAt) || Date.now()
  };
}

  function makeId() {
    return `gns-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
    if (videoId) {
      return `<img loading="lazy" src="https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg" alt="" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden')" /><div class="thumb-subject-art ${art.cls} fallback-art hidden"><span class="thumb-equation">${safeText(art.symbol)}</span></div>`;
    }
    return `<div class="thumb-subject-art ${art.cls}"><span class="thumb-equation">${safeText(art.symbol)}</span></div>`;
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
      <div class="video-thumbnail" data-play="${safeText(video.id)}" aria-label="Play ${safeText(video.title)}">
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
  const groups = new Map();

  function videoTime(value) {
    if (typeof value === 'number') return value;

    if (typeof value === 'string') {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return n;

      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (value && typeof value === 'object') {
      if (typeof value.toMillis === 'function') {
        return value.toMillis();
      }

      if (Number.isFinite(Number(value.seconds))) {
        return Number(value.seconds) * 1000;
      }
    }

    return 0;
  }

  videos.forEach((video) => {
    const subject = String(video.subject || 'Other').trim() || 'Other';
    const name = String(video.playlist || 'General videos')
      .trim()
      .replace(/\s+/g, ' ') || 'General videos';

    const key =
      `${subject.toLocaleLowerCase()}::${name.toLocaleLowerCase()}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        subject,
        name,
        items: []
      });
    }

    groups.get(key).items.push(video);
  });

  const playlists = [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort(
        (a, b) => videoTime(b.createdAt) - videoTime(a.createdAt)
      )
    }))
    .sort((a, b) =>
      videoTime(b.items[0]?.createdAt) -
      videoTime(a.items[0]?.createdAt)
    );

  let activePlaylist = playlists.find(
    (playlist) => playlist.key === activePlaylistKey
  );

  if (activePlaylistKey && !activePlaylist) {
    activePlaylistKey = null;
  }

  const playlistCards = playlists.map((playlist) => {
    const { key, name, subject, items } = playlist;
    const newestVideo = items[0];

    return `
      <article class="playlist-catalog-card">

        <button
          class="playlist-catalog-preview"
          data-open-playlist="${safeText(key)}"
          type="button"
          aria-label="Open playlist ${safeText(name)}"
        >
          ${newestVideo ? thumbnailMarkup(newestVideo) : ''}
          <span class="playlist-catalog-preview-overlay">
            View playlist ↗
          </span>
        </button>

        <div class="playlist-catalog-info">
          ${selectedSubject === 'all' ? `
            <span class="playlist-catalog-subject">
              ${safeText(subject)}
            </span>
          ` : ''}

          <button
            class="playlist-catalog-title"
            data-open-playlist="${safeText(key)}"
            type="button"
          >${safeText(name)}</button>

          <div class="playlist-catalog-footer">
            <span>
              ${items.length}
              ${items.length === 1 ? 'video' : 'videos'}
            </span>

            <button
              class="playlist-toggle"
              data-open-playlist="${safeText(key)}"
              type="button"
            >View videos ↗</button>
          </div>
        </div>

      </article>
    `;
  }).join('');

  const playlistWindow = activePlaylist ? `
    <div
      class="playlist-view-backdrop"
      data-close-playlist
    >
      <section
        class="playlist-view-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="${safeText(activePlaylist.name)}"
      >
        <header class="playlist-view-header">
          <div>
            <span class="playlist-eyebrow">
              ${safeText(activePlaylist.subject)}
            </span>
            <h2>${safeText(activePlaylist.name)}</h2>
            <p>${activePlaylist.items.length} videos</p>
          </div>

          <button
            class="playlist-view-close"
            data-close-playlist
            type="button"
          >✕ Close</button>
        </header>

        <div class="playlist-view-grid">
          ${activePlaylist.items
            .map((video, index) => renderVideoCard(video, index))
            .join('')}
        </div>
      </section>
    </div>
  ` : '';

  return `
    <div class="playlist-catalog-root">
      <div class="playlist-catalog-grid">
        ${playlistCards}
      </div>

      ${playlistWindow}
    </div>
  `;
}
  function render() {
    const all = getAllVideos();
    const filtered = currentFilteredVideos();
    renderFilters(all);
    els.statVideos.textContent = String(all.length);
    els.statSubjects.textContent = String(new Set(all.map((video) => video.subject)).size);
    els.statSaved.textContent = String(saved.size);
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
    if (els.addModal.classList.contains('hidden') && els.playerModal.classList.contains('hidden')) document.body.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function openPlayer(video) {
    const videoId = getYoutubeId(video.url);
    if (!videoId) { window.open(video.url, '_blank', 'noopener,noreferrer'); return; }
    lastFocus = document.activeElement;
    document.getElementById('playerTitle').textContent = video.title;
    document.getElementById('playerSubject').textContent = video.subject.toUpperCase();
    document.getElementById('playerTeacher').textContent = video.teacher || 'GNS Class Library';
    document.getElementById('playerDescription').textContent = video.description || '';
    document.getElementById('openYoutubeLink').href = video.url;
    els.videoFrame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
    els.playerModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    els.playerModal.querySelector('.modal-close').focus();
  }

  function closePlayer() {
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
    const next = normalizeVideo({
      id: makeId(), title: form.get('title'), subject: form.get('subject'), playlist: form.get('playlist'), teacher: form.get('teacher'),
      url, description: form.get('description'), createdAt: Date.now()
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

  async function handleAdminLogin() {
    if (!firebaseConfigured || !auth) {
      notify('Set up Firebase first. Follow FIREBASE_SETUP_SI.md, then upload firebase-config.js.');
      return;
    }
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error('Admin sign-in failed:', error);
      const message = error?.code === 'auth/popup-blocked'
        ? 'Your browser blocked the sign-in popup. Allow popups and try again.'
        : error?.code === 'auth/unauthorized-domain'
          ? 'Add niwansathsara.github.io under Firebase Authentication > Settings > Authorized domains.'
          : 'Google sign-in failed. Check that the Google provider is enabled in Firebase Authentication.';
      notify(message);
    }
  }

  async function handleAdminLogout() {
    if (!auth) return;
    try { await signOut(auth); notify('Signed out of admin mode.'); }
    catch (error) { console.error('Sign-out failed:', error); notify('Could not sign out. Please refresh the page.'); }
  }

  els.adminLoginBtn.addEventListener('click', handleAdminLogin);
  els.adminLogoutBtn.addEventListener('click', handleAdminLogout);
  document.getElementById('openAddModal').addEventListener('click', () => openAddModal());
  ['heroAddBtn', 'sectionAddBtn', 'emptyAddBtn', 'subjectsAddBtn'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => openAddModal()));
  document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(els.addModal)));
  document.querySelector('[data-close-player]').addEventListener('click', closePlayer);
  els.addForm.addEventListener('submit', addVideo);
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
    render();
  });
  els.videoGrid.addEventListener('click', (event) => {
   const closePlaylistButton = event.target.closest('[data-close-playlist]');

if (
  closePlaylistButton &&
  (
    closePlaylistButton.tagName === 'BUTTON' ||
    event.target === closePlaylistButton
  )
) {
  activePlaylistKey = null;
  render();
  return;
}

const openPlaylistButton = event.target.closest('[data-open-playlist]');

if (openPlaylistButton) {
  activePlaylistKey = openPlaylistButton.dataset.openPlaylist;
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
      const video = getAllVideos().find((item) => item.id === playButton.dataset.play);
      if (video) openPlayer(video);
    }
  });
  document.querySelectorAll('[data-quick-subject]').forEach((button) => button.addEventListener('click', () => {
    const subject = button.dataset.quickSubject;
    selectedSubject = subject === 'Other' ? 'Other' : subject;
    onlySaved = false;
    render();
    document.getElementById('library').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  els.importFile.addEventListener('change', () => importLibraryFile(els.importFile.files?.[0]));

  const mobileMenu = document.getElementById('mobileMenu');
  mobileMenu.addEventListener('click', () => {
    const isOpen = mobileMenu.getAttribute('aria-expanded') === 'true';
    mobileMenu.setAttribute('aria-expanded', String(!isOpen));
    document.querySelector('.main-nav').classList.toggle('menu-open', !isOpen);
    document.querySelector('.main-nav').style.display = isOpen ? '' : 'flex';
  });
  document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => {
    mobileMenu.setAttribute('aria-expanded', 'false');
    document.querySelector('.main-nav').style.display = '';
  }));

  [els.addModal, els.playerModal].forEach((modal) => modal.addEventListener('click', (event) => {
    if (event.target === modal) modal === els.playerModal ? closePlayer() : closeModal(modal);
  }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!els.playerModal.classList.contains('hidden')) closePlayer();
      else if (!els.addModal.classList.contains('hidden')) closeModal(els.addModal);
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
  applyAdminControls();
  render();
  initializeAdminAccess();
})();
