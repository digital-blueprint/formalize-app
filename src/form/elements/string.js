import {html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {sanitizeForHtmlId} from '../utils.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {DbpBaseElement} from './base.js';

export class DbpStringElement extends ScopedElementsMixin(DbpBaseElement) {
    constructor() {
        super();
        this.label = 'A string field';
        this.rows = 1;
    }

    static get properties() {
        return {
            ...super.properties,
            rows: {type: Number},
        };
    }

    renderInput() {
        return html`
            ${this.rows > 1
                ? html`<textarea
                id="form-input-${this.id}"
                name="${this.name}"
                rows="${this.rows}"
                @input="${this.handleInputValue}"
                ?required=${this.required}
              >${this.value}</textarea>`
                : html`<input
                type="text"
                id="form-input-${this.id}"
                name="${this.name}"
                .value="${this.value}"
                @input="${this.handleInputValue}"
                ?required=${this.required}
              >`
            }
        `;
    }
}

commonUtils.defineCustomElement('dbp-string-element', DbpStringElement);
