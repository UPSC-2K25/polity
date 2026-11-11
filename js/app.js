
"use strict";

/* =========================================================
   INDIAN POLITY REFERENCE SYSTEM
   Corrected application controller
   Compatible with the current index.html and JSON files
========================================================= */

const PAGE_SIZE_DEFAULT = 15;

const DATA_PATH = new URL("../data/", import.meta.url);

const FILES = {
    institutions: "institutions.json",
    hierarchy: "hierarchy.json",
    posts: "posts.json",
    relationships: "relationships.json",
    committees: "committees.json",
    procedures: "procedures.json",
    provisions: "constitutional-provisions.json"
};

const state = {
    data: {},
    records: [],
    filtered: [],
    currentPage: 1,
    pageSize: PAGE_SIZE_DEFAULT,
    currentView: "hierarchy",
    currentSection: "overview",
    activeRecord: null,
    activeTab: "overview"
};

/* =========================================================
   DOM HELPERS
========================================================= */

const $ = selector => document.querySelector(selector);

const $$ = selector => [...document.querySelectorAll(selector)];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function getName(record) {
    return record?.name ||
           record?.title ||
           (record?.article ? `Article ${record.article}` : "") ||
           record?.id ||
           "Untitled";
}

function getDescription(record) {
    return record?.description ||
           record?.summary ||
           record?.purpose ||
           record?.overview ||
           "No description available.";
}

function getRecord(id) {
    return state.records.find(record => record.id === id);
}

/* =========================================================
   DATA LOADING
========================================================= */

async function loadJSON(filename) {
    const url = new URL(filename, DATA_PATH);

    let response;

    try {
        response = await fetch(url);
    } catch (error) {
        throw new Error(
            `Network error while loading ${filename}. Check the file path and GitHub Pages deployment.`
        );
    }

    if (!response.ok) {
        throw new Error(
            `${filename} returned HTTP ${response.status}`
        );
    }

    try {
        return await response.json();
    } catch (error) {
        throw new Error(
            `${filename} contains invalid JSON. Check its syntax.`
        );
    }
}

async function loadAllData() {
    showMessage("Loading legislative reference data...");

    const entries = Object.entries(FILES);

    const loaded = await Promise.all(
        entries.map(async ([key, filename]) => {
            const json = await loadJSON(filename);
            return [key, json];
        })
    );

    state.data = Object.fromEntries(loaded);

    validateData();

    buildRecordIndex();
    populateInstitutionFilter();

    state.currentSection = "overview";
    state.currentView = "hierarchy";

    updateNavigation();
    updateViewButtons();

    applyFilters();
}

function validateData() {
    const requiredArrays = {
        institutions: "institutions",
        posts: "posts",
        committees: "committees",
        procedures: "procedures",
        provisions: "provisions",
        relationships: "relationships",
        hierarchy: "sections"
    };

    for (const [file, property] of Object.entries(requiredArrays)) {
        if (!Array.isArray(state.data[file]?.[property])) {
            throw new Error(
                `${FILES[file]} is missing a valid "${property}" array.`
            );
        }
    }
}

/* =========================================================
   BUILD THE COMMON SEARCH INDEX
========================================================= */

function buildRecordIndex() {
    const records = [];

    const addRecords = (items, type, categoryFunction) => {
        asArray(items).forEach(item => {
            records.push({
                ...item,
                record_type: type,
                category: categoryFunction(item)
            });
        });
    };

    addRecords(
        state.data.institutions.institutions,
        "institution",
        item => item.type || "institution"
    );

    addRecords(
        state.data.posts.posts,
        "post",
        item => item.category || "post"
    );

    addRecords(
        state.data.committees.committees,
        "committee",
        () => "committee"
    );

    addRecords(
        state.data.procedures.procedures,
        "procedure",
        item => item.category || "procedure"
    );

    addRecords(
        state.data.provisions.provisions,
        "provision",
        () => "constitutional_provision"
    );

    state.records = records;
}

/* =========================================================
   SEARCH
========================================================= */

