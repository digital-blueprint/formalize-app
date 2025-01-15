import {css, html} from 'lit';
import {createInstance} from './i18n';
import {getFieldsetCSS, sanitizeForHtmlId} from '../utils.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonStyles from '@dbp-toolkit/common/src/styles.js';
import DBPLitElement from '@dbp-toolkit/common/src/dbp-lit-element.js';

export class DbpBaseElement extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.id = '';
        this.name = '';
        this.description = '';
        this.label = '';
        this.value = '';
        this.required = false;
        this.errorMessages = [];
        this.evaluationData = {};
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            name: {type: String},
            description: {type: String},
            label: {type: String},
            value: {type: String, reflect: true},
            required: {type: Boolean},
            errorMessages: {type: Array, attribute: false},
        };
    }

    handleErrors() {
        let errorMessages = [];

        if (this.required && !this.value) {
            errorMessages.push(
                this._i18n.t('render-form.base-object.required-field-validation-error'),
            );
        }

        // Evaluate the output of customValidationFnc() and add any error messages to the array
        if (this.customValidationFnc) {
            const customValidationErrors = this.customValidationFnc(
                this.value,
                this.evaluationData,
            );
            if (customValidationErrors) {
                errorMessages = errorMessages.concat(customValidationErrors);
            }
        }

        this.errorMessages = errorMessages;
        return errorMessages.length === 0;
    }

    handleErrorsIfAny() {
        if (this.errorMessages.length > 0) {
            this.handleErrors();
        }
    }

    evaluateCallback(data) {
        console.log('evaluateCallback data', data);
        this.evaluationData = data;

        return this.handleErrors();
    }

    renderErrorMessages() {
        if (!this.errorMessages) {
            return html``;
        }

        // Loop through each error message
        return html`
            <ul class="validation-errors">
                ${this.errorMessages.map((error) => html`<li>${error}</li>`)}
            </ul>
        `;
    }

    connectedCallback() {
        super.connectedCallback();

        this.addEventListener('evaluate', (event) => {
            const detail = event.detail;
            const result = this.evaluateCallback(detail.data); // Perform your evaluation
            detail.respond(result); // Send the result back to the caller
        });
    }

    static get styles() {
        return [
            commonStyles.getGeneralCSS(false),
            getFieldsetCSS(),
            // language=css
            css`
                .validation-errors {
                    color: var(--dbp-override-danger);
                }
            `
        ];
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    this.handleErrorsIfAny();
                    break;
                case 'name':
                    this.id = 'form-input-' + sanitizeForHtmlId(this.name);
                    break;
            }
        });

        super.update(changedProperties);
    }

    handleInputValue(e) {
        this.value = e.target.value;
    }

    render() {
        // Regenerate error messages in case the language has changed
        this.handleErrorsIfAny();

        return html`
            <fieldset>
                <label for="${this.id}">
                    ${this.label}
                    ${this.required ? html`(${this._i18n.t('render-form.base-object.required-field')})` : html``}
                </label>
                <div>${this.description}</div>
                ${this.renderInput()}
                ${this.renderErrorMessages()}
            </fieldset>
        `;
    }

    renderInput() {
        return html`Please implement renderInput() in your subclass`;
    }
}
