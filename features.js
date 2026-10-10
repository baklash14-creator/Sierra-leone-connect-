/* features.js - SL Connect new features
   1) Verified badge   2) Post expiry + Renew   3) Reviews and stars   4) Krio / English switch
   Loads AFTER app.js and otp-reset.js. Needs the new tables from features.sql. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const E = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAY = 864e5;

  function cloud() {
    try { return (typeof CLOUD !== 'undefined' && CLOUD && typeof sb !== 'undefined' && sb) ? sb : null; } catch (e) { return null; }
  }
  function curUser() { try { return user; } catch (e) { return null; } }
  function allPosts() { try { return posts; } catch (e) { return []; } }
  function curId() { try { return cur; } catch (e) { return null; } }

  /* ====================================================================
     SHARED DATA: who is verified, and the star rating of each post
     ==================================================================== */
  let verified = new Set();
  let rate = {};
  async function loadMeta() {
    const c = cloud(); if (!c) return;
    try {
      const r = await c.from('verified_users').select('user_id').limit(5000);
      if (!r.error) verified = new Set((r.data || []).map((x) => String(x.user_id)));
    } catch (e) {}
    try {
      const r = await c.from('reviews').select('post_id,rating').limit(5000);
      if (!r.error) {
        const m = {};
        (r.data || []).forEach((x) => { const k = String(x.post_id); (m[k] = m[k] || { n: 0, sum: 0 }); m[k].n++; m[k].sum += x.rating; });
        rate = m;
      }
    } catch (e) {}
  }

  const starStr = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  /* ====================================================================
     INSTALL: load posts with expiry, add badges / stars / Renew to cards
     ==================================================================== */
  function install() {
    if (!cloud() || typeof CB === 'undefined') return;

    // posts, with expiry date; hide expired posts from everybody except owner and admin
    CB.posts = async function () {
      const r = await sb.from('posts').select('*').order('created_at', { ascending: false }).limit(500);
      if (r.error) throw r.error;
      await loadMeta();
      const now = Date.now(), u = curUser();
      return r.data
        .map((row) => { const p = fromRow(row); p.exp = row.expires_at ? new Date(row.expires_at).getTime() : null; return p; })
        .filter((p) => !p.exp || p.exp > now || (u && (p.owner === u.id || u.admin)));
    };

    // cards
    const origCard = window.cardHTML;
    window.cardHTML = function (p, i) {
      let h = origCard(p, i);
      try {
        const badge = verified.has(String(p.owner)) ? ' <span class="vbadge" title="Verified">✔ Verified</span>' : '';
        const rt = rate[String(p.id)];
        const stars = rt ? '<div class="rtl"><span class="stars">★</span> ' + (rt.sum / rt.n).toFixed(1) + ' <span class="rn">(' + rt.n + ')</span></div>' : '';
        h = h.replace('</h3>', badge + '</h3>');
        let before = stars;
        let btn = '';
        const u = curUser();
        if (u && p.owner === u.id && p.exp) {
          const left = Math.ceil((p.exp - Date.now()) / DAY);
          if (left <= 0) before += '<div class="exp expired">⏰ Expired. Hidden from others</div>';
          else if (left <= 7) before += '<div class="exp">⏰ Expires in ' + left + ' day' + (left === 1 ? '' : 's') + '</div>';
          if (left <= 7) btn = '<button type="button" class="ghost" data-fx="renew" data-id="' + E(p.id) + '">🔄 Renew 30 days</button>';
        }
        h = h.replace('<div class="by">', before + '<div class="by">');
        const idx = h.lastIndexOf('</div></div></article>');
        if (btn && idx > -1) h = h.slice(0, idx) + btn + h.slice(idx);
      } catch (e) {}
      return h;
    };

    // detail window: badge + reviews
    const origDetail = window.detail;
    window.detail = function (id) {
      origDetail(id);
      try { reviewsFor(id); } catch (e) {}
    };

    // if the first load happened before this file loaded, load again with the new code
    setTimeout(function () {
      try {
        if (curUser() && typeof refreshPosts === 'function') refreshPosts().then(function () { if (typeof refresh === 'function') refresh(); });
      } catch (e) {}
    }, 700);
  }

  /* ====================================================================
     REVIEWS
     ==================================================================== */
  let revPick = 0, revPostId = null;
  function paintPick() {
    document.querySelectorAll('#revPick [data-v]').forEach((b) => { b.textContent = (+b.dataset.v <= revPick) ? '★' : '☆'; });
  }

  async function reviewsFor(id) {
    const c = cloud(); if (!c) return;
    const p = allPosts().find((x) => String(x.id) === String(id)); if (!p) return;
    const body = $('ddBody'); if (!body) return;
    const h2 = body.querySelector('h2');
    if (h2 && verified.has(String(p.owner)) && !h2.querySelector('.vbadge')) h2.insertAdjacentHTML('beforeend', ' <span class="vbadge">✔ Verified</span>');
    if (p.type === 'job') return;
    const db = body.querySelector('.db'); if (!db) return;

    const box = document.createElement('div');
    box.className = 'revbox'; box.id = 'revBox';
    box.innerHTML = '<h3>⭐ Reviews</h3><div class="sub">Loading...</div>';
    const row = db.querySelector(':scope > .row:last-child');
    if (row) db.insertBefore(box, row); else db.appendChild(box);

    const r = await c.from('reviews').select('id,reviewer,reviewer_name,rating,comment,created_at').eq('post_id', p.id).order('created_at', { ascending: false }).limit(50);
    if (!box.isConnected || String(curId()) !== String(id)) return;
    if (r.error) { box.innerHTML = '<h3>⭐ Reviews</h3><div class="sub">Reviews are not set up yet.</div>'; return; }

    const u = curUser(), list = r.data || [];
    const mine = u && list.find((x) => x.reviewer === u.id);
    const n = list.length, avg = n ? list.reduce((s, x) => s + x.rating, 0) / n : 0;
    revPick = mine ? mine.rating : 0; revPostId = p.id;

    let html = '<h3>⭐ Reviews</h3>';
    html += n ? '<div class="rtl big"><span class="stars">' + starStr(Math.round(avg)) + '</span> <b>' + avg.toFixed(1) + '</b> <span class="rn">(' + n + ' review' + (n === 1 ? '' : 's') + ')</span></div>'
              : '<div class="sub">No reviews yet.</div>';
    if (u && p.owner !== u.id) {
      html += '<div class="revform"><div class="pick" id="revPick">' +
        [1, 2, 3, 4, 5].map((i) => '<button type="button" data-fx="star" data-v="' + i + '" aria-label="' + i + ' star">☆</button>').join('') +
        '</div><textarea id="revTxt" rows="2" maxlength="300" placeholder="Write a short comment (optional)">' + E(mine ? (mine.comment || '') : '') + '</textarea>' +
        '<div class="err" id="revErr"></div><button type="button" class="primary" data-fx="sendrev">' + (mine ? 'Update review' : 'Send review') + '</button></div>';
    }
    html += list.map((x) => '<div class="rev"><div class="rh"><b>' + E(x.reviewer_name || 'Member') + '</b> <span class="stars">' + starStr(x.rating) + '</span> <span class="rn">' + new Date(x.created_at).toLocaleDateString() + '</span></div>' +
      (x.comment ? '<div>' + E(x.comment) + '</div>' : '') +
      ((u && (x.reviewer === u.id || u.admin)) ? '<button type="button" class="link" data-fx="delrev" data-rid="' + E(x.id) + '">Delete</button>' : '') + '</div>').join('');
    box.innerHTML = html;
    paintPick();
    if (lang !== 'en') walk(box);
  }

  /* clicks on our own buttons (capture phase, so cards do not open) */
  document.addEventListener('click', async function (e) {
    const b = e.target.closest('[data-fx]'); if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const c = cloud(), u = curUser(), a = b.dataset.fx;
    if (a === 'star') { revPick = +b.dataset.v; paintPick(); return; }
    if (!c || !u) return;
    const say = (t) => { const el = $('revErr'); if (el) el.textContent = t; };

    if (a === 'sendrev') {
      if (revPick < 1) { say(lang === 'en' ? 'Tap the stars first.' : 'Tɔch di sta dɛn fɔs.'); return; }
      const txt = ($('revTxt').value || '').trim();
      b.disabled = true;
      const r = await c.from('reviews').upsert({ post_id: revPostId, reviewer: u.id, reviewer_name: u.name, rating: revPick, comment: txt || null }, { onConflict: 'post_id,reviewer' }).select();
      b.disabled = false;
      if (r.error) { say(/row-level|policy/i.test(r.error.message) ? 'You cannot review your own post.' : r.error.message); return; }
      toast('Thanks for your review ⭐');
      await loadMeta(); refresh();
    } else if (a === 'delrev') {
      b.disabled = true;
      const r = await c.from('reviews').delete().eq('id', b.dataset.rid).select();
      if (r.error || !(r.data && r.data.length)) { b.disabled = false; toast('Could not delete'); return; }
      await loadMeta(); refresh();
    } else if (a === 'renew') {
      b.disabled = true;
      const when = Date.now() + 30 * DAY;
      const r = await c.from('posts').update({ expires_at: new Date(when).toISOString() }).eq('id', b.dataset.id).select();
      if (r.error || !(r.data && r.data.length)) { b.disabled = false; toast('Could not renew. Try again.'); return; }
      const p = allPosts().find((x) => String(x.id) === String(b.dataset.id)); if (p) p.exp = when;
      toast('Renewed for 30 days ✅'); refresh();
    }
  }, true);

  /* ====================================================================
     KRIO / ENGLISH SWITCH
     The words are in this list. Add or fix a line any time: "English": "Krio".
     ==================================================================== */
  const KR = {
    'Home': 'Hom', 'Marketplace': 'Makit', 'My Account': 'Mi Akaunt', 'About': 'Bɔt wi', 'Contact us': 'Kɔntakt wi',
    'Install': 'Instɔl', 'Install app': 'Instɔl di ap', 'Sign in': 'Sayn in', 'Join free': 'Joyn fri', 'Sign out': 'Sayn out',
    'Me': 'Mi', 'Post': 'Pos', 'Market': 'Makit', 'Create account': 'Mek akaunt', 'Create free account': 'Mek fri akaunt',
    'Cancel': 'Kansul', 'Close': 'Klos', 'Back': 'Go bak', '← Back': 'Go bak',
    'Find': 'Fɛn', 'on SL Connect': 'na SL Connect', 'work': 'wɛk', 'skilled workers': 'wɛka dɛn we sabi', 'a home to rent': 'os fɔ rɛnt', 'land to buy': 'land fɔ bay',
    'Workers, people who need services, house owners and land sellers across Sierra Leone, all in one place.': 'Wɛka dɛn, pipul dɛn we nid wɛka, os ɔna dɛn ɛn land sɛla dɛn na ɔl Salone, ɔl na wan ples.',
    'What you can do': 'Wetin yu kin du', 'Find workers': 'Fɛn wɛka dɛn', 'Get work': 'Gɛt wɛk', 'Houses for rent': 'Os dɛn fɔ rɛnt', 'Land for sale': 'Land fɔ sɛl',
    'How it works': 'Aw i de wok', 'Browse or post': 'Luk ɔ pos', 'Connect': 'Kɔnɛkt', 'Ready to get started?': 'Yu rɛdi fɔ stat?', 'Open marketplace': 'Opin di makit',
    'Workers & Services': 'Wɛka dɛn ɛn Sav', 'Jobs Wanted': 'Wɛk dɛn we pipul want', 'Houses for Rent': 'Os dɛn fɔ rɛnt', 'Land for Sale': 'Land fɔ sɛl', 'All': 'Ɔl',
    'Search by name, skill, area...': 'Sɛch bay nem, skil, ples...', 'Newest first': 'Nyu wan dɛn fɔs', 'Oldest first': 'Ol wan dɛn fɔs',
    'Available only': 'Di wan dɛn we de nɔmɔ', 'All locations': 'Ɔl ples dɛn',
    'Call': 'Kɔl', 'Delete': 'Dilit', 'Reopen': 'Opin igen', 'Report this post': 'Ripɔt dis pos', 'Share': 'Shɛa', 'Save': 'Kip', 'Saved': 'Kip dɛn',
    'Worker': 'Wɛka', 'Job needed': 'Wɛk we pipul want', 'For rent': 'Fɔ rɛnt', 'For sale': 'Fɔ sɛl', 'Busy': 'Bizi', 'Filled': 'Dɔn fil', 'Rented': 'Dɔn rɛnt', 'Sold': 'Dɔn sɛl',
    'My listings': 'Mi pos dɛn', 'Welcome back': 'Wɛlkɔm bak', 'Email': 'Imel', 'Email or phone': 'Imel ɔ fon', 'Password': 'Paswɔd', 'Full name': 'Ful nem',
    'Forgot password?': 'Yu fɔgɛt yu paswɔd?', 'New here? Create an account': 'Yu nyu ya? Mek akaunt', 'Already have an account? Sign in': 'Yu dɔn gɛt akaunt? Sayn in',
    'Use your email and password.': 'Yuz yu imel ɛn paswɔd.', 'Free. Sign up with your email.': 'Fri. Sayn ɔp wit yu imel.',
    'Send code': 'Sɛn kod', 'Enter code': 'Put di kod', 'Reset password': 'Chenj paswɔd', 'Send the code again': 'Sɛn di kod igen', 'New password': 'Nyu paswɔd',
    'Settings': 'Setin', 'Profile': 'Prɔfayl', 'Save profile': 'Kip prɔfayl', 'Change email': 'Chenj imel', 'Change password': 'Chenj paswɔd', 'Phone / WhatsApp': 'Fon / WhatsApp', 'New email': 'Nyu imel',
    'Photos': 'Fɔto dɛn', 'Save favourites': 'Kip di wan dɛn we yu lɛk', 'Mark as taken': 'Mak am as tek', 'Smart search': 'Gud sɛch',
    'Meet the founder': 'Mit di fawnda', 'Our mission': 'Wi mishɔn', 'Our values': 'Wi valyu dɛn', 'Stay safe': 'Stɛ sef', 'Send us a message': 'Sɛn wi mɛsej',
    'Reviews': 'Rivyu dɛn', 'Send review': 'Sɛn rivyu', 'Update review': 'Chenj rivyu', 'Verified': 'Vɛrifay', 'No reviews yet.': 'Nɔbɔdi nɔ dɔn rivyu yet.',
    'Write a short comment (optional)': 'Rayt smɔl kɔmɛnt (yu kin lɛf am)', 'Renew 30 days': 'Rinyu fɔ 30 dei', 'Expired. Hidden from others': 'I dɔn ɛkspayr. Ɔda pipul dɛn nɔ de si am',
    'Please sign in first': 'Duya sayn in fɔs', 'Signed out': 'Yu dɔn sayn out', 'You are offline': 'Yu nɔ gɛt intanɛt', 'Back online': 'Yu gɛt intanɛt igen'
  };
  const PAT = [
    [/^Posted by (.+)$/, (m) => 'Pos bay ' + m[1]],
    [/^Expires in (\d+) days?$/, (m) => 'I go dɔn insay ' + m[1] + ' dei'],
    [/^\((\d+) reviews?\)$/, (m) => '(' + m[1] + ' rivyu)']
  ];
  const SPLIT = /^([^\p{L}\p{N}?!.]*)([\s\S]*?)([^\p{L}\p{N}?!.]*)$/u;
  function trText(raw) {
    const m = raw.match(SPLIT); if (!m || !m[2]) return null;
    let t = KR[m[2]];
    if (t === undefined) { for (const [re, fn] of PAT) { const x = m[2].match(re); if (x) { t = fn(x); break; } } }
    return t === undefined ? null : m[1] + t + m[3];
  }

  let lang = 'en';
  try { lang = localStorage.getItem('sl_lang') || 'en'; } catch (e) {}
  const ATTRS = ['placeholder', 'aria-label', 'title'];

  function doText(n) {
    if (n.__o === undefined) n.__o = n.nodeValue;
    if (lang === 'en') { if (n.nodeValue !== n.__o) n.nodeValue = n.__o; return; }
    const t = trText(n.__o);
    if (t !== null && t !== n.nodeValue) n.nodeValue = t;
  }
  function doAttrs(el) {
    ATTRS.forEach((a) => {
      if (!el.hasAttribute || !el.hasAttribute(a)) return;
      const k = '__o_' + a;
      if (el[k] === undefined) el[k] = el.getAttribute(a);
      if (lang === 'en') { if (el.getAttribute(a) !== el[k]) el.setAttribute(a, el[k]); return; }
      const t = trText(el[k]);
      if (t !== null && t !== el.getAttribute(a)) el.setAttribute(a, t);
    });
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentNode && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(root.parentNode.nodeName)) doText(root); return; }
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(root.nodeName)) return;
    doAttrs(root);
    root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(doAttrs);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach(doText);
  }

  const langBtn = document.createElement('button');
  langBtn.id = 'langBtn'; langBtn.type = 'button'; langBtn.className = 'ghost';
  function paintLangBtn() {
    langBtn.textContent = lang === 'en' ? '🌐 EN' : '🌐 KR';
    langBtn.setAttribute('aria-label', lang === 'en' ? 'Switch to Krio' : 'Switch to English');
  }
  function applyLang(l) {
    lang = l;
    try { localStorage.setItem('sl_lang', l); } catch (e) {}
    walk(document.body); paintLangBtn();
  }
  const tb = $('themeBtn');
  if (tb && tb.parentNode) tb.parentNode.insertBefore(langBtn, tb);
  paintLangBtn();
  langBtn.addEventListener('click', () => applyLang(lang === 'en' ? 'kr' : 'en'));

  new MutationObserver(function (ms) {
    if (lang === 'en') return;
    ms.forEach((m) => m.addedNodes.forEach(walk));
  }).observe(document.body, { childList: true, subtree: true });
  if (lang !== 'en') applyLang(lang);

  install();
})();
