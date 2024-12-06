import {BaseFormElement, BaseObject} from '../baseObject.js';
import {html} from 'lit';
import * as formElements from './formElements.js';
import {classMap} from 'lit/directives/class-map.js';

export default class extends BaseObject {
    getName() {
        return 'accessible-exams-form';
    }

    /**
     * @returns {string}
     */
    getFormComponent() {
        return FormalizeFormElement;
    }
}

class FormalizeFormElement extends BaseFormElement {
    render() {
        const i18n = this._i18n;
        console.log('-- Render FormalizeFormElement --');
        console.log('this.data', this.data);
        const data = this.data || {};

        return html`
            <form>
                ${formElements.stringElement('subject', i18n.t('accessible-exams-form.subject'), data.subject || '', true)}    
                ${formElements.dateTimeElement('startDateTime', i18n.t('accessible-exams-form.startDateTime'), data.startDateTime || '', true)}
                ${formElements.dateTimeElement('endDateTime', i18n.t('accessible-exams-form.endDateTime'), data.endDateTime || '', true)}
                ${formElements.stringElement('matriculationNumber', i18n.t('accessible-exams-form.matriculationNumber'), data.matriculationNumber || '')}
                ${formElements.stringElement('email', i18n.t('accessible-exams-form.email'), data.email || '')}
                ${formElements.stringElement('room', i18n.t('accessible-exams-form.room'), data.room || '')}
                ${formElements.stringElement('comment', i18n.t('accessible-exams-form.comment'), data.comment || '')}
                ${formElements.checkboxElement('group', i18n.t('accessible-exams-form.group'), data.group || 'on')}
                ${formElements.checkboxElement('online', i18n.t('accessible-exams-form.online'), data.online || 'on')}
                ${this.getButtonRowHtml()}
            </form>
        `;
    }

    // TODO: Clean up duplicate code

    getButtonRowHtml() {
        return html`
            <div class="button-row">
                <button class="button is-secondary" type="button" @click=${this.resetForm}>Reset</button>
                <button class="button is-primary" type="submit" ?disabled=${!this.saveButtonEnabled} @click=${this.validateAndSendSubmission}>
                    Save
                    <dbp-mini-spinner class="${classMap({hidden: this.saveButtonEnabled})}"></dbp-mini-spinner>
                </button>
            </div>
        `;
    }

    validateAndSendSubmission(event) {
        event.preventDefault();

        // Validate required fields before proceeding
        if (!this.validateForm()) {
            return false;
        }

        // Validate datetime fields before proceeding
        if (!this.validateDateTimeFields()) {
            return false;
        }

        // TODO: Add further validations

        this.sendSubmission(event);
    }

    validateDateTimeFields() {
        // Select all input elements with the type "datetime-local"
        const formElement = this.shadowRoot.querySelector('form');
        const dateTimeFields = formElement.querySelectorAll('input[type="datetime-local"]');

        // The minimum date has to be two weeks ahead
        const min = Date.now() + 1209600000

        // Loop through each datetime field
        for (let field of dateTimeFields) {

            // Check if the entered value is lower than the minimum value
            if (Date.parse(field.value) < min) {

                // If true, alert the user and return false to prevent form submission
                // TODO: We will need to put those results into a div or something instead of using an alert for each single of them!
                alert(`Please choose a date that is at least two weeks ahead in the field ${field.name}.`);
                return false;
            }
        }

        // If all datetime criteria are matched, return true to allow form submission
        return true;
    }
}
