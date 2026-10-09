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
