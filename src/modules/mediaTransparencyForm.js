import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html, css} from 'lit';
import {classMap} from 'lit-html/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import {getMediaTransparencyFormCSS} from '../styles.js';
import {Translated, sendNotification} from '@dbp-toolkit/common';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {FileSource, FileSink} from '@dbp-toolkit/file-handling';
import {
    DbpStringElement,
    DbpDateElement,
    DbpBooleanElement,
    DbpEnumElement,
    DbpStringView,
    DbpDateView,
    DbpEnumView,
} from '@dbp-toolkit/form-elements';
import {
    getFormRenderUrl,
    getDeletionConfirmation,
    handleDeletionConfirm,
    handleDeletionCancel,
    SUBMISSION_STATES,
    SUBMISSION_STATES_BINARY,
} from '../utils.js';
import {validateRequiredFields} from '@dbp-toolkit/form-elements/src/utils.js';
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

        // Advertisement category related
        this.advertisementSubcategoryItems = {};
        this.selectedCategory = null;
        this.otherMediumNameEnabled = false;

        // Attachments
        this.submittedFiles = new Map();
        this.filesToSubmit = new Map();
        this.filesToRemove = new Map();
        this.fileUploadError = false;
        this.fileUploadCounts = {};

        // Conditional fields
        this.conditionalFields = {
            category: false,
            mediaName: false,
        };

        // Event handlers
        this.handleFormSubmission = this.handleFormSubmission.bind(this);
        this.handleSaveDraft = this.handleSaveDraft.bind(this);
    }

    static get properties() {
        return {
            ...super.properties,

            advertisementSubcategoryItems: {type: Object, attribute: false},
            selectedCategory: {type: String, attribute: false},
            otherMediumNameEnabled: {type: Boolean, attribute: false},
        };
    }

    static get scopedElements() {
        return {
            ...super.scopedElements,
            'dbp-form-string-element': DbpStringElement,
            'dbp-form-date-element': DbpDateElement,
            'dbp-form-boolean-element': DbpBooleanElement,
            'dbp-form-enum-element': DbpEnumElement,
            'dbp-form-string-view': DbpStringView,
            'dbp-form-date-view': DbpDateView,
            'dbp-form-enum-view': DbpEnumView,
            'dbp-translated': Translated,
            'dbp-modal': Modal,
            'dbp-file-source': FileSource,
            'dbp-file-sink': FileSink,
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Event listener for form submission
            this.addEventListener('DbpFormalizeFormSubmission', this.handleFormSubmission);
            // Event listener for saving draft
            this.addEventListener('DbpFormalizeFormSaveDraft', this.handleSaveDraft);
            // Event listener for delete submission
            this.addEventListener(
                'DbpFormalizeFormDeleteSubmission',
                this.handleFormDeleteSubmission,
            );
            // Listen to the event from file source
            this.addEventListener('dbp-file-source-file-selected', this.handleFilesToSubmit);
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('DbpFormalizeFormSubmission', this.handleFormSubmission);
        this.removeEventListener('DbpFormalizeFormSaveDraft', this.handleSaveDraft);
        this.removeEventListener(
            'DbpFormalizeFormDeleteSubmission',
            this.handleFormDeleteSubmission,
        );
        this.removeEventListener('dbp-file-source-file-selected', this.handleFilesToSubmit);
    }

    async update(changedProperties) {
        super.update(changedProperties);

        console.log('changedProperties', changedProperties);

        if (changedProperties.has('data')) {
            console.log('Data changed:', this.data);
            if (Object.keys(this.data).length > 0) {
                await this.processFormData();
            }
            this.setButtonStates();

            // @ts-ignore
            this.updateComplete.then(async () => {
                await this.processConditionalFields();
                // If query parameter 'validate' is set to true, validate required fields
                const urlParams = new URLSearchParams(window.location.search);
                if (this.readOnly === false && urlParams.get('validate') === 'true') {
                    const formElement = this.shadowRoot.querySelector('form');
                    this.isFormValid = await validateRequiredFields(formElement);
                    if (!this.isFormValid) {
                        this.scrollToFirstInvalidField(formElement, true);
                        // Show notification
                        sendNotification({
                            summary: this._i18n.t('errors.warning-title'),
                            body: this._i18n.t('errors.form-validation-warning-notification-body'),
                            type: 'warning',
                            timeout: 5,
                        });
                    }
                }
            });
        }
    }

    async updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('data')) {
            console.log('Data changed:', this.data);
            // Reset observer so it can re-attach if needed
            this._formHeaderObserved = false;
            this.stickyHeaderObserver();
        }
    }

    static get styles() {
        return [
            super.styles,
            // language=css
            css`
                @layer theme, utility, formalize, print;
                @layer theme {
                    ${commonStyles.getGeneralCSS(false)}
                    ${commonStyles.getButtonCSS()}
                    ${commonStyles.getModalDialogCSS()}
                }
                @layer formalize {
                    ${getMediaTransparencyFormCSS()}
                }
            `,
        ];
    }

    async processFormData() {
        try {
            this.currentSubmission = this.data;

            this.submissionId = this.data.identifier;
            this.lastModifiedCreatorId = this.data.lastModifiedById;
            this.formData = JSON.parse(this.data.dataFeedElement);
            this.submissionBinaryState = this.data.submissionState;
            this.submissionGrantedActions = this.data.grantedActions;
            this.selectedTags = this.data.tags;

            // Initialize subcategory items if category is already set
            if (this.formData?.category) {
                this.setSubcategoryItemsByValue(this.formData.category);
            }
            // Attachments
            const submittedFiles = {};
            for (const file of this.data.submittedFiles) {
                if (!submittedFiles[file.fileAttributeName]) {
                    submittedFiles[file.fileAttributeName] = [];
                }
                submittedFiles[file.fileAttributeName].push(file);
            }

            this.fileUploadCounts = {};
            for (const [attachmentType, files] of Object.entries(submittedFiles)) {
                this.fileUploadCounts[attachmentType] = files.length;
                if (attachmentType === 'attachments') {
                    this.submittedFiles = await this.transformApiResponseToFile(files);
                }
            }

            switch (Number(this.submissionBinaryState)) {
                case 1:
                    this.currentState = SUBMISSION_STATES.DRAFT;
                    break;
                case 4:
                    this.currentState = SUBMISSION_STATES.SUBMITTED;
                    break;
                default:
                    this.currentState = null;
                    break;
            }

            if (this.formData) {
                try {
                    const lastModifierDetailsResponse = await this.apiGetUserDetails(
                        this.lastModifiedCreatorId,
                    );
                    if (!lastModifierDetailsResponse.ok) {
                        sendNotification({
                            summary: this._i18n.t('errors.error-title'),
                            body: this._i18n.t('errors.failed-to-get-last-modifier-details', {
                                status: lastModifierDetailsResponse.status,
                            }),
                            type: 'danger',
                            timeout: 0,
                        });
                    } else {
                        const lastModifierDetails = await lastModifierDetailsResponse.json();
                        this.lastModifiedCreatorName = `${lastModifierDetails?.givenName} ${lastModifierDetails?.familyName}`;
                    }
                } catch (e) {
                    console.log(e);
                    sendNotification({
                        summary: this._i18n.t('errors.error-title'),
                        body: this._i18n.t('errors.failed-to-get-last-modifier-details'),
                        type: 'danger',
                        timeout: 0,
                    });
                }
            }
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
        data.formData.identifier = isExistingDraft
            ? this.lastModifiedCreatorId
            : this.auth['user-id'];

        // Clean up empty date fields to avoid JSON Schema validation errors
        const dateFields = ['atFrom', 'to', 'reportingDeadline'];
        dateFields.forEach((field) => {
            if (
                data.formData[field] === '' ||
                data.formData[field] === null ||
                data.formData[field] === undefined
            ) {
                delete data.formData[field];
            }
        });

        const formData = new FormData();

        // Set files to upload as attachments
        if (this.filesToSubmit.size > 0) {
            this.filesToSubmit.forEach((fileToAttach) => {
                formData.append('attachments[]', fileToAttach, fileToAttach.name);
            });
        }

        // Set files to remove from attachments
        if (this.filesToRemove.size > 0) {
            this.filesToRemove.forEach((fileObject, fileIdentifier) => {
                formData.append(`submittedFiles[${fileIdentifier}]`, 'null');
            });
        }

        formData.append('form', '/formalize/forms/' + this.formIdentifier);
        formData.append('dataFeedElement', JSON.stringify(data.formData));
        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.SUBMITTED));

        const method = isExistingDraft ? 'PATCH' : 'POST';
        const options = this._buildRequestOptions(formData, method);
        const url = this._buildSubmissionUrl(isExistingDraft ? this.submissionId : null);

        const filesToSubmitBackup = this.filesToSubmit;
        const filesToRemoveBackup = this.filesToRemove;
        const submittedFilesBackup = this.submittedFiles;

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
                this.currentState = SUBMISSION_STATES.SUBMITTED;
                this.submitted = true;

                // Remove files added to the request
                this.filesToSubmit = new Map();
                this.filesToRemove = new Map();

                // Hide form after successful submission
                this.hideForm = true;
                this.disableLeavePageWarning();

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
            // Restore files if something went wrong
            this.filesToSubmit = filesToSubmitBackup;
            this.filesToRemove = filesToRemoveBackup;
            // Put back files that we did not delete?
            this.submittedFiles = submittedFilesBackup;

            sendNotification({
                summary: this._i18n.t('errors.error-title'),
                body: this._i18n.t('errors.unknown-error-on-form-submission'),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    /**
     * Handle saving draft submission.
     * @param {object} event - The event object containing the form data.
     */
    async handleSaveDraft(event) {
        // Access the data from the event detail
        const data = event.detail;
        // const validationResult = data.validationResult;

        // POST or PATCH
        let isExistingDraft = false;
        if (data.submissionId) {
            isExistingDraft = true;
        }

        // Include unique identifier for person who last modified the form
        data.formData.identifier = isExistingDraft
            ? this.lastModifiedCreatorId
            : this.auth['user-id'];
        const formData = new FormData();

        // Set attachment files to upload
        if (this.filesToSubmit.size > 0) {
            this.filesToSubmit.forEach((fileToAttach) => {
                formData.append('attachments[]', fileToAttach, fileToAttach.name);
            });
        }

        // Set attachment files to remove
        if (this.filesToRemove.size > 0) {
            this.filesToRemove.forEach((fileObject, fileIdentifier) => {
                formData.append(`submittedFiles[${fileIdentifier}]`, 'null');
            });
        }

        formData.append('form', '/formalize/forms/' + this.formIdentifier);
        formData.append('dataFeedElement', JSON.stringify(data.formData));
        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.DRAFT));
        // Add tags
        // const selectedTags = Object.values(this.selectedTags);
        // formData.append('tags', JSON.stringify(selectedTags));

        const method = isExistingDraft ? 'PATCH' : 'POST';
        const options = this._buildRequestOptions(formData, method);
        const url = this._buildSubmissionUrl(isExistingDraft ? this.submissionId : null);

        const filesToSubmitBackup = this.filesToSubmit;
        const filesToRemoveBackup = this.filesToRemove;
        const submittedFilesBackup = this.submittedFiles;

        try {
            const response = await fetch(url, options);
            let responseBody = await response.json();

            if (!response.ok) {
                sendNotification({
                    summary: this._i18n.t('errors.error-title'),
                    body: this._i18n.t('errors.failed-to-save-draft', {
                        status: response.status,
                        detail: responseBody.detail,
                    }),
                    type: 'danger',
                    timeout: 0,
                });
            } else {
                this.data = responseBody;
                this.newSubmissionId = responseBody.identifier;
                this.submissionBinaryState = responseBody.submissionState;
                this.submittedFiles = await this.transformApiResponseToFile(
                    responseBody.submittedFiles,
                );

                // Remove files added to the request
                this.filesToSubmit = new Map();
                this.filesToRemove = new Map();

                // Update URL with the submission ID
                const newSubmissionUrl =
                    getFormRenderUrl(this.formUrlSlug, this.lang) + `/${this.newSubmissionId}`;
                window.history.pushState({}, '', newSubmissionUrl.toString());

                this.disableLeavePageWarning();
                this.redirectToReadonlyForm();

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
            // Restore files if something went wrong
            this.filesToSubmit = filesToSubmitBackup;
            this.filesToRemove = filesToRemoveBackup;
            this.submittedFiles = submittedFilesBackup;
            this.requestUpdate();

            console.error(error);
            sendNotification({
                summary: this._i18n.t('errors.error-title'),
                body: this._i18n.t('errors.unknown-error-on-save-draft'),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    /**
     * Update formData if field value changes
     * @param {CustomEvent} event
     */
    handleChangeEvents(event) {
        // First call parent to handle common cases
        super.handleChangeEvents(event);

        // Handle form-specific actions
        if (event.detail && event.detail.option && event.detail.value) {
            const option = event.detail.option;
            const value = event.detail.value;

            if (option.value === 'download' && value === 'download') {
                this.downloadAllFiles();
                return;
            }
        }
    }

    /**
     * Download all attachments and pdf version of the form as a zip file.
     * @param {object} event
     */
    async downloadAllFiles(event) {
        const attachmentFiles = Array.from(this.submittedFiles.values());

        this._('#file-sink').files = [...attachmentFiles];
    }

    /**
     * Handle deleting submission.
     * @param {object} event - The event object containing the submission id to delete.
     */
    async handleFormDeleteSubmission(event) {
        const data = event.detail;
        const submissionId = data.submissionId;

        if (!submissionId) {
            sendNotification({
                summary: this._i18n.t('errors.error-title'),
                body: this._i18n.t('errors.no-submission-id-provided'),
                type: 'danger',
                timeout: 0,
            });
            return;
        }

        const confirmed = await getDeletionConfirmation(this);
        if (!confirmed) return;

        try {
            const response = await fetch(
                this.entryPointUrl + `/formalize/submissions/${submissionId}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer ' + this.auth.token,
                    },
                },
            );

            if (!response.ok) {
                this.deleteSubmissionError = true;
                sendNotification({
                    summary: this._i18n.t('errors.error-title'),
                    body: this._i18n.t('errors.failed-to-delete-submission-status', {
                        status: response.status,
                    }),
                    type: 'danger',
                    timeout: 0,
                });
            } else {
                this.wasDeleteSubmissionSuccessful = true;
                this.deleteSubmissionError = false;
            }
        } catch (error) {
            console.error(error);
            sendNotification({
                summary: this._i18n.t('errors.error-title'),
                body: this._i18n.t('errors.unknown-error-on-delete-submission'),
                type: 'danger',
                timeout: 0,
            });
        } finally {
            if (this.wasDeleteSubmissionSuccessful) {
                sendNotification({
                    summary: this._i18n.t('success.success-title'),
                    body: this._i18n.t('success.form-submission-deleted-successfully'),
                    type: 'success',
                    timeout: 5,
                });

                const emptyFormUrl = getFormRenderUrl(this.formUrlSlug, this.lang);
                window.history.pushState({}, '', emptyFormUrl.toString());

                this.resetForm(event);
                this.sendSetPropertyEvent('routing-url', `/${this.formUrlSlug}`);
            }
        }
    }

    setSubcategoryItemsByValue(selectedValue) {
        const i18n = this._i18n;
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

    setSubcategoryItems(e) {
        const selectedValue = e.currentTarget.value;
        this.setSubcategoryItemsByValue(selectedValue);
    }

    render() {
        return html`
            ${this.readOnly
                ? html`
                      ${this.renderFormViews()}
                  `
                : html`
                      ${this.renderFormElements()}
                  `}
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
                    'formalize-form': true,
                    'media-transparency-form': true,
                    'readonly-mode': this.readOnly,
                    'edit-mode': !this.readOnly,
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
                    data-condition='["online", "outOfHome"]'
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

                ${this.conditionalFields.category
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
                    data-condition='["facebook", "instagram", "linkedin"]'
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-media-name-label',
                    )}"
                    display-mode="dropdown"
                    .items=${{
                        '': i18n.t('render-form.forms.media-transparency-form.please-select-media'),
                        facebook: 'Facebook',
                        instagram: 'Instagram',
                        linkedin: 'LinkedIn',
                        other: 'Other',
                    }}
                    .customValidator=${(value) => {
                        return value === 'Bitte wählen Sie einen Mediennamen aus.' ||
                            value === 'Please select a media name.'
                            ? [
                                  i18n.t(
                                      'render-form.forms.media-transparency-form.media-name-validation-error',
                                  ),
                              ]
                            : [];
                    }}
                    @change=${(e) => {
                        const selectedValue = e.currentTarget.value;
                        this.otherMediumNameEnabled = false;

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

                ${this.conditionalFields.mediaName
                    ? html`
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
                      `
                    : html`
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
                              .value=${data.otherMediumOwnersName || ''}></dbp-form-string-element>
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
                    .value=${data.campaignTitle || ''}></dbp-form-string-element>

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

                <div class="file-upload-container">
                    <div class="file-upload-title-container">
                        <h4 class="attachments-title">
                            ${i18n.t('render-form.forms.media-transparency-form.attachments-title')}
                        </h4>

                        <span class="file-upload-limit-warning">
                            ${i18n.t(
                                'render-form.download-widget.file-upload-count-limit-warning',
                                {count: this.fileUploadLimits?.allowedFileUploadCount?.attachments},
                            )}
                            ${i18n.t('render-form.download-widget.file-upload-size-limit-warning', {
                                size: this.fileUploadLimits?.fileSizeLimit?.attachments,
                            })}
                        </span>

                        <dbp-translated subscribe="lang">
                            <div slot="de">
                                <p>
                                    Sujetname (kurz!) - keine weiteren Ziffern im Sujetnamen außer
                                    der Durchnummerierung. Siehe folgende Datei:
                                    MT_2025_Sujets_Bezeichnungslogik-all.pdf
                                </p>
                            </div>
                            <div slot="en">
                                <p>
                                    Subject name (short!) – no other numbers in the subject name
                                    except for sequential numbering. See the following file:
                                    MT_2025_Sujets_Bezeichnungslogik-all.pdf
                                </p>
                            </div>
                        </dbp-translated>
                    </div>

                    <div class="uploaded-files">${this.renderAttachedFilesHtml('attachments')}</div>

                    <button
                        class="button is-secondary upload-button upload-button--attachment"
                        .disabled=${this.fileUploadCounts['attachments'] >=
                        this.fileUploadLimits?.allowedFileUploadCount?.attachments}
                        @click="${(event) => {
                            this.openFilePicker(event);
                        }}">
                        <dbp-icon name="upload" aria-hidden="true"></dbp-icon>
                        ${!isNaN(this.fileUploadLimits?.allowedFileUploadCount?.attachments)
                            ? i18n.t('render-form.download-widget.upload-file-button-label', {
                                  count: this.fileUploadLimits?.allowedFileUploadCount?.attachments,
                              })
                            : i18n.t(
                                  'render-form.download-widget.upload-file-button-label-no-limit',
                              )}
                    </button>
                </div>
            </form>

            <dbp-file-source
                id="file-source"
                class="file-source"
                lang="${this.lang}"
                allowed-mime-types="application/pdf,image/jpeg,image/png,image/gif,video/mp4,video/mpeg,
                    video/webm,audio/mpeg,audio/ogg,audio/flac,audio/mp4"
                max-file-size="100000"
                number-of-files="1"
                enabled-targets="local,clipboard,nextcloud"
                subscribe="nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-source>

            <dbp-file-sink
                id="file-sink"
                class="file-sink"
                lang="${this.lang}"
                decompress-zip
                enabled-targets="local,clipboard,nextcloud"
                filename="media-transparency-form-${this.formData?.id || ''}-attachments.zip"
                subscribe="nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-sink>

            ${this.renderResult(this.submitted)}
        `;
    }

    renderFormViews() {
        const i18n = this._i18n;
        const data = this.formData || {};

        console.log(`data`, data);

        return html`
            <form
                id="media-transparency-form"
                aria-labelledby="form-title"
                class="${classMap({
                    hidden: this.hideForm,
                    'formalize-form': true,
                    'media-transparency-form': true,
                    'readonly-mode': this.readOnly,
                    'edit-mode': !this.readOnly,
                })}">
                <div class="form-header">${this.getButtonRowHtml()}</div>

                <h2 class="form-title">
                    ${i18n.t('render-form.forms.media-transparency-form.title')}
                </h2>

                <dbp-form-enum-view
                    subscribe="lang"
                    name="category"
                    data-condition='["online", "outOfHome"]'
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
                    .value=${data.category || ''}></dbp-form-enum-view>

                ${this.conditionalFields.category
                    ? html`
                          <dbp-form-enum-view
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
                              .items=${this.advertisementSubcategoryItems}
                              .value=${data.advertisementSubcategory || ''}></dbp-form-enum-view>
                      `
                    : ''}

                <dbp-form-enum-view
                    subscribe="lang"
                    name="mediaName"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-media-name-label',
                    )}"
                    display-mode="dropdown"
                    .items=${{
                        '': i18n.t('render-form.forms.media-transparency-form.please-select-media'),
                        facebook: 'Facebook',
                        instagram: 'Instagram',
                        linkedin: 'LinkedIn',
                        other: 'Other',
                    }}
                    .value=${data.mediaName || ''}></dbp-form-enum-view>

                ${this.conditionalFields.mediaName
                    ? html`
                          <dbp-form-string-view
                              subscribe="lang"
                              name="mediumOwnersName"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-media-owners-name-label',
                              )}"
                              disabled
                              .value=${data.mediumOwnersName || ''}></dbp-form-string-view>
                      `
                    : html`
                          <dbp-form-string-view
                              subscribe="lang"
                              name="otherMediumName"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-other-medium-name-label',
                              )}"
                              .value=${data.otherMediumName || ''}></dbp-form-string-view>

                          <dbp-form-string-view
                              subscribe="lang"
                              name="otherMediumOwnersName"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-other-medium-owners-name-label',
                              )}"
                              .value=${data.otherMediumOwnersName || ''}></dbp-form-string-view>
                      `}

                <dbp-form-string-view
                    subscribe="lang"
                    name="amountInEuro"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-amount-in-euro-label',
                    )}"
                    .value=${data.amountInEuro || ''}></dbp-form-string-view>

                <dbp-form-string-view
                    subscribe="lang"
                    name="campaignTitle"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-campaign-title-label',
                    )}"
                    .value=${data.campaignTitle || ''}></dbp-form-string-view>

                <!-- Sujet file name -->
                <dbp-form-string-view
                    subscribe="lang"
                    name="sujetFileName"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-sujet-file-name-label',
                    )}"
                    .value=${data.sujetFileName || 'MT_2025_Sujets_Bezeichnungslogik-all.pdf '}
                    disabled></dbp-form-string-view>

                ${this.selectedCategory === 'online'
                    ? html`
                          <!-- Sujet notes -->
                          <dbp-form-string-view
                              subscribe="lang"
                              name="sujetNotes"
                              rows="5"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-sujet-notes-label',
                              )}"
                              .value=${data.sujetNotes || ''}></dbp-form-string-view>
                      `
                    : ''}

                <!-- Notes -->
                <dbp-form-string-view
                    subscribe="lang"
                    name="notes"
                    rows="5"
                    label="${i18n.t('render-form.forms.media-transparency-form.field-notes-label')}"
                    .value=${data.notes || ''}></dbp-form-string-view>

                ${this.selectedCategory === 'online'
                    ? html`
                          <!-- at/from -->
                          <dbp-form-date-view
                              subscribe="lang"
                              name="atFrom"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-at-from-label',
                              )}"
                              .value=${data.atFrom || ''}></dbp-form-date-view>

                          <!-- to -->
                          <dbp-form-date-view
                              subscribe="lang"
                              name="to"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-to-label',
                              )}"
                              .value=${data.to || ''}></dbp-form-date-view>
                      `
                    : ''}

                <!-- SAP order number -->
                <dbp-form-string-view
                    subscribe="lang"
                    name="sapOrderNumber"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-sap-order-number-label',
                    )}"
                    .value=${data.sapOrderNumber || ''}></dbp-form-string-view>

                <!-- Reporting deadline -->
                <dbp-form-date-view
                    subscribe="lang"
                    name="reportingDeadline"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-reporting-deadline-label',
                    )}"
                    .value=${data.reportingDeadline || ''}></dbp-form-date-view>

                <div class="file-upload-container">
                    <h4 class="attachments-title">
                        ${i18n.t('render-form.download-widget.attachments-title')}
                    </h4>

                    <div class="uploaded-files">${this.renderAttachedFilesHtml('attachments')}</div>
                </div>
            </form>

            <dbp-file-sink
                id="file-sink"
                class="file-sink"
                lang="${this.lang}"
                allowed-mime-types="application/pdf,.pdf"
                decompress-zip
                enabled-targets="local,clipboard,nextcloud"
                filename="ethics-commission-form-${this.submissionId || ''}-attachments.zip"
                subscribe="nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-sink>

            <!-- Deletion Confirmation Modal -->
            <dbp-modal
                id="deletion-confirmation-modal--formalize"
                class="modal modal--confirmation"
                modal-id="deletion-confirmation-modal"
                title="${i18n.t('show-submissions.delete-confirmation-title')}"
                subscribe="lang">
                <div slot="content">
                    <p>${i18n.t('show-submissions.delete-confirmation-message')}</p>
                </div>
                <menu slot="footer" class="footer-menu">
                    <dbp-button
                        type="is-secondary"
                        no-spinner-on-click
                        @click="${() => handleDeletionCancel(this)}">
                        ${i18n.t('show-submissions.abort')}
                    </dbp-button>
                    <dbp-button
                        type="is-danger"
                        no-spinner-on-click
                        @click="${() => handleDeletionConfirm(this)}">
                        ${i18n.t('show-submissions.delete')}
                    </dbp-button>
                </menu>
            </dbp-modal>
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
     * Opens the file picker dialog.
     * @param {object} event - Click event
     */
    openFilePicker(event) {
        event.preventDefault();
        const fileSource = this._('dbp-file-source');
        fileSource.setAttribute('dialog-open', '');
    }

    /**
     * Handle files to submit event from file source component.
     * @param {CustomEvent} event - The event object containing the file data.
     */
    handleFilesToSubmit(event) {
        const isValid = this.validateAttachmentFileName(event.detail.file);
        if (isValid) {
            this.filesToSubmit.set(event.detail.file.name, event.detail.file);
            this.requestUpdate();
        }
    }

    validateAttachmentFileName(file, maxUpload) {
        const i18n = this._i18n;
        const fileNamePattern = /^MT_\d{4}_Sujets_[a-zA-Z_-]+\d?\.[a-z]+$/;

        if (!fileNamePattern.test(file.name)) {
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t(
                    'render-form.forms.media-transparency-form.invalid-attachment-filename-error',
                    {
                        filename: file.name,
                    },
                ),
                type: 'danger',
                timeout: 0,
            });
            return false;
        }
        return true;
    }

    /**
     * Renders attached file list with action buttons
     * @param {string} fileGroup - The group of files to render ('attachments' or 'voting')
     * @returns {Array|null} An array of rendered file elements or null if no files are present.
     */
    renderAttachedFilesHtml(fileGroup = 'attachments') {
        const i18n = this._i18n;
        let results = [];

        // Select files based on group
        const submittedFiles = fileGroup === 'attachments' ? this.submittedFiles : '';
        const filesToSubmit = fileGroup === 'attachments' ? this.filesToSubmit : '';
        const filesToRemove = fileGroup === 'attachments' ? this.filesToRemove : '';

        if (submittedFiles.size > 0) {
            const submittedFilesHtml = html`
                <div class="fileblock-container submitted-files">
                    ${Array.from(submittedFiles).map(([identifier, file]) => {
                        return this.addFileBlock(file, identifier, fileGroup);
                    })}
                </div>
            `;
            results.push(submittedFilesHtml);
        }

        if (filesToSubmit.size > 0) {
            const filesToSubmitHtml = html`
                <div class="fileblock-container files-to-upload">
                    <div class="attachment-header">
                        <dbp-icon name="upload"></dbp-icon>
                        <h5>
                            ${i18n.t('render-form.download-widget.attachment-upload-file-text')}
                            <span class="attachment-warning">
                                ${i18n.t(
                                    'render-form.download-widget.attachment-upload-warning-text',
                                )}
                            </span>
                        </h5>
                    </div>
                    ${Array.from(filesToSubmit).map(([identifier, file]) => {
                        return this.addFileBlock(file, identifier, fileGroup);
                    })}
                </div>
            `;
            results.push(filesToSubmitHtml);
        }

        if (filesToRemove.size > 0) {
            const filesToRemoveHtml = html`
                <div class="fileblock-container files-to-remove">
                    <div class="attachment-header">
                        <dbp-icon name="trash"></dbp-icon>
                        <h5>
                            ${i18n.t('render-form.download-widget.attachment-remove-file-text')}
                            <span class="attachment-warning">
                                ${i18n.t(
                                    'render-form.download-widget.attachment-upload-warning-text',
                                )}
                            </span>
                        </h5>
                    </div>
                    ${Array.from(filesToRemove).map(([identifier, file]) => {
                        return this.addFileBlock(file, identifier, fileGroup);
                    })}
                </div>
            `;
            results.push(filesToRemoveHtml);
        }

        return results;
    }

    /**
     * Renders a single file block with action buttons.
     * @param {object} file - The file object
     * @param {string} identifier - Unique identifier for the file
     * @param {string} fileGroup - The group of files ('attachments' or 'voting')
     * @returns {import('lit').TemplateResult} The rendered file block template.
     */
    addFileBlock(file, identifier, fileGroup = 'attachments') {
        return html`
            <div class="file-block">
                <span class="file-info">
                    <strong class="file-name">${file.name}</strong>
                    <span class="additional-data">
                        <span class="file-type">(${file.type})</span>
                        <span class="file-size">${(file.size / 1024).toFixed(2)} KB</span>
                    </span>
                </span>
                <div class="file-action-buttons">
                    <button
                        class="download-file-button button is-secondary"
                        @click=${(e) => {
                            e.preventDefault();
                            this._('#file-sink').files = [file];
                        }}>
                        <dbp-icon name="download"></dbp-icon>
                        ${this._i18n.t('render-form.download-widget.download-attachment')}
                    </button>
                    <button
                        class="delete-file-button button is-secondary"
                        .disabled=${this.filesToRemove.has(identifier) || this.readOnly}
                        @click=${(e) => {
                            e.preventDefault();
                            this.deleteAttachment(identifier, fileGroup);
                        }}>
                        <dbp-icon name="trash"></dbp-icon>
                        ${this._i18n.t('render-form.download-widget.delete-attachment')}
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Handle removing files from the list of attachments.
     * @param {string} fileIdentifier uuid
     * @param {string} fileGroup - The group of files to handle ('attachments' or 'voting')
     */
    deleteAttachment(fileIdentifier, fileGroup = 'attachments') {
        if (fileGroup === 'attachments') {
            // Handle regular attachments
            const fileToRemove = this.submittedFiles.get(fileIdentifier);
            if (fileToRemove) {
                this.filesToRemove.set(fileIdentifier, fileToRemove);
                this.submittedFiles.delete(fileIdentifier);
            }
            this.filesToSubmit.delete(fileIdentifier);
        }

        this.requestUpdate();
    }
}
