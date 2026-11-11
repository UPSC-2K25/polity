
"use strict";

/*
  INDIAN POLITY REFERENCE SYSTEM
  Application controller

  Loads:
    data/institutions.json
    data/hierarchy.json
    data/posts.json
    data/relationships.json
    data/committees.json
    data/procedures.json
    data/constitutional-provisions.json

  The application reads content from JSON.
  It does not contain hardcoded polity records.
*/

const DATA_FILES = {
  institutions: "data/institutions.json",
  hierarchy: "data/hierarchy.json",
  posts: "data/posts.json",
  relationships: "data/relationships.json",
  committees: "data/committees.json",
  procedures: "data/procedures.json",
  provisions: "data/constitutional-provisions.json"
};

const PAGE_SIZE = 10;

const state = {
  data: {},
  records: [],
  filteredRecords: [],
  currentPage: 1,
  pageSize: PAGE_SIZE,
  currentView: "list",
  activeRecord: null,
  activeTab: "overview",
  selectedCategory: "all",
  selectedInstitution: "all",
  searchTerm: "",
  sortOrder: "alphabetical"
};

/* -------------------------------------------------------
   DOM HELPERS
------------------------------------------------------- */

const $ = (...selectors) => {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
};

const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatText(value) {
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === "object") {
        return item.name || item.title || JSON.stringify(item);
      }
      return item;
    }).join(", ");
  }

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value, null, 2);
  }

  return String(value ?? "");
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getById(collection, id) {
  return collection.find(item => item.id === id);
}

/* -------------------------------------------------------
   DATA LOADING
------------------------------------------------------- */

async function loadJSON(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Unable to load ${path}: ${response.status}`);
  }

  return response.json();
}

async function loadAllData() {
  const entries = Object.entries(DATA_FILES);

  const results = await Promise.all(
    entries.map(async ([key, path]) => {
      const json = await loadJSON(path);
      return [key, json];
    })
  );

  state.data = Object.fromEntries(results);

  buildRecordIndex();
  populateFilters();
  applyFilters();
  renderHierarchy();
}

function showLoading(message) {
  const container = $("#resultsContainer, #recordsContainer, #contentArea");

  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        ${escapeHTML(message)}
      </div>
    `;
  }
}

function showError(error) {
  console.error(error);

  showLoading(
    "The reference data could not be loaded. Check that the project is running through a local web server and that all JSON file paths are correct."
  );
}

/* -------------------------------------------------------
   BUILD SEARCHABLE RECORD INDEX
------------------------------------------------------- */

function buildRecordIndex() {
  const {
    institutions,
    posts,
    committees,
    procedures,
    provisions
  } = state.data;

  const records = [];

  toArray(institutions.institutions).forEach(item => {
    records.push({
      ...item,
      record_type: "institution",
      category: item.type || "institution"
    });
  });

  toArray(posts.posts).forEach(item => {
    records.push({
      ...item,
      record_type: "post",
      category: item.category || "post"
    });
  });

  toArray(committees.committees).forEach(item => {
    records.push({
      ...item,
      record_type: "committee",
      category: "committee"
    });
  });

  toArray(procedures.procedures).forEach(item => {
    records.push({
      ...item,
      record_type: "procedure",
      category: item.category || "procedure"
    });
  });

  toArray(provisions.provisions).forEach(item => {
    records.push({
      ...item,
      record_type: "provision",
      category: "constitutional_provision"
    });
  });

  state.records = records;
}

/* -------------------------------------------------------
   SEARCH
------------------------------------------------------- */

function searchableText(record) {
  const values = [
    record.id,
    record.name,
    record.short_name,
    record.title,
    record.description,
    record.summary,
    record.article,
    record.category,
    record.level,
    record.type,
    record.position_type,
    record.institution_id,
    record.keywords,
    record.powers_and_functions,
    record.purpose,
    record.purposes,
    record.functions,
    record.key_points,
    record.legal_basis,
    record.constitutional_basis,
    record.references,
    record.related_entities,
    record.relationships,
    record.stages,
    record.steps,
    record.types
  ];

  return JSON.stringify(values).toLowerCase();
}

