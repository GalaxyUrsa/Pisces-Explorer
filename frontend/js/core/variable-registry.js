/** Fallback variable metadata used before server metadata is available. */
const VariableRegistry = (() => {
  const definitions = {
    ss:    { label: "声速", unit: "m/s", min: 1480, max: 1560, colorscale: "Viridis" },
    temp:  { label: "温度", unit: "°C", min: 0, max: 35, colorscale: "RdYlBu_r" },
    salt:  { label: "盐度", unit: "PSU", min: 30, max: 40, colorscale: "Blues" },
    uo:    { label: "东向流速", unit: "m/s", min: -1.5, max: 1.5, colorscale: "RdBu_r" },
    vo:    { label: "北向流速", unit: "m/s", min: -1.5, max: 1.5, colorscale: "RdBu_r" },
    uv:    { label: "流速", unit: "m/s", min: 0, max: 2, colorscale: "Viridis" },
    u10:   { label: "风速u", unit: "m/s", min: -15, max: 15, colorscale: "RdBu_r" },
    v10:   { label: "风速v", unit: "m/s", min: -15, max: 15, colorscale: "RdBu_r" },
    wind:  { label: "风速", unit: "m/s", min: 0, max: 20, colorscale: "YlOrRd" },
    swh:   { label: "有效波高", unit: "m", min: 0, max: 6, colorscale: "Blues" },
    mwd_u: { label: "波向u", unit: "", min: -1, max: 1, colorscale: "RdBu_r" },
    mwd_v: { label: "波向v", unit: "", min: -1, max: 1, colorscale: "RdBu_r" },
    mwd:   { label: "波向", unit: "°", min: 0, max: 360, colorscale: "HSV" },
  };

  const configurableDefaults = Object.fromEntries(
    Object.entries(definitions).map(([key, definition]) => [
      key,
      {
        min: definition.min,
        max: definition.max,
        colorscale: definition.colorscale,
        color_min: null,
        color_max: null,
        depth_min: null,
        depth_max: null,
        value_min: null,
        value_max: null,
      },
    ])
  );

  const labels = Object.fromEntries(
    Object.entries(definitions).map(([key, value]) => [key, value.label])
  );
  const units = Object.fromEntries(
    Object.entries(definitions).map(([key, value]) => [key, value.unit])
  );
  const colorscales = [
    "Viridis", "Plasma", "Inferno", "Magma", "Cividis",
    "RdYlBu_r", "RdBu_r", "Spectral_r", "Blues", "Greens", "YlOrRd",
    "Jet", "Turbo", "Rainbow", "HSV",
  ];

  function hydrate(serverRegistry = {}) {
    Object.entries(serverRegistry).forEach(([key, value]) => {
      definitions[key] = {
        ...(definitions[key] || {}),
        label: value.label,
        unit: value.unit,
        min: value.vmin,
        max: value.vmax,
        colorscale: value.colorscale,
      };
      labels[key] = value.label;
      units[key] = value.unit;
      configurableDefaults[key] = {
        ...(configurableDefaults[key] || {}),
        min: value.vmin,
        max: value.vmax,
        colorscale: value.colorscale,
        color_min: null,
        color_max: null,
        depth_min: null,
        depth_max: null,
        value_min: null,
        value_max: null,
      };
    });
  }

  return {
    definitions, configurableDefaults, labels, units, colorscales, hydrate,
  };
})();
