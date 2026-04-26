// Lawn Buddy SPA. Vanilla JS, no build step.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const STORAGE_KEY = 'lawnBuddyEmail';
const DEVICE_KEY = 'lawnBuddyDeviceId';

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

const state = {
  email: localStorage.getItem(STORAGE_KEY) || null,
  deviceId: getOrCreateDeviceId(),
  lawns: [],
  currentLawnId: null,
  zones: [],
};

// ---------- API helpers ----------

function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  if (state.email) headers.set('X-User-Email', state.email);
  headers.set('X-Device-Id', state.deviceId);
  if (opts.body && !(opts.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(path, { ...opts, headers }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  });
}

// ---------- Screen routing ----------

function showScreen(id) {
  $$('.screen').forEach((s) => (s.hidden = s.id !== id));
}

function setUserChrome() {
  const info = $('#user-info');
  if (state.email) {
    info.hidden = false;
    $('#user-email').textContent = state.email;
  } else {
    info.hidden = true;
  }
}

// ---------- Sign in ----------

$('#signin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#signin-email').value.trim().toLowerCase();
  if (!email) return;
  state.email = email;
  try {
    // Validate against server before persisting (catches 409 on collision).
    await api('/api/users/me');
    localStorage.setItem(STORAGE_KEY, email);
    setUserChrome();
    await loadLawns();
  } catch (err) {
    state.email = null;
    alert(err.message);
  }
});

$('#sign-out').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  state.email = null;
  state.lawns = [];
  state.currentLawnId = null;
  setUserChrome();
  showScreen('screen-signin');
});

// ---------- Lawn list ----------

async function loadLawns() {
  try {
    const { lawns } = await api('/api/lawns');
    state.lawns = lawns;
    renderLawnList();
    showScreen('screen-lawns');
  } catch (err) {
    alert(`Failed to load lawns: ${err.message}`);
  }
}

function renderLawnList() {
  const grid = $('#lawn-list');
  grid.innerHTML = '';
  $('#lawn-empty').hidden = state.lawns.length > 0;
  for (const lawn of state.lawns) {
    const card = document.createElement('div');
    card.className = 'lawn-card';
    card.innerHTML = `
      <h3></h3>
      <p class="muted"></p>
    `;
    card.querySelector('h3').textContent = lawn.name;
    card.querySelector('p').textContent = lawn.climate_zone.replace(/-/g, ' / ');
    card.addEventListener('click', () => openLawn(lawn.id));
    grid.appendChild(card);
  }
}

$('#btn-new-lawn').addEventListener('click', () => {
  resetOnboardingForm();
  showScreen('screen-onboarding');
});

// ---------- Onboarding ----------

async function loadZones() {
  if (state.zones.length) return;
  const { states } = await api('/api/zones');
  state.zones = states;
  const select = $('#zone-select');
  for (const group of states) {
    const og = document.createElement('optgroup');
    og.label = group.state;
    for (const z of group.zones) {
      const opt = document.createElement('option');
      opt.value = z.id;
      opt.textContent = z.region;
      og.appendChild(opt);
    }
    select.appendChild(og);
  }
}

function resetOnboardingForm() {
  $('#onboarding-form').reset();
}

$('#onboarding-cancel').addEventListener('click', () => {
  showScreen('screen-lawns');
});

