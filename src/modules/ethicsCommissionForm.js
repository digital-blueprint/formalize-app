import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html, css} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import {Translated, sendNotification} from '@dbp-toolkit/common';
import {FileSource, FileSink} from '@dbp-toolkit/file-handling';
import {GrantPermissionDialog} from '@dbp-toolkit/grant-permission-dialog';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {PdfViewer} from '@dbp-toolkit/pdf-viewer';
import {
    getFormRenderUrl,
    getDeletionConfirmation,
    handleDeletionConfirm,
    handleDeletionCancel,
    httpGetAsync,
    SUBMISSION_STATES,
    SUBMISSION_STATES_BINARY,
} from '../utils.js';
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
import {validateRequiredFields} from '@dbp-toolkit/form-elements/src/utils.js';
import html2pdf from 'html2pdf.js';

export default class extends BaseObject {
    getUrlSlug() {
        return 'ethics-proposal';
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

        this.scrollTimeout = null;
        this.needValidationOnLoad = false;

        // Bind event handlers
        this.handleSaveDraft = this.handleSaveDraft.bind(this);
        this.handleFormSubmission = this.handleFormSubmission.bind(this);
        this.handleFormDeleteSubmission = this.handleFormDeleteSubmission.bind(this);
        this.handleFormSaveSubmission = this.handleFormSaveSubmission.bind(this);
        this.handleFilesToSubmit = this.handleFilesToSubmit.bind(this);
        this.handleSelect2Close = this.handleSelect2Close.bind(this);
        this.handleChangeEvents = this.handleChangeEvents.bind(this);
        this.handleValidationOnFocusOut = this.handleValidationOnFocusOut.bind(this);
        this._deletionConfirmationResolve = null;

        // Conditional fields
        this.conditionalFields = {
            isNewSubmission: false,
            isResearchProject: true,
            testSubjects: false,
            testSubjectsTortured: false,
            deadBodies: false,
            humanStemCells: false,
            humanStemCellsUsed: false,
            useOfHumanEmbryos: false,
            cellsObtainedInResearch: false,
            animalsInvolved: false,
            harmfulSubstancesOnSubjects: false,
            complyWithSustainabilityStrategy: false,
            nonEuCountries: false,
            thirdCountriesLocalResources: false,
            hasEthicalIssues: false,
            hasConflictOfInterest: false,
            hasConfidentialPart: false,
            hasConflictInContentControl: false,
            stakeholderParticipationPlanned: false,
            diversityAspects: false,
            hasAnyRisks: false,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            resourceActions: {type: Object, attribute: false},
        };
    }

    static get scopedElements() {
        return {
            ...super.scopedElements,
            'dbp-translated': Translated,
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
        };
    }

