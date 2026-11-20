# HydroRisk

HydroRisk is an experimental hydrology and precipitation-analysis project focused on the Aegean region of Türkiye.

## Repository status — 20 November 2026

**Available source code:** [`izmir72/`](./izmir72/) contains the complete standalone HydroRisk İzmir72 v0.1 package (FastAPI, ECMWF/Open-Meteo request and validation code, Turkish browser UI, dependency files, unit tests). The unit test suite passed locally (15 tests). A GitHub Actions test workflow is included, but its remote execution must be confirmed separately.

**Important: not a complete mirror of the published site.** The original source code of the existing HydroRisk interactive map website is not present in this repository or in the accessible project files. The public website and this branch are not yet integrated. The original site's map, CORINE layers, Green-Ampt infiltration, SCS-CN, catchment functionality, historical 2024-study interface, and any supporting server code must be exported/recovered or reimplemented and tested before claiming full application coverage.

Published experimental site: https://hydro-risk.aylintemel-de.chatgpt.site

## Run İzmir72

```bash
cd izmir72
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
uvicorn app.main:app --reload
# Open http://127.0.0.1:8000
python -m pytest -q
```

### Research and safety limitations

This prototype shows point precipitation forecasts from Open-Meteo ECMWF IFS, not verified real-time flood alerts, calibrated flood discharge, flood depth, probability or safety advice. Missing forecasts cause an explicit error instead of guessed values. Do not use this system for life-safety decisions; check official MGM and AFAD warnings.

## Next milestones

1. Retrieve/export the **original deployed HydroRisk site source** and identify all services and environment variables (never commit secrets).
2. Add the full frontend and hydrology modules to this repository with reproducible tests, maintaining the original site separately until verified.
3. Integrate İzmir72 through a stable API and validate with observation-based case studies.
4. Deploy a test/staging environment, then consider release after scientific and operational review.
