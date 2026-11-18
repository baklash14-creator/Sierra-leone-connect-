/* SL Connect - shows the Monime USSD code when the user presses Pay.
   Must be loaded BEFORE the Supabase script (right after config.js). */
(function () {
  var origFetch = window.fetch;

  function getHeader(init, input, name) {
    var h = (init && init.headers) || (input && input.headers) || null;
    if (!h) return null;
    if (typeof h.get === "function") return h.get(name);
    for (var k in h) if (k.toLowerCase() === name.toLowerCase()) return h[k];
    return null;
  }

  function closeBox() {
    var o = document.getElementById("ussdBox");
    if (o) o.remove();
  }

  function showBox(data, fnBase, auth, apikey) {
    closeBox();
    var code = data.ussdCode;
    var o = document.createElement("div");
    o.id = "ussdBox";
    o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif";
    o.innerHTML =
      '<div style="background:#fff;color:#111;border-radius:16px;max-width:360px;width:100%;padding:22px;text-align:center">' +
      '<h3 style="margin:0 0 6px">Pay Le ' + (data.amount || 30) + ' with Orange Money</h3>' +
      '<p style="margin:0 0 14px;font-size:14px;color:#444">Dial this code on your phone, then follow the steps to pay.</p>' +
      '<div id="ussdCodeText" style="font-size:26px;font-weight:700;letter-spacing:1px;background:#f1f5f1;border-radius:10px;padding:14px;word-break:break-all"></div>' +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
      '<button id="ussdCopy" style="flex:1;padding:12px;border:0;border-radius:10px;background:#1eb53a;color:#fff;font-weight:600">Copy</button>' +
      '<a id="ussdDial" style="flex:1;padding:12px;border-radius:10px;background:#0072c6;color:#fff;font-weight:600;text-decoration:none">Dial now</a>' +
      '</div>' +
      '<p id="ussdStatus" style="margin:14px 0 0;font-size:14px;color:#444">Waiting for payment...</p>' +
      '<button id="ussdClose" style="margin-top:10px;border:0;background:none;color:#666;text-decoration:underline">Close</button>' +
      '</div>';
    document.body.appendChild(o);
    document.getElementById("ussdCodeText").textContent = code;
    document.getElementById("ussdDial").href = "tel:" + code.replace(/#/g, "%23");
    document.getElementById("ussdCopy").onclick = function () {
      try { navigator.clipboard.writeText(code); this.textContent = "Copied"; } catch (e) {}
    };
    var timer;
    document.getElementById("ussdClose").onclick = function () { clearInterval(timer); closeBox(); };

    var stopAt = Date.now() + 15 * 60 * 1000;
    var status = document.getElementById("ussdStatus");
    timer = setInterval(function () {
      if (!document.getElementById("ussdBox")) { clearInterval(timer); return; }
      if (Date.now() > stopAt) {
        clearInterval(timer);
        status.textContent = "This code expired. Close this and press Pay again.";
        return;
      }
      var headers = { "Content-Type": "application/json" };
      if (auth) headers["Authorization"] = auth;
      if (apikey) headers["apikey"] = apikey;
      origFetch(fnBase + "/verify-payment", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ payment_id: data.payment_id }),
      })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          if (r.status === "successful") {
            clearInterval(timer);
            status.textContent = "Payment received. You are verified!";
            setTimeout(function () { location.reload(); }, 2000);
          } else if (r.status === "failed") {
            clearInterval(timer);
            status.textContent = "Payment failed or expired. Close this and try again.";
          }
        })
        .catch(function () {});
    }, 4000);
  }

  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var p = origFetch.apply(this, arguments);
    if (url.indexOf("/functions/v1/verify-checkout") === -1) return p;
    return p.then(function (res) {
      if (!res.ok) return res;
      return res.clone().json().then(function (data) {
        if (!data || !data.ussdCode) return res;
        var fnBase = url.split("/verify-checkout")[0];
        showBox(data, fnBase, getHeader(init, input, "authorization"), getHeader(init, input, "apikey"));
        // Tell the old app code "ok" so it does not show an error.
        return new Response(JSON.stringify({ url: "#" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }).catch(function () { return res; });
    });
  };
})();
