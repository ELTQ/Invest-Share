# market/fundamentals.py
import yfinance as yf

def fetch_fundamentals(symbol: str) -> dict:
    t = yf.Ticker(symbol)
    # fast_info is lightweight; .info is heavier but richer
    fast = getattr(t, "fast_info", {}) or {}
    info = getattr(t, "info", {}) or {}

    def pick(*keys, src=None):
        src = src or {}
        for k in keys:
            if k in src and src[k] not in (None, "", 0):
                return src[k]
        return None

    market_cap = pick("marketCap", src=fast) or pick("marketCap", src=info)
    pe         = pick("trailingPE", "forwardPE", "peRatio", src=info) or pick("pe", src=fast)
    eps        = pick("trailingEps", "epsTrailingTwelveMonths", src=info) or pick("eps", src=fast)

    return {
        "market_cap": market_cap,
        "pe": float(pe) if pe is not None else None,
        "eps": float(eps) if eps is not None else None,
    }