$('#estimate-size-btn').addEventListener('click', async () => {
  const files = Array.from($('#onboarding-photos').files);
  if (!files.length) {
    alert('Add one or more photos first, then click Estimate.');
    return;
  }
  const btn = $('#estimate-size-btn');
  const hint = $('#size-hint');
  btn.disabled = true;
  btn.textContent = 'Estimating…';
  hint.hidden = true;
  try {
    const fd = new FormData();
    for (const f of files) fd.append('file', f);
    const res = await api('/api/estimate-size', { method: 'POST', body: fd });
    $('#size-input').value = res.size_sqft;
    hint.hidden = false;
    hint.textContent = `Estimate: ${res.size_sqft} sq ft (${res.confidence} confidence) — ${res.reasoning} You can adjust manually.`;
  } catch (err) {
    alert(`Estimate failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Estimate from photos';
  }
});

$('#onboarding-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const submitBtn = $('#onboarding-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating…';

  try {
    const fd = new FormData(form);
    const issues = $$('#issues-group input:checked').map((el) => el.value);
    const intake = {
      size_sqft: Number(fd.get('size_sqft')),
      sun_exposure: fd.get('sun_exposure'),
      irrigation: fd.get('irrigation'),
      mowing_frequency: fd.get('mowing_frequency'),
      current_issues: issues,
      notes: fd.get('notes') || undefined,
    };
    const soilTest = {};
    for (const [k, v] of fd.entries()) {
      if (k.startsWith('soil_') && v !== '') {
        soilTest[k.replace('soil_', '')] = Number(v);
      }
    }
    const body = {
      name: fd.get('name'),
      climate_zone: fd.get('climate_zone'),
      intake,
      soil_test: Object.keys(soilTest).length ? soilTest : undefined,
    };

    const { lawn } = await api('/api/lawns', { method: 'POST', body: JSON.stringify(body) });

    // Upload photos (if any) before assessment
    const photoFiles = Array.from($('#onboarding-photos').files);
    for (const file of photoFiles) {
      const pf = new FormData();
      pf.append('file', file);
      pf.append('source', 'onboarding');
      await api(`/api/lawns/${lawn.id}/photos`, { method: 'POST', body: pf });
    }

    submitBtn.textContent = 'Analyzing…';
    try {
      await api(`/api/lawns/${lawn.id}/assessment`, { method: 'POST' });
    } catch (err) {
      // Assessment failure shouldn't block lawn creation
      console.warn('assessment failed:', err.message);
    }

    state.lawns.unshift(lawn);
    openLawn(lawn.id);
  } catch (err) {
    alert(`Failed: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save & analyze';
  }
});

// ---------- Lawn dashboard ----------

async function openLawn(lawnId) {
  state.currentLawnId = lawnId;
  const lawn = state.lawns.find((l) => l.id === lawnId);
  $('#lawn-title').textContent = lawn ? lawn.name : 'Lawn';
  showScreen('screen-lawn');
  switchTab('chat');
  await loadMessages();
  await loadNotifications();
}

$('#back-to-lawns').addEventListener('click', () => {
  state.currentLawnId = null;
  loadLawns();
});

$('#delete-lawn').addEventListener('click', async () => {
  if (!confirm('Delete this lawn? Photos and chat history will be removed.')) return;
  try {
    await api(`/api/lawns/${state.currentLawnId}`, { method: 'DELETE' });
    state.lawns = state.lawns.filter((l) => l.id !== state.currentLawnId);
    state.currentLawnId = null;
    loadLawns();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
});

// Tabs
$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

function switchTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('.tab-panel').forEach((p) => (p.hidden = p.id !== `tab-${name}`));
  if (name === 'photos') loadPhotos();
  if (name === 'notifications') loadNotifications();
  if (name === 'details') loadDetailsForm();
}

// ---------- Chat ----------

async function loadMessages() {
  const thread = $('#chat-thread');
  thread.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const { messages } = await api(`/api/lawns/${state.currentLawnId}/messages`);
    renderMessages(messages);
  } catch (err) {
    thread.innerHTML = `<p class="muted">Failed: ${err.message}</p>`;
  }
}

function renderMessages(messages) {
  const thread = $('#chat-thread');
  thread.innerHTML = '';
  for (const m of messages) appendMessage(m);
  thread.scrollTop = thread.scrollHeight;
}

