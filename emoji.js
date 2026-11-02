/* SL Connect - emoji picker for the chat box.
   Load AFTER chat.js (and voice.js if you use it). No SQL or chat.js changes needed. */
(function () {
  if (typeof CLOUD === "undefined" || !CLOUD) return;

  const SETS = {
    "😀": "😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤗 🤔 🤨 😐 😶 🙄 😏 😴 😎 🤓 😢 😭 😤 😡 🥺 😱 😳 🤒 🤕 🥳 😬 🙃 😌",
    "👍": "👍 👎 👌 ✌️ 🤞 🤝 🙏 👏 🙌 👋 🤙 💪 ☝️ 👉 👈 👇 ✋ 🤚 ✊ 👊 🫶 🫡",
    "❤️": "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💕 💖 💯 🔥 ✨ ⭐ 🌟 🎉 🎊 🎁 ✅ ❌ ❗ ❓ 💬 👀",
    "🏠": "🏠 🏡 🏢 🏗️ 🛠️ 🔧 🔨 🧰 🔌 💡 🚿 🧹 🪑 🛏️ 🔑 🚪 🌍 🌴 🌳 🏞️ 📍 🗺️ 🚗 🚕 🏍️ 🚌 🛺 ⛽ 💼 📞 📱 💻 📷",
    "🍛": "🍛 🍚 🍲 🍗 🍖 🐟 🍤 🥘 🍞 🥔 🍠 🌽 🥥 🍌 🍍 🥭 🍉 🍊 🍋 🍎 ☕ 🍵 🥤 💧 🍺"
  };
  const KEY = "slc-emoji-recent";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const save = a => { try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 16))); } catch (e) { } };

  const st = document.createElement("style");
  st.textContent = `
.emjbtn{flex:none;width:42px;height:42px;border-radius:50%;border:1px solid color-mix(in srgb,currentColor 22%,transparent);background:transparent;color:inherit;font-size:1.15rem;cursor:pointer}
.emjbtn:hover,.emjbtn.on{background:color-mix(in srgb,#1eb53a 16%,transparent)}
.emjp{flex:none;height:210px;display:flex;flex-direction:column;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent)}
.emjp[hidden]{display:none}
.emjtabs{display:flex;gap:2px;padding:4px 8px;border-bottom:1px solid color-mix(in srgb,currentColor 10%,transparent);overflow-x:auto}
.emjtab{flex:none;border:0;background:transparent;font-size:1.2rem;padding:4px 8px;border-radius:8px;cursor:pointer}
.emjtab.on{background:color-mix(in srgb,#1eb53a 20%,transparent)}
.emjgrid{flex:1;overflow-y:auto;padding:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:2px;align-content:start}
.emjgrid button{border:0;background:transparent;font-size:1.45rem;line-height:1;padding:6px 0;border-radius:8px;cursor:pointer}
.emjgrid button:hover{background:color-mix(in srgb,currentColor 12%,transparent)}
.vmrec .emjbtn{display:none}`;
  document.head.appendChild(st);

  let tab = null;

  function paint(p) {
    const rec = load(), keys = Object.keys(SETS);
    const tabs = (rec.length ? ["🕘"] : []).concat(keys);
    if (!tab || !tabs.includes(tab)) tab = rec.length ? "🕘" : keys[0];
    const list = tab === "🕘" ? rec : SETS[tab].split(" ");
    p.innerHTML = `<div class="emjtabs">${tabs.map(k => `<button type="button" class="emjtab ${k === tab ? "on" : ""}" data-emjtab="${k}">${k}</button>`).join("")}</div>
      <div class="emjgrid">${list.map(e => `<button type="button" data-emj="${e}">${e}</button>`).join("")}</div>`;
  }

  function inject() {
    const f = $("chForm");
    if (!f || f.querySelector(".emjbtn")) return;
    f.insertAdjacentHTML("afterbegin", '<button type="button" class="emjbtn" aria-label="Emoji">😊</button>');
    const p = document.createElement("div");
    p.className = "emjp"; p.hidden = true;
    f.parentNode.insertBefore(p, f);
  }
  new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
  inject();

  function insertAtCursor(input, text) {
    const s = input.selectionStart == null ? input.value.length : input.selectionStart,
      e = input.selectionEnd == null ? s : input.selectionEnd;
    if (input.value.length + text.length > (input.maxLength > 0 ? input.maxLength : 1000)) return;
    input.value = input.value.slice(0, s) + text + input.value.slice(e);
    input.selectionStart = input.selectionEnd = s + text.length;
  }

  // keep keyboard open on phones while tapping emojis
  document.addEventListener("mousedown", e => { if (e.target.closest(".emjp,.emjbtn")) e.preventDefault(); });

  document.addEventListener("click", e => {
    const t = e.target, p = document.querySelector(".emjp");
    let el;
    if ((el = t.closest(".emjbtn")) && p) {
      p.hidden = !p.hidden; el.classList.toggle("on", !p.hidden);
      if (!p.hidden) paint(p);
      return;
    }
    if ((el = t.closest("[data-emjtab]")) && p) { tab = el.dataset.emjtab; paint(p); return; }
    if ((el = t.closest("[data-emj]"))) {
      const i = $("chIn"); if (!i) return;
      insertAtCursor(i, el.dataset.emj);
      save([el.dataset.emj].concat(load().filter(x => x !== el.dataset.emj)));
      return;
    }
    // tap anywhere outside closes the panel
    if (p && !p.hidden && !t.closest(".emjp,.emjbtn")) {
      p.hidden = true; const b = document.querySelector(".emjbtn"); if (b) b.classList.remove("on");
    }
  });
})();
