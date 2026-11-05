/*! Exchange Rates widget: Bank of Tanzania daily rates for any website.
 * <script src=".../widget.js" data-currencies="USD,EUR,GBP" data-buy-margin="1" data-sell-margin="1"
 *         data-theme="soft|dark|board" data-title="Today's exchange rates" data-target="#rates"></script>
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var BASE = script ? new URL(".", script.src).href : "";

  var THEMES = {
    soft:  { bg: "#FFFFFF", card: "#F6F7FB", fg: "#111827", muted: "#8B91A3", line: "#EEF0F5", accent: "#4562F5", tint: "#E8ECFF", shadow: "0 1px 2px rgba(17,24,39,.05),0 18px 40px -20px rgba(54,81,240,.25)", radius: 24 },
    dark:  { bg: "#141830", card: "#1B2040", fg: "#EEF0F8", muted: "#7D84A0", line: "#232946", accent: "#7F98FF", tint: "#232B5C", shadow: "0 18px 40px -20px rgba(0,0,0,.6)", radius: 24 },
    board: { bg: "#0E3A33", card: "#134A41", fg: "#F0C96A", muted: "#9CC7B8", line: "rgba(255,255,255,.08)", accent: "#F0C96A", tint: "#134A41", shadow: "inset 0 0 0 5px #082A24", radius: 14 }
  };

  function fmt(n) {
    if (n == null || isNaN(n)) return "–";
    var d = n >= 100 ? 2 : n >= 1 ? 3 : 4;
    return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function niceDate(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }

  function render(host, opts, data) {
    var t = THEMES[opts.theme] || THEMES.soft;
    var root = host.shadowRoot || host.attachShadow({ mode: "open" });
    var buyM = Math.max(0, +opts.buyMargin || 0), sellM = Math.max(0, +opts.sellMargin || 0);
    var custom = buyM > 0 || sellM > 0;
    var wanted = (opts.currencies || "USD,EUR,GBP,KES").toUpperCase().split(/[\s,]+/).filter(Boolean);
    var byCode = {};
    data.rates.forEach(function (r) { byCode[r.code] = r; });

    var rows = wanted.filter(function (c) { return byCode[c]; }).map(function (c) {
      var r = byCode[c];
      var buy = r.buying != null ? r.buying * (1 - buyM / 100) : null;
      var sell = r.selling != null ? r.selling * (1 + sellM / 100) : null;
      return '<tr><th scope="row"><span class="b">' + esc(c) + '</span><span><span class="c">' + esc(c) + '</span><span class="n">' + esc(r.name) +
        "</span></span></th><td>" + fmt(buy) + "</td><td>" + fmt(sell) + "</td></tr>";
    }).join("");

    root.innerHTML =
      "<style>" +
      ":host{display:block;max-width:460px;font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif}" +
      ".w{background:" + t.bg + ";color:" + t.fg + ";border-radius:" + t.radius + "px;padding:20px 20px 14px;box-shadow:" + t.shadow + "}" +
      ".h{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 0 10px}" +
      ".t{font-weight:800;font-size:17px;letter-spacing:-.01em;margin:0}" +
      ".d{font-size:12px;font-weight:700;color:" + t.accent + ";background:" + t.tint + ";padding:5px 9px;border-radius:9px;white-space:nowrap}" +
      "table{width:100%;border-collapse:collapse}" +
      "thead th{font-size:11.5px;font-weight:700;color:" + t.muted + ";text-align:right;padding:6px 0}" +
      "thead th:first-child{text-align:left}" +
      "tbody th{text-align:left;font-weight:400;padding:10px 0;border-top:1px solid " + t.line + "}" +
      "tbody th{display:flex;align-items:center;gap:10px}" +
      ".b{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:" + t.tint + ";color:" + t.accent + ";font-weight:800;font-size:10.5px;flex:none}" +
      ".c{display:block;font-weight:800;font-size:15px}.n{display:block;font-size:12px;color:" + t.muted + "}" +
      "td{text-align:right;padding:10px 0 10px 12px;border-top:1px solid " + t.line + ";font-weight:700;font-size:16px;font-variant-numeric:tabular-nums}" +
      ".f{margin:10px 0 0;font-size:11px;color:" + t.muted + "}.f a{color:inherit}" +
      "</style>" +
      '<div class="w" part="widget"><div class="h"><p class="t">' + esc(opts.title || "Today's exchange rates") +
      '</p><span class="d">' + niceDate(data.date) + "</span></div>" +
      "<table><thead><tr><th>TZS per 1</th><th>" + (custom ? "We buy" : "Buying") + "</th><th>" + (custom ? "We sell" : "Selling") +
      "</th></tr></thead><tbody>" + (rows || '<tr><td colspan="3">No matching currencies.</td></tr>') + "</tbody></table>" +
      '<p class="f">' + (custom ? "Based on " : "") + 'Bank of Tanzania reference rates · <a href="https://www.bot.go.tz/ExchangeRate/excRates?lang=en" target="_blank" rel="noopener">bot.go.tz</a></p></div>';
  }

  function renderError(host) {
    var root = host.shadowRoot || host.attachShadow({ mode: "open" });
    root.innerHTML = '<p style="font:14px system-ui;color:#8B91A3">Exchange rates are unavailable right now. Please check again later.</p>';
  }

  var cache = null;
  function load(base) {
    if (!cache) cache = fetch((base || BASE) + "api/latest.json").then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
    return cache;
  }

  window.ExchangeRatesWidget = window.KiwangoWidget = { render: render, load: load, base: BASE };

  if (script && !script.hasAttribute("data-manual")) {
    var ds = script.dataset;
    var host = ds.target ? document.querySelector(ds.target) : null;
    if (!host) { host = document.createElement("div"); script.parentNode.insertBefore(host, script.nextSibling); }
    var opts = { currencies: ds.currencies, buyMargin: ds.buyMargin, sellMargin: ds.sellMargin, theme: ds.theme || "soft", title: ds.title };
    load().then(function (data) { render(host, opts, data); }, function () { renderError(host); });
  }
})();
