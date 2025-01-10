import {html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {DbpBaseElement} from './base.js';

export class DbpCheckboxElement extends ScopedElementsMixin(DbpBaseElement) {
    constructor() {
        super();
        this.label = 'A checkbox field';
        this.checked = false;
    }

    static get properties() {
        return {
            ...super.properties,
            checked: {type: Boolean},
        };
    }

    renderInput() {
        return html`
            <input
                type="checkbox"
                id="${this.id}"
                name="${this.name}"
                ?checked="${this.value}"
                @input="${this.handleInputValue}"
                ?required=${this.isRequired} />
        `;
    }
}

commonUtils.defineCustomElement('dbp-checkbox-element', DbpCheckboxElement);
