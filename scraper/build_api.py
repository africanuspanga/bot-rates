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
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "history"
WEB = ROOT / "web"
OUT = ROOT / "_site"
API = OUT / "api"
SOURCE = "Bank of Tanzania (bot.go.tz) indicative exchange rates"

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


def find_spikes(all_days, window=5, tolerance=0.3):
    """(date, code) pairs where BOT's archive has a one-off typo: the mean is >30% away from
    both the previous and the next few days. Real level shifts (devaluations) match one side."""
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
            if sides and all(abs(v - m) > m * tolerance for m in sides):
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
    (OUT / ".nojekyll").write_text("")
    print(f"Built _site: latest {latest_day}, {len(days)} days, {len(series)} currencies, "
          f"{len(spikes)} one-day BOT typos excluded")


if __name__ == "__main__":
    main()
