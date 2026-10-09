// otp-reset.js - Forgot password page with a 6-digit email code
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
  forgot.addEventListener('click', function (ev) {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    const typed = ($('aid').value || '').trim();
    const ad = $('authDlg'); if (ad && ad.open) ad.close();
    $('fpEmail').value = typed.includes('@') ? typed : '';
    say('fpErr1', ''); say('fpErr2', '');
    step(1);
    if (!dlg.open) dlg.showModal();
  }, true);

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
    if (code.length < 6) { say('fpErr2', 'Enter the 6-digit code.'); return; }
    if (pass.length < 6) { say('fpErr2', 'Password must be at least 6 characters.'); return; }
    const sb = client();
    if (!sb) { say('fpErr2', NOT_READY); return; }

    $('rBtn').disabled = true;
    const v = await sb.auth.verifyOtp({ email: email, token: code, type: 'recovery' });
    if (v.error) { say('fpErr2', v.error.message); $('rBtn').disabled = false; return; }
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
