"""Fetch and validate ECMWF IFS precipitation forecasts via Open-Meteo.

Precipitation is total liquid + snow water-equivalent (mm); snowfall is
reported in cm, with water-equivalent approximated as snowfall/7 by Open-Meteo.
Hourly fields are amounts for the PRECEDING hour, timestamped at interval end.
"""
from datetime import datetime, timezone, timedelta
from math import isfinite
from typing import Any

import httpx

URL = "https://api.open-meteo.com/v1/ecmwf"
MODEL = "ecmwf_ifs"
HOURS = 72


class ForecastError(Exception):
    """An upstream error or incomplete/invalid forecast."""


def parse_timestamp(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (ValueError, AttributeError, TypeError) as exc:
        raise ForecastError("Geçersiz saat damgası") from exc


def _number(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
        raise ForecastError(f"Eksik veya geçersiz {name} verisi")
    if value < 0:
        raise ForecastError(f"Negatif {name} verisi")
    return float(value)


def parse_forecast(payload: dict, now: datetime | None = None) -> dict:
    """Keep the first 72 COMPLETE consecutive future hourly intervals.

    Fail closed: no fabricated zero-fill for missing hours/variables. Forecast
    totals are not an empirically calibrated flood-risk probability.
    """
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    now = now.astimezone(timezone.utc)
    try:
        hourly = payload["hourly"]
        units = payload["hourly_units"]
        times, precip, snow = hourly["time"], hourly["precipitation"], hourly["snowfall"]
        assert isinstance(times, list) and isinstance(precip, list) and isinstance(snow, list)
    except (KeyError, AssertionError, TypeError) as exc:
        raise ForecastError("ECMWF saatlik yağış alanları eksik") from exc
    if units.get("precipitation") != "mm" or units.get("snowfall") != "cm":
        raise ForecastError("Beklenmeyen yağış veya kar birimi")
    if not (len(times) == len(precip) == len(snow)):
        raise ForecastError("Saat ve yağış dizilerinin uzunluğu farklı")

    rows: list[dict] = []
    prev: datetime | None = None
    for raw_time, raw_p, raw_s in zip(times, precip, snow):
        t = parse_timestamp(raw_time)
        if prev is not None and t <= prev:
            raise ForecastError("Saatler sıralı ve tekil olmalı")
        prev = t
        if t <= now:
            continue
        if len(rows) >= HOURS:
            break
        p = _number(raw_p, "toplam yağış")
        s_cm = _number(raw_s, "kar yağışı")
        if rows and t - parse_timestamp(rows[-1]["time_utc"]) != timedelta(hours=1):
            raise ForecastError("72 saatlik tahminde boş saat var")
        if s_cm / 7 > p + 0.2:
            raise ForecastError("Kar su eşdeğeri toplam yağışı aşıyor")
        liquid = max(0.0, p - s_cm / 7)
        rows.append({
            "time_utc": t.isoformat().replace("+00:00", "Z"),
            "precipitation_mm": round(p, 4),
            "liquid_precipitation_mm": round(liquid, 4),
            "snowfall_cm": round(s_cm, 4),
        })
    if len(rows) != HOURS:
        raise ForecastError(f"72 saatlik tahmin tamamlanamadı ({len(rows)}/72 saat)")
    if parse_timestamp(rows[0]["time_utc"]) - now > timedelta(hours=1):
        raise ForecastError("Tahmin başlangıcında saat boşluğu var")

    totals = {}
    for count in (24, 48, 72):
        totals[str(count)] = {
            "total_precipitation_mm": round(sum(r["precipitation_mm"] for r in rows[:count]), 2),
            "liquid_precipitation_mm": round(sum(r["liquid_precipitation_mm"] for r in rows[:count]), 2),
        }
    return {
        "source": "Open-Meteo ECMWF API",
        "model_requested": MODEL,
        "model_run_verified": False,
        "requested_at_utc": now.isoformat().replace("+00:00", "Z"),
        "interval_definition": "preceding_hour_ending_at_time_utc",
        "hours": HOURS,
        "totals_mm": totals,
        "hourly": rows,
        "notice": "Deneysel yağış analizi; taşkın tehlikesi, seviyesi veya uyarısı değildir.",
        "snow_conversion": "snowfall_cm / 7 ≈ snowfall water-equivalent mm (Open-Meteo estimate)",
    }


async def fetch_forecast(lat: float, lon: float, client: httpx.AsyncClient | None = None, now: datetime | None = None) -> dict:
    params = {
        "latitude": lat, "longitude": lon,
        "hourly": "precipitation,snowfall", "models": MODEL,
        "forecast_hours": 96, "timezone": "UTC", "precipitation_unit": "mm",
    }
    try:
        if client is None:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as upstream:
                response = await upstream.get(URL, params=params)
        else:
            response = await client.get(URL, params=params)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict) or payload.get("error"):
            raise ForecastError("Tahmin servisi bir hata döndürdü")
        result = parse_forecast(payload, now=now)
        result["coordinates"] = {"latitude": lat, "longitude": lon}
        return result
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError) as exc:
        raise ForecastError("ECMWF/Open-Meteo verisi alınamadı; sahte tahmin gösterilmiyor") from exc
