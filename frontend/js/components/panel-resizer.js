/**
 * Resizable workspace panels. This component only owns layout interactions.
 */
const PanelResizer = (() => {
  function initColumns() {
    const resizer = document.getElementById("column-resizer");
    const left = document.getElementById("slot-left");
    const right = document.getElementById("slot-right");
    if (!resizer || !left || !right) return;

    resizer.addEventListener("mousedown", event => {
      event.preventDefault();
      const startX = event.clientX;
      const startLeftWidth = left.getBoundingClientRect().width;
      const startRightWidth = right.getBoundingClientRect().width;
      const plots = [...document.querySelectorAll(".slot-graph")];
      const sidebar = document.querySelector(".sidebar");
      let animationFrame = null;

      resizer.classList.add("dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      [...plots, sidebar].forEach(element => {
        if (element) element.style.pointerEvents = "none";
      });

      function onMove(moveEvent) {
        if (animationFrame) return;
        animationFrame = requestAnimationFrame(() => {
          animationFrame = null;
          const total = startLeftWidth + startRightWidth;
          const minimum = Math.min(200, total / 2);
          const width = Math.max(
            minimum,
            Math.min(
              total - minimum,
              startLeftWidth + moveEvent.clientX - startX
            )
          );
          left.style.flex = "none";
          left.style.width = `${width}px`;
          right.style.flex = "none";
          right.style.width = `${total - width}px`;
        });
      }

      function onUp() {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        resizer.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        [...plots, sidebar].forEach(element => {
          if (element) element.style.pointerEvents = "";
        });
        PanelSlot.resizeVisible();
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function initSidebar() {
    const resizer = document.getElementById("sidebar-resizer");
    const sidebar = document.querySelector(".sidebar");
    if (!resizer || !sidebar) return;

    resizer.addEventListener("mousedown", event => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = sidebar.getBoundingClientRect().width;
      let animationFrame = null;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      sidebar.style.pointerEvents = "none";

      function onMove(moveEvent) {
        if (animationFrame) return;
        animationFrame = requestAnimationFrame(() => {
          animationFrame = null;
          const width = Math.max(
            180, Math.min(480, startWidth + moveEvent.clientX - startX)
          );
          sidebar.style.width = `${width}px`;
        });
      }

      function onUp() {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        sidebar.style.pointerEvents = "";
        PanelSlot.resizeVisible();
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function initRows() {
    const resizer = document.getElementById("row-resizer");
    const top = document.getElementById("top-panels");
    const bottom = document.getElementById("analysis-panel");
    if (!resizer || !top || !bottom) return;

    resizer.addEventListener("mousedown", event => {
      event.preventDefault();
      const startY = event.clientY;
      const startTopHeight = top.getBoundingClientRect().height;
      const startBottomHeight = bottom.getBoundingClientRect().height;
      const totalHeight = startTopHeight + startBottomHeight;
      const plots = [...document.querySelectorAll(
        ".slot-graph, #profile-graph"
      )];
      let animationFrame = null;
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      plots.forEach(plot => { plot.style.pointerEvents = "none"; });

      function onMove(moveEvent) {
        if (animationFrame) return;
        animationFrame = requestAnimationFrame(() => {
          animationFrame = null;
          const delta = moveEvent.clientY - startY;
          const topMinimum = Math.min(150, totalHeight / 2);
          const bottomMinimum = Math.min(120, totalHeight / 2);
          const newTopHeight = Math.max(
            topMinimum,
            Math.min(totalHeight - bottomMinimum, startTopHeight + delta)
          );
          top.style.flex = "none";
          top.style.height = `${newTopHeight}px`;
          bottom.style.flex = "none";
          bottom.style.height = `${totalHeight - newTopHeight}px`;
        });
      }

      function onUp() {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        plots.forEach(plot => {
          plot.style.pointerEvents = "";
          Plotly.Plots.resize(plot);
        });
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function initAll() {
    initColumns();
    initSidebar();
    initRows();
  }

  return { initAll };
})();
