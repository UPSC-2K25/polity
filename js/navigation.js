
/*
 * Site-wide navigation and dynamic index rendering
 * Configuration: data/navigation.json
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

const getPath = (item) => item?.path ?? "";
const getLabel = (item) => item?.label ?? "";

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
}

function createLink(item, active = false, className = "") {
    const link = createElement("a", className, getLabel(item));
    link.href = resolveSitePath(getPath(item));

    if (active) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
    }

    return link;
}

function findCurrentSection(sections) {
    return sections.find((section) => {
        if (normalizePath(getPath(section)) === currentPath) {
            return true;
        }

        return (section.chapters ?? []).some(
            (chapter) => normalizePath(getPath(chapter)) === currentPath
        );
    });
}

function isSectionLanding(section) {
    return Boolean(
        section &&
        normalizePath(getPath(section)) === currentPath
    );
}

/* PRIMARY NAVIGATION */

function renderPrimaryNavigation(config, currentSection) {
    const nav = document.querySelector(".primary-nav");

    if (!nav) return;

    nav.replaceChildren();

    const homeItem = {
        label: "Home",
        path: config.site?.home ?? "index.html"
    };

    const homeLink = createLink(
        homeItem,
        !currentSection,
        "nav-link"
    );

    nav.appendChild(homeLink);

    (config.sections ?? []).forEach((section) => {
        const active = currentSection?.id === section.id;

        nav.appendChild(
            createLink(section, active, "nav-link")
        );
    });
}

/* FIXED LEFT SIDEBAR */

function renderSecondaryNavigation(currentSection) {
    let sidebar = document.querySelector(".secondary-nav");

    if (!currentSection) {
        sidebar?.remove();
        document.body.classList.remove("has-sidebar");
        return;
    }

    if (!sidebar) {
        sidebar = createElement("nav", "secondary-nav");
        sidebar.setAttribute("aria-label", "Section chapters");
    }

    sidebar.replaceChildren();

    const heading = createElement(
        "div",
        "secondary-nav-heading",
        currentSection.label
    );

    sidebar.appendChild(heading);

    const inner = createElement("div", "secondary-nav-inner");

    (currentSection.chapters ?? []).forEach((chapter) => {
        const active =
            normalizePath(getPath(chapter)) === currentPath;

        inner.appendChild(
            createLink(chapter, active, "secondary-nav-link")
        );
    });

    sidebar.appendChild(inner);

    // Keep the sidebar outside the sticky header.
    document.body.appendChild(sidebar);
    document.body.classList.add("has-sidebar");
}

/* HOMEPAGE MODULE CARDS */

function createModuleCard(section, index) {
    const card = createLink(
        section,
        false,
        "module-card available"
    );

    const top = createElement("div", "module-card-top");

    top.appendChild(
        createElement(
            "span",
            "module-index",
            String(index + 1).padStart(2, "0")
        )
    );

    top.appendChild(
        createElement(
            "span",
            "module-status",
            "Available to explore"
        )
    );

    card.appendChild(top);
    card.appendChild(
        createElement("h3", "", section.label)
    );

    card.appendChild(
        createElement("p", "", section.description ?? "")
    );

    const bottom = createElement("div", "module-card-bottom");

    bottom.appendChild(
        createElement("span", "", "Explore section")
    );

    bottom.appendChild(
        createElement("span", "module-arrow", "→")
    );

    card.appendChild(bottom);

    return card;
}

function renderHomePage(config) {
    const main = document.querySelector(".home-content");

    if (!main) return;

    const title = main.querySelector("[data-home-title], .section-heading h2");
    const intro = main.querySelector("[data-home-description], .section-description");
    const moduleList = main.querySelector("[data-home-modules], .module-list");

    if (title) {
        title.textContent = config.site?.homeTitle ?? "Polity Modules";
    }

    if (intro) {
        intro.textContent = config.site?.homeIntro ?? "";
    }

    if (moduleList) {
        moduleList.replaceChildren();

        (config.sections ?? []).forEach((section, index) => {
            moduleList.appendChild(
                createModuleCard(section, index)
            );
        });
    }
}

/* SECTION INDEX CONTENT */

function renderTextList(container, items) {
    if (!container) return;

    container.replaceChildren();

    (items ?? []).forEach((item) => {
        container.appendChild(
            createElement("li", "", item)
        );
    });
}

function renderSectionIntroduction(section) {
    const title = document.querySelector(
        "[data-section-title], .welcome-section h1"
    );

    const description = document.querySelector(
        "[data-section-description], .welcome-description"
    );

    const explanation = document.querySelector(
        "[data-section-explanation]"
    );

    if (title) {
        title.textContent = section.label;
    }

    if (description) {
        description.textContent = section.description ?? "";
    }

    if (explanation) {
        explanation.textContent = section.explanation ?? "";
    }

    // Remove additional old introductory paragraphs where present.
    document.querySelectorAll(
        ".welcome-section .welcome-description:not(:first-of-type)"
    ).forEach((paragraph) => paragraph.remove());
}

function renderStudyGuidance(section) {
    const guidance = document.querySelector(
        "[data-study-guidance]"
    );

    if (guidance) {
        renderTextList(guidance, section.studyGuidance);
    }

    const examRelevance = document.querySelector(
        "[data-exam-relevance]"
    );

    if (examRelevance) {
        examRelevance.textContent = section.examRelevance ?? "";
    }
}

function createChapterCard(chapter, index) {
    const card = createElement("a", "module-card available");
    card.href = resolveSitePath(getPath(chapter));

    const top = createElement("div", "module-card-top");

    top.appendChild(
        createElement(
            "span",
            "module-index",
            String(index + 1).padStart(2, "0")
        )
    );

    top.appendChild(
        createElement("span", "module-status", "Chapter")
    );

    card.appendChild(top);
    card.appendChild(
        createElement("h3", "", getLabel(chapter))
    );

    const bottom = createElement("div", "module-card-bottom");

    bottom.appendChild(
        createElement("span", "", "Open chapter")
    );

    bottom.appendChild(
        createElement("span", "module-arrow", "→")
    );

    card.appendChild(bottom);

    return card;
}

function renderChapterDirectory(section) {
    const container = document.querySelector(
        "[data-chapter-list], .module-list"
    );

    if (!container) return;

    container.replaceChildren();

    const chapters = (section.chapters ?? []).filter(
        (chapter) => chapter.id !== "overview"
    );

    chapters.forEach((chapter, index) => {
        container.appendChild(
            createChapterCard(chapter, index)
        );
    });
}

function renderSectionPage(section) {
    if (!isSectionLanding(section)) return;

    renderSectionIntroduction(section);
    renderStudyGuidance(section);
    renderChapterDirectory(section);
}

/* INITIALIZATION */

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
            : [];

        const currentSection = findCurrentSection(sections);

        renderPrimaryNavigation(config, currentSection);
        renderSecondaryNavigation(currentSection);

        if (!currentSection) {
            renderHomePage(config);
        } else {
            renderSectionPage(currentSection);
        }
    } catch (error) {
        console.error(
            "Navigation initialization failed:",
            error
        );
    }
}

initializeNavigation();