function matchesSearch(record, term) {
  if (!term) return true;

  const words = term
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const content = searchableText(record);

  return words.every(word => content.includes(word));
}

/* -------------------------------------------------------
   FILTERS
------------------------------------------------------- */

function populateFilters() {
  populateCategoryFilter();
  populateInstitutionFilter();
}

function populateCategoryFilter() {
  const select = $(
    "#categoryFilter",
    "#filterCategory",
    "[name='categoryFilter']"
  );

  if (!select) return;

  const currentValue = select.value || "all";

  const categories = [
    ...new Set(state.records.map(record => record.category).filter(Boolean))
  ].sort();

  select.innerHTML = `
    <option value="all">All categories</option>
    ${categories.map(category => `
      <option value="${escapeHTML(category)}">
        ${escapeHTML(category.replaceAll("_", " "))}
      </option>
    `).join("")}
  `;

  select.value = categories.includes(currentValue)
    ? currentValue
    : "all";
}

function populateInstitutionFilter() {
  const select = $(
    "#institutionFilter",
    "#filterInstitution",
    "[name='institutionFilter']"
  );

  if (!select) return;

  const currentValue = select.value || "all";

  const institutions = toArray(
    state.data.institutions.institutions
  );

  select.innerHTML = `
    <option value="all">All institutions</option>
    ${institutions.map(item => `
      <option value="${escapeHTML(item.id)}">
        ${escapeHTML(item.name)}
      </option>
    `).join("")}
  `;

  select.value = institutions.some(item => item.id === currentValue)
    ? currentValue
    : "all";
}

function matchesInstitution(record, institutionId) {
  if (institutionId === "all") return true;

  const related = [
    record.institution_id,
    record.parent_id,
    ...toArray(record.related_entities),
    ...toArray(record.relationships).flatMap(item =>
      typeof item === "object"
        ? [item.entity_id, item.target_id, item.source_id]
        : [item]
    )
  ].filter(Boolean);

  return related.includes(institutionId);
}

function applyFilters() {
  const searchInput = $(
    "#globalSearch",
    "#searchInput",
    "[name='search']"
  );

  const categorySelect = $(
    "#categoryFilter",
    "#filterCategory",
    "[name='categoryFilter']"
  );

  const institutionSelect = $(
    "#institutionFilter",
    "#filterInstitution",
    "[name='institutionFilter']"
  );

  const sortSelect = $(
    "#sortSelect",
    "#sortOrder",
    "[name='sort']"
  );

  state.searchTerm = searchInput?.value.trim() || "";
  state.selectedCategory = categorySelect?.value || "all";
  state.selectedInstitution = institutionSelect?.value || "all";
  state.sortOrder = sortSelect?.value || "alphabetical";

  let results = state.records.filter(record => {
    const searchMatch = matchesSearch(record, state.searchTerm);

    const categoryMatch =
      state.selectedCategory === "all" ||
      record.category === state.selectedCategory;

    const institutionMatch = matchesInstitution(
      record,
      state.selectedInstitution
    );

    return searchMatch && categoryMatch && institutionMatch;
  });

  results = sortRecords(results);

  state.filteredRecords = results;
  state.currentPage = 1;

  renderResults();
  renderPagination();
  updateResultCount();
}

function sortRecords(records) {
  const sorted = [...records];

  switch (state.sortOrder) {
    case "newest":
      return sorted.reverse();

    case "type":
      return sorted.sort((a, b) =>
        String(a.record_type).localeCompare(String(b.record_type))
      );

    case "alphabetical":
    default:
      return sorted.sort((a, b) =>
        getRecordName(a).localeCompare(getRecordName(b))
      );
  }
}

/* -------------------------------------------------------
   RECORD DISPLAY
------------------------------------------------------- */

function getRecordName(record) {
  return record.name || record.title || record.short_name || record.id;
}

function getRecordDescription(record) {
  return record.description || record.summary || "";
}

