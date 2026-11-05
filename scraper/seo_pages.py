"""Static, crawlable landing pages for the searches people actually make (Google Ads Keyword Planner,
Tanzania): "dollar to tsh", "usd to tzs", "tzs to usd", "euro to tzs", "bei ya dola leo" and so on.

Each page is rebuilt every day with the latest BOT rate written into the HTML, so search engines see
the number and the BOT date without running JavaScript.
"""
import datetime as dt
import html
import json

FOREIGN_PAIRS = [  # (code, slug, short search phrase used in the title)
    ("USD", "usd-to-tzs", "Dollar to TSh"),
    ("EUR", "eur-to-tzs", "Euro to TZS"),
    ("GBP", "gbp-to-tzs", "Pound to TZS"),
    ("KES", "kes-to-tzs", "KES to TZS"),
    ("UGX", "ugx-to-tzs", "UGX to TZS"),
    ("RWF", "rwf-to-tzs", "RWF to TZS"),
    ("ZAR", "zar-to-tzs", "Rand to TZS"),
    ("AED", "aed-to-tzs", "Dirham to TZS"),
    ("CNY", "cny-to-tzs", "Yuan to TZS"),
    ("INR", "inr-to-tzs", "Rupee to TZS"),
]
SW_MONTHS = ["Januari", "Februari", "Machi", "Aprili", "Mei", "Juni", "Julai", "Agosti", "Septemba", "Oktoba", "Novemba", "Desemba"]


def fmt(n, dp=None):
    if n is None:
        return "–"
    d = dp if dp is not None else 2 if n >= 100 else 3 if n >= 1 else 4 if n >= 0.01 else 6
    return f"{n:,.{d}f}"


def en_date(iso):
    d = dt.date.fromisoformat(iso)
    return d.strftime("%a %-d %b %Y")


def sw_date(iso):
    d = dt.date.fromisoformat(iso)
    return f"{d.day} {SW_MONTHS[d.month - 1]} {d.year}"


def esc(s):
    return html.escape(str(s), quote=True)


def shell(site, slug, title, description, body, faq, lang="en", flag=None):
    url = f"{site}{slug}"
    ld = [{
        "@context": "https://schema.org", "@type": "WebPage", "name": title, "url": url, "description": description,
        "inLanguage": lang, "isPartOf": {"@type": "WebSite", "name": "Exchange Rates", "url": site.rstrip("/")},
        "publisher": {"@type": "Organization", "name": "Driftmark Technologies", "url": "https://www.driftmark.co.tz"},
    }, {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq],
    }]
    icon = f'<img class="flag" src="flags/{flag}.svg" alt="" width="24" height="24">' if flag else ""
    home = site.rstrip("/")
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="{site}">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{url}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23000000'/><circle cx='16' cy='16' r='9' fill='none' stroke='%23FFFFFF' stroke-width='2.2'/><path d='M11.5 14h9l-2.5-2.5M20.5 18h-9l2.5 2.5' fill='none' stroke='%23FFFFFF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body class="pair-page">
<header class="nav">
  <a class="brand" href="{home}" aria-label="Exchange Rates home">
    <svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M7.5 10h9l-2.5-2.5M16.5 14h-9l2.5 2.5"/></svg>
    Exchange Rates
  </a>
  <nav aria-label="Sections"><a href="converter">Converter</a><a href="{home}#rates">All rates</a><a href="{home}#history">History</a><a href="{home}#api">API</a></nav>
  <a class="btn btn-sm" href="{home}">All currencies</a>
