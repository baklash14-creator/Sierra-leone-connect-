/* SL Connect - Emergency helpers: one red button that lists workers who are free right now.
   Uses "Available now" (live.js). Load AFTER live.js and profile.js. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("p-market") || typeof sb === "undefined" || !sb) return;
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const P = () => (typeof posts !== "undefined" ? posts : []);
  const me = () => (typeof user !== "undefined" && user ? user : null);
  const digits = p => String(p || "").replace(/[^\d]/g, "");
  const dlg = id => { let d = $(id); if (!d) { d = document.createElement("dialog"); d.id = id; d.className = "tl-dlg"; document.body.append(d); } return d; };
  const KEY = "slc_sos_town";
  const get = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
  const put = v => { try { localStorage.setItem(KEY, v); } catch (e) { } };
  const NEEDS = [["Plumber", "plumb|pipe|tap|water"], ["Electrician", "electric|wiring|light|power"], ["Driver", "driver|taxi|transport|car"], ["Mechanic", "mechanic|garage|engine|vehicle"], ["Carpenter", "carpent|wood|door|furniture"], ["Any worker", ""]];
  let need = 0, verified = new Set();

  const css = document.createElement("style");
  css.textContent = `.sos-chip{border-color:#e0245e!important;color:#e0245e!important;background:#e0245e12!important}
  .sos-top{background:#e0245e;color:#fff;border-radius:14px;padding:12px;margin:10px 0;font-size:.9rem}
  .sos-r{border:1px solid var(--line);border-radius:14px;padding:12px;margin:10px 0;background:var(--bg)}.sos-r small{color:var(--muted)}
  .sos-on{color:#0b7a22;font-weight:800}.sos-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  .sos-btns a,.sos-btns button{flex:1 1 auto;text-align:center;text-decoration:none;color:inherit}`;
  document.head.append(css);

  function render() {
    const town = ($("sosTown") ? $("sosTown").value : get()).trim().toLowerCase(), key = NEEDS[need][1], re = key ? new RegExp(key, "i") : null;
    const live = window.SLC_LIVE && window.SLC_LIVE.isAvail ? window.SLC_LIVE.isAvail : () => false;
    const badges = window.SLC_PROFILE ? window.SLC_PROFILE.badges() : {};
    const me0 = me();
    const rows = P().filter(p => p.type === "service" && p.status !== "taken" && (!me0 || p.owner !== me0.id) && (!re || re.test([p.title, p.cat, p.desc].join(" "))))
      .map(p => ({ p, on: live(p), near: !!town && String(p.loc).toLowerCase().includes(town), ver: verified.has(String(p.owner)), bd: !!(badges[String(p.owner)] || []).length }))
      .map(r => (r.s = (r.on ? 100 : 0) + (r.near ? 50 : 0) + (r.ver ? 20 : 0) + (r.bd ? 10 : 0), r)).sort((a, b) => b.s - a.s).slice(0, 8);
    const nOn = rows.filter(r => r.on).length;
    $("sosList").innerHTML = (nOn ? `<div class="sos-top">🟢 ${nOn} helper${nOn === 1 ? "" : "s"} marked free right now. Call the first one.</div>` : `<div class="sos-top" style="background:#e6a700">Nobody has marked Available now yet. These are the closest matches. Call a few.</div>`) +
      (rows.length ? rows.map(({ p, on, near, ver, bd }) => `<div class="sos-r"><b>${E(p.by || "Worker")}${ver ? " ✔" : ""} · ${E(p.cat || p.title)}</b>
        <div><small>📍 ${E(p.loc)}${near ? " (your town)" : ""}${p.price ? " · " + E(p.price) : ""}</small></div>
        <div>${on ? '<span class="sos-on">🟢 Available now</span>' : ""}${bd ? ' <span class="sos-on" style="color:#0a58a0">🎓 Skill tested</span>' : ""}</div>
        <div class="sos-btns"><a class="tl-b pri" href="tel:${E(p.phone)}">📞 Call</a><a class="tl-b" href="https://wa.me/${digits(p.phone)}" target="_blank" rel="noopener">WhatsApp</a><button class="tl-b" data-sos="open" data-id="${E(p.id)}">Details</button></div></div>`).join("")
        : '<p style="color:var(--muted)">No workers found for this. Try “Any worker” or another town.</p>');
  }
  async function open() {
    if (!me()) { try { toast("Please sign in first"); openAuth("in"); } catch (e) { } return; }
    const d = dlg("sosDlg");
    d.innerHTML = `<div class="tl-w"><div class="tl-h"><h2>🚨 Emergency helpers</h2><button class="tl-x" data-sos="close" aria-label="Close">×</button></div>
      <p style="color:var(--muted);margin:4px 0">What do you need right now?</p>
      <div class="pr-sk" id="sosNeeds">${NEEDS.map((n, i) => `<button class="tl-b ${i === need ? "pri" : ""}" data-sos="need" data-i="${i}">${n[0]}</button>`).join("")}</div>
      <input class="tl-in" id="sosTown" maxlength="40" placeholder="Your town, e.g. Bo (helps me show the closest)" value="${E(get())}">
      <div id="sosList"></div><p style="color:var(--muted);font-size:.8rem">For fire, medical or crime emergencies, call the official emergency services first. Stay safe and never pay before the work is done.</p></div>`;
    if (!d.open) d.showModal();
    $("sosTown").oninput = () => { put($("sosTown").value.trim()); render(); };
    render();
    try { const r = await sb.from("verified_users").select("user_id").limit(5000); if (!r.error) { verified = new Set((r.data || []).map(x => String(x.user_id))); render(); } } catch (e) { }
    try { if (window.SLC_LIVE) await window.SLC_LIVE.loadAvail(); render(); } catch (e) { }
  }
  document.addEventListener("click", ev => {
    const b = ev.target.closest("[data-sos]"); if (!b) return;
    const k = b.dataset.sos;
    if (k === "close") return b.closest("dialog").close();
    if (k === "need") { need = +b.dataset.i; document.querySelectorAll("#sosNeeds button").forEach((x, i) => x.classList.toggle("pri", i === need)); return render(); }
    if (k === "open") { $("sosDlg").close(); try { detail(b.dataset.id); } catch (e) { } return; }
    if (k === "go") return open();
  });
  const chips = $("lvChips");
  if (chips && !chips.querySelector(".sos-chip")) chips.insertAdjacentHTML("afterbegin", '<button type="button" class="lv-chip sos-chip" data-sos="go">🚨 Emergency</button>');
  const sheet = $("nvSheet");
  if (sheet) {
    new MutationObserver(() => { const g = sheet.querySelector(".nv-g"); if (!g || g.querySelector('[data-nv-act="sos"]')) return;
      g.insertAdjacentHTML("afterbegin", '<button class="nv-t" data-nv-act="sos"><i>🚨</i>Emergency</button>'); }).observe(sheet, { childList: true, subtree: true });
    document.addEventListener("click", ev => { const t = ev.target.closest('[data-nv-act="sos"]'); if (t) { ev.preventDefault(); ev.stopPropagation(); sheet.classList.remove("on"); open(); } }, true);
  }
  window.SLC_SOS = { open };
})();
