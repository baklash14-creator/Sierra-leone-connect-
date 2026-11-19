/* SL Connect - Alerts centre: one list of everything that needs you.
   Requests, replies, wanted offers, team invites, price drops, unread chats, and smart matches. Load AFTER gallery.js and nav.js. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("p-market") || typeof sb === "undefined" || !sb) return;
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const P = () => (typeof posts !== "undefined" ? posts : []);
  const me = () => (typeof user !== "undefined" && user ? user : null);
  const KEY = "slc_alerts_seen";
  const get = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch (e) { } };
  const ago = d => { const s = Math.max(1, (Date.now() - new Date(d)) / 1000); return s < 3600 ? Math.max(1, Math.floor(s / 60)) + "m" : s < 86400 ? Math.floor(s / 3600) + "h" : Math.floor(s / 86400) + "d"; };

  const css = document.createElement("style");
  css.textContent = `
  #alDlg{width:min(560px,96vw);max-height:88vh;border:1px solid var(--line);border-radius:20px;padding:0;background:var(--card);color:var(--text)}
  #alDlg::backdrop{background:#101828a8;backdrop-filter:blur(3px)}.al-w{padding:16px;max-height:88vh;overflow:auto}
  .al-h{display:flex;justify-content:space-between;align-items:center}.al-h h2{margin:0;font-size:1.25rem}
  .al-x{border:0;background:none;font-size:26px;color:inherit;cursor:pointer}
  .al-i{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--line);border-radius:14px;padding:11px 12px;margin:8px 0;cursor:pointer;background:var(--bg);width:100%;text-align:left;color:inherit;font:inherit}
  .al-i.new{border-color:var(--green,#1eb53a);background:#1eb53a12}
  .al-i i{font-style:normal;font-size:1.5rem;line-height:1}.al-i b{display:block}.al-i small{color:var(--muted)}
  .al-i .t{margin-left:auto;color:var(--muted);font-size:.75rem;white-space:nowrap}
  .al-e{text-align:center;color:var(--muted);padding:26px 8px}
  .al-b{border:1px solid var(--line);background:var(--card);color:inherit;border-radius:999px;padding:8px 14px;font-weight:700;cursor:pointer;font:inherit;font-weight:700}
  .bi .al-dot,.nv-t .al-dot{position:absolute;top:2px;right:8px;background:#e0245e;color:#fff;border-radius:99px;font-size:.62rem;font-weight:800;padding:1px 6px}`;
  document.head.append(css);

  async function collect() {
    const u = me(); if (!u) return [];
    const out = [], q = (p) => p.then(r => r.error ? [] : (r.data || [])).catch(() => []);
    const [recv, sent, myWanted, myTeams, invites] = await Promise.all([
      q(sb.from("post_requests").select("id,post_id,sender_name,message,status,created_at").eq("owner_id", u.id).eq("status", "new").order("created_at", { ascending: false }).limit(20)),
      q(sb.from("post_requests").select("id,post_id,status,created_at").eq("sender_id", u.id).in("status", ["accepted", "declined"]).order("created_at", { ascending: false }).limit(10)),
      q(sb.from("wanted_items").select("id,title").eq("user_id", u.id).limit(30)),
      q(sb.from("teams").select("id,name").eq("leader_id", u.id).limit(30)),
      q(sb.from("team_members").select("id,team_id,created_at,teams(name)").eq("user_id", u.id).eq("status", "invited").limit(10))
    ]);
    const title = id => { const p = P().find(x => String(x.id) === String(id)); return p ? p.title : "a post"; };
    recv.forEach(r => out.push({ ic: String(r.message || "").startsWith("📅") ? "📅" : "📥", t: (r.sender_name || "Someone") + " sent a " + (String(r.message || "").startsWith("📅") ? "booking" : "request"), s: r.message, at: r.created_at, go: "req" }));
    sent.forEach(r => out.push({ ic: r.status === "accepted" ? "✅" : "❌", t: "Your request was " + r.status, s: "About: " + title(r.post_id), at: r.created_at, go: "req" }));
    if (myWanted.length) {
      const offers = await q(sb.from("wanted_offers").select("id,wanted_item_id,price,created_at").in("wanted_item_id", myWanted.map(x => x.id)).eq("status", "pending").order("created_at", { ascending: false }).limit(20));
      offers.forEach(o => { const w = myWanted.find(x => x.id === o.wanted_item_id); out.push({ ic: "📦", t: "New offer on “" + (w ? w.title : "your wanted item") + "”", s: o.price ? "Offer: Le " + Number(o.price).toLocaleString("en-US") : "", at: o.created_at, go: "wanted" }); });
    }
    if (myTeams.length) {
      const joins = await q(sb.from("team_members").select("id,team_id,created_at").in("team_id", myTeams.map(x => x.id)).eq("status", "pending").limit(20));
      joins.forEach(j => { const t = myTeams.find(x => x.id === j.team_id); out.push({ ic: "👷", t: "Someone wants to join " + (t ? t.name : "your team"), s: "Open Teams to accept", at: j.created_at, go: "team" }); });
    }
    invites.forEach(i => out.push({ ic: "💌", t: "Team invite: " + ((i.teams && i.teams.name) || "a team"), s: "Open Teams to answer", at: i.created_at, go: "team" }));
    const favs = u.favs || [];
    try { const r = await sb.from("posts").select("id,title,price,old_price,price_changed_at").in("id", favs.slice(0, 100)).not("old_price", "is", null);
      (r.data || []).filter(x => x.price_changed_at && Date.now() - new Date(x.price_changed_at) < 14 * 864e5).forEach(x => out.push({ ic: "🔻", t: "Price dropped: " + x.title, s: x.old_price + " → " + x.price, at: x.price_changed_at, go: "post", id: x.id })); } catch (e) { }
    try { if (window.SLC_BRAIN) (await window.SLC_BRAIN.matches()).forEach(m => {
      if (m.kind === "wanted") out.push({ ic: "🤝", t: m.posts.length + " post" + (m.posts.length === 1 ? "" : "s") + " match your wanted “" + m.title + "”", s: m.posts.map(p => p.title).join(" · "), at: new Date().toISOString(), go: "post", id: m.posts[0].id, soft: true });
      else out.push({ ic: "🎯", t: "People are looking for what you offer", s: "Wanted: " + m.wanted.join(" · "), at: new Date().toISOString(), go: "wanted", soft: true }); }); } catch (e) { }
    return out.sort((a, b) => new Date(b.at) - new Date(a.at));
  }
  const chatCount = () => { const b = $("chBadge"); return b && !b.hidden ? parseInt(b.textContent, 10) || 1 : 0; };
  let items = [];
  const unreadN = () => items.filter(i => !i.soft && new Date(i.at) > new Date(get() || 0)).length + chatCount();

  function paintBadge() {
    const n = unreadN();
    document.querySelectorAll(".al-dot").forEach(x => x.remove());
    if (!n) return;
    const more = document.querySelector('#bnav [data-nv="more"]'); if (more) more.insertAdjacentHTML("beforeend", `<small class="al-dot">${n > 9 ? "9+" : n}</small>`);
    const tile = document.querySelector('#nvSheet [data-nv-act="alerts"]'); if (tile) tile.insertAdjacentHTML("beforeend", `<small class="al-dot">${n}</small>`);
  }
  async function refresh() { try { items = await collect(); } catch (e) { items = []; } paintBadge(); }

  async function open() {
    if (!me()) return;
    let d = $("alDlg"); if (!d) { d = document.createElement("dialog"); d.id = "alDlg"; document.body.append(d); }
    d.innerHTML = '<div class="al-w"><div class="al-h"><h2>🔔 Alerts</h2><button class="al-x" data-al="close" aria-label="Close">×</button></div><p class="al-e">Checking…</p></div>'; if (!d.open) d.showModal();
    await refresh();
    const seen = new Date(get() || 0), n = chatCount();
    const rows = (n ? [`<button class="al-i new" data-al="chat"><i>💬</i><div><b>${n} unread message${n === 1 ? "" : "s"}</b><small>Open Chats</small></div></button>`] : [])
      .concat(items.map((it, i) => `<button class="al-i ${!it.soft && new Date(it.at) > seen ? "new" : ""}" data-al="go" data-i="${i}"><i>${it.ic}</i><div><b>${E(it.t)}</b><small>${E(String(it.s || "").slice(0, 90))}</small></div><span class="t">${it.soft ? "smart" : ago(it.at)}</span></button>`));
    d.innerHTML = `<div class="al-w"><div class="al-h"><h2>🔔 Alerts</h2><button class="al-x" data-al="close" aria-label="Close">×</button></div>
      ${rows.length ? rows.join("") : '<p class="al-e">🎉 You are all caught up.<br>New requests, offers, price drops and smart matches show up here.</p>'}
      ${items.length ? '<p style="text-align:center"><button class="al-b" data-al="read">Mark all as read</button></p>' : ""}</div>`;
    set(new Date().toISOString()); paintBadge();
  }
  const clickId = id => { const b = $(id); if (b) b.click(); };
  document.addEventListener("click", ev => {
    const el = ev.target.closest("[data-al]"); if (!el) return;
    ev.preventDefault(); ev.stopPropagation();
    const a = el.dataset.al, d = $("alDlg");
    if (a === "close") d.close();
    else if (a === "read") { set(new Date().toISOString()); paintBadge(); d.close(); }
    else if (a === "chat") { d.close(); try { go("messages"); } catch (e) { } }
    else if (a === "go") {
      const it = items[+el.dataset.i]; d.close(); if (!it) return;
      setTimeout(() => { if (it.go === "req") clickId("moReqBtn"); else if (it.go === "wanted") clickId("wtWantedBtn"); else if (it.go === "team") clickId("wtTeamBtn"); else if (it.go === "post") { try { detail(it.id); } catch (e) { } } }, 150);
    }
  }, true);

  /* put the Alerts tile at the front of the More sheet, and a badge on the More tab */
  const sheet = $("nvSheet");
  if (sheet) new MutationObserver(() => {
    const g = sheet.querySelector(".nv-g"); if (!g || g.querySelector('[data-nv-act="alerts"]')) return;
    g.insertAdjacentHTML("afterbegin", '<button class="nv-t" data-nv-act="alerts"><i>🔔</i>Alerts</button>'); paintBadge();
  }).observe(sheet, { childList: true });
  document.addEventListener("click", ev => { const t = ev.target.closest('[data-nv-act="alerts"]'); if (t) { ev.preventDefault(); ev.stopPropagation(); sheet.classList.remove("on"); open(); } }, true);
  if (typeof renderBottom === "function") { const _rb = renderBottom; renderBottom = function () { _rb.apply(this, arguments); try { paintBadge(); } catch (e) { } }; }
  const chb = $("chBadge"); if (chb) new MutationObserver(paintBadge).observe(chb, { attributes: true, childList: true, characterData: true, subtree: true });

  window.SLC_ALERTS = { open, refresh };
  setTimeout(refresh, 2500); setInterval(refresh, 120000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
})();
