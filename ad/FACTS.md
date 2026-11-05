# Facts used on screen

| Claim on screen | Source | Exact basis |
|---|---|---|
| 44 currencies | BOT exchange rate page, 5 Nov 2026 (api/latest.json) | 44 rows on bot.go.tz/ExchangeRate/excRates |
| Every day from bot.go.tz | .github/workflows/update.yml | Fetched 09:00 and 13:00 EAT daily; BOT posts a rate for every calendar day |
| USD/TZS 740.00 on 24 Jun 1999 | api/currency/USD.json first row | ["1999-06-24", 732.6, 747.4, 740.0] (BOT archive) |
| USD/TZS 2,640.37 on 5 Nov 2026 | api/latest.json | mean 2640.3738 |
| Card values (USD, EUR, GBP, KES, UGX) | api/latest.json, 5 Nov 2026 | means 2,640.37 / 2,974.91 / 3,563.98 / 20.303 / 0.6409 |
| 100 USD = 264,037.38 TZS | 100 × 2,640.3738 | BOT mean, 5 Nov 2026 |
| Free. No key. | The API serves static JSON with no authentication | |
| Since 1999 | First BOT archive date 24 Jun 1999 | |

Labels: the bureau website in beat 9 is an example ("Example bureau").
Disclaimer (final card): "Independent project by Driftmark Technologies. Not affiliated with or endorsed by the Bank of Tanzania. BOT reference rates for information only; banks and bureaux set their own prices."
Rates refresh: if the film is re-rendered on a later date, the values update from the API and this table is regenerated.
