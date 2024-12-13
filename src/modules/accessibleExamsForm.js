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
    
    async fetchUserData() {
        console.log("Fetching user data ...");
        
        // TODO: Error Handling

        let response = await fetch(this.entryPointUrl + '/base/people/' + this.auth['user-id'], {
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
        });
        if (!response.ok) {
            throw new Error(response);
        }
        
        this.data = await response.json();
        this.data.givenName = `${this.data['givenName']}`;
        this.data.familyName = `${this.data['familyName']}`;
    }

    render() {
        const i18n = this._i18n;
        console.log('-- Render FormalizeFormElement --');

        if (!this.data.givenName && !this.data.familyName) {
            this.fetchUserData();
        }

        console.log('this.data', this.data);
        const data = this.data || {};

        return html`
            <form>
                ${formElements.stringElement('subject', i18n.t('accessible-exams-form.subject'), data.subject || '', true)}    
                ${formElements.dateTimeElement('startDateTime', i18n.t('accessible-exams-form.startDateTime'), data.startDateTime || '', true)}
                ${formElements.dateTimeElement('endDateTime', i18n.t('accessible-exams-form.endDateTime'), data.endDateTime || '', true)}
                ${formElements.stringElement('matriculationNumber', i18n.t('accessible-exams-form.matriculationNumber'), data.matriculationNumber || '')}
                ${formElements.stringElement('givenName', "Given Name", data.givenName || '')}
                ${formElements.stringElement('familyName', "Family Name", data.familyName || '')}
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

        // Remove alerts for old validation errors
        let oldValidationErrors = this.shadowRoot.querySelectorAll("div.validation-error");
        for (let error of oldValidationErrors) {
            error.remove();
        }

        // Run all validations and save the results in an array
        let validationResults = [
            this.validateForm(),
            this.validateDateTimeFields()
        ];

        // Only submit the form if all validations return true
        if (!validationResults.includes(false)) {
            this.sendSubmission(event);
        }
    }

    validateDateTimeFields() {
        const i18n = this._i18n;

        // Initially set the validation result to true to allow form submission
        let dateTimeFieldValidation = true;
        
        // Select all input elements with the type "datetime-local"
        const formElement = this.shadowRoot.querySelector('form');
        const dateTimeFields = formElement.querySelectorAll('input[type="datetime-local"]');

        // Get start and end date of the exam
        const startDateTime = Date.parse(dateTimeFields[0].value);
        const endDateTime = Date.parse(dateTimeFields[1].value);
        
        // The minimum date has to be two weeks ahead
        const min = Date.now() + 1209600000;
        
        if (startDateTime < min) {
            // If the start date is before the minimum date, alert the user
            this.showCustomValidationErrorMessage(
                "form-input-startdatetime", 
                i18n.t('accessible-exams-form.startDateTimeValidationError')
            );
            // Set the validation result to false to prevent form submission
            dateTimeFieldValidation = false;
        }

        if (endDateTime < startDateTime) {
            // If the end date is before the start date, alert the user
            this.showCustomValidationErrorMessage(
                "form-input-enddatetime", 
                i18n.t('accessible-exams-form.startDateTimeValidationError')
            );
            // Set the validation result to false to prevent form submission
            dateTimeFieldValidation = false;
        }

        // Return the validation result
        return dateTimeFieldValidation;
    }

}
