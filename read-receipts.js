/* SL Connect - Message Read Receipts
   Load AFTER app.js and chat.js.
   Uses the existing messages.read_at field.
   Uses the existing mark_read RPC from chat.js.
*/

(function () {
  "use strict";

  if (typeof CLOUD === "undefined" || !CLOUD) {
    console.warn("Read receipts: cloud backend is unavailable.");
    return;
  }

  const client = typeof sb !== "undefined" ? sb : window.sb;

  if (!client) {
    console.warn("Read receipts: Supabase client not found.");
    return;
  }

  const STYLE = document.createElement("style");

  STYLE.textContent = `
    .rr-status {
      display: inline-block;
      margin-left: 8px;
      font-size: 11px;
      white-space: nowrap;
      opacity: .75;
    }

    .rr-status.read {
      color: #2196f3;
      opacity: 1;
      font-weight: 600;
    }
  `;

  document.head.appendChild(STYLE);

  let channel = null;
  let activeConversation = null;
  let refreshTimer = null;
  let refreshing = false;

  function currentUser() {
    return typeof user !== "undefined" ? user : window.user;
  }

  function currentConversation() {
    return window.slc && typeof window.slc.conv === "function"
      ? window.slc.conv()
      : null;
  }

  function getMessagesContainer() {
    return document.getElementById("chMsgs");
  }

  function removeChannel() {
    if (channel) {
      try {
        client.removeChannel(channel);
      } catch (error) {
        console.warn("Read receipts: channel cleanup failed.", error);
      }

      channel = null;
    }
  }

  // Display one tick for sent messages and two blue ticks for read messages.
  function updateStatus(element, message) {
    if (!element || !message) return;

    if (message.sender !== currentUser()?.id) return;

    let status = element.querySelector(".rr-status");

    if (!status) {
      status = document.createElement("small");
      status.className = "rr-status";

      const time = element.querySelector("time");

      if (time) {
        time.insertAdjacentElement("afterend", status);
      } else {
        element.appendChild(status);
      }
    }

    if (message.read_at) {
      status.textContent = "✓✓ Read";
      status.classList.add("read");
    } else {
      status.textContent = "✓ Sent";
      status.classList.remove("read");
    }
  }

  // Match the displayed messages to their database records.
  async function refreshReceipts() {
    if (refreshing) return;

    const me = currentUser();
    const conversation = currentConversation();
    const container = getMessagesContainer();

    if (!me || !conversation || !container) return;

    refreshing = true;

    try {
      const { data, error } = await client
        .from("messages")
        .select("id, conv_id, sender, created_at, read_at")
        .eq("conv_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;

      const rows = data || [];
      const elements = Array.from(
        container.querySelectorAll(".chb")
      );

      // Match the latest displayed messages to the latest database records.
      const visibleRows = rows.slice(-elements.length);
      const visibleElements = elements.slice(-visibleRows.length);

      visibleElements.forEach((element, index) => {
        updateStatus(element, visibleRows[index]);
      });

    } catch (error) {
      console.error("Read receipts could not refresh:", error);
    } finally {
      refreshing = false;
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);

    refreshTimer = setTimeout(() => {
      refreshReceipts();
    }, 250);
  }

  // Listen for changes to read_at in the current conversation.
  function subscribe(conversationId) {
    if (activeConversation === conversationId && channel) return;

    removeChannel();

    activeConversation = conversationId;

    channel = client
      .channel("slc-read-receipts-" + conversationId)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: "conv_id=eq." + conversationId
        },
        payload => {
          if (payload.new && payload.new.read_at) {
            scheduleRefresh();
          }
        }
      )
      .subscribe(status => {
        if (status === "CHANNEL_ERROR") {
          console.error("Read receipts: realtime subscription failed.");
        }
      });
  }

  function checkConversation() {
    const me = currentUser();
    const conversation = currentConversation();

    if (!me || !conversation) {
      removeChannel();
      activeConversation = null;
      return;
    }

    subscribe(conversation.id);
    scheduleRefresh();
  }

  // Detect when chat messages are added or the conversation changes.
  const observer = new MutationObserver(() => {
    checkConversation();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Refresh when the user returns to the app.
  window.addEventListener("focus", () => {
    checkConversation();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      checkConversation();
    }
  });

  // Start.
  checkConversation();

  console.log("SL Connect read receipts loaded.");
})();