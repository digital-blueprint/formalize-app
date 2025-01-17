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
import {gatherFormDataFromElement, validateRequiredFields} from '@dbp-toolkit/form-elements/src/utils.js';

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

    async validateAndSendSubmission(event) {
        event.preventDefault();

        const formElement = this.shadowRoot.querySelector('form');

        // Validate the form before proceeding
        const validationResult = await validateRequiredFields(formElement);
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
            formData: gatherFormDataFromElement(formElement),
        };
        console.log('data', data);

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
        this.saveButtonEnabled = true;
        this.data = {};

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
