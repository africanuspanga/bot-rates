#!/usr/bin/env python3
"""Fetch Bank of Tanzania (BOT) indicative exchange rates and store them as yearly JSON.

Usage:
  python scraper/bot_rates.py daily                 # today's page + last 14 days of history
  python scraper/bot_rates.py backfill [--from YYYY] [--to YYYY]

Storage: data/history/<year>.json  ->  {"YYYY-MM-DD": {"USD": [buy, sell, mean], ...}, ...}
Standard library only, so it runs on any GitHub Actions runner without installs.
"""
import argparse
import datetime as dt
import html
import http.cookiejar
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://www.bot.go.tz"
TODAY_URL = f"{BASE}/ExchangeRate/excRates?lang=en"
HISTORY_URL = f"{BASE}/ExchangeRate/previous_rates"
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "history"
FIRST_YEAR = 1999
UA = "Mozilla/5.0 (compatible; BOT-Rates-Mirror/1.0; daily fetch of public BOT rates)"

# Sanity bounds for USD/TZS; anything outside means the page changed or returned junk.
USD_MIN, USD_MAX = 500, 10_000
MIN_CURRENCIES_TODAY = 35
# Buy/sell must sit within this fraction of the mean. BOT sometimes publishes buy slightly
# above sell (e.g. BIF in 2024-25), which is kept as published; only gross typos are rejected.
SPREAD_TOLERANCE = 0.25


class ScrapeError(RuntimeError):
    pass


def make_opener():
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.addheaders = [("User-Agent", UA), ("Accept-Language", "en")]
    return opener


def fetch(opener, url, data=None, retries=4, timeout=90):
    body = urllib.parse.urlencode(data).encode() if data else None
    for attempt in range(1, retries + 1):
        try:
            with opener.open(url, data=body, timeout=timeout) as r:
                return r.read().decode("utf-8", errors="replace")
        except Exception as e:  # network hiccups, 5xx
            if attempt == retries:
                raise ScrapeError(f"GET/POST {url} failed after {retries} tries: {e}") from e
            time.sleep(5 * attempt)


def parse_date(s):
    # BOT uses dd-Mon-yy, e.g. 05-Nov-26
    d = dt.datetime.strptime(s.strip(), "%d-%b-%y").date()
    if d.year > dt.date.today().year + 1:  # 2-digit year pivot safety
        d = d.replace(year=d.year - 100)
    return d


def num(s):
    s = s.strip().replace(",", "")
    return float(s) if s else None


def parse_rates_table(page):
    """Return {date_iso: {code: [buy, sell, mean]}} from any BOT rates table."""
    out = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
        cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip()
                 for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if len(cells) < 6 or not re.fullmatch(r"\d{2}-[A-Za-z]{3}-\d{2}", cells[5]):
            continue
        code = cells[1].upper()
        if not re.fullmatch(r"[A-Z]{3,5}", code):
            continue
        try:
            buy, sell, mean = num(cells[2]), num(cells[3]), num(cells[4])
            day = parse_date(cells[5]).isoformat()
        except ValueError:
            continue
        if mean is None:
            continue
        out.setdefault(day, {})[code] = [buy, sell, mean]
    return out


def row_ok(code, row):
    b, s, m = row
    if m is None or m <= 0:
        return False
    if code == "USD" and not (USD_MIN < m < USD_MAX):
        return False
    return all(x is None or abs(x - m) <= m * SPREAD_TOLERANCE for x in (b, s))


def validate(rates, strict_day=None):
    if not rates:
        raise ScrapeError("No rate rows parsed - BOT page layout may have changed.")
    today = dt.date.today()
    for day, cur in rates.items():
        if dt.date.fromisoformat(day) > today + dt.timedelta(days=1):
            raise ScrapeError(f"Rate date {day} is in the future.")
        usd = cur.get("USD")
        if usd and not (USD_MIN < usd[2] < USD_MAX):
            raise ScrapeError(f"USD mean {usd[2]} on {day} outside sane range.")
        for code, row in cur.items():
            if not row_ok(code, row):
                raise ScrapeError(f"{code} on {day}: implausible buy/sell/mean {row}.")
    if strict_day:
        n = len(rates.get(strict_day, {}))
        if n < MIN_CURRENCIES_TODAY:
            raise ScrapeError(f"Only {n} currencies for {strict_day}; expected >= {MIN_CURRENCIES_TODAY}.")
        if "USD" not in rates[strict_day]:
            raise ScrapeError(f"USD missing for {strict_day}.")


