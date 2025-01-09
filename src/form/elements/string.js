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

    render() {
        const id = sanitizeForHtmlId(this.name);

        return html`
            <fieldset>
                <label for="form-input-${id}">${this.label}</label>
                ${this.rows > 1
                    ? html`<textarea
                    id="form-input-${id}"
                    name="${this.name}"
                    rows="${this.rows}"
                    .value="${this.value}"
                    ?required=${this.required}
                  >${this.value}</textarea>`
                    : html`<input
                    type="text"
                    id="form-input-${id}"
                    name="${this.name}"
                    .value="${this.value}"
                    ?required=${this.required}
                  >`
                }
            </fieldset>
        `;
    }
}

commonUtils.defineCustomElement('dbp-string-element', DbpStringElement);
