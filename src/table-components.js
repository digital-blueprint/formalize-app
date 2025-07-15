import {html, css} from 'lit';
import {createInstance} from './i18n.js';
import {ScopedElementsMixin, IconButton} from '@dbp-toolkit/common';
import {TabulatorTable} from '@dbp-toolkit/tabulator-table';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';

export class CustomTabulatorTable extends TabulatorTable {
    static get scopedElements() {
        return {
            'dbp-formalize-column-settings-button': ColumnSettingsButton,
            'dbp-formalize-get-details-button': GetDetailsButton,
        };
    }

    static get styles() {
        return [
            TabulatorTable.styles,
            css`
                :host {
                    display: block;
                }
            `,
        ];
    }
}

export class ColumnSettingsButton extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
        };
    }

    static get scopedElements() {
        return {
            'dbp-icon-button': IconButton,
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    break;
            }
        });

        super.update(changedProperties);
    }

    static get styles() {
        return css`
            :host {
                display: flex;
                /* Needed for the table header otherwise the icon gets cut off */
                min-height: 30px;
            }
            dbp-icon-button {
                font-size: 20px;
                position: absolute;
                top: -5px;
            }
        `;
    }

    render() {
        let i18n = this._i18n;
        return html`
            <dbp-icon-button
                no-spinner-on-click
                type="is-secondary"
                icon-name="cog"
                title="${i18n.t('show-submissions.filter-options-button-text')}"
                aria-label="${i18n.t(
                    'show-submissions.filter-options-button-text',
                )}"></dbp-icon-button>
        `;
    }
}

export class GetDetailsButton extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.title = '';
        this.ariaLabel = '';
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            title: {type: String},
            ariaLabel: {type: String, attribute: 'aria-label'},
        };
    }

    static get scopedElements() {
        return {
            'dbp-icon-button': IconButton,
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    break;
            }
        });

        super.update(changedProperties);
    }

    static get styles() {
        return css`
            :host {
            }
            dbp-icon-button {
                font-size: 20px;
            }
        `;
    }

    render() {
        let i18n = this._i18n;
        return html`
            <dbp-icon-button
                icon-name="keyword-research"
                title="${i18n.t(this.title)}"
                aria-label="${i18n.t(this.ariaLabel)}"></dbp-icon-button>
        `;
    }
}
