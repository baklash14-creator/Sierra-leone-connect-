/* SL Connect - Live pack: Available now badge, Top workers board, WhatsApp share card, QR code poster.
   Needs more-features.sql (available_until column + slc_top_workers). Load AFTER tools.js and qr.js. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("p-market") || typeof detail !== "function" || typeof sb === "undefined" || !sb || !window.SLC_QR) return;
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = m => { try { toast(m); } catch (e) { alert(m); } };
  const P = () => (typeof posts !== "undefined" ? posts : []);
  const me = () => (typeof user !== "undefined" && user ? user : null);
  const digits = p => String(p || "").replace(/[^\d]/g, "");
  const linkOf = id => location.origin + location.pathname + "?post=" + encodeURIComponent(id);
  const dlg = id => { let d = $(id); if (!d) { d = document.createElement("dialog"); d.id = id; d.className = "tl-dlg"; document.body.append(d); } return d; };
  const show = (d, h) => { d.innerHTML = `<div class="tl-w">${h}</div>`; if (!d.open) d.showModal(); };
  const hdr = t => `<div class="tl-h"><h2>${t}</h2><button class="tl-x" data-lv="close" aria-label="Close">×</button></div>`;

  const css = document.createElement("style");
  css.textContent = `
  .lv-on{display:inline-block;background:#1eb53a22;color:#0b7a22;border:1px solid #1eb53a66;border-radius:99px;font-size:.72rem;font-weight:800;padding:2px 9px;margin-left:6px;white-space:nowrap}
  .lv-chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 8px}
  .lv-chip{border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:999px;padding:8px 13px;font:inherit;font-weight:700;font-size:.85rem;cursor:pointer}
  .lv-chip.on{background:var(--green,#1eb53a);color:#fff;border-color:transparent}
  .lv-top{display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin:8px 0;cursor:pointer;background:var(--bg)}
  .lv-rk{font-size:1.4rem;min-width:34px;text-align:center;font-weight:800}
  .lv-top b{display:block}.lv-top span{color:var(--muted);font-size:.82rem}
  .lv-st{color:#e6a700;font-weight:800}
  .lv-img{width:100%;border-radius:14px;border:1px solid var(--line);display:block}`;
  document.head.append(css);

  /* ---------- Available now ---------- */
  let avail = {}, only = false;
  const isAvail = p => { const t = avail[String(p.id)]; return !!t && new Date(t) > new Date() && p.status !== "taken"; };
  async function loadAvail() {
    try { const r = await sb.from("posts").select("id,available_until").gt("available_until", new Date().toISOString()).limit(500);
      if (r.error) return; avail = {}; (r.data || []).forEach(x => avail[String(x.id)] = x.available_until); } catch (e) { }
    paint();
  }
  function paint() {
    let shown = 0;
    document.querySelectorAll("#list .card[data-id], #myList .card[data-id]").forEach(c => {
      const p = P().find(x => String(x.id) === c.dataset.id); if (!p) return;
      const on = isAvail(p), tag = c.querySelector(".tag"), has = c.querySelector(".lv-on");
      if (tag && on && !has) tag.insertAdjacentHTML("beforeend", '<span class="lv-on">🟢 Available now</span>');
      if (tag && !on && has) has.remove();
      if (c.closest("#list")) { const hide = only && !on; c.style.display = hide ? "none" : ""; if (!hide) shown++; }
    });
    if (only && $("count")) $("count").textContent = shown + " available now";
    const ch = $("lvAvail"); if (ch) ch.classList.toggle("on", only);
  }
  const bar = document.querySelector("#p-market .bar");
  if (bar && !$("lvChips")) bar.insertAdjacentHTML("afterend", '<div class="lv-chips" id="lvChips"><button type="button" class="lv-chip" id="lvAvail">🟢 Available now</button><button type="button" class="lv-chip" data-lv="top">🏆 Top workers</button></div>');
  ["list", "myList"].forEach(id => { const el = $(id); if (el) new MutationObserver(paint).observe(el, { childList: true }); });
  setInterval(loadAvail, 300000);

  async function setAvail(id, hours) {
    const until = hours ? new Date(Date.now() + hours * 36e5).toISOString() : null;
    const { error } = await sb.from("posts").update({ available_until: until }).eq("id", id);
    if (error) return T(/column|schema cache/i.test(error.message) ? "Not switched on yet. Run more-features.sql in Supabase." : error.message);
    T(hours ? "🟢 You show as Available now for " + hours + " hours" : "Switched off");
    await loadAvail(); try { detail(id); } catch (e) { }
  }

  /* ---------- Top workers ---------- */
  let topRows = [], verified = new Set();
  function topList(q) {
    q = (q || "").toLowerCase().trim();
    const rows = topRows.filter(r => !q || [r.title, r.cat, r.loc, r.by_name].join(" ").toLowerCase().includes(q));
    const medal = i => ["🥇", "🥈", "🥉"][i] || (i + 1);
    $("lvTopL").innerHTML = rows.length ? rows.map((r, i) => `<div class="lv-top" data-lv="open" data-id="${E(r.post_id)}"><div class="lv-rk">${medal(i)}</div>
      <div><b>${E(r.by_name || "Worker")}${verified.has(String(r.owner)) ? " ✔" : ""} · ${E(r.cat || r.title)}</b>
      <span>📍 ${E(r.loc)} · <span class="lv-st">★ ${Number(r.avg_rating).toFixed(1)}</span> (${r.reviews} review${r.reviews == 1 ? "" : "s"})${Number(r.jobs_done) ? " · " + r.jobs_done + " job" + (r.jobs_done == 1 ? "" : "s") + " done" : ""}</span></div></div>`).join("")
      : '<p style="color:var(--muted)">No workers match. Reviews build this board, so leave a review after a job.</p>';
  }
  async function openTop() {
    show(dlg("lvTop"), hdr("🏆 Top workers") + '<input class="tl-in" id="lvTopQ" placeholder="Filter by skill or town, e.g. plumber, Bo"><div id="lvTopL"><p style="color:var(--muted)">Loading…</p></div>');
    const q = $("lvTopQ"); q.oninput = () => topList(q.value);
    try {
      const [r, v] = await Promise.all([sb.rpc("slc_top_workers"), sb.from("verified_users").select("user_id").limit(5000)]);
      if (r.error) { $("lvTopL").innerHTML = '<p>' + E(/function|schema cache/i.test(r.error.message) ? "Not switched on yet. Run more-features.sql in Supabase." : r.error.message) + "</p>"; return; }
      topRows = r.data || []; verified = new Set(((v && v.data) || []).map(x => String(x.user_id))); topList("");
    } catch (e) { $("lvTopL").innerHTML = "<p>Could not load. Check your internet.</p>"; }
  }

  /* ---------- canvas helpers ---------- */
  function wrap(c, text, x, y, w, lh, max) {
    const words = String(text).split(/\s+/); let line = "", n = 0;
    for (let i = 0; i < words.length; i++) {
      const t = line ? line + " " + words[i] : words[i];
      if (c.measureText(t).width > w && line) { if (++n >= max) { c.fillText(line.replace(/.{1}$/, "…"), x, y); return y + lh; } c.fillText(line, x, y); y += lh; line = words[i]; } else line = t;
    }
    c.fillText(line, x, y); return y + lh;
  }
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  function flag(c, w) { c.fillStyle = "#1eb53a"; c.fillRect(0, 0, w, 14); c.fillStyle = "#fff"; c.fillRect(0, 14, w, 14); c.fillStyle = "#0072c6"; c.fillRect(0, 28, w, 14); }
  function qrInto(c, text, x, y, size) {
    const q = window.SLC_QR.make(text), n = q.size + 2, px = size / n;
    c.fillStyle = "#fff"; c.fillRect(x, y, size, size); c.fillStyle = "#000";
    for (let j = 0; j < q.size; j++) for (let i = 0; i < q.size; i++) if (q.dark(i, j)) c.fillRect(x + (i + 1) * px, y + (j + 1) * px, Math.ceil(px), Math.ceil(px));
  }
  const FONT = "system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
  function imgDialog(id, title, cv, name, text) {
    const url = cv.toDataURL("image/png");
    show(dlg(id), hdr(title) + `<img class="lv-img" src="${url}" alt="${E(title)}"><div class="tl-row"><button class="tl-b pri" data-lv="send">📤 Share</button><button class="tl-b" data-lv="save">⬇ Save picture</button></div>`);
    const d = dlg(id); d._cv = cv; d._name = name; d._text = text;
  }
  async function sendOrSave(d, save) {
    const cv = d._cv; if (!cv) return;
    const blob = await new Promise(r => cv.toBlob(r, "image/png")); if (!blob) return T("Could not make the picture");
    const file = new File([blob], d._name, { type: "image/png" });
    if (!save && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: d._text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = d._name; document.body.append(a); a.click(); a.remove();
    T(save ? "Saved" : "Sharing is not supported here, so I saved the picture. Send it from your gallery.");
  }

  /* ---------- WhatsApp share card ---------- */
  function shareCard(id) {
    const p = P().find(x => String(x.id) === String(id)); if (!p) return;
    const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350; const c = cv.getContext("2d");
    const g = c.createLinearGradient(0, 0, 0, 1350); g.addColorStop(0, "#0a5a22"); g.addColorStop(1, "#1eb53a"); c.fillStyle = g; c.fillRect(0, 0, 1080, 1350);
    flag(c, 1080);
    c.fillStyle = "#fff"; c.font = `800 54px ${FONT}`; c.fillText("SL Connect", 70, 135);
    c.font = `500 30px ${FONT}`; c.fillStyle = "#d8f5de"; c.fillText("Jobs · Workers · Houses · Land in Sierra Leone", 70, 180);
    rr(c, 50, 225, 980, 1000, 36); c.fillStyle = "#fff"; c.fill();
    const L = (typeof LABEL !== "undefined" && LABEL[p.type]) || p.type;
    c.font = `800 34px ${FONT}`; const tw = c.measureText(L).width + 50; rr(c, 90, 265, tw, 62, 31); c.fillStyle = "#e8f8ec"; c.fill(); c.fillStyle = "#0a7a22"; c.fillText(L, 115, 308);
    if (isAvail(p)) { const a = "Available now"; c.font = `800 30px ${FONT}`; const aw = c.measureText(a).width + 50; rr(c, 90 + tw + 16, 265, aw, 62, 31); c.fillStyle = "#1eb53a"; c.fill(); c.fillStyle = "#fff"; c.fillText(a, 90 + tw + 41, 306); }
    c.fillStyle = "#101828"; c.font = `800 78px ${FONT}`; let y = wrap(c, p.title, 90, 430, 900, 92, 3);
    c.font = `500 44px ${FONT}`; c.fillStyle = "#475467"; y = wrap(c, "📍 " + p.loc, 90, y + 10, 900, 56, 2);
    if (p.price) { c.font = `800 62px ${FONT}`; c.fillStyle = "#0a7a22"; y = wrap(c, p.price.match(/le|sll|\$/i) ? p.price : "Le " + p.price, 90, y + 24, 900, 74, 2); }
    if (p.cat) { c.font = `600 38px ${FONT}`; c.fillStyle = "#667085"; c.fillText(p.cat, 90, y + 20); }
    rr(c, 90, 920, 560, 250, 28); c.fillStyle = "#f2f4f7"; c.fill();
    c.fillStyle = "#475467"; c.font = `600 32px ${FONT}`; c.fillText("Call or WhatsApp", 120, 975);
    c.fillStyle = "#101828"; c.font = `800 46px ${FONT}`; c.fillText(p.phone || "", 120, 1040);
    c.fillStyle = "#667085"; c.font = `600 30px ${FONT}`; c.fillText("Scan to see the full post", 120, 1100); c.fillText("sl-connect.vercel.app", 120, 1145);
    qrInto(c, linkOf(p.id), 690, 920, 290);
    c.fillStyle = "#d8f5de"; c.font = `600 30px ${FONT}`; c.textAlign = "center"; c.fillText("Stay safe: never pay before you see the item, house or work.", 540, 1290); c.textAlign = "left";
    imgDialog("lvCard", "🖼 Share card", cv, "sl-connect-" + String(p.id).slice(0, 8) + ".png", `${p.title} – ${p.loc}${p.price ? " – " + p.price : ""}\nSee it on SL Connect: ${linkOf(p.id)}`);
  }

  /* ---------- QR poster ---------- */
  function qrPoster(id) {
    const p = P().find(x => String(x.id) === String(id)); if (!p) return;
    const cv = document.createElement("canvas"); cv.width = 900; cv.height = 1200; const c = cv.getContext("2d");
    c.fillStyle = "#fff"; c.fillRect(0, 0, 900, 1200); flag(c, 900);
    c.fillStyle = "#0a7a22"; c.font = `800 46px ${FONT}`; c.fillText("SL Connect", 60, 120);
    c.fillStyle = "#101828"; c.font = `800 62px ${FONT}`; let y = wrap(c, p.by ? p.by + " · " + (p.cat || p.title) : p.title, 60, 215, 780, 74, 2);
    c.font = `500 36px ${FONT}`; c.fillStyle = "#475467"; wrap(c, "📍 " + p.loc, 60, y, 780, 46, 1);
    qrInto(c, linkOf(p.id), 130, 360, 640);
    c.textAlign = "center"; c.fillStyle = "#101828"; c.font = `800 46px ${FONT}`; c.fillText("Scan to see my work and hire me", 450, 1070);
    c.fillStyle = "#475467"; c.font = `600 36px ${FONT}`; c.fillText(p.phone || "", 450, 1125); c.fillText("sl-connect.vercel.app", 450, 1170); c.textAlign = "left";
    imgDialog("lvQr", "🔳 My QR code", cv, "sl-connect-qr-" + String(p.id).slice(0, 8) + ".png", `Scan to see ${p.title} on SL Connect: ${linkOf(p.id)}`);
  }

  /* ---------- detail page extras ---------- */
  const _d = detail;
  detail = function (id) {
    const r = _d.apply(this, arguments);
    try {
      const p = P().find(x => x.id === id), u = me(), body = document.querySelector("#ddBody .db"); if (!p || !u || !body || body.querySelector(".lv-x")) return r;
      const acts = body.querySelector(".acts"); if (!acts) return r;
      const mine = p.owner === u.id, on = isAvail(p);
      if (on) { const tag = body.querySelector(".tag"); if (tag && !tag.querySelector(".lv-on")) tag.insertAdjacentHTML("beforeend", '<span class="lv-on">🟢 Available now</span>'); }
      let h = `<div class="tl-row lv-x">`;
      if (mine && p.type === "service" && p.status !== "taken") h += on ? `<button class="tl-b" data-lv="off" data-id="${E(id)}">🟢 Available now · turn off</button>` : `<button class="tl-b pri" data-lv="on" data-id="${E(id)}">🟢 I'm available now (8 hours)</button>`;
      h += `<button class="tl-b" data-lv="card" data-id="${E(id)}">🖼 Share card</button>`;
      if (mine) h += `<button class="tl-b" data-lv="qr" data-id="${E(id)}">🔳 QR code</button>`;
      acts.insertAdjacentHTML("afterend", h + "</div>");
    } catch (e) { console.error("live detail", e); }
    return r;
  };

  document.addEventListener("click", ev => {
    const a = ev.target.closest("#lvAvail"); if (a) { only = !only; paint(); if (!only && typeof renderMarket === "function") renderMarket(); return; }
    const b = ev.target.closest("[data-lv]"); if (!b) return;
    const k = b.dataset.lv, id = b.dataset.id, d = b.closest("dialog");
    if (k === "close") { if (d) d.close(); return; }
    if (k === "top") { openTop(); return; }
    if (k === "open") { if (d) d.close(); try { detail(id); } catch (e) { } return; }
    if (k === "on") return setAvail(id, 8);
    if (k === "off") return setAvail(id, 0);
    if (k === "card") { const dd = $("dd"); if (dd && dd.open) dd.close(); return shareCard(id); }
    if (k === "qr") { const dd = $("dd"); if (dd && dd.open) dd.close(); return qrPoster(id); }
    if (k === "send") return sendOrSave(d, false);
    if (k === "save") return sendOrSave(d, true);
  });

  /* More-menu tile */
  const sheet = $("nvSheet");
  if (sheet) {
    new MutationObserver(() => { const g = sheet.querySelector(".nv-g"); if (!g || g.querySelector('[data-nv-act="top"]')) return;
      g.insertAdjacentHTML("afterbegin", '<button class="nv-t" data-nv-act="top"><i>🏆</i>Top workers</button>'); }).observe(sheet, { childList: true, subtree: true });
    document.addEventListener("click", ev => { const t = ev.target.closest('[data-nv-act="top"]'); if (t) { ev.preventDefault(); ev.stopPropagation(); sheet.classList.remove("on"); openTop(); } }, true);
  }
  loadAvail();
  window.SLC_LIVE = { loadAvail, openTop };
})();
