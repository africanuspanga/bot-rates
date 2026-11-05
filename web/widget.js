/*! Kiwango rates widget: Bank of Tanzania daily rates for any website.
 * <script src=".../widget.js" data-currencies="USD,EUR,GBP" data-buy-margin="1" data-sell-margin="1"
 *         data-theme="board|light|dark" data-title="Today's exchange rates" data-target="#rates"></script>
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var BASE = script ? new URL(".", script.src).href : "";

  var THEMES = {
    board: { bg: "#0E3A33", edge: "#082A24", fg: "#F0C96A", muted: "#9CC7B8", line: "rgba(255,255,255,.08)" },
    light: { bg: "#FFFFFF", edge: "#DDE5E1", fg: "#10241F", muted: "#5B6E67", line: "#E4EBE7" },
    dark:  { bg: "#111C19", edge: "#24332E", fg: "#EAF2EE", muted: "#93A9A1", line: "#22312C" }
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
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }

  function render(host, opts, data) {
    var t = THEMES[opts.theme] || THEMES.board;
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
      return '<tr><th scope="row"><span class="c">' + esc(c) + '</span><span class="n">' + esc(r.name) +
        '</span></th><td>' + fmt(buy) + "</td><td>" + fmt(sell) + "</td></tr>";
    }).join("");

    root.innerHTML =
      "<style>" +
      ":host{display:block;max-width:460px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}" +
      ".w{background:" + t.bg + ";color:" + t.fg + ";border-radius:12px;padding:16px 18px 12px;box-shadow:inset 0 0 0 " + (opts.theme === "board" ? "5px " : "1px ") + t.edge + "}" +
      ".h{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin:0 0 8px}" +
      ".t{font-weight:700;font-size:16px;margin:0}.d{font:12px ui-monospace,Menlo,monospace;color:" + t.muted + "}" +
      "table{width:100%;border-collapse:collapse}" +
      "thead th{font:600 10px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:" + t.muted + ";text-align:right;padding:6px 0}" +
      "thead th:first-child{text-align:left}" +
      "tbody th{text-align:left;font-weight:400;padding:8px 0;border-top:1px solid " + t.line + "}" +
      ".c{display:block;font-weight:800;font-size:18px;letter-spacing:.03em}.n{display:block;font-size:11px;color:" + t.muted + "}" +
      "td{text-align:right;padding:8px 0 8px 12px;border-top:1px solid " + t.line + ";font:600 16px ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}" +
      ".f{margin:8px 0 0;font-size:10.5px;color:" + t.muted + "}.f a{color:inherit}" +
      "</style>" +
      '<div class="w" part="widget"><div class="h"><p class="t">' + esc(opts.title || "Today's exchange rates") +
      '</p><span class="d">' + niceDate(data.date) + "</span></div>" +
      "<table><thead><tr><th>TZS per 1</th><th>" + (custom ? "We buy" : "Buying") + "</th><th>" + (custom ? "We sell" : "Selling") +
      "</th></tr></thead><tbody>" + (rows || '<tr><td colspan="3">No matching currencies.</td></tr>') + "</tbody></table>" +
      '<p class="f">' + (custom ? "Based on " : "") + 'Bank of Tanzania indicative rates · <a href="https://www.bot.go.tz/ExchangeRate/excRates?lang=en" target="_blank" rel="noopener">bot.go.tz</a></p></div>';
  }

  function renderError(host) {
    var root = host.shadowRoot || host.attachShadow({ mode: "open" });
    root.innerHTML = '<p style="font:14px system-ui;color:#5B6E67">Exchange rates are unavailable right now. Please check again later.</p>';
  }

  var cache = null;
  function load(base) {
    if (!cache) cache = fetch((base || BASE) + "api/latest.json").then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
    return cache;
  }

  window.KiwangoWidget = { render: render, load: load, base: BASE };

  if (script && !script.hasAttribute("data-manual")) {
    var ds = script.dataset;
    var host = ds.target ? document.querySelector(ds.target) : null;
    if (!host) { host = document.createElement("div"); script.parentNode.insertBefore(host, script.nextSibling); }
    var opts = { currencies: ds.currencies, buyMargin: ds.buyMargin, sellMargin: ds.sellMargin, theme: ds.theme || "board", title: ds.title };
    load().then(function (data) { render(host, opts, data); }, function () { renderError(host); });
  }
})();
