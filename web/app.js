(function () {
  "use strict";
  var BASE = new URL(".", location.href.split("#")[0]).href;
  var BOARD = ["USD", "EUR", "GBP", "KES", "UGX", "AED", "CNY", "ZAR"];
  var WIDGET_DEFAULT = ["USD", "EUR", "GBP", "KES"];
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (id) { return document.getElementById(id); };
  var latest, selected = "USD", rangeDays = 365, seriesCache = {}, yearCache = {};

  function fmt(n) {
    if (n == null || isNaN(n)) return "–";
    var d = n >= 100 ? 2 : n >= 1 ? 3 : 4;
    return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function niceDate(iso, long) {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB",
      long ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 1600);
  }
  function copy(text, what) {
    navigator.clipboard.writeText(text).then(function () { toast((what || "Text") + " copied"); },
      function () { toast("Copy failed. Select the text and copy it manually."); });
  }

  /* ---------- Board ---------- */
  function flaps(text, delay) {
    return '<span class="flaps" aria-label="' + text + '">' + text.split("").map(function (ch, i) {
      var sep = ch === "," || ch === ".";
      return '<span class="flap' + (sep ? " sep" : "") + '" aria-hidden="true" style="--d:' + (delay + i * 28) + 'ms">' + ch + "</span>";
    }).join("") + "</span>";
  }
  function renderBoard() {
    var by = {}; latest.rates.forEach(function (r) { by[r.code] = r; });
    $("board-date").textContent = niceDate(latest.date, true);
    $("board-rows").innerHTML = BOARD.filter(function (c) { return by[c]; }).map(function (c, i) {
      var r = by[c], d = reduceMotion ? 0 : i * 90;
      return '<li class="board-row"><span><span class="board-code">' + c + '</span><span class="board-name">' + esc(r.name) +
        "</span></span>" + flaps(fmt(r.buying), d) + flaps(fmt(r.selling), d + 140) + "</li>";
    }).join("");
  }

  /* ---------- Table ---------- */
  function renderTable() {
    var q = $("search").value.trim().toLowerCase();
    var rows = latest.rates.filter(function (r) {
      return !q || r.code.toLowerCase().indexOf(q) > -1 || r.name.toLowerCase().indexOf(q) > -1;
    });
    $("rates-body").innerHTML = rows.length ? rows.map(function (r) {
      var ch = r.change, cls = ch > 0 ? "up" : ch < 0 ? "down" : "flat";
      var pct = ch && r.mean ? (ch / (r.mean - ch)) * 100 : 0;
      var chTxt = ch == null ? "–" : ch === 0 ? "No change" : (ch > 0 ? "▲ " : "▼ ") + fmt(Math.abs(ch)) + " (" + Math.abs(pct).toFixed(2) + "%)";
      return '<tr tabindex="0" data-code="' + r.code + '" aria-selected="' + (r.code === selected) + '">' +
        '<td class="code">' + r.code + "</td><td>" + esc(r.name) + '</td><td class="n">' + fmt(r.buying) +
        '</td><td class="n">' + fmt(r.selling) + '</td><td class="n">' + fmt(r.mean) + '</td><td class="n ' + cls + '">' + chTxt + "</td></tr>";
    }).join("") : '<tr><td colspan="6" class="empty">No currency matches “' + esc(q) + "”. Try a code like USD or a name like euro.</td></tr>";
  }
  function selectCurrency(code, scroll) {
    selected = code;
    document.querySelectorAll("#rates-body tr[data-code]").forEach(function (tr) { tr.setAttribute("aria-selected", tr.dataset.code === code); });
    loadSeries(code);
    updateLookup();
    if (scroll) $("history").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }

  /* ---------- History chart ---------- */
  function loadSeries(code) {
    var r = latest.rates.find(function (x) { return x.code === code; });
    $("hist-title").textContent = (r ? r.name : code) + " history";
    if (!seriesCache[code]) seriesCache[code] = fetch(BASE + "api/currency/" + code + ".json").then(function (x) { return x.json(); });
    seriesCache[code].then(function (s) { if (selected === code) drawChart(s.rates); },
      function () { $("chart").innerHTML = '<p class="sub">Could not load history. Check your connection and reload.</p>'; });
  }
  function drawChart(all) {
    var rows = rangeDays ? all.slice(-rangeDays) : all;
    var step = Math.max(1, Math.floor(rows.length / 700));
    var pts = rows.filter(function (_, i) { return i % step === 0 || i === rows.length - 1; });
    var el = $("chart"), W = el.clientWidth || 800, H = el.clientHeight || 320, padL = 64, padB = 26, padT = 8;
    var lo = Infinity, hi = -Infinity;
    pts.forEach(function (p) { [p[1], p[2], p[3]].forEach(function (v) { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); });
    var pad = (hi - lo) * 0.08 || hi * 0.01; lo -= pad; hi += pad;
    var x = function (i) { return padL + (i / Math.max(1, pts.length - 1)) * (W - padL - 4); };
    var y = function (v) { return padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB); };

    var band = pts.map(function (p, i) { return x(i) + "," + y(p[3] != null ? p[3] : p[2]); })
      .concat(pts.slice().reverse().map(function (p, j) { return x(pts.length - 1 - j) + "," + y(p[1] != null ? p[1] : p[3]); })).join(" ");
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p[3]).toFixed(1); }).join("");

    var grid = "", ticks = 4;
    for (var k = 0; k <= ticks; k++) {
      var v = lo + (hi - lo) * k / ticks, yy = y(v);
      grid += '<line class="grid" x1="' + padL + '" x2="' + W + '" y1="' + yy + '" y2="' + yy + '"/><text class="axis" x="' + (padL - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + fmt(v) + "</text>";
    }
    var xl = "", n = Math.min(W < 520 ? 3 : 6, pts.length);
    for (var j = 0; j < n; j++) {
      var idx = Math.round(j * (pts.length - 1) / Math.max(1, n - 1)), d = pts[idx][0];
      var label = rangeDays && rangeDays <= 365 ? niceDate(d).replace(/^\d+ /, "") : d.slice(0, 4);
      xl += '<text class="axis" x="' + x(idx) + '" y="' + (H - 6) + '" text-anchor="' + (j === 0 ? "start" : j === n - 1 ? "end" : "middle") + '">' + label + "</text>";
    }
    el.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' + grid + '<polygon class="band" points="' + band +
      '"/><path class="line" d="' + line + '"/>' + xl + '<line class="cursor" id="cur" y1="' + padT + '" y2="' + (H - padB) + '" visibility="hidden"/><circle class="dot" id="dot" r="4" visibility="hidden"/></svg>';

    var first = rows[0], last = rows[rows.length - 1], chg = last[3] - first[3];
    var means = rows.map(function (r) { return r[3]; });
    $("hist-stats").innerHTML =
      stat(fmt(last[3]), "Mean on " + niceDate(last[0])) +
      stat((chg >= 0 ? "+" : "−") + fmt(Math.abs(chg)) + " (" + (chg / first[3] * 100).toFixed(1) + "%)", "Change since " + niceDate(first[0])) +
      stat(fmt(Math.min.apply(null, means)) + " – " + fmt(Math.max.apply(null, means)), "Low – high");
    $("hist-sub").textContent = "Mean rate in TZS per 1 " + selected + ". Shaded band is BOT buying to selling.";

    var svg = el.querySelector("svg"), tip = $("tip");
    function move(e) {
      var rect = svg.getBoundingClientRect(), px = (e.clientX - rect.left) * W / rect.width;
      var i = Math.max(0, Math.min(pts.length - 1, Math.round((px - padL) / (W - padL - 4) * (pts.length - 1))));
      var p = pts[i], cx = x(i), cy = y(p[3]);
      var cur = svg.getElementById("cur"), dot = svg.getElementById("dot");
      cur.setAttribute("x1", cx); cur.setAttribute("x2", cx); cur.setAttribute("visibility", "visible");
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.style.left = (svg.parentNode.offsetLeft + cx * rect.width / W) + "px";
      tip.style.top = (svg.parentNode.offsetTop + cy * rect.height / H) + "px";
      tip.innerHTML = "<b>" + niceDate(p[0]) + "</b><br>Buy " + fmt(p[1]) + " · Sell " + fmt(p[2]) + "<br>Mean " + fmt(p[3]);
    }
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerleave", function () {
      tip.hidden = true; svg.getElementById("cur").setAttribute("visibility", "hidden"); svg.getElementById("dot").setAttribute("visibility", "hidden");
    });
  }
  function stat(v, l) { return '<div class="stat"><b>' + v + "</b><span>" + l + "</span></div>"; }

  /* ---------- Date lookup ---------- */
  function updateLookup() {
    var v = $("lookup-date").value, out = $("lookup-out");
    if (!v) return;
    var yr = v.slice(0, 4);
    if (!yearCache[yr]) yearCache[yr] = fetch(BASE + "api/history/" + yr + ".json").then(function (r) { if (!r.ok) throw 0; return r.json(); });
    out.textContent = "Loading…";
    yearCache[yr].then(function (h) {
      var days = Object.keys(h.rates).filter(function (d) { return d <= v; }).sort();
      var d = days[days.length - 1], r = d && h.rates[d][selected];
      out.innerHTML = r ? "<b>" + selected + " on " + niceDate(d) + "</b>: buying " + fmt(r[0]) + " · selling " + fmt(r[1]) + " · mean " + fmt(r[2]) +
        (d !== v ? " (closest earlier BOT date)" : "") : "BOT has no " + selected + " rate on or just before " + niceDate(v) + ".";
    }, function () { out.textContent = "No BOT data for " + yr + ". Pick a date from 24 June 1999 to today."; });
  }

  /* ---------- API ---------- */
  var ENDPOINTS = [
    ["Today’s rates", "All currencies, JSON", "api/latest.json"],
    ["Today’s rates", "Spreadsheet-friendly CSV", "api/latest.csv"],
    ["One currency, all history", "Swap USD for any code", "api/currency/USD.json"],
    ["One year, all currencies", "1999 to this year, JSON or .csv", "api/history/" + new Date().getFullYear() + ".json"],
    ["Currency list", "Codes, names, date coverage", "api/currencies.json"],
    ["Website widget", "One script tag, see below", "widget.js"]
  ];
  function renderEndpoints() {
    $("endpoints").innerHTML = ENDPOINTS.map(function (e) {
      var url = BASE + e[2];
      return '<li class="endpoint"><span class="what">' + e[0] + "<small>" + e[1] + "</small></span><code>" + esc(url) +
        '</code><button class="copy" data-copy="' + esc(url) + '">Copy</button><a class="open" href="' + esc(url) + '" target="_blank" rel="noopener">Open</a></li>';
    }).join("");
  }
  function examples() {
    var u = BASE + "api/latest.json";
    var sample = latest ? JSON.stringify({ source: latest.source, base: "TZS", date: latest.date, previous_date: latest.previous_date,
      rates: latest.rates.filter(function (r) { return r.code === "USD" || r.code === "EUR"; }) }, null, 2).replace(/\n {6}/g, " ").replace(/\n {4}}/g, " }") : "";
    return {
      js: "const res = await fetch(\"" + u + "\");\nconst data = await res.json();\n\nconst usd = data.rates.find(r => r.code === \"USD\");\nconsole.log(`USD ${usd.buying} / ${usd.selling} on ${data.date}`);",
      php: "<?php\n// Cache for 1 hour so the page stays fast\n$data = get_transient('bot_rates');\nif (!$data) {\n  $data = json_decode(file_get_contents('" + u + "'), true);\n  set_transient('bot_rates', $data, HOUR_IN_SECONDS);\n}\nforeach ($data['rates'] as $r) {\n  if (in_array($r['code'], ['USD', 'EUR', 'GBP'])) {\n    echo \"{$r['code']}: {$r['buying']} / {$r['selling']}<br>\";\n  }\n}",
      curl: "curl -s " + u + "\n\n# One currency's full history\ncurl -s " + BASE + "api/currency/EUR.json\n\n# A whole year as CSV\ncurl -s -O " + BASE + "api/history/2024.csv",
      json: sample
    };
  }
  function showExample(lang) {
    document.querySelectorAll(".tabs button").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.lang === lang); });
    $("code-ex").textContent = examples()[lang];
  }

  /* ---------- Widget builder ---------- */
  function renderBuilderChips() {
    $("wcur").innerHTML = latest.rates.filter(function (r) { return r.code !== "GOLD" && r.code !== "SDR"; }).map(function (r) {
      return '<label class="chip" title="' + esc(r.name) + '"><input type="checkbox" value="' + r.code + '"' +
        (WIDGET_DEFAULT.indexOf(r.code) > -1 ? " checked" : "") + "><span>" + r.code + "</span></label>";
    }).join("");
  }
  function builderOpts() {
    var cur = [].map.call(document.querySelectorAll("#wcur input:checked"), function (i) { return i.value; });
    return { currencies: cur.join(","), buyMargin: $("wbuy").value, sellMargin: $("wsell").value, theme: $("wtheme").value, title: $("wtitle").value.trim() };
  }
  function updateBuilder() {
    var o = builderOpts();
    if (window.KiwangoWidget && latest) window.KiwangoWidget.render($("wpreview"), o, latest);
    var attrs = ['src="' + BASE + 'widget.js"', 'data-currencies="' + (o.currencies || "USD") + '"'];
    if (+o.buyMargin) attrs.push('data-buy-margin="' + o.buyMargin + '"');
    if (+o.sellMargin) attrs.push('data-sell-margin="' + o.sellMargin + '"');
    if (o.theme !== "board") attrs.push('data-theme="' + o.theme + '"');
    if (o.title && o.title !== "Today's exchange rates") attrs.push('data-title="' + esc(o.title) + '"');
    $("wsnippet").textContent = "<script " + attrs.join("\n        ") + "></" + "script>";
  }

  /* ---------- Wire up ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy],[data-copy-from]");
    if (b) copy(b.dataset.copy || $(b.dataset.copyFrom).textContent, b.dataset.copyFrom === "wsnippet" ? "Widget code" : b.dataset.copy ? "Link" : "Code");
    var tr = e.target.closest("#rates-body tr[data-code]");
    if (tr) selectCurrency(tr.dataset.code, true);
    var rb = e.target.closest("#ranges button");
    if (rb) {
      rangeDays = +rb.dataset.r;
      document.querySelectorAll("#ranges button").forEach(function (x) { x.setAttribute("aria-pressed", x === rb); });
      loadSeries(selected);
    }
    var tab = e.target.closest(".tabs button");
    if (tab) showExample(tab.dataset.lang);
  });
  $("rates-body").addEventListener("keydown", function (e) {
    var tr = e.target.closest("tr[data-code]");
    if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selectCurrency(tr.dataset.code, true); }
  });
  $("search").addEventListener("input", renderTable);
  $("lookup-date").addEventListener("change", updateLookup);
  $("wform").addEventListener("input", updateBuilder);
  var rz; addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { loadSeries(selected); }, 150); });

  renderEndpoints();
  showExample("js");
  fetch(BASE + "api/latest.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (data) {
    latest = data;
    $("lookup-date").max = data.date;
    $("rates-sub").textContent = data.rates.length + " currencies for " + niceDate(data.date, true) + ". Select one to see its history.";
    renderBoard(); renderTable(); loadSeries(selected); showExample("js"); renderBuilderChips(); updateBuilder();
  }, function () {
    $("board-date").textContent = "Unavailable";
    $("rates-body").innerHTML = '<tr><td colspan="6" class="empty">Today’s rates could not be loaded. Reload the page, or open the API link below.</td></tr>';
  });
})();