</header>
<main>
{body}
</main>
<div class="foot-wrap"><footer class="foot">
  <div class="foot-main">
    <span class="foot-tag">Independent · not an official BOT service</span>
    <p class="foot-brand">Exchange Rates is a project by <a href="https://www.driftmark.co.tz/" rel="noopener">Driftmark Technologies</a></p>
    <p>An independent mirror of the reference rates the Bank of Tanzania publishes at <a href="https://www.bot.go.tz/ExchangeRate/excRates?lang=en" rel="noopener">bot.go.tz</a>. It is not affiliated with or endorsed by the Bank of Tanzania.</p>
    <p>Rates are for information. Banks and bureaux set their own prices. Check bot.go.tz before relying on a figure for a transaction or filing.</p>
  </div>
  <nav class="foot-links" aria-label="Footer">
    <a href="converter">Currency converter</a>
    <a href="{home}">All BOT rates</a>
    <a href="usd-to-tzs">Dollar to TSh</a>
    <a href="tzs-to-usd">TZS to USD</a>
    <a href="bei-ya-dola-leo">Bei ya dola leo</a>
    <a href="https://www.driftmark.co.tz/" rel="noopener">driftmark.co.tz</a>
  </nav>
</footer></div>
<script>
// Converter: the rate is fixed in the page; this just multiplies as you type
document.querySelectorAll("[data-converter]").forEach(function (box) {{
  var rate = +box.dataset.rate, inv = box.dataset.inverse === "1";
  var a = box.querySelector("[data-a]"), b = box.querySelector("[data-b]");
  function f(n) {{ var d = n >= 100 ? 2 : n >= 1 ? 3 : n >= .01 ? 4 : 6; return n.toLocaleString("en-US", {{ minimumFractionDigits: d, maximumFractionDigits: d }}); }}
  function num(v) {{ return parseFloat(String(v).replace(/[^0-9.]/g, "")) || 0; }}
  a.addEventListener("input", function () {{ b.value = f(inv ? num(a.value) / rate : num(a.value) * rate); }});
  b.addEventListener("input", function () {{ a.value = f(inv ? num(b.value) * rate : num(b.value) / rate); }});
}});
</script>
</body>
</html>
"""


def history_rows(series, n=30):
    rows = series[-n:][::-1]
    return "".join(f"<tr><td>{en_date(d)}</td><td class=\"n\">{fmt(b)}</td><td class=\"n\">{fmt(s)}</td><td class=\"n\">{fmt(m)}</td></tr>"
                   for d, b, s, m in rows)


def other_links(current):
    links = [f'<a href="{slug}">{phrase}</a>' for code, slug, phrase in FOREIGN_PAIRS if slug != current]
    links += ['<a href="tzs-to-usd">TZS to USD</a>', '<a href="bei-ya-dola-leo">Bei ya dola leo</a>', '<a href="converter">Currency converter</a>']
    return '<p class="pair-links">' + " · ".join(l for l in links if f'href="{current}"' not in l) + "</p>"


def foreign_page(site, code, slug, phrase, name, flag, latest_day, row, series):
    b, s, m = row
    date = en_date(latest_day)
    title = f"{phrase} today: 1 {code} = {fmt(m)} TZS (BOT rate, {dt.date.fromisoformat(latest_day).strftime('%-d %b %Y')})"
    desc = (f"{name} to Tanzanian shilling at the Bank of Tanzania reference rate for {date}: buying {fmt(b)}, selling {fmt(s)}, "
            f"mean {fmt(m)} TZS. Converter, common amounts and previous BOT rates. Updated every BOT trading day.")
    amounts = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 5000] if m > 50 else [1, 10, 100, 1000, 5000, 10000, 50000, 100000]
    table = "".join(f"<tr><td>{a:,} {code}</td><td class=\"n\">{fmt(a * m, 2)} TZS</td></tr>" for a in amounts)
    first = series[0]
    faq = [
        (f"What is the BOT {code} to TZS rate today?",
         f"On {date} the Bank of Tanzania reference rate for 1 {name} ({code}) is {fmt(m)} TZS (mean). BOT buying is {fmt(b)} and selling is {fmt(s)}."),
        (f"How do I convert {code} to Tanzanian shillings?",
         f"Multiply the amount in {code} by the BOT mean rate. For example 100 {code} x {fmt(m)} = {fmt(100 * m, 2)} TZS."),
        ("Is this the rate my bank or bureau de change will give me?",
         "No. This is the Bank of Tanzania reference rate. Banks and bureaux de change set their own buying and selling prices around it."),
        (f"Where can I see previous BOT {code} exchange rates?",
         f"Below are the last 30 BOT dates. The full daily history since {first[0][:4]} is free as JSON and CSV in the Exchange Rates API."),
    ]
    body = f"""
