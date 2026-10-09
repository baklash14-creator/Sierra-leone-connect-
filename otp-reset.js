// otp-reset.js - "Forgot password" with a 6-digit email code
// Loads AFTER app.js. Needs the Supabase email template to contain {{ .Token }}

(function () {
  // >>> If reset does not work, the Supabase client has a different name in your
  // >>> backend.js. Replace the line below with that name (e.g. window.sb).
  function client() {
    return window.sb || window.supabaseClient || window.db || window.supa || null;
  }

  const $ = (id) => document.getElementById(id);
  const forgot = $('forgot'), box = $('resetBox');
  if (!forgot || !box) return;

  function msg(text, ok) {
    const e = $('rerr');
    e.textContent = text;
    e.style.color = ok ? '#1eb53a' : '';
  }

  // Click "Forgot password?" -> send the code and show the "Enter code" space
  forgot.addEventListener('click', async function (ev) {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    const email = ($('aid').value || '').trim();
    box.style.display = 'block';
    msg('');
    if (!email || !email.includes('@')) {
      msg('Type your email in the box above first, then tap "Forgot password?" again.');
      return;
    }
    const sb = client();
    if (!sb) { msg('App not ready. Please refresh and try again.'); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email);
    if (error) msg(error.message);
    else msg('Code sent! Check your email (and spam).', true);
  }, true); // capture: runs before the old forgot handler

  // Tap "Reset password" -> check the code, then save the new password
  $('rBtn').addEventListener('click', async function () {
    const email = ($('aid').value || '').trim();
    const code = ($('rcode').value || '').trim();
    const pass = $('rnew').value || '';
    if (code.length < 6) { msg('Enter the 6-digit code.'); return; }
    if (pass.length < 6) { msg('Password must be at least 6 characters.'); return; }
    const sb = client();
    if (!sb) { msg('App not ready. Please refresh and try again.'); return; }

    $('rBtn').disabled = true;
    const v = await sb.auth.verifyOtp({ email: email, token: code, type: 'recovery' });
    if (v.error) { msg(v.error.message); $('rBtn').disabled = false; return; }

    const u = await sb.auth.updateUser({ password: pass });
    $('rBtn').disabled = false;
    if (u.error) { msg(u.error.message); return; }

    msg('Password changed! You are signed in.', true);
    setTimeout(function () {
      box.style.display = 'none';
      $('rcode').value = ''; $('rnew').value = '';
      const d = $('authDlg'); if (d && d.close) d.close();
      location.reload();
    }, 1200);
  });
})();
