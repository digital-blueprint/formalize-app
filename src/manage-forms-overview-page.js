// @ts-nocheck
import {css, html, unsafeCSS} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {
    ScopedElementsMixin,
    MiniSpinner,
    Icon,
    DBPSelect,
    getIconSVGURL,
} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {setOverridesByGlobalCache} from '@dbp-toolkit/common/i18next.js';
import {createInstance} from './i18n.js';
import {CustomTabulatorTable} from './table-components.js';
import {MANAGE_FORMS_COMPONENT_STYLES} from './manage-forms-component-styles.js';
import {
    OVERVIEW_ACTION_PLACEMENTS,
    createManageFormsOverviewActionContext,
    resolveManageFormsOverviewAction,
} from './manage-forms-overview-actions.js';
import {
    DEFAULT_PAGINATION_SIZE,
    buildRoutingUrlWithQuery,
    dispatchRoutingUrlChange,
    getQueryString,
    getUrlPaginationSize,
    getUrlPaginationValue,
} from './manage-forms-routing.js';

/**
 * Forms overview table shared by the manage-forms and manage-submissions activities.
 *
 * The activity supplies the form rows, the action definitions and the host used as
 * action context. The overview owns the table, its search, selection, the actions
 * dropdown and keeps search and pagination in sync with the routing URL
 * (`forms-search`, `forms-page`, `forms-page-size`).
 */
