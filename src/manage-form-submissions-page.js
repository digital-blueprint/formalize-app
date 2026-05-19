// @ts-nocheck
import {html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {ScopedElementsMixin, Icon, MiniSpinner, DBPSelect} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {setOverridesByGlobalCache} from '@dbp-toolkit/common/i18next.js';
import {createInstance} from './i18n.js';
import {CustomTabulatorTable} from './table-components.js';
import {ColumnSettingsModal} from './column-settings-modal.js';
import {SUBMISSION_STATES} from './utils.js';
import {MANAGE_FORMS_COMPONENT_STYLES} from './manage-forms-component-styles.js';

export class ManageFormSubmissionsPage extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.langDir = '';
        this.showFormsTable = false;
        this.showSubmissionTables = false;
        this.loadingSubmissionTables = false;
        this.activeFormName = '';
        this.createSubmissionUrl = '';
        this.hideCreateSubmissionButton = false;
        this.enabledStates = {draft: false, submitted: false};
        this.noSubmissionAvailable = {draft: true, submitted: true};
        this.searchWidgetIsOpen = {draft: false, submitted: false};
        this.isEditSubmissionEnabled = {draft: false, submitted: false};
        this.isBatchTaggingEnabled = {draft: false, submitted: false};
        this.isEditSubmissionPermissionEnabled = {draft: false, submitted: false};
        this.isDeleteAllSubmissionEnabled = {draft: false, submitted: false};
        this.isDeleteSelectedSubmissionEnabled = {draft: false, submitted: false};
        this.optionsSubmissions = {draft: {}, submitted: {}};
        this.submissions = {draft: [], submitted: []};
        this.submissionsColumns = {draft: [], submitted: []};
        this.iconNameVisible = 'source_icons_eye-empty';
        this.iconNameHidden = 'source_icons_eye-off';
        this.isResetButtonDisabled = {draft: true, submitted: true};
        this.selectedRowCount = {draft: 0, submitted: 0};
        this.allRowCount = {draft: 0, submitted: 0};
        this.visibleRowCount = {draft: 0, submitted: 0};
        this.searchIsActive = {draft: false, submitted: false};
        this.submissionsHasAttachment = {draft: false, submitted: false};
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-tabulator-table': CustomTabulatorTable,
            'dbp-select': DBPSelect,
            'dbp-formalize-column-settings-modal': ColumnSettingsModal,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            langDir: {type: String, attribute: 'lang-dir'},
            showFormsTable: {type: Boolean, attribute: false},
            showSubmissionTables: {type: Boolean, attribute: false},
            loadingSubmissionTables: {type: Boolean, attribute: false},
            activeFormName: {type: String, attribute: false},
            createSubmissionUrl: {type: String, attribute: false},
            hideCreateSubmissionButton: {type: Boolean, attribute: false},
            enabledStates: {type: Object, attribute: false},
            noSubmissionAvailable: {type: Object, attribute: false},
            searchWidgetIsOpen: {type: Object, attribute: false},
            isEditSubmissionEnabled: {type: Object, attribute: false},
            isBatchTaggingEnabled: {type: Object, attribute: false},
            isEditSubmissionPermissionEnabled: {type: Object, attribute: false},
            isDeleteAllSubmissionEnabled: {type: Object, attribute: false},
            isDeleteSelectedSubmissionEnabled: {type: Object, attribute: false},
            optionsSubmissions: {type: Object, attribute: false},
            submissions: {type: Object, attribute: false},
            submissionsColumns: {type: Object, attribute: false},
            iconNameVisible: {type: String, attribute: false},
            iconNameHidden: {type: String, attribute: false},
            isResetButtonDisabled: {type: Object, attribute: false},
            selectedRowCount: {type: Object, attribute: false},
            allRowCount: {type: Object, attribute: false},
            visibleRowCount: {type: Object, attribute: false},
            searchIsActive: {type: Object, attribute: false},
            submissionsHasAttachment: {type: Object, attribute: false},
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            if (propName === 'lang') {
                this._i18n.changeLanguage(this.lang);
            }

            if ((propName === 'lang' || propName === 'langDir') && this.langDir) {
                setOverridesByGlobalCache(this._i18n, this);
            }
        });

        super.update(changedProperties);
    }

    connectedCallback() {
        super.connectedCallback();

        if (this.langDir) {
            setOverridesByGlobalCache(this._i18n, this);
        }
    }

    static get styles() {
        return MANAGE_FORMS_COMPONENT_STYLES;
    }

    getSubmissionTable(state) {
        return this.renderRoot?.querySelector(`#tabulator-table-submissions-${state}`) ?? null;
    }

    getSearchbar(state) {
        return this.renderRoot?.querySelector(`#searchbar--${state}`) ?? null;
    }

    getSearchSelect(state) {
        return this.renderRoot?.querySelector(`#search-select--${state}`) ?? null;
    }

    getSearchOperator(state) {
        return this.renderRoot?.querySelector(`#search-operator--${state}`) ?? null;
    }

    getActionsContainers() {
        return this.renderRoot?.querySelectorAll('.actions-container') ?? [];
    }

    getColumnOptionsModal(state) {
        return (
            this.renderRoot?.querySelector(
                `dbp-formalize-column-settings-modal[data-state="${state}"]`,
            ) ?? null
        );
    }

    openColumnOptionsModal(state) {
        this.getColumnOptionsModal(state)?.open();
    }

    closeColumnOptionsModal(state) {
        this.getColumnOptionsModal(state)?.close();
    }

    closeAllSearchWidgets() {
        this.searchWidgetIsOpen = {
            draft: false,
            submitted: false,
        };
    }

    handleBackToOverview() {
        this.closeAllSearchWidgets();
        this.dispatchEvent(
            new CustomEvent('back-to-overview', {
                bubbles: true,
                composed: true,
            }),
        );
    }

    handleSearch(state) {
        this.dispatchEvent(
            new CustomEvent('submission-search', {
                detail: {state},
                bubbles: true,
                composed: true,
            }),
        );
    }

    handleResetSearch() {
        this.dispatchEvent(
            new CustomEvent('submission-search-reset', {
                bubbles: true,
                composed: true,
            }),
        );
    }

    handleAction(action, state, payload = null) {
        this.dispatchEvent(
            new CustomEvent('submission-action', {
                detail: {action, state, payload},
                bubbles: true,
                composed: true,
            }),
        );
    }

    toggleSearchFilters(state) {
        const open = !this.searchWidgetIsOpen[state];
        this.searchWidgetIsOpen = {
            ...this.searchWidgetIsOpen,
            [state]: open,
        };
        this.dispatchEvent(
            new CustomEvent('submission-search-toggle', {
                detail: {state, open},
                bubbles: true,
                composed: true,
            }),
        );
    }

    getTableHeaderOptions(state) {
        const i18n = this._i18n;

        if (this.submissions[state].length === 0) {
            return [];
        }

        let options = [];
        options.push(html`
            <option value="all">${i18n.t('manage-forms.all-columns')}</option>
        `);

        let cols = Object.keys(this.submissions[state][0]);
        for (let col of cols) {
            if (col && col !== 'htmlButtons') {
                options.push(html`
                    <option value="${col}">${col}</option>
                `);
            }
        }
        return options;
    }

    getTableFilterOptions() {
        const i18n = this._i18n;
        return html`
            <option value="like">${i18n.t('manage-forms.search-operator-like')}</option>
            <option value="=">${i18n.t('manage-forms.search-operator-equal')}</option>
            <option value="!=">${i18n.t('manage-forms.search-operator-notequal')}</option>
            <option value="starts">${i18n.t('manage-forms.search-operator-starts')}</option>
            <option value="ends">${i18n.t('manage-forms.search-operator-ends')}</option>
            <option value="<">${i18n.t('manage-forms.search-operator-less')}</option>
            <option value="<=">${i18n.t('manage-forms.search-operator-lessthanorequal')}</option>
            <option value=">">${i18n.t('manage-forms.search-operator-greater')}</option>
            <option value=">=">${i18n.t('manage-forms.search-operator-greaterorequal')}</option>
            <option value="regex">${i18n.t('manage-forms.search-operator-regex')}</option>
            <option value="keywords">${i18n.t('manage-forms.search-operator-keywords')}</option>
        `;
    }

    getExportOptions(state) {
        const i18n = this._i18n;
        const exportCount =
            this.selectedRowCount[state] === 0
                ? this.allRowCount[state]
                : this.selectedRowCount[state];

        const exportActions = [];

        exportActions.push({
            value: 'csv',
            label: i18n.t('manage-forms.export-csv-label', {n: exportCount}),
            iconName: 'download',
        });

        exportActions.push({
            value: 'xlsx',
            label: i18n.t('manage-forms.export-xlsx-label', {n: exportCount}),
            iconName: 'download',
        });

        exportActions.push({
            value: 'pdf',
            label: i18n.t('manage-forms.export-pdf-label', {n: exportCount}),
            iconName: 'download',
        });

        if (this.submissionsHasAttachment[state]) {
            exportActions.push({
                value: 'attachments',
                label: i18n.t('manage-forms.export-attachments-label', {n: exportCount}),
                iconName: 'folder',
            });
        }

        return exportActions;
    }

    renderColumnSettingsModal(state) {
        const columns = this.submissionsColumns[state].filter((column) => {
            return column && column.frozen !== true;
        });

        if (columns.length === 0) {
            return;
        }

        return html`
            <dbp-formalize-column-settings-modal
                data-state="${state}"
                lang="${this.lang}"
                state="${state}"
                .columns="${columns}"
                .iconNameVisible="${this.iconNameVisible}"
                .iconNameHidden="${this.iconNameHidden}"
                .resetButtonDisabled="${this.isResetButtonDisabled[state]}"
                @column-settings-action="${(event) => {
                    this.handleAction(
                        event.detail.action,
                        event.detail.state,
                        event.detail.payload,
                    );
                }}"></dbp-formalize-column-settings-modal>
        `;
    }

    renderExportWidget(state) {
        const i18n = this._i18n;

        return html`
            <div class="export-container">
                <dbp-select
                    id="export-dropdown--${state}"
                    @change="${(event) => {
                        this.handleAction('export', state, {event: event});
                    }}"
                    label="${i18n.t('manage-forms.default-export-select')}"
                    align="right"
                    allow-expand
                    .options="${this.getExportOptions(state)}"></dbp-select>
            </div>
        `;
    }

    /**
     * Handle change events from the actions widget dropdown and buttons
     * @param {CustomEvent} event
     */
    handleActionsDropdownChange(event, state) {
        // Handle form-specific actions
        if (event.detail && event.detail.option && event.detail.value) {
            const option = event.detail.option;
            // const value = event.detail.value;

            if (option.value === 'edit-submission') {
                this.handleAction('edit-submission', state, {event});
                return;
            }

            if (option.value === 'batch-tagging') {
                this.handleAction('batch-tagging', state);
                return;
            }

            if (option.value === 'edit-permission') {
                this.handleAction('edit-permission', state);
                return;
            }

            if (option.value === 'delete-all') {
                this.handleAction('delete-all', state);
                return;
            }

            if (option.value === 'delete-selected') {
                this.handleAction('delete-selected', state);
                return;
            }
        }
    }

    renderActionsWidget(state) {
        const i18n = this._i18n;

        const submissionActions = [];

        submissionActions.push({
            value: 'edit-submission',
            disabled: !this.isEditSubmissionEnabled[state],
            label: i18n.t('manage-forms.edit-submission-button-text'),
            iconName: 'pencil',
        });

        submissionActions.push({
            value: 'batch-tagging',
            disabled: !this.isBatchTaggingEnabled[state],
            label: i18n.t('manage-forms.batch-tagging-button-text'),
            iconName: 'tags',
        });

        submissionActions.push({
            value: 'edit-permission',
            disabled: !this.isEditSubmissionPermissionEnabled[state],
            label: i18n.t('manage-forms.edit-permission-button-text'),
            iconName: 'edit-permission',
        });

        if (this.isDeleteAllSubmissionEnabled[state]) {
            submissionActions.push({
                value: 'delete-all',
                label: i18n.t('manage-forms.delete-all-submissions-button-text', {
                    n: this.allRowCount[state],
                }),
                iconName: 'trash',
            });
        }

        if (this.isDeleteSelectedSubmissionEnabled[state]) {
            submissionActions.push({
                value: 'delete-selected',
                label: i18n.t('manage-forms.delete-selected-submissions-button-text', {
                    n: this.selectedRowCount[state],
                }),
                iconName: 'delete-selection',
            });
        }

        return html`
            <div class="actions-container" id="actions-container--${state}">
                <dbp-select
                    id="action-dropdown--${state}"
                    ?disabled=${!this.isActionAvailable[state]}
                    @change="${(event) => this.handleActionsDropdownChange(event, state)}"
                    label="${i18n.t('manage-forms.actions-button-text')}"
                    align="left"
                    allow-expand
                    .options="${submissionActions}"></dbp-select>
            </div>
        `;
    }

    renderSearchWidget(state) {
        const i18n = this._i18n;

        return html`
            <div class="search-input">
                <label for="searchbar--${state}">
                    ${i18n.t('manage-forms.search-input-label')}:
                </label>

                <input
                    type="text"
                    id="searchbar--${state}"
                    data-state="${state}"
                    class="searchbar"
                    placeholder="${i18n.t('manage-forms.searchbar-placeholder')}" />

                <button
                    class="button search-button"
                    id="search-button--${state}"
                    @click="${() => {
                        this.handleSearch(state);
                    }}">
                    <dbp-icon
                        title="${i18n.t('manage-forms.search-button')}"
                        aria-label="${i18n.t('manage-forms.search-button')}"
                        name="search"></dbp-icon>
                </button>

                <button
                    class="button search-toggle-filters-button"
                    id="search-toggle-filters-button--${state}"
                    aria-expanded="${this.searchWidgetIsOpen[state]}"
                    aria-controls="search-filter-columns--${state} search-filter-operator--${state}"
                    title="${i18n.t('manage-forms.open-search-filters')}"
                    @click="${() => {
                        this.toggleSearchFilters(state);
                    }}">
                    <dbp-icon name="chevron-down" aria-hidden="true"></dbp-icon>
                    <span class="button-text">
                        ${this.searchWidgetIsOpen[state]
                            ? i18n.t('manage-forms.close-search-filters')
                            : i18n.t('manage-forms.open-search-filters')}
                    </span>
                </button>
            </div>

            <div
                id="search-filter-columns--${state}"
                role="region"
                aria-label="${i18n.t('manage-forms.search-filters-region')}"
                class="search-filter-columns ${classMap({
                    open: this.searchWidgetIsOpen[state],
                })}">
                <label for="search-select-${state}">${i18n.t('manage-forms.search-in')}:</label>
                <select
                    id="search-select--${state}"
                    class="button dropdown-menu search-select"
                    title="${i18n.t('manage-forms.search-in-column')}"
                    @change="${() => {
                        this.handleSearch(state);
                    }}">
                    <optgroup label="${i18n.t('manage-forms.search-in-column')}">
                        <legend>${i18n.t('manage-forms.search-in-column')}:</legend>
                        ${this.getTableHeaderOptions(state)}
                    </optgroup>
                </select>
                <dbp-icon
                    name="chevron-down"
                    title="${i18n.t('manage-forms.filter-toggle-button')}"
                    aria-label="${i18n.t('manage-forms.filter-toggle-button')}"></dbp-icon>
            </div>

            <div
                id="search-filter-operator--${state}"
                role="region"
                aria-label="${i18n.t('manage-forms.search-operator')}"
                class="search-filter-operator ${classMap({
                    open: this.searchWidgetIsOpen[state],
                })}">
                <label for="search-operator--${state}">
                    ${i18n.t('manage-forms.search-operator')}:
                </label>
                <select
                    id="search-operator--${state}"
                    title="${i18n.t('manage-forms.search-operator')}"
                    class="button dropdown-menu search-operator"
                    @change="${() => {
                        this.handleSearch(state);
                    }}">
                    <optgroup label="${i18n.t('manage-forms.search-operator')}">
                        <legend>${i18n.t('manage-forms.search-operator')}:</legend>
                        ${this.getTableFilterOptions()}
                    </optgroup>
                </select>
                <dbp-icon
                    name="chevron-down"
                    title="${i18n.t('manage-forms.filter-toggle-button')}"
                    aria-label="${i18n.t('manage-forms.filter-toggle-button')}"></dbp-icon>
            </div>
            <button
                class="button search-toggle-filters-button"
                id="search-toggle-filters-button--${state}"
                aria-expanded="${this.searchWidgetIsOpen[state]}"
                aria-controls="search-filter-columns--${state} search-filter-operator--${state}"
                title="${i18n.t('manage-forms.open-search-filters')}"
                @click="${() => {
                    this.toggleSearchFilters(state);
                }}">
                <dbp-icon name="chevron-down" aria-hidden="true"></dbp-icon>
                <span class="button-text">
                    ${this.searchWidgetIsOpen[state]
                        ? i18n.t('manage-forms.close-search-filters')
                        : i18n.t('manage-forms.open-search-filters')}
                </span>
            </button>
        `;
    }

    renderStatusBar(state) {
        const i18n = this._i18n;
        const visibleCount = this.visibleRowCount?.[state] ?? 0;
        const selectedCount = this.selectedRowCount?.[state] ?? 0;

        return html`
            <div class="statusbar" role="status" aria-live="polite" aria-atomic="true">
                <span class="selection-info">
                    ${i18n.t('manage-forms.n-items-shown-label', {
                        n: visibleCount,
                    })}
                    ${selectedCount > 0
                        ? html`
                              ,
                              ${i18n.t('manage-forms.n-items-selected-label', {
                                  n: selectedCount,
                              })}
                          `
                        : ''}
                </span>
                <button
                    class="reset-search"
                    ?disabled="${this.searchIsActive[state] === false}"
                    @click="${() => {
                        this.handleResetSearch();
                    }}">
                    <dbp-icon
                        name="spinner-arrow"
                        title="${i18n.t('manage-forms.reset-search-label')}"
                        aria-label="${i18n.t('manage-forms.reset-search-label')}"></dbp-icon>
                    ${i18n.t('manage-forms.reset-search-label')}
                </button>
            </div>
        `;
    }

    handleSelectionCountChanged(state, event) {
        const count = event.detail?.count ?? 0;

        this.selectedRowCount = {
            ...this.selectedRowCount,
            [state]: count,
        };
    }

    render() {
        const i18n = this._i18n;
        const submissionTableTitle = {
            draft: i18n.t('manage-forms.submission-table-draft-title'),
            submitted: i18n.t('manage-forms.submission-table-submitted-title'),
        };

        return html`
            <div
                class="table-wrapper submissions${classMap({
                    hideWithoutDisplay: !this.showSubmissionTables,
                })}">
                <div class="submissions-top-bar">
                    <span class="back-navigation">
                        <a
                            @click="${() => this.handleBackToOverview()}"
                            title="${i18n.t('manage-forms.back-text')}">
                            <dbp-icon name="chevron-left"></dbp-icon>
                            ${i18n.t('manage-forms.back-text')}
                        </a>
                    </span>
                    <span
                        class="loading submissions-spinner ${classMap({
                            hidden: !this.loadingSubmissionTables || this.showFormsTable,
                        })}">
                        <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
                    </span>
                </div>
                <div class="table-header submissions">
                    <h3>${this.activeFormName}</h3>
                    ${this.createSubmissionUrl && !this.hideCreateSubmissionButton
                        ? html`
                              <a
                                  class="button is-primary"
                                  href="${this.createSubmissionUrl}"
                                  target="_blank">
                                  <dbp-icon name="plus" aria-hidden="true"></dbp-icon>
                                  ${i18n.t('manage-forms.create-submission-button')}
                              </a>
                          `
                        : ''}
                </div>
            </div>

            <div
                class="container submissions-table ${classMap({
                    hidden: !this.showSubmissionTables,
                })}">
                ${Object.values(SUBMISSION_STATES).map(
                    (state) => html`
                        <div
                            class="${classMap({
                                hidden: this.enabledStates[state] ? false : true,
                            })}">
                            <h3 class="table-title">${submissionTableTitle[state]}</h3>

                            <div
                                class="${classMap({
                                    open: this.searchWidgetIsOpen[state],
                                    'table-action-header': true,
                                    [`table-action-header--${state}`]: true,
                                })}">
                                ${this.noSubmissionAvailable[state] === true
                                    ? ''
                                    : html`
                                          ${this.renderActionsWidget(state)}
                                          ${this.renderSearchWidget(state)}
                                          ${this.renderExportWidget(state)}
                                      `}
                            </div>
                            ${this.noSubmissionAvailable[state] === true
                                ? ''
                                : html`
                                      ${this.renderStatusBar(state)}
                                  `}

                            <dbp-tabulator-table
                                lang="${this.lang}"
                                class="tabulator-table tabulator-table--${state}"
                                id="tabulator-table-submissions-${state}"
                                data-state="${state}"
                                identifier="submissions-table-${state}"
                                .options=${this.optionsSubmissions[state]}
                                pagination-size="5"
                                sticky-header
                                select-rows-enabled
                                @dbp-tabulator-table-selection-count-changed=${(event) =>
                                    this.handleSelectionCountChanged(
                                        state,
                                        event,
                                    )}></dbp-tabulator-table>
                        </div>
                        ${this.renderColumnSettingsModal(state)}
                    `,
                )}
            </div>
        `;
    }
}
