/*
 * File: navigation.js
 * Full path: /js/navigation.js
 *
 * Shared dynamic navigation, page controls and footer.
 * Site structure and chapter order are read from data/navigation.json.
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

const currentPath = normalizePath(
    window.location.pathname.startsWith(siteRoot.pathname)
        ? window.location.pathname.slice(siteRoot.pathname.length)
        : window.location.pathname
);

function resolveSitePath(path = "") {
    return new URL(String(path).replace(/^\/+/, ""), siteRoot).href;
}

function createElement(tag, className = "", text = "") {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined && text !== null) {
        element.textContent = text;
    }

    return element;
}

function itemPath(item) {
    return normalizePath(item?.path ?? "");
}

function createLink(item, className = "", active = false) {
    const link = createElement("a", className, item?.label ?? "");
    link.href = resolveSitePath(item?.path ?? "");

    if (active) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
    }

    return link;
}

/* ---------------------------------------------------------
   PAGE AND SECTION RESOLUTION
   --------------------------------------------------------- */

function findCurrentSection(sections) {
    return sections.find((section) =>
        itemPath(section) === currentPath ||
        (section.chapters ?? []).some(
            (chapter) => itemPath(chapter) === currentPath
        )
    ) ?? null;
}

function findCurrentChapter(section) {
    if (!section) return null;

    return (section.chapters ?? []).find(
        (chapter) =>
            itemPath(chapter) === currentPath &&
            itemPath(chapter) !== itemPath(section)
    ) ?? null;
}

function isSectionLanding(section) {
    return Boolean(section && itemPath(section) === currentPath);
}

/* ---------------------------------------------------------
   SITE IDENTITY
   --------------------------------------------------------- */

function renderSiteIdentity(config) {
    const site = config.site ?? {};

    document.title = site.pageTitle ?? site.name ?? document.title;

    document.querySelectorAll("[data-site-name]").forEach((element) => {
        element.textContent = site.name ?? "";
    });

    document.querySelectorAll("[data-site-subtitle]").forEach((element) => {
        element.textContent = site.subtitle ?? "";
    });

    document.querySelectorAll("[data-brand-mark]").forEach((element) => {
        element.textContent = site.brandMark ?? "";
    });

    document.querySelectorAll("[data-site-home]").forEach((element) => {
        element.href = resolveSitePath(site.home ?? "index.html");
    });
}

/* ---------------------------------------------------------
   PRIMARY NAVIGATION
   --------------------------------------------------------- */

function renderPrimaryNavigation(config, currentSection) {
    const nav = document.querySelector(".primary-nav");
    if (!nav) return;

    nav.replaceChildren();

    const home = {
        label: config.site?.homeLabel ?? "",
        path: config.site?.home ?? "index.html"
    };

    nav.appendChild(
        createLink(home, "nav-link", !currentSection)
    );

    if (config.interface?.primaryNavigation === "all-modules") {
        (config.sections ?? []).forEach((section) => {
            nav.appendChild(
                createLink(
                    section,
                    "nav-link",
                    currentSection?.id === section.id
                )
            );
        });
    }
}

/* ---------------------------------------------------------
   MODULE SIDEBAR
   --------------------------------------------------------- */

function renderSecondaryNavigation(section) {
    document.querySelector(".secondary-nav")?.remove();

    if (!section) {
        document.body.classList.remove("has-sidebar");
        return;
    }

    const sidebar = createElement("nav", "secondary-nav");
    sidebar.setAttribute("aria-label", "Module chapters");

    sidebar.appendChild(
        createElement(
            "div",
            "secondary-nav-heading",
            section.label ?? ""
        )
    );

    const inner = createElement("div", "secondary-nav-inner");

    (section.chapters ?? []).forEach((chapter) => {
        const active = itemPath(chapter) === currentPath;

        inner.appendChild(
            createLink(chapter, "secondary-nav-link", active)
        );
    });

    sidebar.appendChild(inner);
    document.body.appendChild(sidebar);
    document.body.classList.add("has-sidebar");
}

