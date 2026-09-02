// @ts-nocheck
import {css, html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {ScopedElementsMixin, MiniSpinner, Icon, DBPSelect} from '@dbp-toolkit/common';
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
        this.noFormsAvailable = false;
        // Number of modules that implement createForm(); the button is only shown when > 0
        this.creatableModulesCount = 0;
        // Whether bulk removal of forms is enabled (opt-in via the host attribute).
        this.enableFormsBulkDelete = false;
        // Number of currently selected forms in the overview table.
        this.selectedFormsCount = 0;
        // Whether the selected forms may be deleted (all of them grant delete/manage).
        this.isDeleteSelectedFormsEnabled = false;
        this.isEditSelectedFormPermissionEnabled = false;
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
            noFormsAvailable: {type: Boolean, attribute: false},
            creatableModulesCount: {type: Number, attribute: false},
            enableFormsBulkDelete: {type: Boolean, attribute: false},
            selectedFormsCount: {type: Number, attribute: false},
            isDeleteSelectedFormsEnabled: {type: Boolean, attribute: false},
            isEditSelectedFormPermissionEnabled: {type: Boolean, attribute: false},
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
        const formActions = [
            ...(this.enableFormsBulkDelete
                ? [
                      {
                          value: 'delete',
                          disabled: !this.isDeleteSelectedFormsEnabled,
                          label: i18n.t('manage-forms.delete'),
                          iconName: 'trash',
                      },
                  ]
                : []),
            {
                value: 'edit-permission',
                disabled: !this.isEditSelectedFormPermissionEnabled,
                label: i18n.t('manage-forms.edit-permission-button-text'),
                iconName: 'edit-permission',
            },
        ];

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
                <div>
                    <dbp-select
                        ?disabled=${
                            this.selectedFormsCount === 0 ||
                            (!this.isDeleteSelectedFormsEnabled &&
                                !this.isEditSelectedFormPermissionEnabled)
                        }
                        @change=${this._onFormAction}
                        label="${i18n.t('manage-forms.actions-button-text')}"
                        align="left"
                        allow-expand
                        .options=${formActions}></dbp-select>
                </div>
                <dbp-tabulator-table
                    lang="${this.lang}"
                    class="tabulator-table"
                    id="tabulator-table-forms"
                    identifier="forms-table"
                    pagination-enabled
                    pagination-size="5"
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
