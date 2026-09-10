/// <reference types="vite/client" />

declare const Plotly: {
  react: (target: HTMLElement, data: unknown[], layout: object, config?: object) => Promise<void>;
  restyle: (target: HTMLElement, update: object, traces: number[]) => Promise<void>;
  purge: (target: HTMLElement) => void;
  Plots?: { resize?: (target: HTMLElement) => void };
};

interface Window {
  PISCES_API_PREFIX?: string;
}

declare const PanelSlot: {
  resizeVisible?: () => void;
};

declare module "*.html?raw" {
  const source: string;
  export default source;
}
