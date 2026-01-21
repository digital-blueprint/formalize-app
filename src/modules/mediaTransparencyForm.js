import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html, css} from 'lit';
import {classMap} from 'lit-html/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import {getMediaTransparencyFormCSS} from '../styles.js';
import {Button, Icon, IconButton, DBPSelect, sendNotification} from '@dbp-toolkit/common';
// import {FileSource, FileSink} from '@dbp-toolkit/file-handling';
import {
    DbpStringElement,
    DbpDateElement,
    DbpBooleanElement,
    DbpEnumElement,
    DbpStringView,
} from '@dbp-toolkit/form-elements';
// import {
//     gatherFormDataFromElement,
//     validateRequiredFields,
// } from '@dbp-toolkit/form-elements/src/utils.js';
import {
    // SUBMISSION_STATES,
    SUBMISSION_STATES_BINARY,
    // isDraftStateEnabled,
    // isSubmittedStateEnabled,
} from '../utils.js';

export default class extends BaseObject {
    getUrlSlug() {
        return 'media-transparency';
    }

    /**
     * Returns the form component class for the media transparency form.
     *
     * @returns {typeof BaseFormElement} The class of the form component.
     */
    getFormComponent() {
        return FormalizeFormElement;
    }

    getFormIdentifier() {
        return '019bdb56-6fc7-760d-938a-b128a89958a8';
    }
}

class FormalizeFormElement extends BaseFormElement {
    constructor() {
        super();
        this.hideForm = false;
        this.currentSubmission = null;
        this.submissionId = null;
        this.submissionError = false;
        this.submitted = false;

        // Event handlers
        this.handleFormSubmission = this.handleFormSubmission.bind(this);
    }

    static get properties() {
        return {
            ...super.properties,
        };
    }

