import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element.js';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {css, html} from 'lit';
import {createInstance} from '../i18n.js';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import {classMap} from 'lit/directives/class-map.js';
import {getElementWebComponents} from '@dbp-toolkit/form-elements/src/utils.js';
import {getSelectorFixCSS} from '../styles.js';
import {
    gatherFormDataFromElement,
    validateRequiredFields,
} from '@dbp-toolkit/form-elements/src/utils.js';

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
        this.formData = {};
        this.entryPointUrl = '';
        this.auth = {};
        this.saveButtonEnabled = true;
        this.formIdentifier = '';
        this.formUrlSlug = '';
        this.formProperties = {};
        this.userAllSubmissions = [];
        this.allowedSubmissionStates = 4;
        this.maxNumberOfSubmissionsPerUser = 10;
        this.readOnly = false;
        this.submissionId = '';
    }

    async validateAndSendSubmission(event) {
        event.preventDefault();

        const formElement = this.shadowRoot.querySelector('form');

        // Validate the form before proceeding
        const validationResult = await validateRequiredFields(formElement);
        console.log('validateAndSendSubmission validationResult', validationResult);
        if (!validationResult) {
            this.scrollToFirstInvalidField(formElement);
            return;
        }

        this.sendSubmission(event);
    }

    /**
     * Scroll to the first invalid field in the form
     * @param {HTMLFormElement} formElement
     */
    scrollToFirstInvalidField(formElement) {
        const elementWebComponents = getElementWebComponents(formElement);
        for (const element of elementWebComponents) {
            const invalidElement = element.shadowRoot.querySelector('.validation-errors');
            if (invalidElement) {
                const invalidFieldLabel = invalidElement.closest('fieldset').querySelector('label');
                invalidFieldLabel.style.scrollMarginTop = '70px';
                invalidFieldLabel.scrollIntoView({behavior: 'smooth'});
                break;
            }
        }
    }

    /**
     * Sends a submission event with the given form data.
     * @param {object} event
     */
    sendSubmission(event) {
        this.saveButtonEnabled = false;
        const formElement = this.shadowRoot.querySelector('form');
        const data = {
            formData: gatherFormDataFromElement(formElement),
        };
        console.log('sendSubmission data', data);

        const customEvent = new CustomEvent('DbpFormalizeFormSubmission', {
            detail: data,
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(customEvent);
    }

    /**
     * Sends a draft submission event with the given form data.
     * @param {object} event
     */
    sendSaveDraft(event) {
        this.draftButtonEnabled = false;
        const formElement = this.shadowRoot.querySelector('form');
        const data = {
            formData: gatherFormDataFromElement(formElement),
        };

        const customEvent = new CustomEvent('DbpFormalizeFormSaveDraft', {
            bubbles: true,
            composed: true,
            detail: data,
        });
        this.dispatchEvent(customEvent);
    }

    /**
     * Sends a delete submission event with the submission ID to delete.
     * @param {object} event
     */
    sendDeleteSubmission(event) {
        if (!this.submissionId) {
            return;
        }

        const data = {
            submissionId: this.submissionId,
        };

        const customEvent = new CustomEvent('DbpFormalizeFormDeleteSubmission', {
            bubbles: true,
            composed: true,
            detail: data,
        });
        this.dispatchEvent(customEvent);
    }

    /**
     * Sends an accept submission event with the submission ID to accept.
     * @param {object} event
     */
    sendAcceptSubmission(event) {
        if (!this.submissionId) {
            return;
        }

        this.isAcceptButtonEnabled = false;
        this.isRevertAcceptButtonEnabled = true;
        const data = {
            submissionId: this.submissionId,
        };

        const customEvent = new CustomEvent('DbpFormalizeFormAcceptSubmission', {
            bubbles: true,
            composed: true,
            detail: data,
        });
        this.dispatchEvent(customEvent);
    }

    /**
     * Sends an revert-accept submission event with the submission ID to accept.
     * @param {object} event
     */
    sendRevertAcceptSubmission(event) {
        if (!this.submissionId) {
            return;
        }

        this.isAcceptButtonEnabled = true;
        this.isRevertAcceptButtonEnabled = false;
        const data = {
            submissionId: this.submissionId,
        };

        const customEvent = new CustomEvent('DbpFormalizeFormRevertAcceptedSubmission', {
            bubbles: true,
            composed: true,
            detail: data,
        });
        this.dispatchEvent(customEvent);
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            person: {type: Object},
            additionalType: {type: String, attribute: 'additional-type'},
            // For some reason, the attribute this.data was reset every time a new auth
            // object was set by Keycloak, so we use this.formData instead
            formData: {type: Object, attribute: false},
            data: {type: Object},
            auth: {type: Object},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            formIdentifier: {type: String, attribute: 'form-identifier'},
            formUrlSlug: {type: String, attribute: 'form-url-slug'},
            readOnly: {type: Boolean, attribute: 'read-only'},
            allowedSubmissionStates: {type: Number, attribute: 'allowed-submission-states'},
            maxNumberOfSubmissionsPerUser: {type: String, attribute: 'max-number-of-submissions'},

            formProperties: {type: Object},
            userAllSubmissions: {type: Array},

            saveButtonEnabled: {type: Boolean, attribute: false},
        };
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getButtonCSS()}
            ${getSelectorFixCSS()}

            .button-row {
                margin-top: 1em;
                text-align: right;
            }
        `;
    }

    resetForm(event) {
        event.preventDefault();
        this.saveButtonEnabled = true;
        this.formData = {};

        const customEvent = new CustomEvent('DbpFormalizeFormReset', {
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(customEvent);
    }

    /**
     * Render the buttons needed for the form.
     * @returns {import('lit').TemplateResult} HTML for the button row.
     */
    getButtonRowHtml() {
        const i18n = this._i18n;
        return html`
            <div class="button-row">
                <button class="button is-secondary" type="button" @click=${this.resetForm} hidden>
                    ${i18n.t('render-form.button-row.reset')}
                </button>
                <button
                    class="button is-primary"
                    type="submit"
                    ?disabled=${!this.saveButtonEnabled}
                    @click=${this.validateAndSendSubmission}>
                    ${i18n.t('render-form.button-row.submit')}
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

        return html`
            <form>Please implement render() in your subclass! ${this.getButtonRowHtml()}</form>
        `;
    }
}