/* ---------------------------------------------------------
   HOME PAGE
   --------------------------------------------------------- */

function createModuleCard(section, index) {
    const card = createLink(section, "module-card");

    const top = createElement("div", "module-card-top");

    top.appendChild(
        createElement(
            "span",
            "module-index",
            String(section.number ?? index + 1).padStart(2, "0")
        )
    );

    top.appendChild(
        createElement(
            "span",
            "module-status",
            String(
                (section.chapters ?? []).filter(
                    chapter => itemPath(chapter) !== itemPath(section)
                ).length
            )
        )
    );

    card.appendChild(top);
    card.appendChild(createElement("h2", "", section.label ?? ""));
    card.appendChild(createElement("p", "", section.description ?? ""));

    const bottom = createElement("div", "module-card-bottom");
    bottom.appendChild(
        createElement("span", "", section.cardLabel ?? "")
    );
    bottom.appendChild(createElement("span", "module-arrow", "→"));

    card.appendChild(bottom);

    return card;
}

function renderHomePage(config) {
    const main = document.querySelector(".home-content");
    if (!main) return;

    const site = config.site ?? {};

    const title = main.querySelector("[data-home-title]");
    const description = main.querySelector("[data-home-description]");
    const eyebrow = main.querySelector("[data-home-eyebrow]");
    const modules = main.querySelector("[data-home-modules]");
    const status = main.querySelector("[data-home-status]");

    if (title) title.textContent = site.homeTitle ?? "";
    if (description) description.textContent = site.homeIntro ?? "";
    if (eyebrow) eyebrow.textContent = site.homeEyebrow ?? "";

    if (modules) {
        modules.replaceChildren();

        (config.sections ?? []).forEach((section, index) => {
            modules.appendChild(createModuleCard(section, index));
        });
    }

    if (status) {
        const count = (config.sections ?? []).reduce(
            (total, section) =>
                total + (section.chapters ?? []).filter(
                    chapter => itemPath(chapter) !== itemPath(section)
                ).length,
            0
        );

        status.textContent =
            site.overviewSummary ??
            `${config.sections.length} modules · ${count} chapters`;
    }

    document.title = site.pageTitle ?? document.title;
}

/* ---------------------------------------------------------
   MODULE LANDING PAGES
   --------------------------------------------------------- */

function renderTextList(container, items) {
    if (!container) return;

    container.replaceChildren();

    (items ?? []).forEach((item) => {
        container.appendChild(createElement("li", "", item));
    });
}

function renderSectionPage(section) {
    if (!isSectionLanding(section)) return;

    const title = document.querySelector("[data-section-title]");
    const description = document.querySelector("[data-section-description]");
    const explanation = document.querySelector("[data-section-explanation]");
    const guidance = document.querySelector("[data-study-guidance]");
    const relevance = document.querySelector("[data-exam-relevance]");

    if (title) title.textContent = section.label ?? "";
    if (description) description.textContent = section.description ?? "";
    if (explanation) explanation.textContent = section.explanation ?? "";

    renderTextList(guidance, section.studyGuidance);

    if (relevance) {
        relevance.textContent = section.examRelevance ?? "";
    }

    document.title = `${section.label ?? ""} | ${document.title}`;
}

/* ---------------------------------------------------------
   BREADCRUMBS
   --------------------------------------------------------- */

function renderBreadcrumb(config, section, chapter) {
    const breadcrumb = document.querySelector(".breadcrumb");
    if (!breadcrumb) return;

    breadcrumb.replaceChildren();

    const home = createElement(
        "a",
        "",
        config.site?.homeLabel ?? ""
    );

    home.href = resolveSitePath(config.site?.home ?? "index.html");
    breadcrumb.appendChild(home);

    if (!section) return;

    breadcrumb.appendChild(createElement("span", "", " / "));

    if (chapter) {
        const moduleLink = createElement("a", "", section.label ?? "");
        moduleLink.href = resolveSitePath(section.path);

        breadcrumb.appendChild(moduleLink);
        breadcrumb.appendChild(createElement("span", "", " / "));
        breadcrumb.appendChild(
            createElement("span", "", chapter.label ?? "")
        );
    } else {
        breadcrumb.appendChild(
            createElement("span", "", section.label ?? "")
        );
    }
}

