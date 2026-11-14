ALTER TABLE public.wineries
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS map_country text,
  ADD COLUMN IF NOT EXISTS map_label_side text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS map_svg text;

ALTER TABLE public.wineries
  ADD CONSTRAINT wineries_latitude_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT wineries_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT wineries_map_label_side_chk CHECK (map_label_side IN ('auto','left','right')),
  ADD CONSTRAINT wineries_location_source_chk CHECK (location_source IS NULL OR location_source IN ('auto','manual'));