import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {css, html} from 'lit';
import {createInstance} from '../i18n.js';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import * as formElements from './form-elements.js';
import {classMap} from 'lit/directives/class-map.js';
import {getSelectorFixCSS} from '../styles.js';
import {CourseSelect} from '../modules/course-select.js';
import {RoomSelect} from '../modules/room-select.js';

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

    async validateRequiredFields() {
        // const i18n = this._i18n;

        // Initially set the validation result to true to allow form submission
        // let requiredFieldsValidation = true;

        // Select all input elements with the 'required' attribute
        const formElement = this.shadowRoot.querySelector('form');
        // const elementWebComponents = BaseFormElement.getElementWebComponents(formElement);
        // const data = this.gatherFormDataFromElement(formElement);
        //
        // elementWebComponents.forEach((element) => {
        //     element.dispatchEvent(
        //         new CustomEvent('evaluate', {
        //             detail: {
        //                 data: data,
        //             },
        //         }),
        //     );
        // });

        const elementWebComponents = BaseFormElement.getElementWebComponents(formElement);
        const data = this.gatherFormDataFromElement(formElement);

        const evaluationPromises = elementWebComponents.map((element) => {
            return new Promise((resolve) => {
                const event = new CustomEvent('evaluate', {
                    detail: {
                        data: data,
                        respond: resolve, // Pass a callback for the component to use
                    },
                });
                element.dispatchEvent(event);
            });
        });

        const responses = await Promise.all(evaluationPromises);
        return !responses.includes(false); // Return true if no component returned false

        // // Wait for all components to respond and check if any returned false
        // Promise.all(evaluationPromises).then((responses) => {
        //     const hasAnyFalse = responses.some((response) => response === false);
        //     if (hasAnyFalse) {
        //         console.log('At least one component evaluated to false.');
        //     } else {
        //         console.log('All components evaluated to true.');
        //     }
        // });

        // // const requiredFields = formElement.querySelectorAll('input[required], select[required], textarea[required]');
        // const requiredFields = formElement.querySelectorAll('*[required]');
        // console.log('validateRequiredFields requiredFields', requiredFields);
        //
        // // Loop through each required field
        // for (let field of requiredFields) {
        //     console.log('validateRequiredFields field.value', field.value);
        //     // // Check if the field is empty
        //     // if (!field.value.trim()) {
        //     //     // If empty, alert the user and return false to prevent form submission
        //     //     this.showCustomValidationErrorMessage(
        //     //         `${field.id}`,
        //     //         i18n.t('render-form.base-object.required-field-validation-error',
        //     //             {fieldName: field.name},
        //     //         )
        //     //     );
        //     //
        //     //     // Set the validation result to false so form submission is prevented
        //     //     requiredFieldsValidation = false;
        //     // }
        // }
        //
        // // Return the validation result
        // return requiredFieldsValidation;
    }

    async validateAndSendSubmission(event) {
        event.preventDefault();

        // Validate the form before proceeding
        const validationResult = await this.validateRequiredFields();
        console.log('validateAndSendSubmission validationResult', validationResult);
        if (!validationResult) {
            return;
        }

        this.sendSubmission(event);
    }

    sendSubmission(event) {
        this.saveButtonEnabled = false;
        const formElement = this.shadowRoot.querySelector('form');
        const data = {
            formData: this.gatherFormDataFromElement(formElement),
        };
        console.log('data', data);

        const customEvent = new CustomEvent('DbpFormalizeFormSubmission', {
            detail: data,
            bubbles: true,
            composed: true,
        });
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
        let customElementValues = {};

        // Gather data from "dbp-.*-element" web components
        const elementWebComponents = BaseFormElement.getElementWebComponents(formElement);
        console.log('gatherFormDataFromElement elementWebComponents', elementWebComponents);
        elementWebComponents.forEach((element) => {
            const name = element.getAttribute('name') || element.id;
            customElementValues[name] = element.value;
        });

        // Check if any elements have a "data-value" attribute, because we want to use that value instead of the form value
        const elementsWithDataValue = formElement.querySelectorAll('[data-value]');
        let dataValues = {};
        elementsWithDataValue.forEach((element) => {
            const name = element.getAttribute('name') || element.id;
            dataValues[name] = element.getAttribute('data-value');
        });

        console.log('gatherFormDataFromElement dataValues', dataValues);
        console.log('this.data', this.data);

        const data = {};

        // 1. First, add all custom element values as the base
        for (let [key, value] of Object.entries(customElementValues)) {
            this.setNestedValue(data, key, value);
        }

        // 2. Then process form data, which can override custom element values
        const formData = new FormData(formElement);
        for (let [key, value] of formData.entries()) {
            this.setNestedValue(data, key, value);
        }

        // 3. Finally, apply dataValues which have the highest priority
        for (let [key, value] of Object.entries(dataValues)) {
            this.setNestedValue(data, key, value);
        }

        console.log('gatherFormDataFromElement data', data);

        return data;
    }

    static getElementWebComponents(formElement) {
        return Array.from(formElement.getElementsByTagName('*')).filter((el) =>
            el.tagName.toLowerCase().match(/^dbp-.*-element$/),
        );
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            person: {type: Object},
            additionalType: {type: String, attribute: 'additional-type'},
            data: {type: Object},
            auth: {type: Object},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            saveButtonEnabled: {type: Boolean, attribute: false},
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

            .validation-errors {
                color: var(--dbp-override-danger);
                margin-top: 0.5em;
            }
        `;
    }

    resetForm(event) {
        event.preventDefault();

        const customEvent = new CustomEvent('DbpFormalizeFormReset', {
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(customEvent);
    }

    getButtonRowHtml() {
        return html`
            <div class="button-row">
                <button class="button is-secondary" type="button" @click=${this.resetForm}>
                    Reset
                </button>
                <button
                    class="button is-primary"
                    type="submit"
                    ?disabled=${!this.saveButtonEnabled}
                    @click=${this.validateAndSendSubmission}>
                    Save
                    <dbp-mini-spinner
                        class="${classMap({hidden: this.saveButtonEnabled})}"></dbp-mini-spinner>
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
