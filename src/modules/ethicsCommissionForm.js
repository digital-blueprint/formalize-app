import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html, css} from 'lit';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import {getEthicsCommissionFormCSS} from '../styles.js';
import {DbpStringElement, DbpDateElement, DbpCheckboxElement, DbpEnumElement} from '@dbp-toolkit/form-elements';

export default class extends BaseObject {
    getUrlSlug() {
        return 'ethics-commission';
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
        return '32297d33-1352-4cf2-ba06-1577911c3537';
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
            submissionError: {type: Boolean}
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {

            // Event listener for form submission
            this.addEventListener('DbpFormalizeFormSubmission', async (event) => {
                // Access the data from the event detail
                const data = event.detail;
                // Include unique identifier for person who is submitting
                data.formData.identifier = this.formData.identifier;
            });
        });
    }

    static get scopedElements() {
        return {
            'dbp-form-string-element': DbpStringElement,
            'dbp-form-date-element': DbpDateElement,
            'dbp-form-checkbox-element': DbpCheckboxElement,
            'dbp-form-enum-element': DbpEnumElement,
        };
    }

    createUUID() {
        let uuid = self.crypto.randomUUID();
        console.log("Created UUID: " + uuid);
        this.formData.uuid = uuid;
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getButtonCSS()}
            ${getEthicsCommissionFormCSS()}
        `;
    }

    render() {
        const i18n = this._i18n;
        console.log('-- Render FormalizeFormElement --');

        console.log('this.formData', this.formData);
        const data = this.formData || {};

        return html`
            <form id="ethics-commission-form">
                <h2 class="form-title">${i18n.t('render-form.forms.ethics-commission-form.title')}</h2>

                <div class="type-container">
                    <dbp-form-enum-element
                        subscribe="lang"
                        name="type"
                        display-mode="list"
                        .items=${{
                            studie: i18n.t('render-form.forms.ethics-commission-form.studie'),
                            publication: i18n.t('render-form.forms.ethics-commission-form.publication')
                        }}
                        .value=${data.myEnum || ''}
                        required>
                    </dbp-form-enum-element>
                </div>

                <p class="form-sub-title">${i18n.t('render-form.forms.ethics-commission-form.sub-title')}</p>

                <dbp-form-string-element
                    subscribe="lang"
                    name="applicant"
                    placeholder="${i18n.t('render-form.forms.ethics-commission-form.applicant-placeholder')}"
                    label="${i18n.t('render-form.forms.ethics-commission-form.applicant-label')}"
                    required
                    value=${data.applicant || ''}>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="contact-details"
                    placeholder="${i18n.t('render-form.forms.ethics-commission-form.contact-details-placeholder')}"
                    label="${i18n.t('render-form.forms.ethics-commission-form.contact-details-label')}"
                    required
                    value=${data.applicant || ''}>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="contact-details"
                    required
                    placeholder="${i18n.t('render-form.forms.ethics-commission-form.co-applicants-placeholder')}"
                    label="${i18n.t('render-form.forms.ethics-commission-form.co-applicants-label')}"
                    description="${i18n.t('render-form.forms.ethics-commission-form.co-applicants-description')}"
                    rows="3"
                    value=${data.applicant || ''}>
                </dbp-form-string-element>

                <dbp-form-enum-element
                        subscribe="lang"
                        name="fields-of-expertise"
                        display-mode="list"
                        multiple
                        label="${i18n.t('render-form.forms.ethics-commission-form.fields-of-expertise-label')}"
                        .items=${{
                            "advanced-material-sciences": i18n.t('render-form.forms.ethics-commission-form.advanced-material-sciences'),
                            "human-and-biotechnology": i18n.t('render-form.forms.ethics-commission-form.human-and-biotechnology'),
                            "information-communication-computing": i18n.t('render-form.forms.ethics-commission-form.information-communication-computing'),
                            "mobility-production": i18n.t('render-form.forms.ethics-commission-form.mobility-production'),
                            "sustainable-systems": i18n.t('render-form.forms.ethics-commission-form.sustainable-systems'),
                            "keinem": i18n.t('render-form.forms.ethics-commission-form.keinem'),
                        }}
                        .value=${data.myEnum || ''}>
                    </dbp-form-enum-element>

                ${this.getButtonRowHtml()}
            </form>
            ${this.renderResult(this.submitted)}
            ${this.renderErrorMessage(this.submissionError)}
        `;
    }

    renderResult(submitted) {
        const i18n = this._i18n;

        if (submitted) {
            return html`
                <div class="container">
                    <h2>${i18n.t('render-form.forms.ethics-commission-form.submission-result-thanks')}</h2>
                    <p>${i18n.t('render-form.forms.ethics-commission-form.submission-result-notification')}</p>
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
                    <h2>${i18n.t('render-form.forms.ethics-commission-form.submission-error')}</h2>
                    <p>${i18n.t('render-form.forms.ethics-commission-form.submission-error-notification')}</p>
                </div>
            `;
        }

        return html``;
    }
}