function getRecordTypeLabel(record) {
  const labels = {
    institution: "Institution",
    post: "Constitutional / Legislative Post",
    committee: "Committee",
    procedure: "Procedure",
    provision: "Constitutional Provision"
  };

  return labels[record.record_type] || "Reference";
}

function renderResults() {
  const container = $(
    "#resultsContainer",
    "#recordsContainer",
    "#contentArea"
  );

  if (!container) return;

  if (state.currentView === "hierarchy") {
    renderHierarchy();
    return;
  }

  const start = (state.currentPage - 1) * state.pageSize;

  const pageRecords = state.filteredRecords.slice(
    start,
    start + state.pageSize
  );

  if (pageRecords.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No matching records found.
        <p>Try a different keyword or remove one of the filters.</p>
      </div>
    `;
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
          aria-label="Open ${escapeHTML(getRecordName(record))}"
        >
          <div class="record-card-main">
            <div class="record-card-heading">
              <h3>${escapeHTML(getRecordName(record))}</h3>
              <span class="record-type">
                ${escapeHTML(getRecordTypeLabel(record))}
              </span>
            </div>

            <p>${escapeHTML(getRecordDescription(record))}</p>

            <div class="record-meta">
              ${record.level
                ? `<span>${escapeHTML(record.level)}</span>`
                : ""}
              ${record.article
                ? `<span>Article ${escapeHTML(record.article)}</span>`
                : ""}
              ${record.short_name
                ? `<span>${escapeHTML(record.short_name)}</span>`
                : ""}
            </div>
          </div>
          <span class="record-open">View details →</span>
        </article>
      `).join("")}
    </div>
  `;

  container.querySelectorAll("[data-record-id]").forEach(card => {
    const open = () => openRecord(card.dataset.recordId);

    card.addEventListener("click", open);

    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function updateResultCount() {
  const count = $(
    "#resultCount",
    "#resultsCount",
    "[data-result-count]"
  );

  if (count) {
    count.textContent =
      `${state.filteredRecords.length} records found`;
  }
}

/* -------------------------------------------------------
   PAGINATION
------------------------------------------------------- */

function renderPagination() {
  const container = $(
    "#pagination",
    "#paginationContainer"
  );

  if (!container) return;

  const totalPages = Math.ceil(
    state.filteredRecords.length / state.pageSize
  );

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const current = state.currentPage;

  let buttons = "";

  for (let page = 1; page <= totalPages; page++) {
    if (
      page === 1 ||
      page === totalPages ||
      Math.abs(page - current) <= 2
    ) {
      buttons += `
        <button
          type="button"
          class="page-button ${page === current ? "active" : ""}"
          data-page="${page}"
          aria-current="${page === current ? "page" : "false"}"
        >
          ${page}
        </button>
      `;
    } else if (
      Math.abs(page - current) === 3
    ) {
      buttons += `<span class="page-ellipsis">…</span>`;
    }
  }

  container.innerHTML = `
    <button
      type="button"
      class="page-button"
      data-page="${current - 1}"
      ${current === 1 ? "disabled" : ""}
    >
      Previous
    </button>

    ${buttons}

    <button
      type="button"
      class="page-button"
      data-page="${current + 1}"
      ${current === totalPages ? "disabled" : ""}
    >
      Next
    </button>
  `;

  container.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      const page = Number(button.dataset.page);

      if (page < 1 || page > totalPages) return;

      state.currentPage = page;

      renderResults();
      renderPagination();

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  });
}

/* -------------------------------------------------------
   HIERARCHY VIEW
------------------------------------------------------- */

function renderHierarchy() {
  const container = $(
    "#resultsContainer",
    "#recordsContainer",
    "#contentArea"
  );

  if (!container) return;

  const hierarchy = state.data.hierarchy;
  const sections = toArray(hierarchy.sections);

  if (!sections.length) {
    container.innerHTML = `
      <div class="empty-state">
        Hierarchy data is not available.
      </div>
    `;
    return;
  }

  const html = sections.map(section => {
    const groups = toArray(section.groups);

    return `
      <section class="hierarchy-section">
        <h2>${escapeHTML(section.name || section.title || section.id)}</h2>

        ${section.description
          ? `<p>${escapeHTML(section.description)}</p>`
          : ""}

        ${groups.map(group => `
          <div class="hierarchy-group">
            <h3>${escapeHTML(group.name || group.title || "")}</h3>

            <div class="hierarchy-items">
              ${toArray(group.items).map(item => {
                const record = findHierarchyRecord(item);

                if (!record) return "";

                return `
                  <button
                    type="button"
                    class="hierarchy-item"
                    data-record-id="${escapeHTML(record.id)}"
                  >
                    <span>${escapeHTML(getRecordName(record))}</span>
                    <span>View →</span>
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        `).join("")}
      </section>
    `;
  }).join("");

  container.innerHTML = html;

  container.querySelectorAll("[data-record-id]").forEach(button => {
    button.addEventListener("click", () => {
      openRecord(button.dataset.recordId);
    });
  });
}

