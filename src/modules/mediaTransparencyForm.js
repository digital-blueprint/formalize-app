import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html, css} from 'lit';
import {classMap} from 'lit-html/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import {getMediaTransparencyFormCSS} from '../styles.js';
import {
    Button,
    Icon,
    IconButton,
    DBPSelect,
    Translated,
    sendNotification,
} from '@dbp-toolkit/common';
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
        this.advertisementSubcategoryItems = {};
        this.selectedCategory = null;
        this.otherMediumNameEnabled = false;

        // Event handlers
        this.handleFormSubmission = this.handleFormSubmission.bind(this);
    }

    static get properties() {
        return {
            ...super.properties,
            hideForm: {type: Boolean, attribute: false},
            currentSubmission: {type: Object, attribute: false},
            submissionId: {type: String, attribute: false},
            submissionError: {type: Boolean, attribute: false},
            submitted: {type: Boolean, attribute: false},

            advertisementSubcategoryItems: {type: Object, attribute: false},
            selectedCategory: {type: String, attribute: false},
            otherMediumNameEnabled: {type: Boolean, attribute: false},
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
            'dbp-translated': Translated,
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

    setSubcategoryItems(e) {
        const i18n = this._i18n;
        const selectedValue = e.currentTarget.value;
        console.log(`selectedValue`, selectedValue);
        this.selectedCategory = selectedValue;

        // Update subcategory options based on selected category
        if (selectedValue === 'online') {
            this.advertisementSubcategoryItems = {
                website: i18n.t('render-form.forms.media-transparency-form.sub-categories-website'),
                app: i18n.t('render-form.forms.media-transparency-form.sub-categories-app'),
                video: i18n.t('render-form.forms.media-transparency-form.sub-categories-video'),
                text: i18n.t('render-form.forms.media-transparency-form.sub-categories-text'),
                audio: i18n.t('render-form.forms.media-transparency-form.sub-categories-audio'),
                else: i18n.t('render-form.forms.media-transparency-form.sub-categories-else'),
            };
        } else if (selectedValue === 'outOfHome') {
            this.advertisementSubcategoryItems = {
                poster: i18n.t('render-form.forms.media-transparency-form.sub-categories-poster'),
                transportation: i18n.t(
                    'render-form.forms.media-transparency-form.sub-categories-transportation',
                ),
                digitalScreen: i18n.t(
                    'render-form.forms.media-transparency-form.sub-categories-digitalScreen',
                ),
                billboard: i18n.t(
                    'render-form.forms.media-transparency-form.sub-categories-billboard',
                ),
                outdoorAdvertising: i18n.t(
                    'render-form.forms.media-transparency-form.sub-categories-outdoorAdvertising',
                ),
                cinema: i18n.t('render-form.forms.media-transparency-form.sub-categories-cinema'),
                else: i18n.t('render-form.forms.media-transparency-form.sub-categories-else'),
            };
        } else {
            this.advertisementSubcategoryItems = {};
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
                    'media-transparency-form': true,
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
                        online: i18n.t(
                            'render-form.forms.media-transparency-form.categories-online',
                        ),
                        print: i18n.t('render-form.forms.media-transparency-form.categories-print'),
                        outOfHome: i18n.t(
                            'render-form.forms.media-transparency-form.categories-out-of-home',
                        ),
                        radio: i18n.t('render-form.forms.media-transparency-form.categories-radio'),
                        television: i18n.t(
                            'render-form.forms.media-transparency-form.categories-television',
                        ),
                    }}
                    @change=${(e) => {
                        this.setSubcategoryItems(e);
                    }}
                    .value=${data.category || ''}
                    required></dbp-form-enum-element>

                ${this.advertisementSubcategoryItems &&
                Object.keys(this.advertisementSubcategoryItems).length > 0
                    ? html`
                          <dbp-form-enum-element
                              class="${classMap({
                                  'fade-in':
                                      Object.keys(this.advertisementSubcategoryItems).length > 0,
                              })}"
                              subscribe="lang"
                              name="advertisementSubcategory"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-advertisement-subcategory-label',
                              )}"
                              display-mode="list"
                              .items=${this.advertisementSubcategoryItems || {}}
                              .value=${data.advertisementSubcategory || ''}
                              required></dbp-form-enum-element>
                      `
                    : ''}

                <dbp-form-enum-element
                    subscribe="lang"
                    name="mediaName"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-media-name-label',
                    )}"
                    display-mode="dropdown"
                    .items=${{
                        notSelected: i18n.t(
                            'render-form.forms.media-transparency-form.please-select-media',
                        ),
                        facebook: 'Facebook',
                        instagram: 'Instagram',
                        linkedin: 'LinkedIn',
                        other: 'Other',
                    }}
                    @change=${(e) => {
                        const selectedValue = e.currentTarget.value;
                        console.log(`selectedValue`, selectedValue);
                        switch (selectedValue) {
                            case 'facebook':
                                data.mediumOwnersName = 'Meta Platforms Ireland Limited';
                                break;
                            case 'instagram':
                                data.mediumOwnersName = 'Meta Platforms Ireland Limited';
                                break;
                            case 'linkedin':
                                data.mediumOwnersName = 'LinkedIn Ireland Unlimited Company';
                                break;
                            case 'other':
                                data.mediumOwnersName = '';
                                this.otherMediumNameEnabled = true;
                                break;
                        }
                        this.requestUpdate();
                    }}
                    .value=${data.mediaName || ''}
                    required></dbp-form-enum-element>

                <dbp-translated subscribe="lang">
                    <div slot="de">
                        <p class="field-note">
                            Bitte zuerst schauen, ob das Medium in der 2024_TU Graz Medienliste
                            (siehe eigenes Tabellenblatt) vorkommt und sich genau an die
                            Schreibweise und die Kombination Medium/Medieninhaber zu halten. Finden
                            Sie den Namen des Mediums nicht in der Liste, wählen Sie in dieser
                            Spalte "Sonstiges" aus und tragen den neuen Namen bei „Name anderes
                            Medium“ ein.
                        </p>
                    </div>
                    <div slot="en">
                        <p class="field-note">
                            First, please check whether the medium appears in 2024_TU Graz
                            Medienliste (see separate spreadsheet) and adhere strictly to the
                            spelling and combination of medium/media owner. If you cannot find the
                            name of the medium in the list, select ‘Sonstiges’ in this column and
                            enter the new name under ‘Other medium's name’.
                        </p>
                    </div>
                </dbp-translated>

                ${this.otherMediumNameEnabled
                    ? html`
                          <dbp-form-string-element
                              subscribe="lang"
                              name="otherMediumName"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-other-medium-name-label',
                              )}"
                              .value=${data.otherMediumName || ''}></dbp-form-string-element>

                          <dbp-form-string-element
                              subscribe="lang"
                              name="otherMediumOwnersName"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-other-medium-owners-name-label',
                              )}"
                              .value=${data.otherMediumOwnersName || ''}
                              required></dbp-form-string-element>
                      `
                    : html`
                          <dbp-form-string-element
                              subscribe="lang"
                              name="mediumOwnersName"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-media-owners-name-label',
                              )}"
                              disabled
                              .value=${data.mediumOwnersName || ''}></dbp-form-string-element>

                          <dbp-translated subscribe="lang">
                              <div slot="de">
                                  <p class="field-note">
                                      Bitte zuerst schauen, ob der Name des Medieninhabers in der
                                      2024_TU Graz Medienliste (siehe eigenes Tabellenblatt)
                                      vorkommt. Finden Sie den Namen des Medieninhabers nicht in der
                                      Liste, wählen Sie in dieser Spalte "Sonstiger" aus und tragen
                                      den neuen Namen bei „Name anderer Medieninhaber" ein.
                                  </p>
                              </div>
                              <div slot="en">
                                  <p class="field-note">
                                      First, please check whether the medium appears in 2024_TU Graz
                                      Medienliste (see separate spreadsheet) and adhere strictly to
                                      the spelling and combination of medium/media owner. If you
                                      cannot find the name of the medium in the list, select
                                      ‘Sonstiges’ in this column and enter the new name under ‘Other
                                      medium owner's name’.
                                  </p>
                              </div>
                          </dbp-translated>
                      `}

                <dbp-form-string-element
                    subscribe="lang"
                    name="amountInEuro"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-amount-in-euro-label',
                    )}"
                    .customValidator=${(value) => {
                        const re = /^\d+(?:,\d{1,2})?$/;
                        return re.test(value)
                            ? null
                            : i18n.t(
                                  'render-form.forms.media-transparency-form.validation-amount-in-euro-label',
                              );
                    }}
                    .value=${data.amountInEuro || ''}
                    required></dbp-form-string-element>

                <dbp-translated subscribe="lang">
                    <div slot="de">
                        <p class="field-note">
                            Betrag: in Euro – Nettoentgelt vor Werbeabgabe und Ust. Der Betrag darf
                            maximal 2 Nachkommastellen enthalten und kein Eurozeichen.
                        </p>
                    </div>
                    <div slot="en">
                        <p class="field-note">
                            Amount: in euros – net remuneration before advertising tax and VAT. The
                            amount may contain a maximum of two decimal places and no euro sign.
                        </p>
                    </div>
                </dbp-translated>

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
                    .value=${data.sujetFileName || 'MT_2025_Sujets_Bezeichnungslogik-all.pdf '}
                    disabled
                    required></dbp-form-string-element>

                <dbp-translated subscribe="lang">
                    <div slot="de">
                        <p class="field-note">
                            Sujetname (kurz!) - keine weiteren Ziffern im Sujetnamen außer der
                            Durchnummerierung. Siehe folgende Datei:
                            MT_2025_Sujets_Bezeichnungslogik-all.pdf
                        </p>
                    </div>
                    <div slot="en">
                        <p class="field-note">
                            Subject name (short!) – no other numbers in the subject name except for
                            sequential numbering. See the following file:
                            MT_2025_Sujets_Bezeichnungslogik-all.pdf
                        </p>
                    </div>
                </dbp-translated>

                ${this.selectedCategory === 'online'
                    ? html`
                          <!-- Sujet notes -->
                          <dbp-form-string-element
                              subscribe="lang"
                              name="sujetNotes"
                              rows="5"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-sujet-notes-label',
                              )}"
                              .value=${data.sujetNotes || ''}></dbp-form-string-element>
                      `
                    : ''}

                <!-- Notes -->
                <dbp-form-string-element
                    subscribe="lang"
                    name="notes"
                    rows="5"
                    label="${i18n.t('render-form.forms.media-transparency-form.field-notes-label')}"
                    .value=${data.notes || ''}></dbp-form-string-element>

                ${this.selectedCategory === 'online'
                    ? html`
                          <!-- at/from -->
                          <dbp-form-date-element
                              subscribe="lang"
                              name="atFrom"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-at-from-label',
                              )}"
                              .value=${data.atFrom || ''}></dbp-form-date-element>

                          <!-- to -->
                          <dbp-form-date-element
                              subscribe="lang"
                              name="to"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-to-label',
                              )}"
                              .value=${data.to || ''}></dbp-form-date-element>
                      `
                    : ''}

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

            ${this.renderResult(this.submitted)}
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
