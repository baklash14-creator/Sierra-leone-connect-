/* SL Connect - voice calls inside the chat (WebRTC).
   Load AFTER chat.js. Needs call.sql run in Supabase first.
   Optional: set window.TURN_SERVERS in index.html so calls also connect on mobile data. */
(function () {
  if (typeof CLOUD === "undefined" || !CLOUD) return;
  if (!window.RTCPeerConnection || !navigator.mediaDevices) { console.warn("call.js: this browser cannot make calls"); return; }

  const ICE = (Array.isArray(window.TURN_SERVERS) ? window.TURN_SERVERS : [])
    .concat([{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]);

  /* ================= styles ================= */
  const st = document.createElement("style");
  st.textContent = `
.callbtn{flex:none}
#callUI{position:fixed;inset:0;z-index:9998;background:#0e1a12;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center}
#callUI[hidden]{display:none}
.clav{width:110px;height:110px;border-radius:50%;background:#1eb53a;display:grid;place-items:center;font-size:3rem;font-weight:700;margin-bottom:8px}
.clname{margin:0;font-size:1.6rem}
.clst{margin:0;opacity:.8;min-height:1.4em;font-variant-numeric:tabular-nums}
.clbtns{display:flex;gap:22px;margin-top:36px}
.clb{width:76px;height:76px;border-radius:50%;border:0;color:#fff;font:600 .85rem system-ui,sans-serif;cursor:pointer;background:#444}
.clb.red{background:#e0245e}.clb.grn{background:#1eb53a}.clb.on{background:#fff;color:#111}`;
  document.head.appendChild(st);

  /* ================= helpers ================= */
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const fmt = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const errMsg = e => (window.CB && CB.msg ? CB.msg(e) : (e && e.message) || "");

  // which chat is open (watch chat.js's messages query)
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
  } catch (e) { }
  const curConv = () => (window.slc && window.slc.conv() ? window.slc.conv().id : lastConv);

  const convCache = new Map();
  let loadingConvs = null;
  function loadConvs() {
    if (loadingConvs) return loadingConvs;
    loadingConvs = (async () => {
      try {
        const { data } = await sb.from("conversations").select("id,buyer,seller,buyer_name,seller_name");
        (data || []).forEach(c => {
          const mine = c.buyer === user.id;
          convCache.set(String(c.id), { id: c.id, other: mine ? c.seller : c.buyer, otherName: (mine ? c.seller_name : c.buyer_name) || "Member" });
        });
      } catch (e) { }
      loadingConvs = null;
    })();
    return loadingConvs;
  }
  async function getConv(cid) {
    if (!convCache.has(String(cid))) await loadConvs();
    return convCache.get(String(cid));
  }

  /* ================= call screen ================= */
  const BTN_END = '<button type="button" class="clb red" data-cend>End</button>';
  const BTN_IN = '<button type="button" class="clb red" data-cend>Decline</button><button type="button" class="clb grn" data-cacc>Answer</button>';
  const BTN_LIVE = '<button type="button" class="clb" data-cmute>Mute</button><button type="button" class="clb red" data-cend>End</button>';

  function ui() {
    let d = $("callUI");
    if (!d) {
      document.body.insertAdjacentHTML("beforeend",
        '<div id="callUI" hidden><div class="clav"></div><h2 class="clname"></h2><p class="clst"></p><div class="clbtns"></div></div><audio id="callAudio" autoplay playsinline></audio>');
      d = $("callUI");
    }
    return d;
  }
  function paint(name, status, btns) {
    const d = ui(); d.hidden = false;
    d.querySelector(".clav").textContent = (name || "?")[0].toUpperCase();
    d.querySelector(".clname").textContent = name || "";
    d.querySelector(".clst").textContent = status;
    d.querySelector(".clbtns").innerHTML = btns;
  }
  const setStatus = t => { const s = document.querySelector("#callUI .clst"); if (s && s.textContent !== t) s.textContent = t; };

  /* ================= ring tone ================= */
  let tone = null, ac = null, tickT = null;
  function startRing() {
    stopRing();
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.resume) ac.resume(); } catch (e) { }
    const beep = () => {
      try {
        if (ac) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 480; g.gain.value = 0.15; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.4); }
        if (navigator.vibrate) navigator.vibrate([400, 200, 400]);
      } catch (e) { }
    };
    beep(); tone = setInterval(beep, 2000);
  }
  function stopRing() { clearInterval(tone); tone = null; try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) { } }

  /* ================= signalling ================= */
  let call = null;
  async function sendSig(callId, conv, to, kind, payload) {
    const { error } = await sb.rpc("send_call_signal", { p_call: callId, p_conv: String(conv), p_to: to, p_kind: kind, p_payload: payload || null });
    if (error) throw error;
  }
  const send = (kind, payload) => (call ? sendSig(call.id, call.conv, call.peer, kind, payload).catch(() => { }) : null);
  function markReady() { if (!call) return; call.ready = true; call.outIce.splice(0).forEach(c => send("ice", c)); }
  async function flushIce() {
    if (!call || !call.pc) return;
    for (const c of call.pending.splice(0)) await call.pc.addIceCandidate(c).catch(() => { });
  }
  function logMsg(conv, body) {
    sb.from("messages").insert({ conv_id: conv, sender: user.id, body }).then(() => { }, () => { });
  }

  async function mic() {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) { toast("Allow microphone access to make calls"); return null; }
  }

  function makePC() {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pc.onicecandidate = e => {
      if (!e.candidate || !call) return;
      const c = e.candidate.toJSON();
      if (call.ready) send("ice", c); else call.outIce.push(c);
    };
    pc.ontrack = e => { const a = ui() && $("callAudio"); a.srcObject = e.streams[0]; a.play().catch(() => { }); };
    pc.onconnectionstatechange = () => {
      if (!call || call.pc !== pc) return;
      const s = pc.connectionState;
      if (s === "connected" && !call.t0) {
        call.t0 = Date.now(); clearTimeout(call.ringT); stopRing();
        paint(call.name, "0:00", BTN_LIVE);
        tickT = setInterval(() => { if (call && call.t0) setStatus(fmt((Date.now() - call.t0) / 1000)); }, 500);
      } else if (s === "failed") finish("Connection failed", true);
      else if (s === "disconnected") {
        const id = call.id;
        setTimeout(() => { if (call && call.id === id && pc.connectionState === "disconnected") finish("Connection lost", true); }, 8000);
      }
    };
    return pc;
  }

  function cleanup(reason) {
    const c = call; call = null;
    stopRing(); clearInterval(tickT); tickT = null;
    if (c) {
      clearTimeout(c.ringT);
      try { if (c.stream) c.stream.getTracks().forEach(t => t.stop()); } catch (e) { }
      try { if (c.pc) c.pc.close(); } catch (e) { }
    }
    const a = $("callAudio"); if (a) a.srcObject = null;
    const d = $("callUI");
    if (d && reason) {
      d.querySelector(".clst").textContent = reason; d.querySelector(".clbtns").innerHTML = "";
      setTimeout(() => { if (!call) d.hidden = true; }, 1500);
    } else if (d) d.hidden = true;
  }

  // end the call. tell = true when this phone ended it, so the other side is told
  function finish(reason, tell) {
    const c = call; if (!c) return;
    if (tell) {
      const kind = c.role === "callee" && !c.pc ? "decline" : "end";
      sendSig(c.id, c.conv, c.peer, kind, null).catch(() => { });
    }
    if (c.role === "caller") {
      logMsg(c.conv, c.t0 ? "📞 Voice call · " + fmt((Date.now() - c.t0) / 1000)
        : /declin/i.test(reason) ? "📞 Call declined" : "📞 Missed voice call");
    }
    cleanup(reason);
  }

  /* ================= caller ================= */
  async function startCall() {
    if (call) return toast("You are already in a call");
    const cid = curConv(); if (!cid) return toast("Open a chat first");
    const c = await getConv(cid); if (!c) return toast("Could not start the call");
    const stream = await mic(); if (!stream) return;
    call = { id: uuid(), conv: cid, peer: c.other, name: c.otherName, role: "caller", stream, pending: [], outIce: [], ready: false, t0: 0 };
    const mine = call.id;
    paint(c.otherName, "Calling…", BTN_END);
    try {
      call.pc = makePC();
      stream.getTracks().forEach(t => call.pc.addTrack(t, stream));
      const o = await call.pc.createOffer();
      await call.pc.setLocalDescription(o);
      await sendSig(call.id, call.conv, call.peer, "offer", { type: o.type, sdp: o.sdp });
      if (!call || call.id !== mine) return;
      markReady();
      call.ringT = setTimeout(() => finish("No answer", true), 45000);
    } catch (err) {
      cleanup();
      toast(/row-level/i.test((err && err.message) || "") ? "You cannot call this person right now." : "Could not start the call. " + errMsg(err));
    }
  }

  /* ================= receiver ================= */
  async function onOffer(row) {
    if (call) { sendSig(row.call_id, row.conv_id, row.from_user, "busy", null).catch(() => { }); return; }
    const c = await getConv(row.conv_id);
    if (call) return;
    call = { id: row.call_id, conv: row.conv_id, peer: row.from_user, name: c ? c.otherName : "Someone", role: "callee",
      offer: row.payload, pending: [], outIce: [], ready: false, t0: 0 };
    paint(call.name, "Incoming voice call…", BTN_IN);
    startRing();
    call.ringT = setTimeout(() => cleanup("Missed call"), 50000);
    if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
      const opts = { body: "Incoming voice call", tag: "slc-call", requireInteraction: true, data: { conv: String(row.conv_id) },
        icon: new URL("icon-192.png", location.href).href };
      navigator.serviceWorker.getRegistration(new URL("push-scope/", location.href).href)
        .then(r => r ? r.showNotification(call ? call.name : "SL Connect", opts) : new Notification(call ? call.name : "SL Connect", opts))
        .catch(() => { });
    }
  }

  async function answerCall() {
    if (!call || call.role !== "callee" || call.pc) return;
    const mine = call.id; stopRing();
    const stream = await mic();
    if (!call || call.id !== mine) { if (stream) stream.getTracks().forEach(t => t.stop()); return; }
    if (!stream) return finish("Declined", true);
    call.stream = stream; clearTimeout(call.ringT);
    paint(call.name, "Connecting…", BTN_END);
    try {
      call.pc = makePC();
      stream.getTracks().forEach(t => call.pc.addTrack(t, stream));
      await call.pc.setRemoteDescription(call.offer);
      await flushIce();
      const a = await call.pc.createAnswer();
      await call.pc.setLocalDescription(a);
      await sendSig(call.id, call.conv, call.peer, "answer", { type: a.type, sdp: a.sdp });
      markReady();
    } catch (err) { finish("Could not connect", true); }
  }

  async function onSignal(row) {
    if (!row || !user) return;
    if (row.kind === "offer") return onOffer(row);
    if (!call || call.id !== row.call_id) return;
    if (row.kind === "answer" && call.role === "caller" && call.pc && !call.pc.remoteDescription) {
      clearTimeout(call.ringT); setStatus("Connecting…");
      try { await call.pc.setRemoteDescription(row.payload); await flushIce(); } catch (e) { finish("Could not connect", true); }
    } else if (row.kind === "ice") {
      if (call.pc && call.pc.remoteDescription) call.pc.addIceCandidate(row.payload).catch(() => { });
      else call.pending.push(row.payload);
    } else if (row.kind === "end") finish(call.t0 ? "Call ended" : call.role === "callee" ? "Missed call" : "Call ended", false);
    else if (row.kind === "decline") finish("Declined", false);
    else if (row.kind === "busy") finish("Busy", false);
  }

  /* ================= wiring ================= */
  let ch = null, chFor = null;
  function startSig() {
    if (ch && chFor === user.id) return;
    stopSig(); chFor = user.id;
    ch = sb.channel("slc-calls-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals", filter: "to_user=eq." + user.id }, pl => onSignal(pl.new))
      .subscribe();
  }
  function stopSig() { if (ch) { try { sb.removeChannel(ch); } catch (e) { } } ch = null; chFor = null; }

  let queued = false;
  function sched() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; scan(); }); }
  function scan() {
    if (!user) { if (ch) { stopSig(); if (call) cleanup(); } return; }
    startSig();
    const h = document.querySelector(".chhead");
    if (h && !h.querySelector(".callbtn")) h.insertAdjacentHTML("beforeend", '<button type="button" class="ghost callbtn" aria-label="Voice call">📞</button>');
  }
  new MutationObserver(sched).observe(document.body, { childList: true, subtree: true });
  sched();

  document.addEventListener("click", e => {
    const t = e.target;
    if (t.closest(".callbtn")) return startCall();
    if (t.closest("[data-cacc]")) return answerCall();
    if (t.closest("[data-cend]")) return finish(call && call.t0 ? "Call ended" : call && call.role === "callee" ? "Declined" : "Cancelled", true);
    const m = t.closest("[data-cmute]");
    if (m && call && call.stream) {
      const off = m.classList.toggle("on");
      call.stream.getAudioTracks().forEach(a => { a.enabled = !off; });
      m.textContent = off ? "Unmute" : "Mute";
    }
  });

  addEventListener("pagehide", () => { if (call) finish("Call ended", true); });
})();