function appendMessage(m) {
  const thread = $('#chat-thread');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${m.role}`;
  const text = document.createElement('div');
  text.className = 'message-body';
  text.innerHTML = renderMarkdown(m.content);
  bubble.appendChild(text);
  if (m.photo_ids && m.photo_ids.length) {
    const photos = document.createElement('div');
    photos.className = 'photos';
    for (const pid of m.photo_ids) {
      const img = document.createElement('img');
      img.src = `/api/lawns/${state.currentLawnId}/photos/${pid}/blob`;
      // Authenticated fetch via fetch API for the img — fall back to blob URL
      fetchAuthorizedBlob(img.src).then((blobUrl) => { img.src = blobUrl; });
      photos.appendChild(img);
    }
    bubble.appendChild(photos);
  }
  thread.appendChild(bubble);
  thread.scrollTop = thread.scrollHeight;
}

// Tiny markdown renderer. HTML-escapes input first so any subsequent regex work
// runs on safe text. Supports: **bold**, *italic*/_italic_, `code`, ordered &
// unordered lists, # headings, --- horizontal rules, paragraphs, soft line breaks.
// Intentionally does not support raw HTML or links (LLM output is untrusted).
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderInline(s) {
  // Code spans first so their contents don't get further processed.
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w_])_(?!\s)([^_\n]+?)(?<!\s)_(?!\w)/g, '$1<em>$2</em>');
  return s;
}

function renderMarkdown(src) {
  if (!src) return '';
  const escaped = escapeHtml(src);
  const lines = escaped.split('\n');
  const out = [];
  let listType = null;
  let paraBuf = [];

  const flushPara = () => {
    if (paraBuf.length) {
      out.push(`<p>${renderInline(paraBuf.join('<br>'))}</p>`);
      paraBuf = [];
    }
  };
  const closeList = () => {
    if (listType) { out.push(`</${listType}>`); listType = null; }
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    const hr = /^---+\s*$/.test(line);
    const blank = line.trim() === '';

    if (heading) {
      flushPara(); closeList();
      const level = Math.min(heading[1].length + 2, 6); // h3..h6 (chat bubble is small)
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
    } else if (hr) {
      flushPara(); closeList();
      out.push('<hr>');
    } else if (ul) {
      flushPara();
      if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
      out.push(`<li>${renderInline(ul[1])}</li>`);
    } else if (ol) {
      flushPara();
      if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
      out.push(`<li>${renderInline(ol[1])}</li>`);
    } else if (blank) {
      flushPara(); closeList();
    } else {
      closeList();
      paraBuf.push(line);
    }
  }
  flushPara(); closeList();
  return out.join('');
}

// img tags can't carry custom headers; fetch as blob via the API and substitute object URL.
async function fetchAuthorizedBlob(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'X-User-Email': state.email,
        'X-Device-Id': state.deviceId,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return ''; // broken image
  }
}

$('#chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = $('#chat-text').value.trim();
  const files = Array.from($('#chat-photo').files);
  if (!content && !files.length) return;

  const sendBtn = $('#chat-send');
  sendBtn.disabled = true;
  $('#chat-thinking').hidden = false;

  try {
    // Upload any chat photos first
    const photoIds = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('source', 'chat');
      const { photo } = await api(`/api/lawns/${state.currentLawnId}/photos`, { method: 'POST', body: fd });
      photoIds.push(photo.id);
    }

    const { user_message, assistant_message } = await api(
      `/api/lawns/${state.currentLawnId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content, photo_ids: photoIds }),
      }
    );
    appendMessage(user_message);
    appendMessage(assistant_message);
    $('#chat-text').value = '';
    $('#chat-photo').value = '';
  } catch (err) {
    alert(`Send failed: ${err.message}`);
  } finally {
    sendBtn.disabled = false;
    $('#chat-thinking').hidden = true;
  }
});

// ---------- Details tab (edit + re-analyze) ----------

const ISSUE_LABELS = {
  bare_spots: 'bare spots',
  weeds: 'weeds',
  discoloration: 'discoloration',
  thinning: 'thinning',
  pests: 'pests',
  disease: 'disease',
  none: 'none',
};

