#!/usr/bin/env python3
"""Build the static API + website into _site/ from data/history/*.json.

Output (all served as plain files, no server):
  api/latest.json, api/latest.csv        today's BOT rates, all currencies
  api/currencies.json                    code, name, first/last date
  api/history/<year>.json|.csv           every day of one year
  api/currency/<CODE>.json               full daily history of one currency
"""
import csv
import io
import json
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "history"
WEB = ROOT / "web"
OUT = ROOT / "_site"
API = OUT / "api"
SOURCE = "Bank of Tanzania (bot.go.tz) indicative exchange rates"
SITE_URL = os.environ.get("SITE_URL", "https://africanuspanga.github.io/bot-rates/").rstrip("/") + "/"

NAMES = {
    "AED": "UAE Dirham", "ATS": "Austrian Schilling", "AUD": "Australian Dollar", "BEF": "Belgian Franc",
    "BIF": "Burundi Franc", "BWP": "Botswana Pula", "CAD": "Canadian Dollar", "CHF": "Swiss Franc",
    "CNY": "Chinese Yuan", "CUC": "Cuban Convertible Peso", "DEM": "German Mark", "DKK": "Danish Krone",
    "DZD": "Algerian Dinar", "ESP": "Spanish Peseta", "EUR": "Euro", "FIM": "Finnish Markka",
    "FRF": "French Franc", "GBP": "British Pound", "GOLD": "Gold (troy ounce)", "HKD": "Hong Kong Dollar",
    "IDR": "Indonesian Rupiah", "IEP": "Irish Pound", "INR": "Indian Rupee", "IQD": "Iraqi Dinar",
    "IRR": "Iranian Rial", "ITL": "Italian Lira", "JPY": "Japanese Yen", "KES": "Kenyan Shilling",
    "KRW": "South Korean Won", "KWD": "Kuwaiti Dinar", "MWK": "Malawi Kwacha", "MXM": "Malawi Kwacha (old code)",
    "MXN": "Mexican Peso", "MYR": "Malaysian Ringgit", "MZM": "Mozambique Metical (old)", "NAD": "Namibian Dollar",
    "NGN": "Nigerian Naira", "NLG": "Dutch Guilder", "NOK": "Norwegian Krone", "NZD": "New Zealand Dollar",
    "PKR": "Pakistani Rupee", "PTE": "Portuguese Escudo", "QAR": "Qatari Riyal", "RWF": "Rwanda Franc",
    "SAR": "Saudi Riyal", "SDR": "IMF Special Drawing Right", "SEK": "Swedish Krona",
    "SGD": "Singapore Dollar", "TRY": "Turkish Lira", "UGX": "Uganda Shilling", "USD": "US Dollar",
    "ZAR": "South African Rand", "ZMK": "Zambian Kwacha (old)", "ZMW": "Zambian Kwacha",
    "ZWD": "Zimbabwe Dollar",
}


def find_spikes(all_days, window=5, tolerance=0.06, gross=0.3):
    """(date, code) pairs where BOT's archive has a typo. Two tests:
    - gross: >30% away from both the previous and next few days (catches decimal slips, even multi-day runs);
    - subtle: >6% away from both sides while those sides are within 6% of each other.
    Real trends and level shifts (devaluations, the 2015 CHF unpeg) match one side, so they are kept."""
    series = {}
    for d in sorted(all_days):
        for c, r in all_days[d].items():
            series.setdefault(c, []).append((d, r[2]))
    bad = set()
    for c, rows in series.items():
        vals = [v for _, v in rows]
        for i, (d, v) in enumerate(rows):
            before, after = vals[max(0, i - window):i], vals[i + 1:i + 1 + window]
            sides = [sorted(x)[len(x) // 2] for x in (before, after) if x]
            if not sides:
                continue
            ref = sum(sides) / len(sides)
            neighbours_agree = len(sides) == 1 or abs(sides[0] - sides[1]) <= ref * tolerance
            if all(abs(v - m) > m * gross for m in sides) or \
                    (neighbours_agree and all(abs(v - m) > m * tolerance for m in sides)):
                bad.add((d, c))
    return bad


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))


