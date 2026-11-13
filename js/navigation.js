
/*
 * Site-wide navigation and dynamic page rendering.
 * Configuration: data/navigation.json
 */

const siteRoot = new URL("../", import.meta.url);
const configUrl = new URL("../data/navigation.json", import.meta.url);

function normalizePath(path = "") {
    return decodeURIComponent(String(path))
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")
        .replace(/\/index\.html$/i, "")
        .replace(/^index\.html$/i, "");
}

function getCurrentPath() {
    const rootPath = siteRoot.pathname;
    const pathname = window.location.pathname;

    return normalizePath(
        pathname.startsWith(rootPath)
            ? pathname.slice(rootPath.length)
            : pathname
    );
}

const currentPath = getCurrentPath();

function resolveSitePath(path = "") {
    return new URL(String(path).replace(/^\/+/, ""), siteRoot).href;
}

function getPath(item) {
    return item?.path ?? "";
}

function getLabel(item) {
    return item?.label ?? "";
}

function createElement(tag, className = "", text) {
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

/* SECTION RESOLUTION */

function findCurrentSection(sections) {
    return sections.find((section) => {
        const sectionPath = normalizePath(getPath(section));

        if (sectionPath === currentPath) return true;

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
        label: config.site?.homeLabel ?? "Home",
        path: config.site?.home ?? "index.html"
    };

    nav.appendChild(
        createLink(homeItem, !currentSection, "nav-link")
    );

    (config.sections ?? []).forEach((section) => {
        nav.appendChild(
            createLink(
                section,
                currentSection?.id === section.id,
                "nav-link"
            )
        );
    });
}

/* FIXED LEFT SIDEBAR */

function renderSecondaryNavigation(section) {
    let sidebar = document.querySelector(".secondary-nav");

    if (!section) {
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
        section.label
    );

    sidebar.appendChild(heading);

    const inner = createElement("div", "secondary-nav-inner");

    (section.chapters ?? []).forEach((chapter) => {
        const active = normalizePath(getPath(chapter)) === currentPath;

        inner.appendChild(
            createLink(chapter, active, "secondary-nav-link")
        );
    });

    sidebar.appendChild(inner);
    document.body.appendChild(sidebar);
    document.body.classList.add("has-sidebar");
}

/* HOMEPAGE */

function createSectionCard(section, index) {
    const card = createLink(section, false, "module-card available");
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
    card.appendChild(createElement("h3", "", section.label));
    card.appendChild(createElement("p", "", section.description ?? ""));

    const bottom = createElement("div", "module-card-bottom");
    bottom.appendChild(createElement("span", "", "Explore section"));
    bottom.appendChild(createElement("span", "module-arrow", "→"));
    card.appendChild(bottom);

    return card;
}

function renderHomePage(config) {
    const main = document.querySelector(".home-content");

    if (!main) return;

    const title = main.querySelector("[data-home-title]");
    const description = main.querySelector("[data-home-description]");
    const moduleList = main.querySelector("[data-home-modules]");

    if (title) {
        title.textContent = config.site?.homeTitle ?? "";
    }

    if (description) {
        description.textContent = config.site?.homeIntro ?? "";
    }

    if (moduleList) {
        moduleList.replaceChildren();

        (config.sections ?? []).forEach((section, index) => {
            moduleList.appendChild(createSectionCard(section, index));
        });
    }

    document.title = config.site?.pageTitle ?? "Indian Polity | Learning Reference";
}

/* SECTION INTRODUCTION */

function renderSectionIntroduction(section) {
    const title = document.querySelector("[data-section-title]");
    const description = document.querySelector("[data-section-description]");
    const explanation = document.querySelector("[data-section-explanation]");

    if (title) title.textContent = section.label;
    if (description) description.textContent = section.description ?? "";
    if (explanation) explanation.textContent = section.explanation ?? "";

    document.title = `${section.label} | Indian Polity`;
}

/* STUDY GUIDANCE AND EXAM RELEVANCE */

function renderTextList(container, items) {
    if (!container) return;

    container.replaceChildren();

    (items ?? []).forEach((item) => {
        container.appendChild(createElement("li", "", item));
    });
}

function renderStudyGuidance(section) {
    const guidance = document.querySelector("[data-study-guidance]");
    const examRelevance = document.querySelector("[data-exam-relevance]");

    renderTextList(guidance, section.studyGuidance);

    if (examRelevance) {
        examRelevance.textContent = section.examRelevance ?? "";
    }
}

/* CHAPTER DIRECTORY */

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
    card.appendChild(createElement("h3", "", getLabel(chapter)));

    const bottom = createElement("div", "module-card-bottom");
    bottom.appendChild(createElement("span", "", "Open chapter"));
    bottom.appendChild(createElement("span", "module-arrow", "→"));
    card.appendChild(bottom);

    return card;
}

function renderChapterDirectory(section) {
    const container = document.querySelector("[data-chapter-list]");

    if (!container) return;

    container.replaceChildren();

    const chapters = (section.chapters ?? []).filter(
        (chapter) => chapter.id !== "overview"
    );

    chapters.forEach((chapter, index) => {
        container.appendChild(createChapterCard(chapter, index));
    });
}

/* SECTION PAGE */

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

        if (!Array.isArray(config.sections)) {
            throw new Error("The sections array is missing from navigation.json.");
        }

        const currentSection = findCurrentSection(config.sections);

        renderPrimaryNavigation(config, currentSection);
        renderSecondaryNavigation(currentSection);

        if (currentSection) {
            renderSectionPage(currentSection);
        } else {
            renderHomePage(config);
        }
    } catch (error) {
        console.error("Navigation initialization failed:", error);
    }
}

initializeNavigation();
