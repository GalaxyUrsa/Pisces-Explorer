# Pisces-Region

Pisces-Region is the independent region-first analysis workspace exposed at
`/region`. Region-specific geometry and API integration live under
`backend/features/region`; the visualization workspace reuses Explorer.

The center mode creates a north-aligned 240 × 240 km study area. Bounds mode
accepts an arbitrary increasing longitude/latitude rectangle. Uploaded
NetCDF files are spatially subset before their variable arrays are retained
in the Region runtime.
