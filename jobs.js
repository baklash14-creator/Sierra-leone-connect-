/* SL Connect - Job tracker (booked > started > done > paid) and Saved searches with new-match alerts.
   Needs more-features.sql. Load AFTER live.js. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("p-market") || typeof sb === "undefined" || !sb) return;
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = m => { try { toast(m); } catch (e) { alert(m); } };
  const P = () => (typeof posts !== "undefined" ? posts : []);
  const me = () => (typeof user !== "undefined" && user ? user : null);
  const need = () => { if (me()) return true; T("Please sign in first"); try { openAuth("in"); } catch (e) { } return false; };
  const dlg = id => { let d = $(id); if (!d) { d = document.createElement("dialog"); d.id = id; d.className = "tl-dlg"; document.body.append(d); } return d; };
  const show = (d, h) => { d.innerHTML = `<div class="tl-w">${h}</div>`; if (!d.open) d.showModal(); };
  const hdr = t => `<div class="tl-h"><h2>${t}</h2><button class="tl-x" data-jb="close" aria-label="Close">×</button></div>`;
  const notReady = m => /relation|schema cache|does not exist|function/i.test(m || "") ? "Not switched on yet. Run more-features.sql in Supabase." : m;

  const css = document.createElement("style");
  css.textContent = `
  .jb-c{border:1px solid var(--line);border-radius:14px;padding:12px;margin:10px 0;background:var(--bg)}
  .jb-c b{display:block;font-size:1rem}.jb-c small{color:var(--muted)}
  .jb-steps{display:flex;gap:4px;margin:10px 0 8px}
  .jb-steps i{flex:1;height:6px;border-radius:9px;background:var(--line)}.jb-steps i.on{background:var(--green,#1eb53a)}
  .jb-lab{display:flex;justify-content:space-between;font-size:.72rem;color:var(--muted);margin-bottom:8px}
  .jb-dot{background:#e0245e;color:#fff;border-radius:99px;font-size:.65rem;font-weight:800;padding:1px 6px;margin-left:4px}
  .jb-new{background:#1eb53a;color:#fff;border-radius:99px;font-size:.72rem;font-weight:800;padding:2px 9px;margin-left:6px}`;
  document.head.append(css);

  /* ================= Job tracker ================= */
  const STEPS = ["booked", "started", "done", "paid"], NAMES = ["Booked", "Started", "Done", "Paid"];
  let jobs = [];
  const mineAct = j => { const u = me(); if (!u) return null;
    if (u.id === j.worker_id) return j.status === "booked" ? ["started", "▶ Start the job"] : j.status === "started" ? ["done", "✅ Mark as done"] : null;
    if (u.id === j.client_id) return j.status === "done" ? ["paid", "💵 Confirm I paid"] : null; return null; };
  const waiting = j => { const u = me(), w = u && u.id === j.worker_id;
    if (j.status === "paid") return w ? "Paid. Great work!" : "Paid. Thank you!";
    if (w) return j.status === "done" ? "Waiting for the client to confirm payment" : "";
    return j.status === "booked" ? "Waiting for the worker to start" : j.status === "started" ? "Work in progress" : ""; };
  async function loadJobs() { try { const r = await sb.from("jobs").select("*").order("updated_at", { ascending: false }).limit(100); if (r.error) { jobs = null; return r.error.message; } jobs = r.data || []; } catch (e) { jobs = null; return "offline"; } paintTile(); return ""; }
  async function openJobs() {
    if (!need()) return;
    show(dlg("jbDlg"), hdr("🧰 My jobs") + '<div id="jbBody"><p style="color:var(--muted)">Loading…</p></div>');
    const err = await loadJobs(); if (err) { $("jbBody").innerHTML = `<p>${E(notReady(err))}</p>`; return; } drawJobs();
  }
  function drawJobs() {
    const u = me(), box = $("jbBody"); if (!box) return;
    const isW = P().some(p => p.owner === u.id && p.type === "service");
    box.innerHTML = `${isW ? '<button class="tl-b pri" data-jb="new">+ New job from a request</button>' : ""}` +
      (jobs.length ? jobs.map(j => { const i = STEPS.indexOf(j.status), a = mineAct(j), w = u.id === j.worker_id;
        return `<div class="jb-c"><b>${E(j.title)}</b><small>${w ? "Client: " + E(j.client_name || "Member") : "Worker: " + E(j.worker_name || "Member")} · ${new Date(j.updated_at).toLocaleDateString()}</small>
        <div class="jb-steps">${STEPS.map((s, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div><div class="jb-lab">${NAMES.map(n => `<span>${n}</span>`).join("")}</div>
        ${a ? `<button class="tl-b pri" data-jb="step" data-id="${E(j.id)}" data-to="${a[0]}">${a[1]}</button>` : `<small>${E(waiting(j))}</small>`}
        ${j.status === "paid" && !w && j.post_id ? ` <button class="tl-b" data-jb="review" data-id="${E(j.post_id)}">⭐ Review the worker</button>` : ""}</div>`; }).join("")
        : `<p style="color:var(--muted)">No jobs yet. ${isW ? "When someone books or asks you, tap “New job from a request” to track it." : "Jobs show here when a worker starts tracking your booking."}</p>`);
  }
  async function newJob() {
    const u = me(); const box = $("jbBody"); box.innerHTML = '<p style="color:var(--muted)">Loading requests…</p>';
    const r = await sb.from("post_requests").select("id,post_id,sender_id,sender_name,message,status").eq("owner_id", u.id).in("status", ["new", "accepted"]).order("created_at", { ascending: false }).limit(50);
    if (r.error) { box.innerHTML = `<p>${E(notReady(r.error.message))}</p>`; return; }
    const rows = (r.data || []).filter(x => !jobs.some(j => j.post_id === x.post_id && j.client_id === x.sender_id && j.status !== "paid"));
    if (!rows.length) { box.innerHTML = '<p style="color:var(--muted)">No open requests to track. When someone books you, it appears here.</p><button class="tl-b" data-jb="back">Back</button>'; return; }
    window.__jbReq = rows;
    box.innerHTML = `<label>Which request?<select class="tl-in" id="jbReq">${rows.map((x, i) => `<option value="${i}">${E(x.sender_name || "Member")}: ${E(String(x.message).replace(/^📅 Booking:\s*/, "").slice(0, 50))}</option>`).join("")}</select></label>
      <label>Job name<input class="tl-in" id="jbTitle" maxlength="100"></label><div class="tl-row"><button class="tl-b" data-jb="back">Back</button><button class="tl-b pri" data-jb="create">Start tracking</button></div>`;
    const fill = () => { const x = rows[+$("jbReq").value], p = P().find(q => q.id === x.post_id); $("jbTitle").value = ((p ? p.title : "Job") + " for " + (x.sender_name || "client")).slice(0, 100); };
    $("jbReq").onchange = fill; fill();
  }
  async function createJob() {
    const u = me(), x = (window.__jbReq || [])[+$("jbReq").value], title = $("jbTitle").value.trim(); if (!x) return; if (title.length < 3) return T("Give the job a name");
    const { error } = await sb.from("jobs").insert({ post_id: x.post_id, worker_id: u.id, client_id: x.sender_id, worker_name: u.name || "Worker", client_name: x.sender_name || "Client", title });
    if (error) return T(notReady(error.message));
    try { await sb.from("post_requests").update({ status: "accepted" }).eq("id", x.id); } catch (e) { }
    T("Job started. The client can follow it too."); await loadJobs(); drawJobs();
  }
  async function step(id, to) {
    const { error } = await sb.from("jobs").update({ status: to }).eq("id", id); if (error) return T(error.message.replace(/^.*exception:?\s*/i, ""));
    await loadJobs(); drawJobs(); if (to === "paid") T("Marked paid. You can now review the worker.");
  }

  /* ================= Saved searches ================= */
  let saved = [];
  const hay = p => [p.title, p.cat, p.loc, p.desc].join(" ").toLowerCase();
  const matches = s => { const u = me(), words = s.q.toLowerCase().split(/\s+/).filter(Boolean), loc = s.loc.toLowerCase(), seen = new Date(s.seen_at);
    return P().filter(p => p.owner !== (u && u.id) && p.status !== "taken" && new Date(p.at) > seen && (!s.type || p.type === s.type) && (!loc || String(p.loc).toLowerCase().includes(loc)) && words.every(w => hay(p).includes(w))); };
  async function loadSaved() { if (!me()) return; try { const r = await sb.from("saved_searches").select("*").order("created_at", { ascending: false }).limit(30); if (!r.error) saved = r.data || []; } catch (e) { } paintTile(); }
  const label = s => [s.q, s.loc, s.type ? ({ service: "Workers", job: "Jobs", rent: "Houses", land: "Land" })[s.type] : ""].filter(Boolean).join(" · ") || "Everything";
  function openSaved() {
    if (!need()) return;
    show(dlg("jbSaved"), hdr("🔖 Saved searches") + `<p style="color:var(--muted);margin:4px 0 8px">Save what you look for. I tell you when something new is posted.</p>
      <input class="tl-in" id="ssQ" maxlength="60" placeholder="Words, e.g. plumber, 2 bedroom"><input class="tl-in" id="ssLoc" maxlength="60" placeholder="Town (optional), e.g. Bo">
      <select class="tl-in" id="ssType"><option value="">Everything</option><option value="service">Workers</option><option value="job">Jobs</option><option value="rent">Houses for rent</option><option value="land">Land</option></select>
      <button class="tl-b pri" data-jb="ssAdd">Save this search</button><div id="ssList"></div>`);
    drawSaved(); loadSaved().then(drawSaved);
  }
  function drawSaved() {
    const box = $("ssList"); if (!box) return;
    box.innerHTML = saved.length ? saved.map(s => { const n = matches(s).length;
      return `<div class="jb-c"><b>${E(label(s))}${n ? `<span class="jb-new">${n} new</span>` : ""}</b>
      <div class="tl-row"><button class="tl-b pri" data-jb="ssOpen" data-id="${E(s.id)}">Open</button><button class="tl-b" data-jb="ssDel" data-id="${E(s.id)}">Delete</button></div></div>`; }).join("") : '<p style="color:var(--muted)">Nothing saved yet.</p>';
  }
  async function addSaved(q, type, loc) {
    if (!need()) return; q = (q || "").trim(); loc = (loc || "").trim();
    if (!q && !type && !loc) return T("Type a word, a town, or pick a type first");
    const { error } = await sb.from("saved_searches").insert({ user_id: me().id, q: q.slice(0, 60), type: type || "", loc: loc.slice(0, 60) });
    if (error) return T(notReady(error.message)); T("🔖 Saved. I will tell you about new matches."); await loadSaved(); drawSaved();
  }
  async function openSavedSearch(id) {
    const s = saved.find(x => x.id === id); if (!s) return;
    const d = $("jbSaved"); if (d) d.close();
    try { tab = s.type || "all"; renderTabs(); $("q").value = [s.q, s.loc].filter(Boolean).join(" "); go("market"); renderMarket(); } catch (e) { }
    try { await sb.from("saved_searches").update({ seen_at: new Date().toISOString() }).eq("id", id); s.seen_at = new Date().toISOString(); paintTile(); } catch (e) { }
  }

  /* ---- market bar: "Save this search" chip ---- */
  const chips = $("lvChips");
  if (chips && !$("jbSaveChip")) chips.insertAdjacentHTML("beforeend", '<button type="button" class="lv-chip" id="jbSaveChip">🔖 Save this search</button>');

  /* ---- More-menu tiles + badge ---- */
  const sheet = $("nvSheet");
  const newCount = () => saved.reduce((n, s) => n + (matches(s).length ? 1 : 0), 0);
  const actCount = () => (jobs || []).filter(j => mineAct(j)).length;
  function paintTile() {
    const a = document.querySelector('#nvSheet [data-nv-act="jobs"]'), b = document.querySelector('#nvSheet [data-nv-act="saved"]');
    [[a, actCount()], [b, newCount()]].forEach(([el, n]) => { if (!el) return; const old = el.querySelector(".jb-dot"); if (old) old.remove(); if (n) el.insertAdjacentHTML("beforeend", `<span class="jb-dot">${n}</span>`); });
  }
  if (sheet) {
    new MutationObserver(() => { const g = sheet.querySelector(".nv-g"); if (!g || g.querySelector('[data-nv-act="jobs"]')) return;
      g.insertAdjacentHTML("afterbegin", '<button class="nv-t" data-nv-act="jobs"><i>🧰</i>My jobs</button><button class="nv-t" data-nv-act="saved"><i>🔖</i>Saved searches</button>'); paintTile(); }).observe(sheet, { childList: true, subtree: true });
    document.addEventListener("click", ev => {
      const t = ev.target.closest('[data-nv-act="jobs"],[data-nv-act="saved"]'); if (!t) return;
      ev.preventDefault(); ev.stopPropagation(); sheet.classList.remove("on"); t.dataset.nvAct === "jobs" ? openJobs() : openSaved();
    }, true);
  }

  document.addEventListener("click", ev => {
    if (ev.target.closest("#jbSaveChip")) { let t = ""; try { t = tab === "all" ? "" : tab; } catch (e) { } addSaved($("q").value, t, ""); return; }
    const b = ev.target.closest("[data-jb]"); if (!b) return;
    const k = b.dataset.jb, id = b.dataset.id;
    if (k === "close") return b.closest("dialog").close();
    if (k === "new") return newJob();
    if (k === "back") return drawJobs();
    if (k === "create") return createJob();
    if (k === "step") return step(id, b.dataset.to);
    if (k === "review") { const d = $("jbDlg"); if (d) d.close(); try { detail(id); } catch (e) { } return; }
    if (k === "ssAdd") return addSaved($("ssQ").value, $("ssType").value, $("ssLoc").value);
    if (k === "ssOpen") return openSavedSearch(id);
    if (k === "ssDel") return sb.from("saved_searches").delete().eq("id", id).then(() => { saved = saved.filter(x => x.id !== id); drawSaved(); paintTile(); });
  });

  /* quiet start: load, then one friendly toast if there is news */
  let tries = 0;
  const boot = setInterval(async () => {
    if (++tries > 40) return clearInterval(boot);
    if (!me() || !P().length) return; clearInterval(boot);
    await Promise.all([loadSaved(), loadJobs()]);
    const n = newCount(), a = actCount();
    if (a) T("🧰 " + a + " job" + (a === 1 ? "" : "s") + " need your action"); else if (n) T("🔖 New matches for " + n + " saved search" + (n === 1 ? "" : "es"));
  }, 1500);
  window.SLC_JOBS = { openJobs, openSaved };
})();