/* ---------------------------------------------------------
   DYNAMIC PREVIOUS / NEXT PAGE NAVIGATION
   --------------------------------------------------------- */

function buildPageSequence(sections) {
    const pages = [];

    sections.forEach((section) => {
        pages.push({
            label: section.label,
            path: section.path,
            type: "module"
        });

        (section.chapters ?? []).forEach((chapter) => {
            if (itemPath(chapter) === itemPath(section)) return;

            pages.push({
                ...chapter,
                type: "chapter",
                section
            });
        });
    });

    return pages;
}

function renderPreviousNext(config) {
    document.querySelectorAll(".chapter-navigation").forEach(
        element => element.remove()
    );

    const sequence = buildPageSequence(config.sections ?? []);
    const currentIndex = sequence.findIndex(
        page => itemPath(page) === currentPath
    );

    if (currentIndex < 0) return;

    const previous = sequence[currentIndex - 1];
    const next = sequence[currentIndex + 1];

    const main = document.querySelector(".site-shell > main");
    if (!main) return;

    const navigation = createElement(
        "nav",
        "chapter-navigation"
    );

    navigation.setAttribute(
        "aria-label",
        "Previous and next pages"
    );

    const previousContainer = createElement(
        "div",
        "previous-chapter"
    );

    const nextContainer = createElement(
        "div",
        "next-chapter"
    );

    if (previous) {
        const link = createLink(previous, "chapter-nav-link");
        link.textContent = `← ${previous.label}`;
        previousContainer.appendChild(link);
    }

    if (next) {
        const link = createLink(next, "chapter-nav-link");
        link.textContent = `${next.label} →`;
        nextContainer.appendChild(link);
    }

    navigation.append(previousContainer, nextContainer);
    main.appendChild(navigation);
}

/* ---------------------------------------------------------
   DYNAMIC SHARED FOOTER
   --------------------------------------------------------- */

function renderFooter(config) {
    document.querySelectorAll(".site-footer").forEach(
        footer => footer.remove()
    );

    const shell = document.querySelector(".site-shell");
    if (!shell) return;

    const site = config.site ?? {};
    const footer = createElement("footer", "site-footer");

    const primary = createElement(
        "span",
        "footer-primary",
        site.footerPrimary ?? site.name ?? ""
    );

    const secondary = createElement(
        "span",
        "footer-secondary",
        site.footerSecondary ?? site.subtitle ?? ""
    );

    footer.append(primary, secondary);
    shell.appendChild(footer);
}

/* ---------------------------------------------------------
   INITIALIZATION
   --------------------------------------------------------- */

async function initializeSite() {
    try {
        const response = await fetch(configUrl);

        if (!response.ok) {
            throw new Error(
                `Unable to load navigation configuration: ${response.status}`
            );
        }

        const config = await response.json();

        if (!Array.isArray(config.sections)) {
            throw new Error(
                "The sections array is missing from navigation.json."
            );
        }

        renderSiteIdentity(config);

        const section = findCurrentSection(config.sections);
        const chapter = findCurrentChapter(section);

        renderPrimaryNavigation(config, section);
        renderSecondaryNavigation(section);
        renderFooter(config);
        renderPreviousNext(config);

        if (section) {
            renderBreadcrumb(config, section, chapter);
            renderSectionPage(section);
        } else {
            renderHomePage(config);
        }

    } catch (error) {
        console.error("Site initialization failed:", error);
    }
}

initializeSite();