# Exchange Rates: Bank of Tanzania daily exchange rates for developers

A project by [Driftmark Technologies](https://www.driftmark.co.tz/). Independent, not an official Bank of Tanzania service.

The Bank of Tanzania (BOT) publishes indicative exchange rates once per trading day on
[bot.go.tz](https://www.bot.go.tz/ExchangeRate/excRates?lang=en) but offers no API.
This repo reads that page every day with GitHub Actions and publishes the rates as free,
static JSON/CSV files plus a copy-paste website widget on GitHub Pages.

- **No keys, no sign-up, no server.** Everything is plain files on GitHub Pages (CORS enabled).
- **History from 24 June 1999** to today, ~10,000 days, 44 active currencies plus gold and SDR.
- **Fails safe.** If BOT changes its page or returns implausible numbers, the run fails
  (GitHub emails the repo owner) and yesterday's data stays live.

## API

`BASE` is `https://www.driftmark.co.tz/exchange-rates/` (served from GitHub Pages through a rewrite on driftmark.co.tz).

| What | URL |
|---|---|
| Today, all currencies (JSON) | `BASE/api/latest.json` |
| Today (CSV) | `BASE/api/latest.csv` |
| One currency, full history | `BASE/api/currency/USD.json` |
| One year, all currencies | `BASE/api/history/2025.json` or `.csv` |
| Currency list | `BASE/api/currencies.json` |
| Guide for AI assistants | `BASE/llms.txt` |
| OpenAPI 3 spec | `BASE/openapi.json` |

All rates are **TZS per 1 unit** of the foreign currency (gold per troy ounce).

`latest.json`:
```json
{
  "base": "TZS", "date": "2026-11-05", "previous_date": "2026-11-04",
  "rates": [
    { "code": "USD", "name": "US Dollar", "buying": 2627.2376, "selling": 2653.51, "mean": 2640.3738, "change": 0.37 }
  ]
}
```
`currency/USD.json` rows are `[date, buying, selling, mean]`; `history/<year>.json` maps
`date -> { code: [buying, selling, mean] }`.

## Widget

```html
<script src="BASE/widget.js"
        data-currencies="USD,EUR,GBP,KES"
        data-buy-margin="1" data-sell-margin="1.5"
        data-theme="paper"></script>
```
Options: `data-currencies`, `data-buy-margin` / `data-sell-margin` (percent below/above BOT),
`data-theme` (`paper`, `plain`, `dark`), `data-title`, `data-target` (CSS selector to render into).
The site's **Widget** section builds this snippet with a live preview.

## How it works

```
GitHub Actions (06:00 + 10:00 UTC)
  scraper/bot_rates.py daily   -> reads today's page + last 14 days of history, validates
  data/history/<year>.json     -> raw BOT data, committed (source of truth)
  scraper/build_api.py         -> drops one-day BOT typos, writes _site/api/*, copies web/
  deploy to GitHub Pages
```

Run locally (Python 3.10+, standard library only):
```bash
python scraper/bot_rates.py daily               # update data/
python scraper/bot_rates.py backfill --from 1999
python scraper/build_api.py && python -m http.server -d _site 8000
```

## Data quality

BOT's archive has occasional typos. Rows whose buying/selling are more than 25% from the mean
are skipped at fetch time. In the published API, a value is also left out when it is more than 30%
away from both the previous and next days, or more than 6% away from both while those neighbours
agree with each other. Real moves such as Brexit or the 2015 Swiss franc unpeg are kept; raw values
stay in `data/`.

## Disclaimer

Data © Bank of Tanzania, published for public information. Exchange Rates is a project by
Driftmark Technologies and an independent mirror, not affiliated with or endorsed by BOT. Rates are indicative; bureaus and banks set their
own prices. Verify on bot.go.tz before relying on a figure.
