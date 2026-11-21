CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE IF NOT EXISTS areas (
 id uuid PRIMARY KEY,
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
 geometry geometry(Polygon, 4326) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ST_IsValid(geometry)),
 CHECK (ST_Area(geometry::geography) > 0),
 CHECK (ST_Area(geometry::geography) <= 100000000)
);
CREATE INDEX IF NOT EXISTS areas_geometry_idx ON areas USING gist(geometry);