    async update(changedProperties) {
        super.update(changedProperties);
        const i18n = this._i18n;

        // console.log('changedProperties', changedProperties);

        if (changedProperties.has('data')) {
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
                            summary: i18n.t('errors.warning-title'),
                            body: i18n.t('errors.form-validation-warning-notification-body'),
                            type: 'warning',
                            timeout: 5,
                        });
                    }
                }
            });
        }

        // if (changedProperties.has('userAllSubmissions')) {
        //     this.setButtonStates();
        // }
    }

    async updated(changedProperties) {
        super.updated(changedProperties);

        if (
            changedProperties.has('data') ||
            changedProperties.has('readOnly') ||
            changedProperties.has('userAllSubmissions')
        ) {
            // Reset observer so it can re-attach if needed
            this._formHeaderObserved = false;
            this.stickyHeaderObserver();
        }
    }

    async processFormData() {
        const i18n = this._i18n;
        try {
            this.currentSubmission = this.data;

            this.submissionId = this.data.identifier;
            this.lastModifiedCreatorId = this.data.lastModifiedById;
            this.formData = JSON.parse(this.data.dataFeedElement);
            this.submissionBinaryState = this.data.submissionState;
            this.submissionGrantedActions = this.data.grantedActions;
            this.selectedTags = this.data.tags;

            // Initialize file groups from schema
            this.initializeFileGroups();

            // Process submitted files by group
            const submittedFiles = {};
            for (const file of this.data.submittedFiles) {
                if (!submittedFiles[file.fileAttributeName]) {
                    submittedFiles[file.fileAttributeName] = [];
                }
                submittedFiles[file.fileAttributeName].push(file);
            }

            this.fileUploadCounts = {};
            for (const [fileGroup, files] of Object.entries(submittedFiles)) {
                this.fileUploadCounts[fileGroup] = files.length;
                // Get or create the file group structure (handles catch-all schemas)
                const groupData = this.getOrCreateFileGroup(fileGroup);
                groupData.submittedFiles = await this.transformApiResponseToFile(files);
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
                            summary: i18n.t('errors.error-title'),
                            body: i18n.t('errors.failed-to-get-last-modifier-details', {
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
                        summary: i18n.t('errors.error-title'),
                        body: i18n.t('errors.failed-to-get-last-modifier-details'),
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
     * Reset submission / state related fields end emit DbpFormalizeFormReset event.
     */
    resetForm(event) {
        super.resetForm(event);

        // Reset all file groups
        for (const fileGroup of Object.keys(this.filesByGroup)) {
            this.filesByGroup[fileGroup] = {
                submittedFiles: new Map(),
                filesToSubmit: new Map(),
                filesToRemove: new Map(),
            };
        }
        this.selectedTags = {};
    }

    static get styles() {
        // language=css
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
                    ${getEthicsCommissionFormCSS()}
                }
            `,
        ];
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

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Listen to the event from file source
            this.addEventListener('dbp-file-source-file-selected', this.handleFilesToSubmit);

            // Event listener for saving draft
            this.addEventListener('DbpFormalizeFormSaveDraft', this.handleSaveDraft);

            // Event listener for form submission
            this.addEventListener('DbpFormalizeFormSubmission', this.handleFormSubmission);

            // Event listener for delete submission
            this.addEventListener(
                'DbpFormalizeFormDeleteSubmission',
                this.handleFormDeleteSubmission,
            );
            // Event listener for save/PATCH submission
            this.addEventListener('DbpFormalizeFormSaveSubmission', this.handleFormSaveSubmission);

            // Event listener for closing select2
            window.addEventListener('click', this.handleSelect2Close);

            // Handle field validation on focus out
            this.shadowRoot.addEventListener('focusout', this.handleValidationOnFocusOut, {
                capture: true,
            });
        });
    }

    /**
     * Run validation on focus out of form elements and set isFormValid property
     * @param {Event} event
     */
    async handleValidationOnFocusOut(event) {
        const currentUrl = window.location.href;
        const url = new URL(currentUrl);
        const needsValidation = url.searchParams.get('validate');
        if (needsValidation !== 'true') return;

        // Only if validation is needed
        const formElement = this.shadowRoot.querySelector('form');
        this.isFormValid = await validateRequiredFields(formElement);
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        this.removeEventListener('DbpFormalizeFormSaveDraft', this.handleSaveDraft);
        this.removeEventListener('DbpFormalizeFormSubmission', this.handleFormSubmission);
        this.removeEventListener(
            'DbpFormalizeFormDeleteSubmission',
            this.handleFormDeleteSubmission,
        );

        this.removeEventListener('DbpFormalizeFormSaveSubmission', this.handleFormSaveSubmission);

        this.removeEventListener('dbp-file-source-file-selected', this.handleFilesToSubmit);

        window.removeEventListener('click', this.handleSelect2Close);
    }

    /**
     * Handle closing select2 dropdown when clicking outside of it
     * @param {CustomEvent} event
     */
    handleSelect2Close(event) {
        const path = event.composedPath();
        const openSelect2 = this._('dbp-form-enum-element[display-mode="tags"]');
        if (!openSelect2) return;

        const openSelect2Input = openSelect2.shadowRoot.querySelector('.select2');
        const openSelect2Dropdown = openSelect2.shadowRoot.querySelector('#select-dropdown');

        // If clicked outside of the select2 component
        if (
            openSelect2 &&
            !path.includes(openSelect2Input) &&
            !path.includes(openSelect2Dropdown)
        ) {
            openSelect2.closeSelect2();
        }
    }

    handleFieldsOfExpertiseItems(event) {
        const selectedValues = event.detail.value || [];
        const NONE_KEY = 'keinem';

        // Get the enum element
        const enumElement = this._('dbp-form-enum-element[name="fieldsOfExpertise"]');
        if (!enumElement) return;

        // Check if "None" was just selected
        const hasNone = selectedValues.includes(NONE_KEY);

        if (hasNone) {
            // If "None" is selected, disable all other options and clear other selections
            const otherKeys = Object.keys(enumElement.items).filter((key) => key !== NONE_KEY);
            enumElement.disabledItems = otherKeys;

            // If there are other values selected besides "None", remove them
            if (selectedValues.length > 1) {
                enumElement.value = [NONE_KEY];
            }
        } else {
            // If "None" is not selected, only disable "None" if there are other selections
            if (selectedValues.length > 0) {
                enumElement.disabledItems = [NONE_KEY];
            } else {
                // No selections, enable everything
                enumElement.disabledItems = [];
            }
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

            if (option.value === 'edit-permissions' && value === 'edit-permissions') {
                this._('#grant-permission-dialog').open();
                return;
            }
        }
    }

    /**
     * Handle saving draft submission.
     * @param {object} event - The event object containing the form data.
     */
    async handleSaveDraft(event) {
        const i18n = this._i18n;
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

        // Iterate over all file groups dynamically
        for (const [fileGroup, groupData] of Object.entries(this.filesByGroup)) {
            // Set files to upload for this group
            if (groupData.filesToSubmit.size > 0) {
                groupData.filesToSubmit.forEach((fileToAttach) => {
                    formData.append(`${fileGroup}[]`, fileToAttach, fileToAttach.name);
                });
            }

            // Set files to remove for this group
            if (groupData.filesToRemove.size > 0) {
                groupData.filesToRemove.forEach((fileObject, fileIdentifier) => {
                    formData.append(`submittedFiles[${fileIdentifier}]`, 'null');
                });
            }
        }

        formData.append('form', '/formalize/forms/' + this.formIdentifier);
        formData.append('dataFeedElement', JSON.stringify(data.formData));
        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.DRAFT));
        // Add tags
        const selectedTags = Object.values(this.selectedTags);
        formData.append('tags', JSON.stringify(selectedTags));

        const method = isExistingDraft ? 'PATCH' : 'POST';
        const options = this._buildRequestOptions(formData, method);
        const url = this._buildSubmissionUrl(isExistingDraft ? this.submissionId : null);

        // Backup all file groups in case of error
        const filesByGroupBackup = {};
        for (const [fileGroup, groupData] of Object.entries(this.filesByGroup)) {
            filesByGroupBackup[fileGroup] = {
                submittedFiles: new Map(groupData.submittedFiles),
                filesToSubmit: new Map(groupData.filesToSubmit),
                filesToRemove: new Map(groupData.filesToRemove),
            };
        }

        try {
            const response = await fetch(url, options);
            let responseBody = await response.json();

            if (!response.ok) {
                sendNotification({
                    summary: i18n.t('errors.error-title'),
                    body: i18n.t('errors.failed-to-save-draft', {
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

                // Process all submitted files by group
                const submittedFilesByGroup = {};
                for (const file of responseBody.submittedFiles) {
                    if (!submittedFilesByGroup[file.fileAttributeName]) {
                        submittedFilesByGroup[file.fileAttributeName] = [];
                    }
                    submittedFilesByGroup[file.fileAttributeName].push(file);
                }

                // Update each file group
                for (const [fileGroup, files] of Object.entries(submittedFilesByGroup)) {
                    const groupData = this.getOrCreateFileGroup(fileGroup);
                    groupData.submittedFiles = await this.transformApiResponseToFile(files);
                    groupData.filesToSubmit = new Map();
                    groupData.filesToRemove = new Map();
                }

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
            // Restore all file groups if something went wrong
            for (const [fileGroup, backup] of Object.entries(filesByGroupBackup)) {
                this.filesByGroup[fileGroup] = backup;
            }

            this.requestUpdate();

            console.error(error);
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t('errors.unknown-error-on-save-draft'),
                type: 'danger',
                timeout: 0,
            });
        } finally {
            // @TODO: We don't need this since we switch to read-only mode after saving draft
            // this.setButtonStates();
        }
    }

    /**
     * Handle saving submission.
     * @param {object} event - The event object containing the form data.
     */
    async handleFormSubmission(event) {
        const i18n = this._i18n;
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

        const formData = new FormData();

        // Iterate over all file groups dynamically
        for (const [fileGroup, groupData] of Object.entries(this.filesByGroup)) {
            // Set files to upload for this group
            if (groupData.filesToSubmit.size > 0) {
                groupData.filesToSubmit.forEach((fileToAttach) => {
                    formData.append(`${fileGroup}[]`, fileToAttach, fileToAttach.name);
                });
            }

            // Set files to remove for this group
            if (groupData.filesToRemove.size > 0) {
                groupData.filesToRemove.forEach((fileObject, fileIdentifier) => {
                    formData.append(`submittedFiles[${fileIdentifier}]`, 'null');
                });
            }
        }

        formData.append('form', '/formalize/forms/' + this.formIdentifier);
        formData.append('dataFeedElement', JSON.stringify(data.formData));
        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.SUBMITTED));
        // Add tags
        const selectedTags = Object.values(this.selectedTags);
        formData.append('tags', JSON.stringify(selectedTags));

        const method = isExistingDraft ? 'PATCH' : 'POST';
        const options = this._buildRequestOptions(formData, method);
        const url = this._buildSubmissionUrl(isExistingDraft ? this.submissionId : null);

        // Backup all file groups in case of error
        const filesByGroupBackup = {};
        for (const [fileGroup, groupData] of Object.entries(this.filesByGroup)) {
            filesByGroupBackup[fileGroup] = {
                submittedFiles: new Map(groupData.submittedFiles),
                filesToSubmit: new Map(groupData.filesToSubmit),
                filesToRemove: new Map(groupData.filesToRemove),
            };
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                this.submissionError = true;
                await this.displayErrors(response);
            } else {
                this.submissionError = false;
                this.currentState = SUBMISSION_STATES.SUBMITTED;
                this.submitted = true;

                // Clear all file groups after successful submission
                for (const fileGroup of Object.keys(this.filesByGroup)) {
                    this.filesByGroup[fileGroup].filesToSubmit = new Map();
                    this.filesByGroup[fileGroup].filesToRemove = new Map();
                }

                // Hide form after successful submission
                this.hideForm = true;
                this.disableLeavePageWarning();
                sendNotification({
                    summary: i18n.t('success.success-title'),
                    body: i18n.t('success.form-submitted-successfully'),
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
            // Restore all file groups if something went wrong
            for (const [fileGroup, backup] of Object.entries(filesByGroupBackup)) {
                this.filesByGroup[fileGroup] = backup;
            }

            console.error(error);
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t('errors.unknown-error-on-form-submission'),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    /**
     * Handle deleting submission.
     * @param {object} event - The event object containing the submission id to delete.
     */
    async handleFormDeleteSubmission(event) {
        const i18n = this._i18n;
        const data = event.detail;
        const submissionId = data.submissionId;

        if (!submissionId) {
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t('errors.no-submission-id-provided'),
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
                    summary: i18n.t('errors.error-title'),
                    body: i18n.t('errors.failed-to-delete-submission-status', {
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
                summary: i18n.t('errors.error-title'),
                body: i18n.t('errors.unknown-error-on-delete-submission'),
                type: 'danger',
                timeout: 0,
            });
        } finally {
            if (this.wasDeleteSubmissionSuccessful) {
                sendNotification({
                    summary: i18n.t('success.success-title'),
                    body: i18n.t('success.form-submission-deleted-successfully'),
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

    /**
     * Handle save (PATCH) submission.
     * @param {object} event - The event object containing the form data.
     */
    async handleFormSaveSubmission(event) {
        const i18n = this._i18n;
        if (!event.detail.submissionId) return;

        const data = event.detail;
        // Include unique identifier for person who is submitting
        data.formData.identifier = this.lastModifiedCreatorId;
        const formData = new FormData();

        // Iterate over all file groups dynamically
        for (const [fileGroup, groupData] of Object.entries(this.filesByGroup)) {
            // Set files to upload for this group
            if (groupData.filesToSubmit.size > 0) {
                groupData.filesToSubmit.forEach((fileToAttach) => {
                    formData.append(`${fileGroup}[]`, fileToAttach, fileToAttach.name);
                });
            }

            // Set files to remove for this group
            if (groupData.filesToRemove.size > 0) {
                groupData.filesToRemove.forEach((fileObject, fileIdentifier) => {
                    formData.append(`submittedFiles[${fileIdentifier}]`, 'null');
                });
            }
        }

        formData.append('dataFeedElement', JSON.stringify(data.formData));
        // Add tags
        const selectedTags = Object.values(this.selectedTags);
        formData.append('tags', JSON.stringify(selectedTags));

        const options = this._buildRequestOptions(formData, 'PATCH');
        const url = this._buildSubmissionUrl(event.detail.submissionId);

        // Backup all file groups in case of error
        const filesByGroupBackup = {};
        for (const [fileGroup, groupData] of Object.entries(this.filesByGroup)) {
            filesByGroupBackup[fileGroup] = {
                submittedFiles: new Map(groupData.submittedFiles),
                filesToSubmit: new Map(groupData.filesToSubmit),
                filesToRemove: new Map(groupData.filesToRemove),
            };
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                await this.displayErrors(response);
            } else {
                const responseBody = await response.json();
                // Process all submitted files by group
                const submittedFilesByGroup = {};
                for (const file of responseBody.submittedFiles) {
                    if (!submittedFilesByGroup[file.fileAttributeName]) {
                        submittedFilesByGroup[file.fileAttributeName] = [];
                    }
                    submittedFilesByGroup[file.fileAttributeName].push(file);
                }

                // Update each file group
                for (const [fileGroup, files] of Object.entries(submittedFilesByGroup)) {
                    const groupData = this.getOrCreateFileGroup(fileGroup);
                    groupData.submittedFiles = await this.transformApiResponseToFile(files);
                    groupData.filesToSubmit = new Map();
                    groupData.filesToRemove = new Map();
                }

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

                sendNotification({
                    summary: i18n.t('success.success-title'),
                    body: i18n.t('success.form-saved-successfully'),
                    type: 'success',
                    timeout: 5,
                });
            }
        } catch (error) {
            // Restore all file groups if something went wrong
            for (const [fileGroup, backup] of Object.entries(filesByGroupBackup)) {
                this.filesByGroup[fileGroup] = backup;
            }

            this.requestUpdate();

            console.error(error);
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t('errors.unknown-error-on-save-submission'),
                type: 'danger',
                timeout: 0,
            });
        }
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
            margin: [70, 51], // Don't change vertical margin or lines can break when printing.
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
            if (el.tagName === 'DBP-TRANSLATED' && el.shadowRoot) {
                const shadowContent = el.shadowRoot.innerHTML;
                const wrapper = document.createElement('div');
                wrapper.innerHTML = shadowContent;

                // For dbp-translated
                const translationSlot = el.querySelector(`[slot="${this.lang}"]`);
                if (translationSlot) {
                    const slotContent = translationSlot.innerHTML;
                    const fieldset = document.createElement('fieldset');

                    fieldset.innerHTML = slotContent;
                    wrapper.append(fieldset);
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

        // Collect all files from all file groups
        const allFiles = [];
        for (const fileGroup of Object.keys(this.filesByGroup)) {
            const groupData = this.getOrCreateFileGroup(fileGroup);
            allFiles.push(...Array.from(groupData.submittedFiles.values()));
        }

        this._('#file-sink').files = [pdfFile, ...allFiles];
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
     * Renders the form in read-only mode.
     * @returns {import('lit').TemplateResult} The HTML for the button row.
     */
    renderFormViews() {
        const i18n = this._i18n;
        const data = this.formData || {};

        return html`

            <style>
                /* Style needs to be inline for html2pdf.js */
                @layer theme, utility, formalize, print;
                @layer print {
                    ${getEthicsCommissionFormPrintCSS()}
                }
            </style>

            <form
                id="ethics-commission-form"
                aria-labelledby="form-title"
                class=${classMap({
                    hidden: this.hideForm,
                    'readonly-mode': this.readOnly,
                    'edit-mode': !this.readOnly,
                    'formalize-form': true,
                })}>

                <div class="form-header">
                    ${this.getButtonRowHtml()}
                </div>

                <h2 class="form-title">${i18n.t('render-form.forms.ethics-commission-form.title')}</h2>

                <dbp-form-enum-view
                    subscribe="lang"
                    name="type"
                    label="${i18n.t('render-form.forms.ethics-commission-form.type-label')}"
                    .items=${{
                        study: i18n.t('render-form.forms.ethics-commission-form.study'),
                        publication: i18n.t('render-form.forms.ethics-commission-form.publication'),
                    }}
                    .value=${data.type || ''}>
                </dbp-form-enum-view>

                <article>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="userTitle"
                        label="${i18n.t('render-form.forms.ethics-commission-form.user-title')}"
                        value=${data.userTitle || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="userTitleShort"
                        label="${i18n.t('render-form.forms.ethics-commission-form.user-title-short')}"
                        value=${data.userTitleShort || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="applicant"
                        label="${i18n.t('render-form.forms.ethics-commission-form.applicant-label')}"
                        value=${data.applicant || ''}>
                    </dbp-form-string-view>

                    <p class="field-note">${i18n.t('render-form.forms.ethics-commission-form.applicant-description')}</p>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="contactDetails"
                        label="${i18n.t('render-form.forms.ethics-commission-form.contact-details-label')}"
                        value=${data.contactDetails || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="jobPosition"
                        label="${i18n.t('render-form.forms.ethics-commission-form.job-position-label')}"
                        value=${data.jobPosition || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="coApplicants"
                        label="${i18n.t('render-form.forms.ethics-commission-form.co-applicants-label')}"
                        value=${data.coApplicants || ''}>
                    </dbp-form-string-view>

                    <p class="field-note">${i18n.t('render-form.forms.ethics-commission-form.co-applicants-description')}</p>

                    <dbp-form-enum-view
                        subscribe="lang"
                        name="fieldsOfExpertise"
                        display-mode="tags"
                        label="${i18n.t('render-form.forms.ethics-commission-form.fields-of-expertise-label')}"
                        .items=${{
                            'advanced-material-sciences': i18n.t(
                                'render-form.forms.ethics-commission-form.advanced-material-sciences',
                            ),
                            'human-and-biotechnology': i18n.t(
                                'render-form.forms.ethics-commission-form.human-and-biotechnology',
                            ),
                            'information-communication-and-computing': i18n.t(
                                'render-form.forms.ethics-commission-form.information-communication-and-computing',
                            ),
                            'mobility-and-production': i18n.t(
                                'render-form.forms.ethics-commission-form.mobility-and-production',
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
                        name="isNewSubmission"
                        data-condition="no"
                        layout-type="${this.tagIsInline}"
                        label="${i18n.t('render-form.forms.ethics-commission-form.is-new-submission-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.isNewSubmission || ''}></dbp-form-enum-view>

                    ${
                        this.conditionalFields.isNewSubmission
                            ? html`
                                  <dbp-form-string-view
                                      subscribe="lang"
                                      name="applicationReferenceNumber"
                                      label="${i18n.t(
                                          'render-form.forms.ethics-commission-form.application-reference-number-label',
                                      )}"
                                      value=${data.applicationReferenceNumber ||
                                      ''}></dbp-form-string-view>
                              `
                            : ''
                    }


                    <dbp-form-enum-view
                        subscribe="lang"
                        name="isResearchProject"
                        data-condition="yes"
                        label="${i18n.t('render-form.forms.ethics-commission-form.is-research-project-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.isResearchProject || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.conditionalFields.isResearchProject
                            ? html`
                                  <dbp-form-enum-view
                                      subscribe="lang"
                                      name="qualificationWork"
                                      label="${i18n.t(
                                          'render-form.forms.ethics-commission-form.qualification-work-label',
                                      )}"
                                      .items=${{
                                          bachelor: i18n.t(
                                              'render-form.forms.ethics-commission-form.bachelor-label',
                                          ),
                                          master: i18n.t(
                                              'render-form.forms.ethics-commission-form.master-label',
                                          ),
                                          doctorat: i18n.t(
                                              'render-form.forms.ethics-commission-form.doctorat-label',
                                          ),
                                      }}
                                      .value=${data.qualificationWork || ''}></dbp-form-enum-view>

                                  <dbp-form-string-view
                                      subscribe="lang"
                                      name="namesOfSupervisingPersons"
                                      label="${i18n.t(
                                          'render-form.forms.ethics-commission-form.names-of-supervising-persons-label',
                                      )}"
                                      value=${data.namesOfSupervisingPersons ||
                                      ''}></dbp-form-string-view>
                              `
                            : ''
                    }

                    <dbp-form-enum-view
                        subscribe="lang"
                        name="isPublicationPlanned"
                        label="${i18n.t('render-form.forms.ethics-commission-form.is-publication-planned-label')}"
                        .items=${{
                            'no-publication': i18n.t(
                                'render-form.forms.ethics-commission-form.no-publication-label',
                            ),
                            'one-publication': i18n.t(
                                'render-form.forms.ethics-commission-form.one-publication-label',
                            ),
                        }}
                        .value=${data.isPublicationPlanned || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.isAdmin
                            ? html`
                                  <dbp-form-string-view
                                      subscribe="lang"
                                      name="studyDescription"
                                      label="${i18n.t(
                                          'render-form.forms.ethics-commission-form.study-description-label',
                                      )}"
                                      value=${data.studyDescription || ''}></dbp-form-string-view>

                                  <dbp-form-date-view
                                      subscribe="lang"
                                      name="studyDescriptionDateOfTransmission"
                                      label="${i18n.t(
                                          'render-form.forms.ethics-commission-form.date-of-transmission-label',
                                      )}"
                                      value=${data.studyDescriptionDateOfTransmission ||
                                      ''}></dbp-form-date-view>

                                  <div class="dbp-form-boolean-view" name="dataProtectionChecked">
                                      <fieldset>
                                          <label>
                                              ${i18n.t(
                                                  'render-form.forms.ethics-commission-form.data-protection-checked-label',
                                              )}
                                          </label>
                                          ${data.dataProtectionChecked === true
                                              ? i18n.t(
                                                    'render-form.forms.ethics-commission-form.yes',
                                                )
                                              : i18n.t(
                                                    'render-form.forms.ethics-commission-form.no',
                                                )}
                                      </fieldset>
                                  </div>

                                  <dbp-form-date-view
                                      subscribe="lang"
                                      name="dataProtectionDate"
                                      label="${i18n.t(
                                          'render-form.forms.ethics-commission-form.data-protection-date-label',
                                      )}"
                                      value=${data.dataProtectionDate || ''}></dbp-form-date-view>
                              `
                            : ''
                    }

                    <dbp-form-string-view
                        subscribe="lang"
                        name="shortDescription"
                        label="${i18n.t(
                            'render-form.forms.ethics-commission-form.short-description-label',
                        )}"
                        value=${data.shortDescription || ''}></dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="dataSource"
                        label="${i18n.t(
                            'render-form.forms.ethics-commission-form.data-source-label',
                        )}"
                        value=${data.dataSource || ''}></dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="numberOfTestPersons"
                        label="${i18n.t('render-form.forms.ethics-commission-form.number-of-test-persons-label')}"
                        value=${data.numberOfTestPersons || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="acquisitionOfTestSubjects"
                        label="${i18n.t('render-form.forms.ethics-commission-form.acquisition-of-test-subjects-label')}"
                        value=${data.acquisitionOfTestSubjects || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="volunteersCompensation"
                        label="${i18n.t('render-form.forms.ethics-commission-form.volunteers-compensation-label')}"
                        value=${data.volunteersCompensation || ''}>
                    </dbp-form-string-view>

                    <p class="field-note">${i18n.t('render-form.forms.ethics-commission-form.volunteers-compensation-description')}</p>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="volunteersCompensationEarlyEnd"
                        label="${i18n.t('render-form.forms.ethics-commission-form.volunteers-compensation-early-end-label')}"
                        value=${data.volunteersCompensationEarlyEnd || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="participationCriteria"
                        label="${i18n.t('render-form.forms.ethics-commission-form.participation-criteria-label')}"
                        value=${data.participationCriteria || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="subjectsDependencies"
                        label="${i18n.t('render-form.forms.ethics-commission-form.subjects-dependencies-label')}"
                        value=${data.subjectsDependencies || ''}>
                    </dbp-form-string-view>

                    <p class="field-note">${i18n.t('render-form.forms.ethics-commission-form.subjects-dependencies-description')}</p>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="founding"
                        label="${i18n.t('render-form.forms.ethics-commission-form.founding-label')}"
                        value=${data.founding || ''}>
                    </dbp-form-string-view>

                    <dbp-form-date-view
                        subscribe="lang"
                        name="projectStartDate"
                        label="${i18n.t('render-form.forms.ethics-commission-form.project-start-date-label')}"
                        value=${data.projectStartDate || ''}>
                    </dbp-form-date-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="projectDuration"
                        label="${i18n.t('render-form.forms.ethics-commission-form.project-duration-label')}"
                        value=${data.projectDuration || ''}>
                    </dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="reasonOfSubmission"
                        label="${i18n.t('render-form.forms.ethics-commission-form.reason-of-submission-label')}"
                        value=${data.reasonOfSubmission || ''}>
                    </dbp-form-string-view>
                </article>

                <article>

                    <h3 class="section-title">${i18n.t('render-form.forms.ethics-commission-form.section-i-title')}</h3>

                    <div class="description">
                        <p>${i18n.t('render-form.forms.ethics-commission-form.section-i-description-1')}</p>
                        <p>${i18n.t('render-form.forms.ethics-commission-form.section-i-description-2')}</p>
                        <p>${i18n.t('render-form.forms.ethics-commission-form.section-i-description-3')}</p>
                        <p>${i18n.t('render-form.forms.ethics-commission-form.section-i-description-4')}</p>
                    </div>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="researchProjectDescription"
                        label="${i18n.t('render-form.forms.ethics-commission-form.research-project-description-label')}"
                        value=${data.researchProjectDescription || ''}>
                    </dbp-form-string-view>
                </article>

                <article>
                    <h3 class="section-title">${i18n.t('render-form.forms.ethics-commission-form.section-ii-title')}</h3>

                    <div class="description">
                        <dbp-translated subscribe="lang">
                            <div slot="de">
                                <p>Wenn Menschen als Proband*innen mitwirken:</p>
                                <p>Die Proband*innen sollen von der Studienleitung über folgende Punkte informiert werden (beispielsweise durch eine Proband*innen-Information und Einwilligungserklärung zur Teilnahme am Forschungsvorhaben):</p>
                                <ol class="lettered-list">
                                    <li><p>Genaue Angabe von Titel, Zweck und Dauer Ihres Forschungsvorhabens sowie Erklärung des Ablaufs für die Proband*innen in einfacher und klarer Sprache (bitte vermeiden Sie nach Möglichkeit Fremdwörter)</p></li>
                                    <li><p>Angaben zur durchführenden Forschungseinrichtung und zu einer verantwortlichen Kontaktperson (Vor- und Nachname, E-Mail-Adresse und evtl. Telefonnummer) für weitere Fragen, Anregungen oder Beschwerden</p></li>
                                    <li><p>Angabe möglicher Risiken für die Proband*innen (Unannehmlichkeiten, Gefahren, Belastungen) und etwaiger Folgen</p></li>
                                    <li>
                                        <p>Angaben über die Höhe der Aufwandsentschädigung (auch im Falle eines vorzeitigen Abbruchs) sowie eines sonstigen Nutzens für die Proband*innen</p>
                                        <div class="info-box">
                                            <p>Bitte kümmern Sie sich frühzeitig um ein entsprechendes Budget für Aufwandsentschädigungen für die Proband*innen Ihrer Studie (Budgetierung in Forschungsanträgen)!</p>
                                            <p>Die Angemessenheit der Aufwandsentschädigung hängt zunächst davon ab, ob es für die Durchführung der Studie eine Finanzierung gibt oder nicht. </p>
                                            <p>Wenn es eine Finanzierung gibt, empfehlen wir in Abhängigkeit der folgenden Kriterien eine Aufwandsentschädigung in Höhe von EUR 10 bis 25 pro Stunde in Form von Holding-GrazGutscheinen oder Supermarkt-Gutscheinen:</p>
                                            <ol>
                                                <li><p>Je nach Art der Studienteilnahme und Aufwand für die Proband*innen: Füllen Proband*innen einen Fragebogen aus, führen sie ein Tagebuch, erfüllen sie Aufgaben und/oder kommt es zu psychophysiologischen Datenerhebungen?</p></li>
                                                <li><p>Je nach Dauer der Studienteilnahme: Einmalig, wiederholt, aufgewandte Zeit gesamt </p></li>
                                                <li><p>je nach Qualität und Quantität der Daten von Proband*innen: soziodemographische Daten oder zusätzlich auch Gesundheitsdaten?</p></li>
                                            </ol>
                                            <p>Wenn es keine Finanzierung gibt, empfehlen wir, die Proband*innen für die Teilnahme an Ihrer Studie mit einer symbolischen Anerkennung, zB in Form von Schokolade, Verlosung von Goodies oder individuelle Rückmeldung zu ihren Datenauswertungen, zu bedenken.</p>
                                            <p>Unabhängig von der Finanzierung bitten wir Sie, Aufwandsentschädigungen auch für jene Proband*innen aliquot vorzusehen, die ihre Studienteilnahme aus welchem Grund auch immer frühzeitig abbrechen.</p>
                                            <p>Hinweis In erster Linie werden aufgrund der Regionalität Holding-GrazGutscheine oder Supermarkt-Gutscheine empfohlen. Gemäß TU Graz-Richtlinie zur Beschaffung, RL 96000 RLBS 172-01, dürfen Mitarbeitende der TU Graz keine Bargeld-Leistung als Aufwandsentschädigung für Ihre Studienteilnahme erhalten.</p>
                                        </div>
                                    </li>
                                    <li><p>Hinweis auf die Freiwilligkeit der Teilnahme inklusive des Rechts, die Einwilligung jederzeit ohne Angabe von Gründen widerrufen und die Teilnahme vorzeitig abbrechen zu können, ohne dass den Proband*innen dadurch ein Nachteil entsteht</p></li>
                                    <li><p>Hinweis auf die erfolgte Behandlung durch die Ethikkommission</p></li>
                                    <li><p>Hinweis auf die Richtlinie für Hinweisgeber und den elektronischen Briefkasten für anonyme Hinweise an der TU Graz (Whistleblowing)</p></li>
                                    <li><p>Elektronischer Briefkasten für anonyme Hinweise (Whistleblowing), <a target="_blank" href="https://www.tugraz.at/ueber-diese-seite/elektronischer-briefkasten-fuer-anonyme-hinweise-whistleblowing">whistleblowing</a></p></li>
                                    <li><p>Einwilligungserklärung der Proband*innen (bzw. von deren gesetzlichen Vertreter*innen) zur Teilnahme an der Studie</p></li>
                                </ol>
                            </div>
                            <div slot="en">
                                <p>Should humans engage as participants:</p>
                                <p>The participants should be informed by the study management about the following points (e.g.: by means of a participant information sheet and declaration of consent to participate in the research project):</p>
                                <ol class="lettered-list">
                                    <li><p>Precisely state the title, purpose and duration of your research project and explain the procedure to the participants in simple and clear language (please avoid technical terms if possible)</p></li>
                                    <li><p>Details of the research institution conducting the study and a responsible contact person (first and last name, e-mail address and telephone number if applicable) for further questions, suggestions or complaints </p></li>
                                    <li><p>Indication of possible risks for the participants (inconvenience, danger, stress) and possible consequences</p></li>
                                    <li>
                                        <p>Information on the amount of the compensation (including in the event of premature termination) and other benefits for the participants</p>
                                        <div class="info-box">
                                            <p>Please ensure that funding for the participant compensation is secured at an early stage of the planning (budgeting in research proposals)!</p>
                                            <p>The appropriateness of the compensation depends first and foremost on whether or not funding is available for the study.</p>
                                            <p>If funding is available, we recommend a compensation of EUR 10 to 25 per hour in the form of Holding-Graz vouchers or supermarket vouchers, depending on the following criteria:</p>
                                            <ol>
                                                <li><p>Depending on the type of study participation and effort required of the participants: Do participants fill out a questionnaire, keep a diary, perform tasks, and/or undergo psychophysiological data collection?</p></li>
                                                <li><p>Depending on the duration of study participation: One-time, repeated, total time spent</p></li>
                                                <li><p>Depending on the quality and quantity of the data provided by the participants: sociodemographic data or additional health data?</p></li>
                                            </ol>
                                            <p>If no funding is available, we recommend rewarding the participants for participating in your study with a symbolic token of appreciation, e.g., a raffle for goodies or individual feedback on their data evaluations or information on the study results.</p>
                                            <p>Regardless of funding, we ask that you also provide pro rata compensation for those participants who withdraw from the study early for any reason. In any case, we recommend sharing the study results with participants.</p>
                                            <p>Due to regional considerations, Holding Graz vouchers or supermarket vouchers are recommended. In accordance with TU Graz procurement guidelines RL 96000 RLBS 172-01, TU Graz employees may not receive cash payments as expense allowances for participating in studies.</p>
                                        </div>
                                    </li>
                                    <li><p>Reference to the voluntary nature of participation, including the right to withdraw consent at any time without giving reasons and to terminate participation prematurely without any disadvantage to the participants</p></li>
                                    <li><p>Reference to the Ethics Committee’s decision</p></li>
                                    <li><p>Reference to the TU Graz Whistleblowing Policy and the Electronic Mailbox for Anonymous Tips (Whistleblowing)</p></li>
                                    <li><p>Electronic Mailbox for Anonymous Tips (Whistleblowing), <a target="_blank" href="https://www.tugraz.at/ueber-diese-seite/elektronischer-briefkasten-fuer-anonyme-hinweise-whistleblowing">whistleblowing</a>.</p></li>
                                    <li><p>Declaration of consent of the participants (or their legal representatives) to participate in the study </p></li>
                                    </ol>
                            </div>
                        </dbp-translated>
                    </div>
                </article>

                <article>
                    <h3 class="section-title">${i18n.t('render-form.forms.ethics-commission-form.section-iii-title')}</h3>

                    <div class="description">
                        <p>${i18n.t('render-form.forms.ethics-commission-form.section-iii-description')}</p>
                        <dbp-translated subscribe="lang">
                            <div slot="de">
                                <p class="field-note">Angelehnt an den Kriterienkatalog der Europäischen Kommission im Zusammenhang von EU-Grants/Horizon Europe aus dem Jahr 2021.</p>
                            </div>
                            <div slot="en">
                                <p class="field-note">Based on the European Commission's list of criteria in connection with EU grants/Horizon Europe from 2021.</p>
                            </div>
                        </dbp-translated>
                    </div>

                    <h4 class="section-sub-title">1. ${i18n.t('render-form.forms.ethics-commission-form.section-people-title')}</h4>

                    <dbp-form-enum-view
                        data-condition="yes"
                        subscribe="lang"
                        name="testSubjects"
                        label="${i18n.t('render-form.forms.ethics-commission-form.test-subjects-label')}"
                        description="${i18n.t('render-form.forms.ethics-commission-form.test-subject-description')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.testSubjects || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.conditionalFields.testSubjects
                            ? html`
                                  <div class="question-group">
                                      <h4 class="question-group-title">
                                          1.1.
                                          ${i18n.t(
                                              'render-form.forms.ethics-commission-form.human-participants-subtitle',
                                          )}
                                      </h4>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="testSubjectsVoluntary"
                                          label="1.1.1 ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-voluntary-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsVoluntary ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="isSelfExperiment"
                                          label="1.1.2. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.is-self-experiment-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.isSelfExperiment ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="testSubjectsInformedConsent"
                                          label="1.1.3. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-informed-consent-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsInformedConsent ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="testSubjectsConsentSigned"
                                          label="1.1.4. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-consent-signed-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsConsentSigned ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="testSubjectsWithdrawPossible"
                                          label="1.1.5. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-withdraw-possible-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsWithdrawPossible ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="testSubjectsDependent"
                                          label="1.1.6. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-dependent-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsDependent ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="testSubjectsVulnerable"
                                          label="1.1.7. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-vulnerable-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsVulnerable ||
                                          ''}></dbp-form-enum-view>
                                  </div>

                                  <div class="question-group">
                                      <h4 class="question-group-title">
                                          1.2.
                                          ${i18n.t(
                                              'render-form.forms.ethics-commission-form.interventions-subtitle',
                                          )}
                                      </h4>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="invasiveTechniquesUsed"
                                          label="1.2.1. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.invasive-techniques-used-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.invasiveTechniquesUsed ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="influenceOnBrainActivity"
                                          label="1.2.2. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.influence-on-brain-activity-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.influenceOnBrainActivity ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          data-condition="yes"
                                          subscribe="lang"
                                          name="testSubjectsTortured"
                                          label="1.2.3. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-tortured-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsTortured ||
                                          ''}></dbp-form-enum-view>

                                      ${this.conditionalFields.testSubjectsTortured
                                          ? html`
                                                <dbp-form-string-view
                                                    subscribe="lang"
                                                    name="testSubjectsTorturedExamples"
                                                    label="1.2.3.1 ${i18n.t(
                                                        'render-form.forms.ethics-commission-form.test-subjects-tortured-example-label',
                                                    )}"
                                                    value=${data.testSubjectsTorturedExamples || ''}
                                                    required></dbp-form-string-view>
                                            `
                                          : ''}

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="testSubjectsHarmed"
                                          label="1.2.4. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-harmed-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsHarmed ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="testSubjectsRisksJustified"
                                          label="1.2.5. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-risks-justified-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsRisksJustified ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="testSubjectsRiskMinimized"
                                          label="1.2.6. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-risk-minimized-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsRiskMinimized ||
                                          ''}></dbp-form-enum-view>
                                  </div>

                                  <div class="question-group">
                                      <h4 class="question-group-title">
                                          1.3.
                                          ${i18n.t(
                                              'render-form.forms.ethics-commission-form.reasonableness-subtitle',
                                          )}
                                      </h4>
                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="testSubjectsReasonableToParticipate"
                                          label="1.3.1 ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-reasonable-to-participate-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsReasonableToParticipate ||
                                          ''}></dbp-form-enum-view>
                                  </div>
                              `
                            : ''
                    }

                    <h4 class="question-group-title">
                        1.4. ${i18n.t(
                            'render-form.forms.ethics-commission-form.dead-bodies-subtitle',
                        )}
                    </h4>

                    <dbp-form-enum-view
                        data-condition="yes"
                        subscribe="lang"
                        name="deadBodies"
                        label="${i18n.t('render-form.forms.ethics-commission-form.dead-bodies-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.deadBodies || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.conditionalFields.deadBodies
                            ? html`
                                  <div class="question-group">
                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="legalDocumentsAvailable"
                                          label="1.4.1. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.legal-documents-available-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.legalDocumentsAvailable ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="disturbanceOfPeaceOfDead"
                                          label="1.4.2. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.disturbance-of-peace-of-dead-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.disturbanceOfPeaceOfDead ||
                                          ''}></dbp-form-enum-view>
                                  </div>
                              `
                            : ''
                    }

                    <h4 class="question-group-title">
                        1.5. ${i18n.t(
                            'render-form.forms.ethics-commission-form.human-stem-cells-subtitle',
                        )}
                    </h4>

                    <dbp-form-enum-view
                        data-condition="yes"
                        subscribe="lang"
                        name="humanStemCells"
                        label="${i18n.t('render-form.forms.ethics-commission-form.human-stem-cells-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.humanStemCells || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.conditionalFields.humanStemCells
                            ? html`
                                  <div class="question-group">
                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="humanTissueUsed"
                                          label="1.5.1. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.human-tissue-used-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.humanTissueUsed || ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          data-condition="yes"
                                          subscribe="lang"
                                          name="humanStemCellsUsed"
                                          label="1.5.2. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.human-stem-cells-used-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.humanStemCellsUsed ||
                                          ''}></dbp-form-enum-view>

                                      ${this.conditionalFields.humanStemCellsUsed
                                          ? html`
                                                <dbp-form-enum-view
                                                    subscribe="lang"
                                                    name="stemCellsFromEmbryos"
                                                    label="1.5.2.1. ${i18n.t(
                                                        'render-form.forms.ethics-commission-form.stem-cells-from-embryos-label',
                                                    )}"
                                                    .items=${{
                                                        yes: i18n.t(
                                                            'render-form.forms.ethics-commission-form.yes',
                                                        ),
                                                        no: i18n.t(
                                                            'render-form.forms.ethics-commission-form.no',
                                                        ),
                                                    }}
                                                    .value=${data.stemCellsFromEmbryos ||
                                                    ''}></dbp-form-enum-view>
                                            `
                                          : ''}

                                      <dbp-form-enum-view
                                          data-condition="yes"
                                          subscribe="lang"
                                          name="useOfHumanEmbryos"
                                          label="1.5.3. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.use-of-human-embryos-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.useOfHumanEmbryos ||
                                          ''}></dbp-form-enum-view>

                                      ${this.conditionalFields.useOfHumanEmbryos
                                          ? html`
                                                <dbp-form-enum-view
                                                    subscribe="lang"
                                                    name="stemCellsFromEmbryosDestroyed"
                                                    label="1.5.3.1. ${i18n.t(
                                                        'render-form.forms.ethics-commission-form.stem-cells-from-embryos-destroyed-label',
                                                    )}"
                                                    .items=${{
                                                        yes: i18n.t(
                                                            'render-form.forms.ethics-commission-form.yes',
                                                        ),
                                                        no: i18n.t(
                                                            'render-form.forms.ethics-commission-form.no',
                                                        ),
                                                    }}
                                                    .value=${data.stemCellsFromEmbryosDestroyed ||
                                                    ''}></dbp-form-enum-view>
                                            `
                                          : ''}

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="commerciallyAvailableCells"
                                          label="1.5.4. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.commercially-available-cells-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.commerciallyAvailableCells ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          data-condition="no"
                                          subscribe="lang"
                                          name="cellsObtainedInResearch"
                                          label="1.5.5 ${i18n.t(
                                              'render-form.forms.ethics-commission-form.cells-obtained-in-research-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.cellsObtainedInResearch ||
                                          ''}></dbp-form-enum-view>

                                      ${this.conditionalFields.cellsObtainedInResearch
                                          ? html`
                                                <dbp-form-string-view
                                                    subscribe="lang"
                                                    name="tissueOrCellsSource"
                                                    label="1.5.5.1 ${i18n.t(
                                                        'render-form.forms.ethics-commission-form.tissue-or-cells-source-label',
                                                    )}"
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
                    <h3 class="section-sub-title">2. ${i18n.t('render-form.forms.ethics-commission-form.section-animals-title')}</h3>

                    <dbp-form-enum-view
                        data-condition="yes"
                        subscribe="lang"
                        name="animalsInvolved"
                        label="${i18n.t('render-form.forms.ethics-commission-form.section-animals-involved-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.animalsInvolved || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.conditionalFields.animalsInvolved
                            ? html`
                                  <div class="question-group ">
                                      <h4 class="question-group-title">
                                          2.1.
                                          ${i18n.t(
                                              'render-form.forms.ethics-commission-form.section-animals-in-research-subtitle',
                                          )}
                                      </h4>
                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="isAnimalVertebrate"
                                          label="2.1.1. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.is-animal-vertebrate-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.isAnimalVertebrate ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="nonHumanPrimates"
                                          label="2.1.2. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.non-human-primates-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.nonHumanPrimates ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="geneticallyModifiedAnimals"
                                          label="2.1.3. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.genetically-modified-animals-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.geneticallyModifiedAnimals ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="endangeredSpecies"
                                          label="2.1.4. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.endangered-species-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.endangeredSpecies ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="alternativesToUseLaboratoryAnimals"
                                          label="2.1.5. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.alternatives-to-use-laboratory-animals-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.alternativesToUseLaboratoryAnimals ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="laboratoryAnimalsHarmed"
                                          label="2.1.6. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.laboratory-animals-harmed-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.laboratoryAnimalsHarmed ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="isRiskJustified"
                                          label="2.1.7. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.is-risk-justified-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.isRiskJustified || ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="relevantLegalDocumentAvailable"
                                          label="2.1.8. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.relevant-legal-document-available-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.relevantLegalDocumentAvailable ||
                                          ''}></dbp-form-enum-view>
                                  </div>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">3. ${i18n.t('render-form.forms.ethics-commission-form.section-sustainability-title')}</h3>

                        <dbp-form-enum-view
                            subscribe="lang"
                            name="harmfulSubstances"
                            label="3.1. ${i18n.t('render-form.forms.ethics-commission-form.harmful-substances-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.harmfulSubstances || ''}>
                        </dbp-form-enum-view>

                        <dbp-form-enum-view
                            subscribe="lang"
                            name="negativeImpactsOnNature"
                            label="3.2. ${i18n.t('render-form.forms.ethics-commission-form.negative-impacts-on-nature-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.negativeImpactsOnNature || ''}>
                        </dbp-form-enum-view>

                        <dbp-form-enum-view
                            data-condition="yes"
                            subscribe="lang"
                            name="harmfulSubstancesOnSubjects"
                            label="3.3. ${i18n.t('render-form.forms.ethics-commission-form.harmful-substances-on-subjects-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.harmfulSubstancesOnSubjects || ''}>
                        </dbp-form-enum-view>

                        ${
                            this.conditionalFields.harmfulSubstancesOnSubjects
                                ? html`
                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="adequateSafetyMeasures"
                                          label="3.3.1. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.adequate-safety-measures-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.adequateSafetyMeasures ||
                                          ''}></dbp-form-enum-view>
                                  `
                                : ''
                        }

                        <dbp-form-enum-view
                            data-condition="yes"
                            subscribe="lang"
                            name="complyWithSustainabilityStrategy"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.complyWithSustainabilityStrategy || ''}>
                            <span slot="label">
                                <dbp-translated subscribe="lang">
                                    <div slot="de">
                                        3.4. Entspricht Ihr Forschungsvorhaben der <a href='https://www.tugraz.at/tu-graz/universitaet/klimaneutrale-tu-graz/roadmap/' target='_blank'>Nachhaltigkeitsstrategie</a> der TU Graz?
                                    </div>
                                    <div slot="en">
                                        3.4. Does your research project comply with the (<a href='https://www.tugraz.at/en/tu-graz/university/climate-neutral-tu-graz/roadmap/' target='_blank'>TU Graz sustainability strategy</a>)?
                                    </div>
                                </dbp-translated>
                            </span>
                        </dbp-form-enum-view>

                        ${
                            this.conditionalFields.complyWithSustainabilityStrategy
                                ? html`
                                      <dbp-form-string-view
                                          class="question-group"
                                          subscribe="lang"
                                          name="appropriateUseOfResources"
                                          label="3.5. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.appropriate-use-of-resources-label',
                                          )}"
                                          value=${data.appropriateUseOfResources ||
                                          ''}></dbp-form-string-view>
                                  `
                                : ''
                        }

                    </div>
                </article>

                <article>
                    <h3 class="section-sub-title">4. ${i18n.t('render-form.forms.ethics-commission-form.section-non-eu-states-title')}</h3>
                    <dbp-form-enum-view
                        data-condition="yes"
                        subscribe="lang"
                        name="nonEuCountries"
                        label="${i18n.t('render-form.forms.ethics-commission-form.non-eu-countries-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.nonEuCountries || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.conditionalFields.nonEuCountries
                            ? html`
                                  <div class="question-group">
                                      <h4 class="question-group-title">
                                          4.1
                                          ${i18n.t(
                                              'render-form.forms.ethics-commission-form.section-non-eu-countries-subtitle',
                                          )}
                                      </h4>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="ethicalIssues"
                                          label="4.1.1. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.ethical-issues-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.ethicalIssues || ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          data-condition="yes"
                                          subscribe="lang"
                                          name="thirdCountriesLocalResources"
                                          label="4.1.2. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.third-countries-local-resources-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.thirdCountriesLocalResources ||
                                          ''}></dbp-form-enum-view>

                                      ${this.conditionalFields.thirdCountriesLocalResources
                                          ? html`
                                                <dbp-form-enum-view
                                                    subscribe="lang"
                                                    name="questionResearchFounds"
                                                    label="4.1.2.1. ${i18n.t(
                                                        'render-form.forms.ethics-commission-form.question-research-founds-label',
                                                    )}"
                                                    .items=${{
                                                        yes: i18n.t(
                                                            'render-form.forms.ethics-commission-form.yes',
                                                        ),
                                                        no: i18n.t(
                                                            'render-form.forms.ethics-commission-form.no',
                                                        ),
                                                    }}
                                                    .value=${data.questionResearchFounds ||
                                                    ''}></dbp-form-enum-view>
                                            `
                                          : ''}

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="importMaterialFromThirdCountries"
                                          label="4.1.3. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.import-material-from-third-countries-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.importMaterialFromThirdCountries ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="lowIncomeCountries"
                                          label="4.1.4. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.low-income-countries-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.lowIncomeCountries ||
                                          ''}></dbp-form-enum-view>

                                      <dbp-form-enum-view
                                          subscribe="lang"
                                          name="exposeParticipantsToRisk"
                                          label="4.1.5. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.expose-participants-to-risk-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.exposeParticipantsToRisk ||
                                          ''}></dbp-form-enum-view>
                                  </div>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">5. ${i18n.t('render-form.forms.ethics-commission-form.section-information-systems-title')}</h3>

                    <div class="question-group">

                        <dbp-form-enum-view
                            subscribe="lang"
                            name="replaceHumanDecisionMaking"
                            label="5.1. ${i18n.t('render-form.forms.ethics-commission-form.replace-human-decision-making-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.replaceHumanDecisionMaking || ''}>
                        </dbp-form-enum-view>

                        <dbp-form-enum-view
                            subscribe="lang"
                            name="potentiallyStigmatizePeople"
                            label="5.2. ${i18n.t('render-form.forms.ethics-commission-form.potentially-stigmatize-people-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.potentiallyStigmatizePeople || ''}>
                        </dbp-form-enum-view>

                        <dbp-form-enum-view
                            subscribe="lang"
                            name="negativeSocialConsequences"
                            label="5.3. ${i18n.t('render-form.forms.ethics-commission-form.negative-social-consequences-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.negativeSocialConsequences || ''}>
                        </dbp-form-enum-view>

                        <dbp-form-enum-view
                            subscribe="lang"
                            name="weaponSystem"
                            label="5.4. ${i18n.t('render-form.forms.ethics-commission-form.weapon-system-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.weaponSystem || ''}>
                        </dbp-form-enum-view>

                        <dbp-form-enum-view
                            data-condition="yes"
                            subscribe="lang"
                            name="hasEthicalIssues"
                            label="5.5. ${i18n.t('render-form.forms.ethics-commission-form.has-ethical-issues-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.hasEthicalIssues || ''}>
                        </dbp-form-enum-view>

                        ${
                            this.conditionalFields.hasEthicalIssues
                                ? html`
                                      <dbp-form-string-view
                                          subscribe="lang"
                                          name="ethicalIssuesList"
                                          label="${i18n.t(
                                              'render-form.forms.ethics-commission-form.ethical-issues-list-label',
                                          )}"
                                          value=${data.ethicalIssuesList ||
                                          ''}></dbp-form-string-view>
                                  `
                                : ''
                        }

                        <dbp-form-string-view
                            subscribe="lang"
                            name="otherCommentsOnInformationProcessing"
                            label="${i18n.t('render-form.forms.ethics-commission-form.other-comments-on-information-processing-label')}"
                            value=${data.otherCommentsOnInformationProcessing || ''}>
                        </dbp-form-string-view>
                    </div>
                </article>

                <article>
                    <h3 class="section-sub-title">6. ${i18n.t('render-form.forms.ethics-commission-form.section-conflicts-of-interest-title')}</h3>

                    <dbp-form-enum-view
                        data-condition="yes"
                        subscribe="lang"
                        name="hasConflictOfInterest"
                        label="6.1. ${i18n.t('render-form.forms.ethics-commission-form.has-conflict-of-interest-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasConflictOfInterest || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.conditionalFields.hasConflictOfInterest
                            ? html`
                                  <dbp-form-string-view
                                      subscribe="lang"
                                      name="conflictOfInterestList"
                                      label="${i18n.t(
                                          'render-form.forms.ethics-commission-form.conflict-of-interest-list-label',
                                      )}"
                                      value=${data.conflictOfInterestList ||
                                      ''}></dbp-form-string-view>
                              `
                            : ''
                    }

                    <dbp-form-enum-view
                        data-condition="yes"
                        subscribe="lang"
                        name="hasConfidentialPart"
                        label="6.2. ${i18n.t('render-form.forms.ethics-commission-form.has-confidential-part-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasConfidentialPart || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.conditionalFields.hasConfidentialPart
                            ? html`
                                  <dbp-form-string-view
                                      subscribe="lang"
                                      name="natureOfBlocking"
                                      label="6.2.1. ${i18n.t(
                                          'render-form.forms.ethics-commission-form.nature-of-blocking-label',
                                      )}"
                                      value=${data.natureOfBlocking || ''}></dbp-form-string-view>

                                  <dbp-form-string-view
                                      subscribe="lang"
                                      name="reasonOfBlocking"
                                      label="6.2.2. ${i18n.t(
                                          'render-form.forms.ethics-commission-form.reason-of-blocking-label',
                                      )}"
                                      value=${data.reasonOfBlocking || ''}></dbp-form-string-view>

                                  <dbp-form-string-view
                                      subscribe="lang"
                                      name="consequencesOfBlocking"
                                      label="6.2.3. ${i18n.t(
                                          'render-form.forms.ethics-commission-form.consequences-of-blocking-label',
                                      )}"
                                      value=${data.consequencesOfBlocking ||
                                      ''}></dbp-form-string-view>

                                  <dbp-form-string-view
                                      subscribe="lang"
                                      name="canBeDoneDespiteRestrictions"
                                      label="6.2.4. ${i18n.t(
                                          'render-form.forms.ethics-commission-form.can-be-done-despite-restrictions-label',
                                      )}"
                                      value=${data.canBeDoneDespiteRestrictions ||
                                      ''}></dbp-form-string-view>
                              `
                            : ''
                    }

                    <dbp-form-enum-view
                        data-condition="yes"
                        subscribe="lang"
                        name="hasConflictInContentControl"
                        label="6.3. ${i18n.t('render-form.forms.ethics-commission-form.has-conflict-in-content-control-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasConflictInContentControl || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.conditionalFields.hasConflictInContentControl
                            ? html`
                                  <dbp-form-string-view
                                      subscribe="lang"
                                      name="conflictInContentControlList"
                                      label="6.3.1 ${i18n.t(
                                          'render-form.forms.ethics-commission-form.conflict-in-content-control-list-label',
                                      )}"
                                      value=${data.conflictInContentControlList ||
                                      ''}></dbp-form-string-view>
                              `
                            : ''
                    }

                    <dbp-form-enum-view
                        data-condition="yes"
                        subscribe="lang"
                        name="stakeholderParticipationPlanned"
                        label="6.4. ${i18n.t('render-form.forms.ethics-commission-form.stakeholder-participation-planned-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.stakeholderParticipationPlanned || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.conditionalFields.stakeholderParticipationPlanned
                            ? html`
                                  <dbp-form-enum-view
                                      subscribe="lang"
                                      name="hasProvisionForAppropriateRecognition"
                                      label="6.4.1. ${i18n.t(
                                          'render-form.forms.ethics-commission-form.provision-for-appropriate-recognition-label',
                                      )}"
                                      .items=${{
                                          yes: i18n.t(
                                              'render-form.forms.ethics-commission-form.yes',
                                          ),
                                          no: i18n.t('render-form.forms.ethics-commission-form.no'),
                                      }}
                                      .value=${data.hasProvisionForAppropriateRecognition ||
                                      ''}></dbp-form-enum-view>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">7. ${i18n.t('render-form.forms.ethics-commission-form.section-working-conditions-title')}</h3>

                    <dbp-form-enum-view
                        subscribe="lang"
                        name="employmentContract"
                        label="7.1. ${i18n.t('render-form.forms.ethics-commission-form.employment-contract-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.employmentContract || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        name="workLifeBalance"
                        label="7.2. ${i18n.t('render-form.forms.ethics-commission-form.work-life-balance-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.workLifeBalance || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        name="fairCompensation"
                        label="7.3. ${i18n.t('render-form.forms.ethics-commission-form.fair-compensation-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.fairCompensation || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        data-condition="yes"
                        subscribe="lang"
                        name="diversityAspects"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.diversityAspects || ''}>
                        <span slot="label">
                            <dbp-translated subscribe="lang">
                                <div slot="de">
                                    7.4. Werden im Projekt diversitäts- und gendersensible Aspekte berücksichtigt (<a href='https://tu4u.tugraz.at/fileadmin/public/Studierende_und_Bedienstete/Anleitungen/Diversity-Gender_in_Forschungsprojekten_Checkliste_Deutsch.pdf?sword_list%5B0%5D=gender&sword_list%5B1%5D=forschung&no_cache=1' target='_blank'>siehe Leitfaden der TU Graz</a>)?
                                </div>
                                <div slot="en">
                                    7.4. Are diversity and gender-sensitive aspects considered in the project? (<a href='https://tu4u.tugraz.at/fileadmin/public/Studierende_und_Bedienstete/Anleitungen/Diversity-Gender_in_Forschungsprojekten_Checkliste_Deutsch.pdf?sword_list%5B0%5D=gender&sword_list%5B1%5D=forschung&no_cache=1' target='_blank'>see guidelines from TU Graz</a>)?
                                </div>
                            </dbp-translated>
                        </span>
                    </dbp-form-enum-view>

                    ${
                        this.conditionalFields.diversityAspects
                            ? html`
                                  <dbp-form-string-view
                                      subscribe="lang"
                                      name="diversityAspectsExamples"
                                      label="7.4.1 ${i18n.t(
                                          'render-form.forms.ethics-commission-form.diversity-aspects-examples-label',
                                      )}"
                                      value=${data.diversityAspectsExamples ||
                                      ''}></dbp-form-string-view>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">8. ${i18n.t('render-form.forms.ethics-commission-form.section-ethics-compass-title')}</h3>

                    <dbp-form-enum-view
                        subscribe="lang"
                        name="hasRiskOfReputationDamage"
                        label="8.1. ${i18n.t('render-form.forms.ethics-commission-form.risk-of-reputation-damage-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasRiskOfReputationDamage || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        name="specificTechnologyAssessment"
                        label="8.2. ${i18n.t('render-form.forms.ethics-commission-form.specific-technology-assessment-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.specificTechnologyAssessment || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        name="relatedToDevelopmentOfWeapons"
                        label="8.3. ${i18n.t('render-form.forms.ethics-commission-form.related-to-development-of-weapons-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.relatedToDevelopmentOfWeapons || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        subscribe="lang"
                        name="hasDualUse"
                        label="8.4. ${i18n.t('render-form.forms.ethics-commission-form.has-dual-use-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasDualUse || ''}>
                    </dbp-form-enum-view>

                    <dbp-form-enum-view
                        data-condition="yes"
                        subscribe="lang"
                        name="hasAnyRisks"
                        label="8.5. ${i18n.t('render-form.forms.ethics-commission-form.has-any-risks-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasAnyRisks || ''}>
                    </dbp-form-enum-view>

                    ${
                        this.conditionalFields.hasAnyRisks
                            ? html`
                                  <dbp-form-string-view
                                      subscribe="lang"
                                      name="risksReasons"
                                      label="8.5.1 ${i18n.t(
                                          'render-form.forms.ethics-commission-form.risks-reasons-label',
                                      )}"
                                      value=${data.risksReasons || ''}></dbp-form-string-view>
                              `
                            : ''
                    }

                    <dbp-form-enum-view
                        subscribe="lang"
                        name="hasNegativeEffects"
                        label="8.6. ${i18n.t('render-form.forms.ethics-commission-form.has-negative-effects-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasNegativeEffects || ''}>
                    </dbp-form-enum-view>
                </article>


                <article>
                    <h3 class="section-title">${i18n.t('render-form.forms.ethics-commission-form.section-iv-title')}</h3>
                    <div class="description">
                        <p>${i18n.t('render-form.forms.ethics-commission-form.section-iv-description')}</p>
                    </div>

                    <div class="file-upload-container">

                        <h4 class="attachments-title">${i18n.t('render-form.download-widget.attachments-title')}</h4>

                        <div class="uploaded-files">
                            ${this.renderAttachedFilesHtml('attachments')}
                        </div>
                    </div>

                    <h3 class="section-title section-title--top-margin">${i18n.t('render-form.forms.ethics-commission-form.admin-voting-results-title')}</h3>

                    <div class="file-upload-container">

                        <h4 class="attachments-title">${i18n.t('render-form.download-widget.attachments-title')}</h4>

                        <div class="uploaded-files">
                            ${this.renderAttachedFilesHtml('voting')}
                        </div>
                    </div>
                </article>
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
                modal-title="${i18n.t('show-submissions.edit-permission-modal-title')}"
                subscribe="auth"
                entry-point-url="${this.entryPointUrl}"
                resource-identifier="${this.submissionId}"
                resource-class-identifier="DbpRelayFormalizeSubmission"></dbp-grant-permission-dialog>

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

            <form id="ethics-commission-form" aria-labelledby="form-title" class="${classMap({
                hidden: this.hideForm,
                'formalize-form': true,
                'readonly-mode': this.readOnly,
                'edit-mode': !this.readOnly,
            })}">

                <div class="form-header">
                    ${this.getButtonRowHtml()}
                </div>

                <h2 class="form-title">${i18n.t('render-form.forms.ethics-commission-form.title')}</h2>

                <p>
                    <span class="red-marked-asterisk">
                        ${i18n.t('render-form.required-files-asterisk')}
                    </span>
                    ${i18n.t('render-form.required-files-text')}
                </p>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="type"
                    label="${i18n.t('render-form.forms.ethics-commission-form.type-label')}"
                    display-mode="list"
                    multiple
                    .items=${{
                        study: i18n.t('render-form.forms.ethics-commission-form.study'),
                        publication: i18n.t('render-form.forms.ethics-commission-form.publication'),
                    }}
                    .value=${data.type || ''}
                    required>
                </dbp-form-enum-element>

                <article>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="userTitle"
                        maxlength="1000"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.user-title')}"
                        label="${i18n.t('render-form.forms.ethics-commission-form.user-title')}"
                        required
                        value=${data.userTitle || ''}>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="userTitleShort"
                        maxlength="1000"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.user-title-short')}"
                        label="${i18n.t('render-form.forms.ethics-commission-form.user-title-short')}"
                        required
                        value=${data.userTitleShort || ''}>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="applicant"
                        maxlength="1000"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.applicant-placeholder')}"
                        label="${i18n.t('render-form.forms.ethics-commission-form.applicant-label')}"
                        required
                        value=${data.applicant || ''}>
                    </dbp-form-string-element>

                    <p class="field-note">${i18n.t('render-form.forms.ethics-commission-form.applicant-description')}</p>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="contactDetails"
                        maxlength="1000"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.contact-details-placeholder')}"
                        label="${i18n.t('render-form.forms.ethics-commission-form.contact-details-label')}"
                        required
                        value=${data.contactDetails || ''}>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="jobPosition"
                        maxlength="1000"
                        required
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.job-position-placeholder')}"
                        label="${i18n.t('render-form.forms.ethics-commission-form.job-position-label')}"
                        value=${data.jobPosition || ''}>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="coApplicants"
                        maxlength="1000"
                        required
                        rows="3"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.co-applicants-placeholder')}"
                        label="${i18n.t('render-form.forms.ethics-commission-form.co-applicants-label')}"
                        value=${data.coApplicants || ''}>
                    </dbp-form-string-element>

                    <p class="field-note">${i18n.t('render-form.forms.ethics-commission-form.co-applicants-description')}</p>

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
                            'information-communication-and-computing': i18n.t(
                                'render-form.forms.ethics-commission-form.information-communication-and-computing',
                            ),
                            'mobility-and-production': i18n.t(
                                'render-form.forms.ethics-commission-form.mobility-and-production',
                            ),
                            'sustainable-systems': i18n.t(
                                'render-form.forms.ethics-commission-form.sustainable-systems',
                            ),
                            keinem: i18n.t('render-form.forms.ethics-commission-form.keinem'),
                        }}
                        @change=${(e) => this.handleFieldsOfExpertiseItems(e)}
                        .value=${data.fieldsOfExpertise || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        data-condition="no"
                        name="isNewSubmission"
                        display-mode="list"
                        required
                        label="${i18n.t('render-form.forms.ethics-commission-form.is-new-submission-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.isNewSubmission || ''}></dbp-form-enum-element>

                    ${
                        this.conditionalFields.isNewSubmission
                            ? html`
                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.conditionalFields.isNewSubmission,
                                      })}"
                                      subscribe="lang"
                                      name="applicationReferenceNumber"
                                      maxlength="1000"
                                      label="${i18n.t(
                                          'render-form.forms.ethics-commission-form.application-reference-number-label',
                                      )}"
                                      value=${data.applicationReferenceNumber || ''}
                                      required></dbp-form-string-element>
                              `
                            : ''
                    }

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="isResearchProject"
                        data-condition="yes"
                        display-mode="list"
                        required
                        label="${i18n.t('render-form.forms.ethics-commission-form.is-research-project-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.isResearchProject || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.conditionalFields.isResearchProject
                            ? html`
                                  <dbp-form-enum-element
                                      class="${classMap({
                                          'fade-in': this.conditionalFields.isResearchProject,
                                      })}"
                                      subscribe="lang"
                                      name="qualificationWork"
                                      display-mode="list"
                                      required
                                      label="${i18n.t(
                                          'render-form.forms.ethics-commission-form.qualification-work-label',
                                      )}"
                                      .items=${{
                                          bachelor: i18n.t(
                                              'render-form.forms.ethics-commission-form.bachelor-label',
                                          ),
                                          master: i18n.t(
                                              'render-form.forms.ethics-commission-form.master-label',
                                          ),
                                          doctorat: i18n.t(
                                              'render-form.forms.ethics-commission-form.doctorat-label',
                                          ),
                                      }}
                                      multiple
                                      .value=${data.qualificationWork ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.conditionalFields.isResearchProject,
                                      })}"
                                      subscribe="lang"
                                      name="namesOfSupervisingPersons"
                                      maxlength="1000"
                                      rows="4"
                                      label="${i18n.t(
                                          'render-form.forms.ethics-commission-form.names-of-supervising-persons-label',
                                      )}"
                                      value=${data.namesOfSupervisingPersons || ''}
                                      required></dbp-form-string-element>
                              `
                            : ''
                    }

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="isPublicationPlanned"
                        display-mode="list"
                        required
                        label="${i18n.t('render-form.forms.ethics-commission-form.is-publication-planned-label')}"
                        .items=${{
                            'no-publication': i18n.t(
                                'render-form.forms.ethics-commission-form.no-publication-label',
                            ),
                            'one-publication': i18n.t(
                                'render-form.forms.ethics-commission-form.one-publication-label',
                            ),
                        }}
                        .value=${data.isPublicationPlanned || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.isAdmin
                            ? html`
                                  <div class="admin-fields">
                                      <dbp-form-string-element
                                          subscribe="lang"
                                          name="studyDescription"
                                          maxlength="1000"
                                          label="${i18n.t(
                                              'render-form.forms.ethics-commission-form.study-description-label',
                                          )}"
                                          description="${i18n.t(
                                              'render-form.forms.ethics-commission-form.filled-by-admins-warning',
                                          )}"
                                          placeholder="${i18n.t(
                                              'render-form.forms.ethics-commission-form.is-publication-planned-placeholder',
                                          )}"
                                          value=${data.studyDescription || ''}
                                          rows="5"></dbp-form-string-element>

                                      <dbp-form-date-element
                                          subscribe="lang"
                                          name="studyDescriptionDateOfTransmission"
                                          label="${i18n.t(
                                              'render-form.forms.ethics-commission-form.date-of-transmission-label',
                                          )}"
                                          description="${i18n.t(
                                              'render-form.forms.ethics-commission-form.filled-by-admins-warning',
                                          )}"
                                          value=${data.studyDescriptionDateOfTransmission ||
                                          ''}></dbp-form-date-element>

                                      <dbp-form-boolean-element
                                          subscribe="lang"
                                          name="dataProtectionChecked"
                                          label="${i18n.t(
                                              'render-form.forms.ethics-commission-form.data-protection-checked-label',
                                          )}"
                                          ?state=${data.dataProtectionChecked ||
                                          false}></dbp-form-boolean-element>

                                      <dbp-form-date-element
                                          subscribe="lang"
                                          name="dataProtectionDate"
                                          label="${i18n.t(
                                              'render-form.forms.ethics-commission-form.data-protection-date-label',
                                          )}"
                                          description="${i18n.t(
                                              'render-form.forms.ethics-commission-form.filled-by-admins-warning',
                                          )}"
                                          value=${data.dataProtectionDate ||
                                          ''}></dbp-form-date-element>
                                  </div>
                              `
                            : ''
                    }

                    <dbp-form-string-element
                        subscribe="lang"
                        name="shortDescription"
                        maxlength="2500"
                        label="${i18n.t(
                            'render-form.forms.ethics-commission-form.short-description-label',
                        )}"
                        placeholder="${i18n.t(
                            'render-form.forms.ethics-commission-form.short-description-placeholder',
                        )}"
                        value=${data.shortDescription || ''}
                        rows="5"
                        required></dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="dataSource"
                        maxlength="1500"
                        label="${i18n.t(
                            'render-form.forms.ethics-commission-form.data-source-label',
                        )}"
                        placeholder="${i18n.t(
                            'render-form.forms.ethics-commission-form.data-source-placeholder',
                        )}"
                        value=${data.dataSource || ''}
                        rows="5"
                        required></dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="numberOfTestPersons"
                        maxlength="100"
                        label="${i18n.t('render-form.forms.ethics-commission-form.number-of-test-persons-label')}"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.number-of-test-persons-placeholder')}"
                        value=${data.numberOfTestPersons || ''}
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="acquisitionOfTestSubjects"
                        maxlength="1500"
                        label="${i18n.t('render-form.forms.ethics-commission-form.acquisition-of-test-subjects-label')}"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.acquisition-of-test-subjects-placeholder')}"
                        value=${data.acquisitionOfTestSubjects || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="volunteersCompensation"
                        maxlength="1500"
                        label="${i18n.t('render-form.forms.ethics-commission-form.volunteers-compensation-label')}"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.volunteers-compensation-placeholder')}"
                        value=${data.volunteersCompensation || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <p class="field-note">${i18n.t('render-form.forms.ethics-commission-form.volunteers-compensation-description')}</p>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="volunteersCompensationEarlyEnd"
                        maxlength="1000"
                        label="${i18n.t('render-form.forms.ethics-commission-form.volunteers-compensation-early-end-label')}"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.volunteers-compensation-early-end-placeholder')}"
                        value=${data.volunteersCompensationEarlyEnd || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="participationCriteria"
                        maxlength="1000"
                        label="${i18n.t('render-form.forms.ethics-commission-form.participation-criteria-label')}"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.participation-criteria-placeholder')}"
                        value=${data.participationCriteria || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="subjectsDependencies"
                        maxlength="1500"
                        label="${i18n.t('render-form.forms.ethics-commission-form.subjects-dependencies-label')}"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.subjects-dependencies-placeholder')}"
                        value=${data.subjectsDependencies || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <p class="field-note">${i18n.t('render-form.forms.ethics-commission-form.subjects-dependencies-description')}</p>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="founding"
                        maxlength="1000"
                        label="${i18n.t('render-form.forms.ethics-commission-form.founding-label')}"
                        placeholder="${i18n.t('render-form.forms.ethics-commission-form.founding-placeholder')}"
                        value=${data.founding || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>

                    <dbp-form-date-element
                        subscribe="lang"
                        name="projectStartDate"
                        label="${i18n.t('render-form.forms.ethics-commission-form.project-start-date-label')}"
                        value=${data.projectStartDate || ''}
                        required>
                    </dbp-form-date-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="projectDuration"
                        maxlength="100"
                        label="${i18n.t('render-form.forms.ethics-commission-form.project-duration-label')}"
                        value=${data.projectDuration || ''}
                        required>
                    </dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        rows="5"
                        name="reasonOfSubmission"
                        maxlength="1000"
                        label="${i18n.t('render-form.forms.ethics-commission-form.reason-of-submission-label')}"
                        value=${data.reasonOfSubmission || ''}
                        required>
                    </dbp-form-string-element>
                </article>

                <article>

                    <h3 class="section-title">${i18n.t('render-form.forms.ethics-commission-form.section-i-title')}</h3>

                    <div class="description">
                        <p>${i18n.t('render-form.forms.ethics-commission-form.section-i-description-1')}</p>
                        <p>${i18n.t('render-form.forms.ethics-commission-form.section-i-description-2')}</p>
                        <p>${i18n.t('render-form.forms.ethics-commission-form.section-i-description-3')}</p>
                        <p>${i18n.t('render-form.forms.ethics-commission-form.section-i-description-4')}</p>
                    </div>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="researchProjectDescription"
                        maxlength="10000"
                        label="${i18n.t('render-form.forms.ethics-commission-form.research-project-description-label')}"
                        value=${data.researchProjectDescription || ''}
                        rows="10"
                        required>
                    </dbp-form-string-element>
                </article>

                <article>
                    <h3 class="section-title">${i18n.t('render-form.forms.ethics-commission-form.section-ii-title')}</h3>

                    <div class="description">
                        <dbp-translated subscribe="lang">
                            <div slot="de">
                                <p>Wenn Menschen als Proband*innen mitwirken:</p>
                                <p>Die Proband*innen sollen von der Studienleitung über folgende Punkte informiert werden (beispielsweise durch eine Proband*innen-Information und Einwilligungserklärung zur Teilnahme am Forschungsvorhaben):</p>
                                <ol class="lettered-list">
                                    <li><p>Genaue Angabe von Titel, Zweck und Dauer Ihres Forschungsvorhabens sowie Erklärung des Ablaufs für die Proband*innen in einfacher und klarer Sprache (bitte vermeiden Sie nach Möglichkeit Fremdwörter)</p></li>
                                    <li><p>Angaben zur durchführenden Forschungseinrichtung und zu einer verantwortlichen Kontaktperson (Vor- und Nachname, E-Mail-Adresse und evtl. Telefonnummer) für weitere Fragen, Anregungen oder Beschwerden</p></li>
                                    <li><p>Angabe möglicher Risiken für die Proband*innen (Unannehmlichkeiten, Gefahren, Belastungen) und etwaiger Folgen</p></li>
                                    <li>
                                        <p>Angaben über die Höhe der Aufwandsentschädigung (auch im Falle eines vorzeitigen Abbruchs) sowie eines sonstigen Nutzens für die Proband*innen</p>
                                        <div class="info-box">
                                            <p>Bitte kümmern Sie sich frühzeitig um ein entsprechendes Budget für Aufwandsentschädigungen für die Proband*innen Ihrer Studie (Budgetierung in Forschungsanträgen)!</p>
                                            <p>Die Angemessenheit der Aufwandsentschädigung hängt zunächst davon ab, ob es für die Durchführung der Studie eine Finanzierung gibt oder nicht. </p>
                                            <p>Wenn es eine Finanzierung gibt, empfehlen wir in Abhängigkeit der folgenden Kriterien eine Aufwandsentschädigung in Höhe von EUR 10 bis 25 pro Stunde in Form von Holding-GrazGutscheinen oder Supermarkt-Gutscheinen:</p>
                                            <ol>
                                                <li><p>Je nach Art der Studienteilnahme und Aufwand für die Proband*innen: Füllen Proband*innen einen Fragebogen aus, führen sie ein Tagebuch, erfüllen sie Aufgaben und/oder kommt es zu psychophysiologischen Datenerhebungen?</p></li>
                                                <li><p>Je nach Dauer der Studienteilnahme: Einmalig, wiederholt, aufgewandte Zeit gesamt </p></li>
                                                <li><p>je nach Qualität und Quantität der Daten von Proband*innen: soziodemographische Daten oder zusätzlich auch Gesundheitsdaten?</p></li>
                                            </ol>
                                            <p>Wenn es keine Finanzierung gibt, empfehlen wir, die Proband*innen für die Teilnahme an Ihrer Studie mit einer symbolischen Anerkennung, zB in Form von Schokolade, Verlosung von Goodies oder individuelle Rückmeldung zu ihren Datenauswertungen, zu bedenken.</p>
                                            <p>Unabhängig von der Finanzierung bitten wir Sie, Aufwandsentschädigungen auch für jene Proband*innen aliquot vorzusehen, die ihre Studienteilnahme aus welchem Grund auch immer frühzeitig abbrechen.</p>
                                            <p>Hinweis In erster Linie werden aufgrund der Regionalität Holding-GrazGutscheine oder Supermarkt-Gutscheine empfohlen. Gemäß TU Graz-Richtlinie zur Beschaffung, RL 96000 RLBS 172-01, dürfen Mitarbeitende der TU Graz keine Bargeld-Leistung als Aufwandsentschädigung für Ihre Studienteilnahme erhalten.</p>
                                        </div>
                                    </li>
                                    <li><p>Hinweis auf die Freiwilligkeit der Teilnahme inklusive des Rechts, die Einwilligung jederzeit ohne Angabe von Gründen widerrufen und die Teilnahme vorzeitig abbrechen zu können, ohne dass den Proband*innen dadurch ein Nachteil entsteht</p></li>
                                    <li><p>Hinweis auf die erfolgte Behandlung durch die Ethikkommission</p></li>
                                    <li><p>Hinweis auf die Richtlinie für Hinweisgeber und den elektronischen Briefkasten für anonyme Hinweise an der TU Graz (Whistleblowing)</p></li>
                                    <li><p>Elektronischer Briefkasten für anonyme Hinweise (Whistleblowing), <a target="_blank" href="https://www.tugraz.at/ueber-diese-seite/elektronischer-briefkasten-fuer-anonyme-hinweise-whistleblowing">whistleblowing</a></p></li>
                                    <li><p>Einwilligungserklärung der Proband*innen (bzw. von deren gesetzlichen Vertreter*innen) zur Teilnahme an der Studie</p></li>
                                </ol>
                            </div>
                            <div slot="en">
                                <p>Should humans engage as participants:</p>
                                <p>The participants should be informed by the study management about the following points (e.g.: by means of a participant information sheet and declaration of consent to participate in the research project):</p>
                                <ol class="lettered-list">
                                    <li><p>Precisely state the title, purpose and duration of your research project and explain the procedure to the participants in simple and clear language (please avoid technical terms if possible)</p></li>
                                    <li><p>Details of the research institution conducting the study and a responsible contact person (first and last name, e-mail address and telephone number if applicable) for further questions, suggestions or complaints </p></li>
                                    <li><p>Indication of possible risks for the participants (inconvenience, danger, stress) and possible consequences</p></li>
                                    <li>
                                        <p>Information on the amount of the compensation (including in the event of premature termination) and other benefits for the participants</p>
                                        <div class="info-box">
                                            <p>Please ensure that funding for the participant compensation is secured at an early stage of the planning (budgeting in research proposals)!</p>
                                            <p>The appropriateness of the compensation depends first and foremost on whether or not funding is available for the study.</p>
                                            <p>If funding is available, we recommend a compensation of EUR 10 to 25 per hour in the form of Holding-Graz vouchers or supermarket vouchers, depending on the following criteria:</p>
                                            <ol>
                                                <li><p>Depending on the type of study participation and effort required of the participants: Do participants fill out a questionnaire, keep a diary, perform tasks, and/or undergo psychophysiological data collection?</p></li>
                                                <li><p>Depending on the duration of study participation: One-time, repeated, total time spent</p></li>
                                                <li><p>Depending on the quality and quantity of the data provided by the participants: sociodemographic data or additional health data?</p></li>
                                            </ol>
                                            <p>If no funding is available, we recommend rewarding the participants for participating in your study with a symbolic token of appreciation, e.g., a raffle for goodies or individual feedback on their data evaluations or information on the study results.</p>
                                            <p>Regardless of funding, we ask that you also provide pro rata compensation for those participants who withdraw from the study early for any reason. In any case, we recommend sharing the study results with participants.</p>
                                            <p>Due to regional considerations, Holding Graz vouchers or supermarket vouchers are recommended. In accordance with TU Graz procurement guidelines RL 96000 RLBS 172-01, TU Graz employees may not receive cash payments as expense allowances for participating in studies.</p>
                                        </div>
                                    </li>
                                    <li><p>Reference to the voluntary nature of participation, including the right to withdraw consent at any time without giving reasons and to terminate participation prematurely without any disadvantage to the participants</p></li>
                                    <li><p>Reference to the Ethics Committee’s decision</p></li>
                                    <li><p>Reference to the TU Graz Whistleblowing Policy and the Electronic Mailbox for Anonymous Tips (Whistleblowing)</p></li>
                                    <li><p>Electronic Mailbox for Anonymous Tips (Whistleblowing), <a target="_blank" href="https://www.tugraz.at/ueber-diese-seite/elektronischer-briefkasten-fuer-anonyme-hinweise-whistleblowing">whistleblowing</a>.</p></li>
                                    <li><p>Declaration of consent of the participants (or their legal representatives) to participate in the study </p></li>
                                </ol>
                            </div>
                        </dbp-translated>
                    </div>
                </article>

                <article>
                    <h3 class="section-title">${i18n.t('render-form.forms.ethics-commission-form.section-iii-title')}</h3>

                    <div class="description">
                        <p>${i18n.t('render-form.forms.ethics-commission-form.section-iii-description')}</p>
                        <dbp-translated subscribe="lang">
                            <div slot="de">
                                <p class="field-note">Angelehnt an den Kriterienkatalog der Europäischen Kommission im Zusammenhang von EU-Grants/Horizon Europe aus dem Jahr 2021.</p>
                            </div>
                            <div slot="en">
                                <p class="field-note">Based on the European Commission's list of criteria in connection with EU grants/Horizon Europe from 2021.</p>
                            </div>
                        </dbp-translated>
                    </div>

                    <h4 class="section-sub-title">1. ${i18n.t('render-form.forms.ethics-commission-form.section-people-title')}</h4>

                    <dbp-form-enum-element
                        data-condition="yes"
                        subscribe="lang"
                        name="testSubjects"
                        display-mode="list"
                        required
                        label="${i18n.t('render-form.forms.ethics-commission-form.test-subjects-label')}"
                        description="${i18n.t('render-form.forms.ethics-commission-form.test-subject-description')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.testSubjects || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.conditionalFields.testSubjects
                            ? html`
                                  <div
                                      class="question-group ${classMap({
                                          'fade-in': this.conditionalFields.testSubjects,
                                      })}">
                                      <h4 class="question-group-title">
                                          1.1.
                                          ${i18n.t(
                                              'render-form.forms.ethics-commission-form.human-participants-subtitle',
                                          )}
                                      </h4>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsVoluntary"
                                          display-mode="list"
                                          required
                                          label="1.1.1 ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-voluntary-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsVoluntary ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="isSelfExperiment"
                                          display-mode="list"
                                          required
                                          label="1.1.2 ${i18n.t(
                                              'render-form.forms.ethics-commission-form.is-self-experiment-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.isSelfExperiment ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsInformedConsent"
                                          display-mode="list"
                                          required
                                          label="1.1.3. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-informed-consent-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsInformedConsent ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsConsentSigned"
                                          display-mode="list"
                                          required
                                          label="1.1.4. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-consent-signed-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsConsentSigned ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsWithdrawPossible"
                                          display-mode="list"
                                          required
                                          label="1.1.5. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-withdraw-possible-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsWithdrawPossible ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsDependent"
                                          display-mode="list"
                                          required
                                          label="1.1.6. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-dependent-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsDependent ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsVulnerable"
                                          display-mode="list"
                                          required
                                          label="1.1.7. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-vulnerable-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsVulnerable ||
                                          ''}></dbp-form-enum-element>
                                  </div>

                                  <div class="question-group">
                                      <h4 class="question-group-title">
                                          1.2.
                                          ${i18n.t(
                                              'render-form.forms.ethics-commission-form.interventions-subtitle',
                                          )}
                                      </h4>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="invasiveTechniquesUsed"
                                          display-mode="list"
                                          required
                                          label="1.2.1. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.invasive-techniques-used-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.invasiveTechniquesUsed ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="influenceOnBrainActivity"
                                          display-mode="list"
                                          required
                                          label="1.2.2. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.influence-on-brain-activity-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.influenceOnBrainActivity ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsTortured"
                                          data-condition="yes"
                                          display-mode="list"
                                          required
                                          label="1.2.3. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-tortured-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsTortured ||
                                          ''}></dbp-form-enum-element>

                                      ${this.conditionalFields.testSubjectsTortured
                                          ? html`
                                                <dbp-form-string-element
                                                    class="${classMap({
                                                        'fade-in':
                                                            this.conditionalFields
                                                                .testSubjectsTortured,
                                                    })}"
                                                    subscribe="lang"
                                                    name="testSubjectsTorturedExamples"
                                                    maxlength="1000"
                                                    rows="3"
                                                    label="1.2.3.1 ${i18n.t(
                                                        'render-form.forms.ethics-commission-form.test-subjects-tortured-example-label',
                                                    )}"
                                                    value=${data.testSubjectsTorturedExamples || ''}
                                                    required></dbp-form-string-element>
                                            `
                                          : ''}

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsHarmed"
                                          display-mode="list"
                                          required
                                          label="1.2.4. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-harmed-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsHarmed ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsRisksJustified"
                                          display-mode="list"
                                          required
                                          label="1.2.5. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-risks-justified-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsRisksJustified ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsRiskMinimized"
                                          display-mode="list"
                                          required
                                          label="1.2.6. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-risk-minimized-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsRiskMinimized ||
                                          ''}></dbp-form-enum-element>
                                  </div>

                                  <div class="question-group">
                                      <h4 class="question-group-title">
                                          1.3.
                                          ${i18n.t(
                                              'render-form.forms.ethics-commission-form.reasonableness-subtitle',
                                          )}
                                      </h4>
                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="testSubjectsReasonableToParticipate"
                                          display-mode="list"
                                          required
                                          label="1.3.1 ${i18n.t(
                                              'render-form.forms.ethics-commission-form.test-subjects-reasonable-to-participate-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.testSubjectsReasonableToParticipate ||
                                          ''}></dbp-form-enum-element>
                                  </div>
                              `
                            : ''
                    }

                    <div class="question-group">
                        <h4 class="question-group-title">
                            1.4. ${i18n.t(
                                'render-form.forms.ethics-commission-form.dead-bodies-subtitle',
                            )}
                        </h4>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="deadBodies"
                            data-condition="yes"
                            display-mode="list"
                            required
                            label="${i18n.t('render-form.forms.ethics-commission-form.dead-bodies-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.deadBodies || ''}>
                        </dbp-form-enum-element>

                        ${
                            this.conditionalFields.deadBodies
                                ? html`
                                      <div
                                          class="question-group ${classMap({
                                              'fade-in': this.conditionalFields.deadBodies,
                                          })}">
                                          <dbp-form-enum-element
                                              subscribe="lang"
                                              name="legalDocumentsAvailable"
                                              display-mode="list"
                                              required
                                              label="1.4.1. ${i18n.t(
                                                  'render-form.forms.ethics-commission-form.legal-documents-available-label',
                                              )}"
                                              .items=${{
                                                  yes: i18n.t(
                                                      'render-form.forms.ethics-commission-form.yes',
                                                  ),
                                                  no: i18n.t(
                                                      'render-form.forms.ethics-commission-form.no',
                                                  ),
                                              }}
                                              .value=${data.legalDocumentsAvailable ||
                                              ''}></dbp-form-enum-element>

                                          <dbp-form-enum-element
                                              subscribe="lang"
                                              name="disturbanceOfPeaceOfDead"
                                              display-mode="list"
                                              required
                                              label="1.4.2. ${i18n.t(
                                                  'render-form.forms.ethics-commission-form.disturbance-of-peace-of-dead-label',
                                              )}"
                                              .items=${{
                                                  yes: i18n.t(
                                                      'render-form.forms.ethics-commission-form.yes',
                                                  ),
                                                  no: i18n.t(
                                                      'render-form.forms.ethics-commission-form.no',
                                                  ),
                                              }}
                                              .value=${data.disturbanceOfPeaceOfDead ||
                                              ''}></dbp-form-enum-element>
                                      </div>
                                  `
                                : ''
                        }
                    </div>

                    <div class="question-group">
                        <h4 class="question-group-title">
                            1.5. ${i18n.t(
                                'render-form.forms.ethics-commission-form.human-stem-cells-subtitle',
                            )}
                        </h4>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="humanStemCells"
                            data-condition="yes"
                            display-mode="list"
                            required
                            label="${i18n.t('render-form.forms.ethics-commission-form.human-stem-cells-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.humanStemCells || ''}>
                        </dbp-form-enum-element>

                        ${
                            this.conditionalFields.humanStemCells
                                ? html`
                                      <div
                                          class="question-group ${classMap({
                                              'fade-in': this.conditionalFields.humanStemCells,
                                          })}">
                                          <dbp-form-enum-element
                                              subscribe="lang"
                                              name="humanTissueUsed"
                                              display-mode="list"
                                              required
                                              label="1.5.1. ${i18n.t(
                                                  'render-form.forms.ethics-commission-form.human-tissue-used-label',
                                              )}"
                                              .items=${{
                                                  yes: i18n.t(
                                                      'render-form.forms.ethics-commission-form.yes',
                                                  ),
                                                  no: i18n.t(
                                                      'render-form.forms.ethics-commission-form.no',
                                                  ),
                                              }}
                                              .value=${data.humanTissueUsed ||
                                              ''}></dbp-form-enum-element>

                                          <dbp-form-enum-element
                                              subscribe="lang"
                                              name="humanStemCellsUsed"
                                              data-condition="yes"
                                              display-mode="list"
                                              required
                                              label="1.5.2. ${i18n.t(
                                                  'render-form.forms.ethics-commission-form.human-stem-cells-used-label',
                                              )}"
                                              .items=${{
                                                  yes: i18n.t(
                                                      'render-form.forms.ethics-commission-form.yes',
                                                  ),
                                                  no: i18n.t(
                                                      'render-form.forms.ethics-commission-form.no',
                                                  ),
                                              }}
                                              .value=${data.humanStemCellsUsed ||
                                              ''}></dbp-form-enum-element>

                                          ${this.conditionalFields.humanStemCellsUsed
                                              ? html`
                                                    <dbp-form-enum-element
                                                        class="${classMap({
                                                            'fade-in':
                                                                this.conditionalFields
                                                                    .humanStemCellsUsed,
                                                        })}"
                                                        subscribe="lang"
                                                        name="stemCellsFromEmbryos"
                                                        display-mode="list"
                                                        required
                                                        label="1.5.2.1. ${i18n.t(
                                                            'render-form.forms.ethics-commission-form.stem-cells-from-embryos-label',
                                                        )}"
                                                        .items=${{
                                                            yes: i18n.t(
                                                                'render-form.forms.ethics-commission-form.yes',
                                                            ),
                                                            no: i18n.t(
                                                                'render-form.forms.ethics-commission-form.no',
                                                            ),
                                                        }}
                                                        .value=${data.stemCellsFromEmbryos ||
                                                        ''}></dbp-form-enum-element>
                                                `
                                              : ''}

                                          <dbp-form-enum-element
                                              subscribe="lang"
                                              name="useOfHumanEmbryos"
                                              data-condition="yes"
                                              display-mode="list"
                                              required
                                              label="1.5.3. ${i18n.t(
                                                  'render-form.forms.ethics-commission-form.use-of-human-embryos-label',
                                              )}"
                                              .items=${{
                                                  yes: i18n.t(
                                                      'render-form.forms.ethics-commission-form.yes',
                                                  ),
                                                  no: i18n.t(
                                                      'render-form.forms.ethics-commission-form.no',
                                                  ),
                                              }}
                                              .value=${data.useOfHumanEmbryos ||
                                              ''}></dbp-form-enum-element>

                                          ${this.conditionalFields.useOfHumanEmbryos
                                              ? html`
                                                    <dbp-form-enum-element
                                                        class="${classMap({
                                                            'fade-in':
                                                                this.conditionalFields
                                                                    .useOfHumanEmbryos,
                                                        })}"
                                                        subscribe="lang"
                                                        name="stemCellsFromEmbryosDestroyed"
                                                        display-mode="list"
                                                        required
                                                        label="1.5.3.1. ${i18n.t(
                                                            'render-form.forms.ethics-commission-form.stem-cells-from-embryos-destroyed-label',
                                                        )}"
                                                        .items=${{
                                                            yes: i18n.t(
                                                                'render-form.forms.ethics-commission-form.yes',
                                                            ),
                                                            no: i18n.t(
                                                                'render-form.forms.ethics-commission-form.no',
                                                            ),
                                                        }}
                                                        .value=${data.stemCellsFromEmbryosDestroyed ||
                                                        ''}></dbp-form-enum-element>
                                                `
                                              : ''}

                                          <dbp-form-enum-element
                                              subscribe="lang"
                                              name="commerciallyAvailableCells"
                                              display-mode="list"
                                              required
                                              label="1.5.4. ${i18n.t(
                                                  'render-form.forms.ethics-commission-form.commercially-available-cells-label',
                                              )}"
                                              .items=${{
                                                  yes: i18n.t(
                                                      'render-form.forms.ethics-commission-form.yes',
                                                  ),
                                                  no: i18n.t(
                                                      'render-form.forms.ethics-commission-form.no',
                                                  ),
                                              }}
                                              .value=${data.commerciallyAvailableCells ||
                                              ''}></dbp-form-enum-element>

                                          <dbp-form-enum-element
                                              subscribe="lang"
                                              name="cellsObtainedInResearch"
                                              data-condition="no"
                                              display-mode="list"
                                              required
                                              label="1.5.5 ${i18n.t(
                                                  'render-form.forms.ethics-commission-form.cells-obtained-in-research-label',
                                              )}"
                                              .items=${{
                                                  yes: i18n.t(
                                                      'render-form.forms.ethics-commission-form.yes',
                                                  ),
                                                  no: i18n.t(
                                                      'render-form.forms.ethics-commission-form.no',
                                                  ),
                                              }}
                                              .value=${data.cellsObtainedInResearch ||
                                              ''}></dbp-form-enum-element>

                                          ${this.conditionalFields.cellsObtainedInResearch
                                              ? html`
                                                    <dbp-form-string-element
                                                        class="${classMap({
                                                            'fade-in':
                                                                this.conditionalFields
                                                                    .cellsObtainedInResearch,
                                                        })}"
                                                        subscribe="lang"
                                                        name="tissueOrCellsSource"
                                                        maxlength="1000"
                                                        rows="3"
                                                        label="1.5.5.1 ${i18n.t(
                                                            'render-form.forms.ethics-commission-form.tissue-or-cells-source-label',
                                                        )}"
                                                        value=${data.tissueOrCellsSource || ''}
                                                        required></dbp-form-string-element>
                                                `
                                              : ''}
                                      </div>
                                  `
                                : ''
                        }
                        </div>
                </article>

                <article>
                    <h3 class="section-sub-title">2. ${i18n.t('render-form.forms.ethics-commission-form.section-animals-title')}</h3>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="animalsInvolved"
                        data-condition="yes"
                        display-mode="list"
                        required
                        label="${i18n.t('render-form.forms.ethics-commission-form.section-animals-involved-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.animalsInvolved || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.conditionalFields.animalsInvolved
                            ? html`
                                  <div
                                      class="question-group ${classMap({
                                          'fade-in': this.conditionalFields.animalsInvolved,
                                      })}">
                                      <h4 class="question-group-title">
                                          2.1.
                                          ${i18n.t(
                                              'render-form.forms.ethics-commission-form.section-animals-in-research-subtitle',
                                          )}
                                      </h4>
                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="isAnimalVertebrate"
                                          display-mode="list"
                                          required
                                          label="2.1.1. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.is-animal-vertebrate-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.isAnimalVertebrate ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="nonHumanPrimates"
                                          display-mode="list"
                                          required
                                          label="2.1.2. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.non-human-primates-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.nonHumanPrimates ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="geneticallyModifiedAnimals"
                                          display-mode="list"
                                          required
                                          label="2.1.3. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.genetically-modified-animals-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.geneticallyModifiedAnimals ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="endangeredSpecies"
                                          display-mode="list"
                                          required
                                          label="2.1.4. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.endangered-species-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.endangeredSpecies ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="alternativesToUseLaboratoryAnimals"
                                          display-mode="list"
                                          required
                                          label="2.1.5. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.alternatives-to-use-laboratory-animals-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.alternativesToUseLaboratoryAnimals ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="laboratoryAnimalsHarmed"
                                          display-mode="list"
                                          required
                                          label="2.1.6. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.laboratory-animals-harmed-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.laboratoryAnimalsHarmed ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="isRiskJustified"
                                          display-mode="list"
                                          required
                                          label="2.1.7. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.is-risk-justified-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.isRiskJustified ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="relevantLegalDocumentAvailable"
                                          display-mode="list"
                                          required
                                          label="2.1.8. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.relevant-legal-document-available-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.relevantLegalDocumentAvailable ||
                                          ''}></dbp-form-enum-element>
                                  </div>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">3. ${i18n.t('render-form.forms.ethics-commission-form.section-sustainability-title')}</h3>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="harmfulSubstances"
                            display-mode="list"
                            required
                            label="3.1. ${i18n.t('render-form.forms.ethics-commission-form.harmful-substances-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.harmfulSubstances || ''}>
                        </dbp-form-enum-element>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="negativeImpactsOnNature"
                            display-mode="list"
                            required
                            label="3.2. ${i18n.t('render-form.forms.ethics-commission-form.negative-impacts-on-nature-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.negativeImpactsOnNature || ''}>
                        </dbp-form-enum-element>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="harmfulSubstancesOnSubjects"
                            data-condition="yes"
                            display-mode="list"
                            required
                            label="3.3. ${i18n.t('render-form.forms.ethics-commission-form.harmful-substances-on-subjects-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.harmfulSubstancesOnSubjects || ''}>
                        </dbp-form-enum-element>

                        ${
                            this.conditionalFields.harmfulSubstancesOnSubjects
                                ? html`
                                      <dbp-form-enum-element
                                          class="${classMap({
                                              'fade-in':
                                                  this.conditionalFields
                                                      .harmfulSubstancesOnSubjects,
                                          })}"
                                          subscribe="lang"
                                          name="adequateSafetyMeasures"
                                          display-mode="list"
                                          required
                                          label="3.3.1. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.adequate-safety-measures-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.adequateSafetyMeasures ||
                                          ''}></dbp-form-enum-element>
                                  `
                                : ''
                        }

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="complyWithSustainabilityStrategy"
                            data-condition="yes"
                            display-mode="list"
                            required
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.complyWithSustainabilityStrategy || ''}>
                            <span slot="label">
                                <dbp-translated subscribe="lang">
                                    <div slot="de">
                                        3.4. Entspricht Ihr Forschungsvorhaben der <a href='https://www.tugraz.at/tu-graz/universitaet/klimaneutrale-tu-graz/roadmap/' target='_blank'>Nachhaltigkeitsstrategie</a> der TU Graz?
                                    </div>
                                    <div slot="en">
                                        3.4. Does your research project comply with the (<a href='https://www.tugraz.at/en/tu-graz/university/climate-neutral-tu-graz/roadmap/' target='_blank'>TU Graz sustainability strategy</a>)?
                                    </div>
                                </dbp-translated>
                            </span>
                        </dbp-form-enum-element>

                        ${
                            this.conditionalFields.complyWithSustainabilityStrategy
                                ? html`
                                      <dbp-form-string-element
                                          class="${classMap({
                                              'fade-in':
                                                  this.conditionalFields
                                                      .complyWithSustainabilityStrategy,
                                          })}"
                                          subscribe="lang"
                                          name="appropriateUseOfResources"
                                          maxlength="1000"
                                          label="3.5. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.appropriate-use-of-resources-label',
                                          )}"
                                          placeholder="${i18n.t(
                                              'render-form.forms.ethics-commission-form.appropriate-use-of-resources-placeholder',
                                          )}"
                                          value=${data.appropriateUseOfResources || ''}
                                          rows="4"
                                          required></dbp-form-string-element>
                                  `
                                : ''
                        }
                    </div>
                </article>

                <article>
                    <h3 class="section-sub-title">4. ${i18n.t('render-form.forms.ethics-commission-form.section-non-eu-states-title')}</h3>
                    <dbp-form-enum-element
                        subscribe="lang"
                        name="nonEuCountries"
                        data-condition="yes"
                        display-mode="list"
                        required
                        label="${i18n.t('render-form.forms.ethics-commission-form.non-eu-countries-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.nonEuCountries || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.conditionalFields.nonEuCountries
                            ? html`
                                  <div
                                      class="question-group ${classMap({
                                          'fade-in': this.conditionalFields.nonEuCountries,
                                      })}">
                                      <h4 class="question-group-title">
                                          4.1
                                          ${i18n.t(
                                              'render-form.forms.ethics-commission-form.section-non-eu-countries-subtitle',
                                          )}
                                      </h4>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="ethicalIssues"
                                          display-mode="list"
                                          required
                                          label="4.1.1. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.ethical-issues-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.ethicalIssues ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="thirdCountriesLocalResources"
                                          data-condition="yes"
                                          display-mode="list"
                                          required
                                          label="4.1.2. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.third-countries-local-resources-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.thirdCountriesLocalResources ||
                                          ''}></dbp-form-enum-element>

                                      ${this.conditionalFields.thirdCountriesLocalResources
                                          ? html`
                                                <dbp-form-enum-element
                                                    class="${classMap({
                                                        'fade-in':
                                                            this.conditionalFields
                                                                .thirdCountriesLocalResources,
                                                    })}"
                                                    subscribe="lang"
                                                    name="questionResearchFounds"
                                                    display-mode="list"
                                                    required
                                                    label="4.1.2.1. ${i18n.t(
                                                        'render-form.forms.ethics-commission-form.question-research-founds-label',
                                                    )}"
                                                    .items=${{
                                                        yes: i18n.t(
                                                            'render-form.forms.ethics-commission-form.yes',
                                                        ),
                                                        no: i18n.t(
                                                            'render-form.forms.ethics-commission-form.no',
                                                        ),
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
                                          label="4.1.3. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.import-material-from-third-countries-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.importMaterialFromThirdCountries ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="lowIncomeCountries"
                                          display-mode="list"
                                          required
                                          label="4.1.4. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.low-income-countries-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.lowIncomeCountries ||
                                          ''}></dbp-form-enum-element>

                                      <dbp-form-enum-element
                                          subscribe="lang"
                                          name="exposeParticipantsToRisk"
                                          display-mode="list"
                                          required
                                          label="4.1.5. ${i18n.t(
                                              'render-form.forms.ethics-commission-form.expose-participants-to-risk-label',
                                          )}"
                                          .items=${{
                                              yes: i18n.t(
                                                  'render-form.forms.ethics-commission-form.yes',
                                              ),
                                              no: i18n.t(
                                                  'render-form.forms.ethics-commission-form.no',
                                              ),
                                          }}
                                          .value=${data.exposeParticipantsToRisk ||
                                          ''}></dbp-form-enum-element>
                                  </div>
                              `
                            : ''
                    }
                </article>



                <article>
                    <h3 class="section-sub-title">5. ${i18n.t('render-form.forms.ethics-commission-form.section-information-systems-title')}</h3>

                    <div class="question-group">
                        <p>
                            ${i18n.t(
                                'render-form.forms.ethics-commission-form.section-information-systems-subtitle',
                            )}
                        </p>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="replaceHumanDecisionMaking"
                            display-mode="list"
                            required
                            label="5.1. ${i18n.t('render-form.forms.ethics-commission-form.replace-human-decision-making-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.replaceHumanDecisionMaking || ''}>
                        </dbp-form-enum-element>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="potentiallyStigmatizePeople"
                            display-mode="list"
                            required
                            label="5.2. ${i18n.t('render-form.forms.ethics-commission-form.potentially-stigmatize-people-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.potentiallyStigmatizePeople || ''}>
                        </dbp-form-enum-element>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="negativeSocialConsequences"
                            display-mode="list"
                            required
                            label="5.3. ${i18n.t('render-form.forms.ethics-commission-form.negative-social-consequences-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.negativeSocialConsequences || ''}>
                        </dbp-form-enum-element>

                        <dbp-form-enum-element
                            subscribe="lang"
                            name="weaponSystem"
                            display-mode="list"
                            required
                            label="5.4. ${i18n.t('render-form.forms.ethics-commission-form.weapon-system-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.weaponSystem || ''}>
                        </dbp-form-enum-element>

                        <dbp-form-enum-element
                            subscribe="lang"
                            data-condition="yes"
                            name="hasEthicalIssues"
                            display-mode="list"
                            required
                            label="5.5. ${i18n.t('render-form.forms.ethics-commission-form.has-ethical-issues-label')}"
                            .items=${{
                                yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                                no: i18n.t('render-form.forms.ethics-commission-form.no'),
                            }}
                            .value=${data.hasEthicalIssues || ''}>
                        </dbp-form-enum-element>

                        ${
                            this.conditionalFields.hasEthicalIssues
                                ? html`
                                      <dbp-form-string-element
                                          class="${classMap({
                                              'fade-in': this.conditionalFields.hasEthicalIssues,
                                          })}"
                                          subscribe="lang"
                                          name="ethicalIssuesList"
                                          maxlength="1000"
                                          label="${i18n.t(
                                              'render-form.forms.ethics-commission-form.ethical-issues-list-label',
                                          )}"
                                          value=${data.ethicalIssuesList || ''}
                                          rows="5"
                                          required></dbp-form-string-element>
                                  `
                                : ''
                        }

                        <dbp-form-string-element
                            subscribe="lang"
                            name="otherCommentsOnInformationProcessing"
                            maxlength="1000"
                            label="${i18n.t('render-form.forms.ethics-commission-form.other-comments-on-information-processing-label')}"
                            placeholder=""
                            value=${data.otherCommentsOnInformationProcessing || ''}
                            rows="5">
                        </dbp-form-string-element>
                    </div>
                </article>

                <article>
                    <h3 class="section-sub-title">6. ${i18n.t('render-form.forms.ethics-commission-form.section-conflicts-of-interest-title')}</h3>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="hasConflictOfInterest"
                        data-condition="yes"
                        display-mode="list"
                        required
                        label="6.1. ${i18n.t('render-form.forms.ethics-commission-form.has-conflict-of-interest-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasConflictOfInterest || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.conditionalFields.hasConflictOfInterest
                            ? html`
                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.conditionalFields.hasConflictOfInterest,
                                      })}"
                                      subscribe="lang"
                                      name="conflictOfInterestList"
                                      maxlength="1000"
                                      label="${i18n.t(
                                          'render-form.forms.ethics-commission-form.conflict-of-interest-list-label',
                                      )}"
                                      placeholder="Liste der Interessenskonflikten hier"
                                      value=${data.conflictOfInterestList || ''}
                                      rows="5"
                                      required></dbp-form-string-element>
                              `
                            : ''
                    }

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="hasConfidentialPart"
                        data-condition="yes"
                        display-mode="list"
                        required
                        label="6.2. ${i18n.t('render-form.forms.ethics-commission-form.has-confidential-part-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasConfidentialPart || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.conditionalFields.hasConfidentialPart
                            ? html`
                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.conditionalFields.hasConfidentialPart,
                                      })}"
                                      subscribe="lang"
                                      name="natureOfBlocking"
                                      maxlength="1000"
                                      label="6.2.1. ${i18n.t(
                                          'render-form.forms.ethics-commission-form.nature-of-blocking-label',
                                      )}"
                                      placeholder=""
                                      value=${data.natureOfBlocking || ''}
                                      rows="3"
                                      required></dbp-form-string-element>

                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.conditionalFields.hasConfidentialPart,
                                      })}"
                                      subscribe="lang"
                                      name="reasonOfBlocking"
                                      maxlength="1000"
                                      label="6.2.2. ${i18n.t(
                                          'render-form.forms.ethics-commission-form.reason-of-blocking-label',
                                      )}"
                                      placeholder=""
                                      value=${data.reasonOfBlocking || ''}
                                      rows="3"
                                      required></dbp-form-string-element>

                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.conditionalFields.hasConfidentialPart,
                                      })}"
                                      subscribe="lang"
                                      name="consequencesOfBlocking"
                                      maxlength="1000"
                                      label="6.2.3. ${i18n.t(
                                          'render-form.forms.ethics-commission-form.consequences-of-blocking-label',
                                      )}"
                                      placeholder=""
                                      value=${data.consequencesOfBlocking || ''}
                                      rows="3"
                                      required></dbp-form-string-element>

                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.conditionalFields.hasConfidentialPart,
                                      })}"
                                      subscribe="lang"
                                      name="canBeDoneDespiteRestrictions"
                                      maxlength="1000"
                                      label="6.2.4. ${i18n.t(
                                          'render-form.forms.ethics-commission-form.can-be-done-despite-restrictions-label',
                                      )}"
                                      placeholder=""
                                      value=${data.canBeDoneDespiteRestrictions || ''}
                                      rows="3"
                                      required></dbp-form-string-element>
                              `
                            : ''
                    }

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="hasConflictInContentControl"
                        data-condition="yes"
                        display-mode="list"
                        required
                        label="6.3. ${i18n.t('render-form.forms.ethics-commission-form.has-conflict-in-content-control-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasConflictInContentControl || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.conditionalFields.hasConflictInContentControl
                            ? html`
                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in':
                                              this.conditionalFields.hasConflictInContentControl,
                                      })}"
                                      subscribe="lang"
                                      name="conflictInContentControlList"
                                      maxlength="1000"
                                      label="6.3.1 ${i18n.t(
                                          'render-form.forms.ethics-commission-form.conflict-in-content-control-list-label',
                                      )}"
                                      placeholder="Liste der Interessenskonflikten hier"
                                      value=${data.conflictInContentControlList || ''}
                                      rows="5"
                                      required></dbp-form-string-element>
                              `
                            : ''
                    }

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="stakeholderParticipationPlanned"
                        data-condition="yes"
                        display-mode="list"
                        required
                        label="6.4. ${i18n.t('render-form.forms.ethics-commission-form.stakeholder-participation-planned-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.stakeholderParticipationPlanned || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.conditionalFields.stakeholderParticipationPlanned
                            ? html`
                                  <dbp-form-enum-element
                                      class="${classMap({
                                          'fade-in':
                                              this.conditionalFields
                                                  .stakeholderParticipationPlanned,
                                      })}"
                                      subscribe="lang"
                                      name="hasProvisionForAppropriateRecognition"
                                      display-mode="list"
                                      required
                                      label="6.4.1. ${i18n.t(
                                          'render-form.forms.ethics-commission-form.provision-for-appropriate-recognition-label',
                                      )}"
                                      .items=${{
                                          yes: i18n.t(
                                              'render-form.forms.ethics-commission-form.yes',
                                          ),
                                          no: i18n.t('render-form.forms.ethics-commission-form.no'),
                                      }}
                                      .value=${data.hasProvisionForAppropriateRecognition ||
                                      ''}></dbp-form-enum-element>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">7. ${i18n.t('render-form.forms.ethics-commission-form.section-working-conditions-title')}</h3>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="employmentContract"
                        display-mode="list"
                        required
                        label="7.1. ${i18n.t('render-form.forms.ethics-commission-form.employment-contract-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.employmentContract || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="workLifeBalance"
                        display-mode="list"
                        required
                        label="7.2. ${i18n.t('render-form.forms.ethics-commission-form.work-life-balance-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.workLifeBalance || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="fairCompensation"
                        display-mode="list"
                        required
                        label="7.3. ${i18n.t('render-form.forms.ethics-commission-form.fair-compensation-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.fairCompensation || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="diversityAspects"
                        data-condition="yes"
                        display-mode="list"
                        required
                        label=""
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.diversityAspects || ''}>
                        <span slot="label">
                            <dbp-translated subscribe="lang">
                                <div slot="de">
                                    7.4. Werden im Projekt diversitäts- und gendersensible Aspekte berücksichtigt (<a href='https://tu4u.tugraz.at/fileadmin/public/Studierende_und_Bedienstete/Anleitungen/Diversity-Gender_in_Forschungsprojekten_Checkliste_Deutsch.pdf?sword_list%5B0%5D=gender&sword_list%5B1%5D=forschung&no_cache=1' target='_blank'>siehe Leitfaden der TU Graz</a>)?
                                </div>
                                <div slot="en">
                                    7.4. Are diversity and gender-sensitive aspects considered in the project? (<a href='https://tu4u.tugraz.at/fileadmin/public/Studierende_und_Bedienstete/Anleitungen/Diversity-Gender_in_Forschungsprojekten_Checkliste_Deutsch.pdf?sword_list%5B0%5D=gender&sword_list%5B1%5D=forschung&no_cache=1' target='_blank'>see guidelines from TU Graz</a>)?
                                </div>
                            </dbp-translated>
                        </span>
                    </dbp-form-enum-element>

                    ${
                        this.conditionalFields.diversityAspects
                            ? html`
                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.conditionalFields.diversityAspects,
                                      })}"
                                      subscribe="lang"
                                      name="diversityAspectsExamples"
                                      maxlength="1000"
                                      label="7.4.1 ${i18n.t(
                                          'render-form.forms.ethics-commission-form.diversity-aspects-examples-label',
                                      )}"
                                      value=${data.diversityAspectsExamples || ''}
                                      rows="3"
                                      required></dbp-form-string-element>
                              `
                            : ''
                    }
                </article>

                <article>
                    <h3 class="section-sub-title">8. ${i18n.t('render-form.forms.ethics-commission-form.section-ethics-compass-title')}</h3>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="hasRiskOfReputationDamage"
                        display-mode="list"
                        required
                        label="8.1. ${i18n.t('render-form.forms.ethics-commission-form.risk-of-reputation-damage-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasRiskOfReputationDamage || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="specificTechnologyAssessment"
                        display-mode="list"
                        required
                        label="8.2. ${i18n.t('render-form.forms.ethics-commission-form.specific-technology-assessment-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.specificTechnologyAssessment || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="relatedToDevelopmentOfWeapons"
                        display-mode="list"
                        required
                        label="8.3. ${i18n.t('render-form.forms.ethics-commission-form.related-to-development-of-weapons-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.relatedToDevelopmentOfWeapons || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="hasDualUse"
                        display-mode="list"
                        required
                        label="8.4. ${i18n.t('render-form.forms.ethics-commission-form.has-dual-use-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasDualUse || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="hasAnyRisks"
                        data-condition="yes"
                        display-mode="list"
                        required
                        label="8.5. ${i18n.t('render-form.forms.ethics-commission-form.has-any-risks-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasAnyRisks || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.conditionalFields.hasAnyRisks
                            ? html`
                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.conditionalFields.hasAnyRisks,
                                      })}"
                                      subscribe="lang"
                                      name="risksReasons"
                                      maxlength="1000"
                                      label="8.5.1 ${i18n.t(
                                          'render-form.forms.ethics-commission-form.risks-reasons-label',
                                      )}"
                                      rows="3"
                                      required
                                      value=${data.risksReasons || ''}></dbp-form-string-element>
                              `
                            : ''
                    }

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="hasNegativeEffects"
                        display-mode="list"
                        required
                        label="8.6. ${i18n.t('render-form.forms.ethics-commission-form.has-negative-effects-label')}"
                        .items=${{
                            yes: i18n.t('render-form.forms.ethics-commission-form.yes'),
                            no: i18n.t('render-form.forms.ethics-commission-form.no'),
                        }}
                        .value=${data.hasNegativeEffects || ''}>
                    </dbp-form-enum-element>
                </article>



                <article>
                    <h3 class="section-title">${i18n.t('render-form.forms.ethics-commission-form.section-iv-title')}</h3>
                    <div class="description">
                        <dbp-translated subscribe="lang">
                            <div slot="en">
                                <p>If applicable: Please enclose questionnaires, survey forms or tasks addressed to participants with your application.</p>
                                <p>If necessary, you can enclose further documents that you consider relevant for the assessment of your research project as a whole.</p>
                            </div>
                            <div slot="de">
                                <p>Falls zutreffend: Bitte legen Sie an Proband*innen gerichtete Fragebögen, Erhebungsbögen oder Aufgabenstellungen Ihrem Antrag bei.</p>
                                <p>Allenfalls können Sie weitere Dokumente beilegen, die aus Ihrer Sicht von Relevanz für die Beurteilung Ihres Forschungsvorhabens im Gesamten sind.</p>
                            </div>
                        </dbp-translated>
                    </div>

                    <div class="file-upload-container">
                        <div class="file-upload-title-container">
                            <h4 class="attachments-title">
                                ${i18n.t('render-form.download-widget.attachments-title')}
                            </h4>
                            <span class="file-upload-limit-warning">
                                ${i18n.t('render-form.download-widget.file-upload-count-limit-warning', {count: this.fileUploadLimits?.allowedFileUploadCount?.attachments})}
                                ${i18n.t('render-form.download-widget.file-upload-size-limit-warning', {size: this.fileUploadLimits?.fileSizeLimit?.attachments})}
                            </span>
                        </div>

                        <div class="uploaded-files">
                            ${this.renderAttachedFilesHtml('attachments')}
                        </div>

                        <button
                            class="button is-secondary upload-button upload-button--attachment"
                            .disabled=${this.fileUploadCounts['attachments'] >= this.fileUploadLimits?.allowedFileUploadCount?.attachments}
                            @click="${(event) => {
                                this.currentUploadGroup = 'attachments';
                                this.openFilePicker(event);
                            }}">
                            <dbp-icon name="upload" aria-hidden="true"></dbp-icon>
                            ${i18n.t('render-form.download-widget.upload-file-button-label', {count: this.fileUploadLimits?.allowedFileUploadCount?.attachments})}
                        </button>
                    </div>

                    ${
                        this.isAdmin
                            ? html`
                                  <h3 class="section-title">
                                      ${i18n.t(
                                          'render-form.download-widget.admin-voting-file-upload',
                                      )}
                                  </h3>
                                  <div class="description">
                                      <dbp-translated subscribe="lang">
                                          <div slot="en">
                                              <p>
                                                  This field is filled in by the administrative
                                                  office.
                                              </p>
                                          </div>
                                          <div slot="de">
                                              <p>
                                                  Dieses Feld wird von der Geschäftsstelle
                                                  ausgefüllt.
                                              </p>
                                          </div>
                                      </dbp-translated>
                                  </div>

                                  <div class="file-upload-container">
                                      <div class="file-upload-title-container">
                                          <h4 class="attachments-title">
                                              ${i18n.t(
                                                  'render-form.forms.ethics-commission-form.admin-voting-results-title',
                                              )}
                                          </h4>
                                          <span class="file-upload-limit-warning">
                                              ${i18n.t(
                                                  'render-form.download-widget.file-upload-count-limit-warning',
                                                  {
                                                      count: this.fileUploadLimits
                                                          ?.allowedFileUploadCount?.voting,
                                                  },
                                              )}
                                          </span>
                                      </div>

                                      <div class="uploaded-files">
                                          ${this.renderAttachedFilesHtml('voting')}
                                      </div>

                                      <button
                                          class="button is-secondary upload-button upload-button--voting"
                                          .disabled=${this.fileUploadCounts['voting'] >=
                                          this.fileUploadLimits?.allowedFileUploadCount?.voting}
                                          @click="${(event) => {
                                              this.currentUploadGroup = 'voting';
                                              this.openFilePicker(event);
                                          }}">
                                          <dbp-icon name="upload" aria-hidden="true"></dbp-icon>
                                          ${i18n.t(
                                              'render-form.download-widget.upload-file-button-label',
                                              {
                                                  count: this.fileUploadLimits
                                                      ?.allowedFileUploadCount?.voting,
                                              },
                                          )}
                                      </button>
                                  </div>
                              `
                            : ''
                    }
                </article>
            </form>

            <dbp-file-source
                id="file-source"
                class="file-source"
                lang="${this.lang}"
                allowed-mime-types='application/pdf'
                max-file-size="50000"
                enabled-targets="local,clipboard,nextcloud"
                subscribe="nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-source>

            <dbp-file-sink
                id="file-sink"
                class="file-sink"
                lang="${this.lang}"
                allowed-mime-types="application/pdf,.pdf"
                decompress-zip
                enabled-targets="local,clipboard,nextcloud"
                filename="ethics-commission-form-${this.formData?.id || ''}-attachments.zip"
                subscribe="nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-sink>

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