export class ManageFormsOverviewPage extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.langDir = '';
        this.loadingFormsTable = false;
        this.showFormsTable = false;
        // Table rows ({id, name, employer, formId, grantedActions, actionButton, ...})
        this.forms = [];
        /** @type {Map<string, object>} Full form entries, merged into the action context items */
        this.formsById = new Map();
        // Action definitions (see manage-forms-overview-actions.js)
        this.actionDefinitions = [];
        // Object passed as `host` to action predicates and handlers (usually the activity)
        this.actionHost = null;
        this.showEmployerColumn = false;
        this.optionsForms = {};
        this.paginationSizeStorageKey = '';
        this.noFormsAvailable = false;
        // Number of modules that implement createForm(); the button is only shown when > 0
        this.creatableModulesCount = 0;
        // Resolved dropdown actions for the current selection
        this.actions = [];
        // Number of currently selected forms in the overview table.
        this.selectedFormsCount = 0;
        this.searchInProgress = false;
        this._restoringUrlState = false;
        this._urlStateReady = false;
        this.updateTableOptions();
    }

    static get scopedElements() {
        return {
            'dbp-mini-spinner': MiniSpinner,
            'dbp-icon': Icon,
            'dbp-tabulator-table': CustomTabulatorTable,
            'dbp-select': DBPSelect,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            langDir: {type: String, attribute: 'lang-dir'},
            loadingFormsTable: {type: Boolean, attribute: false},
            showFormsTable: {type: Boolean, attribute: false},
            forms: {type: Array, attribute: false},
            formsById: {type: Object, attribute: false},
            actionDefinitions: {type: Array, attribute: false},
            actionHost: {type: Object, attribute: false},
            showEmployerColumn: {type: Boolean, attribute: false},
            optionsForms: {type: Object, attribute: false},
            paginationSizeStorageKey: {type: String, attribute: false},
            noFormsAvailable: {type: Boolean, attribute: false},
            creatableModulesCount: {type: Number, attribute: false},
            actions: {type: Array, attribute: false},
            selectedFormsCount: {type: Number, attribute: false},
            searchInProgress: {type: Boolean, attribute: false},
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            if (propName === 'lang') {
                void this._i18n.changeLanguage(this.lang);
            }

            if ((propName === 'lang' || propName === 'langDir') && this.langDir) {
                void setOverridesByGlobalCache(this._i18n, this);
            }
        });

        super.update(changedProperties);
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        const optionsChanged =
            (changedProperties.has('lang') && changedProperties.get('lang') !== undefined) ||
            (changedProperties.has('showEmployerColumn') &&
                changedProperties.get('showEmployerColumn') !== undefined);
        if (optionsChanged) {
            this.updateTableOptions();
        }

        if (
            this.showFormsTable &&
            (optionsChanged ||
                changedProperties.has('forms') ||
                changedProperties.has('showFormsTable'))
        ) {
            this.syncTable({rebuild: optionsChanged});
        }

        if (
            changedProperties.has('actionDefinitions') ||
            changedProperties.has('actionHost') ||
            changedProperties.has('forms')
        ) {
            this.updateActions();
        }

        if (changedProperties.has('routingUrl')) {
            const oldUrl = changedProperties.get('routingUrl');
            if (
                oldUrl !== undefined &&
                this.showFormsTable &&
                getQueryString(oldUrl) !== getQueryString(this.routingUrl)
            ) {
                void this.restoreTableState();
            }
        }
    }

    connectedCallback() {
        super.connectedCallback();

        if (this.langDir) {
            void setOverridesByGlobalCache(this._i18n, this);
        }
    }

    static get styles() {
        return [
            MANAGE_FORMS_COMPONENT_STYLES,
            css`
                .forms-table-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .forms-table-actions {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 0.5rem;
                }

                .forms-table-actions-select {
                    --dbp-select-border-color: var(--dbp-content);
                    --dbp-select-chevron-color: var(--dbp-content);
                    --dbp-select-placeholder-color: var(--dbp-content);
                    --dbp-select-placeholder-font-weight: var(--dbp-content);
                }

                .forms-search {
                    flex: 1;
                    min-width: 12rem;
                }

                .forms-search label {
                    clip: rect(0 0 0 0);
                    clip-path: inset(50%);
                    height: 1px;
                    overflow: hidden;
                    position: absolute;
                    white-space: nowrap;
                    width: 1px;
                }

                .forms-search .searchbar {
                    background: calc(100% - 0.5em) center no-repeat
                        url('${unsafeCSS(getIconSVGURL('search'))}');
                    background-size: 1em;
                }

                @media (max-width: 530px) {
                    .forms-table-actions {
                        align-items: stretch;
                        flex-wrap: wrap;
                    }

                    .forms-search {
                        flex-basis: 100%;
                    }
                }

                .create-form-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                }

                .create-form-btn-icon {
                    flex-shrink: 0;
                    top: 0;
                }

                .hidden {
                    display: none;
                }
            `,
        ];
    }

    /**
     * Builds the tabulator options for the forms table.
     */
    updateTableOptions() {
        const i18n = this._i18n;
        const showEmployerColumn = this.showEmployerColumn;
        const getColumnLabels = (lng) => ({
            id: i18n.t('manage-forms.id', {lng}),
            name: i18n.t('manage-forms.name', {lng}),
            employer: i18n.t('manage-forms.employer', {lng}),
        });

        this.optionsForms = {
            langs: {
                en: {columns: getColumnLabels('en')},
                de: {columns: getColumnLabels('de')},
            },
            layout: 'fitColumns',
            columns: [
                {field: 'id', width: 50, sorter: 'number'},
                {field: 'name', sorter: 'string', widthGrow: showEmployerColumn ? 2 : 4},
                ...(showEmployerColumn
                    ? [{field: 'employer', sorter: 'string', widthGrow: 2}]
                    : []),
                // Hidden helper columns carrying data needed for the actions.
                {field: 'formId', visible: false},
                {field: 'grantedActions', visible: false},
                {field: 'dateCreated', visible: false},
                {
                    field: 'actionButton',
                    formatter: 'html',
                    hozAlign: 'right',
                    widthShrink: 1,
                    minWidth: 44,
                    headerSort: false,
                },
            ],
            columnDefaults: {
                vertAlign: 'middle',
                hozAlign: 'left',
                resizable: false,
            },
            initialSort: [{column: 'dateCreated', dir: 'desc'}],
            selectableRows: 'highlight',
            rowHeader: {
                formatter: 'rowSelection',
                titleFormatter: 'rowSelection',
                titleFormatterParams: {
                    rowRange: 'visible',
                },
                headerSort: false,
                resizable: false,
                frozen: true,
                headerHozAlign: 'center',
                hozAlign: 'center',
                // With the "fitColumns" layout every column grows to fill the row.
                // Pin the selection column to the checkbox width so it doesn't
                // stretch across the table.
                width: 40,
                minWidth: 40,
                widthGrow: 0,
                widthShrink: 0,
            },
            data: this.forms,
        };
    }

    getFormsTable() {
        return this.renderRoot?.querySelector('#tabulator-table-forms') ?? null;
    }

    getSearchbar() {
        return this.renderRoot?.querySelector('#forms-searchbar') ?? null;
    }

    /**
     * Pushes the current rows into the table, building it if necessary.
     * The table state from the routing URL is restored once the data is loaded.
     *
     * @param {{rebuild?: boolean}} options
     */
    syncTable({rebuild = false} = {}) {
        const table = this.getFormsTable();
        if (!table) return;

        this.optionsForms.data = this.forms;
        // The table receives the options through Lit rendering, which may not have
        // propagated yet in this update cycle.
        table.options = this.optionsForms;
        table.data = this.forms;

        if (rebuild && table.tabulatorTable) {
            table.tabulatorTable.destroy();
            table.tableReady = false;
            table.tableBuilding = false;
        }

        if (!table.tableReady && !table.tableBuilding) {
            // State restoration happens in handleTableBuilt().
            table.buildTable();
        } else if (table.tableReady) {
            this._urlStateReady = false;
            const dataLoaded = table.setData(this.forms);
            void Promise.resolve(dataLoaded).then(() => {
                if (this.showFormsTable) {
                    return this.restoreTableState();
                }
            });
        }
    }

    handleTableBuilt() {
        const table = this.getFormsTable();
        // Rows may have changed while the table was building.
        if (table && table.data !== this.forms) {
            void Promise.resolve(table.setData(this.forms)).then(() => this.restoreTableState());
            return;
        }
        void this.restoreTableState();
    }

    /**
     * Applies search and pagination from the routing URL to the table.
     */
    async restoreTableState() {
        const searchInput = this.getSearchbar();
        const table = this.getFormsTable();
        if (!searchInput || !table?.tabulatorTable) return;

        const {queryParams} = this.getRoutingData();
        const searchValue = queryParams.get('forms-search') ?? '';
        const page = getUrlPaginationValue(queryParams.get('forms-page'), 1);
        const pageSize = getUrlPaginationSize(
            queryParams.get('forms-page-size'),
            table.paginationSize,
        );

        this._restoringUrlState = true;
        try {
            searchInput.value = searchValue;
            this.searchInProgress = searchValue !== '';
            table.paginationSize = pageSize;
            await table.tabulatorTable.setPageSize(pageSize);
            this.applySearch(searchValue);
            await table.tabulatorTable.setPage(page);
        } finally {
            this._restoringUrlState = false;
            this._urlStateReady = true;
        }
    }

    /**
     * Keeps the routing URL in sync with the table pagination.
     *
     * @param {CustomEvent} event
     */
    handleTablePageLoaded(event) {
        if (this._restoringUrlState || !this._urlStateReady) return;

        const page = event.detail?.page ?? 1;
        const pageSize =
            event.detail?.paginationSize ?? event.detail?.pageSize ?? DEFAULT_PAGINATION_SIZE;
        this.updateRoutingQuery({
            'forms-page': page === 1 ? null : page,
            'forms-page-size': pageSize === DEFAULT_PAGINATION_SIZE ? null : pageSize,
        });
    }

    /**
     * @param {Record<string, any>} values
     */
    updateRoutingQuery(values) {
        const routingUrl = buildRoutingUrlWithQuery(this.getRoutingData(), values);
        if (routingUrl === this.routingUrl) return;

        // Update locally right away, so consecutive changes build on each other
        // before the activity passes the new URL back down.
        this.routingUrl = routingUrl;
        dispatchRoutingUrlChange(this, routingUrl);
    }

    /**
     * Returns the selected rows merged with the full form entries.
     *
     * @returns {Array<object>}
     */
    getSelectedItems() {
        const selectedData = this.getFormsTable()?.tabulatorTable?.getSelectedData() ?? [];
        return selectedData.map((rowData) => ({
            ...rowData,
            ...(this.formsById?.get(rowData.formId) ?? {}),
        }));
    }

    /** Resolves dropdown actions for the current form selection. */
    updateActions() {
        if (!this.actionHost) return;

        const items = this.getSelectedItems();
        this.selectedFormsCount = items.length;
        const context = createManageFormsOverviewActionContext(this.actionHost, items);
        this.actions = this.actionDefinitions
            .filter((action) => action.placements?.includes(OVERVIEW_ACTION_PLACEMENTS.DROPDOWN))
            .map((action) => resolveManageFormsOverviewAction(action, context))
            .filter((action) => action.visible)
            .map((action) => ({
                value: action.id,
                label: action.label,
                iconName: action.iconName,
                disabled: !action.enabled,
            }));
    }

    /**
     * Runs a dropdown action for the selected forms.
     *
     * @param {string} actionId
     * @param {Event|null} event
     */
    runAction(actionId, event = null) {
        const action = this.actionDefinitions.find((candidate) => candidate.id === actionId);
        if (!action || !this.actionHost) return;

        const context = createManageFormsOverviewActionContext(
            this.actionHost,
            this.getSelectedItems(),
            event,
        );
        const resolvedAction = resolveManageFormsOverviewAction(action, context);
        if (resolvedAction.visible && resolvedAction.enabled) {
            action.handler(context);
        }
    }

    handleSearch(event) {
        event?.preventDefault();

        const searchInput = this.getSearchbar();
        if (!searchInput) return;

        const value = searchInput.value.trim();
        this.searchInProgress = value !== '';

        this.applySearch(value);
        this.dispatchSearchChange(value);
    }

    applySearch(filterValue) {
        const table = this.getFormsTable();
        if (!table) return;

        if (filterValue === '') {
            table.clearFilter();
            return;
        }

        const filters = (this.optionsForms.columns ?? [])
            .filter(
                (column) => column.field && column.visible !== false && column.formatter !== 'html',
            )
            .map((column) => ({field: column.field, type: 'like', value: filterValue}));

        table.setFilter([filters]);
    }

    dispatchSearchChange(value) {
        this.updateRoutingQuery({'forms-search': value, 'forms-page': null});
        this.dispatchEvent(
            new CustomEvent('forms-search-change', {
                detail: {value},
                bubbles: true,
                composed: true,
            }),
        );
    }

    handleResetSearch() {
        const searchInput = this.getSearchbar();
        const table = this.getFormsTable();
        if (!searchInput || !table) return;
        this.searchInProgress = false;

        searchInput.value = '';
        table.clearFilter();
        this.dispatchSearchChange('');
        searchInput.focus();
    }

    /**
     * Dispatches an event to request opening the create form dialog.
     */
    _onCreateFormClick() {
        this.dispatchEvent(
            new CustomEvent('create-form-request', {
                bubbles: true,
                composed: true,
            }),
        );
    }

    _onFormAction(event) {
        const action = event.detail?.option?.value;
        if (!action) return;

        this.runAction(action, event);
        this.dispatchEvent(
            new CustomEvent('form-action', {
                detail: {action},
                bubbles: true,
                composed: true,
            }),
        );
    }

    render() {
        const i18n = this._i18n;
        const formActions = this.actions;
        const hasDropdownActions = formActions.length > 0;

        return html`
            <div class="container forms-table ${classMap({hidden: !this.showFormsTable})}">
                <div
                    class="forms-table-toolbar ${classMap({
                        hidden: !this.loadingFormsTable && this.creatableModulesCount === 0,
                    })}">
                    <span class="${classMap({hidden: !this.loadingFormsTable})}">
                        <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
                    </span>
                    <button
                        class="button is-primary create-form-btn ${classMap({
                            hidden: this.creatableModulesCount === 0,
                        })}"
                        type="button"
                        @click="${this._onCreateFormClick}">
                        <dbp-icon
                            class="create-form-btn-icon"
                            name="plus"
                            aria-hidden="true"></dbp-icon>
                        ${i18n.t('manage-forms.create-form-button')}
                    </button>
                </div>
                <div class="forms-table-actions">
                    <dbp-select
                        class="forms-table-actions-select ${classMap({
                            hidden: !hasDropdownActions,
                        })}"
                        ?disabled=${
                            this.selectedFormsCount === 0 ||
                            !formActions.some((action) => !action.disabled)
                        }
                        @change=${this._onFormAction}
                        id="forms-table-actions-select"
                        label="${i18n.t('manage-forms.actions-button-text')}"
                        align="left"
                        allow-expand
                        .options=${formActions}></dbp-select>
                    <form class="search-input forms-search" @submit=${this.handleSearch}>
                        <label for="forms-searchbar">
                            ${i18n.t('manage-forms.search-input-label')}:
                        </label>
                        <input
                            type="text"
                            id="forms-searchbar"
                            class="searchbar"
                            placeholder="${i18n.t('manage-forms.searchbar-placeholder')}"
                            @input=${this.handleSearch} />
                    </form>
                    <button
                        type="button"
                        class="reset-search"
                        @click=${this.handleResetSearch}
                        ?disabled=${!this.searchInProgress}>
                        <dbp-icon name="spinner-arrow" aria-hidden="true"></dbp-icon>
                        ${i18n.t('manage-forms.reset-search-label')}
                    </button>
                </div>
                <dbp-tabulator-table
                    lang="${this.lang}"
                    class="tabulator-table"
                    id="tabulator-table-forms"
                    identifier="forms-table"
                    pagination-enabled
                    pagination-size="5"
                    .paginationSizeStorageKey=${this.paginationSizeStorageKey}
                    .options=${this.optionsForms}
                    @dbp-tabulator-table-built=${() => this.handleTableBuilt()}
                    @dbp-tabulator-table-row-selection-changed-event=${() => this.updateActions()}
                    @dbp-tabulator-table-page-loaded-event=${(event) =>
                        this.handleTablePageLoaded(event)}
                    @dbp-tabulator-table-page-size-changed-event=${(event) =>
                        this.handleTablePageLoaded(event)}></dbp-tabulator-table>
                ${
                    this.noFormsAvailable
                        ? html`
                              <p class="no-forms-message">
                                  ${i18n.t('manage-forms.no-forms-available')}
                              </p>
                          `
                        : ''
                }
            </div>
        `;
    }
}
