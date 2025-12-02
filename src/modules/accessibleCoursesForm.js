import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html, css} from 'lit';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import {
    DbpStringElement,
    DbpDateElement,
    DbpTimeElement,
    DbpBooleanElement,
} from '@dbp-toolkit/form-elements';

export default class extends BaseObject {
    getUrlSlug() {
        return 'accessible-courses';
    }

    /**
     * Returns the form component class for the ethics commission form.
     *
     * @returns {typeof BaseFormElement} The class of the form component.
     */
    getFormComponent() {
        return FormalizeFormElement;
    }

    getFormIdentifier() {
        return '019ada3e-b7ff-7b35-b1dd-7b578d810955';
    }
}

class FormalizeFormElement extends BaseFormElement {
    constructor() {
        super();
        this.submitted = false;
        this.submissionError = false;
    }

    static get properties() {
        return {
            ...super.properties,
            submitted: {type: Boolean},
            submissionError: {type: Boolean},
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Event listener for form submission
            this.addEventListener('DbpFormalizeFormSubmission', async (event) => {
                // Get the form data from the event detail
                const formData = event.detail.formData;
                console.log('Form submitted with data:', formData);
            });
        });
    }

    static get scopedElements() {
        return {
            'dbp-form-string-element': DbpStringElement,
            'dbp-form-date-element': DbpDateElement,
            'dbp-form-time-element': DbpTimeElement,
            'dbp-form-boolean-element': DbpBooleanElement,
        };
    }

    static get styles() {
        return css`
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getButtonCSS()}
        `;
    }

    render() {
        console.log('-- Render FormalizeFormElement --');
        const i18n = this._i18n;
        const data = this.formData || {};

        return html`
            <h2 id="title">${i18n.t('render-form.forms.accessible-courses-form.title')}</h2>
            <p id="description">
                ${i18n.t('render-form.forms.accessible-courses-form.description-text')}
            </p>
            <form id="accessible-courses-form">
                ${this.getButtonRowHtml()}
                <dbp-form-string-element
                    subscribe="lang"
                    name="example"
                    placeholder="${i18n.t(
                        'render-form.forms.accessible-courses-form.form-field-example-placeholder',
                    )}"
                    label="${i18n.t(
                        'render-form.forms.accessible-courses-form.field-example-label',
                    )}"
                    required
                    value=${data.example || ''}></dbp-form-string-element>
            </form>
            ${this.renderResult(this.submitted)} ${this.renderErrorMessage(this.submissionError)}
        `;
    }

    renderResult(submitted) {
        const i18n = this._i18n;

        if (submitted) {
            return html`
                <div class="container">
                    <h2>
                        ${i18n.t(
                            'render-form.forms.accessible-courses-form.submission-result-thanks',
                        )}
                    </h2>
                    <p>
                        ${i18n.t(
                            'render-form.forms.accessible-courses-form.submission-result-notification',
                        )}
                    </p>
                </div>
            `;
        }

        return html``;
    }

    renderErrorMessage(submissionError) {
        const i18n = this._i18n;

        if (submissionError) {
            return html`
                <div class="container">
                    <h2>${i18n.t('render-form.forms.accessible-courses-form.submission-error')}</h2>
                    <p>
                        ${i18n.t(
                            'render-form.forms.accessible-courses-form.submission-error-notification',
                        )}
                    </p>
                </div>
            `;
        }

        return html``;
    }
}
