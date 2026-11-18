/* SL Connect - Admin Control Room (phone-first redesign).
   Replaces the old admin tab on My Account. Load AFTER chat.js and social.js.
   Uses the same database functions as before (chat.sql). For the Verify button also run admin.sql. */
(function () {
  "use strict";
  if (typeof CLOUD === "undefined" || !CLOUD) return;

  const TYPES = [
    ["service", "Workers", "🛠️", "#1eb53a"],
    ["job", "Jobs", "💼", "#0072c6"],
    ["rent", "Rentals", "🏠", "#f5a623"],
    ["land", "Land", "🌍", "#8a63d2"]
  ];
  const TABS = [["home", "📊", "Overview"], ["reports", "🚩", "Reports"], ["posts", "📋", "Listings"], ["users", "👥", "Users"], ["verify", "✔", "Verify"], ["email", "✉️", "Email"], ["banner", "📣", "Banner"], ["export", "⬇️", "Export"]];
  const S = { tab: "home", q: "", type: "all", stats: null, users: [], ver: new Set() };
  let tok = 0;

  const first = n => String(n || "Admin").split(" ")[0];
  const fdate = t => { try { return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } };
  const view = () => $("admView");

  /* ---------- nice confirm sheet (replaces the ugly browser confirm) ---------- */
  function ask(title, text, ok, danger) {
    return new Promise(res => {
      const bg = document.createElement("div");
      bg.className = "sheet-bg";
      bg.innerHTML = `<div class="sheet" role="alertdialog" aria-modal="true"><i class="grab"></i><h3>${esc(title)}</h3><p>${esc(text)}</p>
        <div class="sheet-row"><button class="sheet-btn" data-x="0">Cancel</button><button class="sheet-btn ${danger ? "danger" : "go"}" data-x="1">${esc(ok)}</button></div></div>`;
      const key = e => { if (e.key === "Escape") done(false); };
      const done = v => { bg.classList.remove("show"); document.removeEventListener("keydown", key); setTimeout(() => bg.remove(), 220); res(v); };
      bg.addEventListener("click", e => {
        const b = e.target.closest("[data-x]");
        if (b) done(b.dataset.x === "1"); else if (e.target === bg) done(false);
      });
      document.addEventListener("keydown", key);
      document.body.appendChild(bg);
      requestAnimationFrame(() => bg.classList.add("show"));
    });
  }

  /* ---------- shell ---------- */
  function shell() {
    const d = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    return `<div class="adm">
      <div class="adm-hero"><div><small class="adm-live"><i></i>Live</small><h2>Hi ${esc(first(user.name))} 👋</h2><p>Admin control room · ${esc(d)}</p></div><div class="adm-seal" aria-hidden="true">🛡️</div></div>
      <nav class="adm-tabs" role="tablist">${TABS.map(([k, i, l]) =>
        `<button role="tab" class="adm-tab${k === S.tab ? " on" : ""}" data-a-tab="${k}"><span>${i}</span>${l}${k === "reports" ? '<b class="adm-dot" id="admRepDot" hidden></b>' : ""}</button>`).join("")}</nav>
      <div id="admView" class="adm-view"></div></div>`;
  }
  function setTabs() {
    document.querySelectorAll(".adm-tab").forEach(b => b.classList.toggle("on", b.dataset.aTab === S.tab));
  }
  const skel = () => '<div class="adm-skel"><i></i><i></i><i></i></div>';
  const empty = (icon, big, small) => `<div class="adm-empty"><span>${icon}</span><p>${big}</p>${small ? `<small>${small}</small>` : ""}</div>`;

  async function loadStats() {
    const { data, error } = await sb.rpc("admin_stats");
    if (error) throw error;
    S.stats = data;
    const dot = $("admRepDot");
    if (dot) { dot.hidden = !data.reports; dot.textContent = data.reports > 9 ? "9+" : data.reports; }
    return data;
  }
  function countUp() {
    document.querySelectorAll("#admView [data-n]").forEach(el => {
      const n = +el.dataset.n || 0; let s = null;
      const step = t => { if (!s) s = t; const k = Math.min(1, (t - s) / 700); el.textContent = Math.round(n * k); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

  /* ---------- Overview ---------- */
  async function vHome(my) {
    const s = await loadStats(); if (my !== tok) return;
    const tot = TYPES.reduce((a, t) => a + (+s[t[0]] || 0), 0);
    let acc = 0;
    const segs = TYPES.map(([k, , , c]) => { const p = tot ? (+s[k] || 0) / tot * 100 : 0; const g = `${c} ${acc}% ${acc + p}%`; acc += p; return g; });
    const donut = tot ? `conic-gradient(${segs.join(",")})` : "conic-gradient(#2a4338 0 100%)";
    const tiles = [["users", "👥", "Users"], ["posts", "📋", "Listings"], ["open", "✅", "Open now"], ["chats", "💬", "Chats"], ["messages", "✉️", "Messages"], ["banned", "🚫", "Banned"]];
    const rep = +s.reports || 0;
    view().innerHTML = `
      ${rep ? `<button class="adm-alert" data-a-tab="reports"><span>🚩</span><div><b>${rep} report${rep === 1 ? "" : "s"} need review</b><small>Tap to check them now</small></div><em>›</em></button>`
        : '<div class="adm-ok">✅ No open reports. All clear.</div>'}
      <div class="adm-tiles">${tiles.map(([k, i, l], n) => `<div class="adm-tile" style="--i:${n}"><span>${i}</span><b data-n="${+s[k] || 0}">0</b><small>${l}</small></div>`).join("")}</div>
      <div class="adm-card"><h3>What people post</h3>
        <div class="adm-mix"><div class="adm-donut" style="background:${donut}"><div><b data-n="${tot}">0</b><small>listings</small></div></div>
        <ul class="adm-legend">${TYPES.map(([k, l, i, c]) => `<li><i style="background:${c}"></i><span>${i} ${l}</span><b>${+s[k] || 0}</b></li>`).join("")}</ul></div></div>`;
    countUp();
  }

  /* ---------- Reports ---------- */
  async function vReports(my) {
    let rs;
    const r = await sb.from("reports").select("id,post_id,reason,created_at,posts(title,loc,type,images)").order("created_at", { ascending: false });
    rs = r.error ? await CB.reports() : r.data;
    if (my !== tok) return;
    view().innerHTML = rs.length ? `<div class="adm-list">${rs.map(x => {
      const p = x.posts, img = p && (p.images || [])[0];
      return `<article class="adm-row"><div class="adm-thumb" ${img ? `style="background-image:url('${esc(img)}')"` : ""}>${img ? "" : (p ? ICON[p.type] || "📄" : "🗑️")}</div>
        <div class="adm-body"><b>${esc(p ? p.title : "(post already deleted)")}</b>
        <small>${p ? "📍 " + esc(p.loc) + " · " : ""}${fdate(x.created_at)}</small>
        <div class="adm-reason">⚠ ${esc(x.reason || "No reason given")}</div></div>
        <div class="adm-act">${p ? `<button class="adm-btn" data-a-view="${esc(x.post_id)}">View</button><button class="adm-btn bad" data-a-del="${esc(x.post_id)}">Delete</button>` : ""}<button class="adm-btn" data-a-dis="${esc(x.id)}">Dismiss</button></div></article>`;
    }).join("")}</div>` : empty("🎉", "All clear!", "Nobody has reported anything.");
  }

  /* ---------- Listings ---------- */
  function postRows() {
    const q = S.q.toLowerCase().trim();
    const items = posts.filter(p => (S.type === "all" || p.type === S.type) && (!q || [p.title, p.loc, p.by, p.cat].join(" ").toLowerCase().includes(q))).slice(0, 100);
    const box = $("admRows"); if (!box) return;
    $("admCount").textContent = items.length + " listing" + (items.length === 1 ? "" : "s");
    box.innerHTML = items.length ? items.map(p => {
      const img = (p.images || [])[0], taken = p.status === "taken", feat = !!(window.slFeat && window.slFeat.meta[p.id] && window.slFeat.meta[p.id].featured);
      return `<article class="adm-row"><div class="adm-thumb" ${img ? `style="background-image:url('${esc(img)}')"` : ""}>${img ? "" : ICON[p.type]}</div>
        <div class="adm-body"><b>${esc(p.title)}</b><small>${LABEL[p.type]} · 📍 ${esc(p.loc)}</small><small>by ${esc(p.by)}${taken ? ` · <em class="adm-pill">${TAKEN[p.type]}</em>` : ""}</small></div>
        <div class="adm-act four"><button class="adm-btn" data-a-view="${esc(p.id)}">View</button><button class="adm-btn${feat ? " on" : ""}" data-a-feat="${esc(p.id)}" data-on="${feat ? 0 : 1}">${feat ? "★ Featured" : "☆ Feature"}</button><button class="adm-btn wide" data-a-tog="${esc(p.id)}">${taken ? "Reopen" : "Mark " + TAKEN[p.type].toLowerCase()}</button><button class="adm-btn bad" data-a-del="${esc(p.id)}">Delete</button></div></article>`;
    }).join("") : empty("🔍", "Nothing found", "Try another search.");
  }
  function vPosts() {
    view().innerHTML = `<div class="adm-find"><input class="adm-search" id="aQ" type="search" placeholder="Search title, area or poster..." value="${esc(S.q)}">
      <div class="adm-chips">${[["all", "All"]].concat(TYPES.map(t => [t[0], t[1]])).map(([k, l]) => `<button class="adm-chip${S.type === k ? " on" : ""}" data-a-type="${k}">${l}</button>`).join("")}</div>
      <div class="adm-count" id="admCount"></div></div><div class="adm-list" id="admRows"></div>`;
    postRows();
  }

  /* ---------- Users ---------- */
  function userRows() {
    const q = S.q.toLowerCase().trim();
    const items = S.users.filter(u => !q || [u.uname, u.uemail, u.uphone].join(" ").toLowerCase().includes(q));
    const box = $("admRows"); if (!box) return;
    $("admCount").textContent = items.length + " user" + (items.length === 1 ? "" : "s");
    box.innerHTML = items.length ? items.map(u => {
      const v = S.ver.has(String(u.uid));
      return `<article class="adm-row"><div class="adm-av" aria-hidden="true">${esc((u.uname || u.uemail || "?")[0]).toUpperCase()}</div>
        <div class="adm-body"><b>${esc(u.uname || "(no name)")}${v ? ' <span class="adm-tag ok">✔ Verified</span>' : ""}${u.admin_flag ? ' <span class="adm-tag">Admin</span>' : ""}${u.is_banned ? ' <span class="adm-tag bad">Banned</span>' : ""}</b>
        <small>${esc(u.uemail || "")}</small><small>${u.uphone ? esc(u.uphone) + " · " : ""}${u.post_count} post${u.post_count == 1 ? "" : "s"} · joined ${fdate(u.joined)}</small></div>
        <div class="adm-act">${u.admin_flag ? "" : `<button class="adm-btn" data-a-ver="${u.uid}" data-on="${v ? 0 : 1}">${v ? "Unverify" : "Verify"}</button><button class="adm-btn ${u.is_banned ? "" : "bad"}" data-a-ban="${u.uid}" data-on="${u.is_banned ? 0 : 1}">${u.is_banned ? "Unban" : "Ban"}</button>`}</div></article>`;
    }).join("") : empty("🔍", "No users found", "");
  }
  async function vUsers(my) {
    const [u, v] = await Promise.all([sb.rpc("admin_users"), sb.from("verified_users").select("user_id").limit(5000)]);
    if (u.error) throw u.error;
    if (my !== tok) return;
    S.users = u.data || [];
    S.ver = new Set((v.data || []).map(x => String(x.user_id)));
    view().innerHTML = `<div class="adm-find"><input class="adm-search" id="aQ" type="search" placeholder="Search name, email or phone..." value="${esc(S.q)}"><div class="adm-count" id="admCount"></div></div><div class="adm-list" id="admRows"></div>`;
    userRows();
  }

  /* ---------- tools moved in from the old dashboard ---------- */
  async function ext(name) {
    const v = view(); if (!v) return;
    if (!window.SLC_ADMIN) { v.innerHTML = empty("⚠️", "Email tools did not load", "Refresh the page and try again."); return; }
    v.innerHTML = '<div class="adm-ext" id="admExt"></div>';
    await window.SLC_ADMIN[name]($("admExt"));
  }
  async function vVerify(my) {
    const { data, error } = await sb.from("verify_requests").select("*").eq("status", "pending").order("created_at");
    if (my !== tok) return;
    if (error) { view().innerHTML = empty("⚠️", "Verification requests are not switched on", "Run requests.sql in Supabase."); return; }
    if (!data.length) { view().innerHTML = empty("✔", "No pending requests", "When a member taps Get verified in More, it shows here."); return; }
    view().innerHTML = data.map(r => { const n = String(r.phone || "").replace(/[^\d]/g, "");
      return `<div class="adm-card"><b>${esc(r.name || "Member")}</b><p>${esc(r.phone || "")}<br><small>${esc(r.note || "")} · ${fdate(r.created_at)}</small></p>
      <div class="adm-act">${n ? `<a class="adm-btn" href="https://wa.me/${n}" target="_blank" rel="noopener">WhatsApp</a><a class="adm-btn" href="tel:${esc(r.phone)}">Call</a>` : ""}<button class="adm-btn wide" data-a-vreq="${esc(r.user_id)}">Verify ✔</button></div></div>`; }).join("");
  }
  async function vExport() {
    view().innerHTML = `<div class="adm-card"><b>⬇️ Download your data</b><p><small>Opens in Excel or Google Sheets.</small></p>
      <div class="adm-act"><button class="adm-btn wide" data-a-csv="posts">All listings (CSV)</button><button class="adm-btn" data-a-csv="users">All members (CSV)</button></div></div>`;
  }
  async function csvUsers() {
    const { data, error } = await sb.rpc("admin_users"); if (error) { toast("Could not load members"); return; }
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"', cols = Object.keys(data[0] || { uname: 1 });
    const csv = [cols.join(",")].concat(data.map(r => cols.map(c => q(r[c])).join(","))).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" })); a.download = "sl-connect-members.csv"; a.click();
  }

  /* ---------- router ---------- */
  async function show() {
    setTabs();
    const v = view(); if (!v) return;
    const my = ++tok, tab = S.tab;
    v.innerHTML = skel();
    try {
      if (tab === "home") await vHome(my);
      else if (tab === "reports") await vReports(my);
      else if (tab === "posts") vPosts();
      else if (tab === "verify") await vVerify(my);
      else if (tab === "email") await ext("email");
      else if (tab === "banner") await ext("announce");
      else if (tab === "export") vExport();
      else await vUsers(my);
    } catch (err) {
      if (my === tok) v.innerHTML = empty("⚠️", "Could not load this page", esc(CB.msg(err)) + ". Did you run chat.sql in Supabase?");
    }
  }

  renderAdmin = async function () {
    if (!user || !user.admin) return;
    $("myList").innerHTML = shell();
    await show();
  };

  /* ---------- actions ---------- */
  document.addEventListener("click", async e => {
    const t = e.target; let el;

    if ((el = t.closest("[data-a-tab]"))) { S.tab = el.dataset.aTab; S.q = ""; S.type = "all"; show(); return; }
    if ((el = t.closest("[data-a-type]"))) { S.type = el.dataset.aType; document.querySelectorAll(".adm-chip").forEach(b => b.classList.toggle("on", b === el)); postRows(); return; }
    if ((el = t.closest("[data-a-view]"))) { if (posts.some(p => p.id === el.dataset.aView)) detail(el.dataset.aView); else toast("This post is no longer available"); return; }

    if ((el = t.closest("[data-a-feat]"))) {
      if (!window.slFeat) { toast("Featured posts are not installed yet."); return; }
      const on = el.dataset.on === "1";
      try { await window.slFeat.set(el.dataset.aFeat, on); toast(on ? "⭐ Post featured" : "Feature removed"); postRows(); }
      catch (err) { toast("Run featured.sql in Supabase first."); }
      return;
    }

    if ((el = t.closest("[data-a-tog]"))) {
      const p = posts.find(x => x.id === el.dataset.aTog); if (!p) return;
      const st = p.status === "taken" ? "open" : "taken";
      try { await CB.setStatus(p.id, st); p.status = st; toast(st === "taken" ? "Marked as " + TAKEN[p.type].toLowerCase() : "Reopened"); postRows(); }
      catch (err) { toast("Could not update: " + CB.msg(err)); }
      return;
    }

    if ((el = t.closest("[data-a-del]"))) {
      const id = el.dataset.aDel, p = posts.find(x => x.id === id);
      if (!await ask("Delete this listing?", (p ? p.title : "This post") + " will be removed for everyone. This cannot be undone.", "Delete", true)) return;
      try {
        await CB.remove(id); posts = posts.filter(x => x.id !== id); toast("Listing deleted");
        if (S.tab === "reports") show(); else { postRows(); loadStats().catch(() => { }); }
      } catch (err) { toast("Could not delete: " + CB.msg(err)); }
      return;
    }

    if ((el = t.closest("[data-a-dis]"))) {
      try { await CB.dismiss(el.dataset.aDis); toast("Report dismissed"); show(); }
      catch (err) { toast("Could not dismiss: " + CB.msg(err)); }
      return;
    }

    if ((el = t.closest("[data-a-ban]"))) {
      const on = el.dataset.on === "1", u = S.users.find(x => String(x.uid) === el.dataset.aBan);
      if (on && !await ask("Ban this user?", (u ? u.uname || u.uemail : "This user") + " will not be able to post or send messages.", "Ban user", true)) return;
      const { error } = await sb.rpc("admin_set_ban", { target: el.dataset.aBan, ban: on });
      if (error) { toast("Could not update: " + CB.msg(error)); return; }
      if (u) u.is_banned = on;
      toast(on ? "User banned" : "User unbanned"); userRows();
      return;
    }

    if ((el = t.closest("[data-a-vreq]"))) {
      const id = el.dataset.aVreq, { error } = await sb.rpc("admin_set_verified", { target: id, make: true });
      if (error) { toast("Run admin.sql in Supabase first."); return; }
      await sb.from("verify_requests").update({ status: "done" }).eq("user_id", id); toast("User verified ✔"); show(); return;
    }
    if ((el = t.closest("[data-a-csv]"))) {
      if (el.dataset.aCsv === "users") await csvUsers();
      else if (window.SLC_ADMIN) { await window.SLC_ADMIN.loadPosts(); window.SLC_ADMIN.csv(); }
      return;
    }

    if ((el = t.closest("[data-a-ver]"))) {
      const on = el.dataset.on === "1", id = el.dataset.aVer;
      const { error } = await sb.rpc("admin_set_verified", { target: id, make: on });
      if (error) { toast("Run admin.sql in Supabase first."); return; }
      on ? S.ver.add(String(id)) : S.ver.delete(String(id));
      toast(on ? "User verified ✔" : "Verification removed"); userRows();
    }
  });

  document.addEventListener("input", e => {
    if (e.target.id !== "aQ") return;
    S.q = e.target.value;
    S.tab === "users" ? userRows() : postRows();
  });
})();
