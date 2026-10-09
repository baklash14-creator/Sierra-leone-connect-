// otp-reset.js - Forgot password page with a  email code
// Loads AFTER app.js. The Supabase "Reset password" email template must contain {{ .Token }}

(function () {
  // Uses the Supabase client "sb" created in backend.js
  function client() {
    try { return (typeof sb !== 'undefined' && sb) ? sb : null; } catch (e) { return null; }
  }
  const NOT_READY = 'Cloud is not connected. Check that config.js has your SUPABASE_URL and SUPABASE_ANON_KEY, then refresh.';

  const $ = (id) => document.getElementById(id);
  const dlg = $('fpDlg'), forgot = $('forgot');
  if (!dlg || !forgot) return;

  function say(id, text, ok) {
    const e = $(id);
    e.textContent = text || '';
    e.style.color = ok ? '#1eb53a' : '';
  }

  function step(n) {
    $('fp1').hidden = n !== 1;
    $('fp2').hidden = n !== 2;
    // restart the slide animation
    const el = $(n === 1 ? 'fp1' : 'fp2');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }

  async function sendCode() {
    const email = $('fpEmail').value.trim();
    if (!email || !email.includes('@')) { say('fpErr1', 'Enter a valid email.'); return false; }
    const sb = client();
    if (!sb) { say('fpErr1', NOT_READY); return false; }
    $('fpSend').disabled = true;
    const { error } = await sb.auth.resetPasswordForEmail(email);
    $('fpSend').disabled = false;
    if (error) { say('fpErr1', error.message); return false; }
    $('fpSub').textContent = 'We sent a code to ' + email + '. Check your inbox and spam.';
    return true;
  }

  // Click "Forgot password?" -> open the Forgot password page
  // app.js sets forgot.onclick (old email-link reset). Replace it with the code page.
  forgot.onclick = function (ev) {
    if (ev) ev.preventDefault();
    const typed = ($('aid').value || '').trim();
    const ad = $('authDlg'); if (ad && ad.open) ad.close();
    $('fpEmail').value = typed.includes('@') ? typed : '';
    say('fpErr1', ''); say('fpErr2', '');
    step(1);
    if (!dlg.open) dlg.showModal();
  };

  // Step 1: send code
  $('fpF').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (!$('fp1').hidden && await sendCode()) { say('fpErr2', ''); step(2); }
  });

  $('fpCancel').addEventListener('click', () => dlg.close());
  $('fpBack').addEventListener('click', () => step(1));

  $('fpResend').addEventListener('click', async function () {
    say('fpErr2', 'Sending...');
    if (await sendCode()) say('fpErr2', 'New code sent!', true);
    else say('fpErr2', $('fpErr1').textContent);
  });

  // Step 2: check code, save new password
  $('rBtn').addEventListener('click', async function () {
    const email = $('fpEmail').value.trim();
    const code = $('rcode').value.trim();
    const pass = $('rnew').value;
    if (code.length !== 8) { say('fpErr2', 'Enter the 8-digit code from your email.'); return; }
    if (pass.length < 6) { say('fpErr2', 'Password must be at least 6 characters.'); return; }
    const sb = client();
    if (!sb) { say('fpErr2', NOT_READY); return; }

    $('rBtn').disabled = true;
    const v = await sb.auth.verifyOtp({ email: email, token: code, type: 'recovery' });
    if (v.error) { say('fpErr2', v.error.message); $('rBtn').disabled = false; return; }
    setTimeout(function () { const o = $('pwDlg'); if (o && o.open) o.close(); }, 50);
    const u = await sb.auth.updateUser({ password: pass });
    $('rBtn').disabled = false;
    if (u.error) { say('fpErr2', u.error.message); return; }

    const old = $('pwDlg'); if (old && old.open) old.close();
    say('fpErr2', 'Password changed! You are signed in. ✅', true);
    setTimeout(function () { dlg.close(); location.reload(); }, 1300);
  });
})();


