import { createApp, type App as VueApp } from "vue";
import ExplorerSidebar from "./ExplorerSidebar.vue";

const MODULES = [
  { key: "variables", cards: ["variables"] },
  { key: "timeline", cards: ["timeline"] },
  { key: "depth", cards: ["depth"] },
  { key: "colorRange", cards: ["color-range"] },
  { key: "palette", cards: ["palette"] },
  { key: "vectors", cards: ["vectors"] },
  { key: "volumeLayers", cards: ["layer-visibility"] },
  { key: "region", cards: ["selection"] },
] as const;

function card(sidebar: Element, name: string): HTMLElement | null {
  return sidebar.querySelector<HTMLElement>(`:scope > [data-section="${name}"]`);
}

function moduleShell(key: string): { shell: HTMLElement; body: HTMLElement } {
  const shell = document.createElement("section");
  shell.id = `sidebar-module-${key}`;
  shell.className = "sidebar-module-shell";
  const header = document.createElement("div");
  header.id = `sidebar-module-header-${key}`;
  header.className = "sidebar-module-header";
  const body = document.createElement("div");
  body.className = "sidebar-module-body";
  shell.append(header, body);
  return { shell, body };
}

function organizeCards(sidebar: HTMLElement): void {
  sidebar.querySelectorAll(":scope > .sidebar-control-pane, :scope > .sidebar-primary-pane, :scope > .sidebar-data-pane, :scope > #sidebar-primary-nav").forEach(item => item.remove());
  const dataPane = document.createElement("div");
  dataPane.id = "sidebar-data-pane";
  dataPane.className = "sidebar-data-pane";
  ["data", "overview", "comparison-files"].forEach(name => {
    const element = card(sidebar, name);
    if (element) dataPane.appendChild(element);
  });
  sidebar.appendChild(dataPane);

  const pane = document.createElement("div");
  pane.id = "sidebar-control-pane";
  pane.className = "sidebar-control-pane";
  MODULES.forEach(item => {
    const { shell, body } = moduleShell(item.key);
    item.cards.forEach(name => {
      const element = card(sidebar, name);
      if (element) body.appendChild(element);
    });
    if (item.key === "region") {
      const clear = sidebar.querySelector<HTMLElement>(":scope > #clear-btn");
      if (clear) body.appendChild(clear);
    }
    pane.appendChild(shell);
  });
  sidebar.appendChild(pane);
}

export function mountExplorerSidebar(): VueApp | null {
  const sidebar = document.querySelector<HTMLElement>(".sidebar");
  const host = document.getElementById("sidebar-vue-context");
  if (!sidebar || !host) return null;
  organizeCards(sidebar);
  sidebar.querySelector<HTMLElement>(".sidebar-brand")?.remove();
  const app = createApp(ExplorerSidebar);
  app.mount(host);
  return app;
}
