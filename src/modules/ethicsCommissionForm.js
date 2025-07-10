import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html, css} from 'lit';
import {classMap} from 'lit-html/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import {Button, Icon, IconButton} from '@dbp-toolkit/common';
import {send} from '@dbp-toolkit/common/notification.js';
import {FileSource, FileSink} from '@dbp-toolkit/file-handling';
import {GrantPermissionDialog} from '@dbp-toolkit/grant-permission-dialog';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {PdfViewer} from '@dbp-toolkit/pdf-viewer';
import {getFormRenderUrl, formatDate, httpGetAsync} from '../utils.js';
import {getEthicsCommissionFormCSS, getEthicsCommissionFormPrintCSS} from '../styles.js';
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
    SUBMISSION_STATES,
    SUBMISSION_STATES_BINARY,
    FORM_PERMISSIONS,
    SUBMISSION_PERMISSIONS,
    isDraftStateEnabled,
    isSubmittedStateEnabled,
    isAcceptedStateEnabled,
} from '../utils.js';
import {
    gatherFormDataFromElement /*, validateRequiredFields*/,
} from '@dbp-toolkit/form-elements/src/utils.js';
import html2pdf from 'html2pdf.js';

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
        this.currentState = null;
        this.submissionBinaryState = SUBMISSION_STATES_BINARY.NONE;
        this.submitted = false;
        this.submissionError = false;
        this.scrollTimeout = null;

        this.submitterName = null;
        this.newSubmissionId = null;
        this.resourceActions = [];

        // Button
        this.isViewModeButtonAllowed = false;
        this.isDraftButtonAllowed = false;
        this.isDeleteSubmissionButtonAllowed = false;
        this.isAcceptButtonEnabled = false;
        this.isRevertAcceptButtonEnabled = false;
        this.isSubmitButtonEnabled = false;
        this.isPrintButtonAllowed = false;
        this.isDownloadButtonAllowed = false;
        this.isRetractButtonEnabled = false;

        this.userAllDraftSubmissions = [];
        this.userAllSubmittedSubmissions = [];
        this.userAllAcceptedSubmissions = [];

        this.submittedFiles = new Map();
        this.submittedFilesCount = 0;
        this.filesToSubmit = new Map();
        this.filesToSubmitCount = 0;
        this.filesToRemove = [];
        this.fileUploadError = false;

        this.handleSaveDraft = this.handleSaveDraft.bind(this);
        this.handleFormSubmission = this.handleFormSubmission.bind(this);
        this.handleFormDeleteSubmission = this.handleFormDeleteSubmission.bind(this);
        this.handleFormAcceptSubmission = this.handleFormAcceptSubmission.bind(this);
        this.handleScrollToTopBottom = this.handleScrollToTopBottom.bind(this);
        this.permissionModalClosedHandler = this.permissionModalClosedHandler.bind(this);

        this.humanTestSubjectsQuestionsEnabled = false;
        this.humanStemCellsQuestionsEnabled = false;
        this.stemCellFromHumanEmbryosQuestionsEnabled = false;
        this.cellsObtainedInResearchQuestionsEnabled = false;
        this.harmfulSubstancesOnSubjects = false;
        this.animalQuestionsEnabled = false;
        this.nonEuCountriesQuestionsEnabled = false;
        this.questionResearchFoundsQuestionsEnabled = false;
        this.ethicalIssuesListQuestion = false;
        this.hasConflictOfInterestSubQuestion = false;
        this.hasConfidentialPartSubQuestion = false;
        this.hasConflictInContentControlSubQuestion = false;
        this.stakeholderParticipationPlannedSubQuestion = false;
        this.riskSubQuestion = false;
        this.stemCellFromEmbryosQuestionsEnabled = false;
    }

    static get properties() {
        return {
            ...super.properties,
            submitted: {type: Boolean},
            submissionError: {type: Boolean},

            submittedFilesCount: {type: Number},
            filesToSubmitCount: {type: Number},

            resourceActions: {type: Object},

            // Buttons
            isViewModeButtonAllowed: {type: Boolean},
            isDeleteSubmissionButtonAllowed: {type: Boolean},
            isDraftButtonAllowed: {type: Boolean},
            isAcceptButtonEnabled: {type: Boolean},
            isSubmitButtonEnabled: {type: Boolean},
            isRetractButtonEnabled: {type: Boolean},
            isRevertAcceptButtonEnabled: {type: Boolean},
            isPrintButtonAllowed: {type: Boolean},
            isDownloadButtonAllowed: {type: Boolean},

            humanTestSubjectsQuestionsEnabled: {type: Boolean},
            humanStemCellsQuestionsEnabled: {type: Boolean},
            stemCellFromHumanEmbryosQuestionsEnabled: {type: Boolean},
            cellsObtainedInResearchQuestionsEnabled: {type: Boolean},
            harmfulSubstancesOnSubjects: {type: Boolean},
            animalQuestionsEnabled: {type: Boolean},
            nonEuCountriesQuestionsEnabled: {type: Boolean},
            questionResearchFoundsQuestionsEnabled: {type: Boolean},
            ethicalIssuesListQuestion: {type: Boolean},
            hasConflictOfInterestSubQuestion: {type: Boolean},
            hasConfidentialPartSubQuestion: {type: Boolean},
            hasConflictInContentControlSubQuestion: {type: Boolean},
            stakeholderParticipationPlannedSubQuestion: {type: Boolean},
            riskSubQuestion: {type: Boolean},
            stemCellFromEmbryosQuestionsEnabled: {type: Boolean},
        };
    }

    static get scopedElements() {
        return {
            'dbp-form-string-element': DbpStringElement,
            'dbp-form-date-element': DbpDateElement,
            'dbp-form-boolean-element': DbpBooleanElement,
            'dbp-form-enum-element': DbpEnumElement,
            'dbp-form-string-view': DbpStringView,
            'dbp-form-date-view': DbpDateView,
            'dbp-form-enum-view': DbpEnumView,
            'dbp-file-source': FileSource,
            'dbp-file-sink': FileSink,
            'dbp-pdf-viewer': PdfViewer,
            'dbp-grant-permission-dialog': GrantPermissionDialog,
            'dbp-modal': Modal,
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-icon-button': IconButton,
        };
    }

    async firstUpdated() {}

    async update(changedProperties) {
        // console.log('changedProperties', changedProperties);
        if (changedProperties.has('data')) {
            if (Object.keys(this.data).length > 0) {
                await this.processFormData();
            }

            this.updateComplete.then(async () => {
                await this.processConditionalFields();
            });
        }

        if (changedProperties.has('formProperties')) {
            if (Object.keys(this.formProperties).length > 0) {
                this.allowedActionsWhenSubmitted = this.formProperties.allowedActionsWhenSubmitted;
                this.formGrantedActions = this.formProperties.grantedActions;
                this.setButtonStates();
            }
        }

        if (changedProperties.has('formIdentifier')) {
            if (this.formIdentifier) {
                await this.getUsersGrants();
            }
        }

        if (changedProperties.has('userAllSubmissions')) {
            this.userAllSubmittedSubmissions = this.userAllSubmissions.filter(
                (submission) => submission.submissionState === SUBMISSION_STATES_BINARY.SUBMITTED,
            );
            this.userAllDraftSubmissions = this.userAllSubmissions.filter(
                (submission) => submission.submissionState === SUBMISSION_STATES_BINARY.DRAFT,
            );
            this.userAllAcceptedSubmissions = this.userAllSubmissions.filter(
                (submission) => submission.submissionState === SUBMISSION_STATES_BINARY.ACCEPTED,
            );
            this.setButtonStates();
        }
        super.update(changedProperties);
    }

    /**
     * Sets the button states based on the submission state and user permissions.
     */
    setButtonStates() {
        // No state
        if (this.submissionBinaryState === SUBMISSION_STATES_BINARY.NONE) {
            this.isDraftButtonAllowed = isDraftStateEnabled(this.allowedSubmissionStates);
            this.isSubmitButtonEnabled = isSubmittedStateEnabled(this.allowedSubmissionStates);
        } else {
            // Buttons in all state
            if (this.readOnly) {
                this.isPrintButtonAllowed = true;
                this.isDownloadButtonAllowed = true;
            }
            this.isViewModeButtonAllowed = true;
            this.isDeleteSubmissionButtonAllowed =
                this.formGrantedActions.includes(FORM_PERMISSIONS.MANAGE) ||
                this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.DELETE);
        }

        // DRAFT
        if (this.currentState === SUBMISSION_STATES.DRAFT) {
            if (!this.readOnly) {
                this.isDraftButtonAllowed = true;
                this.isSubmitButtonEnabled = isSubmittedStateEnabled(this.allowedSubmissionStates);
            }
        }

        // SUBMITTED
        if (this.currentState === SUBMISSION_STATES.SUBMITTED) {
            this.isRetractButtonEnabled =
                isSubmittedStateEnabled(this.allowedSubmissionStates) &&
                (this.formGrantedActions.includes(FORM_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.UPDATE));

            this.isAcceptButtonEnabled =
                isAcceptedStateEnabled(this.allowedSubmissionStates) &&
                (this.formGrantedActions.includes(FORM_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.UPDATE));
        }

        // ACCEPTED
        if (this.currentState === SUBMISSION_STATES.ACCEPTED) {
            this.isRevertAcceptButtonEnabled =
                isSubmittedStateEnabled(this.allowedSubmissionStates) &&
                (this.formGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.UPDATE));
            this.isViewModeButtonAllowed = false;
        }
    }

    async processFormData() {
        try {
            this.submissionId = this.data.identifier;
            this.formData = JSON.parse(this.data.dataFeedElement);
            this.submissionBinaryState = this.data.submissionState;
            this.submissionGrantedActions = this.data.grantedActions;
            this.submittedFiles = await this.transformApiResponseToFile(this.data.submittedFiles);
            this.submittedFilesCount = this.submittedFiles.size;

            switch (Number(this.submissionBinaryState)) {
                case 1:
                    this.currentState = SUBMISSION_STATES.DRAFT;
                    break;
                case 4:
                    this.currentState = SUBMISSION_STATES.SUBMITTED;
                    break;
                case 16:
                    this.currentState = SUBMISSION_STATES.ACCEPTED;
                    break;
                default:
                    this.currentState = null;
                    break;
            }

            if (this.formData) {
                try {
                    const submitterDetailsResponse = await this.apiGetUserDetails(
                        this.formData.identifier,
                    );
                    if (!submitterDetailsResponse.ok) {
                        send({
                            summary: 'Error',
                            body: `Failed to get submitter details. Response status: ${submitterDetailsResponse.status}`,
                            type: 'danger',
                            timeout: 5,
                        });
                    } else {
                        const submitterDetails = await submitterDetailsResponse.json();
                        this.submitterName = `${submitterDetails?.givenName} ${submitterDetails?.familyName}`;
                    }
                } catch (e) {
                    console.log(e);
                    send({
                        summary: 'Error',
                        body: `Failed to get submitter details`,
                        type: 'danger',
                        timeout: 5,
                    });
                }
            }
        } catch (e) {
            console.error('Error parsing submission data:', e);
        }
    }

    async getUsersGrants() {
        try {
            // Get user permissions for the form
            const resourceActionsResponse = await this.apiGetResourceActionGrants();
            if (!resourceActionsResponse.ok) {
                send({
                    summary: 'Error',
                    body: `Failed to get permission details. Response status: ${resourceActionsResponse.status}`,
                    type: 'danger',
                    timeout: 5,
                });
            }
            const resourceActionsBody = await resourceActionsResponse.json();
            let resourceActions = [];
            if (resourceActionsBody['hydra:member'].length > 0) {
                for (const resourceAction of resourceActionsBody['hydra:member']) {
                    // Only process user grant, skip group permissions
                    if (resourceAction.userIdentifier) {
                        const userDetailsResponse = await this.apiGetUserDetails(
                            resourceAction.userIdentifier,
                        );
                        if (!userDetailsResponse.ok) {
                            send({
                                summary: 'Error',
                                body: `Failed to get submitter details. Response status: ${userDetailsResponse.status}`,
                                type: 'danger',
                                timeout: 5,
                            });
                        }
                        const userDetails = await userDetailsResponse.json();
                        const userFullName = `${userDetails.givenName} ${userDetails.familyName}`;

                        // Group permissions by user id
                        let userEntry = resourceActions.find(
                            (entry) => entry.userId === resourceAction.userIdentifier,
                        );
                        if (!userEntry) {
                            userEntry = {
                                userId: resourceAction.userIdentifier,
                                userName: userFullName,
                                actions: [],
                            };
                            resourceActions.push(userEntry);
                        }
                        userEntry.actions.push(resourceAction.action);
                    }
                }
                this.resourceActions = resourceActions;
            }
        } catch (e) {
            console.log(e);
            send({
                summary: 'Error',
                body: `Failed to process user permissions`,
                type: 'danger',
                timeout: 5,
            });
        }
    }

    /**
     * Handle conditional fields initialization.
     */
    async processConditionalFields() {
        const conditionalFields = this._a('.conditional-field');
        const conditionalFieldsCount = conditionalFields.length;

        conditionalFields.forEach((field) => {
            const value = field.value;
            if (!value) return;

            if (field.dataset.targetVariable) {
                const targetVariable = field.dataset.targetVariable;
                const condition = field.dataset.condition || 'yes';
                if (this[targetVariable] !== undefined) {
                    this[targetVariable] = value === condition;
                }
            }
        });

        await this.updateComplete;

        // Run again to handle conditional fields inside other conditional fields
        const newConditionalFieldsCount = this._a('.conditional-field').length;
        if (newConditionalFieldsCount > conditionalFieldsCount) {
            this.processConditionalFields();
        }
    }

    static get styles() {
        // language=css
        return css`
            @layer theme, utility, formalize;
            @layer theme {
                ${commonStyles.getGeneralCSS(false)}
                ${commonStyles.getButtonCSS()}
                ${commonStyles.getModalDialogCSS()}
            }
            @layer formalize {
                ${getEthicsCommissionFormCSS()}
            }
        `;
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
     * Renders attached file list with action buttons
     * @returns {Array|null} An array of rendered file elements or null if no files are present.
     */
    renderAttachedFilesHtml() {
        if (this.submittedFiles.size === 0 && this.filesToSubmit.size === 0) {
            return null;
        }

        let results = [];

        const allAttachments = new Map([...this.submittedFiles, ...this.filesToSubmit]);

        allAttachments.forEach((file, identifier) => {
            results.push(html`
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
                            class="view-file-button button is-secondary"
                            @click=${(e) => {
                                e.preventDefault();
                                // Open modal
                                this._('#pdf-view-modal').open();
                                // Open PDF viewer
                                this._('dbp-pdf-viewer').showPDF(file);
                            }}>
                            <dbp-icon name="eye"></dbp-icon>
                            ${this._i18n.t(
                                'render-form.forms.ethics-commission-form.view-attachment',
                            )}
                        </button>
                        <button
                            class="download-file-button button is-secondary"
                            @click=${(e) => {
                                e.preventDefault();
                                this._('#file-sink').files = [file];
                            }}>
                            <dbp-icon name="download"></dbp-icon>
                            ${this._i18n.t(
                                'render-form.forms.ethics-commission-form.download-attachment',
                            )}
                        </button>
                        <button
                            class="delete-file-button button is-secondary"
                            .disabled=${this.currentState === SUBMISSION_STATES.ACCEPTED}
                            @click=${(e) => {
                                e.preventDefault();
                                this.deleteAttachment(identifier);
                            }}>
                            <dbp-icon name="trash"></dbp-icon>
                            ${this._i18n.t(
                                'render-form.forms.ethics-commission-form.delete-attachment',
                            )}
                        </button>
                    </div>
                </div>
            `);
        });

        return results;
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Handle scroller icon changes
            window.addEventListener('scroll', this.handleScrollToTopBottom);

            // Listen to the event from file source
            this.addEventListener('dbp-file-source-file-selected', (event) => {
                this.filesToSubmit.set(event.detail.file.name, event.detail.file);
                this.filesToSubmitCount = this.filesToSubmit.size;
            });

            this.addEventListener('dbp-modal-closed', this.permissionModalClosedHandler);

            // Event listener for saving draft
            this.addEventListener('DbpFormalizeFormSaveDraft', this.handleSaveDraft);

            // Event listener for form submission
            this.addEventListener('DbpFormalizeFormSubmission', this.handleFormSubmission);

            // Event listener for delete submission
            this.addEventListener(
                'DbpFormalizeFormDeleteSubmission',
                this.handleFormDeleteSubmission,
            );
            // Event listener for accepting submission
            this.addEventListener(
                'DbpFormalizeFormRetractSubmission',
                this.handleFormRetractSubmission,
            );

            // Event listener for accepting submission
            this.addEventListener(
                'DbpFormalizeFormAcceptSubmission',
                this.handleFormAcceptSubmission,
            );
            // Event listener for reverting accepted submission
            this.addEventListener(
                'DbpFormalizeFormRevertAcceptedSubmission',
                this.handleFormRevertAcceptSubmission,
            );
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('DbpFormalizeFormSaveDraft', this.handleSaveDraft);
        this.removeEventListener('DbpFormalizeFormSubmission', this.handleFormSubmission);
        this.removeEventListener(
            'DbpFormalizeFormDeleteSubmission',
            this.handleFormDeleteSubmission,
        );
        this.removeEventListener(
            'DbpFormalizeFormAcceptSubmission',
            this.handleFormAcceptSubmission,
        );
        this.removeEventListener(
            'DbpFormalizeFormRevertAcceptedSubmission',
            this.handleFormRevertAcceptSubmission,
        );
        this.removeEventListener('dbp-modal-closed', this.permissionModalClosedHandler);
        window.removeEventListener('scroll', this.handleScrollToTopBottom);
    }

    permissionModalClosedHandler(event) {
        if (event.detail.id && event.detail.id === 'grant-permission-modal') {
            this.getUsersGrants();
        }
    }

    handleScrollToTopBottom() {
        const i18n = this._i18n;
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            // Update scroller icon based on scroll position
            const html = document.documentElement;
            const form = this._('#ethics-commission-form');
            const icon = this._('#form-scroller dbp-icon');
            if (!icon) {
                return;
            }
            const screenReaderText = this._('#form-scroller .visually-hidden');
            if (html.scrollTop < form.scrollHeight / 2) {
                icon.setAttribute('name', 'chevron-down');
                icon.setAttribute(
                    'title',
                    i18n.t('render-form.forms.ethics-commission-form.scroll-to-bottom-text'),
                );
                screenReaderText.textContent = i18n.t(
                    'render-form.forms.ethics-commission-form.scroll-to-bottom-text',
                );
            } else {
                icon.setAttribute('name', 'chevron-up');
                icon.setAttribute(
                    'title',
                    i18n.t('render-form.forms.ethics-commission-form.scroll-to-top-text'),
                );
                screenReaderText.textContent = i18n.t(
                    'render-form.forms.ethics-commission-form.scroll-to-top-text',
                );
            }
        }, 150);
    }

    /**
     * Handle saving draft submission.
     * @param {object} event - The event object containing the form data.
     */
    async handleSaveDraft(event) {
        // Access the data from the event detail
        const data = event.detail;
        // Include unique identifier for person who is submitting
        data.formData.identifier = this.auth['user-id'];
        const formData = new FormData();

        // Upload attached files
        if (this.filesToSubmitCount > 0) {
            this.filesToSubmit.forEach((fileToAttach) => {
                formData.append('file[]', fileToAttach, fileToAttach.name);
            });
            // Remove files added to the request
            this.filesToSubmit = new Map();
        }

        // Set file to be removed
        if (this.filesToRemove.length > 0) {
            this.filesToRemove.forEach((file) => {
                formData.append(`submittedFiles[${file.fileIdentifier}]`, 'null');
            });
            // Remove files added to the request
            this.filesToRemove = [];
        }

        formData.append('form', '/formalize/forms/' + this.formIdentifier);
        formData.append('dataFeedElement', JSON.stringify(data.formData));
        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.DRAFT));

        // POST or PATCH
        const isExistingDraft = this.userAllDraftSubmissions?.find(
            (item) => item.identifier === this.submissionId,
        );

        const method = isExistingDraft ? 'PATCH' : 'POST';
        const options = this._buildRequestOptions(formData, method);
        const url = this._buildSubmissionUrl(isExistingDraft ? this.submissionId : null);

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                send({
                    summary: 'Error',
                    body: `Failed to save form DRAFT. Response status: ${response.status}`,
                    type: 'danger',
                    timeout: 5,
                });
            } else {
                let responseBody = await response.json();
                this.data = responseBody;
                this.newSubmissionId = responseBody.identifier;
                this.submissionBinaryState = responseBody.submissionState;

                // Add new submission to the list
                this.userAllDraftSubmissions.push(responseBody);
                this.userAllSubmissions.push(responseBody);

                // Update URL with the submission ID
                const newSubmissionUrl =
                    getFormRenderUrl(this.formUrlSlug) + `/${this.newSubmissionId}`;
                window.history.pushState({}, '', newSubmissionUrl.toString());
                send({
                    summary: 'Success',
                    body: 'Draft saved successfully',
                    type: 'success',
                    timeout: 5,
                });
            }
        } catch (error) {
            console.error(error);
            send({
                summary: 'Error',
                body: error.message,
                type: 'danger',
                timeout: 5,
            });
        } finally {
            this.setButtonStates();
        }
    }

    /**
     * Handle saving submission.
     * @param {object} event - The event object containing the form data.
     */
    async handleFormSubmission(event) {
        // Access the data from the event detail
        const data = event.detail;
        // Include unique identifier for person who is submitting
        data.formData.identifier = this.auth['user-id'];

        const formData = new FormData();

        // Set file to be removed
        if (this.filesToRemove.length > 0) {
            this.filesToRemove.forEach((file) => {
                formData.append(`submittedFiles[${file.fileIdentifier}]`, 'null');
            });
        }

        // Upload attached files
        if (this.filesToSubmitCount > 0) {
            this.filesToSubmit.forEach((file) => {
                formData.append('attachments[]', file, file.name);
            });
        }

        formData.append('form', '/formalize/forms/' + this.formIdentifier);
        formData.append('dataFeedElement', JSON.stringify(data.formData));
        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.SUBMITTED));

        // If we have a draft submission, we need to update it
        const isExistingDraft = this.userAllDraftSubmissions?.find(
            (item) => item.identifier === this.submissionId,
        );

        const method = isExistingDraft ? 'PATCH' : 'POST';
        const options = this._buildRequestOptions(formData, method);
        const url = this._buildSubmissionUrl(isExistingDraft ? this.submissionId : null);

        try {
            const response = await fetch(url, options);
            let responseBody = await response.json();
            if (!response.ok) {
                this.submissionError = true;
                send({
                    summary: 'Error',
                    body: `Failed to submit form. Response status: ${response.status}<br>${responseBody.description}`,
                    type: 'danger',
                    timeout: 5,
                });
            } else {
                this.submissionError = false;
                this.currentState = SUBMISSION_STATES.SUBMITTED;
                this.submitted = true;

                // Add new submission to the list
                this.userAllDraftSubmissions.push(responseBody);
                this.userAllSubmissions.push(responseBody);

                // Hide form after successful submission
                this._('#ethics-commission-form').style.display = 'none';
                send({
                    summary: 'Success',
                    body: 'Form submitted successfully',
                    type: 'success',
                    timeout: 5,
                });
            }
        } catch (error) {
            console.error(error.message);
            send({
                summary: 'Error',
                body: error.message,
                type: 'danger',
                timeout: 5,
            });
        }
    }

    /**
     * Handle deleting submission.
     * @param {object} event - The event object containing the submission id to delete.
     */
    async handleFormDeleteSubmission(event) {
        const data = event.detail;
        const submissionId = data.submissionId;

        if (!submissionId) {
            send({
                summary: 'Error',
                body: `No submission id provided`,
                type: 'danger',
                timeout: 5,
            });
            return;
        }

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
                send({
                    summary: 'Error',
                    body: `Failed to delete submission. Response status: ${response.status}`,
                    type: 'danger',
                    timeout: 5,
                });
            } else {
                this.wasDeleteSubmissionSuccessful = true;
                this.deleteSubmissionError = false;
                // Hide form after successful deletion
                this._('#ethics-commission-form').style.display = 'none';
            }
        } catch (error) {
            console.error(error.message);
            send({
                summary: 'Error',
                body: error.message,
                type: 'danger',
                timeout: 5,
            });
        } finally {
            if (this.wasDeleteSubmissionSuccessful) {
                send({
                    summary: 'Success',
                    body: 'Form submission deleted successfully. You will be redirected to the empty form.',
                    type: 'success',
                    timeout: 5,
                });

                // Redirect to submission list page or to the empty form?
                // Wait 5 sec before redirecting to allow user to read the success message?
                setTimeout(() => {
                    const emptyFormUrl = getFormRenderUrl(this.formUrlSlug);
                    window.history.pushState({}, '', emptyFormUrl.toString());
                    // Reload the page to reflect the new submission ID
                    window.location.reload();
                }, 5000);
            }
        }
    }

    async handleFormRetractSubmission(event) {
        if (!event.detail.submissionId) return;

        const formData = new FormData();
        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.DRAFT));

        const options = this._buildRequestOptions(formData, 'PATCH');
        const url = this._buildSubmissionUrl(event.detail.submissionId);

        try {
            const response = await fetch(url, options);
            let responseBody = await response.json();
            if (!response.ok) {
                send({
                    summary: 'Error',
                    body: `Failed to retract form submission. Response status: ${response.status}<br>${responseBody.description}`,
                    type: 'danger',
                    timeout: 5,
                });
            } else {
                this.currentState = SUBMISSION_STATES.DRAFT;
                this.requestUpdate();
                send({
                    summary: 'Success',
                    body: 'Form submission retracted successfully',
                    type: 'success',
                    timeout: 5,
                });
            }
        } catch (error) {
            console.error(error.message);
            send({
                summary: 'Error',
                body: error.message,
                type: 'danger',
                timeout: 5,
            });
        }
    }

    /**
     * Handle accepting submission.
     * @param {object} event - The event object containing the form data.
     */
    async handleFormAcceptSubmission(event) {
        if (!event.detail.submissionId) return;

        const formData = new FormData();
        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.ACCEPTED));

        const options = this._buildRequestOptions(formData, 'PATCH');
        const url = this._buildSubmissionUrl(event.detail.submissionId);

        try {
            const response = await fetch(url, options);
            let responseBody = await response.json();
            if (!response.ok) {
                send({
                    summary: 'Error',
                    body: `Failed to accept form submission. Response status: ${response.status}<br>${responseBody.description}`,
                    type: 'danger',
                    timeout: 5,
                });
            } else {
                this.currentState = SUBMISSION_STATES.ACCEPTED;
                this.requestUpdate();
                send({
                    summary: 'Success',
                    body: 'Form submission accepted successfully',
                    type: 'success',
                    timeout: 5,
                });
            }
        } catch (error) {
            console.error(error.message);
            send({
                summary: 'Error',
                body: error.message,
                type: 'danger',
                timeout: 5,
            });
        }
    }

    async handleFormRevertAcceptSubmission(event) {
        if (!event.detail.submissionId) return;

        const formData = new FormData();
        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.SUBMITTED));

        const options = this._buildRequestOptions(formData, 'PATCH');
        const url = this._buildSubmissionUrl(event.detail.submissionId);

        try {
            const response = await fetch(url, options);
            let responseBody = await response.json();
            if (!response.ok) {
                send({
                    summary: 'Error',
                    body: `Failed to reopen form submission. Response status: ${response.status}<br>${responseBody.description}`,
                    type: 'danger',
                    timeout: 5,
                });
            } else {
                this.currentState = SUBMISSION_STATES.SUBMITTED;
                this.requestUpdate();
                send({
                    summary: 'Success',
                    body: 'Form submission reopened successfully',
                    type: 'success',
                    timeout: 5,
                });
            }
        } catch (error) {
            console.error(error.message);
            send({
                summary: 'Error',
                body: error.message,
                type: 'danger',
                timeout: 5,
            });
        }
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

    /**
     * Handle removing files from the list of attachments.
     * @param {string} fileIdentifier uuid
     */
    deleteAttachment(fileIdentifier) {
        this.filesToRemove.push(fileIdentifier);

        this.filesToSubmit.delete(fileIdentifier);
        this.filesToSubmitCount = this.filesToSubmit.size;

        this.submittedFiles.delete(fileIdentifier);
        this.submittedFilesCount = this.submittedFiles.size;
        this.requestUpdate();
    }

    /**
     * Generates a PDF from the form content.
     */
    async generatePDF(save = true) {
        const form = this._('#ethics-commission-form');

        // Set print style
        form.classList.add('print');

        // this.extractShadowContent(form);
        const restoreElements = this.extractShadowContent(form);

        // window.scrollTo(0, 0);

        const opt = {
            margin: [70, 50], // Don't change vertical margin or lines can break when printing.
            filename: 'Ethical_Review_Application.pdf',
            image: {type: 'jpeg', quality: 0.98},
            html2canvas: {
                scale: 2,
                dpi: 192,
                scrollY: 0, // Scrolls to page top
            },
            jsPDF: {
                unit: 'pt',
                format: 'a4',
                orientation: 'portrait',
            },
            pagebreak: {
                // mode: ['css'],
                // before: [ '.section-title' ],
            },
        };

        try {
            const formPdf = await html2pdf()
                .set(opt)
                .from(form)
                .toPdf()
                .get('pdf')
                .then((pdf) => {
                    // console.log(pdf);
                    var totalPages = pdf.internal.getNumberOfPages();
                    for (let i = 1; i <= totalPages; i++) {
                        pdf.setPage(i);
                        this.addHeader(pdf, i);
                    }
                    return pdf;
                });
            if (save) {
                await formPdf.save(opt.filename);
            } else {
                // Convert pdf to blob and create File object
                const pdfBlob = formPdf.output('blob');
                const pdfOutput = new File([pdfBlob], opt.filename, {type: 'application/pdf'});
                return pdfOutput;
            }
        } finally {
            // Remove print style after PDF is generated or if there's an error
            form.classList.remove('print');
            // Restore original elements
            restoreElements();
            // Force a re-render
            // this.requestUpdate();
        }
    }

    /**
     * Add header and footer to the PDF.
     * @param {object} pdf
     * @param {number} pageNumber
     */
    addHeader(pdf, pageNumber) {
        const MARGIN_INLINE = 50;
        const MARGIN_BLOCK = 25;

        pdf.setFontSize(9);
        pdf.setTextColor(25);

        // Header
        pdf.text('TU Graz', pdf.internal.pageSize.getWidth() - MARGIN_INLINE - 10, MARGIN_BLOCK, {
            align: 'right',
        });
        // Add a TU graz red square to the header
        pdf.setDrawColor(255, 0, 0);
        pdf.setFillColor(255, 0, 0);
        pdf.setLineWidth(1); // Set the line width
        pdf.rect(
            pdf.internal.pageSize.getWidth() - MARGIN_INLINE - 8,
            MARGIN_BLOCK - 8,
            8,
            8,
            'F',
            {align: 'right'},
        );

        pdf.setDrawColor(0, 0, 0);
        pdf.line(
            MARGIN_INLINE,
            MARGIN_BLOCK + 3,
            pdf.internal.pageSize.getWidth() - MARGIN_INLINE,
            MARGIN_BLOCK + 3,
            'S',
        );

        pdf.setFontSize(8);
        pdf.text(
            'Antrag auf Prüfung der ethischen Vertretbarkeit',
            MARGIN_INLINE,
            MARGIN_BLOCK + 12,
            {align: 'left'},
        );

        // Footer
        pdf.text(
            'Ethikkommission TU Graz / Geschäftsstelle',
            pdf.internal.pageSize.getWidth() / 2,
            pdf.internal.pageSize.getHeight() - MARGIN_BLOCK,
            {align: 'center'},
        );

        // Page number
        pdf.text(
            String(pageNumber),
            pdf.internal.pageSize.getWidth() - MARGIN_INLINE,
            pdf.internal.pageSize.getHeight() - MARGIN_BLOCK,
            {align: 'right'},
        );
    }

    /**
     * Replace shadow DOM content with its inner HTML.
     * This is a workaround for the issue with html2pdf.js not being able to handle shadow DOM.
     * @param {HTMLElement} element
     */
    extractShadowContent(element) {
        // Store original elements and their clones
        const shadowElements = [];
        element.querySelectorAll('*').forEach((el) => {
            if (el.tagName.startsWith('DBP-FORM') && el.shadowRoot) {
                const shadowContent = el.shadowRoot.innerHTML;
                const wrapper = document.createElement('div');
                wrapper.innerHTML = shadowContent;

                const slot = el.querySelector('[slot="label"]');
                if (slot) {
                    const slotLabel = slot.textContent;
                    const label = document.createElement('label');
                    label.textContent = slotLabel;
                    const fieldset = wrapper.querySelector('fieldset');
                    fieldset.prepend(label);
                }

                // Store original element and its clone for later restoration
                shadowElements.push({
                    original: el,
                    clone: wrapper,
                });

                // Hide original element and insert clone
                el.style.display = 'none';
                el.insertAdjacentElement('afterend', wrapper);
            }
        });

        // Return function to restore original state
        return function restoreElements() {
            shadowElements.forEach(({original, clone}) => {
                // Remove clone and restore original element
                clone.remove();
                original.style.display = '';
            });
        };
    }

    /**
     * Download all attachments and pdf version of the form as a zip file.
     * @param {object} event
     */
    async downloadAllFiles(event) {
        // Get PDF as File object
        const pdfFile = await this.generatePDF(false);

        /*
        // Streamed version
        const downloadFiles = [];
        downloadFiles.push({
            name: `printedFormPDF/${pdfFile.name}`,
            url: URL.createObjectURL(pdfFile),
        });

        Array.from(this.submittedFiles.values()).forEach((attachment) => {
            downloadFiles.push({
                name: `attachments/${attachment.name}`,
                url: URL.createObjectURL(attachment),
            });
        });

        this._('#file-sink').files = downloadFiles;
        */

        // Not streamed version
        const attachmentFiles = Array.from(this.submittedFiles.values());
        this._('#file-sink').files = [pdfFile, ...attachmentFiles];
    }

    /**
     * Handles scolling up and down the form.
     * @param {object} event - The click event object.
     */
    handleScroller(event) {
        const i18n = this._i18n;
        event.preventDefault();
        const html = document.documentElement;
        const form = this._('#ethics-commission-form');
        const icon = this._('#form-scroller dbp-icon');
        const screenReaderText = this._('#form-scroller .visually-hidden');

        if (html.scrollTop < form.scrollHeight / 2) {
            html.scrollTo({top: form.scrollHeight, behavior: 'smooth'});
            setTimeout(() => {
                icon.setAttribute('name', 'chevron-up');
                icon.setAttribute(
                    'title',
                    i18n.t('render-form.forms.ethics-commission-form.scroll-to-top-text'),
                );
                screenReaderText.textContent = i18n.t(
                    'render-form.forms.ethics-commission-form.scroll-to-top-text',
                );
            }, 1500);
        } else {
            html.scrollTo({top: 0, behavior: 'smooth'});
            setTimeout(() => {
                icon.setAttribute('name', 'chevron-down');
                icon.setAttribute(
                    'title',
                    i18n.t('render-form.forms.ethics-commission-form.scroll-to-bottom-text'),
                );
                screenReaderText.textContent = i18n.t(
                    'render-form.forms.ethics-commission-form.scroll-to-bottom-text',
                );
            }, 1500);
        }
    }

    /**
     * Transforms the API response to a File object.
     * @param {object} apiFileResponse
     * @returns {Promise<Map<any, any>>} A promise that resolves to a map of file identifiers to File objects
     */
    async transformApiResponseToFile(apiFileResponse) {
        if (!apiFileResponse || apiFileResponse.length === 0) {
            return new Map();
        }

        const attachedFiles = new Map();
        try {
            for (const apiFile of apiFileResponse) {
                // Fetch the file content from the download URL
                const options = {
                    method: 'GET',
                    headers: {
                        Authorization: 'Bearer ' + this.auth.token,
                    },
                };
                const response = await fetch(apiFile.downloadUrl, options);
                if (!response.ok) {
                    // this.handleErrorResponse(response);
                    send({
                        summary: this._i18n.t('errors.other-title'),
                        body: this._i18n.t('errors.other-body'),
                        type: 'danger',
                        timeout: 5,
                    });
                } else {
                    const fileBlob = await response.blob();

                    // Create a new File object
                    const attachmentFile = new File([fileBlob], apiFile.fileName, {
                        type: apiFile.mimeType,
                    });
                    attachedFiles.set(apiFile.identifier, attachmentFile);
                }
            }
            return attachedFiles;
        } catch (error) {
            console.error('Error transforming API response to File:', error);
            throw error;
        }
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

    /**
     * Gets user details from API
     * @param {string} userIdentifier
     * @returns {Promise<object>} response
     */
    async apiGetUserDetails(userIdentifier) {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
        };
        return await httpGetAsync(this.entryPointUrl + `/base/people/${userIdentifier}`, options);
    }

    /**
     * Gets the list of Resource Action Grants
     * @returns {Promise<object>} response
     */
    async apiGetResourceActionGrants() {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
        };
        return await httpGetAsync(
            this.entryPointUrl +
                `/authorization/resource-action-grants?resourceClass=DbpRelayFormalizeSubmission&resourceIdentifier=${this.submissionId}&page=1&perPage=9999`,
            options,
        );
    }

    /**
     * Render submission details
     * submission date, submitter, last changed.
     * @returns {import('lit').TemplateResult} The HTML template result
     */
    renderSubmissionDates() {
        const i18n = this._i18n;

        const currentSubmission = this.userAllSubmissions.find(
            (submission) => submission.identifier === this.submissionId,
        );

        const dateCreated = this.newSubmissionId
            ? formatDate(this.data.dateCreated)
            : formatDate(currentSubmission?.dateCreated);

        const dateLastModified = this.newSubmissionId
            ? formatDate(this.data.dateLastModified)
            : formatDate(currentSubmission?.dateLastModified);

        const deadLine = this.newSubmissionId
            ? formatDate(this.data.availabilityEnds)
            : formatDate(currentSubmission?.availabilityEnds);

        return html`
            <div class="submission-dates">
                ${deadLine
                    ? html`
                          <div class="submission-deadline">
                              <span class="label">
                                  ${i18n.t(
                                      'render-form.forms.ethics-commission-form.submission-deadline-label',
                                  )}
                              </span>
                              <span class="value">${deadLine}</span>
                          </div>
                      `
                    : ''}
                ${dateCreated
                    ? html`
                          <div class="submission-date">
                              <span class="label">
                                  ${i18n.t(
                                      'render-form.forms.ethics-commission-form.submission-date-label',
                                  )}
                              </span>
                              <span class="value">${dateCreated}</span>
                          </div>
                      `
                    : ''}
                ${dateLastModified
                    ? html`
                          <div class="last-modified">
                              <span class="label">
                                  ${i18n.t(
                                      'render-form.forms.ethics-commission-form.last-modified-date-label',
                                  )}
                              </span>
                              <span class="value">${dateLastModified}</span>
                          </div>
                      `
                    : ''}
                ${this.submitterName
                    ? html`
                          <div class="submitter">
                              <span class="label">
                                  ${i18n.t(
                                      'render-form.forms.ethics-commission-form.submitter-name-label',
                                  )}
                              </span>
                              <span class="value">${this.submitterName}</span>
                          </div>
                      `
                    : ''}
            </div>
        `;
    }

    /**
     * Render submission details
     * submission date, submitter, last changed.
     * @returns {import('lit').TemplateResult} The HTML template result
     */
    renderSubmissionPermissions() {
        const i18n = this._i18n;
        return html`
            <div class="submission-details">
                <div id="submission-permissions" class="submission-permissions">
                    <div class="permissions-header">
                        <button
                            class="user-permissions-title"
                            .disabled=${this.resourceActions.length === 0}
                            @click="${(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                this._('#submission-permissions').classList.toggle('open');
                            }}">
                            <dbp-icon name="chevron-down" aria-hidden="true"></dbp-icon>
                            ${i18n.t(
                                'render-form.forms.ethics-commission-form.user-permissions-title',
                            )}
                            (${this.resourceActions.length ? this.resourceActions.length : 0})
                        </button>
                        <dbp-button
                            class="edit-permissions"
                            no-spinner-on-click
                            type="is-secondary"
                            @click=${() => this._('#grant-permission-dialog').open()}>
                            <dbp-icon name="lock" aria-hidden="true"></dbp-icon>
                            <span class="button-text">
                                ${i18n.t(
                                    'render-form.forms.ethics-commission-form.edit-permission-button-text',
                                )}
                            </span>
                        </dbp-button>
                    </div>
                    <div class="users-permissions">
                        ${this.resourceActions.map(
                            (userEntry) => html`
                                <div class="user-entry">
                                    <span class="person-name">${userEntry.userName}:</span>
                                    <span class="person-permissions">
                                        ${userEntry.actions.map(
                                            (action) => html`
                                                <span class="person-permission">${action}</span>
                                            `,
                                        )}
                                    </span>
                                </div>
                            `,
                        )}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renders the form in read-only mode.
     * @returns {import('lit').TemplateResult} The HTML for the button row.
     */
    renderFormViews() {
        const i18n = this._i18n;
        const data = this.formData || {};

        return html`

            <style>
                /* Style needs to be inline for html2pdf.js */
                ${getEthicsCommissionFormPrintCSS()}
            </style>

            <form id="ethics-commission-form" aria-labelledby="form-title">

                <div class="scroller-container">
                    <button id="form-scroller" class="scroller" @click=${this.handleScroller}>
                        <dbp-icon name="chevron-down" title=${i18n.t('render-form.forms.ethics-commission-form.scroll-to-bottom-text')}></dbp-icon>
                        <span class="visually-hidden">${i18n.t('render-form.forms.ethics-commission-form.scroll-to-bottom-text')}</span>
                    </button>
                </div>

                ${this.getButtonRowHtml()}

                <div class="form-details">
                    ${this.renderSubmissionPermissions()}
                </div>

                ${this.renderStatusBadge()}

                <h2 class="form-title">${i18n.t('render-form.forms.ethics-commission-form.title')}</h2>

                <div class="type-container">
                    <dbp-form-enum-view
                        subscribe="lang"
                        label="Typ"
                        .items=${{
                            study: i18n.t('render-form.forms.ethics-commission-form.study'),
                            publication: i18n.t(
                                'render-form.forms.ethics-commission-form.publication',
                            ),
                        }}
                        .value=${data.type || ''}>
                    </dbp-form-enum-view>
                </div>

                <article>

                    <h3 class="form-sub-title">${i18n.t('render-form.forms.ethics-commission-form.sub-title')}</h3>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="${i18n.t('render-form.forms.ethics-commission-form.applicant-label')}"
                        value=${data.applicant || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="${i18n.t('render-form.forms.ethics-commission-form.contact-details-label')}"
                        value=${data.contactDetails || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="${i18n.t('render-form.forms.ethics-commission-form.job-position-label')}"
                        value=${data.jobPosition || ''}>
                    </dbp-form-string-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        label="${i18n.t('render-form.forms.ethics-commission-form.fields-of-expertise-label')}"
                        .items=${{
                            'advanced-material-sciences': i18n.t(
                                'render-form.forms.ethics-commission-form.advanced-material-sciences',
                            ),
                            'human-and-biotechnology': i18n.t(
                                'render-form.forms.ethics-commission-form.human-and-biotechnology',
                            ),
                            'information-communication-computing': i18n.t(
                                'render-form.forms.ethics-commission-form.information-communication-computing',
                            ),
                            'mobility-production': i18n.t(
                                'render-form.forms.ethics-commission-form.mobility-production',
                            ),
                            'sustainable-systems': i18n.t(
                                'render-form.forms.ethics-commission-form.sustainable-systems',
                            ),
                            keinem: i18n.t('render-form.forms.ethics-commission-form.keinem'),
                        }}
                        .value=${data.fieldsOfExpertise || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        label="${i18n.t('render-form.forms.ethics-commission-form.qualification-work-label')}"
                        .items=${{
                            no: i18n.t('render-form.forms.ethics-commission-form.no-label'),
                            bachelor: i18n.t(
                                'render-form.forms.ethics-commission-form.bachelor-label',
                            ),
                            master: i18n.t('render-form.forms.ethics-commission-form.master-label'),
                            doctorat: i18n.t(
                                'render-form.forms.ethics-commission-form.doctorat-label',
                            ),
                            'no-publication': i18n.t(
                                'render-form.forms.ethics-commission-form.no-publication-label',
                            ),
                            'one-publication': i18n.t(
                                'render-form.forms.ethics-commission-form.one-publication-label',
                            ),
                        }}
                        .value=${data.qualificationWork || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-date-view
                        subscribe="lang"
                        label="${i18n.t('render-form.forms.ethics-commission-form.date-of-transmission-label')}"
                        value=${data.dateOfTransmission || ''}>
                    </dbp-form-date-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="${i18n.t('render-form.forms.ethics-commission-form.specification-office-label')}"
                        value=${data.specificationOffice || ''}>
                    </dbp-form-string-view>

                    <dbp-form-date-view
                        subscribe="lang"
                        label="${i18n.t('render-form.forms.ethics-commission-form.data-protection-date-label')}"
                        value=${data.dataProtectionDate || ''}>
                    </dbp-form-date-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="${i18n.t('render-form.forms.ethics-commission-form.specification-office-label')}"
                        value=${data.dataProtectionSpecificationOffice || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="${i18n.t('render-form.forms.ethics-commission-form.specification-office-label')}"
                        value=${data.dataProtectionEthicsRelevance || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="Kurzbeschreibung/Zusammenfassung"
                        value=${data.shortDescription || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="Datenquelle"
                        value=${data.dataSource || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="Wenn Menschen als Proband*innen mitwirken: (Geplante) Anzahl der Proband*innen"
                        value=${data.numberOfTestPersons || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="Akquise der Proband*innen"
                        value=${data.acquisitionOfTestSubjects || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="Welche Aufwandsentschädigung erhalten die Proband*innen?"
                        value=${data.volunteersCompensation || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="Erhalten die Proband*innen auch bei vorzeitigem Abbruch der Teilnahme eine angemessene Entschädigung?"
                        value=${data.volunteersCompensationEarlyEnd || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="Gibt es Ein- und Ausschlusskriterien für eine Teilnahme als Proband*in in Ihrer Studie? Wenn ja, welche sind dies? "
                        value=${data.participationCriteria || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="Liegen Befangenheiten oder Abhängigkeiten im Rahmen Ihrer Studie vor (siehe auch 1.1.5. des Kriterienkatalogs)?
    Personen können nicht als Proband*innen in Ihrer Studie mitwirken, wenn sie in einer studienrechtlichen oder arbeitsrechtlichen Abhängigkeit zu Ihnen als Studienleitung stehen (z.B.: Mitarbeitende des gleichen Instituts als Proband*innen)."
                        value=${data.subjectsDependencies || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="Finanzierung"
                        value=${data.founding || ''}>
                    </dbp-form-string-view>

                    <dbp-form-date-view
                        subscribe="lang"
                        label="Geplanter Start und Zeitraum des Forschungsvorhabens"
                        value=${data.projectStartDate || ''}
                        >
                    </dbp-form-date-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="Des Zeitraums zur Durchführung Ihrer Studie"
                        value=${data.projectTimePeriod || ''}>
                    </dbp-form-string-view>
                </article>

                <article>

                    <h3 class="section-title">1. Beschreibung des Forschungsvorhabens (max. 2 Seiten)</h3>

                    <div class="description">
                        <p>Beschreibung der Zielsetzung und des wissenschaftlichen Hintergrundes Ihres Forschungsvorhabens (mit Angabe der relevanten Literatur).</p>
                        <p>Darlegung des Studienablaufs und Erläuterung der eingesetzten Methoden und Rolle bzw. Aufgaben der involvierten Proband*innen.</p>
                        <p>Beschreibung der eingesetzten Geräte/Apparaturen samt Marke und Hersteller.</p>
                        <p>Nutzen-Risiko-Erwägungen: Welche Risiken (Unannehmlichkeiten, Gefahren, Belastungen) bestehen für die Proband*innen im Verhältnis zum Nutzen der Ergebnisse des Forschungsvorhabens?</p>
                    </div>

                    <dbp-form-string-view
                        subscribe="lang"
                        label="Beschreibung des Forschungsvorhabens"
                        value=${data.researchProjectDescription || ''}>
                    </dbp-form-string-view>
                </article>

                <article>
                    <h3 class="section-title">2. Informed Consent / Informierte Einwilligung</h3>

                    <div class="description">
                        <p>Die Proband*innen sollen von der Studienleitung über folgende Punkte informiert werden (beispielsweise durch eine Proband*innen-Information und Einwilligungserklärung zur Teilnahme am Forschungsvorhaben):</p>
                        <ol>
                            <li><p>Genaue Angabe von Titel, Zweck und Dauer Ihres Forschungsvorhabens sowie Erklärung des Ablaufs für die Proband*innen in einfacher und klarer Sprache (bitte vermeiden Sie nach Möglichkeit Fremdwörter)</p></li>
                            <li><p>Angaben zur durchführenden Forschungseinrichtung und zu einer verantwortlichen Kontaktperson (Vor- und Nachname, E-Mail-Adresse und evtl. Telefonnummer) für weitere Fragen, Anregungen oder Beschwerden</p></li>
                            <li><p>Angabe möglicher Risiken für die Proband*innen (Unannehmlichkeiten, Gefahren, Belastungen) und etwaiger Folgen</p></li>
                            <li><p>Angaben über die Höhe der Aufwandsentschädigung (auch im Falle eines vorzeitigen Abbruchs) sowie eines sonstigen Nutzens für die Proband*innen</p></li>
                            <li><p>Hinweis auf die Freiwilligkeit der Teilnahme inklusive des Rechts, die Einwilligung jederzeit ohne Angabe von Gründen widerrufen und die Teilnahme vorzeitig abbrechen zu können, ohne dass den Proband*innen dadurch ein Nachteil entsteht</p></li>
                            <li><p>Hinweis auf die erfolgte Behandlung durch die Ethikkommission</p></li>
                            <li><p>Hinweis auf die Richtlinie für Hinweisgeber und den elektronischen Briefkasten für anonyme Hinweise an der TU Graz (Whistleblowing)<sup>2</sup></p></li>
                            <li><p>Einwilligungserklärung der Proband*innen (bzw. von deren gesetzlichen Vertreter*innen) zur Teilnahme an der Studie</p></li>
                        </ol>
                        <p>[2] Elektronischer Briefkasten für anonyme Hinweise (Whistleblowing), <a href="https://www.tugraz.at/ueber-diese-seite/elektronischer-briefkasten-fuer-anonyme-hinweise-whistleblowing">whistleblowing</a> (abgerufen 15.07.2024).</p>
                    </div>
                </article>

                <article>
                    <h3 class="section-title">3. Kriterienkatalog / Self-Assessment</h3>

                    <div class="description">
                        <p>Bitte füllen Sie den folgenden Kriterienkatalog gewissenhaft aus. Geben Sie an, welche Kriterien auf Ihr Forschungsvorhaben zutreffen und welche nicht. <sup>3</sup> </p>
                        [3] Angelehnt an den Kriterienkatalog der Europäischen Kommission im Zusammenhang von EU-Grants/Horizon Europe aus dem Jahr 2021.
                    </div>

                    <h4 class="section-sub-title">1. Menschen</h4>

                    <dbp-form-enum-view
                        class="conditional-field"
                        data-target-variable="humanTestSubjectsQuestionsEnabled"
                        data-condition="yes"
                        subscribe="lang"
                        label="Nehmen Menschen am Forschungsvorhaben als Proband*innen teil?"
                        description="(z.B.: durch Interviews; über per Ton und/oder Video aufgezeichnete Beobachtungen; bei Technologie-/Prototypentestungen)"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.testSubjects || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.humanTestSubjectsQuestionsEnabled
                            ? html`
                                  <div
                                      class="question-group ${classMap({
                                          'fade-in': this.humanTestSubjectsQuestionsEnabled,
                                      })}">
                                      <h4 class="question-group-title">
                                          1.1. Menschen als Proband*innen im Forschungsvorhaben
                                      </h4>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="1.1.1. Nehmen die Proband*innen freiwillig an der Studie teil?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsVoluntary ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="1.1.2. Wurden die Proband*innen über die an ihnen durchgeführte Studie im Vorfeld umfassend, in einfacher und verständlicher Sprache informiert (informed consent)?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsInformedConsent ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="1.1.3. Wird sichergestellt, dass die Teilnahme ausschließlich nach Unterfertigung der informierten Einwilligung durch die Proband*innen und/oder ihrer gesetzlichen Vertreter*innen erfolgt?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsConsentSigned ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="1.1.4. Besteht die Möglichkeit, von der Teilnahme ohne persönliche negative Auswirkungen zurückzutreten?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsWithdrawPossible ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="1.1.5. Nehmen Personen, die in studienrechtlicher und/oder arbeitsrechtlicher Abhängigkeit zur Studienleitung stehen (z.B.: Mitarbeitende des gleichen Instituts) als Proband*innen an der Studie teil?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsDependent ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="1.1.6. Sind andere potentiell vulnerable Personen involviert (Kinder, nicht einwilligungsfähige Personen, Opfer von Missbrauch oder Gewalt etc.)?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsVulnerable ||
                                          ''}></dbp-form-enum-view>
                                  </div>

                                  <div class="question-group">
                                      <h4 class="question-group-title">
                                          1.2. Physische oder psychische Eingriffe an Proband*innen
                                      </h4>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="1.2.1. Werden invasive Techniken angewandt (z.B.: zur Sammlung von menschlichem Gewebe, Biopsien, Einwirkungen auf das Gehirn, etc.)?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.invasiveTechniquesUsed ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="1.2.2. Führt die Teilnahme an der Studie bei den Proband*innen zu mindestens einer der folgenden Konsequenzen wie z.B. dem Erleben von Erniedrigung, Scham, Folter, Schmerzen, psychischem Druck, oder überdurchschnittlichem Stress?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsTortured ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="1.2.3. Könnten Proband*innen zu Schaden kommen bzw. gibt es mögliche Risiken oder etwaige Folgeerscheinungen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsHarmed ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="1.2.4. Wurden alle Schritte unternommen, um die Risiken zu minimieren?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsRiskMinimized ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="1.2.5. Rechtfertigt der Nutzen der Studie die Risiken für die Proband*innen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsRisksJustified ||
                                          ''}></dbp-form-enum-view>
                                  </div>

                                  <div class="question-group">
                                      <h4 class="question-group-title">
                                          1.3. Zumutbarkeit des Forschungsvorhabens
                                      </h4>
                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="1.3.1 Ist den Proband*innen die Teilnahme an der Studie im Gesamten zumutbar?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsReasonableToParticipate ||
                                          ''}></dbp-form-enum-view>
                                  </div>
                              `
                            : ''
                    }

                    <dbp-form-enum-view
                        subscribe="lang"
                        label="1.4. Werden im Zuge des Forschungsvorhabens tote Körper/Leichen eingesetzt?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.deadBodies || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        label="1.4.1. Liegen entsprechende Rechtsgrundlagen/Dokumente vor?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.legalDocumentsAvailable || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        label="1.4.2. Kann eine Störung der Totenruhe ausgeschlossen werden?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.disturbanceOfPeaceOfDead || ''}>
                    </dbp-form-enum-view>
                </article>

                <article>
                    <h3 class="section-sub-title">2. Menschliche Stammzellen, Embryos bzw. Föten</h3>

                    <dbp-form-enum-view
                        class="conditional-field"
                        data-target-variable="humanStemCellsQuestionsEnabled"
                        data-condition="yes"
                        subscribe="lang"
                        label="Bezieht sich das Forschungsvorhaben auf die Verwendung von menschlichen Stammzellen oder menschlichem Gewebe?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.humanStemCells || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.humanStemCellsQuestionsEnabled
                            ? html`
                                  <div
                                      class="question-group ${classMap({
                                          'fade-in': this.humanStemCellsQuestionsEnabled,
                                      })}">
                                      <h4 class="question-group-title">
                                          2.1. Art des Forschungsmaterials
                                      </h4>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="2.1.1. Beinhaltet das Forschungsvorhaben die Verwendung von menschlichem Gewebe?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.humanTissueUsed || ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          class="conditional-field"
                                          data-target-variable="stemCellFromEmbryosQuestionsEnabled"
                                          data-condition="yes"
                                          subscribe="lang"
                                          label="2.1.2. Beinhaltet das Forschungsvorhaben die Verwendung von menschlichen Stammzellen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.humanStemCellsUsed ||
                                          ''}></dbp-form-enum-view>

                                      ${this.stemCellFromEmbryosQuestionsEnabled
                                          ? html`
                                                <dbp-form-enum-view
                                                    class="${classMap({
                                                        'fade-in':
                                                            this
                                                                .stemCellFromEmbryosQuestionsEnabled,
                                                    })}"
                                                    subscribe="lang"
                                                    label="2.1.2.1.	Werden die Stammzellen direkt aus Embryos gewonnen?"
                                                    .items=${{
                                                        yes: 'Ja',
                                                        no: 'Nein',
                                                    }}
                                                    .value=${data.stemCellsFromEmbryos ||
                                                    ''}></dbp-form-enum-view>
                                            `
                                          : ''}

                                      <dbp-form-enum-view
                                          class="conditional-field"
                                          data-target-variable="stemCellFromHumanEmbryosQuestionsEnabled"
                                          data-condition="yes"
                                          subscribe="lang"
                                          label="2.1.3. Beinhaltet das Forschungsvorhaben die Verwendung von menschlichen Embryos oder Föten?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.useOfHumanEmbryos ||
                                          ''}></dbp-form-enum-view>

                                      ${this.stemCellFromHumanEmbryosQuestionsEnabled
                                          ? html`
                                                <dbp-form-enum-view
                                                    class="${classMap({
                                                        'fade-in':
                                                            this
                                                                .stemCellFromHumanEmbryosQuestionsEnabled,
                                                    })}"
                                                    subscribe="lang"
                                                    label="2.1.3.1. Werden diese im Zuge der Forschung zerstört?"
                                                    .items=${{
                                                        yes: 'Ja',
                                                        no: 'Nein',
                                                    }}
                                                    .value=${data.stemCellsFromEmbryosDestroyed ||
                                                    ''}></dbp-form-enum-view>
                                            `
                                          : ''}
                                  </div>

                                  <div class="question-group">
                                      <h4 class="question-group-title">
                                          2.2. Herkunft des Forschungsmaterials
                                      </h4>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="2.2.1. Sind die im Forschungsvorhaben verwendeten Zellen (bzw. ist das menschliche Gewebe) kommerziell verfügbar?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.commerciallyAvailableCells ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          class="conditional-field"
                                          data-target-variable="cellsObtainedInResearchQuestionsEnabled"
                                          data-condition="no"
                                          subscribe="lang"
                                          label="2.2.2. Werden die im Forschungsvorhaben verwendeten Zellen (bzw. das menschliche Gewebe) im Zuge des Forschungsvorhabens gewonnen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.cellsObtainedInResearch ||
                                          ''}></dbp-form-enum-view>

                                      ${!this.cellsObtainedInResearchQuestionsEnabled
                                          ? html`
                                                <dbp-form-string-view
                                                    class="${classMap({
                                                        'fade-in':
                                                            this
                                                                .cellsObtainedInResearchQuestionsEnabled,
                                                    })}"
                                                    subscribe="lang"
                                                    label="2.2.2.1.	Woher stammt das im Forschungsvorhaben verwendete Gewebe bzw. die Stammzellen?"
                                                    value=${data.tissueOrCellsSource ||
                                                    ''}></dbp-form-string-view>
                                            `
                                          : ''}
                                  </div>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">3. Tiere</h3>

                    <dbp-form-enum-view
                        class="conditional-field"
                        data-target-variable="animalQuestionsEnabled"
                        data-condition="yes"
                        subscribe="lang"
                        label="Werden im Zuge des Forschungsvorhabens Tiere herangezogen?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.animalsInvolved || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.animalQuestionsEnabled
                            ? html`
                                  <div
                                      class="question-group ${classMap({
                                          'fade-in': this.animalQuestionsEnabled,
                                      })}">
                                      <h4 class="question-group-title">
                                          3.1. Tiere im Forschungsvorhaben
                                      </h4>
                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="3.1.1.	Handelt es sich dabei um Wirbeltiere?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.isAnimalVertebrate ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="3.1.2.	Handelt es sich dabei um nicht-menschliche Primaten (Affen, Schimpansen, Gorillas etc.)?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.nonHumanPrimates ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="3.1.3. Sind diese Tiere genetisch verändert?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.geneticallyModifiedAnimals ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="3.1.4. Gehören diese Tiere einer bedrohten Tierart an?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.endangeredSpecies ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="3.1.5. Gibt es Alternativen zur Verwendung von Versuchstieren?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.alternativesToUseLaboratoryAnimals ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="3.1.6. Könnten Versuchstiere im Zuge des Forschungsvorhabens zu Schaden kommen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.laboratoryAnimalsHarmed ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="3.1.7. Rechtfertigt der Nutzen der Studie die Risiken für die Versuchstiere?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.isRiskJustified || ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="3.1.8. Liegen entsprechende Rechtsgrundlagen/Dokumente vor?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.relevantLegalDocumentAvailable ||
                                          ''}></dbp-form-enum-view>
                                  </div>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">4. Nicht-EU-Staaten / Drittstaaten</h3>
                    <dbp-form-enum-view
                        class="conditional-field"
                        data-target-variable="nonEuCountriesQuestionsEnabled"
                        data-condition="yes"
                        subscribe="lang"
                        label="Wird ein Teil des Forschungsvorhabens außerhalb der EU/in Drittstaaten durchgeführt?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.nonEuCountries || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.nonEuCountriesQuestionsEnabled
                            ? html`
                                  <div
                                      class="question-group ${classMap({
                                          'fade-in': this.nonEuCountriesQuestionsEnabled,
                                      })}">
                                      <h4 class="question-group-title">
                                          4.1. Forschungsvorhaben außerhalb der EU bzw. in
                                          Drittstaaten
                                      </h4>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="4.1.1. Berühren die in Drittstaaten ausgeführten Aktivitäten potentiell ethische Themen entweder aus EU-Sicht oder aus Sicht des Drittstaats?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.ethicalIssues || ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          class="conditional-field"
                                          data-target-variable="questionResearchFoundsQuestionsEnabled"
                                          data-condition="yes"
                                          subscribe="lang"
                                          label="4.1.2. Ist die Nutzung von lokalen Ressourcen in Drittstaaten geplant?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.thirdCountriesLocalResources ||
                                          ''}></dbp-form-enum-view>

                                      ${this.questionResearchFoundsQuestionsEnabled
                                          ? html`
                                                <dbp-form-enum-view
                                                    class="${classMap({
                                                        'fade-in':
                                                            this
                                                                .questionResearchFoundsQuestionsEnabled,
                                                    })}"
                                                    subscribe="lang"
                                                    label="4.1.2.1.	Ergeben sich dadurch Fragestellungen in Zusammenhang mit der Verteilung von Forschungsmitteln?"
                                                    .items=${{
                                                        yes: 'Ja',
                                                        no: 'Nein',
                                                    }}
                                                    .value=${data.questionResearchFounds ||
                                                    ''}></dbp-form-enum-view>
                                            `
                                          : ''}

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="4.1.3. Ist der Import von Material (außer Daten) aus Drittstaaten in die EU oder in andere Drittstaaten geplant? "
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.importMaterialFromThirdCountries ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="4.1.4. Beinhaltet das Forschungsvorhaben Staaten mit niedrigerem und/oder unterem mittlerem Einkommen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.lowIncomeCountries ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          label="4.1.5. Könnte die Teilnahme am Forschungsvorhaben die Beteiligten aufgrund der Situation in dem entsprechenden Drittstaat bzw. in dem Land außerhalb der EU einem Risiko aussetzen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.exposeParticipantsToRisk ||
                                          ''}></dbp-form-enum-view>
                                  </div>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">5. Nachhaltigkeit, Gesundheit und Sicherheit</h3>

                        <dbp-form-enum-view
                            subscribe="lang"
                            label="5.1. Kommt es zum Einsatz von Stoffen, die für Umwelt, Tiere und/oder Pflanzen schädliche Konsequenzen haben können?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.harmfulSubstances || ''}>
                        </dbp-form-enum-view>

                        <dbp-form-enum-view
                            subscribe="lang"
                            label="5.2. Sind konkrete negative Auswirkungen auf bedrohte Pflanzenarten oder Naturschutzgebiete bzw. der Verlust von Biodiversität zu befürchten?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.negativeImpactsOnNature || ''}>
                        </dbp-form-enum-view>

                        <dbp-form-enum-view
                            class="conditional-field"
                            data-target-variable="harmfulSubstancesOnSubjects"
                            data-condition="yes"
                            subscribe="lang"
                            label="5.3. Kommt es zum Einsatz von Stoffen, die für Proband*innen und/oder Forscher*innen potentiell schädliche Konsequenzen haben können?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.harmfulSubstancesOnSubjects || ''}>
                        </dbp-form-enum-view>

                        ${
                            this.harmfulSubstancesOnSubjects
                                ? html`
                                      <dbp-form-enum-view
                                          class="${classMap({
                                              'fade-in': this.harmfulSubstancesOnSubjects,
                                          })}"
                                          subscribe="lang"
                                          label="5.3.1. Wurden adäquate Sicherheitsmaßnahmen zur Reduktion des Risikos für Proband*innen und Forscher*innen getroffen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.adequateSafetyMeasures ||
                                          ''}></dbp-form-enum-view>
                                  `
                                : ''
                        }

                        <dbp-form-enum-view
                            subscribe="lang"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.complyWithSustainabilityStrategy || ''}>
                                <span slot="label">
                                    5.4. Entspricht Ihr Forschungsvorhaben der <a href='https://www.tugraz.at/tu-graz/universitaet/klimaneutrale-tu-graz/roadmap' target='_blank'>Nachhaltigkeitsstrategie</a> der TU Graz?
                                </span>
                        </dbp-form-enum-view>

                        <dbp-form-string-view
                            subscribe="lang"
                            label="5.5.	Wodurch wird für den angemessenen Umgang mit Ressourcen Sorge getragen?"
                            value=${data.appropriateUseOfResources || ''}>
                        </dbp-form-string-view>

                    </div>
                </article>

                <article>
                    <h3 class="section-sub-title">6. Informationsverarbeitende Systeme (insb. Artificial Intelligence)</h3>

                    <div class="question-group ${classMap({'fade-in': this.nonEuCountriesQuestionsEnabled})}">
                        <h4 class="question-group-title">Im Forschungsprozess werden in aller Regel informationsverarbeitende Systeme verwendet. Bitte beantworten Sie daher die nachfolgenden Fragen.</h4>

                        <dbp-form-enum-view
                            subscribe="lang"
                            label="6.1.	Können die im Forschungsvorhaben eingesetzten informationsverarbeitenden Systeme menschliche Entscheidungsfindungsprozesse beeinflussen, ersetzen oder umgehen?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.replaceHumanDecisionMaking || ''}>
                        </dbp-form-enum-view>

                        <dbp-form-enum-view
                            subscribe="lang"
                            label="6.2.	Können die im Forschungsvorhaben eingesetzten informationsverarbeitenden Systeme Menschen potentiell stigmatisieren oder diskriminieren?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.potentiallyStigmatizePeople || ''}>
                        </dbp-form-enum-view>

                        <dbp-form-enum-view
                            subscribe="lang"
                            label="6.3.	Können die im Forschungsvorhaben eingesetzten informationsverarbeitenden Systeme potenziell zu negativen sozialen Konsequenzen zu führen?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.negativeSocialConsequences || ''}>
                        </dbp-form-enum-view>

                        <dbp-form-enum-view
                            subscribe="lang"
                            label="6.4.	Beinhaltet das Forschungsvorhaben den Einsatz von informationsverarbeitenden Systemen in einem Waffensystem? "
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.weaponSystem || ''}>
                        </dbp-form-enum-view>

                        <dbp-form-enum-view
                            class="conditional-field"
                            data-target-variable="ethicalIssuesListQuestion"
                            data-condition="yes"
                            subscribe="lang"
                            label="6.5.	Wirft die Entwicklung und/oder Anwendung dieser informationsverarbeitenden Systeme noch weitere ethische Fragen auf, die nicht von der Liste abgedeckt sind?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.hasEthicalIssues || ''}>
                        </dbp-form-enum-view>

                        ${
                            this.ethicalIssuesListQuestion
                                ? html`
                                      <dbp-form-string-view
                                          class="${classMap({
                                              'fade-in': this.ethicalIssuesListQuestion,
                                          })}"
                                          subscribe="lang"
                                          label="Welche"
                                          value=${data.ethicalIssuesList ||
                                          ''}></dbp-form-string-view>
                                  `
                                : ''
                        }

                        <dbp-form-string-view
                            subscribe="lang"
                            label="Sonstige Anmerkungen zu 6."
                            value=${data.otherCommentsOnInformationProcessing || ''}>
                        </dbp-form-string-view>
                    </div>
                </article>

                <article>
                    <h3 class="section-sub-title">7. Interessenskonflikte</h3>

                    <dbp-form-enum-view
                        class="conditional-field"
                        data-target-variable="hasConflictOfInterestSubQuestion"
                        data-condition="yes"
                        subscribe="lang"
                        label="7.1. Bestehen mögliche Interessenskonflikte mit dem Auftraggeber und/oder mit Projektpartner*innen?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasConflictOfInterest || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.hasConflictOfInterestSubQuestion
                            ? html`
                                  <dbp-form-string-view
                                      class="${classMap({
                                          'fade-in': this.hasConflictOfInterestSubQuestion,
                                      })}"
                                      subscribe="lang"
                                      label="Welche"
                                      value=${data.conflictOfInterestList ||
                                      ''}></dbp-form-string-view>
                              `
                            : ''
                    }

                    <dbp-form-enum-view
                        class="conditional-field"
                        data-target-variable="hasConfidentialPartSubQuestion"
                        data-condition="yes"
                        subscribe="lang"
                        label="7.2.	Unterliegen die Ergebnisse Ihres Forschungsvorhabens oder Teile davon der Geheimhaltung bzw. ist die Veröffentlichung und/oder weitere Nutzung untersagt?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasConfidentalPart || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.hasConfidentialPartSubQuestion
                            ? html`
                                  <dbp-form-string-view
                                      class="${classMap({
                                          'fade-in': this.hasConfidentialPartSubQuestion,
                                      })}"
                                      subscribe="lang"
                                      label="7.2.1. Von welcher Art ist diese Sperrung?"
                                      value=${data.natureOfBlocking || ''}></dbp-form-string-view>

                                  <dbp-form-string-view
                                      class="${classMap({
                                          'fade-in': this.hasConfidentialPartSubQuestion,
                                      })}"
                                      subscribe="lang"
                                      label="7.2.2. Welche Begründung gibt es für die Sperrung?"
                                      value=${data.reasonOfBlocking || ''}></dbp-form-string-view>

                                  <dbp-form-string-view
                                      class="${classMap({
                                          'fade-in': this.hasConfidentialPartSubQuestion,
                                      })}"
                                      subscribe="lang"
                                      label="7.2.3. Welche Konsequenzen sind für die Forschenden durch eine Sperrung zu erwarten (insbesondere in Bezug auf Qualifikationsarbeiten)?"
                                      value=${data.consequencesOfBlocking ||
                                      ''}></dbp-form-string-view>
                              `
                            : ''
                    }

                    <dbp-form-enum-view
                        class="conditional-field"
                        data-target-variable="hasConflictInContentControlSubQuestion"
                        data-condition="yes"
                        subscribe="lang"
                        label="7.3.	Kann es Interessenskonflikte über die Inhaltskontrolle der Veröffentlichung geben?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasConflictInContentControl || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.hasConflictInContentControlSubQuestion
                            ? html`
                                  <dbp-form-string-view
                                      class="${classMap({
                                          'fade-in': this.hasConflictInContentControlSubQuestion,
                                      })}"
                                      subscribe="lang"
                                      label="Welche"
                                      value=${data.conflictInContentControlList ||
                                      ''}></dbp-form-string-view>
                              `
                            : ''
                    }

                    <dbp-form-enum-view
                        class="conditional-field"
                        data-target-variable="stakeholderParticipationPlannedSubQuestion"
                        data-condition="yes"
                        subscribe="lang"
                        label="7.4.	Ist die Beteiligung von Stakeholdern geplant?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.stakeholderParticipationPlanned || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.stakeholderParticipationPlannedSubQuestion
                            ? html`
                                  <dbp-form-enum-view
                                      class="${classMap({
                                          'fade-in':
                                              this.stakeholderParticipationPlannedSubQuestion,
                                      })}"
                                      subscribe="lang"
                                      label="7.4.1. Ist eine angemessene Anerkennung von deren Aufwand vorgesehen?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.hasProvisionForAppropriateRecognition ||
                                      ''}></dbp-form-enum-view>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">8. Technikfolgen</h3>

                    <dbp-form-enum-view
                        subscribe="lang"
                        label="8.1.	Sind negative Auswirkungen auf Individuen und/oder die Gesellschaft zu erwarten (z.B.: Einschränkung der persönlichen Autonomie, möglicher Kompetenzverlust durch zunehmende Automatisierung – „deskilling“, mögliche Auswirkungen auf den Arbeitsmarkt, Diskriminierung)"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasNegativeEffects || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        label="8.2.	Besteht das Risiko eines Reputationsschadens für die TU Graz?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasRiskOfReputationDamage || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        label="8.3.	Hat Ihr Projekt mit der Entwicklung von Waffensystemen zu tun?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.relatedToDevelopmentOfWeapons || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        label="8.4.	Könnten Ihre Forschungsergebnisse oder Teile davon eine (Weiter)Verwendung finden (Dual Use, z.B.: im Rahmen der Militärforschung, Überwachung)?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasDualUse || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        class="conditional-field"
                        data-target-variable="riskSubQuestion"
                        data-condition="yes"
                        subscribe="lang"
                        label="8.5.	Ergeben sich unter Berücksichtigung aller Antworten aus Ihrer Sicht Risiken oder Folgeerscheinungen?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasAnyRisks || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.riskSubQuestion
                            ? html`
                                  <dbp-form-string-view
                                      class="${classMap({'fade-in': this.riskSubQuestion})}"
                                      subscribe="lang"
                                      label="Begründung"
                                      value=${data.risksReasons || ''}></dbp-form-string-view>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">9. Arbeitsbedingungen im Forschungsvorhaben (soweit sie durch die Projektleitung beeinflusst werden können)</h3>

                    <dbp-form-enum-view
                        subscribe="lang"
                        label="9.1.	Sind in Ihrem Forschungsvorhaben Arbeitsverträge kurzer Dauer (bis zu einem Jahr) geplant?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.employmentContract || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        label="9.2.	Werden Aspekte der Work-Life-Balance (auch bereits in der Projektplanung) angemessen berücksichtigt?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.workLifeBalance || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        label="9.3.	Gibt es eine angemessene und faire Entlohnung für unterschiedliche Tätigkeiten im Projekt (z.B.: auch für die Annotierung und Bearbeitung von Datensätzen)?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.fairCompensation || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.diversityAspects || ''}>
                        <span slot="label">
                            <label>9.4. Werden im Projekt diversitäts- und gendersensible Aspekte berücksichtigt (<a href='https://tu4u.tugraz.at/fileadmin/public/Studierende_und_Bedienstete/Anleitungen/Diversity-Gender_in_Forschungsprojekten_Checkliste_Deutsch.pdf?sword_list%5B0%5D=gender&sword_list%5B1%5D=forschung&no_cache=1' target='_blank'>siehe Leitfaden der TU Graz</a>)?</label>
                        </span>
                    </dbp-form-enum-view>
                </article>

                <article>
                    <h3 class="section-title">4. Weitere Unterlagen</h3>
                    <div class="description">
                        <p>Falls zutreffend: Bitte legen Sie an Proband*innen gerichtete Fragebögen, Erhebungsbögen oder Aufgabenstellungen Ihrem Antrag bei.</p>
                        <p>Allenfalls können Sie weitere Dokumente beilegen, die aus Ihrer Sicht von Relevanz für die Beurteilung Ihres Forschungsvorhabens im Gesamten sind.</p>
                    </div>

                    <div class="file-upload-container">

                        <h4 class="attachments-title">${i18n.t('render-form.forms.ethics-commission-form.attachments-title')}</h4>

                        <div class="uploaded-files">
                            ${this.renderAttachedFilesHtml()}
                        </div>
                    </div>
                </article>

                <dbp-file-sink
                    id="file-sink"
                    class="file-sink"
                    lang="${this.lang}"

                    allowed-mime-types="application/pdf,.pdf"
                    decompress-zip
                    enabled-targets="local,clipboard,nextcloud"
                    filename="ethics-commission-form-${this.submissionId || ''}-attachments.zip"
                    subscribe="nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-sink>
            </form>

            <dbp-modal
                id="pdf-view-modal"
                class="pdf-view-modal"
                modal-id="pdf-viewer-modal"
                subscribe="lang">
                <div slot="content">
                    <dbp-pdf-viewer
                        id="dbp-pdf-viewer"
                        lang="${this.lang}"
                        auto-resize="cover"></dbp-pdf-viewer>
                </div>
            </dbp-modal>

            <dbp-grant-permission-dialog
                id="grant-permission-dialog"
                lang="${this.lang}"
                subscribe="auth"
                entry-point-url="${this.entryPointUrl}"
                resource-identifier="${this.submissionId}"
                resource-class-identifier="DbpRelayFormalizeSubmission"></dbp-grant-permission-dialog>

            ${this.renderResult(this.submitted)}
        `;
    }

    /**
     * Renders the form in natural (edit) mode.
     * @returns {import('lit').TemplateResult} The HTML for the button row.
     */
    renderFormElements() {
        const i18n = this._i18n;
        const data = this.formData || {};

        return html`

            <form id="ethics-commission-form" aria-labelledby="form-title">

            <div class="scroller-container">
                <button id="form-scroller" class="scroller" @click=${this.handleScroller}>
                    <dbp-icon name="chevron-down" title=${i18n.t('render-form.forms.ethics-commission-form.scroll-to-bottom-text')}></dbp-icon>
                    <span class="visually-hidden">${i18n.t('render-form.forms.ethics-commission-form.scroll-to-bottom-text')}</span>
                </button>
            </div>

                ${this.getButtonRowHtml()}

                <div class="form-details">
                    ${this.renderSubmissionPermissions()}
                </div>

                ${this.renderStatusBadge()}

                <h2 class="form-title">${i18n.t('render-form.forms.ethics-commission-form.title')}</h2>

                <div class="type-container">
                    <dbp-form-enum-element
                        subscribe="lang"
                        name="type"
                        label="Typ"
                        display-mode="list"
                        .items=${{
                            study: i18n.t('render-form.forms.ethics-commission-form.study'),
                            publication: i18n.t(
                                'render-form.forms.ethics-commission-form.publication',
                            ),
                        }}
                        .value=${data.type || ''}
                        required>
                    </dbp-form-enum-element>
                </div>

                <article>

                    <h3 class="form-sub-title">${i18n.t('render-form.forms.ethics-commission-form.sub-title')}</h3>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="applicant"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.applicant-placeholder')}"
                        label="${i18n.t('render-form.forms.ethics-commission-form.applicant-label')}"
                        required
                        value=${data.applicant || ''}>
                    </dbp-form-string-element>
                    <sup>1. Bei Abschlussarbeiten im Rahmen des Bachelor- oder Masterstudiums ist der Ethikantrag von der betreuenden Person einzubringen; Doktorand*innen können auch Antragssteller*innen sein.</sup>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="contactDetails"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.contact-details-placeholder')}"
                        label="${i18n.t('render-form.forms.ethics-commission-form.contact-details-label')}"
                        required
                        value=${data.contactDetails || ''}>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="jobPosition"
                        required
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.job-position-placeholder')}"
                        label="${i18n.t('render-form.forms.ethics-commission-form.job-position-label')}"
                        value=${data.jobPosition || ''}>
                    </dbp-form-string-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="fieldsOfExpertise"
                        display-mode="list"
                        multiple
                        label="${i18n.t('render-form.forms.ethics-commission-form.fields-of-expertise-label')}"
                        .items=${{
                            'advanced-material-sciences': i18n.t(
                                'render-form.forms.ethics-commission-form.advanced-material-sciences',
                            ),
                            'human-and-biotechnology': i18n.t(
                                'render-form.forms.ethics-commission-form.human-and-biotechnology',
                            ),
                            'information-communication-computing': i18n.t(
                                'render-form.forms.ethics-commission-form.information-communication-computing',
                            ),
                            'mobility-production': i18n.t(
                                'render-form.forms.ethics-commission-form.mobility-production',
                            ),
                            'sustainable-systems': i18n.t(
                                'render-form.forms.ethics-commission-form.sustainable-systems',
                            ),
                            keinem: i18n.t('render-form.forms.ethics-commission-form.keinem'),
                        }}
                        .value=${data.fieldsOfExpertise || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="qualificationWork"
                        display-mode="list"
                        required
                        label="${i18n.t('render-form.forms.ethics-commission-form.qualification-work-label')}"
                        .items=${{
                            no: i18n.t('render-form.forms.ethics-commission-form.no-label'),
                            bachelor: i18n.t(
                                'render-form.forms.ethics-commission-form.bachelor-label',
                            ),
                            master: i18n.t('render-form.forms.ethics-commission-form.master-label'),
                            doctorat: i18n.t(
                                'render-form.forms.ethics-commission-form.doctorat-label',
                            ),
                            'no-publication': i18n.t(
                                'render-form.forms.ethics-commission-form.no-publication-label',
                            ),
                            'one-publication': i18n.t(
                                'render-form.forms.ethics-commission-form.one-publication-label',
                            ),
                        }}
                        .value=${data.qualificationWork || ''}>
                    </dbp-form-enum-element>

                    <span>Studienbeschreibung, Kriterienkatalog, Informed Consent</span>

                    <dbp-form-date-element
                        subscribe="lang"
                        name="dateOfTransmission"
                        label="${i18n.t('render-form.forms.ethics-commission-form.date-of-transmission-label')}"
                        value=${data.dateOfTransmission || ''}
                        required>
                    </dbp-form-date-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="specificationOffice"
                        label="${i18n.t('render-form.forms.ethics-commission-form.specification-office-label')}"
                        value=${data.specificationOffice || ''}
                        required>
                    </dbp-form-string-element>

                    <span>Datenschutzrechtlich geprüft</span>

                    <dbp-form-date-element
                        subscribe="lang"
                        name="dataProtectionDate"
                        label="${i18n.t('render-form.forms.ethics-commission-form.data-protection-date-label')}"
                        value=${data.dataProtectionDate || ''}
                        required>
                    </dbp-form-date-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="dataProtectionSpecificationOffice"
                        label="${i18n.t('render-form.forms.ethics-commission-form.specification-office-label')}"
                        value=${data.dataProtectionSpecificationOffice || ''}
                        required>
                    </dbp-form-string-element>

                    <span>Datenschutzrechtliche Besonderheiten von ethischer Relevanz</span>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="dataProtectionEthicsRelevance"
                        label="${i18n.t('render-form.forms.ethics-commission-form.specification-office-label')}"
                        placeholder="Angabe durch Geschäftsstelle"
                        value=${data.dataProtectionEthicsRelevance || ''}
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="shortDescription"
                        label="Kurzbeschreibung/Zusammenfassung"
                        placeholder="Bitte beschreiben Sie Ziel und Ablauf Ihrer Studie/Publikation kurz und in ganzen Sätzen (max. 300 Wörter)."
                        value=${data.shortDescription || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="dataSource"
                        label="Datenquelle"
                        placeholder="Bitte beschreiben Sie kurz, woher die Daten stammen (z.B.: werden selbst erhoben, Open Data Sources, von Forschungspartner*innen, …):"
                        value=${data.dataSource || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="numberOfTestPersons"
                        label="Wenn Menschen als Proband*innen mitwirken: (Geplante) Anzahl der Proband*innen"
                        placeholder="Anzahl der geplanten Proband*innen"
                        value=${data.numberOfTestPersons || ''}
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="acquisitionOfTestSubjects"
                        label="Akquise der Proband*innen"
                        placeholder="Bitte beschreiben Sie, wie Sie Proband*innen für Ihre Studie akquirieren und fügen Sie etwaiges Informationsmaterial, Aushänge, Rekrutierungstexte für Mails etc. an."
                        value=${data.acquisitionOfTestSubjects || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="volunteersCompensation"
                        label="Welche Aufwandsentschädigung erhalten die Proband*innen?"
                        placeholder="Angabe über die Art und Höhe der Aufwandsentschädigung für Proband*innen für deren Teilnahme an der Studie."
                        value=${data.volunteersCompensation || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="volunteersCompensationEarlyEnd"
                        label="Erhalten die Proband*innen auch bei vorzeitigem Abbruch der Teilnahme eine angemessene Entschädigung?"
                        placeholder="Angabe über die Art und Höhe der Aufwandsentschädigung für Proband*innen, die die Teilnahme an der Studie vorzeitig abbrechen."
                        value=${data.volunteersCompensationEarlyEnd || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="participationCriteria"
                        label="Gibt es Ein- und Ausschlusskriterien für eine Teilnahme als Proband*in in Ihrer Studie? Wenn ja, welche sind dies? "
                        placeholder="Angabe der Ein- und Ausschlusskriterien. z.B.: Alter, (Vor-)Erkrankung, Schwangerschaft, …"
                        value=${data.participationCriteria || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="subjectsDependencies"
                        label="Liegen Befangenheiten oder Abhängigkeiten im Rahmen Ihrer Studie vor (siehe auch 1.1.5. des Kriterienkatalogs)?
    Personen können nicht als Proband*innen in Ihrer Studie mitwirken, wenn sie in einer studienrechtlichen oder arbeitsrechtlichen Abhängigkeit zu Ihnen als Studienleitung stehen (z.B.: Mitarbeitende des gleichen Instituts als Proband*innen)."
                        placeholder="Offenlegung von Befangenheiten oder Abhängigkeiten bzw. Bestätigung, dass keine Personen als Proband*innen mitwirken, die in studienrechtlicher oder arbeitsrechtlicher Abhängigkeit zur Studienleitung stehen."
                        value=${data.subjectsDependencies || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <!-- PAGE 3 STARTS HERE -->

                    <dbp-form-string-element
                        subscribe="lang"
                        name="founding"
                        label="Finanzierung"
                        placeholder="1) Angaben zur Art der Finanzierung (z.B.: Drittmittel, …)&amp;#10;
    2) Angaben zum Fördergeber, der Ihr Projekt finanziert (bzw. der Fördergeber)&amp;#10;
    3) Angaben zum Projektvolumen bzw. zur Höhe der Finanzierung"
                        value=${data.founding || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <dbp-form-date-element
                        subscribe="lang"
                        name="projectStartDate"
                        label="Geplanter Start und Zeitraum des Forschungsvorhabens"
                        value=${data.projectStartDate || ''}
                        required>
                    </dbp-form-date-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="projectTimePeriod"
                        label="Des Zeitraums zur Durchführung Ihrer Studie"
                        value=${data.projectTimePeriod || ''}
                        required>
                    </dbp-form-string-element>
                </article>

                <article>

                    <h3 class="section-title">1. Beschreibung des Forschungsvorhabens (max. 2 Seiten)</h3>

                    <div class="description">
                        <p>Beschreibung der Zielsetzung und des wissenschaftlichen Hintergrundes Ihres Forschungsvorhabens (mit Angabe der relevanten Literatur).</p>
                        <p>Darlegung des Studienablaufs und Erläuterung der eingesetzten Methoden und Rolle bzw. Aufgaben der involvierten Proband*innen.</p>
                        <p>Beschreibung der eingesetzten Geräte/Apparaturen samt Marke und Hersteller.</p>
                        <p>Nutzen-Risiko-Erwägungen: Welche Risiken (Unannehmlichkeiten, Gefahren, Belastungen) bestehen für die Proband*innen im Verhältnis zum Nutzen der Ergebnisse des Forschungsvorhabens?</p>
                    </div>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="researchProjectDescription"
                        label="Beschreibung des Forschungsvorhabens"
                        value=${data.researchProjectDescription || ''}
                        rows="10"
                        required>
                    </dbp-form-string-element>
                </article>

                <article>
                    <h3 class="section-title">2. Informed Consent / Informierte Einwilligung</h3>

                    <div class="description">
                        <p>Die Proband*innen sollen von der Studienleitung über folgende Punkte informiert werden (beispielsweise durch eine Proband*innen-Information und Einwilligungserklärung zur Teilnahme am Forschungsvorhaben):</p>
                        <ol>
                            <li><p>Genaue Angabe von Titel, Zweck und Dauer Ihres Forschungsvorhabens sowie Erklärung des Ablaufs für die Proband*innen in einfacher und klarer Sprache (bitte vermeiden Sie nach Möglichkeit Fremdwörter)</p></li>
                            <li><p>Angaben zur durchführenden Forschungseinrichtung und zu einer verantwortlichen Kontaktperson (Vor- und Nachname, E-Mail-Adresse und evtl. Telefonnummer) für weitere Fragen, Anregungen oder Beschwerden</p></li>
                            <li><p>Angabe möglicher Risiken für die Proband*innen (Unannehmlichkeiten, Gefahren, Belastungen) und etwaiger Folgen</p></li>
                            <li><p>Angaben über die Höhe der Aufwandsentschädigung (auch im Falle eines vorzeitigen Abbruchs) sowie eines sonstigen Nutzens für die Proband*innen</p></li>
                            <li><p>Hinweis auf die Freiwilligkeit der Teilnahme inklusive des Rechts, die Einwilligung jederzeit ohne Angabe von Gründen widerrufen und die Teilnahme vorzeitig abbrechen zu können, ohne dass den Proband*innen dadurch ein Nachteil entsteht</p></li>
                            <li><p>Hinweis auf die erfolgte Behandlung durch die Ethikkommission</p></li>
                            <li><p>Hinweis auf die Richtlinie für Hinweisgeber und den elektronischen Briefkasten für anonyme Hinweise an der TU Graz (Whistleblowing)<sup>2</sup></p></li>
                            <li><p>Einwilligungserklärung der Proband*innen (bzw. von deren gesetzlichen Vertreter*innen) zur Teilnahme an der Studie</p></li>
                        </ol>
                        <p>[2] Elektronischer Briefkasten für anonyme Hinweise (Whistleblowing), <a href="https://www.tugraz.at/ueber-diese-seite/elektronischer-briefkasten-fuer-anonyme-hinweise-whistleblowing">whistleblowing</a> (abgerufen 15.07.2024).</p>
                    </div>
                </article>

                <article>
                    <h3 class="section-title">3. Kriterienkatalog / Self-Assessment</h3>

                    <div class="description">
                        <p>Bitte füllen Sie den folgenden Kriterienkatalog gewissenhaft aus. Geben Sie an, welche Kriterien auf Ihr Forschungsvorhaben zutreffen und welche nicht. <sup>3</sup> </p>
                        [3] Angelehnt an den Kriterienkatalog der Europäischen Kommission im Zusammenhang von EU-Grants/Horizon Europe aus dem Jahr 2021.
                    </div>

                    <h4 class="section-sub-title">1. Menschen</h4>

                    <dbp-form-enum-element
                        @change="${(e) => {
                            if (e.detail.value) {
                                this.humanTestSubjectsQuestionsEnabled =
                                    e.detail.value === 'yes' ? true : false;
                            }
                        }}"
                        subscribe="lang"
                        name="testSubjects"
                        display-mode="list"
                        required
                        label="Nehmen Menschen am Forschungsvorhaben als Proband*innen teil?"
                        description="(z.B.: durch Interviews; über per Ton und/oder Video aufgezeichnete Beobachtungen; bei Technologie-/Prototypentestungen)"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.testSubjects || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.humanTestSubjectsQuestionsEnabled
                            ? html`
                                  <div
                                      class="question-group ${classMap({
                                          'fade-in': this.humanTestSubjectsQuestionsEnabled,
                                      })}">
                                      <h4 class="question-group-title">
                                          1.1. Menschen als Proband*innen im Forschungsvorhaben
                                      </h4>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsVoluntary"
                                          display-mode="list"
                                          required
                                          label="1.1.1. Nehmen die Proband*innen freiwillig an der Studie teil?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsVoluntary ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsInformedConsent"
                                          display-mode="list"
                                          required
                                          label="1.1.2. Wurden die Proband*innen über die an ihnen durchgeführte Studie im Vorfeld umfassend, in einfacher und verständlicher Sprache informiert (informed consent)?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsInformedConsent ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsConsentSigned"
                                          display-mode="list"
                                          required
                                          label="1.1.3. Wird sichergestellt, dass die Teilnahme ausschließlich nach Unterfertigung der informierten Einwilligung durch die Proband*innen und/oder ihrer gesetzlichen Vertreter*innen erfolgt?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsConsentSigned ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsWithdrawPossible"
                                          display-mode="list"
                                          required
                                          label="1.1.4. Besteht die Möglichkeit, von der Teilnahme ohne persönliche negative Auswirkungen zurückzutreten?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsWithdrawPossible ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsDependent"
                                          display-mode="list"
                                          required
                                          label="1.1.5. Nehmen Personen, die in studienrechtlicher und/oder arbeitsrechtlicher Abhängigkeit zur Studienleitung stehen (z.B.: Mitarbeitende des gleichen Instituts) als Proband*innen an der Studie teil?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsDependent ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsVulnerable"
                                          display-mode="list"
                                          required
                                          label="1.1.6. Sind andere potentiell vulnerable Personen involviert (Kinder, nicht einwilligungsfähige Personen, Opfer von Missbrauch oder Gewalt etc.)?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsVulnerable ||
                                          ''}></dbp-form-enum-element>
                                  </div>

                                  <div class="question-group">
                                      <h4 class="question-group-title">
                                          1.2. Physische oder psychische Eingriffe an Proband*innen
                                      </h4>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="invasiveTechniquesUsed"
                                          display-mode="list"
                                          required
                                          label="1.2.1. Werden invasive Techniken angewandt (z.B.: zur Sammlung von menschlichem Gewebe, Biopsien, Einwirkungen auf das Gehirn, etc.)?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.invasiveTechniquesUsed ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsTortured"
                                          display-mode="list"
                                          required
                                          label="1.2.2. Führt die Teilnahme an der Studie bei den Proband*innen zu mindestens einer der folgenden Konsequenzen wie z.B. dem Erleben von Erniedrigung, Scham, Folter, Schmerzen, psychischem Druck, oder überdurchschnittlichem Stress?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsTortured ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsHarmed"
                                          display-mode="list"
                                          required
                                          label="1.2.3. Könnten Proband*innen zu Schaden kommen bzw. gibt es mögliche Risiken oder etwaige Folgeerscheinungen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsHarmed ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsRiskMinimized"
                                          display-mode="list"
                                          required
                                          label="1.2.4. Wurden alle Schritte unternommen, um die Risiken zu minimieren?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsRiskMinimized ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsRisksJustified"
                                          display-mode="list"
                                          required
                                          label="1.2.5. Rechtfertigt der Nutzen der Studie die Risiken für die Proband*innen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsRisksJustified ||
                                          ''}></dbp-form-enum-element>
                                  </div>

                                  <div class="question-group">
                                      <h4 class="question-group-title">
                                          1.3. Zumutbarkeit des Forschungsvorhabens
                                      </h4>
                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsReasonableToParticipate"
                                          display-mode="list"
                                          required
                                          label="1.3.1 Ist den Proband*innen die Teilnahme an der Studie im Gesamten zumutbar?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.testSubjectsReasonableToParticipate ||
                                          ''}></dbp-form-enum-element>
                                  </div>
                              `
                            : ''
                    }

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="deadBodies"
                        display-mode="list"
                        required
                        label="1.4. Werden im Zuge des Forschungsvorhabens tote Körper/Leichen eingesetzt?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.deadBodies || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="legalDocumentsAvailable"
                        display-mode="list"
                        required
                        label="1.4.1. Liegen entsprechende Rechtsgrundlagen/Dokumente vor?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.legalDocumentsAvailable || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="disturbanceOfPeaceOfDead"
                        display-mode="list"
                        required
                        label="1.4.2. Kann eine Störung der Totenruhe ausgeschlossen werden?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.disturbanceOfPeaceOfDead || ''}>
                    </dbp-form-enum-element>
                </article>

                <article>
                    <h3 class="section-sub-title">2. Menschliche Stammzellen, Embryos bzw. Föten</h3>

                    <dbp-form-enum-element
                        @change="${(e) => {
                            if (e.detail.value) {
                                this.humanStemCellsQuestionsEnabled =
                                    e.detail.value === 'yes' ? true : false;
                            }
                        }}"
                        subscribe="lang"
                        name="humanStemCells"
                        display-mode="list"
                        required
                        label="Bezieht sich das Forschungsvorhaben auf die Verwendung von menschlichen Stammzellen oder menschlichem Gewebe?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.humanStemCells || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.humanStemCellsQuestionsEnabled
                            ? html`
                                  <div
                                      class="question-group ${classMap({
                                          'fade-in': this.humanStemCellsQuestionsEnabled,
                                      })}">
                                      <h4 class="question-group-title">
                                          2.1. Art des Forschungsmaterials
                                      </h4>
                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="humanTissueUsed"
                                          display-mode="list"
                                          required
                                          label="2.1.1. Beinhaltet das Forschungsvorhaben die Verwendung von menschlichem Gewebe?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.humanTissueUsed ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          @change="${(e) => {
                                              if (e.detail.value) {
                                                  this.stemCellFromEmbryosQuestionsEnabled =
                                                      e.detail.value === 'yes' ? true : false;
                                              }
                                          }}"
                                          subscribe="lang"
                                          name="humanStemCellsUsed"
                                          display-mode="list"
                                          required
                                          label="2.1.2. Beinhaltet das Forschungsvorhaben die Verwendung von menschlichen Stammzellen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.humanStemCellsUsed ||
                                          ''}></dbp-form-enum-element>

                                      ${this.stemCellFromEmbryosQuestionsEnabled
                                          ? html`
                                                <dbp-form-enum-element
                                                    class="${classMap({
                                                        'fade-in':
                                                            this
                                                                .stemCellFromEmbryosQuestionsEnabled,
                                                    })}"
                                                    subscribe="lang"
                                                    name="stemCellsFromEmbryos"
                                                    display-mode="list"
                                                    required
                                                    label="2.1.2.1.	Werden die Stammzellen direkt aus Embryos gewonnen?"
                                                    .items=${{
                                                        yes: 'Ja',
                                                        no: 'Nein',
                                                    }}
                                                    .value=${data.stemCellsFromEmbryos ||
                                                    ''}></dbp-form-enum-element>
                                            `
                                          : ''}

                                      <dbp-form-enum-element
                                          @change="${(e) => {
                                              if (e.detail.value) {
                                                  this.stemCellFromHumanEmbryosQuestionsEnabled =
                                                      e.detail.value === 'yes' ? true : false;
                                              }
                                          }}"
                                          subscribe="lang"
                                          name="useOfHumanEmbryos"
                                          display-mode="list"
                                          required
                                          label="2.1.3. Beinhaltet das Forschungsvorhaben die Verwendung von menschlichen Embryos oder Föten?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.useOfHumanEmbryos ||
                                          ''}></dbp-form-enum-element>

                                      ${this.stemCellFromHumanEmbryosQuestionsEnabled
                                          ? html`
                                                <dbp-form-enum-element
                                                    class="${classMap({
                                                        'fade-in':
                                                            this
                                                                .stemCellFromHumanEmbryosQuestionsEnabled,
                                                    })}"
                                                    subscribe="lang"
                                                    name="stemCellsFromEmbryosDestroyed"
                                                    display-mode="list"
                                                    required
                                                    label="2.1.3.1. Werden diese im Zuge der Forschung zerstört?"
                                                    .items=${{
                                                        yes: 'Ja',
                                                        no: 'Nein',
                                                    }}
                                                    .value=${data.stemCellsFromEmbryosDestroyed ||
                                                    ''}></dbp-form-enum-element>
                                            `
                                          : ''}
                                  </div>

                                  <div class="question-group">
                                      <h4 class="question-group-title">
                                          2.2. Herkunft des Forschungsmaterials
                                      </h4>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="commerciallyAvailableCells"
                                          display-mode="list"
                                          required
                                          label="2.2.1. Sind die im Forschungsvorhaben verwendeten Zellen (bzw. ist das menschliche Gewebe) kommerziell verfügbar?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.commerciallyAvailableCells ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          @change="${(e) => {
                                              if (e.detail.value) {
                                                  this.cellsObtainedInResearchQuestionsEnabled =
                                                      e.detail.value === 'yes' ? true : false;
                                              }
                                          }}"
                                          subscribe="lang"
                                          name="cellsObtainedInResearch"
                                          display-mode="list"
                                          required
                                          label="2.2.2. Werden die im Forschungsvorhaben verwendeten Zellen (bzw. das menschliche Gewebe) im Zuge des Forschungsvorhabens gewonnen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.cellsObtainedInResearch ||
                                          ''}></dbp-form-enum-element>

                                      ${!this.cellsObtainedInResearchQuestionsEnabled
                                          ? html`
                                                <dbp-form-string-element
                                                    class="${classMap({
                                                        'fade-in':
                                                            this
                                                                .cellsObtainedInResearchQuestionsEnabled,
                                                    })}"
                                                    subscribe="lang"
                                                    name="tissueOrCellsSource"
                                                    label="2.2.2.1.	Woher stammt das im Forschungsvorhaben verwendete Gewebe bzw. die Stammzellen?"
                                                    value=${data.tissueOrCellsSource || ''}
                                                    required></dbp-form-string-element>
                                            `
                                          : ''}
                                  </div>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">3. Tiere</h3>

                    <dbp-form-enum-element
                        @change="${(e) => {
                            if (e.detail.value) {
                                this.animalQuestionsEnabled =
                                    e.detail.value === 'yes' ? true : false;
                            }
                        }}"
                        subscribe="lang"
                        name="animalsInvolved"
                        display-mode="list"
                        required
                        label="Werden im Zuge des Forschungsvorhabens Tiere herangezogen?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.animalsInvolved || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.animalQuestionsEnabled
                            ? html`
                                  <div
                                      class="question-group ${classMap({
                                          'fade-in': this.animalQuestionsEnabled,
                                      })}">
                                      <h4 class="question-group-title">
                                          3.1. Tiere im Forschungsvorhaben
                                      </h4>
                                      vertebrates
                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="isAnimalVertebrate"
                                          display-mode="list"
                                          required
                                          label="3.1.1.	Handelt es sich dabei um Wirbeltiere?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.isAnimalVertebrate ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="nonHumanPrimates"
                                          display-mode="list"
                                          required
                                          label="3.1.2.	Handelt es sich dabei um nicht-menschliche Primaten (Affen, Schimpansen, Gorillas etc.)?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.nonHumanPrimates ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="geneticallyModifiedAnimals"
                                          display-mode="list"
                                          required
                                          label="3.1.3. Sind diese Tiere genetisch verändert?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.geneticallyModifiedAnimals ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="endangeredSpecies"
                                          display-mode="list"
                                          required
                                          label="3.1.4. Gehören diese Tiere einer bedrohten Tierart an?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.endangeredSpecies ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="alternativesToUseLaboratoryAnimals"
                                          display-mode="list"
                                          required
                                          label="3.1.5. Gibt es Alternativen zur Verwendung von Versuchstieren?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.alternativesToUseLaboratoryAnimals ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="laboratoryAnimalsHarmed"
                                          display-mode="list"
                                          required
                                          label="3.1.6. Könnten Versuchstiere im Zuge des Forschungsvorhabens zu Schaden kommen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.laboratoryAnimalsHarmed ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="isRiskJustified"
                                          display-mode="list"
                                          required
                                          label="3.1.7. Rechtfertigt der Nutzen der Studie die Risiken für die Versuchstiere?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.isRiskJustified ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="relevantLegalDocumentAvailable"
                                          display-mode="list"
                                          required
                                          label="3.1.8. Liegen entsprechende Rechtsgrundlagen/Dokumente vor?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.relevantLegalDocumentAvailable ||
                                          ''}></dbp-form-enum-element>
                                  </div>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">4. Nicht-EU-Staaten / Drittstaaten</h3>
                    <dbp-form-enum-element
                        @change="${(e) => {
                            if (e.detail.value) {
                                this.nonEuCountriesQuestionsEnabled =
                                    e.detail.value === 'yes' ? true : false;
                            }
                        }}"
                        subscribe="lang"
                        name="nonEuCountries"
                        display-mode="list"
                        required
                        label="Wird ein Teil des Forschungsvorhabens außerhalb der EU/in Drittstaaten durchgeführt?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.nonEuCountries || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.nonEuCountriesQuestionsEnabled
                            ? html`
                                  <div
                                      class="question-group ${classMap({
                                          'fade-in': this.nonEuCountriesQuestionsEnabled,
                                      })}">
                                      <h4 class="question-group-title">
                                          4.1. Forschungsvorhaben außerhalb der EU bzw. in
                                          Drittstaaten
                                      </h4>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="ethicalIssues"
                                          display-mode="list"
                                          required
                                          label="4.1.1. Berühren die in Drittstaaten ausgeführten Aktivitäten potentiell ethische Themen entweder aus EU-Sicht oder aus Sicht des Drittstaats?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.ethicalIssues ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          @change="${(e) => {
                                              if (e.detail.value) {
                                                  this.questionResearchFoundsQuestionsEnabled =
                                                      e.detail.value === 'yes' ? true : false;
                                              }
                                          }}"
                                          subscribe="lang"
                                          name="thirdCountriesLocalResources"
                                          display-mode="list"
                                          required
                                          label="4.1.2. Ist die Nutzung von lokalen Ressourcen in Drittstaaten geplant?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.thirdCountriesLocalResources ||
                                          ''}></dbp-form-enum-element>

                                      ${this.questionResearchFoundsQuestionsEnabled
                                          ? html`
                                                <dbp-form-enum-element
                                                    class="${classMap({
                                                        'fade-in':
                                                            this
                                                                .questionResearchFoundsQuestionsEnabled,
                                                    })}"
                                                    subscribe="lang"
                                                    name="questionResearchFounds"
                                                    display-mode="list"
                                                    required
                                                    label="4.1.2.1.	Ergeben sich dadurch Fragestellungen in Zusammenhang mit der Verteilung von Forschungsmitteln?"
                                                    .items=${{
                                                        yes: 'Ja',
                                                        no: 'Nein',
                                                    }}
                                                    .value=${data.questionResearchFounds ||
                                                    ''}></dbp-form-enum-element>
                                            `
                                          : ''}

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="importMaterialFromThirdCountries"
                                          display-mode="list"
                                          required
                                          label="4.1.3. Ist der Import von Material (außer Daten) aus Drittstaaten in die EU oder in andere Drittstaaten geplant? "
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.importMaterialFromThirdCountries ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="lowIncomeCountries"
                                          display-mode="list"
                                          required
                                          label="4.1.4. Beinhaltet das Forschungsvorhaben Staaten mit niedrigerem und/oder unterem mittlerem Einkommen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.lowIncomeCountries ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="exposeParticipantsToRisk"
                                          display-mode="list"
                                          required
                                          label="4.1.5. Könnte die Teilnahme am Forschungsvorhaben die Beteiligten aufgrund der Situation in dem entsprechenden Drittstaat bzw. in dem Land außerhalb der EU einem Risiko aussetzen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.exposeParticipantsToRisk ||
                                          ''}></dbp-form-enum-element>
                                  </div>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">5. Nachhaltigkeit, Gesundheit und Sicherheit</h3>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="harmfulSubstances"
                            display-mode="list"
                            required
                            label="5.1. Kommt es zum Einsatz von Stoffen, die für Umwelt, Tiere und/oder Pflanzen schädliche Konsequenzen haben können?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.harmfulSubstances || ''}>
                        </dbp-form-enum-element>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="negativeImpactsOnNature"
                            display-mode="list"
                            required
                            label="5.2. Sind konkrete negative Auswirkungen auf bedrohte Pflanzenarten oder Naturschutzgebiete bzw. der Verlust von Biodiversität zu befürchten?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.negativeImpactsOnNature || ''}>
                        </dbp-form-enum-element>

                        <dbp-form-enum-element
                            @change="${(e) => {
                                if (e.detail.value) {
                                    this.harmfulSubstancesOnSubjects =
                                        e.detail.value === 'yes' ? true : false;
                                }
                            }}"
                            subscribe="lang"
                            name="harmfulSubstancesOnSubjects"
                            display-mode="list"
                            required
                            label="5.3. Kommt es zum Einsatz von Stoffen, die für Proband*innen und/oder Forscher*innen potentiell schädliche Konsequenzen haben können?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.harmfulSubstancesOnSubjects || ''}>
                        </dbp-form-enum-element>

                        ${
                            this.harmfulSubstancesOnSubjects
                                ? html`
                                      <dbp-form-enum-element
                                          class="${classMap({
                                              'fade-in': this.harmfulSubstancesOnSubjects,
                                          })}"
                                          subscribe="lang"
                                          name="adequateSafetyMeasures"
                                          display-mode="list"
                                          required
                                          label="5.3.1. Wurden adäquate Sicherheitsmaßnahmen zur Reduktion des Risikos für Proband*innen und Forscher*innen getroffen?"
                                          .items=${{
                                              yes: 'Ja',
                                              no: 'Nein',
                                          }}
                                          .value=${data.adequateSafetyMeasures ||
                                          ''}></dbp-form-enum-element>
                                  `
                                : ''
                        }

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="complyWithSustainabilityStrategy"
                            display-mode="list"
                            required
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.complyWithSustainabilityStrategy || ''}>
                                <span slot="label">
                                    <label>5.4. Entspricht Ihr Forschungsvorhaben der <a href='https://www.tugraz.at/tu-graz/universitaet/klimaneutrale-tu-graz/roadmap' target='_blank'>Nachhaltigkeitsstrategie</a> der TU Graz?</label>
                                </span>
                        </dbp-form-enum-element>

                        <dbp-form-string-element
                            subscribe="lang"
                            name="appropriateUseOfResources"
                            label="5.5.	Wodurch wird für den angemessenen Umgang mit Ressourcen Sorge getragen?"
                            placeholder="Bitte führen Sie hier zwei Beispiele an."
                            value=${data.appropriateUseOfResources || ''}
                            rows="4"
                            required>
                        </dbp-form-string-element>

                    </div>
                </article>

                <article>
                    <h3 class="section-sub-title">6. Informationsverarbeitende Systeme (insb. Artificial Intelligence)</h3>

                    <div class="question-group ${classMap({'fade-in': this.nonEuCountriesQuestionsEnabled})}">
                        <h4 class="question-group-title">Im Forschungsprozess werden in aller Regel informationsverarbeitende Systeme verwendet. Bitte beantworten Sie daher die nachfolgenden Fragen.</h4>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="replaceHumanDecisionMaking"
                            display-mode="list"
                            required
                            label="6.1.	Können die im Forschungsvorhaben eingesetzten informationsverarbeitenden Systeme menschliche Entscheidungsfindungsprozesse beeinflussen, ersetzen oder umgehen?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.replaceHumanDecisionMaking || ''}>
                        </dbp-form-enum-element>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="potentiallyStigmatizePeople"
                            display-mode="list"
                            required
                            label="6.2.	Können die im Forschungsvorhaben eingesetzten informationsverarbeitenden Systeme Menschen potentiell stigmatisieren oder diskriminieren?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.potentiallyStigmatizePeople || ''}>
                        </dbp-form-enum-element>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="negativeSocialConsequences"
                            display-mode="list"
                            required
                            label="6.3.	Können die im Forschungsvorhaben eingesetzten informationsverarbeitenden Systeme potenziell zu negativen sozialen Konsequenzen zu führen?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.negativeSocialConsequences || ''}>
                        </dbp-form-enum-element>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="weaponSystem"
                            display-mode="list"
                            required
                            label="6.4.	Beinhaltet das Forschungsvorhaben den Einsatz von informationsverarbeitenden Systemen in einem Waffensystem? "
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.weaponSystem || ''}>
                        </dbp-form-enum-element>

                        <dbp-form-enum-element
                            @change="${(e) => {
                                if (e.detail.value) {
                                    this.ethicalIssuesListQuestion =
                                        e.detail.value === 'yes' ? true : false;
                                }
                            }}"
                            subscribe="lang"
                            name="hasEthicalIssues"
                            display-mode="list"
                            required
                            label="6.5.	Wirft die Entwicklung und/oder Anwendung dieser informationsverarbeitenden Systeme noch weitere ethische Fragen auf, die nicht von der Liste abgedeckt sind?"
                            .items=${{
                                yes: 'Ja',
                                no: 'Nein',
                            }}
                            .value=${data.hasEthicalIssues || ''}>
                        </dbp-form-enum-element>

                        ${
                            this.ethicalIssuesListQuestion
                                ? html`
                                      <dbp-form-string-element
                                          class="${classMap({
                                              'fade-in': this.ethicalIssuesListQuestion,
                                          })}"
                                          subscribe="lang"
                                          name="ethicalIssuesList"
                                          label="Welche"
                                          placeholder="Liste der ethischen Fragen hier"
                                          value=${data.ethicalIssuesList || ''}
                                          rows="5"
                                          required></dbp-form-string-element>
                                  `
                                : ''
                        }

                        <dbp-form-string-element
                            subscribe="lang"
                            name="otherCommentsOnInformationProcessing"
                            label="Sonstige Anmerkungen zu 6."
                            placeholder=""
                            value=${data.otherCommentsOnInformationProcessing || ''}
                            rows="5"
                            required>
                        </dbp-form-string-element>
                    </div>
                </article>

                <article>
                    <h3 class="section-sub-title">7. Interessenskonflikte</h3>

                    <dbp-form-enum-element
                        @change="${(e) => {
                            if (e.detail.value) {
                                this.hasConflictOfInterestSubQuestion =
                                    e.detail.value === 'yes' ? true : false;
                            }
                        }}"
                        subscribe="lang"
                        name="hasConflictOfInterest"
                        display-mode="list"
                        required
                        label="7.1. Bestehen mögliche Interessenskonflikte mit dem Auftraggeber und/oder mit Projektpartner*innen?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasConflictOfInterest || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.hasConflictOfInterestSubQuestion
                            ? html`
                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.hasConflictOfInterestSubQuestion,
                                      })}"
                                      subscribe="lang"
                                      name="conflictOfInterestList"
                                      label="Welche"
                                      placeholder="Liste der Interessenskonflikten hier"
                                      value=${data.conflictOfInterestList || ''}
                                      rows="5"
                                      required></dbp-form-string-element>
                              `
                            : ''
                    }

                    <dbp-form-enum-element
                        @change="${(e) => {
                            if (e.detail.value) {
                                this.hasConfidentialPartSubQuestion =
                                    e.detail.value === 'yes' ? true : false;
                            }
                        }}"
                        subscribe="lang"
                        name="hasConfidentalPart"
                        display-mode="list"
                        required
                        label="7.2.	Unterliegen die Ergebnisse Ihres Forschungsvorhabens oder Teile davon der Geheimhaltung bzw. ist die Veröffentlichung und/oder weitere Nutzung untersagt?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasConfidentalPart || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.hasConfidentialPartSubQuestion
                            ? html`
                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.hasConfidentialPartSubQuestion,
                                      })}"
                                      subscribe="lang"
                                      name="natureOfBlocking"
                                      label="7.2.1. Von welcher Art ist diese Sperrung?"
                                      placeholder=""
                                      value=${data.natureOfBlocking || ''}
                                      rows="3"
                                      required></dbp-form-string-element>

                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.hasConfidentialPartSubQuestion,
                                      })}"
                                      subscribe="lang"
                                      name="reasonOfBlocking"
                                      label="7.2.2. Welche Begründung gibt es für die Sperrung?"
                                      placeholder=""
                                      value=${data.reasonOfBlocking || ''}
                                      rows="3"
                                      required></dbp-form-string-element>

                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.hasConfidentialPartSubQuestion,
                                      })}"
                                      subscribe="lang"
                                      name="consequencesOfBlocking"
                                      label="7.2.3. Welche Konsequenzen sind für die Forschenden durch eine Sperrung zu erwarten (insbesondere in Bezug auf Qualifikationsarbeiten)?"
                                      placeholder=""
                                      value=${data.consequencesOfBlocking || ''}
                                      rows="3"
                                      required></dbp-form-string-element>
                              `
                            : ''
                    }

                    <dbp-form-enum-element
                        @change="${(e) => {
                            if (e.detail.value) {
                                this.hasConflictInContentControlSubQuestion =
                                    e.detail.value === 'yes' ? true : false;
                            }
                        }}"
                        subscribe="lang"
                        name="hasConflictInContentControl"
                        display-mode="list"
                        required
                        label="7.3.	Kann es Interessenskonflikte über die Inhaltskontrolle der Veröffentlichung geben?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasConflictInContentControl || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.hasConflictInContentControlSubQuestion
                            ? html`
                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.hasConflictInContentControlSubQuestion,
                                      })}"
                                      subscribe="lang"
                                      name="conflictInContentControlList"
                                      label="Welche"
                                      placeholder="Liste der Interessenskonflikten hier"
                                      value=${data.conflictInContentControlList || ''}
                                      rows="5"
                                      required></dbp-form-string-element>
                              `
                            : ''
                    }

                    <dbp-form-enum-element
                        @change="${(e) => {
                            if (e.detail.value) {
                                this.stakeholderParticipationPlannedSubQuestion =
                                    e.detail.value === 'yes' ? true : false;
                            }
                        }}"
                        subscribe="lang"
                        name="stakeholderParticipationPlanned"
                        display-mode="list"
                        required
                        label="7.4.	Ist die Beteiligung von Stakeholdern geplant?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.stakeholderParticipationPlanned || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.stakeholderParticipationPlannedSubQuestion
                            ? html`
                                  <dbp-form-enum-element
                                      class="${classMap({
                                          'fade-in':
                                              this.stakeholderParticipationPlannedSubQuestion,
                                      })}"
                                      subscribe="lang"
                                      name="hasProvisionForAppropriateRecognition"
                                      display-mode="list"
                                      required
                                      label="7.4.1. Ist eine angemessene Anerkennung von deren Aufwand vorgesehen?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.hasProvisionForAppropriateRecognition ||
                                      ''}></dbp-form-enum-element>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">8. Technikfolgen</h3>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="hasNegativeEffects"
                        display-mode="list"
                        required
                        label="8.1.	Sind negative Auswirkungen auf Individuen und/oder die Gesellschaft zu erwarten (z.B.: Einschränkung der persönlichen Autonomie, möglicher Kompetenzverlust durch zunehmende Automatisierung – „deskilling“, mögliche Auswirkungen auf den Arbeitsmarkt, Diskriminierung)"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasNegativeEffects || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="hasRiskOfReputationDamage"
                        display-mode="list"
                        required
                        label="8.2.	Besteht das Risiko eines Reputationsschadens für die TU Graz?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasRiskOfReputationDamage || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="relatedToDevelopmentOfWeapons"
                        display-mode="list"
                        required
                        label="8.3.	Hat Ihr Projekt mit der Entwicklung von Waffensystemen zu tun?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.relatedToDevelopmentOfWeapons || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="hasDualUse"
                        display-mode="list"
                        required
                        label="8.4.	Könnten Ihre Forschungsergebnisse oder Teile davon eine (Weiter)Verwendung finden (Dual Use, z.B.: im Rahmen der Militärforschung, Überwachung)?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasDualUse || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        @change="${(e) => {
                            if (e.detail.value) {
                                this.riskSubQuestion = e.detail.value === 'yes' ? true : false;
                            }
                        }}"
                        subscribe="lang"
                        name="hasAnyRisks"
                        display-mode="list"
                        required
                        label="8.5.	Ergeben sich unter Berücksichtigung aller Antworten aus Ihrer Sicht Risiken oder Folgeerscheinungen?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasAnyRisks || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.riskSubQuestion
                            ? html`
                                  <dbp-form-string-element
                                      class="${classMap({'fade-in': this.riskSubQuestion})}"
                                      subscribe="lang"
                                      name="risksReasons"
                                      label="Begründung"
                                      required
                                      value=${data.risksReasons || ''}></dbp-form-string-element>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">9. Arbeitsbedingungen im Forschungsvorhaben (soweit sie durch die Projektleitung beeinflusst werden können)</h3>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="employmentContract"
                        display-mode="list"
                        required
                        label="9.1.	Sind in Ihrem Forschungsvorhaben Arbeitsverträge kurzer Dauer (bis zu einem Jahr) geplant?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.employmentContract || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="workLifeBalance"
                        display-mode="list"
                        required
                        label="9.2.	Werden Aspekte der Work-Life-Balance (auch bereits in der Projektplanung) angemessen berücksichtigt?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.workLifeBalance || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="fairCompensation"
                        display-mode="list"
                        required
                        label="9.3.	Gibt es eine angemessene und faire Entlohnung für unterschiedliche Tätigkeiten im Projekt (z.B.: auch für die Annotierung und Bearbeitung von Datensätzen)?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.fairCompensation || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="diversityAspects"
                        display-mode="list"
                        required
                        label=""
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.diversityAspects || ''}>
                        <span slot="label">
                            9.4. Werden im Projekt diversitäts- und gendersensible Aspekte berücksichtigt (<a href='https://tu4u.tugraz.at/fileadmin/public/Studierende_und_Bedienstete/Anleitungen/Diversity-Gender_in_Forschungsprojekten_Checkliste_Deutsch.pdf?sword_list%5B0%5D=gender&sword_list%5B1%5D=forschung&no_cache=1' target='_blank'>siehe Leitfaden der TU Graz</a>)?
                        </span>
                    </dbp-form-enum-element>
                </article>

                <article>
                    <h3 class="section-title">4. Weitere Unterlagen</h3>
                    <div class="description">
                        <p>Falls zutreffend: Bitte legen Sie an Proband*innen gerichtete Fragebögen, Erhebungsbögen oder Aufgabenstellungen Ihrem Antrag bei.</p>
                        <p>Allenfalls können Sie weitere Dokumente beilegen, die aus Ihrer Sicht von Relevanz für die Beurteilung Ihres Forschungsvorhabens im Gesamten sind.</p>
                    </div>

                    <div class="file-upload-container">

                        <h4 class="attachments-title">${i18n.t('render-form.forms.ethics-commission-form.attachments-title')}</h4>

                        <div class="uploaded-files">
                            ${this.renderAttachedFilesHtml()}
                        </div>

                        <button @click="${this.openFilePicker}" class="button is-primary attachment-upload-button">${i18n.t('render-form.forms.ethics-commission-form.attache-file-button-label')}</button>
                    </div>

                    <dbp-file-source
                        id="file-source"
                        class="file-source"
                        allowed-mime-types='application/pdf'
                        max-file-size="50000"
                        enabled-targets="local,clipboard,nextcloud"
                        subscribe="nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-source>

                    <dbp-file-sink
                        id="file-sink"
                        class="file-sink"
                        allowed-mime-types="application/pdf,.pdf"
                        decompress-zip
                        enabled-targets="local,clipboard,nextcloud"
                        filename="ethics-commission-form-${this.formData?.id || ''}-attachments.zip"
                        subscribe="nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-sink>
                </article>
            </form>

            <dbp-modal
                id="pdf-view-modal"
                class="pdf-view-modal"
                modal-id="pdf-viewer-modal"
                subscribe="lang">
                <div slot="content">
                    <dbp-pdf-viewer
                        id="dbp-pdf-viewer"
                        lang="${this.lang}"
                        auto-resize="cover"></dbp-pdf-viewer>
                </div>
            </dbp-modal>

            <dbp-grant-permission-dialog
                id="grant-permission-dialog"
                lang="${this.lang}"
                subscribe="auth"
                entry-point-url="${this.entryPointUrl}"
                resource-identifier="${this.submissionId}"
                resource-class-identifier="DbpRelayFormalizeSubmission"></dbp-grant-permission-dialog>

            ${this.renderResult(this.submitted)}
        `;
    }

    renderStatusBadge() {
        return html`
            ${this.currentState === SUBMISSION_STATES.DRAFT
                ? html`
                      <div class="draft-mode">
                          <span class="draft-mode__text">Draft</span>
                      </div>
                  `
                : ''}
            ${this.currentState === SUBMISSION_STATES.SUBMITTED
                ? html`
                      <div class="draft-mode">
                          <span class="draft-mode__text">Submitted</span>
                      </div>
                  `
                : ''}
            ${this.currentState === SUBMISSION_STATES.ACCEPTED
                ? html`
                      <div class="draft-mode">
                          <span class="draft-mode__text">Accepted</span>
                      </div>
                  `
                : ''}
        `;
    }

    /**
     * Render the buttons needed for the form.
     * @returns {import('lit').TemplateResult} HTML for the button row.
     */
    getButtonRowHtml() {
        const i18n = this._i18n;
        return html`
            <div class="button-row">
                <div class="submission-dates-wrapper">${this.renderSubmissionDates()}</div>
                <div class="buttons-wrapper">
                    ${this.isDeleteSubmissionButtonAllowed
                        ? html`
                              <button
                                  class="form-delete-submission-button button is-secondary"
                                  @click=${this.sendDeleteSubmission}
                                  type="is-secondary"
                                  no-spinner-on-click
                                  title="${i18n.t(
                                      'render-form.forms.ethics-commission-form.delete-submission-button-text-aria',
                                  )}"
                                  aria-label="${i18n.t(
                                      'render-form.forms.ethics-commission-form.delete-submission-button-text-aria',
                                  )}">
                                  <dbp-icon name="trash" aria-hidden="true"></dbp-icon>
                                  <span class="button-label">
                                      ${i18n.t(
                                          'render-form.forms.ethics-commission-form.delete-submission-button-text-label',
                                      )}
                                  </span>
                              </button>
                          `
                        : ''}
                    ${this.isViewModeButtonAllowed
                        ? html`
                              <dbp-button
                                  id="toggle-edit-mode"
                                  class="toggle-edit-mode"
                                  type="is-secondary"
                                  no-spinner-on-click
                                  icon-name="pencil"
                                  @click="${() => {
                                      this.readOnly = !this.readOnly;
                                      const form = this.shadowRoot.querySelector('form');
                                      const data = gatherFormDataFromElement(form);

                                      if (Object.keys(data).length) {
                                          this.formData = data;
                                      }

                                      // Add/remove 'readonly' from the current url
                                      if (this.readOnly) {
                                          this.redirectToReadonlyForm();
                                      } else {
                                          this.redirectToEditForm();
                                      }
                                  }}">
                                  ${this.readOnly
                                      ? html`
                                            <dbp-icon name="pencil"></dbp-icon>
                                            <span class="button-label">
                                                ${i18n.t(
                                                    'render-form.forms.ethics-commission-form.edit-mode',
                                                )}
                                            </span>
                                        `
                                      : html`
                                            <dbp-icon name="source_icons_eye-empty"></dbp-icon>
                                            <span class="button-label">
                                                ${i18n.t(
                                                    'render-form.forms.ethics-commission-form.view-mode',
                                                )}
                                            </span>
                                        `}
                              </dbp-button>
                          `
                        : ''}
                    ${this.isPrintButtonAllowed
                        ? html`
                              <dbp-button
                                  class="form-print-pdf-button"
                                  type="is-secondary"
                                  no-spinner-on-click
                                  @click=${() => this.generatePDF(true)}
                                  title="${i18n.t(
                                      'render-form.forms.ethics-commission-form.print-pdf-button-text',
                                  )}"
                                  aria-label="${i18n.t(
                                      'render-form.forms.ethics-commission-form.print-pdf-button-text',
                                  )}">
                                  <dbp-icon name="printer" aria-hidden="true"></dbp-icon>
                                  <span class="button-label">
                                      ${i18n.t(
                                          'render-form.forms.ethics-commission-form.print-pdf-button-text',
                                      )}
                                  </span>
                              </dbp-button>
                          `
                        : ''}
                    ${this.isDownloadButtonAllowed
                        ? html`
                              <dbp-button
                                  class="form-download-files-button"
                                  type="is-secondary"
                                  no-spinner-on-click
                                  @click=${this.downloadAllFiles}
                                  title="${i18n.t(
                                      'render-form.forms.ethics-commission-form.download-button-text',
                                  )}"
                                  aria-label="${i18n.t(
                                      'render-form.forms.ethics-commission-form.download-button-text',
                                  )}">
                                  <dbp-icon name="download" aria-hidden="true"></dbp-icon>
                                  <span class="button-label">
                                      ${i18n.t(
                                          'render-form.forms.ethics-commission-form.download-button-text',
                                      )}
                                  </span>
                              </dbp-button>
                          `
                        : ''}
                    ${this.isDraftButtonAllowed
                        ? html`
                              <dbp-button
                                  class="form-save-draft-button"
                                  type="is-secondary"
                                  no-spinner-on-click
                                  @click=${this.sendSaveDraft}
                                  title="${i18n.t(
                                      'render-form.forms.ethics-commission-form.save-draft-button-text',
                                  )}"
                                  aria-label="${i18n.t(
                                      'render-form.forms.ethics-commission-form.save-draft-button-text',
                                  )}">
                                  <dbp-icon name="save" aria-hidden="true"></dbp-icon>
                                  <span class="button-label">
                                      ${i18n.t(
                                          'render-form.forms.ethics-commission-form.save-draft-button-text',
                                      )}
                                  </span>
                              </dbp-button>
                          `
                        : ''}
                    ${this.isSubmitButtonEnabled
                        ? html`
                              <dbp-button
                                  class="form-submit-button"
                                  type="is-primary"
                                  no-spinner-on-click
                                  @click=${this.validateAndSendSubmission}
                                  title="${i18n.t(
                                      'render-form.forms.ethics-commission-form.submit-button-text',
                                  )}"
                                  aria-label="${i18n.t(
                                      'render-form.forms.ethics-commission-form.submit-button-text',
                                  )}">
                                  <dbp-icon name="send-diagonal" aria-hidden="true"></dbp-icon>
                                  <span class="button-label">
                                      ${i18n.t(
                                          'render-form.forms.ethics-commission-form.submit-button-text',
                                      )}
                                  </span>
                              </dbp-button>
                          `
                        : ''}
                    ${this.isRetractButtonEnabled
                        ? html`
                              <dbp-button
                                  class="form-retract-button"
                                  type="is-secondary"
                                  disabled
                                  no-spinner-on-click
                                  @click=${this.sendRetractSubmission}
                                  title="${i18n.t(
                                      'render-form.forms.ethics-commission-form.retract-button-text',
                                  )}"
                                  aria-label="${i18n.t(
                                      'render-form.forms.ethics-commission-form.retract-button-text',
                                  )}">
                                  <dbp-icon name="reply" aria-hidden="true"></dbp-icon>
                                  <span class="button-label">
                                      ${i18n.t(
                                          'render-form.forms.ethics-commission-form.retract-button-text',
                                      )}
                                  </span>
                              </dbp-button>
                          `
                        : ''}
                    ${this.isAcceptButtonEnabled
                        ? html`
                              <dbp-button
                                  class="form-accept-button"
                                  type="is-primary"
                                  no-spinner-on-click
                                  @click=${this.sendAcceptSubmission}
                                  title="${i18n.t(
                                      'render-form.forms.ethics-commission-form.accept-button-text',
                                  )}"
                                  aria-label="${i18n.t(
                                      'render-form.forms.ethics-commission-form.accept-button-text',
                                  )}">
                                  <dbp-icon name="checkmark-circle" aria-hidden="true"></dbp-icon>
                                  <span class="button-label">
                                      ${i18n.t(
                                          'render-form.forms.ethics-commission-form.accept-button-text',
                                      )}
                                  </span>
                              </dbp-button>
                          `
                        : ''}
                    ${this.isRevertAcceptButtonEnabled
                        ? html`
                              <dbp-button
                                  class="form-revert-accept-button"
                                  type="is-primary"
                                  no-spinner-on-click
                                  @click=${this.sendRevertAcceptSubmission}
                                  title="${i18n.t(
                                      'render-form.forms.ethics-commission-form.revert-accept-button-text',
                                  )}"
                                  aria-label="${i18n.t(
                                      'render-form.forms.ethics-commission-form.revert-accept-button-text',
                                  )}">
                                  <dbp-icon name="spinner-arrow" aria-hidden="true"></dbp-icon>
                                  <span class="button-label">
                                      ${i18n.t(
                                          'render-form.forms.ethics-commission-form.revert-accept-button-text',
                                      )}
                                  </span>
                              </dbp-button>
                          `
                        : ''}
                </div>
            </div>
        `;
    }

    /**
     * Redirects to the readonly form by appending '/readonly' to the current URL.
     */
    redirectToReadonlyForm() {
        const currentUrl = window.location.href;
        const url = new URL(currentUrl);
        const pathname = url.pathname.replace(/\/+$/, '');
        url.pathname = !pathname.match(/\/readonly$/) ? pathname + '/readonly' : pathname;
        window.history.pushState({}, '', url);
        // Redirect to the new URL
        window.location.href = url.toString();
    }

    /**
     * Redirects to the edit form by removing '/readonly' from the current URL.
     */
    redirectToEditForm() {
        const currentUrl = window.location.href;
        const url = new URL(currentUrl);
        if (url.pathname.endsWith('/readonly')) {
            // Remove '/readonly' from the pathname
            const readOnlyPath = url.pathname.replace(/\/readonly$/, '');
            url.pathname = readOnlyPath;
            window.history.pushState({}, '', url);
            // Redirect to the new URL
            window.location.href = url.toString();
        }
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
                            'render-form.forms.ethics-commission-form.submission-result-thanks',
                        )}
                    </h2>
                    <p>
                        ${i18n.t(
                            'render-form.forms.ethics-commission-form.submission-result-notification',
                        )}
                    </p>
                </div>
            `;
        }

        return html``;
    }
}