// ======================================================================
// Full-page look for "Forgot password" + a Settings page
// (change profile, change email, change password)
// ======================================================================
(function () {
  const $ = (id) => document.getElementById(id);
  function client() { try { return (typeof sb !== 'undefined' && sb) ? sb : null; } catch (e) { return null; } }
  const NOT_READY = 'Cloud is not connected. Check config.js, then refresh.';

  // ---- styles: make both screens full pages ----
  const css = document.createElement('style');
  css.textContent = `
    #fpDlg,#stDlg{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;padding:0!important;overflow:auto;box-shadow:none!important}
    #fpDlg form,#stDlg form{max-width:460px!important;width:100%;margin:0 auto!important;padding:14px 20px 48px!important;box-shadow:none!important;border:0!important;background:transparent!important;display:block}
    .pgbar{display:flex;align-items:center;gap:12px;margin:0 0 16px;padding:6px 0}
    .pgbar h2{margin:0!important;font-size:20px}
    .stcard{border:1px solid rgba(128,128,128,.3);border-radius:12px;padding:14px 16px;margin:0 0 16px;animation:fpIn .35s ease both}
    .stcard h3{margin:0 0 8px}
    #stDlg[open]{animation:fpPop .3s ease both}
  `;
  document.head.appendChild(css);

  // ---- back arrow on the Forgot password page ----
  const fpF = $('fpF');
  if (fpF && !$('fpTop')) {
    const bar = document.createElement('div');
    bar.className = 'pgbar';
    bar.innerHTML = '<button type="button" class="ghost" id="fpTop">← Back</button>';
    fpF.insertBefore(bar, fpF.firstChild);
    $('fpTop').addEventListener('click', () => $('fpDlg').close());
  }

  // ---- Settings page ----
  const st = document.createElement('dialog');
  st.id = 'stDlg';
  st.innerHTML = `
  <form id="stF" novalidate onsubmit="return false">
    <div class="pgbar"><button type="button" class="ghost" id="stBack">← Back</button><h2>Settings</h2></div>

    <div class="stcard">
      <h3>👤 Profile</h3>
      <label>Full name <input id="stName" placeholder="e.g. Fatmata Kamara"></label>
      <label>Phone / WhatsApp <input id="stPhone" inputmode="tel" placeholder="+23276123456"></label>
      <div class="err" id="stE1"></div>
      <div class="row"><button type="button" class="primary" id="stSaveP">Save profile</button></div>
    </div>

    <div class="stcard">
      <h3>✉️ Email</h3>
      <p class="sub" id="stCur"></p>
      <label>New email <input id="stEmail" type="email" autocomplete="email" placeholder="new@email.com"></label>
      <div class="err" id="stE2"></div>
      <div class="row"><button type="button" class="primary" id="stSaveE">Change email</button></div>
    </div>

    <div class="stcard">
      <h3>🔒 Password</h3>
      <label>New password <input id="stPass" type="password" minlength="6" autocomplete="new-password" placeholder="At least 6 characters"></label>
      <div class="err" id="stE3"></div>
      <div class="row"><button type="button" class="primary" id="stSaveW">Change password</button></div>
    </div>
  </form>`;
  document.body.appendChild(st);

  function say(id, text, ok) { const e = $(id); e.textContent = text || ''; e.style.color = ok ? '#1eb53a' : ''; }

  async function openSettings() {
    const sb = client();
    ['stE1', 'stE2', 'stE3'].forEach(i => say(i, ''));
    $('stEmail').value = ''; $('stPass').value = '';
    if (!st.open) st.showModal();
    if (!sb) { say('stE1', NOT_READY); return; }
    const { data } = await sb.auth.getSession();
    const u = data && data.session && data.session.user;
    if (!u) { say('stE1', 'Please sign in first.'); return; }
    const md = u.user_metadata || {};
    $('stName').value = md.name || '';
    $('stPhone').value = md.phone || '';
    $('stCur').textContent = 'Your email: ' + u.email;
    try {
      const p = await sb.from('profiles').select('name,phone').eq('id', u.id).maybeSingle();
      if (p.data) { if (p.data.name) $('stName').value = p.data.name; if (p.data.phone) $('stPhone').value = p.data.phone; }
    } catch (e) {}
  }

  $('stBack').addEventListener('click', () => st.close());

  $('stSaveP').addEventListener('click', async function () {
    const sb = client(); if (!sb) { say('stE1', NOT_READY); return; }
    const name = $('stName').value.trim(), phone = $('stPhone').value.trim();
    if (!name) { say('stE1', 'Enter your name.'); return; }
    this.disabled = true; say('stE1', 'Saving...');
    const { data } = await sb.auth.getSession();
    const u = data && data.session && data.session.user;
    if (!u) { say('stE1', 'Please sign in again.'); this.disabled = false; return; }
    const a = await sb.auth.updateUser({ data: { name: name, phone: phone } });
    const b = await sb.from('profiles').upsert({ id: u.id, name: name, phone: phone });
    this.disabled = false;
    if (a.error || b.error) { say('stE1', (a.error || b.error).message); return; }
    say('stE1', 'Profile saved ✅', true);
    setTimeout(() => location.reload(), 900);
  });

  $('stSaveE').addEventListener('click', async function () {
    const sb = client(); if (!sb) { say('stE2', NOT_READY); return; }
    const email = $('stEmail').value.trim().toLowerCase();
    if (!email || !email.includes('@')) { say('stE2', 'Enter a valid email.'); return; }
    this.disabled = true; say('stE2', 'Sending...');
    const { error } = await sb.auth.updateUser({ email: email }, { emailRedirectTo: location.origin + location.pathname });
    this.disabled = false;
    if (error) { say('stE2', error.message); return; }
    say('stE2', 'Check your email. Open the link we sent to confirm the change (check the old email too).', true);
  });

  $('stSaveW').addEventListener('click', async function () {
    const sb = client(); if (!sb) { say('stE3', NOT_READY); return; }
    const pass = $('stPass').value;
    if (pass.length < 6) { say('stE3', 'Password must be at least 6 characters.'); return; }
    this.disabled = true; say('stE3', 'Saving...');
    const { error } = await sb.auth.updateUser({ password: pass });
    this.disabled = false;
    if (error) { say('stE3', error.message); return; }
    $('stPass').value = '';
    say('stE3', 'Password changed ✅', true);
  });

  // ---- put a "Settings" button next to the user's account button ----
  let logged = false;
  function syncBtn() {
    const a = $('auth'); if (!a) return;
    const b = $('stBtn');
    if (!logged) { if (b) b.remove(); return; }
    if (b) return;
    const btn = document.createElement('button');
    btn.id = 'stBtn'; btn.className = 'ghost'; btn.type = 'button';
    btn.textContent = '⚙ Settings';
    btn.addEventListener('click', openSettings);
    a.prepend(btn);
  }
  const authEl = $('auth');
  if (authEl) new MutationObserver(syncBtn).observe(authEl, { childList: true });

  const sb0 = client();
  if (sb0) {
    sb0.auth.getSession().then(r => { logged = !!(r.data && r.data.session); syncBtn(); });
    sb0.auth.onAuthStateChange((ev, session) => { logged = !!session; syncBtn(); });
  }
})();


