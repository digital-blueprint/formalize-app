import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {css, html} from 'lit';
import {createInstance} from './i18n';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as formElements from './modules/formElements';
import {classMap} from 'lit/directives/class-map.js';
import {getSelectorFixCSS} from './styles.js';

export class BaseObject {
    getUrlSlug() {
        return 'url-slug';
    }

    getFormComponent() {
        return BaseFormElement;
    }

    getFormIdentifier() {
        return 'uuid';
    }
}

export class BaseFormElement extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.data = {};
        this.entryPointUrl = '';
        this.auth = {};
        this.saveButtonEnabled = true;
    }

    static get scopedElements() {
        return {
        };
    }

    showCustomValidationErrorMessage(id, message) {
        // Insert a div with a custom error message when validation fails after the HTML element with the given id
        this.shadowRoot.getElementById(id)
        .insertAdjacentHTML("afterend",
            `<div class="validation-error">
                <p>${message}</p>
            </div>`);
    }

    validateRequiredFields() {
        // Initially set the validation result to true to allow form submission
        let requiredFieldsValidation = true;
        
        // Select all input elements with the 'required' attribute
        const formElement = this.shadowRoot.querySelector('form');
        const requiredFields = formElement.querySelectorAll('input[required], select[required], textarea[required]');

        // Loop through each required field
        for (let field of requiredFields) {
            // Check if the field is empty
            if (!field.value.trim()) {
                // If empty, alert the user and return false to prevent form submission
                this.showCustomValidationErrorMessage(
                    `${field.id}`, 
                    `Please fill out the ${field.name || 'required'} field.`
                );

                // Set the validation result to false to prevent form submission
                requiredFieldsValidation = false;
            }
        }

        // Return the validation result
        return requiredFieldsValidation;
    }

    validateAndSendSubmission(event) {
        event.preventDefault();

        // Validate the form before proceeding
        if (!this.validateRequiredFields()) {
            return;
        }

        this.sendSubmission(event);
    }

    sendSubmission(event) {
        this.saveButtonEnabled = false;
        const formElement = this.shadowRoot.querySelector('form');
        const data = {
            'formData': this.gatherFormDataFromElement(formElement),
        };
        console.log('data', data);

        const customEvent = new CustomEvent("DbpFormalizeFormSubmission",
            {"detail": data, bubbles: true, composed: true});
        this.dispatchEvent(customEvent);
    }

    setNestedValue(obj, path, value) {
        const keys = path.replace(/\]/g, '').split('[');
        let current = obj;

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (i === keys.length - 1) {
                // Last key, set the value
                current[key] = value;
            } else {
                // Not the last key, create nested object if it doesn't exist
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
        }
    }

    gatherFormDataFromElement(formElement) {
        const formData = new FormData(formElement);

        // Check if any elements have a "data-value" attribute, because we want to use that value instead of the form value
        const elementsWithDataValue = formElement.querySelectorAll('[data-value]');
        let dataValues = {};
        elementsWithDataValue.forEach(element => {
            const name = element.getAttribute('name') || element.id;
            dataValues[name] = element.getAttribute('data-value');
        });

        console.log('this.data', this.data);

        const data = {};

        for (let [key, value] of formData.entries()) {
            // Check if we have a "data-value" attribute for this element
            if (dataValues[key]) {
                value = dataValues[key];
            }

            this.setNestedValue(data, key, value);
        }

        return data;
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            person: {type: Object},
            additionalType: {type: String, attribute: 'additional-type'},
            data: {type: Object},
            auth: { type: Object },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            saveButtonEnabled: { type: Boolean, attribute: false },
        };
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getButtonCSS()}
            ${formElements.getFieldsetCSS()}
            ${getSelectorFixCSS()}

            .button-row {
                margin-top: 1em;
                text-align: right;
            }
        `;
    }

    resetForm(event) {
        event.preventDefault();

        const customEvent = new CustomEvent("DbpFormalizeFormReset",
            {bubbles: true, composed: true});
        this.dispatchEvent(customEvent);
    }

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

    render() {
        console.log('-- Render BaseFormElement --');
        const data = this.data;

        return html`
            <form>
                <h2>${data.objectType}</h2>
                ${formElements.stringElement('objectType', data.objectType)}
                ${this.getButtonRowHtml()}
            </form>
        `;
    }
}
