import {html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {DbpBaseElement} from './base.js';

export class DbpDateElement extends ScopedElementsMixin(DbpBaseElement) {
    constructor() {
        super();
        this.label = 'A date field';
    }

    formatDateValue(val) {
        if (!val) return "";

        // Check if the value is a number (timestamp)
        const timestamp = Number(val);
        if (!isNaN(timestamp)) {
            // Convert timestamp to Date object
            const date = new Date(timestamp);

            // Check if it's a valid date
            if (!isNaN(date.getTime())) {
                // Format date as YYYY-MM-DD (required format for input type="date")
                return date.toISOString().split('T')[0];
            }
        }

        // If it's not a timestamp or invalid, return the original value
        return val;
    }

    renderInput() {
        const formattedValue = this.formatDateValue(this.value);

        return html`
            <input
                type="date"
                id="${this.id}"
                name="${this.name}"
                .value="${formattedValue}"
                @input="${this.handleInputValue}"
                ?required=${this.required} />
        `;
    }
}

commonUtils.defineCustomElement('dbp-date-element', DbpDateElement);
