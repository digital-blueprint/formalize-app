import {css, html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {DbpBaseElement} from './base.js';

export class DbpEnumElement extends ScopedElementsMixin(DbpBaseElement) {
    constructor() {
        super();
        this.label = 'A enum field';
        this.items = {};
    }

    static get properties() {
        return {
            ...super.properties,
            items: {type: Object},
        };
    }

    setItems(items) {
        this.items = items;
    }

    renderInput() {
        return html`
            <select
                id="${this.id}"
                name="${this.name}"
                @change="${this.handleInputValue}"
                ?required=${this.required}>
                ${Object.keys(this.items).map((key) => html`
                    <option value="${key}" ?selected=${key === this.value}>${this.items[key]}</option>
                `)}
            </select>
        `;
    }

    static get styles() {
        return [
            ...super.styles,
            // language=css
            css`
                /* For some reasons the selector chevron was very large */
                select:not(.select) {
                    background-size: 1em;
                }
            `
        ];
    }
}

commonUtils.defineCustomElement('dbp-enum-element', DbpEnumElement);
