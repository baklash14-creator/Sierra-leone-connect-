/* SL Connect - "Update" button.
   Tap it to load the newest version of the app (clears the old saved copy, then reloads).
   It also checks by itself and shows "Update available" when a newer version is online.

   TO RELEASE A NEW VERSION: change APP_VERSION below, upload, and every phone
   will see the Update button light up. Load this file last, after social.js. */
(function () {
  "use strict";

  const APP_VERSION = "2026-11-03.1";

  /* ---------- styles ---------- */
  const st = document.createElement("style");
  st.textContent = `
#updBtn{position:relative;white-space:nowrap}
#updBtn .updl{margin-left:4px}
#updBtn.new{border-color:#1eb53a;color:#1eb53a;font-weight:700;animation:updPulse 1.6s ease-in-out infinite}
#updBtn.new::after{content:"";position:absolute;top:-3px;right:-3px;width:11px;height:11px;border-radius:50%;background:#e0245e;border:2px solid var(--card,Canvas)}
#updBtn.busy{opacity:.6;pointer-events:none}
.updfoot{margin-top:10px;display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap}
.updfoot small{opacity:.75}
@keyframes updPulse{50%{box-shadow:0 0 0 5px rgba(30,181,58,.22)}}
@media (max-width:640px){#updBtn .updl{display:none}}`;
  document.head.appendChild(st);

  /* ---------- buttons ---------- */
  const slot = document.getElementById("auth");
  const head = document.createElement("button");
  head.id = "updBtn";
  head.type = "button";
  head.className = "ghost";
  head.setAttribute("aria-label", "Update to the newest version");
  head.innerHTML = '🔄<span class="updl">Update</span>';
  if (slot && slot.parentNode) slot.parentNode.insertBefore(head, slot);

  const foot = document.querySelector("footer");
  let footBtn = null;
  if (foot) {
    foot.insertAdjacentHTML("beforeend",
      `<div class="updfoot"><small>Version ${APP_VERSION}</small><button type="button" class="ghost" data-updgo>🔄 Update</button></div>`);
    footBtn = foot.querySelector("[data-updgo]");
  }

  const toastMsg = m => { try { toast(m); } catch (e) {} };

  /* ---------- update now ---------- */
  let working = false;
  async function updateNow() {
    if (working) return;
    working = true;
    head.classList.add("busy");
    toastMsg("Updating…");
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update().catch(() => {})));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) { /* even if cleaning fails, still reload below */ }

    // reload with a fresh address so the phone cannot reuse an old copy
    const q = new URLSearchParams(location.search);
    q.set("u", Date.now());
    location.replace(location.pathname + "?" + q.toString() + location.hash);
  }

  // remove the ?u=... marker after loading so the address stays clean
  try {
    const q = new URLSearchParams(location.search);
    if (q.has("u")) {
      q.delete("u");
      const rest = q.toString();
      history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
      setTimeout(() => toastMsg("✅ Updated to the newest version"), 600);
    }
  } catch (e) {}

  document.addEventListener("click", e => {
    if (e.target.closest("#updBtn, [data-updgo]")) updateNow();
  });

  /* ---------- is there a newer version online? ---------- */
  let told = false;
  async function check() {
    try {
      const r = await fetch("update.js?c=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      const m = (await r.text()).match(/APP_VERSION\s*=\s*"([^"]+)"/);
      if (!m || m[1] === APP_VERSION) return;
      head.classList.add("new");
      head.querySelector(".updl").textContent = "Update available";
      if (footBtn) footBtn.textContent = "⬆️ Update available";
      if (!told) { told = true; toastMsg("🆕 New version ready. Tap Update."); }
    } catch (e) { /* offline: ignore */ }
  }
  setTimeout(check, 3000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  setInterval(check, 10 * 60 * 1000);
})();
