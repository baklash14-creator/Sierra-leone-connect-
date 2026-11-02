document.addEventListener("click", e => {
  const t = e.target instanceof Element ? e.target : null;
  if (!t) return;

  // Handle voice/video menu choices
  const choice = t.closest("[data-call-choice]");
  if (choice) {
    e.preventDefault();
    e.stopImmediatePropagation();

    const type = choice.getAttribute("data-call-choice");
    closeCallMenu();
    startCall(type === "video");
    return;
  }

  // Handle the main call button BEFORE voice.js receives the click
  const callButton = t.closest("#callBtnVoice,.callbtn");

  if (callButton) {
    e.preventDefault();
    e.stopImmediatePropagation();

    if (callMenu && !callMenu.hidden) {
      closeCallMenu();
    } else {
      openCallMenu(callButton);
    }

    return;
  }

  // Close menu when clicking elsewhere
  if (callMenu && !callMenu.hidden && !t.closest("#callTypeMenu")) {
    closeCallMenu();
  }

  // Answer incoming call
  if (t.closest("[data-cacc]")) {
    e.preventDefault();
    answerCall();
    return;
  }

  // End or decline call
  if (t.closest("[data-cend]")) {
    e.preventDefault();
    finish(
      call && call.t0
        ? "Call ended"
        : call && call.role === "callee"
          ? "Declined"
          : "Cancelled",
      true
    );
    return;
  }

  // Mute microphone
  const m = t.closest("[data-cmute]");
  if (m && call && call.stream) {
    const off = m.classList.toggle("on");
    call.stream.getAudioTracks().forEach(a => {
      a.enabled = !off;
    });
    m.textContent = off ? "Unmute" : "Mute";
  }

  // Turn camera on or off
  const cm = t.closest("[data-ccam]");
  if (cm && call && call.stream) {
    const off = cm.classList.toggle("on");
    call.stream.getVideoTracks().forEach(v => {
      v.enabled = !off;
    });
    cm.textContent = off ? "Cam on" : "Cam off";
  }

}, true);
