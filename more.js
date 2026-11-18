/* SL Connect - more features: Hire/Apply requests inbox, verified-badge requests,
   Browse by town, Make an offer (WhatsApp), WhatsApp digest. Load AFTER nice.js.
   Requests + badge requests need requests.sql run once in Supabase. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("p-market") || typeof detail !== "function" || typeof sb === "undefined" || !sb) return;
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = m => { try { toast(m); } catch (e) { alert(m); } };
  const norm2 = p => String(p || "").replace(/[^\d]/g, "");
  const needSql = e => /relation|does not exist|schema cache/i.test((e && e.message) || "") ? "Not switched on yet. Run requests.sql in Supabase." : ((e && e.message) || "Something went wrong.");
  const P = () => (typeof posts !== "undefined" ? posts : []);
  const me = () => (typeof user !== "undefined" && user ? user : null);

  const css = document.createElement("style");
  css.textContent = `
  .mo-dlg{width:min(560px,96vw);max-height:90vh;border:1px solid var(--line);border-radius:20px;padding:0;background:var(--card);color:var(--text)}
  .mo-dlg::backdrop{background:#101828a8;backdrop-filter:blur(3px)}
  .mo-w{padding:16px;max-height:90vh;overflow:auto}
  .mo-h{display:flex;justify-content:space-between;align-items:center;gap:8px}.mo-h h2{margin:0;font-size:1.25rem}
  .mo-x{border:0;background:none;font-size:26px;color:inherit;cursor:pointer}
  .mo-tabs{display:flex;gap:6px;overflow-x:auto;margin:12px 0;scrollbar-width:none}
  .mo-tabs button,.mo-b{border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:999px;padding:8px 14px;font-weight:700;cursor:pointer;white-space:nowrap;flex:none}
  .mo-tabs button.on,.mo-b.pri{background:var(--green,#1eb53a);color:#fff;border-color:transparent}
  .mo-card{border:1px solid var(--line);border-radius:14px;padding:12px;margin:8px 0}
  .mo-card p{margin:6px 0;overflow-wrap:anywhere}.mo-card small{color:var(--muted)}
  .mo-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.mo-row .mo-b{flex:1 1 auto;text-align:center}
  .mo-in{width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--text);font:inherit;margin:6px 0}
  .mo-tag{display:inline-block;border-radius:99px;padding:2px 10px;font-size:.75rem;font-weight:700;background:#14224a22}
  .mo-tag.ok{background:#1eb53a33;color:#1a8f2f}.mo-tag.no{background:#e0245e22;color:#c01f50}
  .mo-av{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#1eb53a,#0072c6);color:#fff;font-size:1.8rem;font-weight:800;display:grid;place-items:center;margin:0 auto 6px}
  .mo-by{background:none;border:0;padding:0;color:var(--green,#1eb53a);font:inherit;font-weight:700;cursor:pointer;text-decoration:underline}
  #moTowns{margin:10px 0}.mo-th{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:.85rem;color:var(--muted);margin-bottom:6px}
  .mo-tiles{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}
  .mo-tile{flex:none;width:104px;border:1px solid var(--line);border-radius:14px;padding:10px;background:linear-gradient(160deg,var(--card),#1eb53a18);color:var(--text);text-align:left;cursor:pointer}
  .mo-tile b{display:block;font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mo-tile span{font-size:.75rem;color:var(--muted)}
  .mo-tile.on{border-color:var(--green,#1eb53a);box-shadow:0 0 0 2px #1eb53a44}
  .mo-badge{display:inline-block;background:#0072c6;color:#fff;border-radius:99px;font-size:.7rem;padding:1px 8px;margin-left:6px}
  .mo-act{margin-top:8px}.mo-act .ghost{margin-right:6px;margin-bottom:6px}`;
  document.head.append(css);

  const dlg = (id) => { let d = $(id); if (!d) { d = document.createElement("dialog"); d.id = id; d.className = "mo-dlg"; document.body.append(d); } return d; };
  const show = (d, html) => { d.innerHTML = `<div class="mo-w">${html}</div>`; if (!d.open) d.showModal(); };

  /* ---------- verified set + ratings (best effort) ---------- */
  let verified = new Set();
  async function loadVerified() { try { await sb.rpc("slc_expire_verified"); } catch (e) { } try { const r = await sb.from("verified_users").select("user_id").limit(5000); if (!r.error) verified = new Set((r.data || []).map(x => String(x.user_id))); } catch (e) { } }
  loadVerified();

  /* ---------- detail page add-ons ---------- */
  const _d = detail;
  detail = function (id) {
    const r = _d.apply(this, arguments);
    try {
      const p = P().find(x => x.id === id), u = me(); if (!p || !u) return r;
      const acts = document.querySelector("#ddBody .acts");
      if (acts && p.owner !== u.id && p.status !== "taken") {
        const lbl = p.type === "service" ? "📩 Hire this worker" : p.type === "job" ? "📩 Offer a job" : "📩 Send request";
        let h = `<div class="mo-act"><button class="ghost" data-mo="req" data-id="${E(id)}">${lbl}</button>`;
        if (p.type === "rent" || p.type === "land") h += `<button class="ghost" data-mo="offer" data-id="${E(id)}">💰 Make an offer</button>`;
        acts.insertAdjacentHTML("afterend", h + "</div>");
      }
    } catch (e) { }
    return r;
  };

  /* ---------- Make an offer (opens WhatsApp with the offer written) ---------- */
  function offer(id) {
    const p = P().find(x => x.id === id); if (!p) return;
    const v = prompt(`Your offer for "${p.title}" (in Leones). Listed: ${p.price || "no price"}`); if (v === null) return;
    const n = String(v).replace(/[^\d]/g, ""); if (!n) return T("Enter a number, for example 4500000");
    const text = `Hello ${p.by || ""}, I saw "${p.title}" (${p.loc}) on SL Connect. I can offer Le ${Number(n).toLocaleString("en-US")}. Is it still available?`;
    window.open("https://wa.me/" + norm2(p.phone) + "?text=" + encodeURIComponent(text), "_blank", "noopener");
  }

  /* ---------- requests inbox ---------- */
  const authSlot = $("auth");
  if (authSlot && authSlot.parentNode && !$("moReqBtn")) {
    const b = document.createElement("button"); b.className = "wt-launch"; b.id = "moReqBtn"; b.type = "button"; b.textContent = "📥 Requests";
    b.style.cssText = "border:1px solid var(--line);border-radius:12px;padding:9px 12px;background:var(--card);color:var(--text);font-weight:700;cursor:pointer;margin-left:6px";
    b.onclick = () => inbox("in"); authSlot.parentNode.insertBefore(b, authSlot);
  }
  async function sendReq(id) {
    const p = P().find(x => x.id === id), u = me(); if (!p || !u) return;
    const m = prompt(`Message to ${p.by || "the poster"} about "${p.title}":`, p.type === "service" ? "Hello, I would like to hire you. When are you free?" : ""); if (m === null) return;
    if (m.trim().length < 3) return T("Please write a short message.");
    const { error } = await sb.from("post_requests").insert({ post_id: id, owner_id: p.owner, sender_id: u.id, sender_name: u.name, sender_phone: u.phone || null, message: m.trim().slice(0, 500) });
    T(error ? (/duplicate/i.test(error.message) ? "You already sent a request for this post." : needSql(error)) : "Request sent. They will see it in Requests.");
  }
  let tabNow = "in";
  async function inbox(t) {
    tabNow = t || tabNow; const u = me(); if (!u) return T("Please sign in first.");
    const tabs = [["in", "Received"], ["out", "Sent"], ["ver", "Get verified"]].concat(u.admin ? [["adm", "Admin"]] : []);
    let body = "";
    if (tabNow === "in" || tabNow === "out") {
      const col = tabNow === "in" ? "owner_id" : "sender_id";
      const { data, error } = await sb.from("post_requests").select("*").eq(col, u.id).order("created_at", { ascending: false }).limit(50);
      if (error) body = `<div class="mo-card">${E(needSql(error))}</div>`;
      else if (!data.length) body = `<div class="mo-card"><p>${tabNow === "in" ? "No requests yet. When someone taps Hire or Send request on your post, it shows here." : "You have not sent any requests."}</p></div>`;
      else body = data.map(r => { const p = P().find(x => x.id === r.post_id);
        return `<div class="mo-card"><b>${E(tabNow === "in" ? (r.sender_name || "Member") : (p ? p.title : "Post"))}</b> <span class="mo-tag ${r.status === "accepted" ? "ok" : r.status === "declined" ? "no" : ""}">${E(r.status)}</span>
          <p>${E(r.message)}</p><small>${p ? "About: " + E(p.title) + " · " : ""}${new Date(r.created_at).toLocaleDateString()}</small>
          ${tabNow === "in" ? `<div class="mo-row">${r.sender_phone ? `<a class="mo-b pri" href="https://wa.me/${norm2(r.sender_phone)}" target="_blank" rel="noopener">WhatsApp</a><a class="mo-b" href="tel:${E(r.sender_phone)}">Call</a>` : ""}${r.status === "new" ? `<button class="mo-b" data-mo="rs" data-id="${r.id}" data-s="accepted">Accept</button><button class="mo-b" data-mo="rs" data-id="${r.id}" data-s="declined">Decline</button>` : ""}</div>` : (r.status === "new" ? `<div class="mo-row"><button class="mo-b" data-mo="rdel" data-id="${r.id}">Cancel request</button></div>` : "")}</div>`; }).join("");
    } else if (tabNow === "ver") {
      const { data, error } = await sb.from("verify_requests").select("*").eq("user_id", u.id).maybeSingle();
      const ok = verified.has(String(u.id));
      body = ok ? `<div class="mo-card"><p>✔ You are verified. Your posts show the blue badge.</p></div>`
        : error ? `<div class="mo-card">${E(needSql(error))}</div>`
        : data ? `<div class="mo-card"><p>⏳ Your request is ${E(data.status)}. An admin will check your phone number and approve you.</p></div>`
        : `<div class="mo-card"><b>⚡ Verified badge: Le 30 for 30 days</b><p>Pay with Monime (Orange Money, Afrimoney or card) and your blue ✔ badge turns on right after payment.</p>
          <button class="mo-b pri" data-mo="paybadge" style="width:100%">Pay Le 30 with Monime</button><p style="color:var(--muted);font-size:.8rem;margin:8px 0 0">Needs payments switched on by the app owner.</p></div>
        <div class="mo-card"><b>Or ask an admin to verify you (free)</b><p>An admin will call or WhatsApp the number you give to confirm it is really you.</p>
          <input class="mo-in" id="moVP" inputmode="tel" placeholder="Your phone number" value="${E(u.phone || "")}"><input class="mo-in" id="moVN" maxlength="200" placeholder="Short note (e.g. electrician in Bo)">
          <button class="mo-b pri" data-mo="verreq">Request badge</button></div>`;
    } else if (tabNow === "adm") {
      const { data, error } = await sb.from("verify_requests").select("*").eq("status", "pending").order("created_at");
      body = error ? `<div class="mo-card">${E(needSql(error))}</div>` : !data.length ? `<div class="mo-card"><p>No pending verification requests.</p></div>`
        : data.map(r => `<div class="mo-card"><b>${E(r.name || "Member")}</b><p>${E(r.phone || "")}<br>${E(r.note || "")}</p><div class="mo-row"><a class="mo-b" href="https://wa.me/${norm2(r.phone)}" target="_blank" rel="noopener">WhatsApp</a><button class="mo-b pri" data-mo="verok" data-id="${r.user_id}">Verify ✔</button></div></div>`).join("");
    }
    show(dlg("moReq"), `<div class="mo-h"><h2>Requests</h2><button class="mo-x" data-mo="close" aria-label="Close">×</button></div>
      <div class="mo-tabs">${tabs.map(([k, v]) => `<button class="${k === tabNow ? "on" : ""}" data-mo="tab" data-t="${k}">${v}</button>`).join("")}</div>${body}`);
  }

  /* ---------- Browse by town + WhatsApp digest ---------- */
  function towns() {
    const box = $("moTowns") || (() => { const bar = document.querySelector("#p-market .bar"); if (!bar) return null; bar.insertAdjacentHTML("afterend", '<div id="moTowns"></div>'); return $("moTowns"); })();
    if (!box) return;
    const c = {}; P().forEach(p => { const k = (p.loc || "").trim(); if (k) c[k] = (c[k] || 0) + 1; });
    const top = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 10), cur = $("locF") ? $("locF").value : "";
    box.innerHTML = top.length ? `<div class="mo-th"><span>📍 Browse by town</span><button class="mo-by" data-mo="digest" style="font-size:.78rem">📲 Share new posts</button></div>
      <div class="mo-tiles">${top.map(([k, n]) => `<button class="mo-tile ${k === cur ? "on" : ""}" data-mo="town" data-t="${E(k)}"><b>${E(k)}</b><span>${n} post${n === 1 ? "" : "s"}</span></button>`).join("")}</div>` : "";
  }
  function digest() {
    const list = P().filter(p => p.status !== "taken").slice(0, 6); if (!list.length) return T("No posts yet.");
    const text = "🇸🇱 New on SL Connect:\n" + list.map(p => `• ${p.title} (${p.loc})${p.price ? " - " + p.price : ""}`).join("\n") + "\n\nSee all: " + location.origin + location.pathname;
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
  }
  const _rm = renderMarket;
  renderMarket = function () { _rm.apply(this, arguments); try { towns(); } catch (e) { } };
  const lf = $("locF"); if (lf) lf.addEventListener("change", () => setTimeout(() => { try { towns(); } catch (e) { } }, 0));

  /* ---------- clicks ---------- */
  document.addEventListener("click", async ev => {
    const el = ev.target.closest("[data-mo]"); if (!el) return;
    ev.preventDefault(); ev.stopPropagation();
    const a = el.dataset.mo, id = el.dataset.id;
    if (a === "close") { const d = el.closest("dialog"); if (d) d.close(); }
    else if (a === "req") sendReq(id);
    else if (a === "offer") offer(id);
    else if (a === "tab") inbox(el.dataset.t);
    else if (a === "rs") { const { error } = await sb.from("post_requests").update({ status: el.dataset.s }).eq("id", id); T(error ? needSql(error) : "Updated"); inbox(); }
    else if (a === "rdel") { const { error } = await sb.from("post_requests").delete().eq("id", id); T(error ? needSql(error) : "Cancelled"); inbox(); }
    else if (a === "verreq") {
      const ph = $("moVP").value.trim(); if (norm2(ph).length < 8) return T("Enter your phone number.");
      const u = me(), { error } = await sb.from("verify_requests").insert({ user_id: u.id, name: u.name, phone: ph, note: $("moVN").value.trim().slice(0, 200) });
      T(error ? needSql(error) : "Request sent. An admin will contact you."); inbox("ver");
    }
    else if (a === "paybadge") {
      el.disabled = true; el.textContent = "Opening Monime…";
      const r = await sb.functions.invoke("verify-checkout", { body: {} });
      let msg = r.error ? (r.error.message || "Could not start payment.") : (r.data && r.data.error);
      if (r.error) { try { const j = await r.error.context.json(); if (j && j.error) msg = j.error; } catch (e) { } if (/failed to send|not found|404/i.test(msg || "")) msg = "Payments are not switched on yet."; }
      if (msg || !r.data || !r.data.url) { T(msg || "Could not start payment."); el.disabled = false; el.textContent = "Pay Le 30 with Monime"; return; }
      location.href = r.data.url;
    }
    else if (a === "verok") {
      const { error } = await sb.rpc("admin_set_verified", { target: id, make: true });
      if (error) return T(needSql(error));
      await sb.from("verify_requests").update({ status: "done" }).eq("user_id", id); await loadVerified(); T("User verified ✔"); inbox("adm");
    }
    else if (a === "town") { const sel = $("locF"); if (sel) { sel.value = sel.value === el.dataset.t ? "" : el.dataset.t; sel.dispatchEvent(new Event("change")); } }
    else if (a === "digest") digest();
  }, true);

  /* back from Monime: confirm the payment with the server, then refresh the badge */
  (async function () {
    try {
      const q = new URLSearchParams(location.search); if (q.get("paid") !== "verify" || !me()) return;
      q.delete("paid"); history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q.toString() : "") + location.hash);
      T("Checking your payment…");
      for (let i = 0; i < 4; i++) {
        const r = await sb.functions.invoke("verify-payment", { body: {} });
        const st = r.data && r.data.payments && r.data.payments[0] && r.data.payments[0].status;
        if (st === "successful") { await loadVerified(); T("✔ Payment received. You are verified for 30 days."); return; }
        if (st === "failed") return T("Payment was not completed.");
        await new Promise(res => setTimeout(res, 2500));
      }
      T("Payment is still processing. Open More → Requests → Get verified in a minute.");
    } catch (e) { }
  })();

  if (me()) { try { renderMarket(); } catch (e) { } }
})();
