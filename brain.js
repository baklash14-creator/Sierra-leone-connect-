/* SL Connect - Smart pack: Trust score, Fair-price meter, Scam shield, Auto-match.
   These use fixed rules on the app's own data (not a live AI service). Load AFTER tools.js. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("p-market") || typeof detail !== "function" || typeof sb === "undefined" || !sb) return;
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const P = () => (typeof posts !== "undefined" ? posts : []);
  const me = () => (typeof user !== "undefined" && user ? user : null);
  const num = s => { const m = String(s || "").replace(/\s/g, "").match(/\d[\d,.]*/); if (!m) return null; const n = parseFloat(m[0].replace(/,/g, "")); return isFinite(n) && n > 0 ? n : null; };
  const money = n => "Le " + Math.round(n).toLocaleString("en-US");
  const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  const css = document.createElement("style");
  css.textContent = `
  .bn-box{margin:12px 0;display:grid;gap:8px}
  .bn-c{border:1px solid var(--line);border-radius:14px;padding:10px 12px;background:var(--card);font-size:.9rem}
  .bn-c summary{cursor:pointer;font-weight:800;list-style:none;display:flex;justify-content:space-between;gap:8px;align-items:center}
  .bn-c summary::-webkit-details-marker{display:none}
  .bn-c ul{margin:8px 0 0 18px;padding:0;color:var(--muted)}.bn-c li{margin:3px 0}
  .bn-pill{border-radius:99px;padding:2px 10px;font-size:.75rem;font-weight:800;color:#fff;white-space:nowrap}
  .bn-g{background:#1a8f2f}.bn-y{background:#c98a00}.bn-r{background:#d92d20}.bn-b{background:#0072c6}
  .bn-bar{height:7px;background:var(--line);border-radius:9px;margin:8px 0 2px;overflow:hidden}.bn-bar i{display:block;height:100%;border-radius:9px}`;
  document.head.append(css);

  /* ---------- data used by the trust score ---------- */
  let verified = new Set(), ratingBy = {}, vouchBy = {};
  async function load() {
    try { const r = await sb.from("verified_users").select("user_id,expires_at").limit(5000); if (!r.error) verified = new Set((r.data || []).filter(x => !x.expires_at || new Date(x.expires_at) > new Date()).map(x => String(x.user_id))); } catch (e) { }
    try {
      const r = await sb.from("reviews").select("post_id,rating").limit(5000);
      if (!r.error) { const own = {}; P().forEach(p => own[String(p.id)] = String(p.owner)); ratingBy = {};
        (r.data || []).forEach(x => { const o = own[String(x.post_id)]; if (!o) return; (ratingBy[o] = ratingBy[o] || []).push(x.rating); }); }
    } catch (e) { }
    try { const r = await sb.from("vouches").select("vouchee").limit(5000); if (!r.error) { vouchBy = {}; (r.data || []).forEach(x => vouchBy[String(x.vouchee)] = (vouchBy[String(x.vouchee)] || 0) + 1); } } catch (e) { }
  }

  function trust(ownerId) {
    const id = String(ownerId), mine = P().filter(p => String(p.owner) === id), rs = ratingBy[id] || [], vs = vouchBy[id] || 0;
    const parts = []; let s = 25;
    const ver = verified.has(id); if (ver) { s += 25; parts.push("✔ Verified member (+25)"); } else parts.push("Not verified yet");
    if (rs.length) { const avg = rs.reduce((a, b) => a + b, 0) / rs.length, pts = Math.round((avg / 5) * 20 * Math.min(1, rs.length / 3)); s += pts; parts.push(`★ ${avg.toFixed(1)} from ${rs.length} review${rs.length === 1 ? "" : "s"} (+${pts})`); } else parts.push("No reviews yet");
    if (vs) { const pts = Math.min(15, vs * 5); s += pts; parts.push(`${vs} neighbour vouch${vs === 1 ? "" : "es"} (+${pts})`); } else parts.push("No neighbour vouches yet");
    if (mine.length) { const pts = Math.min(5, mine.length * 2); s += pts; parts.push(`${mine.length} active post${mine.length === 1 ? "" : "s"} (+${pts})`); }
    if (mine.some(p => (p.images || []).length)) { s += 5; parts.push("Uses real photos (+5)"); }
    s = Math.max(0, Math.min(100, s));
    return { score: s, ver, parts, label: s >= 70 ? "Strong" : s >= 45 ? "Fair" : "New / unproven", cls: s >= 70 ? "bn-g" : s >= 45 ? "bn-y" : "bn-b" };
  }

  /* ---------- fair price ---------- */
  function comps(p) {
    const same = P().filter(x => x.id !== p.id && x.type === p.type && num(x.price));
    let c = (p.type === "service" || p.type === "job") && p.cat ? same.filter(x => x.cat && x.cat.toLowerCase() === p.cat.toLowerCase()) : same.filter(x => x.loc && p.loc && x.loc.toLowerCase().includes(p.loc.toLowerCase().split(",")[0].trim()));
    if (c.length < 3) c = same;
    return c.map(x => num(x.price));
  }
  function fair(p) {
    const n = num(p.price); if (!n) return null; const c = comps(p); if (c.length < 3) return null;
    const med = median(c), diff = Math.round((n - med) / med * 100);
    return { med, diff, n: c.length };
  }

  /* ---------- scam shield ---------- */
  const FLAGS = [
    [/pay\s*(first|before|upfront|in advance)|advance (fee|payment)|deposit (first|before)|send (me )?(the )?(money|fee)|processing fee/i, "Asks for money before you see anything", 3],
    [/western union|moneygram|gift ?card|bitcoin|crypto/i, "Asks for hard-to-trace payment", 3],
    [/(abroad|overseas|outside the country|in (uk|usa|dubai|canada))/i, "Owner says they are abroad", 2],
    [/urgent|last chance|today only|hurry|act now/i, "Pressure to act fast", 1],
    [/whatsapp only|no calls|do not call|don'?t call/i, "Will not take phone calls", 1],
    [/god fearing|trust me|100% (genuine|real|safe)/i, "Over-promises trust", 1]
  ];
  function scam(p) {
    const txt = [p.title, p.desc].join(" "), why = []; let pts = 0;
    FLAGS.forEach(([re, msg, w]) => { if (re.test(txt)) { why.push(msg); pts += w; } });
    const f = fair(p); if (f && f.diff <= -60) { why.push(`Price is ${Math.abs(f.diff)}% below similar posts`); pts += 3; }
    if (!num(p.phone) && !String(p.phone || "").replace(/\D/g, "")) { why.push("No phone number"); pts += 1; }
    if ((p.type === "rent" || p.type === "land") && !(p.images || []).length) { why.push("No photos for a house or land"); pts += 1; }
    const same = P().filter(x => x.phone && p.phone && String(x.phone).replace(/\D/g, "") === String(p.phone).replace(/\D/g, "") && x.owner !== p.owner);
    if (same.length) { why.push("Same phone number used by another member"); pts += 2; }
    return { pts, why, level: pts >= 4 ? "High" : pts >= 2 ? "Medium" : "Low" };
  }

  /* ---------- detail page cards ---------- */
  const _d = detail;
  detail = function (id) {
    const r = _d.apply(this, arguments);
    try {
      const p = P().find(x => x.id === id), u = me(), db = document.querySelector("#ddBody .db"); if (!p || !db || db.querySelector(".bn-box")) return r;
      const t = trust(p.owner), f = fair(p), sc = scam(p), mineP = u && p.owner === u.id;
      let h = `<div class="bn-box">`;
      h += `<details class="bn-c"><summary><span>🛡 Trust score</span><span class="bn-pill ${t.cls}">${t.score}/100 · ${t.label}</span></summary>
        <div class="bn-bar"><i class="${t.cls}" style="width:${t.score}%"></i></div><ul>${t.parts.map(x => `<li>${E(x)}</li>`).join("")}</ul></details>`;
      if (f && p.type !== "job") {
        const cls = f.diff <= -60 ? "bn-r" : f.diff < -10 ? "bn-g" : f.diff <= 15 ? "bn-b" : "bn-y";
        const msg = f.diff <= -60 ? "Much cheaper than usual. Be careful." : f.diff < -10 ? `${Math.abs(f.diff)}% below similar posts` : f.diff <= 15 ? "About the usual price" : `${f.diff}% above similar posts`;
        h += `<div class="bn-c"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>💡 Price check</b><span class="bn-pill ${cls}">${msg}</span></div><div style="color:var(--muted);margin-top:4px">Typical: ${money(f.med)} (from ${f.n} similar posts)</div></div>`;
      }
      if (!mineP && sc.level !== "Low") h += `<details class="bn-c" open><summary><span>🚨 Scam shield</span><span class="bn-pill ${sc.level === "High" ? "bn-r" : "bn-y"}">${sc.level} risk</span></summary><ul>${sc.why.map(x => `<li>${E(x)}</li>`).join("")}</ul><div style="margin-top:6px">Do not pay anything before you see it in person.</div></details>`;
      h += `</div>`;
      const acts = db.querySelector(".acts"); if (acts) acts.insertAdjacentHTML("beforebegin", h); else db.insertAdjacentHTML("beforeend", h);
    } catch (e) { }
    return r;
  };

  /* ---------- auto-match (used by the alerts centre) ---------- */
  const STOP = new Set("the and for with need want looking good new used any some near have has this that from your you are can will who wanted please sell buy rent".split(" "));
  const words = s => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w));
  function overlap(a, b) { const B = new Set(b); let n = 0; new Set(a).forEach(w => { if (B.has(w) || [...B].some(x => x.length > 4 && w.length > 4 && (x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5))))) n++; }); return n; }
  async function matches() {
    const u = me(); if (!u) return [];
    const out = [];
    try {
      const w = await sb.from("wanted_items").select("id,title,description,category,location,min_budget,max_budget,status").eq("user_id", u.id).eq("status", "open").limit(20);
      (w.data || []).forEach(it => {
        const key = words([it.title, it.category, it.description].join(" ")); if (!key.length) return;
        const hit = P().filter(p => p.status !== "taken" && p.owner !== u.id).map(p => {
          let sc = overlap(key, words([p.title, p.cat, p.desc].join(" "))); if (!sc) return null;
          if (it.location && p.loc && p.loc.toLowerCase().includes(String(it.location).toLowerCase().split(",")[0].trim())) sc += 1;
          const pr = num(p.price); if (pr && it.max_budget && pr <= Number(it.max_budget)) sc += 1;
          return { p, sc };
        }).filter(Boolean).sort((a, b) => b.sc - a.sc).slice(0, 3);
        if (hit.length) out.push({ kind: "wanted", title: it.title, posts: hit.map(x => x.p) });
      });
      const mine = P().filter(p => p.owner === u.id && p.type === "service" && p.status !== "taken");
      if (mine.length) {
        const ws = await sb.from("wanted_items").select("id,title,description,category,location,user_id,status").eq("status", "open").neq("user_id", u.id).limit(100);
        mine.forEach(p => { const key = words([p.title, p.cat].join(" ")); const hit = (ws.data || []).filter(it => overlap(key, words([it.title, it.category, it.description].join(" "))) > 0).slice(0, 3);
          if (hit.length) out.push({ kind: "skill", title: p.title, wanted: hit.map(x => x.title) }); });
      }
    } catch (e) { }
    return out;
  }

  window.SLC_BRAIN = { trust, fair, scam, matches };
  load().then(() => { try { window.dispatchEvent(new Event("slc-brain-ready")); } catch (e) { } });
})();