const SUN_LABELS = { full: 'full sun', partial: 'partial', shade: 'shade' };
const IRRIGATION_LABELS = { none: 'none', hose: 'hose & sprinkler', in_ground: 'in-ground sprinklers', drip: 'drip' };
const MOWING_LABELS = { weekly: 'weekly', bi_weekly: 'every 2 weeks', monthly: 'monthly', irregular: 'irregular' };

let detailsZonesPopulated = false;
let detailsLawnSnapshot = null;

function populateDetailsZones() {
  if (detailsZonesPopulated || !state.zones.length) return;
  const select = $('#details-zone-select');
  for (const group of state.zones) {
    const og = document.createElement('optgroup');
    og.label = group.state;
    for (const z of group.zones) {
      const opt = document.createElement('option');
      opt.value = z.id;
      opt.textContent = z.region;
      og.appendChild(opt);
    }
    select.appendChild(og);
  }
  detailsZonesPopulated = true;
}

async function loadDetailsForm() {
  if (!state.currentLawnId) return;
  const lawn = state.lawns.find((l) => l.id === state.currentLawnId);
  if (!lawn) return;

  if (!state.zones.length) await loadZones().catch(() => {});
  populateDetailsZones();

  const intake = lawn.intake || {};
  const soil = lawn.soil_test || {};

  $('#details-name').value = lawn.name || '';
  $('#details-zone-select').value = lawn.climate_zone || '';
  $('#details-size-input').value = intake.size_sqft ?? '';
  $('#details-sun').value = intake.sun_exposure || 'full';
  $('#details-irrigation').value = intake.irrigation || 'none';
  $('#details-mowing').value = intake.mowing_frequency || 'weekly';
  $('#details-notes').value = intake.notes || '';

  const issues = new Set(intake.current_issues || []);
  $$('#details-issues-group input[type=checkbox]').forEach((cb) => {
    cb.checked = issues.has(cb.value);
  });

  const form = $('#details-form');
  for (const key of Object.keys(soil)) {
    const input = form.querySelector(`[name="soil_${key}"]`);
    if (input) input.value = soil[key];
  }
  for (const input of form.querySelectorAll('input[name^="soil_"]')) {
    if (!(input.name.replace('soil_', '') in soil)) input.value = '';
  }

  detailsLawnSnapshot = snapshotForDiff(lawn);
}

function snapshotForDiff(lawn) {
  return JSON.parse(JSON.stringify({
    name: lawn.name,
    climate_zone: lawn.climate_zone,
    intake: lawn.intake || null,
    soil_test: lawn.soil_test || null,
  }));
}

function readDetailsForm() {
  const form = $('#details-form');
  const fd = new FormData(form);
  const issues = $$('#details-issues-group input:checked').map((el) => el.value);
  const intake = {
    size_sqft: Number(fd.get('size_sqft')),
    sun_exposure: fd.get('sun_exposure'),
    irrigation: fd.get('irrigation'),
    mowing_frequency: fd.get('mowing_frequency'),
    current_issues: issues,
    notes: fd.get('notes') || undefined,
  };
  const soilTest = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith('soil_') && v !== '') {
      soilTest[k.replace('soil_', '')] = Number(v);
    }
  }
  return {
    name: fd.get('name'),
    climate_zone: fd.get('climate_zone'),
    intake,
    soil_test: Object.keys(soilTest).length ? soilTest : null,
  };
}