function searchableText(record) {
    return JSON.stringify(record)
        .toLowerCase()
        .replace(/[_-]/g, " ");
}

function matchesSearch(record, term) {
    if (!term) return true;

    return searchableText(record).includes(
        term.toLowerCase()
    );
}

function matchesInstitution(record, institutionId) {
    if (institutionId === "all") return true;

    const relatedIds = [
        record.institution_id,
        record.parent_id,
        record.jurisdiction,
        record.level,
        ...asArray(record.related_entities),
        ...asArray(record.linked_entities)
    ].filter(Boolean).map(String);

    if (relatedIds.includes(institutionId)) return true;

    // Match institution relationships from the relationship file.
    const relations = asArray(
        state.data.relationships.relationships
    );

    return relations.some(relation => {
        const source = relation.source || {};
        const target = relation.target || {};

        return (
            (source.id === record.id &&
             target.id === institutionId) ||
            (target.id === record.id &&
             source.id === institutionId)
        );
    });
}

/* =========================================================
   FILTERS AND SORTING
========================================================= */

function applyFilters() {
    const search = $("#global-search")?.value.trim() || "";
    const category = $("#category-filter")?.value || "all";
    const institution = $("#institution-filter")?.value || "all";
    const sort = $("#sort-filter")?.value || "default";

    let results = state.records.filter(record => {
        const searchMatch = matchesSearch(record, search);

        const categoryMatch =
            category === "all" ||
            record.category === category;

        const institutionMatch =
            matchesInstitution(record, institution);

        return searchMatch && categoryMatch && institutionMatch;
    });

    if (sort === "alphabetical") {
        results.sort((a, b) =>
            getName(a).localeCompare(getName(b))
        );
    }

    if (sort === "category") {
        results.sort((a, b) =>
            String(a.category).localeCompare(String(b.category)) ||
            getName(a).localeCompare(getName(b))
        );
    }

    state.filtered = results;
    state.currentPage = 1;

    updateResultSummary();

    if (search || category !== "all" || institution !== "all") {
        state.currentView = "list";
        updateViewButtons();
    }

    renderCurrentView();
}

function populateInstitutionFilter() {
    const select = $("#institution-filter");
    if (!select) return;

    const currentValue = select.value;

    const institutions = asArray(
        state.data.institutions.institutions
    );

    select.innerHTML = `
        <option value="all">All Institutions</option>
        ${institutions.map(item => `
            <option value="${escapeHTML(item.id)}">
                ${escapeHTML(item.name)}
            </option>
        `).join("")}
    `;

    select.value = institutions.some(
        item => item.id === currentValue
    ) ? currentValue : "all";
}

function updateResultSummary() {
    const summary = $("#results-summary");
    if (!summary) return;

    summary.textContent =
        `${state.filtered.length} records found`;
}

/* =========================================================
   NAVIGATION
========================================================= */

function updateNavigation() {
    $$("[data-section]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.section === state.currentSection
        );
    });
}

function updateViewButtons() {
    $$("[data-view]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.view === state.currentView
        );
    });
}

function selectSection(sectionId) {
    state.currentSection = sectionId;

    const search = $("#global-search");
    const category = $("#category-filter");
    const institution = $("#institution-filter");

    if (search) search.value = "";
    if (category) category.value = "all";
    if (institution) institution.value = "all";

    state.filtered = [...state.records];
    state.currentPage = 1;
    state.currentView = "hierarchy";

    updateNavigation();
    updateViewButtons();
    updateResultSummary();
    renderHierarchy();
}

/* =========================================================
   MAIN RENDERER
========================================================= */

function renderCurrentView() {
    if (state.currentView === "hierarchy") {
        renderHierarchy();
    } else {
        renderList();
    }
}

