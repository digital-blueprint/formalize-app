import {BaseFormElement, BaseObject} from '../baseObject.js';
import {html} from 'lit';
import * as formElements from './formElements.js';
import {classMap} from 'lit/directives/class-map.js';

export default class extends BaseObject {
    getUrlSlug() {
        return 'accessible-exams-form';
    }

    /**
     * @returns {string}
     */
    getFormComponent() {
        return FormalizeFormElement;
    }

    getFormIdentifier() {
        // TODO: Replace with actual identifier
        return 'some-uuid';
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

        let oldValidationErrors = this.shadowRoot.querySelectorAll("div.validation-error");
        for (let error of oldValidationErrors) {
            error.remove();
        }

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

        // Get start and end date of the exam
        const startDateTime = Date.parse(dateTimeFields[0].value);
        const endDateTime = Date.parse(dateTimeFields[1].value);
        
        // The minimum date has to be two weeks ahead
        const min = Date.now() + 1209600000;
        
        if (startDateTime < min) {
            // If the start date is before the minimum date, alert the user and return false to prevent form submission
            this.showCustomValidationMessage(
                "form-input-startdatetime", 
                "Please choose a date that is at least two weeks ahead for the beginning of your exam."
            );
    
            return false;
        }

        if (endDateTime < startDateTime) {
            // If the end date is before the start date, alert the user and return false to prevent form submission
            this.showCustomValidationMessage(
                "form-input-enddatetime", 
                "Please choose an end date that is past the beginning of your exam."
            );

            return false;
        }

        // If all datetime criteria are matched, return true to allow form submission
        return true;
    }

    showCustomValidationMessage(id, message) {
        // Insert a div with a custom error message when validation fails after the HTML element with the given id
        this.shadowRoot.getElementById(id)
        .insertAdjacentHTML("afterend",
            `<div class="validation-error">
                <p>${message}</p>
            </div>`);
    }
}