<section class="pair-hero">
  <p class="status"><span class="stamp-sm">BOT · {esc(dt.date.fromisoformat(latest_day).strftime('%d %b %Y').upper())}</span><span>Bank of Tanzania reference rate, updated every BOT trading day</span></p>
  <h1>{esc(code)} to TZS: 1 {esc(name)} = {fmt(m)} Tanzanian shillings</h1>
  <p class="lede">BOT buying <b>{fmt(b)}</b> · selling <b>{fmt(s)}</b> · mean <b>{fmt(m)}</b> TZS for {date}.</p>
  <div class="panel converter" data-converter data-rate="{m}">
    <label><span class="label">{esc(code)}</span><span class="conv-field"><img class="flag" src="flags/{flag}.svg" alt="" width="24" height="24"><input data-a inputmode="decimal" value="100" aria-label="Amount in {esc(code)}"></span></label>
    <span class="conv-eq" aria-hidden="true">=</span>
    <label><span class="label">TZS</span><span class="conv-field"><img class="flag" src="flags/tz.svg" alt="" width="24" height="24"><input data-b inputmode="decimal" value="{fmt(100 * m, 2)}" aria-label="Amount in Tanzanian shillings"></span></label>
    <p class="meta">At the BOT mean rate of {fmt(m)} for {date}</p>
  </div>
</section>
<section class="section pair-grid">
  <div class="panel"><div class="panel-head"><h2>{esc(code)} to TZS amounts</h2><span class="meta">BOT mean, {date}</span></div>
    <table class="rates"><tbody>{table}</tbody></table></div>
  <div class="panel"><div class="panel-head"><h2>Previous BOT {esc(code)} rates</h2><span class="meta">Last 30 BOT dates</span></div>
    <table class="rates"><thead><tr><th>Date</th><th class="n">Buying</th><th class="n">Selling</th><th class="n">Mean</th></tr></thead><tbody>{history_rows(series)}</tbody></table></div>
</section>
<section class="section">
  <h2>Questions</h2>
  <dl class="faq">{"".join(f"<div><dt>{esc(q)}</dt><dd>{esc(a)}</dd></div>" for q, a in faq)}</dl>
  {other_links(slug)}
</section>"""
    return shell(site, slug, title, desc, body, faq, flag=flag)


def reverse_page(site, latest_day, row, series):
    b, s, m = row
    date = en_date(latest_day)
    per = 1 / m
    title = f"TZS to USD today: 1,000 TZS = {fmt(1000 * per, 4)} USD (BOT rate, {dt.date.fromisoformat(latest_day).strftime('%-d %b %Y')})"
    desc = (f"Tanzanian shilling to US dollar at the Bank of Tanzania reference rate for {date}: 1 USD = {fmt(m)} TZS, "
            f"so 1,000 TZS = {fmt(1000 * per, 4)} USD. Converter and common amounts.")
    amounts = [1000, 5000, 10000, 20000, 50000, 100000, 500000, 1000000, 5000000, 10000000]
    table = "".join(f"<tr><td>{a:,} TZS</td><td class=\"n\">{fmt(a * per, 2)} USD</td></tr>" for a in amounts)
    faq = [
        ("How much is 1,000 Tanzanian shillings in US dollars today?",
         f"At the Bank of Tanzania mean rate for {date} (1 USD = {fmt(m)} TZS), 1,000 TZS is {fmt(1000 * per, 4)} USD."),
        ("How do I convert TZS to USD?", f"Divide the shilling amount by the BOT mean rate. For example 100,000 / {fmt(m)} = {fmt(100000 * per, 2)} USD."),
        ("Is this the rate my bank or bureau de change will give me?",
         "No. This is the Bank of Tanzania reference rate. Banks and bureaux de change set their own prices around it."),
    ]
    body = f"""
