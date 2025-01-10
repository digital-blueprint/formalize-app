import {html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {DbpBaseElement} from './base.js';

export class DbpDateTimeElement extends ScopedElementsMixin(DbpBaseElement) {
    constructor() {
        super();
        this.label = 'A datetime field';
        this.dataValue = '';
    }

    static get properties() {
        return {
            ...super.properties,
            dataValue: {type: String, attribute: 'data-value', reflect: true},
        };
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

    isoToDatetimeLocal(isoString) {
        const date = new Date(isoString);

        // Check if the date is valid
        if (isNaN(date.getTime())) {
            return '';
        }

        // Adjust for local timezone
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));

        // Format to YYYY-MM-DDTHH:mm
        return localDate.toISOString().slice(0, 16);
    }

    renderInput() {
        const formattedValue = this.isoToDatetimeLocal(this.value);

        return html`
            <input
                type="datetime-local"
                id="${this.id}"
                name="${this.name}"
                .value="${formattedValue}"
                @input="${this.handleInputValue}"
                ?required=${this.required} />
        `;
    }

    fixDateTimeValue(val) {
        if (!val) return '';

        const date = new Date(val);
        if (isNaN(date.getTime())) return ''; // Invalid date

        // Return ISO 8601 string including a timezone, because we want also store the timezone in Blob metadata
        return date.toISOString();
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'value':
                    this.dataValue = this.fixDateTimeValue(this.value);
                    break;
            }
        });

        super.update(changedProperties);
    }
}

commonUtils.defineCustomElement('dbp-datetime-element', DbpDateTimeElement);
