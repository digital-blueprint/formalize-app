// @ts-nocheck
import {html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {
    ScopedElementsMixin,
    Button,
    Icon,
    IconButton,
    MiniSpinner,
    DBPSelect,
} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {createInstance} from './i18n.js';
import {CustomTabulatorTable} from './table-components.js';
import {SUBMISSION_STATES} from './utils.js';
import {MANAGE_FORMS_COMPONENT_STYLES} from './manage-forms-component-styles.js';
import MicroModal from './micromodal.es.js';

export class ManageFormSubmissionsPage extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
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
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-icon-button': IconButton,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-tabulator-table': CustomTabulatorTable,
            'dbp-select': DBPSelect,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
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
        });

        super.update(changedProperties);
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
        return this.renderRoot?.querySelector(`#column-options-modal-${state}`) ?? null;
    }

    getColumnOptionsContent(state) {
        return this.renderRoot?.querySelector(`#submission-modal-content-${state}`) ?? null;
    }

    openColumnOptionsModal(state) {
        let modal = this.getColumnOptionsModal(state);
        if (modal) {
            MicroModal.show(modal, {
                disableScroll: true,
                disableFocus: false,
            });
        }

        let scrollWrapper = this.getColumnOptionsContent(state);
        if (scrollWrapper) {
            scrollWrapper.scrollTo(0, 0);
        }
    }

    closeColumnOptionsModal(state) {
        let modal = this.getColumnOptionsModal(state);
        if (modal) {
            MicroModal.close(modal);
        }
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

    renderColumnSettingsModal(state) {
        const i18n = this._i18n;
        const columns = this.submissionsColumns[state].filter((column) => {
            return column && column.frozen !== true;
        });

        if (columns.length === 0) {
            return;
        }

        return html`
            <div
                class="modal micromodal-slide column-settings-modal"
                id="column-options-modal-${state}"
                aria-hidden="true">
                <div class="modal-overlay" tabindex="-2" data-micromodal-close>
                    <div
                        class="modal-container"
                        id="filter-modal-box"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="submission-modal-title">
                        <header class="modal-header">
                            <dbp-icon-button
                                title="${i18n.t('manage-forms.modal-close')}"
                                aria-label="${i18n.t('manage-forms.modal-close')}"
                                class="modal-close"
                                icon-name="close"
                                @click="${() => {
                                    this.closeColumnOptionsModal(state);
                                }}"></dbp-icon-button>
                            <div class="modal-title">
                                <dbp-icon
                                    class="modal-title-icon"
                                    aria-label="hidden"
                                    title="${i18n.t('manage-forms.table-configuration')}"
                                    name="cog"></dbp-icon>
                                <h2 id="submission-modal-title">
                                    ${i18n.t('manage-forms.header-settings')}
                                </h2>
                            </div>
                        </header>
                        <div class="modal-header-tag">
                            <p><span class="tag tag--state">${state}</span></p>
                        </div>
                        <main
                            class="modal-content submission-modal-content"
                            id="submission-modal-content-${state}">
                            <ul class="headers">
                                ${columns.map(
                                    (column, index) => html`
                                        <li class="header-field" data-index="${index}">
                                            <div class="header-order">${index + 1}</div>
                                            <div class="header-title">${column.title}</div>
                                            <dbp-icon-button
                                                data-visibility="${column.visible}"
                                                icon-name=${column.visible
                                                    ? this.iconNameVisible
                                                    : this.iconNameHidden}
                                                @click="${() => {
                                                    this.handleAction(
                                                        'toggle-column-visibility',
                                                        state,
                                                        {column},
                                                    );
                                                }}"
                                                class="header-visibility-icon"></dbp-icon-button>
                                            <div class="button-wrapper">
                                                <div class="header-move">
                                                    <dbp-icon-button
                                                        class="arrow-up ${classMap({
                                                            'first-arrow-up': index === 0,
                                                        })}"
                                                        icon-name="arrow-up"
                                                        title="${i18n.t(
                                                            'manage-forms.move-column-up',
                                                        )}"
                                                        @click="${() => {
                                                            this.handleAction(
                                                                'move-column-up',
                                                                state,
                                                                {
                                                                    column,
                                                                },
                                                            );
                                                        }}"></dbp-icon-button>
                                                    <dbp-icon-button
                                                        class="header-button arrow-down ${classMap({
                                                            'last-arrow-down':
                                                                index === columns.length - 1,
                                                        })}"
                                                        icon-name="arrow-down"
                                                        title="${i18n.t(
                                                            'manage-forms.move-column-down',
                                                        )}"
                                                        @click="${() => {
                                                            this.handleAction(
                                                                'move-column-down',
                                                                state,
                                                                {column},
                                                            );
                                                        }}"></dbp-icon-button>
                                                </div>
                                            </div>
                                        </li>
                                    `,
                                )}
                            </ul>
                        </main>
                        <footer class="modal-footer">
                            <div class="modal-footer-btn">
                                <div class="top-button-row">
                                    <button
                                        title="${i18n.t('manage-forms.reset-filter')}"
                                        class="check-btn button button--reset is-secondary item-1"
                                        .disabled="${this.isResetButtonDisabled[state]}"
                                        @click="${() => {
                                            this.handleAction('reset-columns', state);
                                        }}">
                                        <dbp-icon
                                            aria-hidden="true"
                                            name="spinner-arrow-mirrored"></dbp-icon>
                                        ${i18n.t('manage-forms.reset-filter')}
                                    </button>
                                    <button
                                        title="${i18n.t('manage-forms.all-filters-hide')}"
                                        class="check-btn button button--hide-all is-secondary item-2"
                                        @click="${() => {
                                            this.handleAction('hide-all-columns', state);
                                        }}">
                                        <dbp-icon
                                            aria-hidden="true"
                                            name="source_icons_eye-off"></dbp-icon>
                                        ${i18n.t('manage-forms.all-filters-hide')}
                                    </button>
                                    <button
                                        title="${i18n.t('manage-forms.all-filters-show')}"
                                        class="check-btn button button--show-all is-secondary item-3"
                                        @click="${() => {
                                            this.handleAction('show-all-columns', state);
                                        }}">
                                        <dbp-icon
                                            aria-hidden="true"
                                            name="source_icons_eye-empty"></dbp-icon>
                                        ${i18n.t('manage-forms.all-filters-show')}
                                    </button>
                                </div>
                                <div class="bottom-button-row">
                                    <button
                                        title="${i18n.t('manage-forms.abort')}"
                                        class="check-btn button is-secondary"
                                        @click="${() => {
                                            this.closeColumnOptionsModal(state);
                                        }}">
                                        <dbp-icon aria-hidden="true" name="close"></dbp-icon>
                                        ${i18n.t('manage-forms.abort')}
                                    </button>
                                    <button
                                        class="check-btn button button--save is-primary"
                                        id="check"
                                        @click="${() => {
                                            this.handleAction('save-columns', state);
                                            this.closeColumnOptionsModal(state);
                                        }}">
                                        <dbp-icon aria-hidden="true" name="save"></dbp-icon>
                                        ${i18n.t('manage-forms.save-columns')}
                                    </button>
                                </div>
                            </div>
                        </footer>
                    </div>
                </div>
            </div>
        `;
    }

    renderExportWidget(state) {
        const i18n = this._i18n;
        const exportCount =
            this.selectedRowCount[state] === 0
                ? this.allRowCount[state]
                : this.selectedRowCount[state];

        return html`
            <div class="export-container">
                <select
                    id="export-select"
                    class="dropdown-menu"
                    aria-label="${i18n.t('manage-forms.export-select-aria-label')}"
                    @change="${(e) => {
                        this.handleAction('export', state, {event: e});
                    }}">
                    <option value="-" disabled selected>
                        ${i18n.t('manage-forms.default-export-select')}
                    </option>
                    <option value="csv">
                        ${i18n.t('manage-forms.export-csv-label', {n: exportCount})}
                    </option>
                    <option value="xlsx">
                        ${i18n.t('manage-forms.export-xlsx-label', {n: exportCount})}
                    </option>
                    <option value="pdf">
                        ${i18n.t('manage-forms.export-pdf-label', {n: exportCount})}
                    </option>
                    ${this.submissionsHasAttachment[state]
                        ? html`
                              <option value="attachments">
                                  ${i18n.t('manage-forms.export-attachments-label', {
                                      n: exportCount,
                                  })}
                              </option>
                          `
                        : ''}
                </select>
                <dbp-icon
                    class="export-select-icon"
                    name="chevron-down"
                    aria-hidden="true"></dbp-icon>
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

        return html`
            <div class="statusbar" role="status" aria-live="polite" aria-atomic="true">
                <span class="selection-info">
                    ${i18n.t('manage-forms.n-items-shown-label', {
                        n: this.visibleRowCount[state],
                    })}${this.selectedRowCount[state] > 0
                        ? html`
                              ,
                              ${i18n.t('manage-forms.n-items-selected-label', {
                                  n: this.selectedRowCount[state],
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
                                  class="create-submission-button"
                                  href="${this.createSubmissionUrl}"
                                  target="_blank">
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
                                sticky-header></dbp-tabulator-table>
                        </div>
                        ${this.renderColumnSettingsModal(state)}
                    `,
                )}
            </div>
        `;
    }
}