    static get scopedElements() {
        return {
            'dbp-form-string-element': DbpStringElement,
            'dbp-form-date-element': DbpDateElement,
            'dbp-form-boolean-element': DbpBooleanElement,
            'dbp-form-enum-element': DbpEnumElement,
            'dbp-form-string-view': DbpStringView,
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-icon-button': IconButton,
            'dbp-select': DBPSelect,
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Event listener for form submission
            this.addEventListener('DbpFormalizeFormSubmission', this.handleFormSubmission);
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('DbpFormalizeFormSubmission', this.handleFormSubmission);
    }

    async update(changedProperties) {
        super.update(changedProperties);

        console.log('changedProperties', changedProperties);

        if (changedProperties.has('data')) {
            console.log('Data changed:', this.data);
        }
    }

    async updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('data')) {
            console.log('Data changed:', this.data);
        }
    }

    static get styles() {
        // language=css
        return css`
            @layer theme, utility, formalize, print;
            @layer theme {
                ${commonStyles.getGeneralCSS(false)}
                ${commonStyles.getButtonCSS()}
                ${commonStyles.getModalDialogCSS()}
            }
            @layer formalize {
                ${getMediaTransparencyFormCSS()}
            }
        `;
    }

    async processFormData() {
        try {
            this.currentSubmission = this.data;
        } catch (e) {
            console.error('Error parsing submission data:', e);
        }
    }

    /**
     * Handle saving submission.
     * @param {object} event - The event object containing the form data.
     */
    async handleFormSubmission(event) {
        // Access the data from the event detail
        const data = event.detail;

        // POST or PATCH
        let isExistingDraft = false;
        if (data.submissionId) {
            isExistingDraft = true;
        }

        // Include unique identifier for person who first submitted the form (creator)
        // data.formData.identifier = isExistingDraft
        //     ? this.lastModifiedCreatorId
        //     : this.auth['user-id'];

        const formData = new FormData();

        formData.append('form', '/formalize/forms/' + this.formIdentifier);
        formData.append('dataFeedElement', JSON.stringify(data.formData));
        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.SUBMITTED));

        const method = isExistingDraft ? 'PATCH' : 'POST';
        const options = this._buildRequestOptions(formData, method);
        const url = this._buildSubmissionUrl(isExistingDraft ? this.submissionId : null);

        try {
            const response = await fetch(url, options);
            let responseBody = await response.json();
            if (!response.ok) {
                this.submissionError = true;
                if (
                    responseBody['relay:errorId'] ===
                    'formalize:submission-data-feed-invalid-schema'
                ) {
                    this.displayValidationErrors(responseBody);
                } else {
                    sendNotification({
                        summary: this._i18n.t('errors.error-title'),
                        body: this._i18n.t('errors.form-submission-failed', {
                            status: response.status,
                            details: responseBody.detail,
                        }),
                        type: 'danger',
                        timeout: 0,
                    });
                }
            } else {
                this.submissionError = false;
                this.submitted = true;

                // Hide form after successful submission
                this.hideForm = true;
                sendNotification({
                    summary: this._i18n.t('success.success-title'),
                    body: this._i18n.t('success.form-submitted-successfully'),
                    type: 'success',
                    timeout: 5,
                });

                // formDataUpdated event to notify parent component
                this.dispatchEvent(
                    new CustomEvent('dbpFormDataUpdated', {
                        detail: {
                            needUpdate: true,
                        },
                        bubbles: true,
                        composed: true,
                    }),
                );
            }
        } catch (error) {
            console.error(error);
            sendNotification({
                summary: this._i18n.t('errors.error-title'),
                body: this._i18n.t('errors.unknown-error-on-form-submission'),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    render() {
        return html`
            ${this.renderFormElements()}
        `;
    }

    renderFormElements() {
        const i18n = this._i18n;
        const data = this.formData || {};

        console.log(`data`, data);

        return html`
            <form
                id="media-transparency-form"
                aria-labelledby="form-title"
                class="${classMap({
                    hidden: this.hideForm,
                })}">
                <div class="form-header">${this.getButtonRowHtml()}</div>

                <h2 class="form-title">
                    ${i18n.t('render-form.forms.media-transparency-form.title')}
                </h2>

                <p>
                    <span class="red-marked-asterisk">
                        ${this._i18n.t('render-form.required-files-asterisk')}
                    </span>
                    ${this._i18n.t('render-form.required-files-text')}
                </p>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="category"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-category-label',
                    )}"
                    display-mode="list"
                    .items=${{
                        online: i18n.t('render-form.forms.media-transparency-form.online'),
                        print: i18n.t('render-form.forms.media-transparency-form.print'),
                        outOfHome: i18n.t('render-form.forms.media-transparency-form.out-of-home'),
                        radio: i18n.t('render-form.forms.media-transparency-form.radio'),
                        television: i18n.t('render-form.forms.media-transparency-form.television'),
                    }}
                    .value=${data.category || ''}
                    required></dbp-form-enum-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="advertisementSubcategory"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-advertisement-subcategory-label',
                    )}"
                    display-mode="list"
                    .items=${{
                        // If Kategorie is Online: Website, App, Video, Soziales Netzwerk, Text, Audio, Sonstiges;
                        // If Kategorie is Out of Home: Plakat, Verkehrsmittel, Digitaler Screen, Bande, Flächengebende Ausstattung, Kino, Sonstiges
                        // @TODO: What if the category is Print, Radio or Television?
                        website: i18n.t('render-form.forms.media-transparency-form.website'),
                        app: i18n.t('render-form.forms.media-transparency-form.app'),
                        video: i18n.t('render-form.forms.media-transparency-form.video'),
                        text: i18n.t('render-form.forms.media-transparency-form.text'),
                        audio: i18n.t('render-form.forms.media-transparency-form.audio'),
                        else: i18n.t('render-form.forms.media-transparency-form.else'),
                    }}
                    .value=${data.advertisementSubcategory || ''}
                    required></dbp-form-enum-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="mediaName"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-media-name-label',
                    )}"
                    display-mode="list"
                    .items=${{
                        facebook: 'Facebook [demo name]',
                        google: 'Google [demo name]',
                        instagram: 'Instagram [demo name]',
                        youtube: 'YouTube [demo name]',
                        tiktok: 'TikTok [demo name]',
                    }}
                    .value=${data.mediaName || ''}
                    required></dbp-form-enum-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="otherMediumName"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-other-medium-name-label',
                    )}"
                    .value=${data.otherMediumName || ''}></dbp-form-string-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="MediumOwnersName"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-media-owners-name-label',
                    )}"
                    display-mode="list"
                    .items=${{
                        facebook: 'Facebook [demo name]',
                        google: 'Google [demo name]',
                        instagram: 'Instagram [demo name]',
                        youtube: 'YouTube [demo name]',
                        tiktok: 'TikTok [demo name]',
                    }}
                    .value=${data.MediumOwnersName || ''}></dbp-form-enum-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="otherMediumOwnersName"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-other-medium-owners-name-label',
                    )}"
                    .value=${data.otherMediumOwnersName || ''}
                    required></dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="amountInEuro"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-amount-in-euro-label',
                    )}"
                    .value=${data.amountInEuro || ''}
                    required></dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="campaignTitle"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-campaign-title-label',
                    )}"
                    .value=${data.campaignTitle || ''}
                    required></dbp-form-string-element>

                <!-- Sujet file name -->
                <dbp-form-string-element
                    subscribe="lang"
                    name="sujetFileName"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-sujet-file-name-label',
                    )}"
                    .value=${data.sujetFileName || ''}
                    required></dbp-form-string-element>

                <!-- Sujet notes -->
                <dbp-form-string-element
                    subscribe="lang"
                    name="sujetNotes"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-sujet-notes-label',
                    )}"
                    .value=${data.sujetNotes || ''}></dbp-form-string-element>

                <!-- Notes -->
                <dbp-form-string-element
                    subscribe="lang"
                    name="Notes"
                    label="${i18n.t('render-form.forms.media-transparency-form.field-notes-label')}"
                    .value=${data.Notes || ''}></dbp-form-string-element>

                <!-- at/from -->
                <dbp-form-string-element
                    subscribe="lang"
                    name="atFrom"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-at-from-label',
                    )}"
                    .value=${data.atFrom || ''}></dbp-form-string-element>

                <!-- to -->
                <dbp-form-string-element
                    subscribe="lang"
                    name="to"
                    label="${i18n.t('render-form.forms.media-transparency-form.field-to-label')}"
                    .value=${data.to || ''}></dbp-form-string-element>

                <!-- SAP order number -->
                <dbp-form-string-element
                    subscribe="lang"
                    name="sapOrderNumber"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-sap-order-number-label',
                    )}"
                    .value=${data.sapOrderNumber || ''}></dbp-form-string-element>

                <!-- Reporting deadline -->
                <dbp-form-date-element
                    subscribe="lang"
                    name="reportingDeadline"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-reporting-deadline-label',
                    )}"
                    .value=${data.reportingDeadline || ''}></dbp-form-date-element>
            </form>
        `;
    }

    /**
     * Render text after successfull submission.
     * @param {boolean} submitted
     * @returns {import('lit').TemplateResult} HTML for the result of the submission.
     */
    renderResult(submitted) {
        const i18n = this._i18n;

        if (submitted) {
            return html`
                <div class="container">
                    <h2>
                        ${i18n.t(
                            'render-form.forms.media-transparency-form.submission-result-thanks',
                        )}
                    </h2>
                    <p>
                        ${i18n.t(
                            'render-form.forms.media-transparency-form.submission-result-notification',
                        )}
                    </p>
                </div>
            `;
        }

        return html``;
    }

    /**
     * Build request options for the fetch call.
     * @param {object} formData - The form data to be sent in the request body.
     * @param {string} method - The HTTP method to use (POST, PATCH, etc.)
     * @returns {object} The request options object.
     */
    _buildRequestOptions(formData, method) {
        return {
            method: method,
            headers: {
                Authorization: `Bearer ${this.auth.token}`,
            },
            body: formData,
        };
    }

    /**
     * Build the submission URL. If submissionId is provided, it will be included to the URL.
     * @param {string} submissionId
     * @returns {string} The submission URL.
     */
    _buildSubmissionUrl(submissionId = null) {
        const baseUrl = `${this.entryPointUrl}/formalize/submissions`;
        return submissionId ? `${baseUrl}/${submissionId}` : `${baseUrl}`;
    }
}
