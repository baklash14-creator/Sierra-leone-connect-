/* SL Connect - tools pack: Price drop badges, Safety check, Compare posts, Book a worker.
   Load AFTER more.js. Booking uses requests.sql; price drops need price-drop.sql. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("p-market") || typeof detail !== "function" || typeof sb === "undefined" || !sb) return;
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = m => { try { toast(m); } catch (e) { alert(m); } };
  const P = () => (typeof posts !== "undefined" ? posts : []);
  const me = () => (typeof user !== "undefined" && user ? user : null);
  const digits = p => String(p || "").replace(/[^\d]/g, "");
  const priceNum = s => { const m = String(s || "").replace(/\s/g, "").match(/\d[\d,.]*/); if (!m) return null; const n = parseFloat(m[0].replace(/,/g, "")); return isFinite(n) ? n : null; };
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

  const css = document.createElement("style");
  css.textContent = `
  .tl-dlg{width:min(600px,96vw);max-height:90vh;border:1px solid var(--line);border-radius:20px;padding:0;background:var(--card);color:var(--text)}
  .tl-dlg::backdrop{background:#101828a8;backdrop-filter:blur(3px)}.tl-w{padding:16px;max-height:90vh;overflow:auto}
  .tl-h{display:flex;justify-content:space-between;align-items:center}.tl-h h2{margin:0;font-size:1.2rem}
  .tl-x{border:0;background:none;font-size:26px;color:inherit;cursor:pointer}
  .tl-b{border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:999px;padding:9px 14px;font-weight:700;cursor:pointer;font:inherit;font-weight:700}
  .tl-b.pri{background:var(--green,#1eb53a);color:#fff;border-color:transparent}
  .tl-in{width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--text);font:inherit;margin:6px 0}
  .tl-safe{border:1px solid #e6a70066;background:#e6a70018;border-radius:14px;padding:10px 12px;margin:12px 0;font-size:.9rem}
  .tl-safe summary{font-weight:800;cursor:pointer}.tl-safe ul{margin:8px 0 8px 18px;padding:0}.tl-safe li{margin:3px 0}
  .tl-pd{display:inline-block;background:#e0245e;color:#fff;border-radius:99px;font-size:.72rem;font-weight:800;padding:2px 9px;margin-left:6px;vertical-align:middle}
  .tl-old{text-decoration:line-through;color:var(--muted);font-weight:500;margin-right:6px;font-size:.9em}
  .tl-cmp{position:absolute;left:10px;top:10px;z-index:3;border:0;border-radius:99px;background:#000a;color:#fff;font-size:.72rem;font-weight:700;padding:5px 10px;cursor:pointer}
  .tl-cmp.on{background:var(--green,#1eb53a)}
  #tlBar{position:fixed;left:12px;right:12px;bottom:84px;z-index:130;display:none;align-items:center;justify-content:space-between;gap:10px;background:var(--text);color:var(--bg);border-radius:16px;padding:10px 14px;box-shadow:0 8px 24px #0005}
  #tlBar.on{display:flex}#tlBar button{border:0;border-radius:99px;padding:8px 14px;font-weight:800;cursor:pointer}
  .tl-tbl{width:100%;border-collapse:collapse;font-size:.9rem;table-layout:fixed}
  .tl-tbl th,.tl-tbl td{border-top:1px solid var(--line);padding:8px 6px;vertical-align:top;text-align:left;overflow-wrap:anywhere}
  .tl-tbl th:first-child{width:70px;color:var(--muted);font-weight:600}
  .tl-win{color:var(--green,#1eb53a);font-weight:800}
  .tl-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.tl-row>*{flex:1 1 auto;text-align:center}`;
  document.head.append(css);

  const dlg = id => { let d = $(id); if (!d) { d = document.createElement("dialog"); d.id = id; d.className = "tl-dlg"; document.body.append(d); } return d; };
  const show = (d, h) => { d.innerHTML = `<div class="tl-w">${h}</div>`; if (!d.open) d.showModal(); };

  /* ---------- price drops ---------- */
  let drops = {};
  async function loadDrops() {
    try { const r = await sb.from("posts").select("id,old_price,price_changed_at").not("old_price", "is", null).limit(500);
      if (r.error) return; drops = {}; (r.data || []).forEach(x => drops[String(x.id)] = x); } catch (e) { }
  }
  function dropOf(p) {
    const d = drops[String(p.id)]; if (!d || !d.old_price) return null;
    const o = priceNum(d.old_price), n = priceNum(p.price); if (o == null || n == null || n >= o) return null;
    if (d.price_changed_at && Date.now() - new Date(d.price_changed_at) > 14 * 864e5) return null;
    return { old: d.old_price, pct: Math.round((o - n) / o * 100) };
  }
  async function lowerPrice(id) {
    const p = P().find(x => x.id === id); if (!p) return;
    const v = prompt(`New lower price for "${p.title}" (now: ${p.price || "none"}). Example: Le 4,500`); if (v === null) return;
    const nn = priceNum(v), cur = priceNum(p.price);
    if (nn == null) return T("Enter a price with numbers, e.g. Le 4,500");
    if (cur != null && nn >= cur) return T("The new price must be lower than the current price.");
    const { error } = await sb.from("posts").update({ old_price: p.price, price: v.trim(), price_changed_at: new Date().toISOString() }).eq("id", id);
    if (error) return T(/column|schema cache/i.test(error.message) ? "Not switched on yet. Run price-drop.sql in Supabase." : error.message);
    T("Price lowered. Saved-post owners will see a Price dropped badge.");
    try { if (typeof refreshPosts === "function") await refreshPosts(); await loadDrops(); if (typeof refresh === "function") refresh(); } catch (e) { }
  }
  function nudgeSaved() {
    const u = me(); if (!u || !u.favs) return;
    const seen = get("slc_pd_seen", {}), hit = P().filter(p => u.favs.includes(p.id) && dropOf(p) && !seen[p.id]);
    if (hit.length) { hit.forEach(p => seen[p.id] = 1); put("slc_pd_seen", seen); T("🔻 " + hit.length + " saved post" + (hit.length === 1 ? "" : "s") + " got cheaper: " + hit[0].title); }
  }

  /* ---------- compare ---------- */
  let sel = [];
  const bar = document.createElement("div"); bar.id = "tlBar";
  bar.innerHTML = '<span id="tlCnt"></span><span><button data-tl="clear" style="background:transparent;color:inherit">Clear</button> <button data-tl="cmp" style="background:var(--green,#1eb53a);color:#fff">Compare</button></span>';
  document.body.append(bar);
  const paintBar = () => { bar.classList.toggle("on", sel.length > 0); $("tlCnt").textContent = sel.length + " selected" + (sel.length < 2 ? " · pick at least 2" : ""); document.querySelectorAll(".tl-cmp").forEach(b => { const on = sel.includes(b.dataset.id); b.classList.toggle("on", on); b.textContent = on ? "✓ Added" : "＋ Compare"; }); };
  function decorate() {
    document.querySelectorAll("#list .card[data-id], #myList .card[data-id]").forEach(c => {
      const id = c.dataset.id, p = P().find(x => String(x.id) === id); if (!p) return;
      if (!c.querySelector(".tl-cmp")) { if (getComputedStyle(c).position === "static") c.style.position = "relative"; c.insertAdjacentHTML("afterbegin", `<button type="button" class="tl-cmp" data-tl="tog" data-id="${E(id)}">＋ Compare</button>`); }
      const d = dropOf(p), pr = c.querySelector(".price");
      if (pr && d && !pr.querySelector(".tl-pd")) pr.innerHTML = `<span class="tl-old">${E(d.old)}</span>${pr.innerHTML}<span class="tl-pd">🔻 ${d.pct}% off</span>`;
    });
    paintBar();
  }
  let verified = new Set();
  (async () => { try { const r = await sb.from("verified_users").select("user_id").limit(5000); if (!r.error) verified = new Set((r.data || []).map(x => String(x.user_id))); } catch (e) { } })();
  function compare() {
    const L = sel.map(id => P().find(x => String(x.id) === id)).filter(Boolean); if (L.length < 2) return T("Pick at least 2 posts.");
    const nums = L.map(p => priceNum(p.price)), min = Math.min(...nums.filter(n => n != null));
    const row = (k, f) => `<tr><th>${k}</th>${L.map(f).join("")}</tr>`;
    show(dlg("tlCmp"), `<div class="tl-h"><h2>Compare</h2><button class="tl-x" data-tl="close" aria-label="Close">×</button></div>
      <table class="tl-tbl"><tr><th></th>${L.map(p => `<td><b>${E(p.title)}</b></td>`).join("")}</tr>
      ${row("Price", (p, i) => `<td class="${nums[i] != null && nums[i] === min ? "tl-win" : ""}">${E(p.price || "Ask")}${nums[i] === min && L.length > 1 ? " ✓ lowest" : ""}${dropOf(p) ? ' <span class="tl-pd">🔻</span>' : ""}</td>`)}
      ${row("Where", p => `<td>${E(p.loc)}</td>`)}
      ${row("Type", p => `<td>${E(typeof LABEL !== "undefined" ? LABEL[p.type] : p.type)}${p.cat ? " · " + E(p.cat) : ""}</td>`)}
      ${row("Photos", p => `<td>${(p.images || []).length}</td>`)}
      ${row("Poster", p => `<td>${E(p.by || "Member")}${verified.has(String(p.owner)) ? " ✔" : ""}</td>`)}
      ${row("Status", p => `<td>${p.status === "taken" ? "Closed" : "Open"}</td>`)}
      ${row("Contact", p => `<td><a href="https://wa.me/${digits(p.phone)}" target="_blank" rel="noopener">WhatsApp</a><br><a href="tel:${E(p.phone)}">Call</a></td>`)}</table>
      <div class="tl-row"><button class="tl-b" data-tl="clear2">Clear and close</button></div>`);
  }

  /* ---------- safety + booking + lower price on the detail page ---------- */
  const _d = detail;
  detail = function (id) {
    const r = _d.apply(this, arguments);
    try {
      const p = P().find(x => x.id === id), u = me(), body = document.querySelector("#ddBody .db"); if (!p || !u || !body) return r;
      const d = dropOf(p), pr = body.querySelector(".price");
      if (pr && d && !pr.querySelector(".tl-pd")) pr.innerHTML = `<span class="tl-old">${E(d.old)}</span>${pr.innerHTML}<span class="tl-pd">🔻 ${d.pct}% off</span>`;
      const acts = body.querySelector(".acts"); if (!acts) return r;
      let extra = "";
      if (p.owner === u.id && p.status !== "taken") extra += `<div class="tl-row"><button class="tl-b" data-tl="lower" data-id="${E(id)}">🔻 Lower my price</button></div>`;
      if (p.owner !== u.id && p.type === "service" && p.status !== "taken") extra += `<div class="tl-row"><button class="tl-b pri" data-tl="book" data-id="${E(id)}">📅 Book this worker</button></div>`;
      if (p.owner !== u.id) extra += `<details class="tl-safe"><summary>⚠ Stay safe before you pay</summary><ul>
        <li>Never pay before you see the item, house, land or work.</li><li>Meet in a public place in daytime and bring a friend.</li>
        <li>For land: check the documents and the owner in person.</li><li>Do not send money to someone you have not met.</li></ul>
        <button class="tl-b" data-tl="meet" data-id="${E(id)}">📲 Share my meeting with a friend</button></details>`;
      acts.insertAdjacentHTML("afterend", extra);
    } catch (e) { }
    return r;
  };
  function meeting(id) {
    const p = P().find(x => x.id === id); if (!p) return;
    const where = prompt("Where will you meet? (place or area)"); if (!where) return;
    const when = prompt("When? (day and time)"); if (!when) return;
    const text = `🛡 I am meeting someone from SL Connect.\nAbout: ${p.title}\nPerson: ${p.by || "Member"} (${p.phone || "no number"})\nWhere: ${where}\nWhen: ${when}\nPlease check on me after.`;
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
  }
  function book(id) {
    const p = P().find(x => x.id === id); if (!p) return;
    const t = new Date(), min = t.toISOString().slice(0, 10), max = new Date(t.getTime() + 60 * 864e5).toISOString().slice(0, 10);
    const dd = $("dd"); if (dd && dd.open) dd.close();
    show(dlg("tlBook"), `<div class="tl-h"><h2>📅 Book ${E(p.by || "worker")}</h2><button class="tl-x" data-tl="close" aria-label="Close">×</button></div>
      <p style="color:var(--muted)">${E(p.title)} · ${E(p.loc)}</p>
      <label>Date<input class="tl-in" type="date" id="tlDate" min="${min}" max="${max}" value="${min}"></label>
      <label>Time<select class="tl-in" id="tlTime"><option>Morning (8am-12pm)</option><option>Afternoon (12pm-4pm)</option><option>Evening (4pm-8pm)</option></select></label>
      <label>What do you need?<input class="tl-in" id="tlNote" maxlength="200" placeholder="e.g. wiring for a shop in Bo"></label>
      <div class="tl-row"><button class="tl-b pri" data-tl="sendbook" data-id="${E(id)}">Send booking</button></div>
      <p style="color:var(--muted);font-size:.85rem">The worker sees this in 📥 Requests and can accept or decline.</p>`);
  }
  async function sendBook(id) {
    const p = P().find(x => x.id === id), u = me(); if (!p || !u) return;
    const date = $("tlDate").value, time = $("tlTime").value, note = $("tlNote").value.trim();
    if (!date) return T("Pick a date.");
    const nice = new Date(date + "T12:00:00").toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
    const msg = `📅 Booking: ${nice}, ${time}.${note ? " " + note : ""}`.slice(0, 500);
    const { error } = await sb.from("post_requests").insert({ post_id: id, owner_id: p.owner, sender_id: u.id, sender_name: u.name, sender_phone: u.phone || null, message: msg });
    if (error) return T(/duplicate/i.test(error.message) ? "You already sent a request to this worker." : /relation|schema cache/i.test(error.message) ? "Not switched on yet. Run requests.sql in Supabase." : error.message);
    const d = $("tlBook"); if (d) d.close(); T("Booking sent. The worker will confirm in Requests.");
  }

  /* ---------- events ---------- */
  document.addEventListener("click", ev => {
    const el = ev.target.closest("[data-tl]"); if (!el) return;
    ev.preventDefault(); ev.stopPropagation();
    const a = el.dataset.tl, id = el.dataset.id;
    if (a === "tog") { const i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else if (sel.length >= 3) T("You can compare up to 3 posts."); else sel.push(id); paintBar(); }
    else if (a === "clear") { sel = []; paintBar(); }
    else if (a === "clear2") { sel = []; paintBar(); const d = $("tlCmp"); if (d) d.close(); }
    else if (a === "cmp") compare();
    else if (a === "close") { const d = el.closest("dialog"); if (d) d.close(); }
    else if (a === "lower") lowerPrice(id);
    else if (a === "book") book(id);
    else if (a === "sendbook") sendBook(id);
    else if (a === "meet") meeting(id);
  }, true);

  const _rm = renderMarket;
  renderMarket = function () { _rm.apply(this, arguments); try { decorate(); } catch (e) { } };
  const _ra = typeof renderAccount === "function" ? renderAccount : null;
  if (_ra) renderAccount = function () { _ra.apply(this, arguments); try { decorate(); } catch (e) { } };

  loadDrops().then(() => { try { if (me()) { renderMarket(); nudgeSaved(); } } catch (e) { } });
  if (me()) { try { renderMarket(); } catch (e) { } }
})();
