/** Persistent accordion behavior for the expanded sidebar's setting groups. */
const SidebarSections = (() => {
  const storagePrefix = "pisces.sidebar.section.";
  const iconSprite = "/static/assets/icons/sidebar-icons.svg?v=1";
  const svgIcon = iconId => (
    '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + `<use href="${iconSprite}#${iconId}"></use>`
    + "</svg>"
  );
  const sectionIcons = {
    data: svgIcon("data"),
    overview: svgIcon("overview"),
    "comparison-files": svgIcon("comparison"),
    variables: svgIcon("variables"),
    colors: svgIcon("colors"),
    timeline: svgIcon("timeline"),
    depth: svgIcon("depth"),
    "analysis-mode": svgIcon("analysis"),
    selection: svgIcon("selection"),
  };
  let activeFlyout = null;

  function storedState(sectionId, defaultOpen) {
    const stored = localStorage.getItem(`${storagePrefix}${sectionId}`);
    return stored == null ? defaultOpen : stored === "1";
  }

  function setOpen(card, open, persist = true) {
    const title = card.querySelector(":scope > .side-card-title");
    card.classList.toggle("section-collapsed", !open);
    title.setAttribute("aria-expanded", String(open));
    if (persist) {
      localStorage.setItem(
        `${storagePrefix}${card.dataset.section}`,
        open ? "1" : "0"
      );
    }
  }

  function initializeCard(card) {
    const title = card.querySelector(":scope > .side-card-title");
    if (!title || !card.dataset.section) return;

    const content = document.createElement("div");
    content.className = "sidebar-section-content";
    while (title.nextSibling) content.appendChild(title.nextSibling);
    card.appendChild(content);

    const chevron = document.createElement("span");
    chevron.className = "sidebar-section-chevron";
    chevron.textContent = "⌄";
    title.appendChild(chevron);
    title.classList.add("sidebar-section-toggle");
    title.setAttribute("role", "button");
    title.setAttribute("tabindex", "0");
    title.setAttribute(
      "aria-controls",
      `sidebar-section-${card.dataset.section}`
    );
    content.id = `sidebar-section-${card.dataset.section}`;

    const toggle = () => {
      if (card.classList.contains("rail-flyout-open")) {
        closeFlyout({ restoreFocus: true });
        return;
      }
      setOpen(card, card.classList.contains("section-collapsed"));
    };
    title.addEventListener("click", toggle);
    title.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggle();
    });
    setOpen(
      card,
      storedState(
        card.dataset.section,
        card.dataset.defaultOpen === "true"
      ),
      false
    );
    return { card, title };
  }

  function explicitVisible(card) {
    return (
      !card.classList.contains("hidden")
      && card.style.display !== "none"
    );
  }

  function closeFlyout({ restoreFocus = false } = {}) {
    if (!activeFlyout) return;
    const { card, button, wasCollapsed } = activeFlyout;
    card.classList.remove("rail-flyout-open");
    card.style.left = "";
    card.style.top = "";
    card.style.width = "";
    document.querySelector(".sidebar").classList.remove("flyout-active");
    button.classList.remove("active");
    button.setAttribute("aria-expanded", "false");
    setOpen(card, !wasCollapsed, false);
    activeFlyout = null;
    if (restoreFocus) button.focus();
  }

  function positionFlyout() {
    if (!activeFlyout) return;
    const { card, button } = activeFlyout;
    const sidebar = document.querySelector(".sidebar");
    const sidebarRect = sidebar.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const availableWidth = Math.max(
      260, window.innerWidth - sidebarRect.right - 24
    );
    card.style.width = `${Math.min(340, availableWidth)}px`;
    card.style.left = `${sidebarRect.right + 8}px`;
    card.style.top = "12px";
    const height = card.getBoundingClientRect().height;
    const top = Math.max(
      12,
      Math.min(buttonRect.top - 8, window.innerHeight - height - 12)
    );
    card.style.top = `${top}px`;
  }

  function openFlyout(card, title, button) {
    if (window.innerWidth <= 760) {
      SidebarController.setCollapsed(false);
      setOpen(card, true);
      return;
    }
    if (activeFlyout?.button === button) {
      closeFlyout({ restoreFocus: true });
      return;
    }
    closeFlyout();
    activeFlyout = {
      card,
      title,
      button,
      wasCollapsed: card.classList.contains("section-collapsed"),
    };
    setOpen(card, true, false);
    card.classList.add("rail-flyout-open");
    document.querySelector(".sidebar").classList.add("flyout-active");
    button.classList.add("active");
    button.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      positionFlyout();
      title.focus({ preventScroll: true });
    });
  }

  function createRailButton(rail, card, title) {
    const sectionId = card.dataset.section;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sidebar-rail-button";
    button.dataset.sectionTarget = sectionId;
    button.innerHTML = sectionIcons[sectionId] || sectionIcons.selection;
    const label = title.textContent.replace("⌄", "").trim();
    button.title = label;
    button.setAttribute("aria-label", `展开${label}`);
    button.setAttribute("aria-expanded", "false");
    button.onclick = () => {
      openFlyout(card, title, button);
    };
    const syncVisibility = () => {
      const visible = explicitVisible(card);
      button.classList.toggle("hidden", !visible);
      if (!visible && activeFlyout?.card === card) closeFlyout();
    };
    new MutationObserver(syncVisibility).observe(card, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    syncVisibility();
    rail.appendChild(button);
  }

  function initialize() {
    const rail = document.getElementById("sidebar-rail-nav");
    rail.innerHTML = "";
    document.querySelectorAll(".sidebar > .side-card[data-section]")
      .forEach(card => {
        const initialized = initializeCard(card);
        if (initialized) {
          createRailButton(rail, initialized.card, initialized.title);
        }
      });
    document.addEventListener("pointerdown", event => {
      if (
        !activeFlyout
        || activeFlyout.card.contains(event.target)
        || activeFlyout.button.contains(event.target)
      ) return;
      closeFlyout();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && activeFlyout) {
        closeFlyout({ restoreFocus: true });
      }
    });
    document.addEventListener("pisces:sidebar-toggle", event => {
      if (!event.detail.collapsed) closeFlyout();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth <= 760) closeFlyout();
      else positionFlyout();
    });
  }

  return { initialize, setOpen, closeFlyout };
})();
