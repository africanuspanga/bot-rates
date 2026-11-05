(function () {
  "use strict";
  var BASE = new URL(".", location.href.split("#")[0]).href;
  var FEATURED = ["USD", "EUR", "GBP", "KES"];
  var POPULAR = ["USD", "EUR", "GBP", "KES", "UGX", "RWF", "ZAR", "AED", "CNY", "INR", "JPY", "CHF", "SAR", "BIF", "ZMW", "MWK"];
  var showAll = false;
  var WIDGET_DEFAULT = ["USD", "EUR", "GBP", "KES"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var $ = function (id) { return document.getElementById(id); };
  var latest, byCode = {}, selected = "USD", rangeDays = 365, gaugeYear = null;
  var cache = {};

  /* ---------- helpers ---------- */
  function getJSON(path) {
    if (!cache[path]) cache[path] = fetch(BASE + path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    return cache[path];
  }
  function fmt(n, dp) {
    if (n == null || isNaN(n)) return "–";
    var d = dp != null ? dp : n >= 100 ? 2 : n >= 1 ? 3 : 4;
    return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function short(n) { return n >= 1000 ? fmt(n, 0) : fmt(n); }
  function pct(a, b) { return (b - a) / a * 100; }
  function signed(p, dp) { return (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p).toFixed(dp == null ? 2 : dp) + "%"; }
  function niceDate(iso, long) {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB",
      long ? { weekday: "short", day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 1700);
  }
  function copy(text, what) {
    navigator.clipboard.writeText(text).then(function () { toast(what + " copied"); }, function () { toast("Copy failed. Select the text and copy it."); });
  }
  function series(code) { return getJSON("api/currency/" + code + ".json").then(function (s) { return s.rates; }); }
  function groupAvg(rows, keyFn) {
    var g = {}, order = [];
    rows.forEach(function (r) { var k = keyFn(r[0]); if (!g[k]) { g[k] = []; order.push(k); } g[k].push(r[3]); });
    return order.map(function (k) { var v = g[k]; return { key: k, avg: v.reduce(function (a, b) { return a + b; }, 0) / v.length }; });
  }

  /* ---------- glossy bars (signature) ---------- */
  function drawBars(el, items, sel, labelFn, onPick) {
    var vals = items.map(function (i) { return i.avg; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), span = hi - lo || 1;
    var h = function (v) { return 28 + 72 * (v - lo) / span; };
    el.innerHTML = items.map(function (it, i) {
      var cls = i === sel ? " on" : Math.abs(i - sel) === 1 ? " near" : "";
      return '<button class="bar' + cls + '" style="--h:' + h(it.avg).toFixed(1) + '%" data-i="' + i + '" aria-label="' + esc(labelFn(it, true)) + ": " + fmt(it.avg) +
        '" aria-pressed="' + (i === sel) + '"><span class="knob"></span><span class="bar-l">' + esc(labelFn(it)) + "</span></button>";
    }).join("") + '<div class="guide" aria-hidden="true"><span class="guide-l"></span></div>';
    function place(i) {
      var bar = el.children[i], guide = el.querySelector(".guide");
      var top = bar.offsetTop + (el.classList.contains("bars-tall") ? 15 : 33);
      guide.style.top = top + "px";
      guide.querySelector(".guide-l").textContent = short(items[i].avg);
      var left = bar.offsetLeft + bar.offsetWidth / 2 < el.clientWidth / 2;
      guide.querySelector(".guide-l").style.cssText = left ? "left:auto;right:10px" : "";
    }
    el.onclick = function (e) {
      var b = e.target.closest(".bar"); if (!b) return;
      var i = +b.dataset.i;
      [].forEach.call(el.querySelectorAll(".bar"), function (x, j) {
        x.classList.toggle("on", j === i); x.classList.toggle("near", Math.abs(j - i) === 1); x.setAttribute("aria-pressed", j === i);
      });
      setTimeout(function () { place(i); }, 0);
      if (onPick) onPick(items[i]);
    };
    requestAnimationFrame(function () { place(sel); });
    setTimeout(function () { place(sel); }, 650);
  }

  /* ---------- hero ---------- */
  function renderHero() {
    var u = byCode.USD;
    $("hero-updated").textContent = "BOT rates for " + niceDate(latest.date, true) + " · updated daily";
    $("h-buy").textContent = fmt(u.buying);
    $("h-sell").textContent = fmt(u.selling);
    var p = u.change != null ? u.change / (u.mean - u.change) * 100 : 0;
    $("h-chg").innerHTML = '<span class="' + (p > 0 ? "up" : p < 0 ? "down" : "flat") + '">' + signed(p) + "</span>";
    series("USD").then(function (rows) {
      $("days-count").textContent = rows.length.toLocaleString("en-US");
      var months = groupAvg(rows, function (d) { return d.slice(0, 7); }).slice(-7);
      $("bars-note").textContent = "Tap a month";
      drawBars($("hero-bars"), months, months.length - 2 >= 0 ? months.length - 2 : 0, function (it, long) {
        var m = MONTHS[+it.key.slice(5) - 1]; return long ? m + " " + it.key.slice(0, 4) : m;
      });
    });
  }

  /* ---------- rates ---------- */
  function sparkPath(vals, w, h) {
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), s = hi - lo || 1;
    return vals.map(function (v, i) { return (i ? "L" : "M") + (i / (vals.length - 1) * w).toFixed(1) + " " + (h - 3 - (v - lo) / s * (h - 6)).toFixed(1); }).join("");
  }
  function renderFeatured() {
    $("featured").innerHTML = FEATURED.filter(function (c) { return byCode[c]; }).map(function (c) {
      var r = byCode[c], p = r.change != null ? r.change / (r.mean - r.change) * 100 : 0;
      return '<button class="feat card" data-pick="' + c + '"><span class="code">' + c + ' <span class="flag ' + (p > 0 ? "up" : p < 0 ? "down" : "flat") + '">' + signed(p) +
        "</span></span><b>" + fmt(r.mean) + "</b><small>" + esc(r.name) + ' · mean</small><svg class="spark" viewBox="0 0 200 36" preserveAspectRatio="none" id="sp-' + c + '"></svg></button>';
    }).join("");
    FEATURED.forEach(function (c) {
      series(c).then(function (rows) {
        var el = $("sp-" + c); if (el) el.innerHTML = '<path d="' + sparkPath(rows.slice(-60).map(function (r) { return r[3]; }), 200, 36) + '"/>';
      });
    });
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
      var p = r.change != null && r.mean ? r.change / (r.mean - r.change) * 100 : null;
      var cls = p > 0 ? "up" : p < 0 ? "down" : "flat";
      return '<tr tabindex="0" data-code="' + r.code + '" aria-selected="' + (r.code === selected) + '"><td><span class="cur"><span class="badge">' + r.code +
        "</span><span><b>" + esc(r.name) + "</b><small>" + r.code + '</small></span></span></td><td class="n">' + fmt(r.buying) + '</td><td class="n">' + fmt(r.selling) +
        '</td><td class="n hide-sm">' + fmt(r.mean) + '</td><td class="n"><span class="chg ' + cls + '">' + (p == null ? "–" : p === 0 ? "0.00%" : signed(p)) + "</span></td></tr>";
    }).join("") : '<tr><td colspan="5" class="empty">No currency matches “' + esc(q) + "”. Try a code like USD or a name like euro.</td></tr>";
  }

  /* ---------- insights ---------- */
  function pick(code, scroll) {
    if (!byCode[code]) return;
    selected = code; gaugeYear = null;
    $("ins-cur").value = code;
    [].forEach.call(document.querySelectorAll("#rates-body tr[data-code]"), function (tr) { tr.setAttribute("aria-selected", tr.dataset.code === code); });
    renderInsights();
    if (scroll) $("insights").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function renderInsights() {
    var code = selected;
    $("ins-title").textContent = "The shilling against the " + byCode[code].name;
    series(code).then(function (rows) {
      if (code !== selected) return;
      drawChart(rangeDays ? rows.slice(-rangeDays) : rows);
      var years = groupAvg(rows, function (d) { return d.slice(0, 4); });
      var yi = gaugeYear ? years.findIndex(function (y) { return y.key === gaugeYear; }) : years.length - 1;
      drawBars($("year-bars"), years, yi, function (it, long) { return long ? it.key : (years.length > 14 ? "’" + it.key.slice(2) : it.key); }, function (it) {
        gaugeYear = it.key; drawGauge(rows, it.key);
      });
      drawGauge(rows, years[yi].key);
      renderRecords(rows);
      updateLookup();
    }, function () { $("chart").innerHTML = '<p class="sub">History could not load. Check your connection and reload.</p>'; });
  }

  function drawChart(rows) {
    var step = Math.max(1, Math.floor(rows.length / 600));
    var pts = rows.filter(function (_, i) { return i % step === 0 || i === rows.length - 1; });
    var el = $("chart"), W = el.clientWidth || 700, H = el.clientHeight || 300, padL = 8, padR = 58, padB = 26, padT = 10;
    var vals = pts.map(function (p) { return p[3]; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * .12 || hi * .01;
    lo -= pad; hi += pad;
    var x = function (i) { return padL + i / Math.max(1, pts.length - 1) * (W - padL - padR); };
    var y = function (v) { return padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB); };
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p[3]).toFixed(1); }).join("");
    var area = line + "L" + x(pts.length - 1).toFixed(1) + " " + (H - padB) + "L" + padL + " " + (H - padB) + "Z";
    var grid = "";
    for (var k = 0; k <= 3; k++) {
      var v = lo + (hi - lo) * (k + .5) / 4, yy = y(v);
      grid += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '"/><text class="axis" x="' + (W - padR + 8) + '" y="' + (yy + 4) + '">' + short(v) + "</text>";
    }
    var n = Math.min(W < 520 ? 3 : 5, pts.length), xl = "";
    for (var j = 0; j < n; j++) {
      var idx = Math.round(j * (pts.length - 1) / Math.max(1, n - 1)), d = pts[idx][0];
      var lab = rangeDays && rangeDays <= 365 ? MONTHS[+d.slice(5, 7) - 1] + " " + d.slice(2, 4) : d.slice(0, 4);
      xl += '<text class="axis" x="' + x(idx) + '" y="' + (H - 4) + '" text-anchor="' + (j === 0 ? "start" : j === n - 1 ? "end" : "middle") + '">' + lab + "</text>";
    }
    el.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4562F5" stop-opacity=".28"/><stop offset="1" stop-color="#4562F5" stop-opacity="0"/></linearGradient></defs>' +
      grid + '<path d="' + area + '" fill="url(#ag)" stroke="none"/><path class="line" d="' + line + '"/>' + xl +
      '<line class="cursor" id="cur" y1="' + padT + '" y2="' + (H - padB) + '" visibility="hidden"/><circle class="knob" id="kn" r="7" visibility="hidden"/></svg>';

    var first = rows[0], last = rows[rows.length - 1], p = pct(first[3], last[3]);
    $("ins-now").textContent = fmt(last[3]) + " TZS";
    $("ins-delta").innerHTML = '<span class="' + (p > 0 ? "up" : p < 0 ? "down" : "flat") + '">' + signed(p, 1) + "</span> since " + niceDate(first[0]);

    var svg = el.querySelector("svg"), tip = $("tip");
    svg.addEventListener("pointermove", function (e) {
      var rect = svg.getBoundingClientRect(), px = (e.clientX - rect.left) * W / rect.width;
      var i = Math.max(0, Math.min(pts.length - 1, Math.round((px - padL) / (W - padL - padR) * (pts.length - 1))));
      var pt = pts[i], cx = x(i), cy = y(pt[3]);
      ["cur", "kn"].forEach(function (id) { svg.getElementById(id).setAttribute("visibility", "visible"); });
      svg.getElementById("cur").setAttribute("x1", cx); svg.getElementById("cur").setAttribute("x2", cx);
      svg.getElementById("kn").setAttribute("cx", cx); svg.getElementById("kn").setAttribute("cy", cy);
      tip.hidden = false;
      tip.style.left = (el.offsetLeft + cx * rect.width / W) + "px";
      tip.style.top = (el.offsetTop + cy * rect.height / H) + "px";
      tip.innerHTML = niceDate(pt[0]) + "<br><b>" + fmt(pt[3]) + "</b> mean<br>Buy " + fmt(pt[1]) + " · Sell " + fmt(pt[2]);
    });
    svg.addEventListener("pointerleave", function () {
      tip.hidden = true; ["cur", "kn"].forEach(function (id) { svg.getElementById(id).setAttribute("visibility", "hidden"); });
    });
  }

  function arc(cx, cy, r, a0, a1) {
    var p = function (a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }, s = p(a0), e = p(a1);
    return "M" + s[0].toFixed(2) + " " + s[1].toFixed(2) + "A" + r + " " + r + " 0 " + (a1 - a0 > Math.PI ? 1 : 0) + " 1 " + e[0].toFixed(2) + " " + e[1].toFixed(2);
  }
  function drawGauge(rows, year) {
    var yr = rows.filter(function (r) { return r[0].slice(0, 4) === year; });
    var up = 0, down = 0, flat = 0;
    for (var i = 1; i < yr.length; i++) { var d = yr[i][3] - yr[i - 1][3]; if (d > 0) up++; else if (d < 0) down++; else flat++; }
    var total = Math.max(1, up + down + flat), change = pct(yr[0][3], yr[yr.length - 1][3]);
    $("g-code").textContent = selected; $("g-year").textContent = year;
    var segs = [[up, "#F4A54B"], [down, "#4F6CF7"], [flat, "#E585D6"]];
    var C = 150, R = 118, gap = .16, a = -Math.PI / 2 + gap / 2, paths = "";
    segs.forEach(function (s) {
      var span = s[0] / total * (Math.PI * 2);
      if (span > gap) paths += '<path d="' + arc(C, C, R, a, a + span - gap) + '" stroke="' + s[1] + '" stroke-width="26" stroke-linecap="round"/>';
      a += span;
    });
    var ticks = "";
    for (var t = 0; t < 60; t++) {
      var ang = t / 60 * Math.PI * 2 - Math.PI / 2, major = t % 15 === 0, r1 = major ? 80 : 84, r2 = 92;
      ticks += '<line class="' + (major ? "major" : "") + '" x1="' + (C + r1 * Math.cos(ang)).toFixed(1) + '" y1="' + (C + r1 * Math.sin(ang)).toFixed(1) +
        '" x2="' + (C + r2 * Math.cos(ang)).toFixed(1) + '" y2="' + (C + r2 * Math.sin(ang)).toFixed(1) + '"/>';
    }
    var word = change > 0 ? "TZS weaker" : change < 0 ? "TZS stronger" : "No change";
    $("gauge").innerHTML = '<svg viewBox="0 0 300 300" role="img" aria-label="' + word + " " + signed(change, 1) + " against " + selected + " in " + year + '">' +
      '<circle cx="150" cy="150" r="118" stroke="var(--soft)" stroke-width="34"/>' + paths + '<g class="ticks">' + ticks + "</g>" +
      '<text x="150" y="132" text-anchor="middle" font-size="15" font-weight="600" fill="var(--muted)" style="fill:var(--muted)">' + word + "</text>" +
      '<text x="150" y="176" text-anchor="middle" font-size="40" font-weight="800" letter-spacing="-1">' + signed(change, 1) + "</text>" +
      '<text x="150" y="200" text-anchor="middle" font-size="12.5" font-weight="600" style="fill:var(--muted)">' + niceDate(yr[0][0]).replace(/ \d{4}$/, "") + " → " + niceDate(yr[yr.length - 1][0]).replace(/ \d{4}$/, "") + "</text></svg>";
    function ring(n, color) {
      var f = n / total, end = -Math.PI / 2 + Math.max(.02, f) * Math.PI * 2 * .999;
      return '<svg class="ring" viewBox="0 0 60 60"><circle cx="30" cy="30" r="24" stroke="var(--soft)" stroke-width="7"/><path d="' + arc(30, 30, 24, -Math.PI / 2, end) +
        '" stroke="' + color + '" stroke-width="7" stroke-linecap="round"/></svg>';
    }
    $("gauge-legend").innerHTML =
      "<div>" + ring(up, "#F4A54B") + "<span>Days weaker</span><b>" + up + "</b></div>" +
      "<div>" + ring(down, "#4F6CF7") + "<span>Days stronger</span><b>" + down + "</b></div>" +
      "<div>" + ring(flat, "#E585D6") + "<span>No change</span><b>" + flat + "</b></div>";
  }

  function renderRecords(rows) {
    var hi = rows[0], lo = rows[0], jump = null, drop = null;
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (r[3] > hi[3]) hi = r;
      if (r[3] < lo[3]) lo = r;
      var p = pct(rows[i - 1][3], r[3]);
      if (!jump || p > jump[1]) jump = [r[0], p];
      if (!drop || p < drop[1]) drop = [r[0], p];
    }
    var first = rows[0], last = rows[rows.length - 1];
    $("records").innerHTML =
      "<li><span>Highest " + selected + " rate</span><b>" + fmt(hi[3]) + "<small>" + niceDate(hi[0]) + "</small></b></li>" +
      "<li><span>Lowest " + selected + " rate</span><b>" + fmt(lo[3]) + "<small>" + niceDate(lo[0]) + "</small></b></li>" +
      '<li><span>Biggest one-day rise</span><b class="up">' + signed(jump[1]) + "<small>" + niceDate(jump[0]) + "</small></b></li>" +
      '<li><span>Since records began</span><b class="' + (last[3] > first[3] ? "up" : "down") + '">' + signed(pct(first[3], last[3]), 0) + "<small>from " + fmt(first[3]) + " in " + first[0].slice(0, 4) + "</small></b></li>";
  }

  function updateLookup() {
    var v = $("lookup-date").value, out = $("lookup-out");
    if (!v) return;
    out.textContent = "Loading…";
    getJSON("api/history/" + v.slice(0, 4) + ".json").then(function (h) {
      var days = Object.keys(h.rates).filter(function (d) { return d <= v; }).sort();
      var d = days[days.length - 1], r = d && h.rates[d][selected];
      out.innerHTML = r ? "<b>" + selected + " on " + niceDate(d) + "</b>: buy " + fmt(r[0]) + " · sell " + fmt(r[1]) + " · mean " + fmt(r[2]) + (d !== v ? " (closest earlier BOT date)" : "")
        : "BOT has no " + selected + " rate on or just before " + niceDate(v) + ".";
    }, function () { out.textContent = "No BOT data for that year. Pick a date from 24 June 1999 to today."; });
  }

  /* ---------- API ---------- */
  function endpoints() {
    var y = new Date().getFullYear();
    return [
      ["Today’s rates, all currencies", "api/latest.json"],
      ["Today’s rates as CSV", "api/latest.csv"],
      ["One currency, every day since 1999", "api/currency/USD.json"],
      ["One year, all currencies", "api/history/" + y + ".json"],
      ["Currency list and coverage", "api/currencies.json"],
      ["OpenAPI spec for tools and agents", "openapi.json"],
      ["Plain-text guide for LLMs", "llms.txt"]
    ];
  }
  function renderEndpoints() {
    $("endpoints").innerHTML = endpoints().map(function (e) {
      var url = BASE + e[1];
      return '<li class="endpoint"><span class="what">' + e[0] + '</span><code><span class="get">GET</span>/' + esc(e[1]) +
        '</code><span class="btns"><button class="copy" data-copy="' + esc(url) + '">Copy</button><a class="open" href="' + esc(url) + '" target="_blank" rel="noopener">Open</a></span></li>';
    }).join("");
  }
  function examples() {
    var u = BASE + "api/latest.json";
    var sample = latest ? JSON.stringify({ base: "TZS", date: latest.date, previous_date: latest.previous_date,
      rates: latest.rates.filter(function (r) { return r.code === "USD" || r.code === "EUR"; }) }, null, 2) : "";
    return {
      js: "const res = await fetch(\"" + u + "\");\nconst { date, rates } = await res.json();\n\nconst usd = rates.find(r => r.code === \"USD\");\nconsole.log(`1 USD = ${usd.mean} TZS on ${date}`);",
      python: "import requests\n\ndata = requests.get(\"" + u + "\").json()\nrates = {r[\"code\"]: r for r in data[\"rates\"]}\n\nprint(data[\"date\"], rates[\"USD\"][\"buying\"], rates[\"USD\"][\"selling\"])",
      php: "<?php\n// WordPress: cache for an hour so pages stay fast\n$data = get_transient('bot_rates');\nif (!$data) {\n  $data = json_decode(file_get_contents('" + u + "'), true);\n  set_transient('bot_rates', $data, HOUR_IN_SECONDS);\n}\nforeach ($data['rates'] as $r) {\n  if (in_array($r['code'], ['USD', 'EUR', 'GBP'])) {\n    echo \"{$r['code']}: {$r['buying']} / {$r['selling']}<br>\";\n  }\n}",
      sheets: "# Google Sheets: paste into cell A1\n=IMPORTDATA(\"" + BASE + "api/latest.csv\")\n\n# A whole year\n=IMPORTDATA(\"" + BASE + "api/history/2024.csv\")\n\n# Excel: Data → From Web → paste the CSV link",
      json: sample
    };
  }
  function showExample(lang) {
    [].forEach.call(document.querySelectorAll(".tabs button"), function (b) { b.setAttribute("aria-selected", b.dataset.lang === lang); });
    $("code-ex").textContent = examples()[lang];
  }
  var AGENT_PROMPT = function () {
    return "Use the Exchange Rates API for official Bank of Tanzania (BOT) exchange rates. Read " + BASE + "llms.txt for the endpoints. " +
      "Today's rates: " + BASE + "api/latest.json. Rates are TZS per 1 unit of foreign currency, one reference rate per BOT trading day. Always state the BOT date of the rate you quote.";
  };

  /* ---------- widget builder ---------- */
  function renderChips() {
    $("wcur").innerHTML = latest.rates.filter(function (r) { return r.code !== "GOLD" && r.code !== "SDR"; }).map(function (r) {
      return '<label class="chip" title="' + esc(r.name) + '"><input type="checkbox" value="' + r.code + '"' + (WIDGET_DEFAULT.indexOf(r.code) > -1 ? " checked" : "") + "><span>" + r.code + "</span></label>";
    }).join("");
  }
  function updateBuilder() {
    var cur = [].map.call(document.querySelectorAll("#wcur input:checked"), function (i) { return i.value; });
    var o = { currencies: cur.join(","), buyMargin: $("wbuy").value, sellMargin: $("wsell").value, theme: $("wtheme").value, title: $("wtitle").value.trim() };
    if (window.ExchangeRatesWidget && latest) window.ExchangeRatesWidget.render($("wpreview"), o, latest);
    var attrs = ['src="' + BASE + 'widget.js"', 'data-currencies="' + (o.currencies || "USD") + '"'];
    if (+o.buyMargin) attrs.push('data-buy-margin="' + o.buyMargin + '"');
    if (+o.sellMargin) attrs.push('data-sell-margin="' + o.sellMargin + '"');
    if (o.theme !== "soft") attrs.push('data-theme="' + o.theme + '"');
    if (o.title && o.title !== "Today's exchange rates") attrs.push('data-title="' + esc(o.title) + '"');
    $("wsnippet").textContent = "<script " + attrs.join("\n        ") + "></" + "script>";
  }

  /* ---------- wiring ---------- */
  document.addEventListener("click", function (e) {
    var c = e.target.closest("[data-copy],[data-copy-from]");
    if (c) copy(c.dataset.copy || $(c.dataset.copyFrom).textContent, c.dataset.copyFrom === "wsnippet" ? "Widget code" : c.dataset.copy ? "Link" : "Code");
    if (e.target.closest("[data-copy-agent]")) copy(AGENT_PROMPT(), "Agent prompt");
    var tr = e.target.closest("#rates-body tr[data-code]"); if (tr) pick(tr.dataset.code, true);
    var f = e.target.closest("[data-pick]"); if (f) pick(f.dataset.pick, true);
    var rb = e.target.closest("#ranges button");
    if (rb) {
      rangeDays = +rb.dataset.r;
      [].forEach.call(document.querySelectorAll("#ranges button"), function (x) { x.setAttribute("aria-pressed", x === rb); });
      series(selected).then(function (rows) { drawChart(rangeDays ? rows.slice(-rangeDays) : rows); });
    }
    var tab = e.target.closest(".tabs button"); if (tab) showExample(tab.dataset.lang);
  });
  $("rates-body").addEventListener("keydown", function (e) {
    var tr = e.target.closest("tr[data-code]");
    if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pick(tr.dataset.code, true); }
  });
  $("search").addEventListener("input", renderTable);
  $("more").addEventListener("click", function () { showAll = !showAll; renderTable(); });
  $("ins-cur").addEventListener("change", function () { pick(this.value); });
  $("lookup-date").addEventListener("change", updateLookup);
  $("wform").addEventListener("input", updateBuilder);
  var rz; addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { if (latest) { renderHero(); renderInsights(); } }, 200); });

  renderEndpoints();
  showExample("js");
  getJSON("api/latest.json").then(function (data) {
    latest = data;
    data.rates.forEach(function (r) { byCode[r.code] = r; });
    $("lookup-date").max = data.date;
    $("rates-sub").textContent = data.rates.length + " currencies for " + niceDate(data.date, true) + ". TZS per 1 unit. Select one to see its history.";
    $("ins-cur").innerHTML = data.rates.map(function (r) { return '<option value="' + r.code + '">' + r.code + " · " + esc(r.name) + "</option>"; }).join("");
    $("ins-cur").value = selected;
    renderHero(); renderFeatured(); renderTable(); renderInsights(); showExample("js"); renderChips(); updateBuilder();
  }, function () {
    $("hero-updated").textContent = "Rates unavailable right now";
    $("rates-body").innerHTML = '<tr><td colspan="5" class="empty">Today’s rates could not be loaded. Reload the page, or open the API link below.</td></tr>';
  });
})();