function describeChanges(prev, next) {
  const parts = [];
  if (prev.name !== next.name) parts.push(`name: "${prev.name}" → "${next.name}"`);
  if (prev.climate_zone !== next.climate_zone) parts.push(`region: ${prev.climate_zone} → ${next.climate_zone}`);

  const pi = prev.intake || {};
  const ni = next.intake || {};
  if (pi.size_sqft !== ni.size_sqft) parts.push(`size: ${pi.size_sqft ?? '—'} → ${ni.size_sqft ?? '—'} sq ft`);
  if (pi.sun_exposure !== ni.sun_exposure)
    parts.push(`sun: ${SUN_LABELS[pi.sun_exposure] ?? pi.sun_exposure ?? '—'} → ${SUN_LABELS[ni.sun_exposure] ?? ni.sun_exposure}`);
  if (pi.irrigation !== ni.irrigation)
    parts.push(`irrigation: ${IRRIGATION_LABELS[pi.irrigation] ?? pi.irrigation ?? '—'} → ${IRRIGATION_LABELS[ni.irrigation] ?? ni.irrigation}`);
  if (pi.mowing_frequency !== ni.mowing_frequency)
    parts.push(`mowing: ${MOWING_LABELS[pi.mowing_frequency] ?? pi.mowing_frequency ?? '—'} → ${MOWING_LABELS[ni.mowing_frequency] ?? ni.mowing_frequency}`);

  const prevIssues = new Set(pi.current_issues || []);
  const nextIssues = new Set(ni.current_issues || []);
  const added = [...nextIssues].filter((x) => !prevIssues.has(x));
  const removed = [...prevIssues].filter((x) => !nextIssues.has(x));
  if (added.length) parts.push(`new issues: ${added.map((i) => ISSUE_LABELS[i] ?? i).join(', ')}`);
  if (removed.length) parts.push(`resolved: ${removed.map((i) => ISSUE_LABELS[i] ?? i).join(', ')}`);

  if ((pi.notes || '') !== (ni.notes || '')) parts.push('notes updated');

  const prevSoil = prev.soil_test || {};
  const nextSoil = next.soil_test || {};
  const allKeys = new Set([...Object.keys(prevSoil), ...Object.keys(nextSoil)]);
  const soilParts = [];
  for (const k of allKeys) {
    if (prevSoil[k] !== nextSoil[k]) soilParts.push(`${k} ${prevSoil[k] ?? '—'} → ${nextSoil[k] ?? '—'}`);
  }
  if (soilParts.length) parts.push(`soil: ${soilParts.join(', ')}`);

  return parts.join('; ');
}

