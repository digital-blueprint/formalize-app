// @ts-nocheck
import {html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {ScopedElementsMixin, Button, Icon, IconButton, MiniSpinner} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {createInstance} from './i18n.js';
import {CustomTabulatorTable} from './table-components.js';
import {SUBMISSION_STATES} from './utils.js';
import {MANAGE_FORMS_COMPONENT_STYLES} from './manage-forms-component-styles.js';

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
        this.enabledStates = {draft: false, submitted: false};
        this.noSubmissionAvailable = {draft: true, submitted: true};
        this.searchWidgetIsOpen = {draft: false, submitted: false};
        this.optionsSubmissions = {draft: {}, submitted: {}};
        this.onBack = null;
        this.renderActionsWidget = null;
        this.renderSearchWidget = null;
        this.renderExportWidget = null;
        this.renderStatusBar = null;
        this.renderColumnSettingsModal = null;
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-icon-button': IconButton,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-tabulator-table': CustomTabulatorTable,
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
            enabledStates: {type: Object, attribute: false},
            noSubmissionAvailable: {type: Object, attribute: false},
            searchWidgetIsOpen: {type: Object, attribute: false},
            optionsSubmissions: {type: Object, attribute: false},
            onBack: {attribute: false},
            renderActionsWidget: {attribute: false},
            renderSearchWidget: {attribute: false},
            renderExportWidget: {attribute: false},
            renderStatusBar: {attribute: false},
            renderColumnSettingsModal: {attribute: false},
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

    render() {
        const i18n = this._i18n;
        const submissionTableTitle = {
            draft: i18n.t('manage-forms.submission-table-draft-title'),
            submitted: i18n.t('manage-forms.submission-table-submitted-title'),
        };

        return html`
            <div
                class="control submissions-spinner ${classMap({
                    hidden: !this.loadingSubmissionTables || this.showFormsTable,
                })}">
                <span class="loading">
                    <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
                </span>
            </div>

            <div
                class="table-wrapper submissions${classMap({
                    hideWithoutDisplay: !this.showSubmissionTables,
                })}">
                <span class="back-navigation">
                    <a
                        @click="${() => this.onBack?.()}"
                        title="${i18n.t('manage-forms.back-text')}">
                        <dbp-icon name="chevron-left"></dbp-icon>
                        ${i18n.t('manage-forms.back-text')}
                    </a>
                </span>
                <div class="table-header submissions">
                    <h3>${this.activeFormName}</h3>
                    ${this.createSubmissionUrl
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
                                          ${this.renderActionsWidget?.(state)}
                                          ${this.renderSearchWidget?.(state)}
                                          ${this.renderExportWidget?.(state)}
                                      `}
                            </div>
                            ${this.noSubmissionAvailable[state] === true
                                ? ''
                                : html`
                                      ${this.renderStatusBar?.(state)}
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
                        ${this.renderColumnSettingsModal?.(state)}
                    `,
                )}
            </div>
        `;
    }
}