function findHierarchyRecord(item) {
  const type = item.type;
  const id = item.id || item.ref || item.target_id;

  if (!id) return null;

  if (type === "institution") {
    return getById(
      state.data.institutions.institutions,
      id
    );
  }

  if (type === "post") {
    return getById(state.data.posts.posts, id);
  }

  if (type === "collection") {
    return getCollectionRecord(id);
  }

  return state.records.find(record => record.id === id) || null;
}

function getCollectionRecord(collectionId) {
  const sources = [
    state.data.committees,
    state.data.procedures
  ];

  for (const source of sources) {
    const collection = toArray(source.collections).find(
      item => item.id === collectionId
    );

    if (!collection) continue;

    const ids = collection.committee_ids ||
      collection.procedure_ids ||
      [];

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      record_type: "collection",
      category: "collection",
      collection_items: ids.map(id =>
        state.records.find(record => record.id === id)
      ).filter(Boolean)
    };
  }

  return null;
}

/* -------------------------------------------------------
   DETAIL MODAL
------------------------------------------------------- */

function openRecord(recordId) {
  const record = state.records.find(item => item.id === recordId);

  if (!record) {
    console.warn(`Record not found: ${recordId}`);
    return;
  }

  state.activeRecord = record;
  state.activeTab = "overview";

  renderModal();

  const modal = $(
    "#detailModal",
    "#recordModal",
    "[data-detail-modal]"
  );

  if (!modal) return;

  if (typeof modal.showModal === "function") {
    modal.showModal();
  } else {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }
}

