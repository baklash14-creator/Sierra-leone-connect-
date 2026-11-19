/* SL Connect - AI: post writer (in the Post form) + "Ask SL Connect" assistant (More menu).
   Calls the ai-assist edge function; the Anthropic key never touches the website. Load AFTER alerts.js. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("p-market") || typeof sb === "undefined" || !sb) return;
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const me = () => (typeof user !== "undefined" && user ? user : null);
  const T = m => { try { toast(m); } catch (e) { alert(m); } };
  const P = () => (typeof posts !== "undefined" ? posts : []);

  async function call(body) {
    if (!me()) { T("Please sign in to use AI"); try { openAuth("in"); } catch (e) { } throw new Error("signin"); }
    const r = await sb.functions.invoke("ai-assist", { body });
    if (r.error) {
      let msg = "AI is not available right now.";
      try { const j = await r.error.context.json(); if (j && j.error) msg = j.error; } catch (e) { }
      throw new Error(msg);
    }
    if (!r.data) throw new Error("AI is not available right now.");
    if (r.data.error) throw new Error(r.data.error);
    return r.data;
  }

  const css = document.createElement("style");
  css.textContent = `
  .ai-w{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:2px 0 6px}
  .ai-w button{border:1px solid var(--line);background:var(--card,#fff);color:inherit;border-radius:999px;padding:8px 14px;font-weight:700;font-size:.85rem}
  .ai-w small{color:var(--muted);font-size:.75rem}
  #aiDlg{border:0;border-radius:18px;padding:0;width:min(520px,calc(100vw - 20px));max-height:88dvh}
  #aiDlg::backdrop{background:rgba(0,0,0,.5)}
  .ai-b{display:flex;flex-direction:column;height:min(640px,86dvh)}
  .ai-h{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--line)}
  .ai-h b{font-size:1.05rem}.ai-h button{border:0;background:none;font-size:1.3rem;color:inherit}
  .ai-log{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
  .ai-m{max-width:88%;padding:10px 13px;border-radius:14px;line-height:1.4;font-size:.92rem;white-space:pre-wrap;word-break:break-word}
  .ai-m.u{align-self:flex-end;background:var(--brand,#0a7d3b);color:#fff}
  .ai-m.a{align-self:flex-start;background:var(--soft,#f1f3f2)}
  .ai-c{display:flex;flex-direction:column;gap:6px;align-self:flex-start;width:88%}
  .ai-c button{text-align:left;border:1px solid var(--line);background:var(--card,#fff);color:inherit;border-radius:12px;padding:9px 12px;font-size:.85rem}
  .ai-c b{display:block}.ai-c span{color:var(--muted);font-size:.78rem}
  .ai-sg{display:flex;gap:6px;flex-wrap:wrap}.ai-sg button{border:1px solid var(--line);background:none;color:inherit;border-radius:999px;padding:7px 12px;font-size:.8rem}
  .ai-f{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--line)}
  .ai-f input{flex:1;min-width:0;font-size:16px}.ai-f button{border-radius:12px;padding:0 16px}
  .ai-n{color:var(--muted);font-size:.72rem;padding:0 14px 8px}`;
  document.head.appendChild(css);

  /* ---------- AI post writer ---------- */
  function addWriter() {
    const form = $("title") && $("title").closest("form");
    if (!form || $("aiWrite")) return;
    const lab = $("title").closest("label");
    lab.insertAdjacentHTML("beforebegin", `<div class="ai-w"><button type="button" id="aiWrite">✨ Write it for me</button><small id="aiWriteN">Type a few words in Title, then tap</small></div>`);
    $("aiWrite").onclick = async () => {
      const idea = [$("title").value, $("cat") ? $("cat").value : "", $("desc").value].join(" ").trim();
      if (idea.length < 3) return T("Type a few words in Title first, e.g. “plumber 5 years Bo”");
      const btn = $("aiWrite"); btn.disabled = true; btn.textContent = "✨ Writing…";
      try {
        const r = await call({ mode: "write", type: $("type").value, idea, loc: $("loc").value, price: $("price").value, lang: "en" });
        if (r.title) $("title").value = r.title;
        if (r.category && $("cat") && !$("cat").value) $("cat").value = r.category;
        if (r.details) $("desc").value = r.details;
        $("aiWriteN").textContent = "Done. Please check it and fix anything wrong before you publish.";
      } catch (e) { if (e.message !== "signin") T(e.message); }
      btn.disabled = false; btn.textContent = "✨ Write it for me";
    };
  }
  const pd = $("postDlg") || $("title").closest("dialog");
  if (pd) new MutationObserver(addWriter).observe(pd, { attributes: true, childList: true });
  addWriter();

  /* ---------- Ask SL Connect ---------- */
  let hist = [];
  function dlg() {
    let d = $("aiDlg"); if (d) return d;
    d = document.createElement("dialog"); d.id = "aiDlg";
    d.innerHTML = `<div class="ai-b"><div class="ai-h"><b>✨ Ask SL Connect</b><button type="button" id="aiX" aria-label="Close">✕</button></div>
      <div class="ai-log" id="aiLog"></div><div class="ai-n">AI can make mistakes. Check details and meet safely before paying.</div>
      <form class="ai-f" id="aiF"><input id="aiQ" maxlength="400" placeholder="e.g. cheap 2 bedroom in Bo" autocomplete="off"><button class="primary" type="submit">Ask</button></form></div>`;
    document.body.appendChild(d);
    $("aiX").onclick = () => d.close();
    $("aiF").onsubmit = ev => { ev.preventDefault(); const q = $("aiQ").value.trim(); if (q) { $("aiQ").value = ""; ask(q); } };
    return d;
  }
  const log = () => $("aiLog");
  const add = (cls, html) => { const l = log(); l.insertAdjacentHTML("beforeend", html); l.scrollTop = l.scrollHeight; };
  async function ask(q) {
    add("", `<div class="ai-m u">${E(q)}</div>`);
    add("", `<div class="ai-m a" id="aiTyp">Thinking…</div>`);
    try {
      const r = await call({ mode: "ask", question: q, history: hist });
      const t = $("aiTyp"); if (t) t.remove();
      hist.push({ role: "user", content: q }, { role: "assistant", content: r.answer }); hist = hist.slice(-6);
      add("", `<div class="ai-m a">${E(String(r.answer).replace(/\[#([\w-]+)\]/g, "").replace(/ +\n/g, "\n"))}</div>`);
      const cards = (r.ids || []).map(id => P().find(p => String(p.id) === String(id))).filter(Boolean);
      if (cards.length) add("", `<div class="ai-c">${cards.map(p => `<button type="button" data-aid="${E(p.id)}"><b>${E(p.title)}</b><span>${E(p.loc)}${p.price ? " · Le " + E(p.price) : ""}</span></button>`).join("")}</div>`);
    } catch (e) {
      const t = $("aiTyp"); if (t) t.remove();
      if (e.message !== "signin") add("", `<div class="ai-m a">${E(e.message)}</div>`); else dlg().close();
    }
  }
  function openAsk() {
    const d = dlg();
    if (!log().children.length) {
      add("", `<div class="ai-m a">Hi! Tell me what you need and I will search SL Connect for you.</div>
        <div class="ai-sg">${["Electrician in Freetown", "House for rent in Bo", "Land for sale", "Driver job"].map(s => `<button type="button" data-ai-s="${E(s)}">${E(s)}</button>`).join("")}</div>`);
    }
    if (!d.open) d.showModal();
  }
  document.addEventListener("click", ev => {
    const s = ev.target.closest("[data-ai-s]"); if (s) { ask(s.dataset.aiS); return; }
    const c = ev.target.closest("[data-aid]"); if (c) { const p = P().find(x => String(x.id) === c.dataset.aid); if (p) { $("aiDlg").close(); try { detail(p.id); } catch (e) { } } return; }
    const t = ev.target.closest('[data-nv-act="ai"]'); if (t) { ev.preventDefault(); ev.stopPropagation(); const sh = $("nvSheet"); if (sh) sh.classList.remove("on"); openAsk(); }
  }, true);
  const sheet = $("nvSheet");
  if (sheet) new MutationObserver(() => {
    const g = sheet.querySelector(".nv-g"); if (!g || g.querySelector('[data-nv-act="ai"]')) return;
    g.insertAdjacentHTML("afterbegin", '<button class="nv-t" data-nv-act="ai"><i>✨</i>Ask AI</button>');
  }).observe(sheet, { childList: true, subtree: true });
  window.SLC_AI = { ask: openAsk };
})();