function showMessage(message, isError = false) {
    const container = $("#content-area");
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state" ${isError ? 'style="color:#b42318"' : ""}>
            ${escapeHTML(message)}
        </div>
    `;
}

/* =========================================================
   LIST VIEW
========================================================= */

function renderList() {
    const container = $("#content-area");
    if (!container) return;

    const start = (state.currentPage - 1) * state.pageSize;

    const pageRecords = state.filtered.slice(
        start,
        start + state.pageSize
    );

    if (!pageRecords.length) {
        container.innerHTML = `
            <div class="empty-state">
                No matching records found.
            </div>
        `;

        renderPagination();
        return;
    }

    container.innerHTML = `
        <div class="record-list">
            ${pageRecords.map(record => `
                <article
                    class="record-card"
                    data-record-id="${escapeHTML(record.id)}"
                    tabindex="0"
                    role="button"
                    aria-label="View ${escapeHTML(getName(record))}"
                >
                    <div class="record-card-content">
                        <div class="record-card-heading">
                            <h3>${escapeHTML(getName(record))}</h3>

                            <span class="record-type">
                                ${escapeHTML(getTypeLabel(record))}
                            </span>
                        </div>

                        <p>${escapeHTML(getDescription(record))}</p>

                        <div class="record-meta">
                            ${record.level ? `
                                <span>${escapeHTML(record.level)}</span>
                            ` : ""}

                            ${record.article ? `
                                <span>Article ${escapeHTML(record.article)}</span>
                            ` : ""}

                            ${record.short_name ? `
                                <span>${escapeHTML(record.short_name)}</span>
                            ` : ""}
                        </div>
                    </div>

                    <span class="record-open">View details →</span>
                </article>
            `).join("")}
        </div>
    `;

    renderPagination();
}

function getTypeLabel(record) {
    const labels = {
        institution: "Institution",
        post: "Office / Position",
        committee: "Committee",
        procedure: "Procedure",
        provision: "Constitutional Article"
    };

    return labels[record.record_type] || record.record_type;
}

/* =========================================================
   HIERARCHY VIEW
========================================================= */

function renderHierarchy() {
    const container = $("#content-area");
    if (!container) return;

    const sections = asArray(
        state.data.hierarchy.sections
    );

    const section = sections.find(
        item => item.id === state.currentSection
    );

    if (!section) {
        showMessage("The selected section was not found.", true);
        return;
    }

    const groups = asArray(section.groups)
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    const html = groups.map(group => {
        const cards = asArray(group.items)
            .map(item => resolveHierarchyItem(item))
            .filter(Boolean);

        if (!cards.length) return "";

        return `
            <section class="hierarchy-group">
                <h2>${escapeHTML(group.title || "Group")}</h2>

                ${group.description ? `
                    <p>${escapeHTML(group.description)}</p>
                ` : ""}

                <div class="hierarchy-cards">
                    ${cards.map(record => `
                        <article
                            class="record-card"
                            data-record-id="${escapeHTML(record.id)}"
                            tabindex="0"
                            role="button"
                        >
                            <div class="record-card-content">
                                <div class="record-card-heading">
                                    <h3>${escapeHTML(getName(record))}</h3>

                                    <span class="record-type">
                                        ${escapeHTML(getTypeLabel(record))}
                                    </span>
                                </div>

                                <p>${escapeHTML(getDescription(record))}</p>

                                <div class="record-meta">
                                    ${record.level ? `
                                        <span>${escapeHTML(record.level)}</span>
                                    ` : ""}
                                    ${record.article ? `
                                        <span>Article ${escapeHTML(record.article)}</span>
                                    ` : ""}
                                </div>
                            </div>

                            <span class="record-open">View details →</span>
                        </article>
                    `).join("")}
                </div>
            </section>
        `;
    }).join("");

    container.innerHTML = html || `
        <div class="empty-state">
            No records are configured in this section.
        </div>
    `;

    renderPagination();
}

function resolveHierarchyItem(item) {
    if (!item || !item.type) return null;

    if (item.type === "institution") {
        return getRecord(item.institution_id);
    }

    if (item.type === "post") {
        return getRecord(item.post_id);
    }

    if (item.type === "collection") {
        return getCollectionRecord(item.collection_id);
    }

    return null;
}

/* =========================================================
   COLLECTIONS
========================================================= */

function getCollectionRecord(collectionId) {
    const sources = [
        {
            data: state.data.committees,
            itemsKey: "committee_ids",
            recordType: "committee"
        },
        {
            data: state.data.procedures,
            itemsKey: "procedure_ids",
            recordType: "procedure"
        }
    ];

    for (const source of sources) {
        const collection = asArray(source.data.collections).find(
            item => item.id === collectionId
        );

        if (collection) {
            const ids = asArray(collection[source.itemsKey]);

            return {
                id: collection.id,
                name: collection.title || collection.name,
                title: collection.title || collection.name,
                description: collection.description || "",
                record_type: "collection",
                category: "collection",
                collection_items: ids
                    .map(id => getRecord(id))
                    .filter(Boolean)
            };
        }
    }

    // Constitutional provisions are grouped by Article number.
    if (
        collectionId === "union_legislative_articles" ||
        collectionId === "state_legislative_articles"
    ) {
        const all = asArray(state.data.provisions.provisions);

        const items = all.filter(item => {
            const number = Number(item.article);

            return collectionId === "union_legislative_articles"
                ? number >= 75 && number <= 123
                : (number >= 164 && number <= 213) || number === 368;
        });

        return {
            id: collectionId,
            name: collectionId === "union_legislative_articles"
                ? "Union Legislative Articles"
                : "State Legislative Articles",
            description: "Relevant constitutional provisions.",
            record_type: "collection",
            category: "collection",
            collection_items: items
        };
    }

    return null;
}

/* =========================================================
   RECORD CARD EVENTS
========================================================= */

document.addEventListener("click", event => {
    const card = event.target.closest("[data-record-id]");
    if (!card) return;

    openRecord(card.dataset.recordId);
});

document.addEventListener("keydown", event => {
    const card = event.target.closest("[data-record-id]");

    if (
        card &&
        (event.key === "Enter" || event.key === " ")
    ) {
        event.preventDefault();
        openRecord(card.dataset.recordId);
    }
});

/* =========================================================
   PAGINATION
========================================================= */

function renderPagination() {
    const numbers = $("#page-numbers");
    const info = $("#pagination-info");

    if (!numbers) return;

    const totalPages = Math.max(
        1,
        Math.ceil(state.filtered.length / state.pageSize)
    );

    state.currentPage = Math.min(
        state.currentPage,
        totalPages
    );

    numbers.innerHTML = Array.from(
        { length: totalPages },
        (_, index) => index + 1
    ).filter(page => (
        page === 1 ||
        page === totalPages ||
        Math.abs(page - state.currentPage) <= 2
    )).map(page => `
        <button
            type="button"
            class="page-button ${page === state.currentPage ? "active" : ""}"
            data-page="${page}"
            aria-current="${page === state.currentPage ? "page" : "false"}"
        >
            ${page}
        </button>
    `).join("");

    if (info) {
        info.textContent =
            `Page ${state.currentPage} of ${totalPages}`;
    }

    setButtonDisabled("#first-page", state.currentPage === 1);
    setButtonDisabled("#previous-page", state.currentPage === 1);
    setButtonDisabled("#next-page", state.currentPage === totalPages);
    setButtonDisabled("#last-page", state.currentPage === totalPages);
}

function setButtonDisabled(selector, disabled) {
    const button = $(selector);
    if (button) button.disabled = disabled;
}

function goToPage(page) {
    const totalPages = Math.max(
        1,
        Math.ceil(state.filtered.length / state.pageSize)
    );

    state.currentPage = Math.max(
        1,
        Math.min(page, totalPages)
    );

    renderCurrentView();
}

$("#page-numbers")?.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");
    if (button) goToPage(Number(button.dataset.page));
});

$("#first-page")?.addEventListener("click", () => goToPage(1));

$("#previous-page")?.addEventListener("click", () => {
    goToPage(state.currentPage - 1);
});

$("#next-page")?.addEventListener("click", () => {
    goToPage(state.currentPage + 1);
});

$("#last-page")?.addEventListener("click", () => {
    const total = Math.ceil(
        state.filtered.length / state.pageSize
    );
    goToPage(total);
});

$("#page-size")?.addEventListener("change", event => {
    state.pageSize = Number(event.target.value) || PAGE_SIZE_DEFAULT;
    state.currentPage = 1;
    renderCurrentView();
});

/* =========================================================
   DETAIL MODAL
========================================================= */

function openRecord(recordId) {
    let record = getRecord(recordId);

    if (!record) {
        // Collections can also be opened from hierarchy.
        record = getCollectionRecord(recordId);
    }

    if (!record) {
        console.warn("Record not found:", recordId);
        return;
    }

    state.activeRecord = record;
    state.activeTab = "overview";

    $("#modal-title").textContent = getName(record);

    $("#modal-category").textContent =
        getTypeLabel(record);

    $("#modal-subtitle").textContent =
        record.short_name || record.level || "";

    $("#modal-record-id").textContent =
        `Record ID: ${record.id}`;

    updateModalTabs();
    renderModalContent();

    const modal = $("#details-modal");

    if (modal && !modal.open) {
        modal.showModal();
    }
}

function closeModal() {
    const modal = $("#details-modal");

    if (modal?.open) {
        modal.close();
    }

    state.activeRecord = null;
}

$("#modal-close")?.addEventListener("click", closeModal);

$("#modal-footer-close")?.addEventListener("click", closeModal);

$("#details-modal")?.addEventListener("click", event => {
    if (event.target === $("#details-modal")) {
        closeModal();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        state.activeRecord = null;
    }
});

/* =========================================================
   MODAL TABS
========================================================= */

$$("[data-tab]").forEach(button => {
    button.addEventListener("click", () => {
        state.activeTab = button.dataset.tab;
        updateModalTabs();
        renderModalContent();
    });
});

function updateModalTabs() {
    $$("[data-tab]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.tab === state.activeTab
        );
    });
}

function renderModalContent() {
    const container = $("#modal-content");
    const record = state.activeRecord;

    if (!container || !record) return;

    if (record.record_type === "collection") {
        container.innerHTML = renderCollectionDetails(record);
        return;
    }

    const renderers = {
        overview: renderOverviewTab,
        powers: renderPowersTab,
        legal: renderLegalTab,
        relationships: renderRelationshipsTab,
        references: renderReferencesTab
    };

    const renderer = renderers[state.activeTab] || renderOverviewTab;

    container.innerHTML = renderer(record);
}

/* =========================================================
   MODAL CONTENT HELPERS
========================================================= */

function renderField(label, value) {
    if (
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
    ) {
        return "";
    }

    return `
        <div class="detail-field">
            <h3>${escapeHTML(label)}</h3>
            <div>${escapeHTML(formatValue(value))}</div>
        </div>
    `;
}

function formatValue(value) {
    if (Array.isArray(value)) {
        return value.map(item => {
            if (typeof item === "object" && item !== null) {
                return item.name || item.title ||
                       item.description || JSON.stringify(item);
            }
            return String(item);
        }).join("; ");
    }

    if (typeof value === "object" && value !== null) {
        return Object.entries(value)
            .map(([key, item]) =>
                `${key.replace(/_/g, " ")}: ${formatValue(item)}`
            ).join(" | ");
    }

    return String(value);
}

function renderArraySection(title, values) {
    if (
        values === undefined ||
        values === null ||
        (Array.isArray(values) && values.length === 0)
    ) {
        return "";
    }

    const items = Array.isArray(values) ? values : [values];

    return `
        <section class="detail-section">
            <h3>${escapeHTML(title)}</h3>
            <ul>
                ${items.map(item => {
                    if (typeof item === "object" && item !== null) {
                        const heading =
                            item.name || item.title ||
                            item.article || "";

                        const description =
                            item.description || item.summary || "";

                        return `
                            <li>
                                ${heading ? `<strong>${escapeHTML(heading)}</strong>` : ""}
                                ${description ? `<p>${escapeHTML(description)}</p>` : ""}
                                ${!heading && !description ? escapeHTML(formatValue(item)) : ""}
                            </li>
                        `;
                    }

                    return `<li>${escapeHTML(item)}</li>`;
                }).join("")}
            </ul>
        </section>
    `;
}

/* =========================================================
   OVERVIEW TAB
========================================================= */

function renderOverviewTab(record) {
    return `
        <div class="modal-section">
            ${renderField("Description", record.description)}
            ${renderField("Summary", record.summary)}
            ${renderField("Purpose", record.purpose)}
            ${renderField("Category", record.category)}
            ${renderField("Type", record.type)}
            ${renderField("Level", record.level)}
            ${renderField("Institution", getInstitutionName(record.institution_id))}
            ${renderField("Jurisdiction", record.jurisdiction)}
            ${renderField("Position type", record.position_type)}
            ${renderField("Appointment / Selection", record.appointment_or_selection)}
            ${renderField("Qualifications", record.qualifications)}
            ${renderField("Tenure and Removal", record.tenure_and_removal)}
            ${renderArraySection("Key Points", record.key_points)}
            ${renderArraySection("Stages", record.stages)}
            ${renderArraySection("Steps", record.steps)}
            ${renderArraySection("Composition", record.composition)}
        </div>
    `;
}

/* =========================================================
   POWERS AND FUNCTIONS TAB
========================================================= */

function renderPowersTab(record) {
    return `
        <div class="modal-section">
            ${renderField("Powers and Functions", record.powers_and_functions)}
            ${renderArraySection("Functions", record.functions)}
            ${renderArraySection("Purpose", record.purposes)}
            ${renderArraySection("Duties", record.duties)}
            ${renderArraySection("Limitations", record.limitations)}
            ${renderArraySection("Effects", record.effects)}
            ${renderArraySection("Key Rules", record.key_rules)}
        </div>
    `;
}

/* =========================================================
   LEGAL BASIS TAB
========================================================= */

function renderLegalTab(record) {
    return `
        <div class="modal-section">
            ${renderField("Legal Basis", record.legal_basis)}
            ${renderField("Constitutional Basis", record.constitutional_basis)}
            ${renderField("Scope", record.scope)}
            ${renderField("Legal Authority", record.legal_authority)}
            ${renderArraySection("Applicable Rules", record.applicable_rules)}
            ${renderArraySection("Key Constitutional Points", record.key_points)}
        </div>
    `;
}

/* =========================================================
   RELATIONSHIPS TAB
========================================================= */

function renderRelationshipsTab(record) {
    const related = [
        ...asArray(record.children),
        ...asArray(record.related_entities),
        ...asArray(record.linked_entities),
        ...asArray(record.relationships)
    ];

    const ids = [...new Set(
        related.map(item => {
            if (typeof item === "string") return item;

            return item.entity_id ||
                   item.target_id ||
                   item.source_id ||
                   item.id;
        }).filter(Boolean)
    )];

    const linkedRecords = ids.map(id => {
        const found = getRecord(id);

        if (found) return found;

        const institution = asArray(
            state.data.institutions.institutions
        ).find(item => item.id === id);

        return institution || null;
    }).filter(Boolean);

    return `
        <div class="modal-section">
            ${renderField("Parent Institution", record.parent_id)}
            ${renderField("Institution", getInstitutionName(record.institution_id))}
            ${renderField("Supports", record.supports)}

            ${renderArraySection("Relationships", record.relationships)}

            <section class="detail-section">
                <h3>Related Records</h3>

                ${linkedRecords.length ? `
                    <ul class="related-record-list">
                        ${linkedRecords.map(item => `
                            <li>
                                <button
                                    type="button"
                                    class="related-record-button"
                                    data-related-id="${escapeHTML(item.id)}"
                                >
                                    ${escapeHTML(getName(item))}
                                </button>
                            </li>
                        `).join("")}
                    </ul>
                ` : "<p>No linked records available.</p>"}
            </section>
        </div>
    `;
}

/* =========================================================
   REFERENCES TAB
========================================================= */

function renderReferencesTab(record) {
    return `
        <div class="modal-section">
            ${renderField("References", record.references)}
            ${renderField("Sources", record.sources)}
            ${renderField("Source Notes", record.source_notes)}
            ${renderField("Data Quality", record.data_quality)}
            ${renderField("Last Reviewed", record.last_reviewed)}
            ${renderField("Last Updated", record.last_updated)}
            ${renderArraySection("Keywords", record.keywords)}
        </div>
    `;
}

/* =========================================================
   COLLECTION DETAILS
========================================================= */

function renderCollectionDetails(collection) {
    const items = asArray(collection.collection_items);

    return `
        <div class="modal-section">
            ${renderField("Description", collection.description)}

            <h3>Records in this collection (${items.length})</h3>

            <div class="collection-record-list">
                ${items.map(item => `
                    <article class="record-card">
                        <h3>${escapeHTML(getName(item))}</h3>
                        <p>${escapeHTML(getDescription(item))}</p>

                        <button
                            type="button"
                            class="related-record-button"
                            data-related-id="${escapeHTML(item.id)}"
                        >
                            Open details
                        </button>
                    </article>
                `).join("")}
            </div>
        </div>
    `;
}

/* =========================================================
   INSTITUTION NAME
========================================================= */

function getInstitutionName(id) {
    if (!id) return "";

    const institution = asArray(
        state.data.institutions.institutions
    ).find(item => item.id === id);

    return institution?.name || id;
}

/* =========================================================
   MODAL RELATED RECORD EVENTS
========================================================= */

$("#modal-content")?.addEventListener("click", event => {
    const button = event.target.closest("[data-related-id]");

    if (!button) return;

    openRecord(button.dataset.relatedId);
});

/* =========================================================
   EVENT BINDINGS
========================================================= */

// Search
$("#global-search")?.addEventListener("input", () => {
    applyFilters();
});

// Clear search
$("#clear-search")?.addEventListener("click", () => {
    const search = $("#global-search");
    if (search) search.value = "";

    applyFilters();
});

// Filters
$("#category-filter")?.addEventListener("change", applyFilters);
$("#institution-filter")?.addEventListener("change", applyFilters);
$("#sort-filter")?.addEventListener("change", applyFilters);

// Section navigation
$$("[data-section]").forEach(button => {
    button.addEventListener("click", () => {
        selectSection(button.dataset.section);
    });
});

// Quick category navigation
$$("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
        const category = button.dataset.category;

        const select = $("#category-filter");

        if (select) {
            select.value = category;
        }

        state.currentView = "list";
        updateViewButtons();
        applyFilters();
    });
});

// View buttons
$$("[data-view]").forEach(button => {
    button.addEventListener("click", () => {
        state.currentView = button.dataset.view;
        updateViewButtons();
        renderCurrentView();
    });
});

// Expand and collapse all hierarchy groups
$("#expand-all")?.addEventListener("click", () => {
    $$(".hierarchy-group").forEach(group => {
        group.classList.remove("collapsed");
    });
});

$("#collapse-all")?.addEventListener("click", () => {
    $$(".hierarchy-group").forEach(group => {
        group.classList.add("collapsed");
    });
});

// Toggle an individual hierarchy group, if clicked on its heading.
$("#content-area")?.addEventListener("click", event => {
    const heading = event.target.closest(".hierarchy-group > h2");

    if (heading) {
        heading.parentElement.classList.toggle("collapsed");
    }
});

/* =========================================================
   INITIALISATION
========================================================= */

async function initialiseApp() {
    try {
        await loadAllData();

        console.info(
            `Indian Polity loaded: ${state.records.length} records`
        );

    } catch (error) {
        console.error("Application initialisation failed:", error);

        const message = `
            Data loading failed.

            ${error.message}

            Check the browser console and verify the JSON file paths.
        `;

        showMessage(message, true);

        const summary = $("#results-summary");
        if (summary) {
            summary.textContent = "Unable to load reference data.";
        }
    }
}

initialiseApp();