function closeModal() {
  const modal = $(
    "#detailModal",
    "#recordModal",
    "[data-detail-modal]"
  );

  if (!modal) return;

  if (typeof modal.close === "function" && modal.open) {
    modal.close();
  } else {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  state.activeRecord = null;
}

function renderModal() {
  const record = state.activeRecord;

  if (!record) return;

  const title = $(
    "#modalTitle",
    "#detailModalTitle"
  );

  const body = $(
    "#modalBody",
    "#detailModalBody"
  );

  const tabs = $(
    "#modalTabs",
    "#detailModalTabs"
  );

  if (title) {
    title.textContent = getRecordName(record);
  }

  if (tabs) {
    tabs.innerHTML = `
      <button data-tab="overview" class="modal-tab active">
        Overview
      </button>
      <button data-tab="powers" class="modal-tab">
        Powers & Functions
      </button>
      <button data-tab="legal" class="modal-tab">
        Legal Basis
      </button>
      <button data-tab="relationships" class="modal-tab">
        Relationships
      </button>
      <button data-tab="references" class="modal-tab">
        References
      </button>
    `;

    tabs.querySelectorAll("[data-tab]").forEach(button => {
      button.addEventListener("click", () => {
        state.activeTab = button.dataset.tab;

        tabs.querySelectorAll("[data-tab]").forEach(tab => {
          tab.classList.toggle(
            "active",
            tab.dataset.tab === state.activeTab
          );
        });

        renderModalBody();
      });
    });
  }

  renderModalBody();
}

function renderModalBody() {
  const body = $(
    "#modalBody",
    "#detailModalBody"
  );

  if (!body || !state.activeRecord) return;

  const record = state.activeRecord;

  const renderers = {
    overview: renderOverviewTab,
    powers: renderPowersTab,
    legal: renderLegalTab,
    relationships: renderRelationshipsTab,
    references: renderReferencesTab
  };

  const renderer = renderers[state.activeTab] || renderOverviewTab;

  body.innerHTML = renderer(record);
}

/* -------------------------------------------------------
   MODAL TAB CONTENT
------------------------------------------------------- */

function renderOverviewTab(record) {
  const fields = [
    ["Description", record.description],
    ["Summary", record.summary],
    ["Purpose", record.purpose],
    ["Level", record.level],
    ["Category", record.category],
    ["Position type", record.position_type],
    ["Institution", getInstitutionName(record.institution_id)],
    ["Article", record.article ? `Article ${record.article}` : null],
    ["Qualifications", record.qualifications],
    ["Appointment / Selection", record.appointment_or_selection],
    ["Tenure and Removal", record.tenure_and_removal]
  ];

  return `
    <div class="modal-section">
      ${fields.map(([label, value]) => renderField(label, value)).join("")}

      ${renderArraySection("Key Points", record.key_points)}
      ${renderArraySection("Steps", record.steps)}
      ${renderArraySection("Stages", record.stages)}
      ${renderArraySection("Types", record.types)}
    </div>
  `;
}

function renderPowersTab(record) {
  return `
    <div class="modal-section">
      ${renderField("Powers and Functions", record.powers_and_functions)}
      ${renderArraySection("Functions", record.functions)}
      ${renderArraySection("Purpose", record.purposes)}
      ${renderArraySection("Limitations", record.limitations)}
      ${renderArraySection("Effects", record.effects)}
      ${renderArraySection("Key Rules", record.key_rules)}
    </div>
  `;
}

function renderLegalTab(record) {
  return `
    <div class="modal-section">
      ${renderField("Legal Basis", record.legal_basis)}
      ${renderField("Constitutional Basis", record.constitutional_basis)}
      ${renderField("Scope", record.scope)}
      ${renderArraySection("Applicable Rules", record.legal_basis)}
    </div>
  `;
}

function renderRelationshipsTab(record) {
  const related = [
    ...toArray(record.related_entities),
    ...toArray(record.children),
    ...toArray(record.relationships)
  ];

  const unique = [...new Set(
    related.map(item => {
      if (typeof item === "string") return item;

      return item.entity_id ||
        item.target_id ||
        item.source_id ||
        item.id ||
        item.name;
    }).filter(Boolean)
  )];

  return `
    <div class="modal-section">
      ${renderField("Parent", record.parent_id)}
      ${renderField("Institution", record.institution_id)}
      ${renderField("Supports", record.supports)}

      <h3>Related Records</h3>

      ${unique.length
        ? `<ul class="related-record-list">
            ${unique.map(id => {
              const relatedRecord = state.records.find(item =>
                item.id === id
              );

              return `
                <li>
                  ${relatedRecord
                    ? `<button
                        type="button"
                        class="related-record-link"
                        data-related-id="${escapeHTML(id)}"
                      >
                        ${escapeHTML(getRecordName(relatedRecord))}
                      </button>`
                    : escapeHTML(id)}
                </li>
              `;
            }).join("")}
          </ul>`
        : `<p>No linked records are listed.</p>`
      }
    </div>
  `;
}

function renderReferencesTab(record) {
  return `
    <div class="modal-section">
      ${renderArraySection("References", record.references)}
      ${renderArraySection("Sources", record.sources)}
      ${renderArraySection("Data Quality Notes", record.data_quality)}
      ${renderField("Last Reviewed", record.last_reviewed)}
    </div>
  `;
}

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
      <div>${escapeHTML(formatText(value))}</div>
    </div>
  `;
}

function renderArraySection(title, values) {
  if (!values || (Array.isArray(values) && values.length === 0)) {
    return "";
  }

  const items = Array.isArray(values) ? values : [values];

  return `
    <section class="detail-section">
      <h3>${escapeHTML(title)}</h3>
      <ul>
        ${items.map(item => {
          if (typeof item === "object" && item !== null) {
            const heading = item.name || item.title || item.article || "";
            const description = item.description || item.summary || "";

            return `
              <li>
                ${heading
                  ? `<strong>${escapeHTML(heading)}</strong>`
                  : ""}
                ${description
                  ? `<p>${escapeHTML(description)}</p>`
                  : ""}
                ${!heading && !description
                  ? escapeHTML(formatText(item))
                  : ""}
              </li>
            `;
          }

          return `<li>${escapeHTML(item)}</li>`;
        }).join("")}
      </ul>
    </section>
  `;
}

function getInstitutionName(institutionId) {
  if (!institutionId) return "";

  const institution = getById(
    state.data.institutions.institutions,
    institutionId
  );

  return institution?.name || institutionId;
}

/* -------------------------------------------------------
   EVENT BINDINGS
------------------------------------------------------- */

function bindSearch() {
  const searchInput = $(
    "#globalSearch",
    "#searchInput",
    "[name='search']"
  );

  if (!searchInput) return;

  let searchDelay;

  searchInput.addEventListener("input", () => {
    clearTimeout(searchDelay);

    searchDelay = setTimeout(() => {
      applyFilters();
    }, 180);
  });
}

function bindFilters() {
  const controls = [
    "#categoryFilter",
    "#filterCategory",
    "#institutionFilter",
    "#filterInstitution",
    "#sortSelect",
    "#sortOrder"
  ];

  controls.forEach(selector => {
    const element = $(selector);

    element?.addEventListener("change", applyFilters);
  });
}

function bindViewControls() {
  const listButton = $(
    "#listViewButton",
    "#listViewBtn",
    "[data-view='list']"
  );

  const hierarchyButton = $(
    "#hierarchyViewButton",
    "#hierarchyViewBtn",
    "[data-view='hierarchy']"
  );

  listButton?.addEventListener("click", () => {
    state.currentView = "list";
    updateViewButtons();
    renderResults();
  });

  hierarchyButton?.addEventListener("click", () => {
    state.currentView = "hierarchy";
    updateViewButtons();
    renderHierarchy();
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

function bindModalControls() {
  const closeButtons = $$(
    "#closeModal, #modalClose, [data-close-modal]"
  );

  closeButtons.forEach(button => {
    button.addEventListener("click", closeModal);
  });

  const modal = $(
    "#detailModal",
    "#recordModal",
    "[data-detail-modal]"
  );

  modal?.addEventListener("click", event => {
    if (event.target === modal) {
      closeModal();
    }
  });

  modal?.addEventListener("click", event => {
    const relatedButton = event.target.closest("[data-related-id]");

    if (relatedButton) {
      openRecord(relatedButton.dataset.relatedId);
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && state.activeRecord) {
      closeModal();
    }
  });
}

function bindResetButton() {
  const resetButton = $(
    "#resetFilters",
    "#clearFilters",
    "[data-reset-filters]"
  );

  resetButton?.addEventListener("click", () => {
    const searchInput = $(
      "#globalSearch",
      "#searchInput",
      "[name='search']"
    );

    const category = $(
      "#categoryFilter",
      "#filterCategory"
    );

    const institution = $(
      "#institutionFilter",
      "#filterInstitution"
    );

    const sort = $(
      "#sortSelect",
      "#sortOrder"
    );

    if (searchInput) searchInput.value = "";
    if (category) category.value = "all";
    if (institution) institution.value = "all";
    if (sort) sort.value = "alphabetical";

    applyFilters();
  });
}

/* -------------------------------------------------------
   INITIALISE
------------------------------------------------------- */

function initialiseApp() {
  bindSearch();
  bindFilters();
  bindViewControls();
  bindModalControls();
  bindResetButton();

  showLoading("Loading reference data...");

  loadAllData().catch(showError);
}

document.addEventListener("DOMContentLoaded", initialiseApp);