def fetch_today(opener):
    rates = parse_rates_table(fetch(opener, TODAY_URL))
    if len(rates) != 1:
        raise ScrapeError(f"Expected one trade date on today's page, got {sorted(rates)}")
    validate(rates, strict_day=next(iter(rates)))
    return rates


def fetch_range(opener, start, end):
    form_page = fetch(opener, f"{HISTORY_URL}?lang=en")
    m = re.search(r'action="/ExchangeRate/previous_rates".*?name="__RequestVerificationToken"'
                  r'[^>]*value="([^"]+)"', form_page, re.S)
    if not m:
        raise ScrapeError("History form token not found - BOT page layout may have changed.")
    page = fetch(opener, HISTORY_URL, data={
        "__RequestVerificationToken": m.group(1),
        "dateFrom": start.strftime("%m/%d/%Y"),
        "dateTo": end.strftime("%m/%d/%Y"),
    })
    return drop_bad_rows(parse_rates_table(page))


def drop_bad_rows(rates):
    """BOT's archive has occasional typos (e.g. a mean 10^6x too big); skip those rows."""
    for day, cur in rates.items():
        for code, row in list(cur.items()):
            if not row_ok(code, row):
                print(f"  skipped bad BOT row: {day} {code} buy/sell/mean={row}", file=sys.stderr)
                del cur[code]
    return {d: c for d, c in rates.items() if c}


def load_year(year):
    p = DATA_DIR / f"{year}.json"
    return json.loads(p.read_text()) if p.exists() else {}


def save(rates):
    """Merge rates into yearly files. Returns list of changed dates."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    by_year = {}
    for day, cur in rates.items():
        by_year.setdefault(day[:4], {})[day] = cur
    changed = []
    for year, days in by_year.items():
        existing = load_year(year)
        for day, cur in days.items():
            if existing.get(day) != cur:
                existing[day] = dict(sorted(cur.items()))
                changed.append(day)
        ordered = dict(sorted(existing.items()))
        (DATA_DIR / f"{year}.json").write_text(
            "{\n" + ",\n".join(f'"{d}":{json.dumps(v, separators=(",", ":"))}'
                               for d, v in ordered.items()) + "\n}\n")
    return sorted(changed)


def cmd_daily(_args):
    opener = make_opener()
    today_rates = fetch_today(opener)
    end = dt.date.today()
    recent = fetch_range(opener, end - dt.timedelta(days=14), end)
    merged = {**recent, **today_rates}  # today's page wins for its date
    changed = save(merged)
    latest = max(merged)
    print(f"Latest BOT trade date: {latest} ({len(merged[latest])} currencies, "
          f"USD mean {merged[latest]['USD'][2]}). Updated dates: {changed or 'none'}")


def cmd_backfill(args):
    opener = make_opener()
    this_year = dt.date.today().year
    for year in range(args.from_year, (args.to_year or this_year) + 1):
        start = dt.date(year, 1, 1)
        end = min(dt.date(year, 12, 31), dt.date.today())
        rates = fetch_range(opener, start, end)
        changed = save(rates)
        print(f"{year}: {len(rates)} days fetched, {len(changed)} new/updated")
        time.sleep(2)  # be gentle with BOT's server


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("daily").set_defaults(fn=cmd_daily)
    b = sub.add_parser("backfill")
    b.add_argument("--from", dest="from_year", type=int, default=FIRST_YEAR)
    b.add_argument("--to", dest="to_year", type=int)
    b.set_defaults(fn=cmd_backfill)
    args = ap.parse_args()
    try:
        args.fn(args)
    except ScrapeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
