/* SL Connect - chat upgrade: photo sharing, online + typing, block + report, push notifications.
   Load AFTER chat.js (and voice.js). Needs chat2.sql run in Supabase first.
   Works with the ORIGINAL chat.js, no edits needed. */
(function () {
  if (typeof CLOUD === "undefined" || !CLOUD) return;

  const MARK_IMG = "📷 Photo";

  /* ================= styles ================= */
  const st = document.createElement("style");
  st.textContent = `
.phbtn{flex:none;width:42px;height:42px;border-radius:50%;border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:transparent;color:inherit;font-size:1.1rem;cursor:pointer}
.phbtn:hover{background:color-mix(in srgb,#1eb53a 16%,transparent)}
.vmrec .phbtn{display:none}
.chimg{display:block;width:240px;max-width:100%;min-height:120px;max-height:320px;object-fit:cover;border-radius:12px;cursor:zoom-in;background:color-mix(in srgb,currentColor 12%,transparent)}
.phbox{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:16px}
.phbox img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}
.phbox button{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));right:14px;width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.2);color:#fff;font-size:1.2rem;cursor:pointer}
.chrow .av{position:relative}
.od{display:none;position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;border-radius:50%;background:#1eb53a;border:2px solid Canvas}
.od.on{display:block}
.chhead{position:relative}
.chwho .chstat{color:#1eb53a;opacity:1;font-weight:600;min-height:1em}
.chstat:empty{display:none}
.chmore{flex:none}
.chmenu{position:absolute;right:8px;top:calc(100% + 4px);z-index:20;min-width:220px;padding:6px;border-radius:12px;border:1px solid color-mix(in srgb,currentColor 20%,transparent);background:Canvas;color:CanvasText;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;flex-direction:column;gap:2px}
.chmenu button{border:0;background:transparent;color:inherit;text-align:left;padding:10px 12px;border-radius:8px;font:inherit;cursor:pointer}
.chmenu button:hover{background:color-mix(in srgb,currentColor 10%,transparent)}
.chmenu small{padding:6px 12px 2px;opacity:.65}
.ntbar,.blkbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border-radius:12px;font-size:.9rem;background:color-mix(in srgb,#1eb53a 12%,transparent);border:1px solid color-mix(in srgb,#1eb53a 30%,transparent)}
.ntbar{margin-top:10px}
.ntbar span,.blkbar span{flex:1;min-width:180px}
.blkbar{flex:none;border-radius:0;border-width:1px 0 0;background:color-mix(in srgb,#e0245e 12%,transparent);border-color:color-mix(in srgb,#e0245e 30%,transparent)}
.chform.blkd{opacity:.45;pointer-events:none}
.admrow details{margin-top:6px}
.admrow details small{display:block;margin:2px 0;opacity:.85}`;
  document.head.appendChild(st);

  /* ================= helpers ================= */
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const hm = t => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const errMsg = e => (window.CB && CB.msg ? CB.msg(e) : (e && e.message) || "");

  // learn which chat is open by watching chat.js's messages query (.eq("conv_id", id))
  let lastConv = null;
  try {
    const _from = sb.from.bind(sb);
    sb.from = function (t) {
      const qb = _from(t);
      if (t !== "messages") return qb;
      const _sel = qb.select.bind(qb);
      qb.select = function () {
        const fb = _sel.apply(null, arguments), _eq = fb.eq.bind(fb);
        fb.eq = function (c, v) { if (c === "conv_id") lastConv = v; return _eq.apply(null, arguments); };
        return fb;
      };
      return qb;
    };
  } catch (e) { console.warn("chat2.js: could not hook Supabase", e); }
  const curConv = () => (window.slc && window.slc.conv() ? window.slc.conv().id : lastConv);

  // conversations cache: id -> {id, other, otherName, ...}
  const convCache = new Map();
  let loadingConvs = null, lastLoad = 0;
  function loadConvs() {
    if (loadingConvs) return loadingConvs;
    lastLoad = Date.now();
    loadingConvs = (async () => {
      try {
        const { data } = await sb.from("conversations").select("id,buyer,seller,buyer_name,seller_name");
        (data || []).forEach(c => {
          const mine = c.buyer === user.id;
          convCache.set(String(c.id), {
            id: c.id, other: mine ? c.seller : c.buyer, otherName: (mine ? c.seller_name : c.buyer_name) || "this person"
          });
        });
      } catch (e) { }
      loadingConvs = null; sched();
    })();
    return loadingConvs;
  }
  async function getConv(cid) {
    if (!convCache.has(String(cid))) await loadConvs();
    return convCache.get(String(cid));
  }

  /* ================= signed urls ================= */
  const urlCache = new Map();
  async function signed(path) {
    const hit = urlCache.get(path);
    if (hit && hit.exp > Date.now()) return hit.url;
    const { data, error } = await sb.storage.from("chatimg").createSignedUrl(path, 3600);
    if (error || !data) return null;
    urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
    return data.signedUrl;
  }

  /* ================= 1. photo sharing ================= */
  function loadImg(file) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file), i = new Image();
      i.onload = () => { URL.revokeObjectURL(u); res(i); };
      i.onerror = () => { URL.revokeObjectURL(u); rej(new Error("That file is not a usable photo")); };
      i.src = u;
    });
  }
  async function shrink(file) {
    const i = await loadImg(file), s = Math.min(1, 1280 / Math.max(i.naturalWidth, i.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(i.naturalWidth * s); c.height = Math.round(i.naturalHeight * s);
    c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("Could not prepare the photo")), "image/jpeg", 0.72));
  }

  async function sendPhoto(file) {
    const cid = curConv(); if (!cid) return toast("Open a chat first");
    if (!/^image\//.test(file.type)) return toast("Please pick a photo");
    if (file.size > 20 * 1024 * 1024) return toast("That photo is too big");
    const form = $("chForm"); if (form) form.style.opacity = ".5";
    try {
      toast("Sending photo...");
      const blob = await shrink(file), path = `${cid}/${uuid()}.jpg`;
      const up = await sb.storage.from("chatimg").upload(path, blob, { contentType: "image/jpeg", cacheControl: "3600" });
      if (up.error) throw up.error;
      const { data, error } = await sb.from("messages")
        .insert({ conv_id: cid, sender: user.id, body: MARK_IMG, kind: "image", image_path: path }).select().single();
      if (error) { sb.storage.from("chatimg").remove([path]).catch(() => { }); throw error; }
      if (curConv() !== cid) return;
      const box = $("chMsgs"); if (!box) return;
      const before = box.querySelectorAll(".chb").length;
      setTimeout(() => {   // realtime normally adds it; add by hand only if it did not
        const b = $("chMsgs"); if (!b || curConv() !== cid || b.querySelectorAll(".chb").length > before) return;
        const e = b.querySelector(".empty"); if (e) e.remove();
        b.insertAdjacentHTML("beforeend", `<div class="chb me"><span>${esc(MARK_IMG)}</span><time>${hm(data.created_at)}</time></div>`);
        b.scrollTop = b.scrollHeight; sched();
      }, 2500);
    } catch (err) {
      toast(/row-level/i.test((err && err.message) || "") ? "You cannot send messages right now." : "Could not send photo. " + errMsg(err));
    }
    if (form) form.style.opacity = "";
  }

  // photo bubbles from chat.js carry no image info: match them to rows by position
  let aligning = false, again = false;
  async function alignImg() {
    const box = $("chMsgs"); if (!box || !lastConv) return;
    const isImg = b => { const s = b.querySelector("span"); return s && s.textContent === MARK_IMG; };
    const all = [...box.querySelectorAll(".chb")];
    if (!all.some(b => !b.dataset.image && !b.dataset.im && !b.dataset.imx && isImg(b))) return;
    if (aligning) { again = true; return; }
    aligning = true;
    try {
      const { data, error } = await sb.from("messages").select("id,kind,image_path")
        .eq("conv_id", lastConv).order("created_at", { ascending: false }).limit(all.length);
      if (!error && data) {
        const rows = data.reverse(), off = all.length - rows.length;
        all.forEach((b, i) => {
          if (b.dataset.image || b.dataset.im || !isImg(b)) return;
          const m = rows[i - off];
          if (m && m.kind === "image" && m.image_path) b.dataset.image = m.image_path; else b.dataset.imx = "1";
        });
      }
    } catch (e) { }
    aligning = false; sched();
    if (again) { again = false; alignImg(); }
  }

  function hydrateImages() {
    document.querySelectorAll(".chb[data-image]:not([data-im])").forEach(b => {
      b.dataset.im = "1";
      const sp = b.querySelector("span"); sp.innerHTML = '<img class="chimg" alt="Photo">';
      const img = sp.firstChild;
      img.onload = () => { const m = $("chMsgs"); if (m) m.scrollTop = m.scrollHeight; };
      signed(b.dataset.image).then(u => { if (u) img.src = u; else sp.textContent = "📷 Photo (unavailable)"; });
    });
  }

  function lightbox(src) {
    const d = document.createElement("div");
    d.className = "phbox"; d.innerHTML = `<img src="${esc(src)}" alt="Photo"><button type="button" aria-label="Close">✕</button>`;
    const close = () => { d.remove(); document.removeEventListener("keydown", key); };
    const key = e => { if (e.key === "Escape") close(); };
    d.onclick = e => { if (e.target.tagName !== "IMG") close(); };
    document.addEventListener("keydown", key);
    document.body.appendChild(d);
  }

  function injectPhoto(form) {
    if (form.querySelector(".phbtn")) return;
    const send = form.querySelector("button[type=submit]"); if (!send) return;
    send.insertAdjacentHTML("beforebegin",
      '<button type="button" class="phbtn" aria-label="Send photo">📷</button><input type="file" class="phin" accept="image/*" hidden>');
  }

  /* ================= 2. online status + typing ================= */
  let pres = null, presFor = null, room = null, roomCid = null, lastSent = 0, typingUntil = 0;
  const online = new Set();

  function startPresence() {
    if (pres && presFor === user.id) return;
    stopPresence(); presFor = user.id;
    pres = sb.channel("slc-online", { config: { presence: { key: user.id } } });
    pres.on("presence", { event: "sync" }, () => {
      online.clear(); Object.keys(pres.presenceState()).forEach(k => online.add(k)); paintOnline();
    });
    pres.subscribe(s => { if (s === "SUBSCRIBED") pres.track({ t: Date.now() }); });
  }
  function stopPresence() { if (pres) { try { sb.removeChannel(pres); } catch (e) { } } pres = null; presFor = null; online.clear(); }

  function closeRoom() { if (room) { try { sb.removeChannel(room); } catch (e) { } } room = null; roomCid = null; typingUntil = 0; }
  function roomSync() {
    const c = curConv(); if (!c || c === roomCid) return;
    closeRoom(); roomCid = c;
    room = sb.channel("slc-typing-" + c).on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload && payload.u !== user.id) { typingUntil = Date.now() + 3000; paintOnline(); setTimeout(paintOnline, 3100); }
    }).subscribe();
    getConv(c);
  }

  function paintOnline() {
    if (!user) return;
    const stEl = document.querySelector(".chstat");
    if (stEl) {
      const c = convCache.get(String(curConv()));
      const t = !c ? "" : Date.now() < typingUntil ? "typing…" : online.has(c.other) ? "● online" : "";
      if (stEl.textContent !== t) stEl.textContent = t;
    }
    let missing = false;
    document.querySelectorAll(".chrow[data-conv]").forEach(r => {
      const c = convCache.get(r.dataset.conv), av = r.querySelector(".av");
      if (!c) missing = true;
      if (!av) return;
      let d = av.querySelector(".od");
      if (!d) { d = document.createElement("i"); d.className = "od"; av.appendChild(d); }
      d.classList.toggle("on", !!(c && online.has(c.other)));
    });
    if (missing && Date.now() - lastLoad > 5000) loadConvs();
  }

  document.addEventListener("input", e => {
    if (e.target.id !== "chIn" || !room) return;
    const n = Date.now(); if (n - lastSent < 2000) return; lastSent = n;
    room.send({ type: "broadcast", event: "typing", payload: { u: user.id } });
  });

  function injectHeader() {
    const h = document.querySelector(".chhead"); if (!h) return;
    const who = h.querySelector(".chwho");
    if (who && !who.querySelector(".chstat")) who.insertAdjacentHTML("beforeend", '<small class="chstat"></small>');
    if (!h.querySelector(".chmore")) h.insertAdjacentHTML("beforeend", '<button type="button" class="ghost chmore" aria-label="More options">⋯</button>');
  }

  /* ================= 3. block + report ================= */
  const myBlocks = new Set();
  async function loadBlocks() {
    try {
      const { data } = await sb.from("blocks").select("blocked").eq("blocker", user.id);
      myBlocks.clear(); (data || []).forEach(r => myBlocks.add(r.blocked));
    } catch (e) { }
    sched();
  }

  function blockBar() {
    const form = $("chForm"); if (!form) return;
    const c = convCache.get(String(curConv()));
    const blocked = !!(c && myBlocks.has(c.other));
    const bar = form.parentNode.querySelector(".blkbar");
    form.classList.toggle("blkd", blocked);
    if (blocked && !bar) {
      form.insertAdjacentHTML("beforebegin",
        `<div class="blkbar"><span>🚫 You blocked ${esc(c.otherName)}. You cannot message each other.</span><button type="button" class="ghost" data-unblock>Unblock</button></div>`);
    } else if (!blocked && bar) bar.remove();
  }

  async function setBlock(on) {
    const c = convCache.get(String(curConv())); if (!c) return;
    const { error } = await sb.rpc("block_user", { target: c.other, do_block: on });
    if (error) return toast("Could not update: " + errMsg(error));
    toast(on ? "Blocked " + c.otherName : "Unblocked " + c.otherName);
    await loadBlocks();
  }

  async function sendReport(reason) {
    const cid = curConv(), c = convCache.get(String(cid)); if (!cid) return;
    const { error } = await sb.rpc("report_chat", { cid: String(cid), reason });
    if (error) return toast("Could not send report: " + errMsg(error));
    toast("Report sent. Our team will review it.");
    if (c && !myBlocks.has(c.other) && confirm("Also block " + c.otherName + "?")) setBlock(true);
  }

  function closeMenu() { document.querySelectorAll(".chmenu").forEach(m => m.remove()); }
  function openMenu(btn) {
    if (document.querySelector(".chmenu")) return closeMenu();
    const c = convCache.get(String(curConv())), blocked = !!(c && myBlocks.has(c.other));
    btn.closest(".chhead").insertAdjacentHTML("beforeend",
      `<div class="chmenu"><button type="button" data-xrep>🚩 Report ${esc(c ? c.otherName : "this person")}</button>
       <button type="button" data-xblock="${blocked ? 0 : 1}">${blocked ? "✅ Unblock" : "🚫 Block"}</button></div>`);
  }
  function openReasons() {
    const m = document.querySelector(".chmenu"); if (!m) return;
    m.innerHTML = '<small>Why are you reporting?</small>' +
      ["Scam or fraud", "Abuse or harassment", "Spam", "Something else"].map(r => `<button type="button" data-xreason="${r}">${r}</button>`).join("");
  }

  /* ================= 4. push notifications ================= */
  const KEY = window.VAPID_PUBLIC_KEY;
  const keyOK = !!KEY && !/^PASTE/i.test(KEY);
  const pushOK = () => keyOK && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const b64 = s => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, c => c.charCodeAt(0)); };

  function whenActive(reg) {
    return new Promise((res, rej) => {
      const sw = reg.installing || reg.waiting || reg.active;
      if (!sw) return rej(new Error("no service worker"));
      if (sw.state === "activated") return res(reg);
      sw.addEventListener("statechange", () => {
        if (sw.state === "activated") res(reg);
        if (sw.state === "redundant") rej(new Error("service worker failed"));
      });
    });
  }
  async function pushReg() {
    // own scope, so it never clashes with a service worker you already have
    const reg = await navigator.serviceWorker.register(new URL("push-sw.js", location.href).href,
      { scope: new URL("push-scope/", location.href).href });
    return whenActive(reg);
  }
  async function subscribePush() {
    const reg = await pushReg();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(KEY) });
    const j = sub.toJSON();
    const { error } = await sb.rpc("save_push", { ep: j.endpoint, p256: j.keys.p256dh, au: j.keys.auth });
    if (error) throw error;
  }
  async function enablePush() {
    if (!pushOK()) return;
    if (Notification.permission === "denied") return toast("Notifications are blocked. Turn them on in your browser settings.");
    try {
      if ((await Notification.requestPermission()) !== "granted") return;
      await subscribePush();
      toast("🔔 Notifications are on");
    } catch (e) { toast("Could not turn on notifications. " + errMsg(e)); console.warn(e); }
    const bar = $("ntBar"); if (bar) bar.remove();
  }
  let pushSynced = false;
  function syncPush() {
    if (pushSynced || !pushOK() || Notification.permission !== "granted") return;
    pushSynced = true;
    subscribePush().catch(e => console.warn("push sync failed", e));
  }

  function noteBar() {
    const head = document.querySelector("#p-messages .pagehead"); if (!head) return;
    const bar = $("ntBar");
    let html = "";
    try { if (localStorage.getItem("slc-nt-no")) html = ""; else html = "x"; } catch (e) { html = "x"; }
    if (html) {
      if (pushOK() && Notification.permission === "default")
        html = '<span>🔔 Get a notification when someone messages you, even when the app is closed.</span><button type="button" class="primary" data-ntyes>Turn on</button><button type="button" class="ghost" data-ntno>Not now</button>';
      else if (keyOK && isiOS && !standalone)
        html = '<span>🔔 On iPhone, tap Share then "Add to Home Screen" and open SL Connect from there to get message notifications.</span><button type="button" class="ghost" data-ntno>Got it</button>';
      else html = "";
    }
    if (!html && bar) bar.remove();
    else if (html && !bar) head.insertAdjacentHTML("beforeend", `<div class="ntbar" id="ntBar">${html}</div>`);
  }

  // open a chat from a notification tap (?chat=ID or message from the worker)
  function openChatById(id) {
    if (!id) return;
    let n = 0, opened = false;
    const t = setInterval(() => {
      if (++n > 60) return clearInterval(t);
      if (!user) return;
      if (!opened) { opened = true; try { go("messages"); } catch (e) { } }
      const row = document.querySelector(`[data-conv="${CSS.escape(String(id))}"]`);
      if (row) { clearInterval(t); row.click(); }
    }, 300);
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", e => { if (e.data && e.data.type === "slc-open-chat") openChatById(e.data.conv); });
    try { navigator.serviceWorker.startMessages(); } catch (e) { }
  }
  const wantChat = new URLSearchParams(location.search).get("chat");
  if (wantChat) { openChatById(wantChat); try { history.replaceState(null, "", location.pathname); } catch (e) { } }

  /* ================= admin: chat reports tab ================= */
  async function admReports() {
    const b = $("admBody"); if (!b) return;
    b.innerHTML = '<div class="empty">Loading...</div>';
    const { data, error } = await sb.rpc("admin_chat_reports");
    if (error) { b.innerHTML = '<div class="empty">Could not load. Run chat2.sql, and check slc_is_admin() matches your admin check.</div>'; return; }
    b.innerHTML = data.length ? '<div class="admrows">' + data.map(r => {
      const msgs = (r.snapshot || []).map(m => `<small><b>${esc(m.sender === r.reporter ? r.reporter_name || "Reporter" : r.reported_name || "Reported")}:</b> ${esc(m.body)}</small>`).join("");
      return `<div class="admrow" style="align-items:flex-start"><div><b>${esc(r.reported_name || "Member")}</b> reported by ${esc(r.reporter_name || "Member")}${r.handled ? " · ✅ handled" : ""}
        <small>${esc(r.reason || "")} · ${new Date(r.created_at).toLocaleString()}${r.post_title ? " · " + esc(r.post_title) : ""}</small>
        <details><summary>Last messages</summary>${msgs || "<small>(none)</small>"}</details></div>
        <div class="acts"><button class="del" data-xban="${r.reported}">Ban</button>${r.handled ? "" : `<button class="ghost" data-xres="${r.id}">Mark handled</button>`}</div></div>`;
    }).join("") + "</div>" : '<div class="empty">No chat reports. 🎉</div>';
  }
  if (typeof renderAdmin === "function") {
    const _ra = renderAdmin;
    renderAdmin = async function () {
      await _ra();
      const nav = document.querySelector(".admwrap .tabs");
      if (nav && !nav.querySelector("[data-xadt]")) nav.insertAdjacentHTML("beforeend", '<button class="tab" data-xadt>Chat reports</button>');
    };
  }

  /* ================= scan + events ================= */
  let queued = false;
  function sched() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; scan(); }); }

  let wasIn = false;
  function scan() {
    if (!user) {
      if (wasIn) { wasIn = false; stopPresence(); closeRoom(); myBlocks.clear(); pushSynced = false; }
      return;
    }
    if (!wasIn) { wasIn = true; loadBlocks(); }
    startPresence(); syncPush();
    const form = $("chForm");
    if (form) { injectPhoto(form); injectHeader(); roomSync(); blockBar(); }
    else { closeRoom(); closeMenu(); }
    alignImg(); hydrateImages(); paintOnline(); noteBar();
  }
  new MutationObserver(sched).observe(document.body, { childList: true, subtree: true });
  sched();

  document.addEventListener("click", async e => {
    const t = e.target; let el;
    if (t.closest(".phbtn")) { const f = t.closest("#chForm").querySelector(".phin"); if (f) f.click(); return; }
    if ((el = t.closest(".chimg"))) { if (el.src) lightbox(el.src); return; }
    if (t.closest(".chmore")) { openMenu(t.closest(".chmore")); return; }
    if (t.closest("[data-xrep]")) { openReasons(); return; }
    if ((el = t.closest("[data-xreason]"))) { closeMenu(); sendReport(el.dataset.xreason); return; }
    if ((el = t.closest("[data-xblock]"))) {
      closeMenu();
      const c = convCache.get(String(curConv())), on = el.dataset.xblock === "1";
      if (!on || confirm("Block " + (c ? c.otherName : "this person") + "? Neither of you will be able to send messages.")) setBlock(on);
      return;
    }
    if (t.closest("[data-unblock]")) { setBlock(false); return; }
    if (!t.closest(".chmenu")) closeMenu();
    if (t.closest("[data-ntyes]")) { enablePush(); return; }
    if (t.closest("[data-ntno]")) { try { localStorage.setItem("slc-nt-no", "1"); } catch (e) { } const b = $("ntBar"); if (b) b.remove(); return; }
    if ((el = t.closest("[data-xadt]"))) {
      document.querySelectorAll(".admwrap .tab").forEach(b => b.classList.remove("on"));
      el.classList.add("on"); admReports(); return;
    }
    if ((el = t.closest("[data-xban]"))) {
      if (!confirm("Ban this user from posting and chatting?")) return;
      const { error } = await sb.rpc("admin_set_ban", { target: el.dataset.xban, ban: true });
      toast(error ? "Could not ban: " + errMsg(error) : "User banned"); return;
    }
    if ((el = t.closest("[data-xres]"))) {
      const { error } = await sb.rpc("admin_resolve_chat_report", { rid: +el.dataset.xres });
      if (error) toast("Could not update: " + errMsg(error)); else admReports();
    }
  });

  document.addEventListener("change", e => {
    if (!e.target.classList || !e.target.classList.contains("phin")) return;
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (f) sendPhoto(f);
  });
})();