<section class="pair-hero">
  <p class="status"><span class="stamp-sm">BOT · {esc(dt.date.fromisoformat(latest_day).strftime('%d %b %Y').upper())}</span><span>Bank of Tanzania reference rate, updated every BOT trading day</span></p>
  <h1>TZS to USD: 1,000 Tanzanian shillings = {fmt(1000 * per, 4)} US dollars</h1>
  <p class="lede">BOT mean rate for {date}: 1 USD = <b>{fmt(m)}</b> TZS (buying {fmt(b)}, selling {fmt(s)}).</p>
  <div class="panel converter" data-converter data-rate="{m}" data-inverse="1">
    <label><span class="label">TZS</span><span class="conv-field"><img class="flag" src="flags/tz.svg" alt="" width="24" height="24"><input data-a inputmode="decimal" value="100,000" aria-label="Amount in Tanzanian shillings"></span></label>
    <span class="conv-eq" aria-hidden="true">=</span>
    <label><span class="label">USD</span><span class="conv-field"><img class="flag" src="flags/us.svg" alt="" width="24" height="24"><input data-b inputmode="decimal" value="{fmt(100000 * per, 2)}" aria-label="Amount in US dollars"></span></label>
    <p class="meta">At the BOT mean rate of {fmt(m)} for {date}</p>
  </div>
</section>
<section class="section pair-grid">
  <div class="panel"><div class="panel-head"><h2>TZS to USD amounts</h2><span class="meta">BOT mean, {date}</span></div>
    <table class="rates"><tbody>{table}</tbody></table></div>
  <div class="panel"><div class="panel-head"><h2>Previous BOT USD rates</h2><span class="meta">Last 30 BOT dates</span></div>
    <table class="rates"><thead><tr><th>Date</th><th class="n">Buying</th><th class="n">Selling</th><th class="n">Mean</th></tr></thead><tbody>{history_rows(series)}</tbody></table></div>
</section>
<section class="section">
  <h2>Questions</h2>
  <dl class="faq">{"".join(f"<div><dt>{esc(q)}</dt><dd>{esc(a)}</dd></div>" for q, a in faq)}</dl>
  {other_links("tzs-to-usd")}
</section>"""
    return shell(site, "tzs-to-usd", title, desc, body, faq, flag="us")


def swahili_page(site, latest_day, latest, series):
    b, s, m = latest["USD"]
    tarehe = sw_date(latest_day)
    title = f"Bei ya dola leo: 1 USD = {fmt(m)} TSh (BOT, {tarehe})"
    desc = (f"Bei ya dola leo kwa kiwango cha Benki Kuu ya Tanzania (BOT) cha {tarehe}: kununua {fmt(b)}, kuuza {fmt(s)}, "
            f"wastani {fmt(m)} TSh. Kikokotoo, viwango vya fedha nyingine na viwango vya awali.")
    others = "".join(f"<tr><td>{c}</td><td class=\"n\">{fmt(latest[c][0])}</td><td class=\"n\">{fmt(latest[c][1])}</td><td class=\"n\">{fmt(latest[c][2])}</td></tr>"
                     for c in ["USD", "EUR", "GBP", "KES", "UGX", "AED", "CNY", "ZAR"] if c in latest)
    amounts = "".join(f"<tr><td>{a:,} USD</td><td class=\"n\">{fmt(a * m, 2)} TSh</td></tr>" for a in [1, 10, 50, 100, 500, 1000])
    faq = [
        ("Bei ya dola leo ni shilingi ngapi?",
         f"Kwa kiwango cha Benki Kuu ya Tanzania cha {tarehe}, dola 1 ya Marekani ni wastani wa {fmt(m)} TSh. BOT kununua ni {fmt(b)} na kuuza ni {fmt(s)}."),
        ("Je, hii ndiyo bei nitakayopata benki au kwenye bureau?",
         "Hapana. Hiki ni kiwango cha marejeo cha BOT. Benki na maduka ya kubadilisha fedha huweka bei zao za kununua na kuuza."),
        ("Viwango hivi vinatoka wapi?",
         "Kutoka tovuti ya Benki Kuu ya Tanzania (bot.go.tz). Huu ni mradi huru wa Driftmark Technologies, si huduma rasmi ya BOT."),
    ]
    body = f"""
