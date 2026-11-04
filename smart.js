/* SL Connect - Smart Finder.
   People write (or speak) what they need in their own words, in English or Krio, e.g.
   "I need an electrician in Bo under Le 200"  or  "os fo rent na Waterloo".
   The finder works out what they want (type, skill, area, budget), forgives spelling
   mistakes, ranks every listing, and explains WHY each one matches.
   Runs fully on the phone: nothing is sent anywhere, no AI service, no cost.
   Load AFTER app.js. No database changes needed. */
(function () {
  "use strict";

  /* =====================================================================
     1. THE ENGINE (pure functions, easy to test)
     ===================================================================== */

  // plain lowercase letters/numbers only; Krio letters ɛ and ɔ become e and o
  const norm = s => String(s == null ? "" : s)
    .toLowerCase().replace(/ɛ/g, "e").replace(/ɔ/g, "o")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();

  const STOP = new Set(("i a an the need needs needed want wants wanted looking look luk for fo find finding me my mine to in at near under below " +
    "less than around please pls plis someone somebody who can will with of and or is are any good best cheap some get have has one do na de di dem " +
    "wan am im it that this there here on from by up out le leones leone nle sll around about like also just now today urgently urgent quick quickly " +
    "available kam come give show tell help hel mek make sale sell selling buy buying purchase").split(" "));

  const GENERIC_WORKER = new Set("worker workers weka wekas handyman artisan artisans person people professional someone service services".split(" "));

  // skills the finder understands (English + Krio words)
  const GROUPS = [
    { id: "electric", label: "Electrician", icon: "💡", words: "electrician electric electrical electricity wiring wire wires light lights lait current power solar socket sockets generator bulb inverter cctv" },
    { id: "plumb", label: "Plumber", icon: "🚰", words: "plumber plumbing pipe pipes water wata tap taps leak leaking toilet borehole drain drainage tank" },
    { id: "tailor", label: "Tailor", icon: "🧵", words: "tailor tailoring sew sewing seamstress clothes klos cloth dress dresses fashion gown outfit outfits designer lappa" },
    { id: "driver", label: "Driver", icon: "🚗", words: "driver driving drive car cars kar taxi transport truck bus licence license chauffeur okada keke" },
    { id: "build", label: "Builder", icon: "🧱", words: "builder building build mason bricklayer cement construction construct carpenter carpentry wood roof roofing painter painting paint tiles tiler welder welding block blocks plaster" },
    { id: "clean", label: "Cleaner", icon: "🧹", words: "cleaner cleaning clean laundry wash washing housekeeper housekeeping maid nanny babysitter" },
    { id: "beauty", label: "Hair & beauty", icon: "💇", words: "barber barbing hair hairdresser salon braids braiding makeup beauty nails" },
    { id: "mech", label: "Mechanic", icon: "🔧", words: "mechanic mechanics repair repairs fix fixing engine vehicle motorbike bike spare spares garage" },
    { id: "food", label: "Cook & catering", icon: "🍲", words: "cook cooking chef catering caterer cake cakes baker bakery food restaurant" },
    { id: "teach", label: "Teacher", icon: "📚", words: "teacher tutor tutoring lesson lessons teach teaching maths math school coaching" },
    { id: "guard", label: "Security guard", icon: "💂", words: "guard security watchman gateman night" },
    { id: "tech", label: "Phone & computer", icon: "💻", words: "phone phones computer laptop laptops software website developer it tech printer screen" },
    { id: "farm", label: "Farming", icon: "🌾", words: "farmer farming farm garden gardener gardening rice cassava poultry" }
  ].map(g => ({ ...g, list: g.words.split(" ") }));

  const KNOWN_PLACES = ("freetown bo kenema makeni koidu lunsar port loko waterloo lumley hill station aberdeen goderich wilberforce kissy congo town regent " +
    "murray town tower hill calaba town kroo bay lakka juba cline town brookfields wellington newton grafton hastings bonthe kabala magburaka kambia pujehun moyamba kailahun segbwema").split(" ");

  const RENT_WORDS = new Set("rent rental rentals renting apartment apartments bedroom bedrooms flat flats room rooms lodge lodging accommodation os".split(" "));
  const HOUSE_WORDS = new Set("house houses home homes".split(" "));
  const LAND_WORDS = new Set("land lands plot plots acre acres".split(" "));
  const JOB_WORDS = new Set("job jobs work wok vacancy vacancies employment".split(" "));
  const NEED_WORDS = new Set("need needs want wants hire find looking luk fix fixing repair repairs repairing get".split(" "));
  const FIX_WORDS = new Set("fix fixing repair repairs repairing".split(" "));

  const TYPE_NAME = { service: "Workers & services", job: "Jobs wanted", rent: "Houses for rent", land: "Land for sale" };

  const stem = w => (w.length > 5 ? w.replace(/(ing|ers|er|ian|ist|s)$/, "") : w);

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  // do two words mean the same thing? (same word, same stem, shared start, or a small typo)
  function same(a, b) {
    if (a === b) return true;
    if (a.length < 3 || b.length < 3) return false;
    if (stem(a) === stem(b)) return true;
    const m = Math.min(a.length, b.length);
    if (m >= 5 && (a.startsWith(b) || b.startsWith(a))) return true;
    if (m >= 5 && a[0] === b[0]) return lev(a, b, m >= 8 ? 2 : 1) <= (m >= 8 ? 2 : 1);
    return false;
  }

  const inGroup = (g, w) => g.list.some(x => same(w, x));

  // "Le 150 per day" -> 150 ; "Le 3,000" -> 3000 ; "2k" -> 2000
  function money(str) {
    const m = String(str || "").toLowerCase().match(/(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million)?/);
    if (!m) return null;
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (isNaN(n)) return null;
    if (m[2] === "k" || m[2] === "thousand") n *= 1000;
    if (m[2] === "m" || m[2] === "million") n *= 1e6;
    return n;
  }

  // read the person's sentence and work out what they want
  function parse(text, posts) {
    const raw = String(text || "").toLowerCase();

    // budget: "under Le 200", "max 5k", "within 3,000"
    let budget = null;
    const bm = raw.match(/(?:under|below|less than|max(?:imum)?|within|up ?to|not more than|budget(?: of| is)?|<=?)\s*(?:le|nle|sll|leones?)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million)?/);
    let rest = raw;
    if (bm) { budget = money(bm[1] + (bm[2] || "")); rest = raw.replace(bm[0], " "); }

    const n = " " + norm(rest) + " ";

    // places: known towns + every area used in the listings
    const places = new Set(KNOWN_PLACES);
    (posts || []).forEach(p => { const l = norm(p.loc); if (l) { places.add(l); l.split(" ").forEach(w => { if (w.length >= 4) places.add(w); }); } });
    const locs = [];
    let rem = n;
    [...places].sort((a, b) => b.length - a.length).forEach(pl => {
      if (pl && rem.includes(" " + pl + " ")) { locs.push(pl); rem = rem.replace(" " + pl + " ", " "); }
    });

    const words = rem.split(" ").filter(Boolean);
    const groups = [];
    const loose = [];
    let generic = false, rent = false, house = false, land = false, job = false, need = false, fixer = false;

    words.forEach(w => {
      if (LAND_WORDS.has(w)) { land = true; return; }
      if (RENT_WORDS.has(w)) { rent = true; return; }
      if (HOUSE_WORDS.has(w)) { house = true; return; }
      if (JOB_WORDS.has(w)) { job = true; return; }
      if (NEED_WORDS.has(w)) need = true;
      if (FIX_WORDS.has(w)) { fixer = true; return; }
      if (GENERIC_WORKER.has(w)) { generic = true; return; }
      if (STOP.has(w)) return;
      const g = GROUPS.find(x => inGroup(x, w));
      if (g) { if (!groups.includes(g)) groups.push(g); return; }
      if (/^\d+$/.test(w) && w.length < 3) { loose.push(w); return; }   // e.g. "3 bedroom"
      if (w.length >= 3) loose.push(w);
    });

    if (fixer && !groups.length) groups.push(GROUPS.find(g => g.id === "mech"));

    // "house painter" means a builder, not a house to rent
    if (house && !groups.some(g => g.id === "build") && !groups.length) rent = true;
    if (house && groups.length) house = false;

    let type = null;
    if (land) type = "land";
    else if (rent) type = "rent";
    else if (job) type = "job";
    else if (generic || (need && groups.length)) type = "service";

    return { text: String(text || ""), type, groups, loose, locs, budget, empty: !words.length && !budget };
  }

  // score one listing against what the person wants
  function scoreOne(p, it) {
    // wrong kind of listing (e.g. a job post for someone who needs a worker): never show it
    if (it.type && p.type !== it.type) return null;
    const title = norm(p.title + " " + (p.cat || "")).split(" ").filter(Boolean);
    const desc = norm(p.desc).split(" ").filter(Boolean);
    const loc = " " + norm(p.loc) + " ";
    let s = 0, hits = 0, max = 0, locHit = false;
    const skillAsked = it.groups.length > 0 || it.loose.length > 0;
    const why = [];

    it.groups.forEach(g => {
      max += 5;
      if (title.some(w => inGroup(g, w))) { s += 5; hits++; why.push(g.icon + " " + g.label); }
      else if (desc.some(w => inGroup(g, w))) { s += 2.5; hits++; why.push(g.icon + " mentions " + g.label.toLowerCase()); }
    });

    it.loose.forEach(w => {
      max += 3;
      if (title.some(x => same(w, x))) { s += 3; hits++; why.push("“" + w + "”"); }
      else if (desc.some(x => same(w, x))) { s += 1.5; hits++; why.push("“" + w + "” in details"); }
    });

    if (it.locs.length) {
      max += 4;
      if (it.locs.some(l => loc.includes(" " + l + " ") || loc.includes(l))) {
        s += 4; locHit = true; if (!skillAsked) hits++;       // the area alone is not a reason to match a skill
        why.push("📍 " + String(p.loc).trim());
      } else s -= 1;
    }

    if (it.type) {
      max += 3; s += 3; why.push("✔ " + TYPE_NAME[p.type]);
    }

    if (it.budget != null) {
      const pr = money(p.price);
      if (pr != null) {
        max += 1.5;
        if (pr <= it.budget) { s += 1.5; why.push("💰 within budget"); }
        else if (pr > it.budget * 1.5) s -= 2;
      }
    }

    const taken = p.status === "taken";
    if (taken) s -= 6;
    if (p.images && p.images.length) s += 0.4;

    // a listing must really match something the person asked for
    const onlyType = !skillAsked && !!it.type;
    if (!hits && !onlyType) return null;
    if (s < 1 && !taken) return null;

    const pct = Math.max(1, Math.min(99, Math.round(100 * Math.max(s, 0) / (max || 1))));
    if (pct < 20 && !onlyType) return null;
    return { p, score: s, pct, why, taken, locHit };
  }

  function rank(posts, it) {
    const out = (posts || []).map(p => scoreOne(p, it)).filter(Boolean);
    // they named an area, but nothing is there: still show the closest matches, and say so
    const relaxed = it.locs.length > 0 && out.length > 0 && !out.some(r => r.locHit && !r.taken);
    out.sort((a, b) => b.score - a.score || String(b.p.at || "").localeCompare(String(a.p.at || "")));
    const open = out.filter(r => !r.taken);
    const list = open.length ? open : out;   // show taken ones only if nothing is available
    return { results: list.slice(0, 8), relaxed, total: out.length };
  }

  // a short sentence showing how the finder understood the request
  function explain(it) {
    const b = [];
    if (it.type) b.push(TYPE_NAME[it.type]);
    it.groups.forEach(g => b.push(g.icon + " " + g.label));
    it.loose.forEach(w => b.push("“" + w + "”"));
    it.locs.forEach(l => b.push("📍 " + l.replace(/\b\w/g, c => c.toUpperCase())));
    if (it.budget != null) b.push("💰 up to Le " + it.budget.toLocaleString("en-US"));
    return b;
  }

  if (typeof document === "undefined") {          // used by the tests
    if (typeof module !== "undefined") module.exports = { norm, parse, rank, explain, money, same };
    return;
  }

  /* =====================================================================
     2. THE SCREEN
     ===================================================================== */
  const head = document.querySelector("#p-market .pagehead");
  if (!head) return;

  const E = typeof esc === "function" ? esc : s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const st = document.createElement("style");
  st.textContent = `
.smart{margin:14px 0;padding:16px;border-radius:18px;border:1px solid var(--line);background:linear-gradient(135deg,rgba(30,181,58,.10),rgba(0,114,198,.10));box-shadow:var(--shadow)}
.smhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.smhead b{font-size:1.1rem}
.smhead small{color:var(--muted)}
.smform{display:flex!important;gap:8px;padding:0!important;margin-top:10px;align-items:center}
.smform input{flex:1 1 0;min-width:0;padding:12px 14px;border-radius:12px;font-size:16px}
.smform button{flex:none;min-height:44px}
.smmic{width:44px;padding:0!important;border-radius:50%!important;background:var(--card);border:1px solid var(--line);font-size:1.1rem}
.smmic.on{background:#e0245e;color:#fff;animation:smPulse 1s infinite}
.smchips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.smchips button{padding:6px 12px;font-size:.82rem;border-radius:999px;background:var(--card);border:1px solid var(--line);color:var(--text);font-weight:500}
.smread{margin-top:14px;font-size:.9rem;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.smread span{padding:3px 10px;border-radius:999px;background:var(--card);border:1px solid var(--line);font-weight:600;font-size:.82rem}
.smnote{margin-top:10px;padding:8px 12px;border-radius:10px;background:rgba(245,166,35,.18);font-size:.88rem}
.smlist{display:grid;gap:10px;margin-top:12px}
.smc{display:flex;gap:12px;align-items:center;padding:12px;border-radius:14px;background:var(--card);border:1px solid var(--line);animation:up .4s ease both}
.smc.taken{opacity:.6}
.smring{--p:0;flex:none;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#1eb53a calc(var(--p)*1%),var(--line) 0)}
.smring span{width:42px;height:42px;border-radius:50%;background:var(--card);display:grid;place-items:center;font-size:.78rem;font-weight:800}
.smmid{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.smmid b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.smmid small{color:var(--muted)}
.smwhy{display:flex;gap:4px;flex-wrap:wrap;margin-top:3px}
.smwhy i{font-style:normal;font-size:.72rem;padding:2px 8px;border-radius:999px;background:rgba(30,181,58,.15);color:#138a2b;font-weight:600}
.smacts{display:flex;flex-direction:column;gap:6px;flex:none}
.smacts .btn,.smacts button{padding:7px 12px;font-size:.82rem;text-align:center}
.smempty{margin-top:12px;padding:14px;border-radius:14px;background:var(--card);border:1px dashed var(--line);text-align:center}
.smempty p{margin:0 0 10px;color:var(--muted)}
@keyframes smPulse{50%{box-shadow:0 0 0 6px rgba(224,36,94,.25)}}
@media (max-width:520px){.smc{flex-wrap:wrap}.smacts{flex-direction:row;width:100%}.smacts>*{flex:1}}`;
  document.head.appendChild(st);

  const box = document.createElement("section");
  box.className = "smart";
  box.innerHTML = `
    <div class="smhead">✨ <b>Smart Finder</b><small>Tell us what you need, in your own words</small></div>
    <form class="smform" id="smForm" autocomplete="off">
      <input id="smIn" type="text" maxlength="200" placeholder='e.g. "I need an electrician in Bo under Le 200"'>
      <button type="button" class="smmic" id="smMic" aria-label="Speak your request" hidden>🎤</button>
      <button type="submit" class="primary">Find</button>
    </form>
    <div class="smchips">
      <button type="button" data-sm="Electrician in Freetown">💡 Electrician in Freetown</button>
      <button type="button" data-sm="House for rent under Le 7000">🏠 House under Le 7,000</button>
      <button type="button" data-sm="I need a driver">🚗 I need a driver</button>
      <button type="button" data-sm="Land for sale in Waterloo">🌍 Land in Waterloo</button>
      <button type="button" data-sm="I want a tailor job">🧵 Tailor job</button>
    </div>
    <div id="smOut" aria-live="polite"></div>`;
  head.insertAdjacentElement("afterend", box);

  const $in = box.querySelector("#smIn"), $out = box.querySelector("#smOut");

  async function run(text) {
    text = String(text || "").trim();
    if (!text) { $in.focus(); return; }
    $out.innerHTML = '<div class="smread">🔎 Looking through the listings…</div>';

    try {
      if (!posts.length && typeof CLOUD !== "undefined" && CLOUD && typeof refreshPosts === "function") await refreshPosts();
    } catch (e) { /* use what we have */ }

    const it = parse(text, posts);
    if (it.empty) { $out.innerHTML = '<div class="smempty"><p>Tell me a skill, a place or a type, for example “plumber in Bo”.</p></div>'; return; }

    const { results, relaxed } = rank(posts, it);
    const read = explain(it);
    let html = read.length ? `<div class="smread">🧠 I understood:${read.map(x => `<span>${E(x)}</span>`).join("")}</div>` : "";

    if (!results.length) {
      html += `<div class="smempty"><p>Nothing matches yet. New listings arrive every day.</p>
        <button type="button" class="primary" data-smpost>➕ Post what you need</button></div>`;
    } else {
      if (relaxed) html += `<div class="smnote">Nothing in ${E(it.locs.map(l => l.replace(/\b\w/g, c => c.toUpperCase())).join(", "))} yet. Here are the closest matches in other areas.</div>`;
      html += '<div class="smlist">' + results.map(r => {
        const p = r.p, num = norm(p.phone) ? String(p.phone).replace(/[^\d+]/g, "") : "";
        return `<article class="smc ${r.taken ? "taken" : ""}">
          <div class="smring" style="--p:${r.pct}"><span>${r.pct}%</span></div>
          <div class="smmid"><b>${E(p.title)}</b>
            <small>${E(LABEL[p.type] || "")}${p.cat ? " · " + E(p.cat) : ""}${r.taken ? " · " + E(TAKEN[p.type] || "taken") : ""}</small>
            <small>📍 ${E(p.loc)}${p.price ? " · " + E(p.price) : ""}</small>
            <div class="smwhy">${r.why.slice(0, 4).map(w => `<i>${E(w)}</i>`).join("")}</div></div>
          <div class="smacts"><button type="button" class="primary" data-smview="${E(p.id)}">View</button>
            ${num ? `<a class="btn call" href="tel:${E(num)}">Call</a>` : ""}</div></article>`;
      }).join("") + "</div>";
    }
    $out.innerHTML = html;
  }

  box.querySelector("#smForm").addEventListener("submit", e => { e.preventDefault(); run($in.value); });

  box.addEventListener("click", e => {
    let el;
    if ((el = e.target.closest("[data-sm]"))) { $in.value = el.dataset.sm; run($in.value); return; }
    if ((el = e.target.closest("[data-smview]"))) { if (typeof detail === "function") detail(el.dataset.smview); return; }
    if (e.target.closest("[data-smpost]")) { if (typeof openPost === "function") openPost(); }
  });

  /* ---------- speak your request ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = box.querySelector("#smMic");
  if (SR) {
    mic.hidden = false;
    let rec = null;
    mic.addEventListener("click", () => {
      if (rec) { try { rec.stop(); } catch (e) { } return; }
      rec = new SR();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      mic.classList.add("on");
      $in.placeholder = "Listening… speak now";
      rec.onresult = ev => { $in.value = ev.results[0][0].transcript; run($in.value); };
      rec.onerror = ev => {
        if (ev.error === "not-allowed") { try { toast("Allow the microphone to speak your request"); } catch (e) { } }
      };
      rec.onend = () => { rec = null; mic.classList.remove("on"); $in.placeholder = 'e.g. "I need an electrician in Bo under Le 200"'; };
      try { rec.start(); } catch (e) { rec = null; mic.classList.remove("on"); }
    });
  }
})();