$('#details-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('#details-status');
  const submitBtn = $('#details-submit');
  const next = readDetailsForm();
  const prev = detailsLawnSnapshot ?? snapshotForDiff(state.lawns.find((l) => l.id === state.currentLawnId) || {});
  const note = describeChanges(prev, next);

  submitBtn.disabled = true;
  status.hidden = false;
  status.textContent = 'Saving…';

  try {
    const { lawn } = await api(`/api/lawns/${state.currentLawnId}`, {
      method: 'PATCH',
      body: JSON.stringify(next),
    });

    // Update local state so the dashboard, list, and snapshot stay in sync.
    const idx = state.lawns.findIndex((l) => l.id === lawn.id);
    if (idx >= 0) state.lawns[idx] = lawn;
    detailsLawnSnapshot = snapshotForDiff(lawn);
    $('#lawn-title').textContent = lawn.name;

    if (!note) {
      status.textContent = 'Saved. No changes to re-analyze.';
      submitBtn.disabled = false;
      return;
    }

    status.textContent = 'Consulting the almanac…';
    await api(`/api/lawns/${state.currentLawnId}/assessment`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });

    status.textContent = 'Updated. Switching to chat…';
    await loadMessages();
    setTimeout(() => switchTab('chat'), 400);
  } catch (err) {
    status.textContent = `Failed: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Photos tab ----------

async function loadPhotos() {
  const grid = $('#photo-grid');
  grid.innerHTML = '';
  $('#photo-empty').hidden = true;
  try {
    const { photos } = await api(`/api/lawns/${state.currentLawnId}/photos`);
    if (!photos.length) { $('#photo-empty').hidden = false; return; }
    for (const p of photos) {
      const img = document.createElement('img');
      const url = `/api/lawns/${state.currentLawnId}/photos/${p.id}/blob`;
      fetchAuthorizedBlob(url).then((blobUrl) => { img.src = blobUrl; });
      img.alt = `Photo from ${new Date(p.taken_at * 1000).toLocaleDateString()}`;
      grid.appendChild(img);
    }
  } catch (err) {
    grid.innerHTML = `<p class="muted">Failed: ${err.message}</p>`;
  }
}

// ---------- Notifications ----------

function formatRelativeFuture(unixSec) {
  const now = Date.now() / 1000;
  const diffDays = Math.round((unixSec - now) / 86400);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 14) return `in ${diffDays} days`;
  if (diffDays < 60) return `in ${Math.round(diffDays / 7)} weeks`;
  return `in ~${Math.round(diffDays / 30)} months`;
}

function formatAbsolute(unixSec) {
  return new Date(unixSec * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function loadNotifications() {
  if (!state.currentLawnId) return;
  const recentList = $('#notification-list');
  const upcomingList = $('#notif-upcoming-list');
  const upcomingSection = $('#notif-upcoming-section');
  const planning = $('#notif-planning');
  recentList.innerHTML = '';
  upcomingList.innerHTML = '';

  try {
    const { upcoming = [], recent = [] } = await api(`/api/lawns/${state.currentLawnId}/notifications`);

    // Unread badge counts only items the user hasn't seen yet (not previews).
    const unread = recent.filter((n) => !n.read_at);
    const badge = $('#notif-badge');
    if (unread.length) { badge.hidden = false; badge.textContent = unread.length; }
    else { badge.hidden = true; }

    // Upcoming section
    upcomingSection.hidden = upcoming.length === 0;
    for (const n of upcoming) {
      const item = document.createElement('div');
      item.className = 'notification upcoming';
      item.innerHTML = `
        <div class="when"></div>
        <h3></h3>
        <div class="body"></div>
        <div class="meta"></div>
      `;
      item.querySelector('h3').textContent = n.title;
      item.querySelector('.body').textContent = n.body;
      item.querySelector('.when').textContent =
        `${formatRelativeFuture(n.scheduled_for)} · ${formatAbsolute(n.scheduled_for)}`;
      item.querySelector('.meta').textContent = `${n.type} · scheduled`;
      upcomingList.appendChild(item);
    }

    // Recent section
    $('#notification-empty').hidden = recent.length > 0 || upcoming.length > 0;
    if (recent.length === 0 && upcoming.length > 0) {
      // We have a plan but nothing has fired yet — soften the empty copy.
      $('#notification-empty').hidden = true;
    }
    for (const n of recent) {
      const item = document.createElement('div');
      item.className = `notification ${n.read_at ? '' : 'unread'}`;
      item.innerHTML = `
        <h3></h3>
        <div class="body"></div>
        <div class="meta"></div>
      `;
      item.querySelector('h3').textContent = n.title;
      item.querySelector('.body').textContent = n.body;
      item.querySelector('.meta').textContent =
        `${n.type} · ${new Date(n.sent_at * 1000).toLocaleDateString()}`;
      if (!n.read_at) {
        item.style.cursor = 'pointer';
        item.addEventListener('click', async () => {
          await api(`/api/lawns/${state.currentLawnId}/notifications/${n.id}/read`, { method: 'POST' });
          loadNotifications();
        });
      }
      recentList.appendChild(item);
    }

    // Drafting indicator: brand new lawn, plan hasn't landed yet.
    const lawn = state.lawns.find((l) => l.id === state.currentLawnId);
    const ageSeconds = lawn ? Date.now() / 1000 - lawn.created_at : Infinity;
    const planning_visible = upcoming.length === 0 && recent.length === 0 && ageSeconds < 60;
    planning.hidden = !planning_visible;
    if (planning_visible) {
      // Re-poll once for the freshly-generated plan.
      setTimeout(loadNotifications, 4000);
    }
  } catch (err) {
    recentList.innerHTML = `<p class="muted">Failed: ${err.message}</p>`;
  }
}

// ---------- Boot ----------

(async function boot() {
  setUserChrome();
  await loadZones().catch(() => { /* zones load is best-effort on signin screen */ });
  if (state.email) await loadLawns();
  else showScreen('screen-signin');
})();
