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

export class ManageFormsOverviewPage extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.langDir = '';
        this.loadingFormsTable = false;
        this.showFormsTable = false;
        this.showSubmissionTables = false;
        this.optionsForms = {};
        this.paginationSizeStorageKey = '';
        this.noFormsAvailable = false;
        // Number of modules that implement createForm(); the button is only shown when > 0
        this.creatableModulesCount = 0;
        this.actions = [];
        // Number of currently selected forms in the overview table.
        this.selectedFormsCount = 0;
        this.searchInProgress = false;
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
            showSubmissionTables: {type: Boolean, attribute: false},
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

    getFormsTable() {
        return this.renderRoot?.querySelector('#tabulator-table-forms') ?? null;
    }

    getSearchbar() {
        return this.renderRoot?.querySelector('#forms-searchbar') ?? null;
    }

    handleSearch(event) {
        event?.preventDefault();

        const searchInput = this.getSearchbar();
        if (!searchInput) return;

        this.searchInProgress = searchInput.value.trim() !== '';

        this.applySearch(searchInput.value.trim());
        this.dispatchSearchChange(searchInput.value.trim());
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

        return html`
            <div class="container forms-table ${classMap({hidden: !this.showFormsTable})}">
                <div class="forms-table-toolbar">
                    <span
                        class="${classMap({
                            hidden: !this.loadingFormsTable || this.showSubmissionTables,
                        })}">
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
                        ?disabled=${
                            this.selectedFormsCount === 0 ||
                            !formActions.some((action) => !action.disabled)
                        }
                        @change=${this._onFormAction}
                        id="forms-table-actions-select"
                        class="forms-table-actions-select"
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
                    .options=${this.optionsForms}></dbp-tabulator-table>
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
