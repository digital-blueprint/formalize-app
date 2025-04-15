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
