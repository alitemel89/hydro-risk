from datetime import datetime, timedelta, timezone
import math
import pytest
import httpx
from fastapi.testclient import TestClient
from app.forecast import ForecastError, fetch_forecast, parse_forecast
from app.main import app

NOW = datetime(2026, 11, 19, 12, 30, tzinfo=timezone.utc)


def fixture(n=72, p=1.0, s=0.0, start=None):
    start = start or NOW.replace(minute=0) + timedelta(hours=1)
    return {
        "hourly_units": {"precipitation": "mm", "snowfall": "cm"},
        "hourly": {
            "time": [(start + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(n)],
            "precipitation": [p] * n,
            "snowfall": [s] * n,
        },
    }


def test_totals_24_48_72():
    x = parse_forecast(fixture(p=2), NOW)
    assert [x['totals_mm'][str(h)]['total_precipitation_mm'] for h in (24, 48, 72)] == [48, 96, 144]


def test_hour_count_and_timestamp():
    x = parse_forecast(fixture(), NOW)
    assert len(x["hourly"]) == 72
    assert x["hourly"][0]["time_utc"] == "2026-11-19T13:00:00Z"


def test_snow_conversion():
    x = parse_forecast(fixture(p=10, s=7), NOW)
    assert x['totals_mm']['24']['liquid_precipitation_mm'] == 216


def test_null_precipitation_fails_closed():
    f = fixture()
    f["hourly"]["precipitation"][2] = None
    with pytest.raises(ForecastError): parse_forecast(f, NOW)


def test_null_snowfall_fails_closed():
    f = fixture()
    f["hourly"]["snowfall"][2] = None
    with pytest.raises(ForecastError): parse_forecast(f, NOW)


def test_wrong_unit_fails_closed():
    f = fixture()
    f["hourly_units"]["snowfall"] = "mm"
    with pytest.raises(ForecastError): parse_forecast(f, NOW)


def test_non_consecutive_hours_fails_closed():
    f = fixture()
    f["hourly"]["time"][5] = '2026-11-19T19:00'
    with pytest.raises(ForecastError): parse_forecast(f, NOW)


def test_short_forecast_fails_closed():
    with pytest.raises(ForecastError): parse_forecast(fixture(n=71), NOW)


def test_expired_hours_are_skipped():
    f = fixture(n=75, start=NOW.replace(minute=0)-timedelta(hours=2))
    x = parse_forecast(f, NOW)
    assert len(x['hourly']) == 72


def test_negative_values_rejected():
    with pytest.raises(ForecastError): parse_forecast(fixture(p=-1), NOW)


def test_nan_values_rejected():
    with pytest.raises(ForecastError): parse_forecast(fixture(p=math.nan), NOW)


def test_snowwater_more_than_total_rejected():
    with pytest.raises(ForecastError): parse_forecast(fixture(p=0, s=7), NOW)


def test_health_places_and_invalid_coordinates():
    c = TestClient(app)
    assert c.get('/health').status_code == 200
    assert len(c.get('/api/places').json()['places']) == 4
    assert c.get('/api/forecast?lat=91&lon=27').status_code == 422
    assert 'İZMİR72' in c.get('/').text


@pytest.mark.anyio
async def test_fetch_with_mock_upstream():
    def handler(request):
        assert request.url.params['models'] == 'ecmwf_ifs'
        assert request.url.params['hourly'] == 'precipitation,snowfall'
        return httpx.Response(200, json=fixture())
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        data = await fetch_forecast(38.4, 27.1, client=client, now=NOW)
    assert data['coordinates'] == {'latitude': 38.4, 'longitude': 27.1}
    assert data['model_run_verified'] is False


@pytest.mark.anyio
async def test_upstream_503_fails_without_dummy_values():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(503))) as client:
        with pytest.raises(ForecastError):
            await fetch_forecast(38.4, 27.1, client=client, now=NOW)


@pytest.fixture
def anyio_backend():
    return 'asyncio'
