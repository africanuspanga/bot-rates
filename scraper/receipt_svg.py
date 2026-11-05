"""Render the hero visual: a bureau-counter receipt printed with the latest BOT rates,
with an orange rubber date stamp. Pure SVG, regenerated on every build from real data."""
import datetime as dt
import hashlib

PAPER, PAPER_SHADE, INK, INK_SOFT, STAMP = "#FFFFFF", "#F2F2F2", "#0A0A0A", "#6B6B6B", "#0A0A0A"
MONO = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace"
ROWS = ["USD", "EUR", "GBP", "KES", "UGX", "ZAR", "AED", "CNY"]


def fmt(n):
    if n is None:
        return "–"
    d = 2 if n >= 100 else 3 if n >= 1 else 4
    return f"{n:,.{d}f}"


def zigzag(x0, x1, y, tooth=7, depth=6, up=False):
    pts, x, i = [], x0, 0
    while x < x1:
        pts.append(f"{x:.1f},{y + (0 if i % 2 == 0 else (-depth if up else depth)):.1f}")
        x += tooth
        i += 1
    pts.append(f"{x1:.1f},{y:.1f}")
    return pts


def barcode(seed, x, y, w, h):
    bits = hashlib.sha1(seed.encode()).digest()
    out, cx = [], x
    for b in bits * 3:
        bw = 1 + b % 3
        if cx + bw > x + w:
            break
        if b % 2:
            out.append(f'<rect x="{cx}" y="{y}" width="{bw}" height="{h}"/>')
        cx += bw + 1
    return "".join(out)


def render(date_iso, rates, checked_utc=None):
    d = dt.date.fromisoformat(date_iso)
    stamp_date = d.strftime("%d %b %Y").upper()
    by = {r["code"]: r for r in rates}
    rows = [c for c in ROWS if c in by]
    X0, X1 = 76, 484                       # paper edges
    top, line = 52, 34
    body_top = top + 150
    bottom = body_top + len(rows) * line + 188
    checked = ""
    if checked_utc:
        t = dt.datetime.fromisoformat(checked_utc.replace("Z", "+00:00")) + dt.timedelta(hours=3)
        checked = t.strftime("%d %b %Y %H:%M") + " EAT"

    edge = zigzag(X0, X1, top, up=True) + list(reversed(zigzag(X0, X1, bottom)))
    paper = "M" + " L".join(edge) + " Z"

    t = []  # text lines
    cx = (X0 + X1) / 2
    t.append(f'<text x="{cx}" y="{top + 44}" text-anchor="middle" font-size="17" font-weight="600" letter-spacing="2">EXCHANGE RATES</text>')
    t.append(f'<text x="{cx}" y="{top + 68}" text-anchor="middle" font-size="12" fill="{INK_SOFT}">Bank of Tanzania reference rates</text>')
    t.append(f'<text x="{cx}" y="{top + 86}" text-anchor="middle" font-size="12" fill="{INK_SOFT}">TZS per 1 unit · {d.strftime("%a %d %b %Y")}</text>')
    t.append(f'<line x1="{X0 + 24}" x2="{X1 - 24}" y1="{top + 108}" y2="{top + 108}" stroke="{INK}" stroke-dasharray="4 5" opacity=".5"/>')
    t.append(f'<text x="{X0 + 28}" y="{top + 134}" font-size="11.5" fill="{INK_SOFT}">CUR</text>'
             f'<text x="{X1 - 150}" y="{top + 134}" text-anchor="end" font-size="11.5" fill="{INK_SOFT}">BUYING</text>'
             f'<text x="{X1 - 28}" y="{top + 134}" text-anchor="end" font-size="11.5" fill="{INK_SOFT}">SELLING</text>')
    for i, c in enumerate(rows):
        y = body_top + 18 + i * line
        r = by[c]
        t.append(f'<text x="{X0 + 28}" y="{y}" font-size="15" font-weight="600">{c}</text>'
                 f'<text x="{X1 - 150}" y="{y}" text-anchor="end" font-size="15">{fmt(r["buying"])}</text>'
                 f'<text x="{X1 - 28}" y="{y}" text-anchor="end" font-size="15">{fmt(r["selling"])}</text>')
    fy = body_top + len(rows) * line + 8
    t.append(f'<line x1="{X0 + 24}" x2="{X1 - 24}" y1="{fy}" y2="{fy}" stroke="{INK}" stroke-dasharray="4 5" opacity=".5"/>')
    t.append(f'<text x="{X0 + 28}" y="{fy + 28}" font-size="12" fill="{INK_SOFT}">Source</text>'
             f'<text x="{X1 - 28}" y="{fy + 28}" text-anchor="end" font-size="12">bot.go.tz</text>')
    if checked:
        t.append(f'<text x="{X0 + 28}" y="{fy + 48}" font-size="12" fill="{INK_SOFT}">Fetched</text>'
                 f'<text x="{X1 - 28}" y="{fy + 48}" text-anchor="end" font-size="12">{checked}</text>')
    t.append(f'<g fill="{INK}" opacity=".85">{barcode(date_iso, X0 + 28, fy + 76, 170, 38)}</g>')
    t.append(f'<text x="{X0 + 28}" y="{fy + 160}" font-size="10.5" fill="{INK_SOFT}">Independent mirror · not issued by BOT</text>')

    sx, sy = X1 - 116, fy + 100   # stamp centre: over the footer, clear of the rates
    stamp = (f'<g transform="translate({sx} {sy}) rotate(-8)" filter="url(#ink)" opacity=".9" style="mix-blend-mode:multiply">'
             f'<rect x="-92" y="-38" width="184" height="76" rx="10" fill="none" stroke="{STAMP}" stroke-width="3.5"/>'
             f'<rect x="-84" y="-30" width="168" height="60" rx="6" fill="none" stroke="{STAMP}" stroke-width="1.5"/>'
             f'<text x="0" y="-6" text-anchor="middle" font-size="12" font-weight="600" letter-spacing="3" fill="{STAMP}">BOT RATE</text>'
             f'<text x="0" y="17" text-anchor="middle" font-size="19" font-weight="600" letter-spacing="1" fill="{STAMP}">{stamp_date}</text></g>')

    H = bottom + 60
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 {H}" width="560" height="{H}" role="img" aria-label="Receipt showing Bank of Tanzania reference rates for {d.strftime("%d %B %Y")}">
<defs>
  <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{PAPER}"/><stop offset=".7" stop-color="{PAPER}"/><stop offset="1" stop-color="{PAPER_SHADE}"/></linearGradient>
  <filter id="shadow" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000000" flood-opacity=".14"/><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity=".1"/></filter>
  <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency=".35" numOctaves="1" seed="3" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.5" result="mask"/>
    <feComposite in="d" in2="mask" operator="in"/>
  </filter>
</defs>
<g transform="rotate(-2.5 280 {H / 2:.0f})" font-family="{MONO}" fill="{INK}">
  <path d="{paper}" fill="url(#paper)" filter="url(#shadow)"/>
  {"".join(t)}
  {stamp}
</g>
</svg>
'''
