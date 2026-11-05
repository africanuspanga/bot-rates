(function () {
  "use strict";
  var BASE = new URL(".", document.baseURI).href;
  var STATS = ["USD", "EUR", "GBP", "KES"];
  var POPULAR = ["USD", "EUR", "GBP", "KES", "UGX", "RWF", "ZAR", "AED", "CNY", "INR", "JPY", "CHF", "SAR", "BIF", "ZMW", "MWK"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var $ = function (id) { return document.getElementById(id); };
  var latest, byCode = {}, selected = "USD", rangeDays = 0, year = null, showAll = false, allYears = false;
  var cache = {};

  /* ---------- helpers ---------- */
  function getJSON(path) {
    if (!cache[path]) cache[path] = fetch(BASE + path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    return cache[path];
  }
  function series(code) { return getJSON("api/currency/" + code + ".json").then(function (s) { return s.rates; }); }
  function fmt(n, dp) {
    if (n == null || isNaN(n)) return "–";
    var d = dp != null ? dp : n >= 100 ? 2 : n >= 1 ? 3 : 4;
    return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function short(n) { return n >= 1000 ? fmt(n, 0) : fmt(n); }
  function pct(a, b) { return (b - a) / a * 100; }
  function signed(p, dp) { return (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p).toFixed(dp == null ? 2 : dp) + "%"; }
  function day(iso, withYear) {
    var d = new Date(iso + "T00:00:00");
    return d.getDate() + " " + MONTHS[d.getMonth()] + (withYear === false ? "" : " " + d.getFullYear());
  }
  function stampDate(iso) { var d = new Date(iso + "T00:00:00"); return ("0" + d.getDate()).slice(-2) + " " + MONTHS[d.getMonth()].toUpperCase() + " " + d.getFullYear(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function flag(r) { return r.flag ? '<img class="flag" src="flags/' + esc(r.flag.split("/").pop()) + '" alt="" width="24" height="24" loading="lazy">' : '<span class="flag"></span>'; }
  function cls(p) { return p > 0 ? "up" : p < 0 ? "down" : ""; }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 1600);
  }
  function copy(text, what) {
    navigator.clipboard.writeText(text).then(function () { toast(what + " copied"); }, function () { toast("Copy failed. Select the text and copy it"); });
  }
  function dayChange(r) { return r.change != null && r.mean ? r.change / (r.mean - r.change) * 100 : null; }

  /* ---------- hero ---------- */
  function renderStatus() {
    $("status-stamp").textContent = "BOT · " + stampDate(latest.date);
    var nowEAT = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
    var ageDays = (new Date(nowEAT) - new Date(latest.date)) / 864e5;
    var fetched = "";
    if (latest.fetched_at) {
      var f = new Date(new Date(latest.fetched_at).getTime() + 3 * 3600e3);
      fetched = " at " + ("0" + f.getUTCHours()).slice(-2) + ":" + ("0" + f.getUTCMinutes()).slice(-2) + " EAT on " + f.getUTCDate() + " " + MONTHS[f.getUTCMonth()];
    }
    $("status-text").textContent = ageDays > 2
      ? "Latest rate available. BOT has not published a newer one yet, or our fetch is late"
      : "Latest BOT rate, fetched from bot.go.tz" + fetched;
  }
  function inlineReceipt() {
    // Inline the SVG so it uses the page's mono font instead of a system fallback
    fetch(BASE + "receipt.svg?v=" + Date.now().toString(36).slice(0, -4)).then(function (r) { return r.ok ? r.text() : null; }).then(function (svg) {
      if (svg && svg.indexOf("<svg") === 0) $("receipt").innerHTML = svg;
    }, function () {});
  }

  /* ---------- ticker ---------- */
  function renderTicker() {
    var rank = function (c) { var i = POPULAR.indexOf(c); return i < 0 ? 99 : i; };
    var items = latest.rates.filter(function (r) { return r.code !== "SDR"; })
      .sort(function (a, b) { return rank(a.code) - rank(b.code) || a.code.localeCompare(b.code); })
      .map(function (r) {
        var p = dayChange(r), dir = p > 0 ? "up" : p < 0 ? "down" : "flat";
        return '<span class="tick" data-pick="' + r.code + '">' + flag(r) + '<b>' + r.code + "/TZS</b><span>" + fmt(r.mean) +
          '</span><i class="' + dir + '">' + (p > 0 ? "▲ " : p < 0 ? "▼ " : "■ ") + (p == null ? "–" : Math.abs(p).toFixed(2) + "%") + "</i></span>";
      }).join("");
    $("ticker-date").textContent = "BOT · " + stampDate(latest.date);
    // Two copies so the strip loops seamlessly; the second is hidden from screen readers
    $("ticker-track").innerHTML = '<div class="ticker-set">' + items + '</div><div class="ticker-set" aria-hidden="true">' + items + "</div>";
  }

  /* ---------- converter ---------- */
  function num(v) { return parseFloat(String(v).replace(/[^0-9.]/g, "")) || 0; }
  function convert(from) {
    var r = byCode[$("conv-cur").value]; if (!r) return;
    if (from === "a") $("conv-b").value = fmt(num($("conv-a").value) * r.mean, 2);
    else $("conv-a").value = fmt(num($("conv-b").value) / r.mean);
    $("conv-note").textContent = "At the BOT mean rate: 1 " + r.code + " = " + fmt(r.mean) + " TZS on " + day(latest.date);
  }
  function renderConverter() {
    $("conv-cur").innerHTML = latest.rates.filter(function (r) { return r.code !== "GOLD" && r.code !== "SDR"; })
      .map(function (r) { return '<option value="' + r.code + '"' + (r.code === "USD" ? " selected" : "") + ">" + r.code + "</option>"; }).join("");
    convert("a");
  }

  /* ---------- rates ---------- */
  function renderStats() {
    $("stats").innerHTML = STATS.filter(function (c) { return byCode[c]; }).map(function (c) {
      var r = byCode[c], p = dayChange(r);
      return '<button class="panel stat" data-pick="' + c + '"><span class="label"><span>' + esc(r.name) + " · " + c + "</span>" + flag(r) + '</span><p class="figure">' + fmt(r.mean) +
        '</p><p class="meta"><span class="' + cls(p) + '">' + (p == null ? "–" : signed(p)) + "</span> vs " + day(latest.previous_date, false) + "</p></button>";
    }).join("");
  }
  function renderTable() {
    var q = $("search").value.trim().toLowerCase();
    var rank = function (c) { var i = POPULAR.indexOf(c); return i < 0 ? 99 : i; };
    var all = latest.rates.filter(function (r) { return !q || r.code.toLowerCase().indexOf(q) > -1 || r.name.toLowerCase().indexOf(q) > -1; })
      .sort(function (a, b) { return rank(a.code) - rank(b.code) || a.code.localeCompare(b.code); });
    var rows = q || showAll ? all : all.slice(0, 10);
    $("more").hidden = !!q || all.length <= 10;
    $("more").textContent = showAll ? "Show fewer" : "Show all " + all.length + " currencies";
    $("rates-body").innerHTML = rows.length ? rows.map(function (r) {
      var p = dayChange(r);
      return '<tr tabindex="0" data-code="' + r.code + '" aria-selected="' + (r.code === selected) + '"><td><span class="code">' + flag(r) + r.code + '</span><span class="name">' + esc(r.name) +
        '</span></td><td class="n">' + fmt(r.buying) + '</td><td class="n">' + fmt(r.selling) + '</td><td class="n hide-sm">' + fmt(r.mean) +
        '</td><td class="n ' + cls(p) + '">' + (p == null ? "–" : signed(p)) + "</td></tr>";
    }).join("") : '<tr><td colspan="5" class="empty">No currency matches “' + esc(q) + "”. Try a code like USD or a name like euro</td></tr>";
  }

  /* ---------- history ---------- */
  function pick(code, scroll) {
    if (!byCode[code]) return;
    selected = code; year = null;
    $("cur").value = code;
    [].forEach.call(document.querySelectorAll("#rates-body tr[data-code]"), function (tr) { tr.setAttribute("aria-selected", tr.dataset.code === code); });
    renderHistory();
    if (scroll) $("history").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function renderHistory() {
    var code = selected;
    $("hist-title").textContent = byCode[code].name + " since 1999";
    $("y-code").textContent = code;
    series(code).then(function (rows) {
      if (code !== selected) return;
      $("hist-title").textContent = byCode[code].name + " since " + rows[0][0].slice(0, 4);
      drawChart(rangeDays ? rows.slice(-rangeDays) : rows);
      renderYears(rows);
      renderRecords(rows);
      renderDays(rows);
      updateLookup();
    }, function () { $("chart").innerHTML = '<p class="sub">History could not load. Check your connection and reload the page</p>'; });
  }

  function drawChart(rows) {
    var step = Math.max(1, Math.floor(rows.length / 700));
    var pts = rows.filter(function (_, i) { return i % step === 0 || i === rows.length - 1; });
    var el = $("chart"), W = el.clientWidth || 800, H = el.clientHeight || 340, padL = 4, padR = 64, padT = 20, padB = 24;
    var vals = pts.map(function (p) { return p[3]; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * .1 || hi * .01;
    lo -= pad; hi += pad;
    var x = function (i) { return padL + i / Math.max(1, pts.length - 1) * (W - padL - padR); };
    var y = function (v) { return padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB); };
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p[3]).toFixed(1); }).join("");
    var area = line + "L" + x(pts.length - 1).toFixed(1) + " " + (H - padB) + "L" + padL + " " + (H - padB) + "Z";
    var grid = "";
    for (var k = 0; k < 4; k++) {
      var v = lo + (hi - lo) * (k + .5) / 4, yy = y(v).toFixed(1);
      grid += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '"/><text class="axis" x="' + (W - padR + 12) + '" y="' + (+yy + 4) + '">' + short(v) + "</text>";
    }
    var n = Math.min(W < 520 ? 3 : 6, pts.length), xl = "";
    for (var j = 0; j < n; j++) {
      var idx = Math.round(j * (pts.length - 1) / Math.max(1, n - 1)), d = pts[idx][0];
      var lab = rangeDays && rangeDays <= 365 ? MONTHS[+d.slice(5, 7) - 1] + " " + d.slice(0, 4) : d.slice(0, 4);
      xl += '<text class="axis" x="' + x(idx).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="' + (j === 0 ? "start" : j === n - 1 ? "end" : "middle") + '">' + lab + "</text>";
    }
    // Label the highest and lowest points of the period: real data, no commentary
    var hiI = 0, loI = 0;
    pts.forEach(function (p, i) { if (p[3] > pts[hiI][3]) hiI = i; if (p[3] < pts[loI][3]) loI = i; });
    function mark(i, below) {
      var mx = x(i), my = y(pts[i][3]), anchor = mx > W * .7 ? "end" : mx < W * .15 ? "start" : "middle";
      return '<circle class="mark-dot" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="3"/><text class="mark-label" x="' + mx.toFixed(1) + '" y="' + (my + (below ? 18 : -10)).toFixed(1) +
        '" text-anchor="' + anchor + '">' + short(pts[i][3]) + " · " + day(pts[i][0]) + "</text>";
    }
    el.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '">' + grid + '<path class="area" d="' + area + '"/><path class="line" d="' + line + '"/>' + xl +
      mark(hiI, false) + (loI !== hiI ? mark(loI, true) : "") +
      '<line class="cursor" id="cur-l" y1="' + padT + '" y2="' + (H - padB) + '" visibility="hidden"/><circle class="dot" id="cur-d" r="5" visibility="hidden"/></svg>';

    var first = rows[0], last = rows[rows.length - 1], p = pct(first[3], last[3]);
    $("chart-label").textContent = "Mean rate on " + day(last[0]) + ", TZS per 1 " + selected;
    $("chart-now").textContent = fmt(last[3]);
    $("chart-delta").innerHTML = '<span class="' + cls(p) + '">' + signed(p, 1) + "</span> vs " + day(first[0]) + " (" + fmt(first[3]) + ")";

    var svg = el.querySelector("svg"), tip = $("tip");
    svg.addEventListener("pointermove", function (e) {
      var rect = svg.getBoundingClientRect(), px = (e.clientX - rect.left) * W / rect.width;
      var i = Math.max(0, Math.min(pts.length - 1, Math.round((px - padL) / (W - padL - padR) * (pts.length - 1))));
      var pt = pts[i], cx = x(i), cy = y(pt[3]), cl = svg.getElementById("cur-l"), cd = svg.getElementById("cur-d");
      cl.setAttribute("x1", cx); cl.setAttribute("x2", cx); cl.setAttribute("visibility", "visible");
      cd.setAttribute("cx", cx); cd.setAttribute("cy", cy); cd.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.style.left = (el.offsetLeft + cx * rect.width / W) + "px";
      tip.style.top = (el.offsetTop + cy * rect.height / H) + "px";
      tip.innerHTML = day(pt[0]) + "<br>Mean " + fmt(pt[3]) + "<br>Buy " + fmt(pt[1]) + " · Sell " + fmt(pt[2]);
    });
    svg.addEventListener("pointerleave", function () {
      tip.hidden = true;
      svg.getElementById("cur-l").setAttribute("visibility", "hidden"); svg.getElementById("cur-d").setAttribute("visibility", "hidden");
    });
  }

  function yearly(rows) {
    var g = {}, order = [];
    rows.forEach(function (r) { var k = r[0].slice(0, 4); if (!g[k]) { g[k] = []; order.push(k); } g[k].push(r[3]); });
    return order.map(function (k) { return { year: k, avg: g[k].reduce(function (a, b) { return a + b; }, 0) / g[k].length }; });
  }
  function renderYears(rows) {
    var ys = yearly(rows).reverse(), max = Math.max.apply(null, ys.map(function (y) { return y.avg; }));
    if (!year) year = ys[0].year;
    var shown = allYears ? ys : ys.slice(0, 12);
    $("years").innerHTML = shown.map(function (y) {
      return '<li><button data-year="' + y.year + '" aria-pressed="' + (y.year === year) + '"><span>' + y.year + '</span><span class="bar"><i style="width:' + (y.avg / max * 100).toFixed(1) +
        '%"></i></span><span class="v">' + fmt(y.avg) + "</span></button></li>";
    }).join("") + (ys.length > 12 ? '<li><button class="more" data-all-years>' + (allYears ? "Show fewer years" : "Show all " + ys.length + " years") + "</button></li>" : "");
  }
  function renderRecords(rows) {
    var hi = rows[0], lo = rows[0], up = null, down = null;
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i], p = pct(rows[i - 1][3], r[3]);
      if (r[3] > hi[3]) hi = r;
      if (r[3] < lo[3]) lo = r;
      if (!up || p > up[1]) up = [r[0], p];
      if (!down || p < down[1]) down = [r[0], p];
    }
    var first = rows[0], last = rows[rows.length - 1];
    $("rec-range").textContent = day(first[0]) + " to " + day(last[0]);
    function row(t, v, s, c) { return "<div><dt>" + t + '</dt><dd class="' + (c || "") + '">' + v + "<small>" + s + "</small></dd></div>"; }
    $("records").innerHTML =
      row("Highest mean", fmt(hi[3]), day(hi[0])) +
      row("Lowest mean", fmt(lo[3]), day(lo[0])) +
      row("Largest one-day rise", signed(up[1]), day(up[0]), "up") +
      row("Largest one-day fall", signed(down[1]), day(down[0]), "down") +
      row("Change since " + first[0].slice(0, 4), signed(pct(first[3], last[3]), 0), fmt(first[3]) + " to " + fmt(last[3]), cls(last[3] - first[3]));
  }
  function renderDays(rows) {
    var yr = rows.filter(function (r) { return r[0].slice(0, 4) === year; });
    var up = 0, down = 0, flat = 0;
    for (var i = 1; i < yr.length; i++) { var d = yr[i][3] - yr[i - 1][3]; if (d > 0) up++; else if (d < 0) down++; else flat++; }
    var total = Math.max(1, up + down + flat), ch = yr.length ? pct(yr[0][3], yr[yr.length - 1][3]) : 0;
    $("days-title").textContent = "Daily moves in " + year;
    $("days-bar").innerHTML =
      '<span style="flex:' + up + ';background:var(--accent)" title="Rate rose"></span>' +
      '<span style="flex:' + down + ';background:var(--muted)" title="Rate fell"></span>' +
      '<span style="flex:' + flat + ';background:var(--line-strong)" title="No change"></span>';
    $("days-legend").innerHTML = '<span class="up">' + up + " up</span> · " + down + " down · " + flat + " unchanged · " + selected + " " +
      '<span class="' + cls(ch) + '">' + signed(ch, 1) + "</span> over " + year + " (" + Math.round(up / total * 100) + "% of days the shilling weakened)";
  }

  function updateLookup() {
    var v = $("lookup-date").value, out = $("lookup-out");
    if (!v) return;
    out.textContent = "Loading";
    getJSON("api/history/" + v.slice(0, 4) + ".json").then(function (h) {
      var days = Object.keys(h.rates).filter(function (d) { return d <= v; }).sort();
      var d = days[days.length - 1], r = d && h.rates[d][selected];
      out.textContent = r ? selected + " on " + day(d) + ": buy " + fmt(r[0]) + " · sell " + fmt(r[1]) + " · mean " + fmt(r[2]) + (d !== v ? " (closest earlier BOT date)" : "")
        : "BOT has no " + selected + " rate on or just before " + day(v);
    }, function () { out.textContent = "No BOT data for that year. Pick a date from 24 June 1999"; });
  }

  /* ---------- API ---------- */
  function renderEndpoints() {
    var y = new Date().getFullYear();
    $("endpoints").innerHTML = [
      ["Latest rates, all currencies", "api/latest.json"],
      ["Latest rates as CSV", "api/latest.csv"],
      ["One currency, every day since 1999", "api/currency/USD.json"],
      ["One year, all currencies", "api/history/" + y + ".json"],
      ["Currency list and coverage", "api/currencies.json"],
      ["OpenAPI spec", "openapi.json"],
      ["Guide for AI assistants", "llms.txt"]
    ].map(function (e) {
      var url = BASE + e[1];
      return '<li class="endpoint"><span class="what">' + e[0] + "</span><code>GET /" + esc(e[1]) + '</code><span class="btns"><button class="copy" data-copy="' + esc(url) +
        '">Copy</button><a class="open" href="' + esc(url) + '" target="_blank" rel="noopener">Open</a></span></li>';
    }).join("");
  }
  function examples() {
    var u = BASE + "api/latest.json";
    var sample = latest ? JSON.stringify({ base: "TZS", date: latest.date, previous_date: latest.previous_date, fetched_at: latest.fetched_at,
      rates: latest.rates.filter(function (r) { return r.code === "USD" || r.code === "EUR"; }) }, null, 2) : "";
    return {
      js: "const res = await fetch(\"" + u + "\");\nconst { date, rates } = await res.json();\n\nconst usd = rates.find(r => r.code === \"USD\");\nconsole.log(`BOT ${date}: 1 USD = ${usd.mean} TZS`);",
      python: "import requests\n\ndata = requests.get(\"" + u + "\").json()\nrates = {r[\"code\"]: r for r in data[\"rates\"]}\n\nprint(data[\"date\"], rates[\"USD\"][\"buying\"], rates[\"USD\"][\"selling\"])",
      php: "<?php\n// WordPress: cache for an hour so pages stay fast\n$data = get_transient('bot_rates');\nif (!$data) {\n  $data = json_decode(file_get_contents('" + u + "'), true);\n  set_transient('bot_rates', $data, HOUR_IN_SECONDS);\n}\nforeach ($data['rates'] as $r) {\n  if (in_array($r['code'], ['USD', 'EUR', 'GBP'])) {\n    echo \"{$r['code']}: {$r['buying']} / {$r['selling']}<br>\";\n  }\n}",
      sheets: "# Google Sheets, cell A1\n=IMPORTDATA(\"" + BASE + "api/latest.csv\")\n\n# A whole year\n=IMPORTDATA(\"" + BASE + "api/history/2024.csv\")\n\n# Excel: Data > From Web, then paste the CSV link",
      json: sample
    };
  }
  function showExample(lang) {
    [].forEach.call(document.querySelectorAll('.tabs [role="tab"]'), function (b) { b.setAttribute("aria-selected", b.dataset.lang === lang); });
    $("code-ex").textContent = examples()[lang];
  }
  function agentPrompt() {
    return "Use the Exchange Rates API (independent mirror of Bank of Tanzania reference rates). Endpoints are listed at " + BASE + "llms.txt. " +
      "Latest rates: " + BASE + "api/latest.json. Rates are TZS per 1 unit of foreign currency, one reference rate per BOT date. Always state the BOT date of a rate you quote and that it is a reference rate, not a bank's price.";
  }

  /* ---------- widget builder ---------- */
  function renderChips() {
    $("wcur").innerHTML = latest.rates.filter(function (r) { return r.code !== "GOLD" && r.code !== "SDR"; }).map(function (r) {
      return '<label class="chip" title="' + esc(r.name) + '"><input type="checkbox" value="' + r.code + '"' + (STATS.indexOf(r.code) > -1 ? " checked" : "") + "><span>" + r.code + "</span></label>";
    }).join("");
  }
  function updateBuilder() {
    var cur = [].map.call(document.querySelectorAll("#wcur input:checked"), function (i) { return i.value; });
    var o = { currencies: cur.join(","), buyMargin: $("wbuy").value, sellMargin: $("wsell").value, theme: $("wtheme").value, title: $("wtitle").value.trim() };
    if (window.ExchangeRatesWidget && latest) window.ExchangeRatesWidget.render($("wpreview"), o, latest);
    var attrs = ['src="' + BASE + 'widget.js"', 'data-currencies="' + (o.currencies || "USD") + '"'];
    if (+o.buyMargin) attrs.push('data-buy-margin="' + o.buyMargin + '"');
    if (+o.sellMargin) attrs.push('data-sell-margin="' + o.sellMargin + '"');
    if (o.theme !== "paper") attrs.push('data-theme="' + o.theme + '"');
    if (o.title && o.title !== "Exchange rates") attrs.push('data-title="' + esc(o.title) + '"');
    $("wsnippet").textContent = "<script " + attrs.join("\n        ") + "></" + "script>";
  }

  /* ---------- wiring ---------- */
  document.addEventListener("click", function (e) {
    // In-page links: scroll here instead of following <base> to another URL
    var a = e.target.closest('a[href^="#"]');
    if (a && a.getAttribute("href").length > 1) {
      var target = document.getElementById(a.getAttribute("href").slice(1));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); history.replaceState(null, "", location.pathname + location.search + "#" + target.id); }
    }
    var c = e.target.closest("[data-copy],[data-copy-from]");
    if (c) copy(c.dataset.copy || $(c.dataset.copyFrom).textContent, c.dataset.copyFrom === "wsnippet" ? "Widget code" : c.dataset.copy ? "Link" : "Code");
    if (e.target.closest("[data-copy-agent]")) copy(agentPrompt(), "Agent prompt");
    var tr = e.target.closest("#rates-body tr[data-code]"); if (tr) pick(tr.dataset.code, true);
    var st = e.target.closest("[data-pick]"); if (st) pick(st.dataset.pick, true);
    var rb = e.target.closest("#ranges button");
    if (rb) {
      rangeDays = +rb.dataset.r;
      [].forEach.call(document.querySelectorAll("#ranges button"), function (x) { x.setAttribute("aria-pressed", x === rb); });
      series(selected).then(function (rows) { drawChart(rangeDays ? rows.slice(-rangeDays) : rows); });
    }
    var yb = e.target.closest("[data-year]");
    if (yb) { year = yb.dataset.year; series(selected).then(function (rows) { renderYears(rows); renderDays(rows); }); }
    if (e.target.closest("[data-all-years]")) { allYears = !allYears; series(selected).then(renderYears); }
    var tab = e.target.closest('.tabs [role="tab"]'); if (tab) showExample(tab.dataset.lang);
  });
  $("rates-body").addEventListener("keydown", function (e) {
    var tr = e.target.closest("tr[data-code]");
    if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pick(tr.dataset.code, true); }
  });
  $("search").addEventListener("input", renderTable);
  $("conv-a").addEventListener("input", function () { convert("a"); });
  $("conv-b").addEventListener("input", function () { convert("b"); });
  $("conv-cur").addEventListener("change", function () { convert("a"); });
  $("more").addEventListener("click", function () { showAll = !showAll; renderTable(); });
  $("cur").addEventListener("change", function () { pick(this.value); });
  $("lookup-date").addEventListener("change", updateLookup);
  $("wform").addEventListener("input", updateBuilder);
  var rz; addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { if (latest) series(selected).then(function (rows) { drawChart(rangeDays ? rows.slice(-rangeDays) : rows); }); }, 200); });

  inlineReceipt();
  renderEndpoints();
  showExample("js");
  getJSON("api/latest.json").then(function (data) {
    latest = data;
    data.rates.forEach(function (r) { byCode[r.code] = r; });
    $("lookup-date").max = data.date;
    $("rates-sub").textContent = "BOT rates for " + day(data.date) + ", TZS per 1 unit. Change is against " + day(data.previous_date);
    $("chg-head").textContent = "vs " + day(data.previous_date, false);
    $("cur").innerHTML = data.rates.map(function (r) { return '<option value="' + r.code + '">' + r.code + " · " + esc(r.name) + "</option>"; }).join("");
    $("cur").value = selected;
    renderStatus(); renderTicker(); renderConverter(); renderStats(); renderTable(); renderHistory(); showExample("js"); renderChips(); updateBuilder();
  }, function () {
    $("status-text").textContent = "Rates could not be loaded. Reload the page or open api/latest.json";
    $("rates-body").innerHTML = '<tr><td colspan="5" class="empty">Rates could not be loaded. Reload the page</td></tr>';
  });
})();
