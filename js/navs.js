
/*
 * Site-wide navigation
 * Configuration: data/navigation.json
 *
 * Generates the primary and secondary navigation, identifies the active
 * page, and supports left/right keyboard navigation between chapters.
 */

const scriptUrl = import.meta.url;
const siteRoot = new URL("../", scriptUrl);
const configUrl = new URL("../data/navigation.json", scriptUrl);

const normalizePath = (path = "") =>
  String(path)
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/index\.html$/i, "")
    .replace(/^index\.html$/i, "");

const resolveSitePath = (path = "") =>
  new URL(String(path).replace(/^\/+/, ""), siteRoot).href;

const currentPath = normalizePath(
  decodeURIComponent(
    window.location.pathname.startsWith(siteRoot.pathname)
      ? window.location.pathname.slice(siteRoot.pathname.length)
      : window.location.pathname
  )
);

function getPath(item) {
  return item?.path ?? item?.href ?? item?.url ?? "";
}

function getLabel(item) {
  return item?.label ?? item?.title ?? item?.name ?? "";
}

function createLink(item, active = false, secondary = false) {
  const link = document.createElement("a");

  link.textContent = getLabel(item);
  link.href = resolveSitePath(getPath(item));

  if (secondary) {
    if (active) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  } else {
    link.classList.add("nav-link");

    if (active) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  }

  return link;
}

function findCurrentSection(sections) {
  return sections.find((section) => {
    const sectionPath = normalizePath(getPath(section));

    if (sectionPath && sectionPath === currentPath) {
      return true;
    }

    return (section.chapters ?? []).some(
      (chapter) => normalizePath(getPath(chapter)) === currentPath
    );
  });
}

function renderPrimaryNavigation(config, currentSection) {
  const nav = document.querySelector(".primary-nav");

  if (!nav) {
    console.warn("Navigation: .primary-nav was not found.");
    return;
  }

  nav.replaceChildren();

  const items = config.primaryNavigation ?? [];
  const homePath = normalizePath(getPath(config.site?.home));

  items.forEach((item) => {
    const itemPath = normalizePath(getPath(item));
    const sectionId = item.section ?? item.sectionId ?? item.id;

    const isHome =
      itemPath === currentPath &&
      (!currentSection || itemPath === homePath);

    const isActive =
      isHome ||
      Boolean(
        currentSection &&
        (sectionId === currentSection.id ||
          itemPath === normalizePath(getPath(currentSection)))
      );

    nav.appendChild(createLink(item, isActive));
  });
}

function renderSecondaryNavigation(currentSection) {
  const header = document.querySelector(".site-header");

  if (!header) {
    console.warn("Navigation: .site-header was not found.");
    return;
  }

  let secondaryNav = document.querySelector(".secondary-nav");

  if (!currentSection) {
    secondaryNav?.remove();
    return;
  }

  if (!secondaryNav) {
    secondaryNav = document.createElement("nav");
    secondaryNav.className = "secondary-nav";
    secondaryNav.setAttribute("aria-label", "Section navigation");

    const inner = document.createElement("div");
    inner.className = "secondary-nav-inner";
    secondaryNav.appendChild(inner);
  }

  // Keep both navigation rows together inside the sticky site header.
  if (secondaryNav.parentElement !== header) {
    header.appendChild(secondaryNav);
  }

  let inner = secondaryNav.querySelector(".secondary-nav-inner");

  if (!inner) {
    inner = document.createElement("div");
    inner.className = "secondary-nav-inner";
    secondaryNav.appendChild(inner);
  }

  inner.replaceChildren();

  (currentSection.chapters ?? []).forEach((chapter) => {
    const isActive =
      normalizePath(getPath(chapter)) === currentPath;

    inner.appendChild(createLink(chapter, isActive, true));
  });
}

function enableChapterKeyboardNavigation(currentSection) {
  if (!currentSection || !Array.isArray(currentSection.chapters)) {
    return;
  }

  const chapters = currentSection.chapters;
  const currentIndex = chapters.findIndex(
    (chapter) => normalizePath(getPath(chapter)) === currentPath
  );

  // Section landing pages are not part of the chapter arrow sequence.
  if (currentIndex === -1) {
    return;
  }

  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    const target = event.target;

    if (
      target instanceof HTMLElement &&
      (
        target.isContentEditable ||
        target.closest(
          "input, textarea, select, button, a, [contenteditable='true'], [role='textbox']"
        )
      )
    ) {
      return;
    }

    // Do not navigate while the user is selecting text.
    const selection = window.getSelection();

    if (selection && !selection.isCollapsed) {
      return;
    }

    const nextIndex =
      event.key === "ArrowRight"
        ? currentIndex + 1
        : currentIndex - 1;

    // Do nothing at the first and last chapter.
    if (nextIndex < 0 || nextIndex >= chapters.length) {
      return;
    }

    const nextPath = getPath(chapters[nextIndex]);

    if (!nextPath) {
      return;
    }

    event.preventDefault();
    window.location.href = resolveSitePath(nextPath);
  });
}

async function initializeNavigation() {
  try {
    const response = await fetch(configUrl);

    if (!response.ok) {
      throw new Error(
        `Could not load navigation.json (${response.status}).`
      );
    }

    const config = await response.json();
    const sections = Array.isArray(config.sections)
      ? config.sections
      : Object.values(config.sections ?? {});

    const currentSection = findCurrentSection(sections);

    renderPrimaryNavigation(config, currentSection);
    renderSecondaryNavigation(currentSection);
    enableChapterKeyboardNavigation(currentSection);
  } catch (error) {
    console.error("Navigation initialization failed:", error);
  }
}

initializeNavigation();