<section class="pair-hero">
  <p class="status"><span class="stamp-sm">BOT · {esc(dt.date.fromisoformat(latest_day).strftime('%d %b %Y').upper())}</span><span>Kiwango cha marejeo cha Benki Kuu ya Tanzania</span></p>
  <h1>Bei ya dola leo: 1 USD = {fmt(m)} TSh</h1>
  <p class="lede">Kiwango cha kubadilisha fedha za kigeni cha BOT cha {tarehe}: kununua <b>{fmt(b)}</b> · kuuza <b>{fmt(s)}</b> · wastani <b>{fmt(m)}</b>.</p>
  <div class="panel converter" data-converter data-rate="{m}">
    <label><span class="label">Dola (USD)</span><span class="conv-field"><img class="flag" src="flags/us.svg" alt="" width="24" height="24"><input data-a inputmode="decimal" value="100" aria-label="Kiasi kwa dola"></span></label>
    <span class="conv-eq" aria-hidden="true">=</span>
    <label><span class="label">Shilingi (TSh)</span><span class="conv-field"><img class="flag" src="flags/tz.svg" alt="" width="24" height="24"><input data-b inputmode="decimal" value="{fmt(100 * m, 2)}" aria-label="Kiasi kwa shilingi"></span></label>
    <p class="meta">Kwa wastani wa BOT wa {fmt(m)} wa {tarehe}</p>
  </div>
</section>
<section class="section pair-grid">
  <div class="panel"><div class="panel-head"><h2>Fedha nyingine leo</h2><span class="meta">TSh kwa 1</span></div>
    <table class="rates"><thead><tr><th>Fedha</th><th class="n">Kununua</th><th class="n">Kuuza</th><th class="n">Wastani</th></tr></thead><tbody>{others}</tbody></table></div>
  <div class="panel"><div class="panel-head"><h2>Dola kwa shilingi</h2><span class="meta">Wastani wa BOT</span></div>
    <table class="rates"><tbody>{amounts}</tbody></table></div>
</section>
<section class="section">
  <h2>Maswali</h2>
  <dl class="faq">{"".join(f"<div><dt>{esc(q)}</dt><dd>{esc(a)}</dd></div>" for q, a in faq)}</dl>
  {other_links("bei-ya-dola-leo")}
