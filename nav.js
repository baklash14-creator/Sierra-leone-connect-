/* SL Connect - new phone tab bar: Home, Market, Post, Messages, More.
   "More" sheet holds Account, Requests, Wanted, Teams, Invite, About, Contact, theme, Install, Sign out. Load LAST. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("bnav") || typeof renderBottom !== "function") return;
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const me = () => (typeof user !== "undefined" && user ? user : null);
  const T = m => { try { toast(m); } catch (e) { alert(m); } };

  const css = document.createElement("style");
  css.textContent = `
  @media(max-width:700px){
    #chatBtn,#moReqBtn,#wtWantedBtn,#wtTeamBtn,#themeBtn{display:none!important}
    .bnav .bi{position:relative;min-width:56px}
    .bnav .bi small{position:absolute;top:0;left:50%;margin-left:6px;background:#e0245e;color:#fff;border-radius:99px;font-size:.62rem;font-weight:800;padding:1px 6px;min-width:16px;text-align:center;line-height:1.3}
  }
  #nvSheet{position:fixed;inset:0;z-index:400;display:none;background:#101828a8;backdrop-filter:blur(3px);align-items:flex-end;justify-content:center}
  #nvSheet.on{display:flex}
  .nv-p{width:min(560px,100%);max-height:86vh;overflow:auto;background:var(--card);color:var(--text);border-radius:22px 22px 0 0;padding:14px 16px calc(18px + env(safe-area-inset-bottom,0px));animation:nvUp .22s ease}
  @keyframes nvUp{from{transform:translateY(40px);opacity:0}}
  .nv-grab{width:44px;height:5px;border-radius:9px;background:var(--line);margin:0 auto 12px}
  .nv-me{display:flex;align-items:center;gap:12px;border:1px solid var(--line);border-radius:16px;padding:12px;margin-bottom:12px;cursor:pointer;background:var(--bg)}
  .nv-av{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#1eb53a,#0072c6);color:#fff;display:grid;place-items:center;font-weight:800;font-size:1.2rem;flex:none}
  .nv-me b{display:block}.nv-me span{font-size:.82rem;color:var(--muted)}
  .nv-h{font-size:.74rem;font-weight:800;letter-spacing:.05em;color:var(--muted);text-transform:uppercase;margin:12px 2px 6px}
  .nv-g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .nv-t{border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:16px;padding:12px 4px;display:flex;flex-direction:column;align-items:center;gap:5px;font:inherit;font-size:.78rem;font-weight:700;cursor:pointer;text-align:center;position:relative}
  .nv-t i{font-style:normal;font-size:1.6rem;line-height:1}
  .nv-t:active{transform:scale(.97)}
  .nv-t small{position:absolute;top:6px;right:10px;background:#e0245e;color:#fff;border-radius:99px;font-size:.65rem;padding:1px 6px}
  .nv-out{width:100%;margin-top:12px;border:1px solid var(--line);background:none;color:var(--text);border-radius:14px;padding:12px;font:inherit;font-weight:700;cursor:pointer}`;
  document.head.append(css);

  const sheet = document.createElement("div"); sheet.id = "nvSheet"; document.body.append(sheet);
  const close = () => sheet.classList.remove("on");
  const unread = () => { const b = $("chBadge"); return b && !b.hidden ? (b.textContent || "").trim() || "•" : ""; };

  /* ---------- bottom bar ---------- */
  renderBottom = function () {
    const u = me(), pg = typeof page !== "undefined" ? page : "home", n = unread();
    const it = [["home", "🏠", "Home"], ["market", "🛍️", "Market"], ["post", "➕", "Post"], ["messages", "💬", "Chats"], ["more", "☰", "More"]];
    $("bnav").innerHTML = it.map(([k, i, l]) => k === "post" ? `<button class="bpost" id="bnPost" aria-label="Post">${i}</button>`
      : `<button class="bi ${k === pg || (k === "more" && ["account", "about", "contact"].includes(pg)) ? "on" : ""}" data-nv="${k}"><span>${i}</span>${l}${k === "messages" && n ? `<small>${E(n)}</small>` : ""}</button>`).join("");
    $("bnPost").onclick = openPost;
  };
  /* app.js already bound go() to [data-go]; our tabs use data-nv so we route them ourselves */
  function openMore() {
    const u = me(), pg = typeof page !== "undefined" ? page : "";
    const has = id => !!$(id);
    const tile = (k, i, l, extra) => `<button class="nv-t" data-nv-act="${k}"><i>${i}</i>${l}${extra || ""}</button>`;
    sheet.innerHTML = `<div class="nv-p" role="dialog" aria-label="More"><div class="nv-grab"></div>
      ${u ? `<div class="nv-me" data-nv-act="account"><span class="nv-av">${E((u.name || "?")[0]).toUpperCase()}</span><div><b>${E(u.name)}</b><span>My account · posts and saved</span></div></div>`
          : `<div class="nv-me" data-nv-act="signin"><span class="nv-av">👤</span><div><b>Sign in or join free</b><span>Post, chat and save</span></div></div>`}
      <div class="nv-h">Do more</div><div class="nv-g">
        ${has("moReqBtn") ? tile("req", "📥", "Requests") : ""}${has("wtWantedBtn") ? tile("wanted", "📦", "Wanted") : ""}${has("wtTeamBtn") ? tile("team", "👷", "Teams") : ""}
        ${tile("invite", "📣", "Invite friends")}${tile("market", "🔎", "Search")}${tile("refresh", "↻", "Refresh")}</div>
      <div class="nv-h">App</div><div class="nv-g">
        ${tile("about", "ℹ️", "About")}${tile("contact", "✉️", "Contact us")}${tile("theme", "🌗", "Dark / light")}
        ${tile("install", "📲", "Install app")}</div>
      ${u ? `<button class="nv-out" data-nv-act="signout">Sign out</button>` : ""}</div>`;
    sheet.classList.add("on");
  }

  const clickId = id => { const b = $(id); if (b) b.click(); };
  document.addEventListener("click", ev => {
    const t = ev.target;
    if (t === sheet) return close();
    let el = t.closest("[data-nv]");
    if (el) {
      ev.preventDefault(); ev.stopPropagation();
      const k = el.dataset.nv;
      if (k === "more") return openMore();
      if (k === "messages") { if (!me()) { T("Please sign in first"); try { openAuth("in"); } catch (e) { } return; } return go("messages"); }
      return go(k);
    }
    el = t.closest("[data-nv-act]"); if (!el) return;
    ev.preventDefault(); ev.stopPropagation();
    const a = el.dataset.nvAct; close();
    if (a === "account") go("account");
    else if (a === "signin") { try { openAuth("in"); } catch (e) { } }
    else if (a === "req") setTimeout(() => clickId("moReqBtn"), 120);
    else if (a === "wanted") setTimeout(() => clickId("wtWantedBtn"), 120);
    else if (a === "team") setTimeout(() => clickId("wtTeamBtn"), 120);
    else if (a === "invite") { const b = document.createElement("button"); b.setAttribute("data-invite", ""); b.hidden = true; document.body.append(b); b.click(); setTimeout(() => b.remove(), 50); }
    else if (a === "market") { go("market"); setTimeout(() => { const q = $("q"); if (q) q.focus(); }, 200); }
    else if (a === "refresh") { clickId("refBtn") || location.reload(); T("Refreshing…"); }
    else if (a === "about") go("about");
    else if (a === "contact") go("contact");
    else if (a === "theme") clickId("themeBtn");
    else if (a === "install") { const b = document.querySelector(".inst"); if (b) b.click(); else T("Android: menu ⋮ → Install app. iPhone: Share → Add to Home Screen"); }
    else if (a === "signout") clickId("outBtn");
  }, true);
  addEventListener("keydown", e => { if (e.key === "Escape") close(); });

  /* keep the Chats badge in step with chat.js */
  const b = $("chBadge");
  if (b) new MutationObserver(() => { try { renderBottom(); } catch (e) { } }).observe(b, { attributes: true, childList: true, characterData: true, subtree: true });
  renderBottom();
})();
