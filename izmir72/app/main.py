"""HydroRisk İzmir72 self-contained public research prototype."""
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse
from .forecast import ForecastError, fetch_forecast

app = FastAPI(title="HydroRisk İzmir72", version="0.1.0", description="Experimental ECMWF precipitation analysis; not a flood warning.")
INDEX = Path(__file__).with_name("index.html")

PLACES = [
    {"name": "İzmir Merkez", "lat": 38.4237, "lon": 27.1428},
    {"name": "Menderes", "lat": 38.2524, "lon": 27.1343},
    {"name": "Bornova", "lat": 38.4664, "lon": 27.2190},
    {"name": "Urla", "lat": 38.3236, "lon": 26.7640},
]


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return INDEX.read_text(encoding="utf-8")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "hydrorisk-izmir72", "warning": "not_an_operational_flood_warning"}


@app.get("/api/places")
def places() -> dict:
    return {"places": PLACES}


@app.get("/api/forecast")
async def forecast(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
) -> dict:
    try:
        return await fetch_forecast(lat, lon)
    except ForecastError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