</section>"""
    return shell(site, "bei-ya-dola-leo", title, desc, body, faq, lang="sw", flag="us")


def converter_page(site, latest_day, latest, names, flags):
    """Consumer converter: any currency to any other (through TZS) at the BOT rate."""
    date = en_date(latest_day)
    m = latest["USD"][2]
    data = [{"c": "TZS", "n": "Tanzanian Shilling", "f": "tz", "b": 1, "s": 1, "m": 1}] + [
        {"c": c, "n": names.get(c, c), "f": flags.get(c), "b": r[0], "s": r[1], "m": r[2]}
        for c, r in sorted(latest.items()) if c not in ("GOLD", "SDR") and flags.get(c)]
    title = f"Currency Converter Tanzania: USD to TZS, TZS to USD at the BOT rate ({dt.date.fromisoformat(latest_day).strftime('%-d %b %Y')})"
    desc = (f"Free currency converter for Tanzania. Convert dollars to shillings (1 USD = {fmt(m)} TZS), shillings to dollars, "
            f"euro, pound, KES and 40 more at the Bank of Tanzania reference rate for {date}.")
    faq = [
        ("How much is 1 dollar in Tanzanian shillings today?",
         f"At the Bank of Tanzania mean rate for {date}, 1 US dollar is {fmt(m)} TZS."),
        ("Which rate does the converter use?",
         "The Bank of Tanzania (BOT) reference rate for the latest BOT date. You can switch between the BOT mean, buying and selling rates."),
        ("Can I convert between two foreign currencies, like euro to Kenyan shilling?",
         "Yes. The converter goes through the Tanzanian shilling using BOT rates for both currencies."),
        ("Is this the price a bank or bureau de change will give me?",
         "No. Banks and bureaux set their own prices around the BOT reference rate. Use this to know the fair reference before you exchange."),
    ]
    popular = "".join(f'<a class="pop" href="{slug}"><img class="flag" src="flags/{flags.get(code)}.svg" alt="" width="20" height="20">{phrase}</a>'
                      for code, slug, phrase in FOREIGN_PAIRS) + \
        '<a class="pop" href="tzs-to-usd"><img class="flag" src="flags/tz.svg" alt="" width="20" height="20">TZS to USD</a>' + \
        '<a class="pop" href="bei-ya-dola-leo"><img class="flag" src="flags/tz.svg" alt="" width="20" height="20">Bei ya dola leo</a>'
    body = f"""
<section class="pair-hero conv-hero">
  <p class="status"><span class="stamp-sm">BOT · {esc(dt.date.fromisoformat(latest_day).strftime('%d %b %Y').upper())}</span><span>Bank of Tanzania reference rates</span></p>
  <h1>Currency converter: dollars to shillings and back</h1>
  <div class="panel cc" id="cc">
    <div class="cc-row">
      <label class="cc-side"><span class="label">From</span>
        <span class="conv-field"><img class="flag" id="cc-from-flag" src="flags/us.svg" alt="" width="28" height="28"><select id="cc-from" aria-label="From currency"></select><input id="cc-amount" inputmode="decimal" value="100" aria-label="Amount"></span></label>
      <button type="button" class="cc-swap" id="cc-swap" aria-label="Swap currencies"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v14m0 0l-3-3m3 3l3-3M17 20V6m0 0l-3 3m3-3l3 3"/></svg></button>
      <label class="cc-side"><span class="label">To</span>
        <span class="conv-field"><img class="flag" id="cc-to-flag" src="flags/tz.svg" alt="" width="28" height="28"><select id="cc-to" aria-label="To currency"></select><output id="cc-out" aria-live="polite">{fmt(100 * m, 2)}</output></span></label>
    </div>
    <div class="cc-chips" id="cc-chips">{"".join(f'<button type="button" data-amt="{a}">{a:,}</button>' for a in [1, 10, 50, 100, 500, 1000, 10000])}</div>
    <p class="cc-result" id="cc-result">100 US Dollar = {fmt(100 * m, 2)} Tanzanian Shilling</p>
    <div class="cc-foot">
      <div class="seg" role="group" aria-label="BOT rate" id="cc-rate"><button data-r="m" aria-pressed="true">Mean</button><button data-r="b">BOT buying</button><button data-r="s">BOT selling</button></div>
      <p class="meta" id="cc-note">BOT rate for {date}</p>
    </div>
  </div>
</section>
<section class="section">
  <h2>Popular conversions</h2>
  <div class="pops">{popular}</div>
</section>
<section class="section">
  <h2>Questions</h2>
  <dl class="faq">{"".join(f"<div><dt>{esc(q)}</dt><dd>{esc(a)}</dd></div>" for q, a in faq)}</dl>
  <p class="pair-links">Building an app or website? Use the same rates through the free <a href="{site.rstrip('/')}#api">Exchange Rates API</a>.</p>
