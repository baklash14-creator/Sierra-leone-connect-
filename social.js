/* social.js - SL Connect new features
   1) Profile pictures   2) Neighbour trust (public profile + vouches)
   Works together with chat.js (your existing chat). Load AFTER chat.js.
   Needs social.sql to be run once in Supabase. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const E = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cloud = () => { try { return (typeof CLOUD !== 'undefined' && CLOUD && typeof sb !== 'undefined' && sb) ? sb : null; } catch (e) { return null; } };
  const me = () => { try { return user; } catch (e) { return null; } };
  const allPosts = () => { try { return posts; } catch (e) { return []; } };
  const say = (m) => { try { toast(m); } catch (e) {} };
  const safeUrl = (u) => (/^https:\/\//.test(u || '') ? u : '');
  const notReady = (err) => /relation|does not exist|schema cache|could not find|function|not found/i.test((err && err.message) || '');
  const SETUP_MSG = 'This feature is being set up. Please try again later.';

  /* ====================================================================
     MEMBER CARDS: name, picture, vouch count for every poster
     ==================================================================== */
  const cards = {};
  async function loadCards(ids) {
    const c = cloud(); if (!c) return;
    ids = [...new Set((ids || []).filter(Boolean).map(String))];
    for (let i = 0; i < ids.length; i += 200) {
      const r = await c.rpc('member_cards', { ids: ids.slice(i, i + 200) });
      if (r.error) return;
      (r.data || []).forEach((x) => {
        cards[String(x.id)] = { name: x.name || '', avatar: safeUrl(x.avatar_url), vouches: Number(x.vouches) || 0, verified: !!x.verified };
      });
    }
  }
  const cardOf = (id) => cards[String(id)] || {};

  function trust(n) {
    if (n >= 6) return { lvl: 3, label: 'Highly trusted', icon: '🏅' };
    if (n >= 3) return { lvl: 2, label: 'Trusted', icon: '🤝' };
    if (n >= 1) return { lvl: 1, label: 'Vouched', icon: '👍' };
    return null;
  }
  function tBadge(n) {
    const t = trust(n); if (!t) return '';
    return '<span class="tbadge t' + t.lvl + '" title="' + n + ' neighbour vouch' + (n === 1 ? '' : 'es') + '">' + t.icon + ' ' + t.label + '</span>';
  }
  function avHTML(id, name, size) {
    const c = cardOf(id), nm = c.name || name || '?', u = c.avatar;
    return u ? '<img class="pav ' + (size || '') + '" src="' + E(u) + '" alt="" loading="lazy">'
             : '<span class="pav ini ' + (size || '') + '">' + E((String(nm).trim()[0] || '?').toUpperCase()) + '</span>';
  }
  function fmt(ts) {
    const d = new Date(ts), n = new Date();
    return d.toDateString() === n.toDateString()
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  /* ====================================================================
     HOOKS: posts, cards, detail window, header, account page
     ==================================================================== */
  function byHTML(p) {
    const c = cardOf(p.owner), nm = c.name || p.by || 'Member';
    return '<div class="by byrow" data-sx="prof" data-uid="' + E(p.owner) + '" role="button" tabindex="0">' +
      avHTML(p.owner, nm, 'sm') + '<span>Posted by ' + E(nm) + '</span>' + tBadge(c.vouches || 0) + '</div>';
  }

  function install() {
    if (!cloud() || typeof CB === 'undefined') return;

    const op = CB.posts;
    CB.posts = async function () {
      const list = await op.apply(this, arguments);
      try { await loadCards(list.map((p) => p.owner).concat(me() ? [me().id] : [])); } catch (e) {}
      return list;
    };

    const oc = window.cardHTML;
    window.cardHTML = function (p, i) {
      let h = oc(p, i);
      try { h = h.replace(/<div class="by">[\s\S]*?<\/div>/, byHTML(p)); } catch (e) {}
      return h;
    };

    const od = window.detail;
    window.detail = function (id) {
      od(id);
      try {
        const p = allPosts().find((x) => String(x.id) === String(id)); if (!p) return;
        const by = document.querySelector('#ddBody .db .by'); if (by) by.outerHTML = byHTML(p);
      } catch (e) {}
    };

    const oa = window.renderAccount;
    window.renderAccount = function () { oa.apply(this, arguments); try { decorateAccount(); } catch (e) {} };

    const oh = window.renderHeader;
    window.renderHeader = function () { oh.apply(this, arguments); try { paintChip(); } catch (e) {} };
  }

  function paintChip() {
    const u = me(); if (!u) return;
    const a = cardOf(u.id).avatar, chip = document.querySelector('#auth .chip .av');
    if (chip && a) chip.outerHTML = '<img class="pav" src="' + E(a) + '" alt="">';
  }
  function decorateAccount() {
    const u = me(), prof = $('prof'); if (!u || !prof) return;
    const a = prof.querySelector('.av'); if (!a) return;
    const w = document.createElement('div'); w.className = 'pavwrap';
    w.innerHTML = avHTML(u.id, u.name, 'lg') + '<button type="button" class="pcam" data-sx="avatar" aria-label="Change profile photo">📷</button>';
    a.replaceWith(w);
    const h2 = prof.querySelector('h2');
    if (h2) h2.insertAdjacentHTML('afterend', '<div class="bdg">' + tBadge(cardOf(u.id).vouches || 0) + '</div><button type="button" class="link" data-sx="prof" data-uid="' + E(u.id) + '">View my public profile</button>');
  }
  function repaintMine() {
    paintChip();
    try { refresh(); } catch (e) {}
  }

  /* ====================================================================
     PROFILE PICTURE
     ==================================================================== */
  const avIn = document.createElement('input');
  avIn.type = 'file'; avIn.accept = 'image/*'; avIn.hidden = true; avIn.id = 'avIn';
  document.body.appendChild(avIn);

  function cropSquare(file, size) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        try {
          const s = Math.min(im.width, im.height), cv = document.createElement('canvas');
          cv.width = cv.height = size;
          cv.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, size, size);
          URL.revokeObjectURL(url); res(cv.toDataURL('image/jpeg', 0.82));
        } catch (e) { rej(e); }
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
      im.src = url;
    });
  }
  avIn.addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    const c = cloud(), u = me(); if (!f || !c || !u) return;
    if (f.size > 20 * 1024 * 1024) { say('That photo is too big. Pick a smaller one.'); return; }
    say('Uploading photo...');
    try {
      const d = await cropSquare(f, 320);
      const url = await CB.upload(d, u.id + '/avatar');
      const r = await c.rpc('set_my_avatar', { p_url: url });
      if (r.error) throw r.error;
      cards[String(u.id)] = Object.assign({ name: u.name, vouches: 0, verified: false }, cards[String(u.id)], { avatar: safeUrl(url) });
      repaintMine(); say('Profile photo updated ✅');
    } catch (err) {
      say(notReady(err) ? SETUP_MSG : 'Could not update your photo. Try again.');
    }
  });

  /* ====================================================================
     PROFILE VIEW + NEIGHBOUR TRUST
     ==================================================================== */
  document.body.insertAdjacentHTML('beforeend', '<dialog id="profDlg"><div class="pf" id="pfBody"></div></dialog>');
  const profDlg = $('profDlg');

  // true when the two people already have a chat with at least one message (same rule the database enforces)
  async function hadContact(a, b) {
    const c = cloud(); if (!c) return false;
    const r = await c.from('conversations').select('id', { count: 'exact', head: true })
      .or('and(buyer.eq.' + a + ',seller.eq.' + b + '),and(buyer.eq.' + b + ',seller.eq.' + a + ')')
      .not('last_msg', 'is', null);
    return !r.error && (r.count || 0) > 0;
  }

  async function openProfile(id) {
    const c = cloud(), u = me(); if (!c || !u) return;
    id = String(id);
    const body = $('pfBody');
    body.innerHTML = '<div class="empty">Loading...</div>';
    if (!profDlg.open) profDlg.showModal();
    await loadCards([id]);
    const [vr, contact] = await Promise.all([
      c.from('vouches').select('id,voucher,voucher_name,area,note,created_at').eq('vouchee', id).order('created_at', { ascending: false }).limit(30),
      id !== String(u.id) ? hadContact(u.id, id) : Promise.resolve(false)
    ]);
    const list = vr.error ? [] : (vr.data || []);
    const card = cardOf(id), theirs = allPosts().filter((p) => String(p.owner) === id);
    const nm = card.name || (theirs[0] && theirs[0].by) || 'Member';
    const isMe = id === String(u.id), vouched = list.some((v) => String(v.voucher) === String(u.id));
    const n = Math.max(card.vouches || 0, list.length), t = trust(n);
    const chatOn = !!$('chatBtn');   // chat.js is loaded

    let h = '<div class="pfh">' + avHTML(id, nm, 'lg') + '<div><h2>' + E(nm) + '</h2><div class="bdg">' +
      (card.verified ? '<span class="vbadge">✔ Verified</span>' : '') + (t ? tBadge(n) : '<span class="tbadge t0">New member</span>') + '</div>' +
      '<div class="meta">' + n + ' neighbour vouch' + (n === 1 ? '' : 'es') + ' · ' + theirs.length + ' listing' + (theirs.length === 1 ? '' : 's') + '</div></div></div>';

    h += '<div class="acts">';
    if (!isMe && chatOn && theirs.length) h += '<button type="button" class="primary" data-sx="chat" data-pid="' + E(theirs[0].id) + '">💬 Chat</button>';
    if (!isMe && contact && !vouched) h += '<button type="button" class="ghost" data-sx="vouchform">🤝 Vouch for ' + E(nm.split(' ')[0]) + '</button>';
    h += '<button type="button" class="ghost" data-sx="pfclose">Close</button></div>';

    if (!isMe && vouched) h += '<div class="hint ok">You vouched for this person ✓</div>';
    else if (!isMe && !contact) h += '<div class="hint">You can vouch for someone after you have chatted with them in the app. Open one of their listings and tap Chat.</div>';
    if (!isMe && contact && !vouched) {
      h += '<div class="vform" id="pfVouch" hidden><label>Area <input id="vArea" maxlength="80" placeholder="e.g. Kissy, Freetown"></label>' +
        '<label>What did they do for you? <textarea id="vNote" rows="2" maxlength="200" placeholder="e.g. Fixed my wiring and came on time"></textarea></label>' +
        '<div class="err" id="vErr"></div><button type="button" class="primary" data-sx="sendvouch" data-uid="' + E(id) + '">Send vouch</button></div>';
    }

    h += '<h3 class="pfs">What neighbours say</h3>';
    h += list.length ? list.map((v) => '<div class="vitem"><div class="vh"><b>' + E(v.voucher_name || 'Member') + '</b>' +
      (v.area ? ' <span class="rn">· ' + E(v.area) + '</span>' : '') + ' <span class="rn">' + fmt(v.created_at) + '</span></div><div>' + E(v.note) + '</div>' +
      ((String(v.voucher) === String(u.id) || u.admin) ? '<button type="button" class="link" data-sx="delvouch" data-vid="' + E(v.id) + '" data-uid="' + E(id) + '">Remove</button>' : '') + '</div>').join('')
      : '<div class="sub">No vouches yet.</div>';
    h += '<div class="sub small">Vouches come from neighbours and clients who chatted with this person in the app.</div>';

    if (theirs.length) {
      h += '<h3 class="pfs">Listings</h3>' + theirs.slice(0, 6).map((p) =>
        '<button type="button" class="crow" data-sx="open" data-pid="' + E(p.id) + '"><div class="cr"><div class="cn"><b>' + E(p.title) + '</b></div><div class="cs">📍 ' + E(p.loc) + (p.price ? ' · ' + E(p.price) : '') + '</div></div></button>').join('');
    }
    body.innerHTML = h;
  }

  async function sendVouch(id) {
    const c = cloud(), u = me(); if (!c || !u) return;
    const area = ($('vArea').value || '').trim(), note = ($('vNote').value || '').trim();
    const err = (m) => { $('vErr').textContent = m; };
    if (note.length < 3) { err('Write a short note about what they did for you.'); return; }
    const r = await c.from('vouches').insert({ voucher: u.id, vouchee: id, area: area || null, note: note });
    if (r.error) {
      const m = r.error.message || '';
      err(/duplicate|unique/i.test(m) ? 'You already vouched for this person.' : /row-level|policy/i.test(m) ? 'Chat with them first, then you can vouch.' : notReady(r.error) ? SETUP_MSG : 'Could not send. Try again.');
      return;
    }
    say('Thank you. Your vouch is saved 🤝');
    await loadCards([id]); await openProfile(id);
    try { refresh(); } catch (e) {}
  }

  /* ====================================================================
     CLICKS (capture phase so listing cards do not open underneath)
     ==================================================================== */
  document.addEventListener('click', async function (e) {
    const b = e.target.closest('[data-sx]'); if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const a = b.dataset.sx;
    if (a === 'avatar') { avIn.click(); return; }
    if (a === 'prof') { openProfile(b.dataset.uid); return; }
    if (a === 'open') { profDlg.close(); try { detail(b.dataset.pid); } catch (_) {} return; }
    if (a === 'pfclose') { profDlg.close(); return; }
    if (a === 'chat') {
      // hand over to chat.js: it starts (or reopens) the chat about this listing
      profDlg.close();
      const t = document.createElement('button');
      t.type = 'button'; t.hidden = true; t.dataset.chat = b.dataset.pid;
      document.body.appendChild(t); t.click(); t.remove();
      return;
    }
    if (a === 'vouchform') { const f = $('pfVouch'); if (f) { f.hidden = !f.hidden; if (!f.hidden) $('vArea').focus(); } return; }
    if (a === 'sendvouch') { b.disabled = true; await sendVouch(b.dataset.uid); b.disabled = false; return; }
    if (a === 'delvouch') {
      const c = cloud(); if (!c) return;
      const r = await c.from('vouches').delete().eq('id', b.dataset.vid).select();
      if (r.error || !(r.data && r.data.length)) { say('Could not remove. Try again.'); return; }
      await loadCards([b.dataset.uid]); openProfile(b.dataset.uid); try { refresh(); } catch (_) {}
    }
  }, true);

  // open a profile from the keyboard too
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const b = e.target.closest && e.target.closest('[data-sx="prof"]');
    if (b && b.getAttribute('role') === 'button') { e.preventDefault(); b.click(); }
  });

  /* ====================================================================
     SIGN-IN WATCHER: load my own picture and trust level after sign-in
     ==================================================================== */
  let curUid = null;
  setInterval(() => {
    const u = me(), id = u ? u.id : null;
    if (id === curUid) return;
    curUid = id;
    if (!id) { if (profDlg.open) profDlg.close(); return; }
    loadCards([id]).then(() => {
      paintChip();
      try { if ($('p-account').classList.contains('show')) renderAccount(); } catch (e) {}
    });
  }, 800);

  install();
})();
