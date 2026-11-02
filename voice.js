/* SL Connect - voice messages for the in-app chat.
   Load AFTER chat.js. Needs voice.sql run in Supabase first, plus the 2 small patches in chat.js
   (they expose window.slc and tag voice bubbles). */
(function () {
  if (typeof CLOUD === "undefined" || !CLOUD || !window.slc) return;

  const BUCKET = "voice", MAX_MS = 120000, MIN_MS = 800, MARK = "🎤 Voice message";

  /* ================= styles (self-contained) ================= */
  const st = document.createElement("style");
  st.textContent = `
.vmmic{flex:none;width:42px;height:42px;border-radius:50%;border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:transparent;color:inherit;font-size:1.1rem;cursor:pointer}
.vmmic:hover{background:color-mix(in srgb,#1eb53a 16%,transparent)}
.vmbar{display:none;flex:1;align-items:center;gap:10px;min-width:0}
.vmrec .vmbar{display:flex}
.vmrec #chIn,.vmrec .vmmic,.vmrec button[type=submit]{display:none}
.vmdot{width:10px;height:10px;border-radius:50%;background:#e0245e;animation:vmpulse 1s infinite}
@keyframes vmpulse{50%{opacity:.25}}
.vmtime{flex:1;font-variant-numeric:tabular-nums}
.vmcancel,.vmsend{flex:none;width:42px;height:42px;border-radius:50%;border:0;cursor:pointer;font-size:1.05rem}
.vmcancel{background:color-mix(in srgb,currentColor 12%,transparent);color:inherit}
.vmsend{background:#1eb53a;color:#fff}
.vmbusy{opacity:.55;pointer-events:none}
.vmp{display:flex;align-items:center;gap:8px;min-width:200px}
.vmplay{flex:none;width:34px;height:34px;border-radius:50%;border:0;cursor:pointer;background:currentColor;display:grid;place-items:center;font-size:.8rem}
.vmplay>i{font-style:normal;color:#1eb53a;filter:invert(0)}
.chb:not(.me) .vmplay>i{color:#fff}
.vmtrack{flex:1;height:6px;border-radius:3px;background:color-mix(in srgb,currentColor 28%,transparent);cursor:pointer;overflow:hidden;min-width:60px}
.vmfill{height:100%;width:0;background:currentColor}
.vmdur{flex:none;font-size:.75rem;font-variant-numeric:tabular-nums;opacity:.85}
.vmspeed{flex:none;border:0;border-radius:10px;padding:2px 6px;font:600 .7rem system-ui,sans-serif;cursor:pointer;background:color-mix(in srgb,currentColor 18%,transparent);color:inherit}`;
  document.head.appendChild(st);

  /* ================= helpers ================= */
  const fmt = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const pickMime = () => {
    if (!window.MediaRecorder) return "";
    return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(t => MediaRecorder.isTypeSupported(t)) || "";
  };
  const extOf = m => /mp4|m4a/.test(m) ? "m4a" : /ogg/.test(m) ? "ogg" : "webm";

  /* ================= recorder ================= */
  let rec = null, stream = null, chunks = [], timer = null, startAt = 0, cancelled = false, recConv = null, recForm = null, mime = "";

  function cleanup() {
    clearInterval(timer); timer = null;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (recForm) recForm.classList.remove("vmrec");
    rec = null;
  }

  function tick() {
    const ms = Date.now() - startAt, t = recForm && recForm.querySelector(".vmtime");
    if (t) t.textContent = fmt(ms / 1000) + " / " + fmt(MAX_MS / 1000);
    if (ms >= MAX_MS) stop(true);
  }

  async function start(form) {
    if (rec) return;
    if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      return toast("Voice messages are not supported on this browser");
    const c = slc.conv(); if (!c) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) { return toast("Allow microphone access to send voice messages"); }
    try {
      mime = pickMime();
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
    } catch (e) { cleanup(); return toast("Could not start recording"); }
    chunks = []; cancelled = false; recConv = c.id; recForm = form;
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = onStop;
    rec.start(250);
    startAt = Date.now();
    form.classList.add("vmrec"); tick();
    timer = setInterval(tick, 200);
  }

  function stop(send) {
    if (!rec) return;
    cancelled = !send;
    clearInterval(timer); timer = null;
    if (rec.state !== "inactive") rec.stop(); else onStop();
  }

  async function onStop() {
    const ms = Date.now() - startAt, form = recForm, cid = recConv;
    const type = (rec && rec.mimeType) || mime || "audio/webm";
    const blob = new Blob(chunks, { type }); chunks = [];
    cleanup();
    if (cancelled) return;
    if (ms < MIN_MS || !blob.size) return toast("Hold on a little longer to record");
    if (form) form.classList.add("vmbusy");
    try { await sendVoice(blob, Math.min(ms, MAX_MS), cid); }
    catch (err) { toast("Could not send voice message. " + (window.CB && CB.msg ? CB.msg(err) : "")); }
    if (form) form.classList.remove("vmbusy");
  }

  async function sendVoice(blob, ms, cid) {
    const type = (blob.type || "audio/webm").split(";")[0];
    const path = `${cid}/${uuid()}.${extOf(type)}`;
    const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: "3600" });
    if (up.error) throw up.error;
    const { data, error } = await sb.from("messages")
      .insert({ conv_id: cid, sender: user.id, body: MARK, kind: "voice", audio_path: path, audio_ms: ms })
      .select().single();
    if (error) { sb.storage.from(BUCKET).remove([path]).catch(() => { }); throw error; }
    if (slc.conv() && slc.conv().id === cid) slc.add(data);
  }

  /* ================= player ================= */
  const urlCache = new Map();
  async function signed(path) {
    const hit = urlCache.get(path);
    if (hit && hit.exp > Date.now()) return hit.url;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data) return null;
    urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
    return data.signedUrl;
  }

  let current = null;
  const SPEEDS = [1, 1.5, 2];

  function build(bubble) {
    bubble.dataset.vm = "1";
    const p = { path: bubble.dataset.audio, ms: +bubble.dataset.ms || 0, a: null, speed: 0 };
    const span = bubble.querySelector("span");
    span.innerHTML = `<div class="vmp"><button type="button" class="vmplay" aria-label="Play"><i>▶</i></button>
      <div class="vmtrack"><div class="vmfill"></div></div><span class="vmdur">${fmt(p.ms / 1000)}</span>
      <button type="button" class="vmspeed" aria-label="Playback speed">1×</button></div>`;
    p.el = span.firstElementChild;
    p.icon = p.el.querySelector(".vmplay i");
    p.fill = p.el.querySelector(".vmfill");
    p.dur = p.el.querySelector(".vmdur");
    p.el._vm = p;
  }

  const total = p => p.ms ? p.ms / 1000 : (p.a && isFinite(p.a.duration) ? p.a.duration : 0);

  async function toggle(p) {
    if (!p.a) {
      p.icon.textContent = "…";
      const url = await signed(p.path);
      if (!url) { p.icon.textContent = "▶"; return toast("Could not load voice message"); }
      p.a = new Audio(url); p.a.preload = "auto";
      p.a.onplay = () => { p.icon.textContent = "⏸"; };
      p.a.onpause = () => { p.icon.textContent = "▶"; };
      p.a.ontimeupdate = () => {
        const d = total(p) || 1;
        p.fill.style.width = Math.min(100, p.a.currentTime / d * 100) + "%";
        p.dur.textContent = fmt(p.a.currentTime);
      };
      p.a.onended = () => { p.fill.style.width = "0"; p.dur.textContent = fmt(total(p)); p.icon.textContent = "▶"; if (current === p) current = null; };
      p.a.onerror = () => { p.icon.textContent = "▶"; toast("Could not play this voice message"); };
    }
    if (p.a.paused) {
      if (current && current !== p && current.a) current.a.pause();
      current = p; p.a.playbackRate = SPEEDS[p.speed];
      p.a.play().catch(() => { p.icon.textContent = "▶"; toast("Tap play again to start"); });
    } else p.a.pause();
  }

  /* ================= wiring ================= */
  function inject() {
    const f = $("chForm");
    if (f && !f.querySelector(".vmmic")) {
      const send = f.querySelector("button[type=submit]");
      send.insertAdjacentHTML("beforebegin", '<button type="button" class="vmmic" aria-label="Record voice message">🎤</button>');
      f.insertAdjacentHTML("beforeend",
        '<div class="vmbar"><span class="vmdot"></span><span class="vmtime">0:00</span>' +
        '<button type="button" class="vmcancel" aria-label="Cancel recording">🗑</button>' +
        '<button type="button" class="vmsend" aria-label="Send voice message">➤</button></div>');
    }
    // chat switched or closed while recording -> drop the recording
    if (rec && (!recForm || !document.contains(recForm) || !slc.conv() || slc.conv().id !== recConv)) stop(false);
    document.querySelectorAll(".chb[data-audio]:not([data-vm])").forEach(build);
  }
  new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
  inject();

  document.addEventListener("click", e => {
    const t = e.target, form = t.closest && t.closest("#chForm");
    if (t.closest(".vmmic")) return start(form);
    if (t.closest(".vmcancel")) return stop(false);
    if (t.closest(".vmsend")) return stop(true);
    const el = t.closest(".vmp"); if (!el || !el._vm) return;
    const p = el._vm;
    if (t.closest(".vmplay")) return toggle(p);
    if (t.closest(".vmspeed")) {
      p.speed = (p.speed + 1) % SPEEDS.length;
      t.closest(".vmspeed").textContent = SPEEDS[p.speed] + "×";
      if (p.a) p.a.playbackRate = SPEEDS[p.speed];
      return;
    }
    const tr = t.closest(".vmtrack");
    if (tr && p.a && total(p)) {
      const r = tr.getBoundingClientRect();
      p.a.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * total(p);
    }
  });

  addEventListener("pagehide", () => { if (rec) stop(false); });
})();
