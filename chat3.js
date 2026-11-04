/* SL Connect - chat phone fixes.
   1. Keeps the open chat exactly the size of the visible screen, so the keyboard
      never covers the message box (works on iPhone and Android).
   2. Adds a "jump to latest" button with a count of new messages below.
   Load AFTER chat.js and chat2.js. No database changes needed. */
(function () {
  "use strict";
  const thread = document.getElementById("chThread");
  if (!thread) return;                      // chat is not on (no cloud backend)

  const root = document.documentElement;
  const vv = window.visualViewport;

  /* ---------- 1. keyboard-safe height ---------- */
  function syncViewport() {
    const box = document.getElementById("chMsgs");
    const wasNearBottom = box ? box.scrollHeight - box.scrollTop - box.clientHeight < 140 : false;
    const h = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    root.style.setProperty("--vvh", Math.round(h) + "px");
    root.style.setProperty("--vvt", Math.round(top) + "px");
    if (box && wasNearBottom) box.scrollTop = box.scrollHeight;
  }
  syncViewport();
  if (vv) {
    vv.addEventListener("resize", syncViewport);
    vv.addEventListener("scroll", syncViewport);
  }
  addEventListener("resize", syncViewport);
  addEventListener("orientationchange", () => setTimeout(syncViewport, 250));

  // when the box is tapped, make sure the latest message stays in view
  document.addEventListener("focusin", e => {
    if (e.target.id !== "chIn") return;
    setTimeout(() => {
      syncViewport();
      const box = document.getElementById("chMsgs");
      if (box) box.scrollTop = box.scrollHeight;
    }, 300);
  });

  /* ---------- 2. jump to latest ---------- */
  let unseen = 0, btn = null;

  const nearBottom = box => box.scrollHeight - box.scrollTop - box.clientHeight < 120;

  function paint() {
    if (!btn) return;
    const box = document.getElementById("chMsgs");
    const far = !!box && !nearBottom(box);
    btn.classList.toggle("on", far);
    const n = btn.querySelector("i");
    n.textContent = far && unseen ? (unseen > 9 ? "9+" : unseen) : "";
    if (!far) unseen = 0;
  }

  function attach() {
    const box = document.getElementById("chMsgs");
    if (!box) { btn = null; unseen = 0; return; }
    if (!box.dataset.jump) {
      box.dataset.jump = "1";
      box.addEventListener("scroll", paint, { passive: true });
    }
    if (!thread.querySelector(".chdown")) {
      thread.insertAdjacentHTML("beforeend",
        '<button type="button" class="chdown" aria-label="Jump to latest message">⬇<i></i></button>');
    }
    btn = thread.querySelector(".chdown");
    paint();
  }

  // chat.js calls this when a message arrives while the reader is scrolled up
  window.slcNewBelow = () => { unseen++; paint(); };

  document.addEventListener("click", e => {
    if (!e.target.closest(".chdown")) return;
    const box = document.getElementById("chMsgs");
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    unseen = 0;
    paint();
  });

  /* ---------- 3. call button always sits right next to the mic ---------- */
  function placeCall() {
    const f = document.getElementById("chForm");
    const mic = f && f.querySelector(".vmmic");
    if (!mic) return;                                   // mic not added yet; try again on next change
    let c = document.getElementById("callBtnVoice");
    if (c && mic.nextElementSibling === c) return;      // already in the right place
    if (!c) {
      c = document.createElement("button");
      c.type = "button";
      c.id = "callBtnVoice";
      c.className = "vmmic callbtn";
      c.setAttribute("aria-label", "Choose voice or video call");
      c.title = "Voice or video call";
      c.textContent = "📞";
    }
    mic.insertAdjacentElement("afterend", c);
  }

  // the chat panel is rebuilt each time a conversation opens; the mic is added a moment later
  let queued = false;
  function refresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; attach(); placeCall(); });
  }
  new MutationObserver(refresh).observe(thread, { childList: true, subtree: true });
  attach();
  placeCall();
})();