def write_csv(path, rows):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["date", "currency", "name", "buying", "selling", "mean"])
    w.writerows(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(buf.getvalue())


def rate_obj(code, row):
    b, s, m = row
    return {"code": code, "name": NAMES.get(code, code), "buying": b, "selling": s, "mean": m}


def write_agent_files(latest_day, codes, first_day):
    """llms.txt (plain-language guide for AI assistants) and openapi.json (machine-readable spec)."""
    u = SITE_URL
    (OUT / "llms.txt").write_text(f"""# Exchange Rates (Tanzania)

> Official Bank of Tanzania (BOT) daily reference exchange rates as a free JSON/CSV API.
> Rates are TZS per 1 unit of foreign currency (gold: per troy ounce). One rate per BOT trading
> day; weekends repeat the last trading day. History from {first_day}. Latest date: {latest_day}.
> No API key needed for these endpoints. Always tell the user the BOT date of any rate you quote,
> and that these are indicative reference rates, not a bank's or bureau's own price.

## Endpoints
- [Today's rates, all currencies]({u}api/latest.json): {{date, previous_date, rates:[{{code, name, buying, selling, mean, change}}]}}
- [Today's rates CSV]({u}api/latest.csv)
- [One currency, full daily history]({u}api/currency/USD.json): replace USD with any code; rows are [date, buying, selling, mean]
- [One year, all currencies]({u}api/history/{latest_day[:4]}.json): {{rates: {{"YYYY-MM-DD": {{"USD": [buying, selling, mean]}}}}}}; also .csv
- [Currency list]({u}api/currencies.json): code, name, first_date, last_date, active
- [OpenAPI spec]({u}openapi.json)

## How to answer common questions
- "USD rate today": GET api/latest.json, find code USD, quote buying/selling/mean and `date`.
- "Rate on a past date": GET api/history/<year>.json and use that date, or the closest earlier date.
- "Trend since X": GET api/currency/<CODE>.json and compare `mean` values.
- Converting TZS to foreign currency: amount_tzs / mean. Foreign to TZS: amount * mean.

## Currency codes
{", ".join(codes)}

## Source
Bank of Tanzania, https://www.bot.go.tz/ExchangeRate/excRates. This is an independent mirror, not affiliated with BOT.
""")
    rate = {"type": "object", "properties": {
        "code": {"type": "string", "example": "USD"}, "name": {"type": "string"},
        "buying": {"type": "number", "nullable": True}, "selling": {"type": "number", "nullable": True},
        "mean": {"type": "number"}, "change": {"type": "number", "nullable": True,
                                                "description": "Mean change vs previous BOT date, TZS"}}}
    write_json(OUT / "openapi.json", {
        "openapi": "3.0.3",
        "info": {"title": "Exchange Rates (Tanzania)", "version": "1.0.0",
                 "description": "Bank of Tanzania daily reference exchange rates. TZS per 1 unit of foreign currency. "
                                "Independent mirror of bot.go.tz, not affiliated with BOT."},
        "servers": [{"url": u.rstrip("/")}],
        "paths": {
            "/api/latest.json": {"get": {"operationId": "getLatestRates", "summary": "Today's BOT rates for all currencies",
                "responses": {"200": {"description": "Latest rates", "content": {"application/json": {"schema": {
                    "type": "object", "properties": {"date": {"type": "string", "format": "date"},
                                                     "previous_date": {"type": "string", "format": "date"},
                                                     "base": {"type": "string", "example": "TZS"},
                                                     "rates": {"type": "array", "items": rate}}}}}}}}},
            "/api/currency/{code}.json": {"get": {"operationId": "getCurrencyHistory", "summary": "Full daily history of one currency",
                "parameters": [{"name": "code", "in": "path", "required": True, "schema": {"type": "string", "enum": codes}}],
                "responses": {"200": {"description": "rates: array of [date, buying, selling, mean]"}}}},
            "/api/history/{year}.json": {"get": {"operationId": "getYearRates", "summary": "Every BOT date in one year, all currencies",
                "parameters": [{"name": "year", "in": "path", "required": True, "schema": {"type": "integer", "minimum": int(first_day[:4])}}],
                "responses": {"200": {"description": "rates: {date: {code: [buying, selling, mean]}}"}}}},
            "/api/currencies.json": {"get": {"operationId": "listCurrencies", "summary": "Currency codes, names and date coverage",
                "responses": {"200": {"description": "Currency list"}}}},
        },
    })


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(WEB, OUT)

    all_days = {}
    for f in sorted(DATA.glob("*.json")):
        all_days.update(json.loads(f.read_text()))
    spikes = set()
    while True:  # repeat: removing one typo can expose a neighbouring one (multi-day typo runs)
        found = find_spikes(all_days)
        if not found:
            break
        for d, c in found:
            del all_days[d][c]
        spikes |= found

    for f in sorted(DATA.glob("*.json")):
        year_days = {d: all_days[d] for d in sorted(all_days) if d.startswith(f.stem)}
        write_json(API / "history" / f"{f.stem}.json", {
            "source": SOURCE, "base": "TZS", "year": int(f.stem),
            "fields": ["buying", "selling", "mean"],
            "rates": year_days,
        })
        write_csv(API / "history" / f"{f.stem}.csv",
                  [[d, c, NAMES.get(c, c), *r] for d, cur in year_days.items() for c, r in cur.items()])

    days = sorted(all_days)
    latest_day = days[-1]
    prev_day = days[-2]
    latest = all_days[latest_day]
    write_json(API / "latest.json", {
        "source": SOURCE,
        "note": "TZS per 1 unit of foreign currency. Indicative rates; bureaus set their own prices.",
        "base": "TZS",
        "date": latest_day,
        "previous_date": prev_day,
        "rates": [{**rate_obj(c, r),
                   "change": round(r[2] - all_days[prev_day][c][2], 4) if c in all_days[prev_day] else None}
                  for c, r in sorted(latest.items())],
    })
    write_csv(API / "latest.csv", [[latest_day, c, NAMES.get(c, c), *r] for c, r in sorted(latest.items())])

    series = {}
    for d in days:
        for c, r in all_days[d].items():
            series.setdefault(c, []).append([d, *r])
    for c, rows in series.items():
        write_json(API / "currency" / f"{c}.json", {
            "source": SOURCE, "base": "TZS", "code": c, "name": NAMES.get(c, c),
            "fields": ["date", "buying", "selling", "mean"], "rates": rows,
        })
    write_json(API / "currencies.json", {
        "source": SOURCE, "latest_date": latest_day,
        "currencies": [{"code": c, "name": NAMES.get(c, c), "first_date": rows[0][0], "last_date": rows[-1][0],
                        "active": c in latest} for c, rows in sorted(series.items())],
    })
    write_agent_files(latest_day, sorted(latest), days[0])
    (OUT / ".nojekyll").write_text("")
    print(f"Built _site: latest {latest_day}, {len(days)} days, {len(series)} currencies, "
          f"{len(spikes)} one-day BOT typos excluded")


if __name__ == "__main__":
    main()