// ======================================================================
// ADMIN DASHBOARD  (only shown to accounts listed in the "admins" table)
// Overview, all posts, reports, members, CSV download
// ======================================================================
(function () {
  const $ = (id) => document.getElementById(id);
  function client() { try { return (typeof sb !== 'undefined' && sb) ? sb : null; } catch (e) { return null; } }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TYPES = { service: 'Worker', job: 'Job needed', rent: 'For rent', land: 'For sale' };
  const POLICY_SQL = `create policy "admins read profiles" on public.profiles for select
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "admins manage posts" on public.posts for all
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));`;

  let posts = [], tab = 'overview', isAdmin = false, emailTarget = null;

  const css = document.createElement('style');
  css.textContent = `
    #adDlg{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;padding:0!important;overflow:auto;box-shadow:none!important}
    #adDlg .adwrap{max-width:900px;margin:0 auto;padding:14px 20px 60px}
    #adDlg[open]{animation:fpPop .3s ease both}
    .adstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px}
    .adstats .stcard{margin:0;text-align:center}
    .adstats b{display:block;font-size:26px}
    .adstats span{font-size:13px;opacity:.75}
    .adrow{border:1px solid rgba(128,128,128,.3);border-radius:12px;padding:12px 14px;margin:0 0 10px;animation:fpIn .3s ease both}
    .adrow h4{margin:0 0 4px;font-size:16px}
    .adrow .m{font-size:13px;opacity:.75;margin-bottom:8px;word-break:break-word}
    .adrow .btns{display:flex;gap:8px;flex-wrap:wrap}
    .adbar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}
    .adbar input,.adbar select{flex:1;min-width:140px}
    .adnote{padding:12px 14px;border:1px dashed rgba(128,128,128,.5);border-radius:12px;font-size:14px;margin:0 0 12px}
    .adnote pre{white-space:pre-wrap;word-break:break-word;font-size:12px;margin:8px 0 0}
    #annBar{display:flex;gap:12px;align-items:center;justify-content:center;background:#1eb53a;color:#fff;padding:8px 14px;font-size:14px;text-align:center}
    #annBar button{background:transparent;border:0;color:#fff;font-size:20px;line-height:1;cursor:pointer;padding:0 4px}
    #adMsg{display:none;position:sticky;top:0;z-index:5;background:Canvas;color:CanvasText}
  `;
  document.head.appendChild(css);

  const dlg = document.createElement('dialog');
  dlg.id = 'adDlg';
  dlg.innerHTML = `
    <div class="adwrap">
      <div class="pgbar"><button type="button" class="ghost" id="adBack">← Back</button><h2>🛡 Admin</h2></div>
      <div id="adMsg" class="adnote"></div>
      <nav class="tabs" id="adTabs">
        <button type="button" class="tab on" data-ad="overview">Overview</button>
        <button type="button" class="tab" data-ad="posts">Posts</button>
        <button type="button" class="tab" data-ad="reports">Reports</button>
        <button type="button" class="tab" data-ad="members">Members</button>
        <button type="button" class="tab" data-ad="email">Email</button>
        <button type="button" class="tab" data-ad="announce">Announce</button>
      </nav>
      <div id="adBody"></div>
    </div>`;
  document.body.appendChild(dlg);

  let msgTimer;
  function note(m) {
    const el = $('adMsg'); el.textContent = m; el.style.display = 'block';
    clearTimeout(msgTimer); msgTimer = setTimeout(() => { el.style.display = 'none'; }, 4500);
  }

  async function loadPosts() {
    const sb = client(); if (!sb) return 'Cloud is not connected.';
    const r = await sb.from('posts').select('*').order('created_at', { ascending: false }).limit(1000);
    if (r.error) { posts = []; return r.error.message; }
    posts = r.data || []; return '';
  }

  // ---------------- Overview ----------------
  async function viewOverview(body) {
    body.innerHTML = '<p class="sub">Loading...</p>';
    const sb = client();
    const err = await loadPosts();
    let members = '—', reps = '—';
    try { const m = await sb.from('profiles').select('id', { count: 'exact', head: true }); if (!m.error && m.count != null) members = m.count; } catch (e) {}
    try { const r = await sb.from('reports').select('id', { count: 'exact', head: true }); if (!r.error && r.count != null) reps = r.count; } catch (e) {}
    const week = Date.now() - 7 * 864e5;
    const open = posts.filter(p => p.status !== 'taken').length;
    const byType = (t) => posts.filter(p => p.type === t).length;
    const newW = posts.filter(p => new Date(p.created_at).getTime() > week).length;
    const tile = (n, l) => `<div class="stcard"><b>${n}</b><span>${l}</span></div>`;
    const loc = {};
    posts.forEach(p => { const k = (p.loc || '').trim(); if (k) loc[k] = (loc[k] || 0) + 1; });
    const top = Object.entries(loc).sort((a, b) => b[1] - a[1]).slice(0, 5);
    body.innerHTML =
      (err ? `<div class="adnote">Could not load posts: ${esc(err)}</div>` : '') +
      '<div class="adstats">' + tile(posts.length, 'Total posts') + tile(open, 'Open') + tile(posts.length - open, 'Taken / filled') +
      tile(newW, 'New this week') + tile(members, 'Members') + tile(reps, 'Reports') + '</div>' +
      '<div class="adstats">' + Object.keys(TYPES).map(t => tile(byType(t), TYPES[t])).join('') + '</div>' +
      '<div class="stcard"><h3>📍 Top locations</h3>' +
      (top.length ? top.map(([k, n]) => `<div>${esc(k)} — <b>${n}</b></div>`).join('') : '<div class="sub">No posts yet.</div>') + '</div>' +
      '<div class="row"><button type="button" class="ghost" id="adCsv">⬇ Download all posts (CSV)</button></div>';
    $('adCsv').onclick = downloadCsv;
  }

  function downloadCsv() {
    const cols = ['type', 'title', 'cat', 'loc', 'price', 'phone', 'status', 'by_name', 'created_at', 'descr'];
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [cols.join(',')].concat(posts.map(p => cols.map(c => q(p[c])).join(','))).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'sl-connect-posts.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------------- Posts ----------------
  function viewPosts(body) {
    body.innerHTML =
      '<div class="adbar"><input id="adQ" type="search" placeholder="Search title, place, name, phone...">' +
      '<select id="adT"><option value="">All types</option>' + Object.keys(TYPES).map(t => `<option value="${t}">${TYPES[t]}</option>`).join('') + '</select>' +
      '<select id="adS"><option value="">Any status</option><option value="open">Open</option><option value="taken">Taken</option></select></div>' +
      '<div id="adCount" class="sub"></div><div id="adList"><p class="sub">Loading...</p></div>';
    ['adQ', 'adT', 'adS'].forEach(i => $(i).addEventListener(i === 'adQ' ? 'input' : 'change', drawPosts));
    loadPosts().then(e => { if (e) note('Could not load posts: ' + e); drawPosts(); });
  }

  function drawPosts() {
    if (!$('adList')) return;
    const q = ($('adQ').value || '').toLowerCase().trim(), t = $('adT').value, s = $('adS').value;
    const items = posts.filter(p =>
      (!t || p.type === t) &&
      (!s || (s === 'taken' ? p.status === 'taken' : p.status !== 'taken')) &&
      (!q || [p.title, p.cat, p.loc, p.by_name, p.phone, p.descr].join(' ').toLowerCase().includes(q)));
    $('adCount').textContent = items.length + ' post' + (items.length === 1 ? '' : 's') + (items.length > 150 ? ' (showing first 150)' : '');
    $('adList').innerHTML = items.slice(0, 150).map(p =>
      `<div class="adrow"><h4>${esc(p.title)}</h4>
        <div class="m">${esc(TYPES[p.type] || p.type)}${p.cat ? ' · ' + esc(p.cat) : ''} · 📍 ${esc(p.loc)} · by ${esc(p.by_name || 'Member')} · ${esc(p.phone || '')} · ${new Date(p.created_at).toLocaleDateString()}${p.status === 'taken' ? ' · <b>TAKEN</b>' : ''}</div>
        <div class="btns">
          <button type="button" class="ghost" data-aa="toggle" data-pid="${esc(p.id)}">${p.status === 'taken' ? 'Reopen' : 'Mark taken'}</button>
          <button type="button" class="del" data-aa="del" data-pid="${esc(p.id)}">Delete</button>
        </div></div>`).join('') || '<div class="empty">No posts found.</div>';
  }

  // ---------------- Reports ----------------
  async function viewReports(body) {
    body.innerHTML = '<p class="sub">Loading...</p>';
    const sb = client();
    const r = await sb.from('reports').select('id,post_id,reason,created_at,posts(title,loc)').order('created_at', { ascending: false });
    if (r.error) { body.innerHTML = `<div class="adnote">Could not load reports: ${esc(r.error.message)}</div>`; return; }
    const rs = r.data || [];
    body.innerHTML = rs.length ? rs.map(x =>
      `<div class="adrow"><h4>${esc(x.posts ? x.posts.title : '(post already deleted)')}</h4>
        <div class="m">${x.posts ? '📍 ' + esc(x.posts.loc) + ' · ' : ''}Reason: ${esc(x.reason || 'not given')} · ${new Date(x.created_at).toLocaleDateString()}</div>
        <div class="btns">
          ${x.posts ? `<button type="button" class="del" data-aa="delpost" data-pid="${esc(x.post_id)}">Delete post</button>` : ''}
          <button type="button" class="ghost" data-aa="dismiss" data-rid="${esc(x.id)}">Dismiss</button>
        </div></div>`).join('') : '<div class="empty">No reports. 🎉</div>';
  }

  // ---------------- Members ----------------
  let memberRows = [];
  async function viewMembers(body) {
    body.innerHTML = '<p class="sub">Loading...</p>';
    const sb = client();
    await loadPosts();
    const r = await sb.from('profiles').select('id,name,phone').order('name').limit(1000);
    const help = `<details class="adnote"><summary>Only see yourself, or an error? Tap for the fix</summary>
      <p>Run this once in Supabase → SQL Editor so admins can see all members and manage all posts:</p><pre>${esc(POLICY_SQL)}</pre>
      <p>To block a person from signing in, open Supabase → Authentication → Users, click the user and choose Ban user. Emails are visible there too.</p></details>`;
    if (r.error) { body.innerHTML = `<div class="adnote">Could not load members: ${esc(r.error.message)}</div>` + help; return; }
    memberRows = r.data || [];
    body.innerHTML = '<div class="adbar"><input id="adMQ" type="search" placeholder="Search members by name or phone..."></div><div id="adMCount" class="sub"></div><div id="adMList"></div>' + help;
    $('adMQ').addEventListener('input', drawMembers);
    drawMembers();
  }
  function drawMembers() {
    if (!$('adMList')) return;
    const q = ($('adMQ').value || '').toLowerCase().trim();
    const cnt = {}; posts.forEach(p => { cnt[p.owner] = (cnt[p.owner] || 0) + 1; });
    const items = memberRows.filter(m => !q || [m.name, m.phone].join(' ').toLowerCase().includes(q));
    $('adMCount').textContent = items.length + ' member' + (items.length === 1 ? '' : 's');
    $('adMList').innerHTML = items.slice(0, 200).map(m => {
      const num = String(m.phone || '').replace(/[^\d+]/g, '');
      return `<div class="adrow"><h4>${esc(m.name || '(no name)')}</h4>
        <div class="m">${esc(m.phone || 'no phone')} · ${cnt[m.id] || 0} post${(cnt[m.id] || 0) === 1 ? '' : 's'}</div>
        <div class="btns">
          ${num ? `<a class="btn call" href="tel:${esc(num)}">Call</a><a class="btn wa" href="https://wa.me/${esc(num.replace('+', ''))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          <button type="button" class="ghost" data-aa="emailto" data-oid="${esc(m.id)}">✉ Email</button>
          ${cnt[m.id] ? `<button type="button" class="del" data-aa="delowner" data-oid="${esc(m.id)}">Delete their posts</button>` : ''}
        </div></div>`;
    }).join('') || '<div class="empty">No members found.</div>';
  }


  // ---------------- Email members ----------------
  function emErr(t, ok) { const e = $('emErr'); if (!e) return; e.textContent = t || ''; e.style.color = ok ? '#1eb53a' : ''; }

  async function viewEmail(body) {
    const sb = client();
    body.innerHTML = `<div class="stcard"><h3>✉️ Email members</h3>
      <p class="sub">Sent from your Brevo sender to members with a confirmed email. Members never see each other's emails.</p>
      <label>Send to <select id="emAud"><option value="all">All members</option><option value="posters">Members who have posted</option><option value="one">One member</option></select></label>
      <div id="emOneBox" style="display:none">
        <label>Find member <input id="emFind" type="search" placeholder="Type a name or phone"></label>
        <label>Member <select id="emOne"></select></label>
      </div>
      <label>Subject <input id="emSub" maxlength="150" placeholder="e.g. New feature on SL Connect"></label>
      <label>Message <textarea id="emMsg" rows="7" maxlength="5000" placeholder="Write your message..."></textarea></label>
      <div class="err" id="emErr"></div>
      <div class="row"><button type="button" class="ghost" id="emTest">Send test to me</button><button type="button" class="primary" id="emSend">Send</button></div>
    </div>`;
    if (!memberRows.length && sb) {
      const r = await sb.from('profiles').select('id,name,phone').order('name').limit(1000);
      memberRows = r.data || [];
    }
    function fillOne(keep) {
      const q = ($('emFind').value || '').toLowerCase().trim();
      const items = memberRows.filter(m => !q || [m.name, m.phone].join(' ').toLowerCase().includes(q));
      $('emOne').innerHTML = items.slice(0, 200).map(m => `<option value="${esc(m.id)}">${esc(m.name || '(no name)')}${m.phone ? ' · ' + esc(m.phone) : ''}</option>`).join('') || '<option value="">No member found</option>';
      if (keep) $('emOne').value = keep;
    }
    function showOne() { $('emOneBox').style.display = $('emAud').value === 'one' ? 'block' : 'none'; }
    $('emAud').onchange = showOne;
    $('emFind').oninput = () => fillOne();
    fillOne();
    if (emailTarget) { $('emAud').value = 'one'; fillOne(emailTarget); emailTarget = null; }
    showOne();
    $('emTest').onclick = () => sendEmail(true);
    $('emSend').onclick = () => sendEmail(false);
  }

  async function sendEmail(testOnly) {
    const sb = client(); if (!sb) { emErr('Cloud is not connected.'); return; }
    const aud = $('emAud').value, userId = $('emOne').value;
    const subject = $('emSub').value.trim(), message = $('emMsg').value.trim();
    if (!subject || !message) { emErr('Write a subject and a message.'); return; }
    if (!testOnly && aud === 'one' && !userId) { emErr('Choose a member.'); return; }
    if (!testOnly) {
      const who = aud === 'all' ? 'ALL members' : aud === 'posters' ? 'all members who have posted' : 'this member';
      if (!confirm('Send this email to ' + who + '?')) return;
    }
    $('emTest').disabled = true; $('emSend').disabled = true; emErr('Sending...');
    let msg = '', good = '';
    try {
      const r = await sb.functions.invoke('admin-email', { body: { audience: aud, userId: userId, subject: subject, message: message, testOnly: !!testOnly } });
      if (r.error) {
        msg = r.error.message || 'Could not send.';
        try { const j = await r.error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
        if (/failed to send|not found|404/i.test(msg)) msg = 'The email function is not set up yet. Follow the setup steps, then try again.';
      } else if (r.data && r.data.error) msg = r.data.error;
      else if (r.data) good = 'Sent to ' + r.data.sent + ' of ' + r.data.total + (r.data.failed ? ' (' + r.data.failed + ' failed)' : '') + ' ✅';
    } catch (e) { msg = String(e); }
    $('emTest').disabled = false; $('emSend').disabled = false;
    if (good) emErr(good, true); else emErr(msg || 'Could not send.');
  }

  // ---------------- Announcement banner ----------------
  async function viewAnnounce(body) {
    const sb = client();
    let cur = '';
    try { const r = await sb.from('site_settings').select('value').eq('key', 'announcement').maybeSingle(); cur = (r.data && r.data.value) || ''; } catch (e) {}
    body.innerHTML = `<div class="stcard"><h3>📢 Announcement banner</h3>
      <p class="sub">Shows at the top of the app for everyone. Users can close it. To remove it, tap Remove banner.</p>
      <label>Message <textarea id="anTxt" rows="3" maxlength="200" placeholder="e.g. New: houses for rent in Bo! 🎉"></textarea></label>
      <div class="err" id="anErr"></div>
      <div class="row"><button type="button" class="ghost" id="anClear">Remove banner</button><button type="button" class="primary" id="anSave">Save banner</button></div></div>`;
    $('anTxt').value = cur;
    async function save(v) {
      const e = $('anErr'); e.style.color = ''; e.textContent = 'Saving...';
      const r = await sb.from('site_settings').upsert({ key: 'announcement', value: v });
      if (r.error) { e.textContent = r.error.message; return; }
      e.style.color = '#1eb53a'; e.textContent = v ? 'Banner is live ✅' : 'Banner removed ✅';
      loadBanner();
    }
    $('anSave').onclick = () => { const v = $('anTxt').value.trim(); if (!v) { $('anErr').textContent = 'Write a message first, or tap Remove banner.'; return; } save(v); };
    $('anClear').onclick = () => { $('anTxt').value = ''; save(''); };
  }

  async function loadBanner() {
    const sb = client(); if (!sb) return;
    let txt = '';
    try { const r = await sb.from('site_settings').select('value').eq('key', 'announcement').maybeSingle(); txt = (r.data && r.data.value) || ''; } catch (e) {}
    let closed = ''; try { closed = localStorage.getItem('sl_ann_closed') || ''; } catch (e) {}
    let bar = $('annBar');
    if (!txt || closed === txt) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'annBar';
      const fl = document.querySelector('.flag');
      if (fl) fl.after(bar); else document.body.prepend(bar);
    }
    bar.innerHTML = '<span></span><button type="button" aria-label="Close">×</button>';
    bar.firstChild.textContent = txt;
    bar.lastChild.onclick = () => { try { localStorage.setItem('sl_ann_closed', txt); } catch (e) {} bar.remove(); };
  }

  // ---------------- actions ----------------
  async function removePosts(filterCol, val) {
    const sb = client();
    const r = await sb.from('posts').delete().eq(filterCol, val).select();
    if (r.error) { note(r.error.message); return false; }
    if (!(r.data && r.data.length)) { note('Not allowed or already deleted. Run the SQL in the Members tab help box.'); return false; }
    posts = posts.filter(p => String(p[filterCol]) !== String(val));
    return true;
  }

  dlg.addEventListener('click', async function (e) {
    const tb = e.target.closest('[data-ad]');
    if (tb) { tab = tb.dataset.ad; draw(); return; }
    const b = e.target.closest('[data-aa]'); if (!b) return;
    const sb = client(); if (!sb) { note('Cloud is not connected.'); return; }
    const a = b.dataset.aa, id = b.dataset.pid || b.dataset.rid || b.dataset.oid;
    if (a === 'emailto') { emailTarget = id; tab = 'email'; draw(); return; }
    if (a === 'del' || a === 'delpost') {
      if (!confirm('Delete this post for everyone?')) return;
      b.disabled = true;
      if (await removePosts('id', id)) { note('Post deleted'); if (a === 'del') drawPosts(); else viewReports($('adBody')); }
      else b.disabled = false;
    } else if (a === 'toggle') {
      const p = posts.find(x => String(x.id) === id); if (!p) return;
      const ns = p.status === 'taken' ? 'open' : 'taken';
      b.disabled = true;
      const r = await sb.from('posts').update({ status: ns }).eq('id', id).select();
      if (r.error || !(r.data && r.data.length)) { note(r.error ? r.error.message : 'Not allowed. Run the SQL in the Members tab help box.'); b.disabled = false; return; }
      p.status = ns; drawPosts();
    } else if (a === 'dismiss') {
      b.disabled = true;
      const r = await sb.from('reports').delete().eq('id', id).select();
      if (r.error || !(r.data && r.data.length)) { note(r.error ? r.error.message : 'Could not dismiss.'); b.disabled = false; return; }
      note('Report dismissed'); viewReports($('adBody'));
    } else if (a === 'delowner') {
      if (!confirm('Delete ALL posts by this member? This cannot be undone.')) return;
      b.disabled = true;
      if (await removePosts('owner', id)) { note('Their posts were deleted'); drawMembers(); } else b.disabled = false;
    }
  });

  $('adBack').addEventListener('click', () => dlg.close());

  function draw() {
    document.querySelectorAll('#adTabs .tab').forEach(b => b.classList.toggle('on', b.dataset.ad === tab));
    const body = $('adBody');
    if (tab === 'overview') viewOverview(body);
    else if (tab === 'posts') viewPosts(body);
    else if (tab === 'reports') viewReports(body);
    else if (tab === 'email') viewEmail(body);
    else if (tab === 'announce') viewAnnounce(body);
    else viewMembers(body);
  }

  function openAdmin() {
    if (!isAdmin) return;
    tab = 'overview';
    if (!dlg.open) dlg.showModal();
    draw();
  }

  // ---------------- show the button only to admins ----------------
  function syncBtn() {
    const a = $('auth'); if (!a) return;
    const b = $('adBtn');
    if (!isAdmin) { if (b) b.remove(); return; }
    if (b) return;
    const btn = document.createElement('button');
    btn.id = 'adBtn'; btn.className = 'ghost'; btn.type = 'button';
    btn.textContent = '🛡 Admin';
    btn.addEventListener('click', openAdmin);
    a.prepend(btn);
  }
  async function checkAdmin(session) {
    isAdmin = false;
    const sb = client();
    if (sb && session && session.user) {
      try {
        const r = await sb.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
        isAdmin = !!r.data;
      } catch (e) {}
    }
    syncBtn();
  }
  const authEl = $('auth');
  if (authEl) new MutationObserver(syncBtn).observe(authEl, { childList: true });
  const sb0 = client();
  if (sb0) {
    loadBanner();
    sb0.auth.getSession().then(r => checkAdmin(r.data && r.data.session));
    sb0.auth.onAuthStateChange((ev, session) => { setTimeout(() => checkAdmin(session), 0); });
  }
})();