</section>
<script>
(function () {{
  var D = {json.dumps(data, separators=(",", ":"))}, by = {{}}, kind = "m", DATE = {json.dumps(date)};
  D.forEach(function (x) {{ by[x.c] = x; }});
  var $ = function (id) {{ return document.getElementById(id); }};
  var q = new URLSearchParams(location.search);
  var opts = D.map(function (x) {{ return '<option value="' + x.c + '">' + x.c + '</option>'; }}).join("");
  $("cc-from").innerHTML = opts; $("cc-to").innerHTML = opts;
  $("cc-from").value = by[(q.get("from") || "").toUpperCase()] ? q.get("from").toUpperCase() : "USD";
  $("cc-to").value = by[(q.get("to") || "").toUpperCase()] ? q.get("to").toUpperCase() : "TZS";
  if (q.get("amount")) $("cc-amount").value = q.get("amount");
  function f(n) {{ var d = n >= 100 ? 2 : n >= 1 ? 3 : n >= .01 ? 4 : 6; return n.toLocaleString("en-US", {{ minimumFractionDigits: d, maximumFractionDigits: d }}); }}
  function num(v) {{ return parseFloat(String(v).replace(/[^0-9.]/g, "")) || 0; }}
  function run() {{
    var a = by[$("cc-from").value], b = by[$("cc-to").value], amt = num($("cc-amount").value);
    var out = amt * a[kind] / b[kind];
    $("cc-out").textContent = f(out);
    $("cc-from-flag").src = "flags/" + a.f + ".svg"; $("cc-to-flag").src = "flags/" + b.f + ".svg";
    $("cc-result").textContent = f(amt) + " " + a.n + " = " + f(out) + " " + b.n;
    var label = {{ m: "mean", b: "buying", s: "selling" }}[kind];
    var one = a.c !== "TZS" ? "1 " + a.c + " = " + f(a[kind]) + " TZS" : "1 " + b.c + " = " + f(b[kind]) + " TZS";
    $("cc-note").textContent = "BOT " + label + " rate for " + DATE + " · " + one;
    history.replaceState(null, "", location.pathname + "?from=" + a.c + "&to=" + b.c + "&amount=" + amt);
  }}
  ["cc-from", "cc-to", "cc-amount"].forEach(function (id) {{ $(id).addEventListener("input", run); $(id).addEventListener("change", run); }});
  $("cc-swap").addEventListener("click", function () {{ var t = $("cc-from").value; $("cc-from").value = $("cc-to").value; $("cc-to").value = t; run(); }});
  $("cc-chips").addEventListener("click", function (e) {{ var b = e.target.closest("[data-amt]"); if (b) {{ $("cc-amount").value = b.dataset.amt; run(); }} }});
  $("cc-rate").addEventListener("click", function (e) {{ var b = e.target.closest("[data-r]"); if (!b) return; kind = b.dataset.r;
    [].forEach.call($("cc-rate").children, function (x) {{ x.setAttribute("aria-pressed", x === b); }}); run(); }});
  run();
}})();
</script>"""
    return shell(site, "converter", title, desc, body, faq, flag="tz")


def write_pages(out, site, latest_day, latest, all_days, names, flags):
    """Write <slug>.html pages (GitHub Pages serves them extensionless) and return their slugs."""
    def series(code):
        return [(d, *all_days[d][code]) for d in sorted(all_days) if code in all_days[d]]

    slugs = []
    for code, slug, phrase in FOREIGN_PAIRS:
        if code not in latest:
            continue
        (out / f"{slug}.html").write_text(foreign_page(site, code, slug, phrase, names.get(code, code), flags.get(code),
                                                        latest_day, latest[code], series(code)))
        slugs.append(slug)
    (out / "tzs-to-usd.html").write_text(reverse_page(site, latest_day, latest["USD"], series("USD")))
    (out / "bei-ya-dola-leo.html").write_text(swahili_page(site, latest_day, latest, series("USD")))
    (out / "converter.html").write_text(converter_page(site, latest_day, latest, names, flags))
    return ["converter"] + slugs + ["tzs-to-usd", "bei-ya-dola-leo"]
