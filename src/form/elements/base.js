import {css, html} from 'lit';
import {getFieldsetCSS, sanitizeForHtmlId} from '../utils.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPFormalizeLitElement from '../../dbp-formalize-lit-element.js';
import * as commonStyles from '@dbp-toolkit/common/src/styles.js';

export class DbpBaseElement extends ScopedElementsMixin(DBPFormalizeLitElement) {
    constructor() {
        super();
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
                    if (this.errorMessages.length > 0) {
                        this.handleErrors();
                    }
                    break;
            }
        });

        super.update(changedProperties);
    }

    handleInputValue(e) {
        this.value = e.target.value;
    }

    render() {
        this.id = 'form-input-' + sanitizeForHtmlId(this.name);

        // Regenerate error messages in case the language has changed
        if (this.errorMessages.length > 0) {
            this.handleErrors();
        }

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
