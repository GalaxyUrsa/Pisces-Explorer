/** ChatGPT-style collapsible sidebar with persisted desktop state. */
const SidebarController = (() => {
  const storageKey = "pisces.sidebar.collapsed";
  let sidebar = null;
  let mainScreen = null;
  let toggle = null;
  let resizeTimer = null;
  let sidebarObserver = null;
  const iconSprite = "/static/assets/icons/sidebar-icons.svg?v=1";
  const icon = iconId => (
    '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + `<use href="${iconSprite}#${iconId}"></use>`
    + "</svg>"
  );
  const menuIcon = icon("menu");
  const collapseIcon = icon("collapse");

  function positionToggle() {
    if (!sidebar || !toggle) return;
    const collapsed = sidebar.classList.contains("collapsed");
    const rectangle = sidebar.getBoundingClientRect();
    toggle.style.top = `${rectangle.top + 20}px`;
    if (window.innerWidth <= 760) {
      toggle.style.left = "18px";
      return;
    }
    if (collapsed) {
      toggle.style.left = `${
        rectangle.left + (rectangle.width - toggle.offsetWidth) / 2
      }px`;
      return;
    }
    toggle.style.left = `${Math.max(18, rectangle.right - 38)}px`;
  }

  function resizePlots() {
    clearTimeout(resizeTimer);
    requestAnimationFrame(() => PanelSlot.resizeVisible());
    resizeTimer = setTimeout(PanelSlot.resizeVisible, 220);
  }

  function setCollapsed(collapsed, persist = true) {
    sidebar.classList.toggle("collapsed", collapsed);
    mainScreen.classList.toggle("sidebar-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute(
      "aria-label",
      collapsed ? "展开左侧栏" : "收起左侧栏"
    );
    toggle.title = collapsed ? "展开左侧栏" : "收起左侧栏";
    toggle.innerHTML = collapsed ? menuIcon : collapseIcon;
    if (persist && window.innerWidth > 760) {
      localStorage.setItem(storageKey, collapsed ? "1" : "0");
    }
    document.dispatchEvent(new CustomEvent("pisces:sidebar-toggle", {
      detail: { collapsed },
    }));
    requestAnimationFrame(positionToggle);
    resizePlots();
  }

  function initialize() {
    sidebar = document.querySelector(".sidebar");
    mainScreen = document.getElementById("main-screen");
    toggle = document.getElementById("sidebar-toggle");
    if (!sidebar || !toggle) return;

    const saved = localStorage.getItem(storageKey) === "1";
    const initiallyCollapsed = window.innerWidth <= 760 || saved;
    setCollapsed(initiallyCollapsed, false);
    toggle.onclick = () => setCollapsed(
      !sidebar.classList.contains("collapsed")
    );
    document.getElementById("sidebar-backdrop").onclick = () => {
      setCollapsed(true, false);
    };
    sidebarObserver = new ResizeObserver(positionToggle);
    sidebarObserver.observe(sidebar);
    window.addEventListener("resize", () => {
      if (window.innerWidth <= 760) {
        setCollapsed(true, false);
      }
      positionToggle();
      resizePlots();
    });
  }

  return { initialize, setCollapsed };
})();
