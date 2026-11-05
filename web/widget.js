/*! Exchange Rates widget: Bank of Tanzania daily rates for any website.
 * <script src=".../widget.js" data-currencies="USD,EUR,GBP" data-buy-margin="1" data-sell-margin="1"
 *         data-theme="paper|plain|dark" data-title="Exchange rates" data-target="#rates"></script>
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var BASE = script ? new URL(".", script.src).href : "";

  var THEMES = {
    paper: { bg: "#F6F4EA", fg: "#2C3837", muted: "#626A66", line: "rgba(44,56,55,.1)", edge: "rgba(44,56,55,.12)", accent: "#B4471F", stamp: "#E0643B" },
    plain: { bg: "#FFFFFF", fg: "#1F2726", muted: "#646B68", line: "rgba(0,0,0,.08)", edge: "rgba(0,0,0,.1)", accent: "#B4471F", stamp: "#E0643B" },
    dark:  { bg: "#253030", fg: "#ECEADB", muted: "#959B94", line: "rgba(236,234,219,.09)", edge: "rgba(236,234,219,.12)", accent: "#F08A62", stamp: "#E8784F" }
  };
  THEMES.soft = THEMES.paper; THEMES.light = THEMES.plain; THEMES.board = THEMES.dark;  // names used by earlier snippets
  var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  function fmt(n) {
    if (n == null || isNaN(n)) return "–";
    var d = n >= 100 ? 2 : n >= 1 ? 3 : 4;
    return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function stampDate(iso) {
    var d = new Date(iso + "T00:00:00");
    return ("0" + d.getDate()).slice(-2) + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function render(host, opts, data) {
    var t = THEMES[opts.theme] || THEMES.paper;
    var root = host.shadowRoot || host.attachShadow({ mode: "open" });
    var buyM = Math.max(0, +opts.buyMargin || 0), sellM = Math.max(0, +opts.sellMargin || 0);
    var custom = buyM > 0 || sellM > 0;
    var wanted = (opts.currencies || "USD,EUR,GBP,KES").toUpperCase().split(/[\s,]+/).filter(Boolean);
    var byCode = {};
    data.rates.forEach(function (r) { byCode[r.code] = r; });
    var mono = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

    var rows = wanted.filter(function (c) { return byCode[c]; }).map(function (c) {
      var r = byCode[c];
      var buy = r.buying != null ? r.buying * (1 - buyM / 100) : null;
      var sell = r.selling != null ? r.selling * (1 + sellM / 100) : null;
      var f = r.flag ? '<img class="fl" src="' + esc(r.flag) + '" alt="" width="28" height="28">' : "";
      return '<tr><th scope="row">' + f + '<span><span class="c">' + esc(c) + '</span><span class="n">' + esc(r.name) + "</span></span></th><td>" + fmt(buy) + "</td><td>" + fmt(sell) + "</td></tr>";
    }).join("");

    root.innerHTML =
      "<style>" +
      ":host{display:block;max-width:440px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}" +
      ".w{background:" + t.bg + ";color:" + t.fg + ";border:1px solid " + t.edge + ";border-radius:16px;padding:20px 20px 16px}" +
      ".h{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 12px}" +
      ".t{margin:0;font-weight:600;font-size:16px}" +
      ".d{padding:2px 8px;border:1.5px solid " + t.stamp + ";border-radius:6px;color:" + t.accent + ";font:500 11px/16px " + mono + ";letter-spacing:.04em;white-space:nowrap;transform:rotate(-2deg)}" +
      "table{width:100%;border-collapse:collapse}" +
      "thead th{height:28px;font:400 11px " + mono + ";color:" + t.muted + ";text-align:right}" +
      "thead th:first-child{text-align:left}" +
      "tbody th{padding:10px 0;text-align:left;font-weight:400;border-top:1px solid " + t.line + "}" +
      "tbody th{display:flex;align-items:center;gap:10px}.fl{width:28px;height:28px;border-radius:50%;flex:none}" +
      ".c{display:block;font:500 14px " + mono + "}.n{display:block;margin-top:2px;font-size:12px;color:" + t.muted + "}" +
      "td{padding:10px 0 10px 12px;text-align:right;border-top:1px solid " + t.line + ";font:400 15px " + mono + ";font-variant-numeric:tabular-nums}" +
      ".f{margin:12px 0 0;font-size:11px;line-height:16px;color:" + t.muted + "}.f a{color:inherit}" +
      "</style>" +
      '<div class="w" part="widget"><div class="h"><p class="t">' + esc(opts.title || "Exchange rates") +
      '</p><span class="d" title="Bank of Tanzania rate date">BOT · ' + stampDate(data.date) + "</span></div>" +
      "<table><thead><tr><th>TZS per 1</th><th>" + (custom ? "We buy" : "Buying") + "</th><th>" + (custom ? "We sell" : "Selling") +
      "</th></tr></thead><tbody>" + (rows || '<tr><td colspan="3">No matching currencies</td></tr>') + "</tbody></table>" +
      '<p class="f">' + (custom ? "Our prices, based on " : "") + 'Bank of Tanzania reference rates published at <a href="https://www.bot.go.tz/ExchangeRate/excRates?lang=en" target="_blank" rel="noopener">bot.go.tz</a></p></div>';
  }

  function renderError(host) {
    var root = host.shadowRoot || host.attachShadow({ mode: "open" });
    root.innerHTML = '<p style="font:14px system-ui;color:#626A66">Exchange rates are unavailable right now. Check again later</p>';
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
    var opts = { currencies: ds.currencies, buyMargin: ds.buyMargin, sellMargin: ds.sellMargin, theme: ds.theme || "paper", title: ds.title };
    load().then(function (data) { render(host, opts, data); }, function () { renderError(host); });
  }
})();
