import {html, css} from 'lit';
import {createInstance} from './i18n.js';
import {ScopedElementsMixin, Icon, IconButton} from '@dbp-toolkit/common';
import {TabulatorTable} from '@dbp-toolkit/tabulator-table';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';

export class CustomTabulatorTable extends TabulatorTable {
    static get scopedElements() {
        return {
            'dbp-formalize-column-settings-button': ColumnSettingsButton,
            'dbp-formalize-get-details-button': GetDetailsButton,
            'dbp-formalize-get-submission-link': GetSubmissionLink,
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
                justify-content: flex-end;
                /* Needed for the table header otherwise the icon gets cut off */
                min-height: 30px;
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
        this.iconName = 'keyword-research';
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            title: {type: String},
            iconName: {type: String, attribute: 'icon-name'},
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
            dbp-icon-button {
                font-size: 20px;
            }
        `;
    }

    render() {
        let i18n = this._i18n;
        return html`
            <dbp-icon-button
                icon-name="${this.iconName}"
                title="${i18n.t(this.title)}"
                aria-label="${i18n.t(this.ariaLabel)}"></dbp-icon-button>
        `;
    }
}

export class GetSubmissionLink extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.title = '';
        this.ariaLabel = '';
        this.iconName = 'keyword-research';
        this.submissionUrl = '';
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            title: {type: String},
            iconName: {type: String, attribute: 'icon-name'},
            submissionUrl: {type: String, attribute: 'submission-url'},
            ariaLabel: {type: String, attribute: 'aria-label'},
        };
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
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
                display: inline-block;
            }
            a {
                display: flex;
                text-decoration: none;
                height: 40px;
                width: 40px;
                line-height: 40px;
                color: var(--dbp-content);
                justify-content: center;
                color: currentColor;
            }
            dbp-icon {
                font-size: 24px;
                flex-shrink: 0;
                flex-grow: 0;
            }
        `;
    }

    render() {
        let i18n = this._i18n;
        return html`
            <a href="${this.submissionUrl}" target="_blank" rel="noopener noreferrer">
                <dbp-icon
                    name="${this.iconName}"
                    title="${i18n.t(this.title)}"
                    aria-label="${i18n.t(this.ariaLabel)}"></dbp-icon>
            </a>
        `;
    }
}
