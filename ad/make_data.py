"""Pull the real BOT figures the film shows from the built API (../_site/api)."""
import json
from pathlib import Path

api = Path(__file__).resolve().parent.parent / "_site" / "api"
latest = json.loads((api / "latest.json").read_text())
by = {r["code"]: r for r in latest["rates"]}
cards = []
for code in ["KES", "EUR", "GBP", "UGX", "USD"]:
    rows = json.loads((api / "currency" / f"{code}.json").read_text())["rates"][-30:]
    r = by[code]
    cards.append({"code": code, "name": r["name"], "mean": r["mean"], "buy": r["buying"], "sell": r["selling"],
                  "pct": r["change"] / (r["mean"] - r["change"]) * 100 if r["change"] is not None else 0,
                  "line": [x[3] for x in rows]})
usd_hist = json.loads((api / "currency" / "USD.json").read_text())["rates"]
flags = {r["code"]: (r["flag"] or "").split("/")[-1].replace(".svg", "") for r in latest["rates"] if r.get("flag")}
data = {
    "date": latest["date"], "count": len(latest["rates"]),
    "ticker": [{"c": c, "m": by[c]["mean"], "p": cards[[x["code"] for x in cards].index(c)]["pct"] if c in [x["code"] for x in cards]
                else (by[c]["change"] / (by[c]["mean"] - by[c]["change"]) * 100 if by[c]["change"] is not None else 0), "f": flags.get(c)}
               for c in ["USD", "EUR", "GBP", "KES", "UGX", "RWF", "ZAR", "AED", "CNY", "INR", "JPY", "CHF", "SAR", "CAD"] if c in by],
    "flags": [flags[c] for c in sorted(flags) if c not in ("GOLD", "SDR")],
    "cards": cards,
    "receipt": [{"c": c, "b": by[c]["buying"], "s": by[c]["selling"]} for c in ["USD", "EUR", "GBP", "KES", "UGX", "ZAR", "AED", "CNY"]],
    "usdFirst": {"date": usd_hist[0][0], "mean": usd_hist[0][3]},
    "usdLast": {"date": usd_hist[-1][0], "mean": usd_hist[-1][3]},
    "json": [{"code": c, "buying": by[c]["buying"], "selling": by[c]["selling"], "mean": by[c]["mean"]} for c in ["AED", "EUR", "GBP", "KES", "USD"]],
}
Path(__file__).with_name("data.js").write_text("window.DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
print(data["date"], data["count"], data["usdFirst"], data["usdLast"]["mean"], len(data["flags"]))
