/* SL Connect - in-app chat, admin dashboard, better share + deep links.
   Load AFTER app.js, otp-reset.js and features.js. Needs chat.sql run in Supabase first. */
(function () {
  if (typeof CLOUD === "undefined" || !CLOUD) return; // chat and admin need the cloud backend

  /* ================= data helpers ================= */
  const CH = {
    async start(p) {
      const me = await CB.uid();
      if (p.owner === me) throw new Error("This is your own post.");
      const f = await sb.from("conversations").select("*").eq("post_id", p.id).eq("buyer", me).maybeSingle();
      if (f.data) return f.data;
      const r = await sb.from("conversations").insert({
        post_id: p.id, buyer: me, seller: p.owner, post_title: p.title,
        buyer_name: user.name, seller_name: p.by || "Member"
      }).select().single();
      if (r.error) throw r.error;
      return r.data;
    },
    async list() {
      const { data, error } = await sb.from("conversations").select("*").order("last_at", { ascending: false });
      if (error) throw error; return data;
    },
    async msgs(c) {
      const { data, error } = await sb.from("messages").select("*").eq("conv_id", c).order("created_at", { ascending: false }).limit(100);
      if (error) throw error; return data.reverse();
    },
    async send(c, body) {
      const me = await CB.uid();
      const { data, error } = await sb.from("messages").insert({ conv_id: c, sender: me, body }).select().single();
      if (error) throw error; return data;
    },
    async read(c) { await sb.rpc("mark_read", { c }); },
    async unreadMap() {
      const { data } = await sb.from("messages").select("conv_id").is("read_at", null).neq("sender", user.id).limit(1000);
      const m = {}; (data || []).forEach(r => m[r.conv_id] = (m[r.conv_id] || 0) + 1); return m;
    }
  };

  /* ================= messages page ================= */
  const sec = document.createElement("section");
  sec.className = "page"; sec.id = "p-messages";
  sec.innerHTML = '<div class="pagehead"><h1>Messages</h1><p>Chat with workers, owners and sellers.</p></div>' +
    '<div class="chat"><aside class="chlist" id="chList"></aside><div class="chthread" id="chThread"></div></div>';
  document.querySelector("main.wrap").appendChild(sec);

  const hb = document.createElement("button");
  hb.className = "icon"; hb.id = "chatBtn"; hb.hidden = true; hb.setAttribute("aria-label", "Messages");
  hb.innerHTML = '💬<i id="chBadge" class="chbadge" hidden></i>';
  $("auth").parentNode.insertBefore(hb, $("auth"));
  hb.onclick = () => go("messages");

  let conv = null, convs = [], seen = new Set(), rt = null;
  const other = c => (c.buyer === user.id ? c.seller_name : c.buyer_name) || "Member";
  const hm = t => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const toBottom = () => { const m = $("chMsgs"); if (m) m.scrollTop = m.scrollHeight; };

  async function refreshBadge() {
    if (!user) return;
    try {
      const m = await CH.unreadMap(), n = Object.values(m).reduce((a, b) => a + b, 0), b = $("chBadge");
      b.textContent = n > 9 ? "9+" : n; b.hidden = !n;
    } catch (e) { }
  }

  async function renderList() {
    const L = $("chList");
    try {
      const [cs, um] = await Promise.all([CH.list(), CH.unreadMap()]);
      convs = cs;
      L.innerHTML = cs.length ? cs.map(c => `<button class="chrow ${conv && conv.id === c.id ? "on" : ""}" data-conv="${c.id}">
        <span class="av">${esc(other(c)[0] || "?").toUpperCase()}</span>
        <span class="chmid"><b>${esc(other(c))}</b><small>${esc(c.post_title || "")}</small><em>${esc(c.last_msg || "No messages yet")}</em></span>
        ${um[c.id] ? `<span class="chunread">${um[c.id]}</span>` : ""}</button>`).join("")
        : '<div class="empty">No chats yet. Open a listing and tap Chat.</div>';
    } catch (e) { L.innerHTML = '<div class="empty">Could not load chats. Did you run chat.sql?</div>'; }
  }

  function addMsg(m) {
    if (seen.has(m.id) || !$("chMsgs")) return; seen.add(m.id);
    $("chMsgs").insertAdjacentHTML("beforeend",
      `<div class="chb ${m.sender === user.id ? "me" : ""}"><span>${esc(m.body)}</span><time>${hm(m.created_at)}</time></div>`);
  }

  async function openConv(c) {
    conv = c; seen.clear(); sec.classList.add("inthread");
    $("chThread").innerHTML = `<div class="chhead"><button class="ghost" data-chback aria-label="Back">←</button>
      <div class="chwho"><b>${esc(other(c))}</b><small>${esc(c.post_title || "")}</small></div>
      <button class="ghost" data-chpost="${esc(c.post_id)}">View post</button></div>
      <div class="chmsgs" id="chMsgs"><div class="empty">Loading...</div></div>
      <form class="chform" id="chForm"><input id="chIn" maxlength="1000" placeholder="Type a message..." autocomplete="off"><button class="primary" type="submit">Send</button></form>`;
    try {
      const ms = await CH.msgs(c.id);
      $("chMsgs").innerHTML = ""; ms.forEach(addMsg);
      if (!ms.length) $("chMsgs").innerHTML = '<div class="empty">Say hello 👋</div>';
      toBottom();
      CH.read(c.id).then(() => { refreshBadge(); renderList(); });
    } catch (e) { $("chMsgs").innerHTML = '<div class="empty">Could not load messages.</div>'; }
    renderList();
  }

  function subscribe() {
    if (rt || !user) return;
    rt = sb.channel("slc-chat").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, pl => {
      const m = pl.new; if (!user) return;
      if (conv && m.conv_id === conv.id && page === "messages") {
        const empty = $("chMsgs").querySelector(".empty"); if (empty) empty.remove();
        addMsg(m); toBottom();
        if (m.sender !== user.id) CH.read(conv.id).then(refreshBadge);
      } else if (m.sender !== user.id) {
        toast("💬 New message"); refreshBadge(); if (page === "messages") renderList();
      }
    }).subscribe();
  }

  /* ---- wrap existing functions from app.js ---- */
  const _go = go;
  go = function (p) {
    if (p === "messages" && !user) { toast("Please sign in first"); openAuth("in"); return _go("home"); }
    _go(p);
    if (p === "messages") {
      conv = null; sec.classList.remove("inthread");
      $("chThread").innerHTML = '<div class="empty">Pick a chat to start.</div>';
      renderList();
    }
  };

  const _rh = renderHeader;
  renderHeader = function () {
    _rh();
    hb.hidden = !user;
    if (user) { subscribe(); refreshBadge(); }
    else if (rt) { try { sb.removeChannel(rt); } catch (e) { } rt = null; }
  };
  if (user) renderHeader();

  const _detail = detail;
  detail = function (id) {
    _detail(id);
    const p = posts.find(x => x.id === id), a = document.querySelector("#ddBody .acts");
    if (!p || !a) return;
    a.insertAdjacentHTML("beforeend", `<button class="ghost" data-copy="${esc(id)}">🔗 Copy link</button>`);
    if (user && p.owner !== user.id) a.insertAdjacentHTML("afterbegin", `<button class="primary" data-chat="${esc(id)}">💬 Chat</button>`);
  };

  /* ================= share link + deep link ================= */
  const linkOf = id => location.origin + location.pathname + "?post=" + encodeURIComponent(id);
  share = function (p) {
    const url = linkOf(p.id), t = `${p.title} – ${p.loc}${p.price ? " – " + p.price : ""}\nSee it on SL Connect:`;
    if (navigator.share) navigator.share({ title: p.title, text: t, url }).catch(() => { });
    else window.open("https://wa.me/?text=" + encodeURIComponent(t + " " + url), "_blank", "noopener");
  };
  const want = new URLSearchParams(location.search).get("post");
  if (want) {
    let n = 0;
    const t = setInterval(() => {
      if (++n > 240) return clearInterval(t);
      if (user && posts.some(p => p.id === want)) {
        clearInterval(t); detail(want);
        try { history.replaceState(null, "", location.pathname); } catch (e) { }
      }
    }, 500);
  }

  /* ================= admin dashboard ================= */
  let adTab = "stats", adQ = "";
  const rowsPosts = () => {
    const q = adQ.toLowerCase();
    const items = posts.filter(p => !q || [p.title, p.loc, p.by, LABEL[p.type]].join(" ").toLowerCase().includes(q)).slice(0, 100);
    $("admRows").innerHTML = items.length ? items.map(p => `<div class="admrow"><div><b>${esc(p.title)}</b><small>${LABEL[p.type]} · ${esc(p.loc)} · ${esc(p.by)}${p.status === "taken" ? " · " + TAKEN[p.type] : ""}</small></div>
      <div class="acts"><button class="ghost" data-act="toggle" data-id="${p.id}">${p.status === "taken" ? "Reopen" : "Mark " + TAKEN[p.type].toLowerCase()}</button><button class="del" data-act="del" data-id="${p.id}">Delete</button></div></div>`).join("")
      : '<div class="empty">No listings found.</div>';
  };

  async function admBody() {
    const b = $("admBody"); if (!b) return;
    try {
      if (adTab === "stats") {
        const { data, error } = await sb.rpc("admin_stats"); if (error) throw error;
        const S = [["Users", data.users], ["Listings", data.posts], ["Open listings", data.open], ["Open reports", data.reports], ["Chats", data.chats], ["Messages", data.messages], ["Banned", data.banned]];
        const T = [["🛠️ Workers", data.service], ["💼 Jobs", data.job], ["🏠 Rentals", data.rent], ["🌍 Land", data.land]];
        const box = a => `<div class="admstats">${a.map(([k, v]) => `<div class="admstat"><b>${v}</b><span>${k}</span></div>`).join("")}</div>`;
        b.innerHTML = box(S) + '<h3 class="admh">Listings by type</h3>' + box(T);
      } else if (adTab === "reports") {
        const rs = await CB.reports();
        b.innerHTML = rs.length ? '<div class="grid">' + rs.map(r => `<div class="card" style="cursor:default"><div class="cb"><div class="tag">Reported</div><h3>${esc(r.posts ? r.posts.title : "(post already deleted)")}</h3><div class="meta">📍 ${esc(r.posts ? r.posts.loc : "")}</div><div class="by">Reason: ${esc(r.reason || "not given")}</div><div class="acts">${r.posts ? `<button class="del" data-act="del" data-id="${r.post_id}">Delete post</button>` : ""}<button class="ghost" data-adm="${r.id}">Dismiss</button></div></div></div>`).join("") + "</div>" : '<div class="empty">No reports. 🎉</div>';
      } else if (adTab === "posts") {
        b.innerHTML = `<input class="search" id="admQ" type="search" placeholder="Search listings by title, area or poster..." value="${esc(adQ)}"><div class="admrows" id="admRows"></div>`;
        rowsPosts();
      } else {
        const { data, error } = await sb.rpc("admin_users"); if (error) throw error;
        b.innerHTML = '<div class="admrows">' + data.map(u => `<div class="admrow"><div><b>${esc(u.uname || "(no name)")}${u.admin_flag ? " · admin" : ""}${u.is_banned ? " · 🚫 banned" : ""}</b>
          <small>${esc(u.uemail || "")}${u.uphone ? " · " + esc(u.uphone) : ""} · ${u.post_count} post${u.post_count == 1 ? "" : "s"} · joined ${new Date(u.joined).toLocaleDateString()}</small></div>
          <div class="acts">${u.admin_flag ? "" : `<button class="${u.is_banned ? "ghost" : "del"}" data-ban="${u.uid}" data-on="${u.is_banned ? 0 : 1}">${u.is_banned ? "Unban" : "Ban"}</button>`}</div></div>`).join("") + "</div>";
      }
    } catch (e) { b.innerHTML = '<div class="empty">Could not load. Did you run chat.sql in Supabase?</div>'; }
  }

  renderAdmin = async function () {
    $("myList").innerHTML = `<div class="admwrap"><nav class="tabs">${[["stats", "Overview"], ["reports", "Reports"], ["posts", "Listings"], ["users", "Users"]].map(([k, v]) => `<button class="tab ${k === adTab ? "on" : ""}" data-adt="${k}">${v}</button>`).join("")}</nav><div id="admBody"><div class="empty">Loading...</div></div></div>`;
    await admBody();
  };

  /* ================= events ================= */
  document.addEventListener("click", async e => {
    const t = e.target;
    let el;
    if ((el = t.closest("[data-chat]"))) {
      const p = posts.find(x => x.id === el.dataset.chat); if (!p) return;
      try { const c = await CH.start(p); $("dd").close(); go("messages"); await openConv(c); }
      catch (err) { toast(CB.msg(err)); }
      return;
    }
    if ((el = t.closest("[data-conv]"))) { const c = convs.find(x => x.id === el.dataset.conv); if (c) openConv(c); return; }
    if (t.closest("[data-chback]")) { conv = null; sec.classList.remove("inthread"); renderList(); return; }
    if ((el = t.closest("[data-chpost]"))) { if (posts.some(p => p.id === el.dataset.chpost)) detail(el.dataset.chpost); else toast("This post is no longer available"); return; }
    if ((el = t.closest("[data-copy]"))) {
      const url = linkOf(el.dataset.copy);
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast("Link copied 🔗")).catch(() => prompt("Copy this link:", url));
      return;
    }
    if ((el = t.closest("[data-adt]"))) { adTab = el.dataset.adt; renderAdmin(); return; }
    if ((el = t.closest("[data-ban]"))) {
      const on = el.dataset.on === "1";
      if (on && !confirm("Ban this user from posting and chatting?")) return;
      const { error } = await sb.rpc("admin_set_ban", { target: el.dataset.ban, ban: on });
      if (error) toast("Could not update: " + CB.msg(error)); else { toast(on ? "User banned" : "User unbanned"); admBody(); }
    }
  });

  document.addEventListener("input", e => { if (e.target.id === "admQ") { adQ = e.target.value; rowsPosts(); } });

  document.addEventListener("submit", async e => {
    if (e.target.id !== "chForm") return;
    e.preventDefault();
    const i = $("chIn"), v = i.value.trim(); if (!v || !conv) return;
    i.value = "";
    try {
      const m = await CH.send(conv.id, v);
      const empty = $("chMsgs").querySelector(".empty"); if (empty) empty.remove();
      addMsg(m); toBottom();
    } catch (err) {
      i.value = v;
      toast(/row-level/i.test(err.message || "") ? "You cannot send messages right now." : "Could not send. " + CB.msg(err));
    }
  });

  addEventListener("focus", () => { if (user) refreshBadge(); });
})();
