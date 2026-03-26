// @ts-nocheck
import {html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {ScopedElementsMixin, MiniSpinner} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {createInstance} from './i18n.js';
import {CustomTabulatorTable} from './table-components.js';
import {MANAGE_FORMS_COMPONENT_STYLES} from './manage-forms-component-styles.js';

export class ManageFormsOverviewPage extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.loadingFormsTable = false;
        this.showFormsTable = false;
        this.showSubmissionTables = false;
        this.optionsForms = {};
        this.noFormsAvailable = false;
    }

    static get scopedElements() {
        return {
            'dbp-mini-spinner': MiniSpinner,
            'dbp-tabulator-table': CustomTabulatorTable,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            loadingFormsTable: {type: Boolean, attribute: false},
            showFormsTable: {type: Boolean, attribute: false},
            showSubmissionTables: {type: Boolean, attribute: false},
            optionsForms: {type: Object, attribute: false},
            noFormsAvailable: {type: Boolean, attribute: false},
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

    getFormsTable() {
        return this.renderRoot?.querySelector('#tabulator-table-forms') ?? null;
    }

    render() {
        const i18n = this._i18n;

        return html`
            <div
                class="control forms-spinner ${classMap({
                    hidden: !this.loadingFormsTable || this.showSubmissionTables,
                })}">
                <span class="loading">
                    <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
                </span>
            </div>

            <div class="container forms-table ${classMap({hidden: !this.showFormsTable})}">
                <dbp-tabulator-table
                    lang="${this.lang}"
                    class="tabulator-table"
                    id="tabulator-table-forms"
                    identifier="forms-table"
                    pagination-enabled
                    pagination-size="5"
                    .options=${this.optionsForms}></dbp-tabulator-table>
                ${this.noFormsAvailable
                    ? html`
                          <p class="no-forms-message">
                              ${i18n.t('manage-forms.no-forms-available')}
                          </p>
                      `
                    : ''}
            </div>
        `;
    }
}
