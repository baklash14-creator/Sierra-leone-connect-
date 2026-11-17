/* SL Connect - nice extras (phone only, no database changes):
   recently viewed, saved searches with "new" counts, data saver, offline banner, back-to-top.
   Load AFTER price.js / featured.js. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("p-market") || !$("list") || typeof renderMarket !== "function") return;
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const T = m => { try { typeof toast === "function" ? toast(m) : 0; } catch (e) { } };

  const css = document.createElement("style");
  css.textContent = `
  #nxBox{margin:8px 0}
  .nx-row{display:flex;gap:8px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}.nx-row::-webkit-scrollbar{display:none}
  .nx-h{font-size:.8rem;font-weight:800;color:var(--muted);margin:6px 0 4px;display:flex;justify-content:space-between;align-items:center}
  .nx-chip{flex:none;max-width:220px;border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:999px;padding:8px 14px;font-size:.85rem;font-weight:600;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .nx-chip b{background:#e0245e;color:#fff;border-radius:99px;padding:1px 7px;margin-left:6px;font-size:.72rem}
  .nx-chip .x{margin-left:8px;opacity:.55}
  .nx-tools{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}
  .nx-btn{border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:12px;padding:8px 12px;font-weight:700;font-size:.85rem;cursor:pointer}
  .nx-btn.on{background:#12361a;color:#39c24a;border-color:#39c24a}
  .nx-link{border:0;background:none;color:var(--muted);font-size:.75rem;cursor:pointer;padding:0}
  .nx-ds .card .ph{background-image:none!important;height:56px}
  .nx-ds .card .ph:not(.noimg)::after{content:"📷 photo hidden (data saver)";display:grid;place-items:center;height:100%;font-size:.75rem;color:var(--muted)}
  #nxOff{position:fixed;top:0;left:0;right:0;z-index:500;background:#b4570a;color:#fff;text-align:center;padding:8px 12px;font-weight:700;font-size:.85rem;transform:translateY(-110%);transition:transform .25s}
  #nxOff.on{transform:none}
  #nxTop{position:fixed;right:16px;bottom:86px;width:46px;height:46px;border-radius:50%;border:0;background:var(--green,#1eb53a);color:#fff;font-size:22px;box-shadow:0 6px 18px #0004;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s;z-index:120}
  #nxTop.on{opacity:1;pointer-events:auto}`;
  document.head.append(css);

  /* ---------- recently viewed ---------- */
  const RV = "slc_recent";
  if (typeof detail === "function") {
    const _d = detail;
    detail = function (id) { const r = [String(id)].concat(get(RV, []).filter(x => x !== String(id))).slice(0, 8); put(RV, r); return _d.apply(this, arguments); };
  }

  /* ---------- saved searches ---------- */
  const SS = "slc_searches";
  const cur = () => ({ q: $("q").value.trim(), loc: $("locF").value, tab: typeof tab !== "undefined" ? tab : "all" });
  const key = s => [s.q.toLowerCase(), s.loc, s.tab].join("|");
  const matches = s => (typeof posts !== "undefined" ? posts : []).filter(p =>
    (s.tab === "all" || p.type === s.tab) && (!s.loc || p.loc.trim() === s.loc) &&
    (!s.q || [p.title, p.cat, p.loc, p.desc].join(" ").toLowerCase().includes(s.q.toLowerCase())));
  const label = s => [s.q, s.loc, s.tab !== "all" ? s.tab : ""].filter(Boolean).join(" · ") || "All posts";
  const isActive = s => s.q || s.loc || s.tab !== "all";
  function newCount(s) { const known = new Set(s.known || []); return matches(s).filter(p => !known.has(String(p.id))).length; }

  /* ---------- data saver ---------- */
  const setDS = on => { document.body.classList.toggle("nx-ds", on); put("slc_ds", on); const b = $("nxDS"); if (b) { b.classList.toggle("on", on); b.textContent = on ? "📶 Data saver: ON" : "📶 Data saver"; } };

  function draw() {
    let box = $("nxBox");
    if (!box) { $("count").insertAdjacentHTML("beforebegin", '<div id="nxBox"></div>'); box = $("nxBox"); }
    const byId = {}; (typeof posts !== "undefined" ? posts : []).forEach(p => byId[String(p.id)] = p);
    const rec = get(RV, []).filter(id => byId[id]);
    const ss = get(SS, []), c = cur(), saved = ss.some(s => key(s) === key(c));
    let h = `<div class="nx-tools"><button class="nx-btn ${saved ? "on" : ""}" id="nxSave" ${!isActive(c) && !saved ? 'disabled style="opacity:.5"' : ""}>${saved ? "🔔 Search saved" : "🔔 Save this search"}</button>
      <button class="nx-btn" id="nxDS"></button></div>`;
    if (ss.length) h += `<div class="nx-h">Saved searches</div><div class="nx-row">${ss.map((s, i) => { const n = newCount(s); return `<button class="nx-chip" data-nxs="${i}">${E(label(s))}${n ? `<b>${n} new</b>` : ""}<span class="x" data-nxdel="${i}" aria-label="Remove">✕</span></button>`; }).join("")}</div>`;
    if (rec.length) h += `<div class="nx-h"><span>🕘 Recently viewed</span><button class="nx-link" id="nxClr">Clear</button></div><div class="nx-row">${rec.map(id => `<button class="nx-chip" data-nxr="${E(id)}">${E(byId[id].title)}</button>`).join("")}</div>`;
    box.innerHTML = h; setDS(!!get("slc_ds", false));
  }

  const _rm = renderMarket;
  renderMarket = function () { _rm.apply(this, arguments); try { draw(); } catch (e) { } };

  /* app.js bound these to the original renderMarket, so redraw our box ourselves after they run */
  ["q", "locF", "sort", "avail"].forEach(id => $(id).addEventListener(id === "q" ? "input" : "change", () => setTimeout(() => { try { draw(); } catch (e) { } }, 0)));

  document.addEventListener("click", ev => {
    const t = ev.target;
    let el;
    if ((el = t.closest("[data-nxdel]"))) { ev.stopPropagation(); const ss = get(SS, []); ss.splice(+el.dataset.nxdel, 1); put(SS, ss); draw(); return; }
    if ((el = t.closest("[data-nxs]"))) {
      const ss = get(SS, []), s = ss[+el.dataset.nxs]; if (!s) return;
      $("q").value = s.q; if (typeof tab !== "undefined") tab = s.tab;
      if (typeof renderTabs === "function") renderTabs();
      renderMarket(); $("locF").value = s.loc; renderMarket();
      s.known = matches(s).map(p => String(p.id)); put(SS, ss); draw(); return;
    }
    if ((el = t.closest("[data-nxr]"))) { if (typeof detail === "function") detail(el.dataset.nxr); return; }
    if (t.closest("#nxClr")) { put(RV, []); draw(); return; }
    if (t.closest("#nxDS")) { setDS(!document.body.classList.contains("nx-ds")); T(document.body.classList.contains("nx-ds") ? "Data saver on: photos hidden" : "Data saver off"); return; }
    if (t.closest("#nxSave")) {
      const c = cur(), ss = get(SS, []), i = ss.findIndex(s => key(s) === key(c));
      if (i >= 0) { ss.splice(i, 1); T("Search removed"); }
      else { if (!isActive(c)) return; if (ss.length >= 6) ss.shift(); c.known = matches(c).map(p => String(p.id)); ss.push(c); T("Saved. We will show how many new posts match."); }
      put(SS, ss); draw(); return;
    }
    if (t.closest("#nxTop")) window.scrollTo({ top: 0, behavior: "smooth" });
  }, true);

  /* one friendly nudge when saved searches have new posts */
  let nudged = false;
  const _draw = draw;
  draw = function () { _draw(); if (!nudged && typeof posts !== "undefined" && posts.length) { nudged = true; const n = get(SS, []).reduce((a, s) => a + newCount(s), 0); if (n) T("🔔 " + n + " new post" + (n === 1 ? "" : "s") + " match your saved searches"); } };

  /* ---------- offline banner + back to top ---------- */
  document.body.insertAdjacentHTML("beforeend", '<div id="nxOff" role="status">📴 You are offline. Showing what is already loaded.</div><button id="nxTop" aria-label="Back to top">↑</button>');
  const off = () => $("nxOff").classList.toggle("on", !navigator.onLine);
  addEventListener("online", () => { off(); T("Back online"); }); addEventListener("offline", off); off();
  addEventListener("scroll", () => $("nxTop").classList.toggle("on", scrollY > 700), { passive: true });

  setDS(!!get("slc_ds", false));
  if (typeof user !== "undefined" && user) { try { renderMarket(); } catch (e) { } }
})();
