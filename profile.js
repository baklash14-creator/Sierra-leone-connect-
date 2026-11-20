/* SL Connect - Worker profile upgrade + Skill quiz badges.
   Adds stats (rating, jobs done, available now, skills tested) to the public profile, a "Skill tested" tag on posts,
   and a server-graded skill quiz. Needs skill-badges.sql. Load AFTER live.js and jobs.js. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("p-market") || typeof detail !== "function" || typeof sb === "undefined" || !sb) return;
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = m => { try { toast(m); } catch (e) { alert(m); } };
  const P = () => (typeof posts !== "undefined" ? posts : []);
  const me = () => (typeof user !== "undefined" && user ? user : null);
  const digits = p => String(p || "").replace(/[^\d]/g, "");
  const dlg = id => { let d = $(id); if (!d) { d = document.createElement("dialog"); d.id = id; d.className = "tl-dlg"; document.body.append(d); } return d; };
  const show = (d, h) => { d.innerHTML = `<div class="tl-w">${h}</div>`; if (!d.open) d.showModal(); };
  const hdr = t => `<div class="tl-h"><h2>${t}</h2><button class="tl-x" data-pr="close" aria-label="Close">×</button></div>`;
  const clean = m => String(m || "").replace(/^.*exception:?\s*/i, "");

  const css = document.createElement("style");
  css.textContent = `
  .pr-bdg{display:inline-block;background:#0072c61a;color:#0a58a0;border:1px solid #0072c655;border-radius:99px;font-size:.72rem;font-weight:800;padding:2px 9px;margin:4px 6px 0 0}
  .pr-st{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
  .pr-st>div{flex:1 1 90px;border:1px solid var(--line);border-radius:14px;padding:10px;text-align:center;background:var(--bg)}
  .pr-st b{display:block;font-size:1.25rem}.pr-st span{color:var(--muted);font-size:.75rem}
  .pr-q{border:1px solid var(--line);border-radius:14px;padding:12px;margin:10px 0;background:var(--bg)}
  .pr-q b{display:block;margin-bottom:6px}
  .pr-q label{display:flex;gap:8px;align-items:flex-start;padding:7px 4px;cursor:pointer}
  .pr-q input{margin-top:3px}
  .pr-sk{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}`;
  document.head.append(css);

  /* ---------- who has which badge ---------- */
  let badges = {};
  async function loadBadges() {
    try { const r = await sb.from("skill_badges").select("user_id,skill").limit(5000); if (r.error) return;
      badges = {}; (r.data || []).forEach(x => (badges[String(x.user_id)] = badges[String(x.user_id)] || []).push(x.skill)); } catch (e) { }
  }
  const chips = list => (list || []).map(s => `<span class="pr-bdg">🎓 ${E(s)} · Skill tested</span>`).join("");

  const _d = detail;
  detail = function (id) {
    const r = _d.apply(this, arguments);
    try {
      const p = P().find(x => x.id === id), body = document.querySelector("#ddBody .db"); if (!p || !body) return r;
      const b = badges[String(p.owner)]; if (!b || !b.length || body.querySelector(".pr-bdg")) return r;
      const anchor = body.querySelector(".by") || body.querySelector("h2"); if (anchor) anchor.insertAdjacentHTML("afterend", `<div>${chips(b)}</div>`);
    } catch (e) { }
    return r;
  };

  /* ---------- profile upgrade ---------- */
  let lastUid = "";
  const grab = ev => { const el = ev.target.closest && ev.target.closest('[data-sx="prof"]'); if (el && el.dataset.uid) lastUid = el.dataset.uid; };
  window.addEventListener("click", grab, true); // window capture runs before social.js stops the event
  window.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") grab(ev); }, true);

  async function enrich() {
    const box = $("pfBody"); if (!box || !lastUid || !box.querySelector(".pfh") || box.querySelector(".pr-st")) return;
    const uid = lastUid, mine = P().filter(p => String(p.owner) === uid && p.type === "service");
    const head = box.querySelector(".pfh");
    head.insertAdjacentHTML("afterend", '<div class="pr-st" data-uid="' + E(uid) + '"><div><b>…</b><span>Rating</span></div></div>');
    let s = null; try { const r = await sb.rpc("slc_worker_stats", { p_uid: uid }); if (!r.error) s = r.data; } catch (e) { }
    const st = box.querySelector(".pr-st"); if (!st || st.dataset.uid !== uid) return;
    if (!s) { st.remove(); return; }
    const on = window.SLC_LIVE && window.SLC_LIVE.isAvail && mine.some(window.SLC_LIVE.isAvail);
    st.innerHTML = `<div><b>${s.avg ? "★ " + Number(s.avg).toFixed(1) : "–"}</b><span>${s.reviews} review${s.reviews == 1 ? "" : "s"}</span></div>
      <div><b>${s.jobs_done}</b><span>job${s.jobs_done == 1 ? "" : "s"} done</span></div>
      <div><b>${on ? "🟢" : "⚪"}</b><span>${on ? "Available now" : "Not marked free"}</span></div>`;
    const extra = [];
    if ((s.badges || []).length) extra.push(`<div>${chips(s.badges)}</div>`);
    const u = me(), first = mine[0];
    if (u && String(u.id) !== uid && first) extra.push(`<div class="tl-row"><button class="tl-b pri" data-tl="book" data-id="${E(first.id)}">📅 Book ${E((first.by || "worker").split(" ")[0])}</button><a class="tl-b" style="text-decoration:none;color:inherit" href="https://wa.me/${digits(first.phone)}" target="_blank" rel="noopener">WhatsApp</a></div>`);
    if (u && String(u.id) === uid) extra.push('<div class="tl-row"><button class="tl-b pri" data-pr="quiz">🎓 Earn a Skill tested badge</button></div>');
    st.insertAdjacentHTML("afterend", extra.join(""));
  }
  let pfSeen = null;
  setInterval(() => { const pf = $("pfBody"); if (pf && pf !== pfSeen) { pfSeen = pf; new MutationObserver(enrich).observe(pf, { childList: true }); } }, 1000);

  /* ---------- skill quiz ---------- */
  let qs = [], skill = "";
  async function openQuiz() {
    if (!me()) { T("Please sign in first"); try { openAuth("in"); } catch (e) { } return; }
    const pfd = $("profDlg"); if (pfd && pfd.open) pfd.close();
    show(dlg("prQuiz"), hdr("🎓 Skill quiz") + '<p style="color:var(--muted)">Answer 5 questions. Get 4 right to earn a <b>Skill tested</b> badge on your posts and profile. It shows you know the basics. It is not a licence. One try per skill each day.</p><div id="prQb"><p style="color:var(--muted)">Loading…</p></div>');
    try { const r = await sb.rpc("slc_quiz_skills"); if (r.error) throw r.error;
      const list = r.data || [], mine = badges[String(me().id)] || [];
      $("prQb").innerHTML = '<div class="pr-sk">' + list.map(s => `<button class="tl-b ${mine.includes(s) ? "" : "pri"}" data-pr="start" data-skill="${E(s)}">${mine.includes(s) ? "✔ " : ""}${E(s)}</button>`).join("") + "</div>";
    } catch (e) { $("prQb").innerHTML = `<p>${E(/function|schema cache/i.test(e.message || "") ? "Not switched on yet. Run skill-badges.sql in Supabase." : clean(e.message))}</p>`; }
  }
  async function start(s) {
    skill = s; $("prQb").innerHTML = '<p style="color:var(--muted)">Getting questions…</p>';
    const r = await sb.rpc("slc_quiz_get", { p_skill: s });
    if (r.error || !r.data || r.data.length < 5) { $("prQb").innerHTML = `<p>${E(r.error ? clean(r.error.message) : "Not enough questions yet.")}</p>`; return; }
    qs = r.data;
    $("prQb").innerHTML = `<b>${E(s)}</b>` + qs.map((q, i) => `<div class="pr-q"><b>${i + 1}. ${E(q.q)}</b>${(q.opts || []).map((o, k) => `<label><input type="radio" name="pq${i}" value="${k}"> <span>${E(o)}</span></label>`).join("")}</div>`).join("") +
      '<div class="tl-row"><button class="tl-b" data-pr="back">Back</button><button class="tl-b pri" data-pr="submit">Finish</button></div>';
  }
  async function submit() {
    const ans = qs.map((q, i) => { const c = document.querySelector(`input[name="pq${i}"]:checked`); return c ? +c.value : -1; });
    if (ans.includes(-1)) return T("Answer all 5 questions");
    const r = await sb.rpc("slc_quiz_submit", { p_skill: skill, p_ids: qs.map(q => q.id), p_ans: ans });
    if (r.error) { $("prQb").innerHTML = `<p>${E(clean(r.error.message))}</p><button class="tl-b" data-pr="back">Back</button>`; return; }
    const d = r.data;
    $("prQb").innerHTML = d.passed ? `<h3>🎉 You passed: ${d.score}/5</h3><p>Your <b>${E(skill)} · Skill tested</b> badge is now on your posts and profile.</p>` : `<h3>${d.score}/5. Not yet</h3><p>You need 4 right. Study the basics and try again tomorrow.</p>`;
    $("prQb").insertAdjacentHTML("beforeend", '<div class="tl-row"><button class="tl-b" data-pr="close">Close</button></div>');
    if (d.passed) { await loadBadges(); }
  }

  document.addEventListener("click", ev => {
    const b = ev.target.closest("[data-pr]"); if (!b) return;
    const k = b.dataset.pr;
    if (k === "close") return b.closest("dialog").close();
    if (k === "quiz") return openQuiz();
    if (k === "start") return start(b.dataset.skill);
    if (k === "back") return openQuiz();
    if (k === "submit") return submit();
  });

  const sheet = $("nvSheet");
  if (sheet) {
    new MutationObserver(() => { const g = sheet.querySelector(".nv-g"); if (!g || g.querySelector('[data-nv-act="quiz"]')) return;
      g.insertAdjacentHTML("afterbegin", '<button class="nv-t" data-nv-act="quiz"><i>🎓</i>Skill quiz</button>'); }).observe(sheet, { childList: true, subtree: true });
    document.addEventListener("click", ev => { const t = ev.target.closest('[data-nv-act="quiz"]'); if (t) { ev.preventDefault(); ev.stopPropagation(); sheet.classList.remove("on"); openQuiz(); } }, true);
  }
  loadBadges();
  window.SLC_PROFILE = { openQuiz, badges: () => badges, reload: loadBadges };
})();
