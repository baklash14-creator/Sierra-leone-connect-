/* SL Connect - Invite friends.
   Adds an "Invite friends" card on Home and My Account, a footer link, and a share sheet
   (WhatsApp, SMS, Email, phone share menu, copy link). No database changes needed.
   Load AFTER app.js (put it near the other scripts, before update.js). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const link = () => location.origin + location.pathname;
  function message() {
    let who = "";
    try { if (typeof user !== "undefined" && user && user.name) who = user.name.split(" ")[0]; } catch (e) { }
    return (who ? `Hi! It's ${who}. ` : "Hi! ") +
      "I use SL Connect to find workers, jobs, houses to rent and land in Sierra Leone. It is free. Join me here:";
  }

  const CARD = `<div class="inv-card" data-inv-card>
      <div class="inv-ic" aria-hidden="true">🎁</div>
      <div class="inv-tx"><h3>Invite your friends</h3><p>Help family and friends find work, homes and land on SL Connect.</p></div>
      <button class="inv-go" data-invite>Invite</button></div>`;

  function openSheet() {
    if ($("invSheet")) return;
    const url = link(), msg = message(), full = msg + " " + url;
    const bg = document.createElement("div");
    bg.className = "sheet-bg"; bg.id = "invSheet";
    bg.innerHTML = `<div class="sheet inv-sheet" role="dialog" aria-modal="true" aria-label="Invite friends">
      <i class="grab"></i>
      <h3>Invite your friends 🎁</h3>
      <p class="inv-sub">Pick how you want to send the invitation.</p>
      <div class="inv-prev">${E(msg)}<br><b>${E(url)}</b></div>
      <div class="inv-grid${navigator.share ? "" : " n4"}">
        <a class="inv-opt wa" href="https://wa.me/?text=${encodeURIComponent(full)}" target="_blank" rel="noopener"><span>💬</span>WhatsApp</a>
        <a class="inv-opt sms" href="sms:?&body=${encodeURIComponent(full)}"><span>✉️</span>SMS</a>
        <a class="inv-opt mail" href="mailto:?subject=${encodeURIComponent("Join me on SL Connect")}&body=${encodeURIComponent(full)}"><span>📧</span>Email</a>
        <button class="inv-opt cp" data-inv-copy><span>🔗</span>Copy link</button>
        ${navigator.share ? '<button class="inv-opt more" data-inv-share><span>📤</span>More apps</button>' : ""}
      </div>
      <button class="sheet-btn inv-close" data-inv-close>Close</button></div>`;
    const key = e => { if (e.key === "Escape") close(); };
    function close() {
      bg.classList.remove("show"); document.removeEventListener("keydown", key);
      document.documentElement.classList.remove("sheet-open");
      setTimeout(() => bg.remove(), 220);
    }
    bg.addEventListener("click", e => {
      if (e.target === bg || e.target.closest("[data-inv-close]")) return close();
      if (e.target.closest("[data-inv-copy]")) {
        const done = () => note("Link copied 🔗");
        (navigator.clipboard ? navigator.clipboard.writeText(full) : Promise.reject()).then(done).catch(() => { prompt("Copy this message:", full); });
        return;
      }
      if (e.target.closest("[data-inv-share]")) {
        navigator.share({ title: "SL Connect", text: msg, url }).then(close).catch(() => { });
        return;
      }
      if (e.target.closest("a.inv-opt")) setTimeout(close, 300);
    });
    document.addEventListener("keydown", key);
    document.documentElement.classList.add("sheet-open");
    document.body.appendChild(bg);
    requestAnimationFrame(() => bg.classList.add("show"));
  }
  function note(m) { try { toast(m); } catch (e) { } }

  document.addEventListener("click", e => { if (e.target.closest("[data-invite]")) openSheet(); });

  /* ---------- put the card in the right places ---------- */
  function place() {
    const cta = document.querySelector("#p-home .cta");
    if (cta && !document.querySelector("#p-home [data-inv-card]")) cta.insertAdjacentHTML("beforebegin", CARD);

    const tabs = $("acTabs");
    if (tabs && !document.querySelector("#p-account [data-inv-card]")) tabs.insertAdjacentHTML("beforebegin", CARD);

    const fl = document.querySelector("footer .fl");
    if (fl && !fl.querySelector("[data-invite]")) fl.insertAdjacentHTML("beforeend", '<button data-invite>🎁 Invite friends</button>');
  }
  place();
  new MutationObserver(place).observe(document.body, { childList: true, subtree: true });
})();
