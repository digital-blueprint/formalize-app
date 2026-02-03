import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element.js';
import {ScopedElementsMixin, sendNotification, Button, Icon, DBPSelect} from '@dbp-toolkit/common';
import {ButtonTooltip} from '@dbp-toolkit/tooltip';
import {css, html} from 'lit';
import {createInstance} from '../i18n.js';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import {
    getSelectorFixCSS,
    getFormHeaderCSS,
    getFileUploadWidgetCSS,
    getTagsCSS,
} from '../styles.js';
import {
    getElementWebComponents,
    gatherFormDataFromElement,
    validateRequiredFields,
} from '@dbp-toolkit/form-elements/src/utils.js';
import {
    formatDate,
    arrayToObject,
    httpGetAsync,
    SUBMISSION_STATES,
    SUBMISSION_STATES_BINARY,
    SUBMISSION_COLLECTION_PERMISSIONS,
    SUBMISSION_PERMISSIONS,
    TAG_PERMISSIONS,
    isDraftStateEnabled,
    isSubmittedStateEnabled,
} from '../utils.js';

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
        this.formData = {};
        this.entryPointUrl = '';
        this.auth = {};
        this.formIdentifier = '';
        this.formUrlSlug = '';
        this.formProperties = {};
        this.submitted = false;
        this.submissionId = '';
        this.currentSubmission = {};
        this.userAllSubmissions = [];
        this.submissionError = false;
        this.readOnly = false;
        this.isAdmin = false;
        this.isFormValid = null;
        this.hideForm = false;
        /** @type {'draft' | 'submitted' | null} */
        this.currentState = null;
        this.allowedSubmissionStates = 4;
        this.allowedActionsWhenSubmitted = [];
        this.submissionBinaryState = SUBMISSION_STATES_BINARY.NONE;
        this.maxNumberOfSubmissionsPerUser = 10;
        this.lastModifiedCreatorName = null;
        this.lastModifiedCreatorId = null;
        this.fileUploadLimits = {};
        this.conditionalFields = {};

        // Tags
        this.selectedTags = {};
        this.allowedTags = {};
        this.newSubmissionId = null;

        // Responsive layout
        this.tagIsInline = 'inline';
        this.mediaQuery = null;

        // Grants
        this.formGrantedSubmissionCollectionActions = [];
        this.submissionGrantedActions = [];
        this.isUserAllowedToEditSubmission = false;
        this.isUserAllowedToEditPermission = false;
        this.isUserAllowedToDeleteSubmission = false;
        this.isUserAllowedToDownloadPdf = false;

        // Button
        this.saveButtonEnabled = true;

        this.isViewModeButtonAllowed = false;
        this.isDraftButtonAllowed = false;
        this.isDeleteSubmissionButtonAllowed = false;
        this.isSubmitButtonEnabled = false;
        this.isPrintButtonAllowed = false;

        // Form header observer
        this._formHeaderObserved = false;
        this._formHeaderObserver = null;

        this.isDownloadButtonAllowed = false;
        this.isSaveButtonEnabled = false;

        // Event handlers
        this.handleChangeEvents = this.handleChangeEvents.bind(this);
        this.handleToggleSubmissionState = this.handleToggleSubmissionState.bind(this);
        this.handleResize = this.handleResize.bind(this);

        // Conditional fields
        this.conditionalFields = {};
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-select': DBPSelect,
            'dbp-button-tooltip': ButtonTooltip,
        };
    }

    connectedCallback() {
        super.connectedCallback();

        // Set up matchMedia for responsive layout
        this.mediaQuery = window.matchMedia('(min-width: 350px)');
        this.handleResize();
        this.mediaQuery.addEventListener('change', this.handleResize);

        // @ts-ignore
        this.updateComplete.then(() => {
            // Event listener for form element changes
            this.addEventListener('change', this.handleChangeEvents);
            // Event listener for toggle submission state
            this.addEventListener(
                'DbpFormalizeFormToggleSubmissionState',
                this.handleToggleSubmissionState,
            );
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        // Clean up matchMedia listener
        if (this.mediaQuery) {
            this.mediaQuery.removeEventListener('change', this.handleResize);
            this.mediaQuery = null;
        }

        // Clean up form header observer
        if (this._formHeaderObserver) {
            this._formHeaderObserver.disconnect();
            this._formHeaderObserver = null;
        }
        this._formHeaderObserved = false;

        // Remove event listener for form element changes
        this.removeEventListener('change', this.handleChangeEvents);
        // Remove event listener for toggle submission state
        this.removeEventListener(
            'DbpFormalizeFormToggleSubmissionState',
            this.handleToggleSubmissionState,
        );
    }

    async validateAndSendSubmission(event) {
        event.preventDefault();

        const formElement = this.shadowRoot.querySelector('form');

        // Validate the form before proceeding
        const validationResult = await validateRequiredFields(formElement);
        console.log('validateAndSendSubmission validationResult', validationResult);
        if (!validationResult) {
            this.scrollToFirstInvalidField(formElement);
            return;
        }

        this.sendSubmission(event);
    }

    /**
     * Scroll to the first invalid field in the form and set the focus on it.
     * @param {HTMLFormElement} formElement
     */
    scrollToFirstInvalidField(formElement, setFocus = false) {
        const elementWebComponents = getElementWebComponents(formElement);
        for (const element of elementWebComponents) {
            const invalidElement = element.shadowRoot.querySelector('.validation-errors');
            if (invalidElement) {
                const invalidFieldLabel = invalidElement.closest('fieldset').querySelector('label');
                invalidFieldLabel.style.scrollMarginTop = '100px';
                invalidFieldLabel.scrollIntoView({behavior: 'smooth', block: 'start'});
                if (setFocus) {
                    const invalidFieldInput = invalidElement
                        .closest('fieldset')
                        .querySelector('input, textarea');
                    invalidFieldInput.focus();
                }
                break;
            }
        }
    }

    async toggleSubmissionState(event) {
        const data = {
            submissionId: this.submissionId,
        };

        const customEvent = new CustomEvent('DbpFormalizeFormToggleSubmissionState', {
            detail: data,
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(customEvent);
    }

    /**
     * Handle submitting draft from read-only view.
     * @param {object} event - The event object containing the form data.
     */
    async handleToggleSubmissionState(event) {
        const data = event.detail;
        const submissionId = data.submissionId;
        const formData = new FormData();

        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.SUBMITTED));

        const method = 'PATCH';
        const options = this._buildRequestOptions(formData, method);
        const url = this._buildSubmissionUrl(submissionId);

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
                this.currentState = SUBMISSION_STATES.SUBMITTED;
                this.submitted = true;

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
            sendNotification({
                summary: this._i18n.t('errors.error-title'),
                body: this._i18n.t('errors.unknown-error-on-form-submission'),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    /**
     * Sends a submission event with the given form data.
     * @param {object} event
     */
    sendSubmission(event) {
        this.saveButtonEnabled = false;
        const formElement = this.shadowRoot.querySelector('form');
        const data = {
            formData: gatherFormDataFromElement(formElement),
            submissionId: this.submissionId,
        };

        const customEvent = new CustomEvent('DbpFormalizeFormSubmission', {
            detail: data,
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(customEvent);
    }

    /**
     * Sends a draft submission event with the given form data.
     * @param {object} event
     */
    async sendSaveDraft(event) {
        this.draftButtonEnabled = false;
        const formElement = this.shadowRoot.querySelector('form');

        const data = {
            formData: gatherFormDataFromElement(formElement),
            submissionId: this.submissionId,
        };

        const customEvent = new CustomEvent('DbpFormalizeFormSaveDraft', {
            bubbles: true,
            composed: true,
            detail: data,
        });
        this.dispatchEvent(customEvent);
    }

    /**
     * Sends a delete submission event with the submission ID to delete.
     * @param {object} event
     */
    sendDeleteSubmission(event) {
        if (!this.submissionId) {
            return;
        }

        const data = {
            submissionId: this.submissionId,
        };

        const customEvent = new CustomEvent('DbpFormalizeFormDeleteSubmission', {
            bubbles: true,
            composed: true,
            detail: data,
        });
        this.dispatchEvent(customEvent);
    }

    /**
     * Sends an save submission event with the submission ID to PATCH.
     * @param {object} event
     */
    async sendSaveSubmission(event) {
        if (!this.submissionId) {
            return;
        }

        const formElement = this.shadowRoot.querySelector('form');

        // Validate the form before proceeding
        const validationResult = await validateRequiredFields(formElement);
        console.log('[sendSaveSubmission] validationResult', validationResult);
        if (!validationResult) {
            this.scrollToFirstInvalidField(formElement);
            return;
        }

        const data = {
            submissionId: this.submissionId,
            formData: gatherFormDataFromElement(formElement),
        };

        const customEvent = new CustomEvent('DbpFormalizeFormSaveSubmission', {
            bubbles: true,
            composed: true,
            detail: data,
        });
        this.dispatchEvent(customEvent);
    }

    disableLeavePageWarning() {
        const disableEvent = new CustomEvent('disableBeforeunloadWarning', {
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(disableEvent);
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            person: {type: Object},
            additionalType: {type: String, attribute: 'additional-type'},
            // For some reason, the attribute this.data was reset every time a new auth
            // object was set by Keycloak, so we use this.formData instead
            formData: {type: Object, attribute: false},
            data: {type: Object},
            auth: {type: Object},
            submitted: {type: Boolean, attribute: false},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            formIdentifier: {type: String, attribute: 'form-identifier'},
            formUrlSlug: {type: String, attribute: 'form-url-slug'},
            submissionError: {type: Boolean, attribute: false},
            hideForm: {type: Boolean, attribute: false},
            readOnly: {type: Boolean, attribute: 'read-only'},
            isFormValid: {type: Boolean, attribute: false},
            tagIsInline: {type: String, attribute: false},
            allowedSubmissionStates: {type: Number, attribute: 'allowed-submission-states'},
            maxNumberOfSubmissionsPerUser: {type: String, attribute: 'max-number-of-submissions'},

            formProperties: {type: Object},
            userAllSubmissions: {type: Array},
            conditionalFields: {type: Object, attribute: false},

            saveButtonEnabled: {type: Boolean, attribute: false},
            // Buttons
            isViewModeButtonAllowed: {type: Boolean, attribute: false},
            isDeleteSubmissionButtonAllowed: {type: Boolean, attribute: false},
            isDraftButtonAllowed: {type: Boolean, attribute: false},
            isSubmitButtonEnabled: {type: Boolean, attribute: false},
            isPrintButtonAllowed: {type: Boolean, attribute: false},
            isDownloadButtonAllowed: {type: Boolean, attribute: false},
        };
    }

    static get styles() {
        // language=css
        return css`
            @layer theme, utility, formalize, print;
            @layer theme {
                ${commonStyles.getGeneralCSS(false)}
                ${commonStyles.getButtonCSS()}
                ${getSelectorFixCSS()}

                .button-row {
                    margin-top: 1em;
                    text-align: right;
                }
            }
            @layer formalize {
                ${getFormHeaderCSS()}
                ${getTagsCSS()}
                ${getFileUploadWidgetCSS()}
            }
        `;
    }

    /**
     * Reset submission / state related fields end emit DbpFormalizeFormReset event.
     */
    resetForm(event) {
        event.preventDefault();
        this.saveButtonEnabled = true;

        this.currentSubmission = {};
        this.formData = {};
        this.data = {};
        this.currentState = null;
        this.lastModifiedCreatorName = '';
        this.submissionBinaryState = 0;
        this.submissionId = '';

        const customEvent = new CustomEvent('DbpFormalizeFormReset', {
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(customEvent);
    }

    /**
     * Render the buttons needed for the form.
     * @returns {import('lit').TemplateResult} HTML for the button row.
     */
    getButtonRowHtml() {
        const i18n = this._i18n;

        this.formActions = [];

        if (this.isUserAllowedToEditSubmission) {
            this.formActions.push({
                value: 'cancel',
                label: this.readOnly
                    ? i18n.t('render-form.forms.base-object.edit-mode')
                    : i18n.t('render-form.forms.base-object.view-mode'),
                iconName: this.readOnly ? 'pencil' : 'close',
            });
        }
        if (this.isUserAllowedToEditPermission) {
            this.formActions.push({
                value: 'edit-permissions',
                label: i18n.t('render-form.forms.base-object.edit-permission-button-text'),
                iconName: 'edit-permission',
            });
        }

        if (this.isUserAllowedToDownloadPdf) {
            this.formActions.push({
                value: 'download',
                label: i18n.t('render-form.forms.base-object.download-button-text'),
                iconName: 'download',
            });
        }

        if (this.isUserAllowedToDeleteSubmission) {
            this.formActions.push({
                value: 'delete',
                label:
                    this.currentState === SUBMISSION_STATES.SUBMITTED
                        ? i18n.t(
                              'render-form.forms.base-object.delete-submission-button-text-label',
                          )
                        : i18n.t('render-form.forms.base-object.discard-draft-button-text-label'),
                iconName: 'trash',
            });
        }

        return html`
            <div class="header-top">
                <div class="submission-info-wrapper">${this.renderSubmissionInfo()}</div>
                <div class="tag-management">${this.renderHeaderTags()}</div>
            </div>
            <div class="buttons-wrapper">
                <div class="status-tags-wrapper">
                    ${this.renderStatusTags()}
                    ${this.readOnly ? '' : this.renderFormValidityIndicator()}
                </div>

                <div class="action-buttons">
                    ${this.formActions.length > 0
                        ? html`
                              <dbp-select
                                  id="action-dropdown"
                                  label="${i18n.t(
                                      'render-form.forms.base-object.actions-dropdown-label',
                                  )}"
                                  .options="${this.formActions}"></dbp-select>
                          `
                        : ''}
                    ${this.isViewModeButtonAllowed
                        ? html`
                              <dbp-button
                                  id="toggle-edit-mode"
                                  class="toggle-edit-mode"
                                  type="is-secondary"
                                  no-spinner-on-click
                                  title="${i18n.t(
                                      'render-form.forms.base-object.toggle-edit-submission-button-title',
                                  )}"
                                  @click="${() => {
                                      if (this.readOnly) {
                                          this.redirectToEditForm(true);
                                          return;
                                      }

                                      const confirmed = confirm(
                                          this._i18n.t('render-form.form-exit-warning-message'),
                                      );
                                      if (confirmed) {
                                          const form = this.shadowRoot.querySelector('form');
                                          const data = gatherFormDataFromElement(form);
                                          if (Object.keys(data).length) {
                                              this.formData = data;
                                          }

                                          this.disableLeavePageWarning();
                                          this.redirectToReadonlyForm();
                                          this.readOnly = !this.readOnly;
                                          return;
                                      } else {
                                          // Do nothing if cancel was clicked
                                          return;
                                      }
                                  }}">
                                  ${this.readOnly
                                      ? html`
                                            <dbp-icon name="pencil"></dbp-icon>
                                            <span class="button-label">
                                                ${i18n.t('render-form.forms.base-object.edit-mode')}
                                            </span>
                                        `
                                      : html`
                                            <dbp-icon name="close"></dbp-icon>
                                            <span class="button-label">
                                                ${i18n.t('render-form.forms.base-object.view-mode')}
                                            </span>
                                        `}
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
                                      'render-form.forms.base-object.save-draft-button-text',
                                  )}"
                                  aria-label="${i18n.t(
                                      'render-form.forms.base-object.save-draft-button-text',
                                  )}">
                                  <dbp-icon name="save" aria-hidden="true"></dbp-icon>
                                  <span class="button-label">
                                      ${i18n.t(
                                          'render-form.forms.base-object.save-draft-button-text',
                                      )}
                                  </span>
                              </dbp-button>
                          `
                        : ''}
                    ${this.isSaveButtonEnabled
                        ? html`
                              <dbp-button
                                  class="form-save-button"
                                  type="is-primary"
                                  no-spinner-on-click
                                  @click=${this.sendSaveSubmission}
                                  title="${i18n.t(
                                      'render-form.forms.base-object.save-button-text',
                                  )}"
                                  aria-label="${i18n.t(
                                      'render-form.forms.base-object.save-button-text',
                                  )}">
                                  <dbp-icon name="checkmark-circle" aria-hidden="true"></dbp-icon>
                                  <span class="button-label">
                                      ${i18n.t('render-form.forms.base-object.save-button-text')}
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
                                  @click=${(event) => {
                                      this.readOnly
                                          ? this.toggleSubmissionState(event)
                                          : this.validateAndSendSubmission(event);
                                  }}
                                  title="${i18n.t(
                                      'render-form.forms.base-object.submit-button-text',
                                  )}"
                                  aria-label="${i18n.t(
                                      'render-form.forms.base-object.submit-button-text',
                                  )}">
                                  <dbp-icon name="send-diagonal" aria-hidden="true"></dbp-icon>
                                  <span class="button-label">
                                      ${i18n.t('render-form.forms.base-object.submit-button-text')}
                                  </span>
                              </dbp-button>
                          `
                        : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render form tag management in the header.
     * @returns {import('lit').TemplateResult} - HTML for the tag management section in the header.
     */
    renderHeaderTags() {
        if (Object.keys(this.allowedTags).length === 0) {
            return html``;
        }

        if (
            this.formProperties.tagPermissionsForSubmitters === TAG_PERMISSIONS.NONE &&
            !this.isAdmin
        ) {
            return html``;
        }

        if (this.readOnly) {
            if (
                this.formProperties.tagPermissionsForSubmitters >= TAG_PERMISSIONS.READ ||
                this.isAdmin
            ) {
                return Object.values(this.selectedTags).length > 0
                    ? html`
                          <dbp-form-enum-view
                              subscribe="lang"
                              name="formTags"
                              display-mode="tags"
                              layout-type="inline"
                              label="Tags:"
                              .value=${Object.values(this.selectedTags)}></dbp-form-enum-view>
                      `
                    : html``;
            }
            return html``;
        } else {
            // Edit mode
            if (
                this.isAdmin ||
                this.formProperties.tagPermissionsForSubmitters >= TAG_PERMISSIONS.READ_ADD
            ) {
                return html`
                    <dbp-form-enum-element
                        id="form-tags"
                        name="formTags"
                        subscribe="lang"
                        label="Tags:"
                        @change="${(event) => {
                            if (this.allowedTags && Object.keys(this.allowedTags).length > 0) {
                                this.setCurrentTags(event);
                            }
                        }}"
                        display-mode="tags"
                        layout-type="${this.tagIsInline}"
                        multiple
                        .tagPlaceholder=${{en: 'Select tags', de: 'Wähle Tags'}}
                        .value=${Object.values(this.selectedTags)}
                        .items=${this.allowedTags}></dbp-form-enum-element>
                `;
            } else {
                if (
                    this.formProperties.tagPermissionsForSubmitters >= TAG_PERMISSIONS.READ &&
                    Object.values(this.selectedTags).length > 0
                ) {
                    return html`
                        <dbp-form-enum-view
                            subscribe="lang"
                            name="formTags"
                            display-mode="tags"
                            layout-type="inline"
                            label="Tags:"
                            .value=${Object.values(this.selectedTags)}></dbp-form-enum-view>
                    `;
                }
                return html``;
            }
        }
    }

    /**
     * Handle responsive layout based on viewport width
     */
    handleResize() {
        this.tagIsInline = this.mediaQuery?.matches ? 'inline' : '';
    }

    /**
     * Set the current selected tags from the event.
     * @param {CustomEvent} event - The change event containing selected tags.
     */
    setCurrentTags(event) {
        if (Object.keys(this.allowedTags).length === 0) return;

        let selectedTags = {};
        const selectedTagsFromEvent = event.detail.value;

        if (selectedTagsFromEvent.length > 0) {
            for (const tagName of selectedTagsFromEvent) {
                selectedTags[tagName] = tagName;
            }
        }
        this.selectedTags = selectedTags;
    }

    /**
     * Render status tags for the form.
     * @returns {import('lit').TemplateResult} - HTML for the status tags.
     */
    renderStatusTags() {
        const stateTag = this.currentState;
        const tagTranslations = {
            draft: this._i18n.t('render-form.forms.base-object.draft-state-tag-label'),
            submitted: this._i18n.t('render-form.forms.base-object.submitted-state-tag-label'),
        };
        const modeTag = !this.readOnly
            ? this._i18n.t('render-form.forms.base-object.edit-mode-tag-label')
            : '';

        return html`
            <div class="tag-container">
                ${stateTag
                    ? html`
                          <span class="tag tag--state">${tagTranslations[stateTag]}</span>
                      `
                    : ''}
                ${modeTag
                    ? html`
                          <span class="tag tag--mode">${modeTag}</span>
                      `
                    : ''}
            </div>
        `;
    }

    renderFormValidityIndicator() {
        if (this.isFormValid) {
            return html`
                <div class="form-validity-indicator valid">
                    <!-- <span class="validity-indicator valid"></span> -->
                    <dbp-icon name="checkmark-circle" aria-hidden="true"></dbp-icon>
                    <span class="validity-text">
                        ${this._i18n.t('render-form.forms.base-object.form-validity-valid-text')}
                    </span>
                    <dbp-button-tooltip
                        text-content="${this._i18n.t(
                            'render-form.forms.base-object.form-validity-valid-tooltip',
                        )}"
                        button-text=" "
                        icon-name="question-circle"></dbp-button-tooltip>
                </div>
            `;
        } else {
            return html`
                <div class="form-validity-indicator invalid">
                    <!-- <span class="validity-indicator invalid"></span> -->
                    <dbp-icon name="cross-circle" aria-hidden="true"></dbp-icon>
                    <span class="validity-text">
                        ${this._i18n.t('render-form.forms.base-object.form-validity-invalid-text')}
                    </span>
                    <dbp-button-tooltip
                        text-content="${this._i18n.t(
                            'render-form.forms.base-object.form-validity-invalid-tooltip',
                        )}"
                        button-text=" "
                        icon-name="question-circle"></dbp-button-tooltip>
                </div>
            `;
        }
    }

    /**
     * Redirects to the readonly form by appending '/readonly' to the current URL.
     */
    redirectToReadonlyForm() {
        const currentUrl = window.location.href;
        const url = new URL(currentUrl);
        const pathname = url.pathname.replace(/\/+$/, '');
        url.pathname = !pathname.match(/\/readonly$/) ? pathname + '/readonly' : pathname;

        url.searchParams.delete('validate');

        window.history.pushState({}, '', url);
        // Redirect to the new URL
        window.location.href = url.toString();
    }

    /**
     * Redirects to the edit form by removing '/readonly' from the current URL.
     */
    redirectToEditForm(requireValidation = false) {
        const currentUrl = window.location.href;
        const url = new URL(currentUrl);
        if (url.pathname.endsWith('/readonly')) {
            // Remove '/readonly' from the pathname
            const readOnlyPath = url.pathname.replace(/\/readonly$/, '');
            url.pathname = readOnlyPath;

            if (requireValidation) {
                // Append 'validate=true' query parameter
                url.searchParams.set('validate', 'true');
            }

            window.history.pushState({}, '', url);
            // Redirect to the new URL
            window.location.href = url.toString();
        }
    }

    /**
     * Evaluates whether a condition is met for a given value.
     * @param {string|string[]} value - The field value to check
     * @param {string} condition - The condition string from data-condition attribute
     * @returns {boolean} Whether the condition is met
     */
    evaluateCondition(value, condition) {
        // Try to parse condition as JSON array
        let conditionArray = null;
        if (condition.startsWith('[') && condition.endsWith(']')) {
            try {
                conditionArray = JSON.parse(condition);
            } catch (e) {
                console.warn('Failed to parse condition as JSON array:', e);
                // If parsing fails, treat as string
                conditionArray = null;
            }
        }

        let isConditionMet;

        // Handle array conditions
        if (conditionArray !== null && Array.isArray(conditionArray)) {
            if (Array.isArray(value)) {
                // Check if any value item is in condition array
                isConditionMet = value.some((v) => conditionArray.includes(v));
            } else {
                // Check if value is in condition array
                isConditionMet = conditionArray.includes(value);
            }
        }
        // Handle negation with ! prefix
        else if (condition.startsWith('!')) {
            const negatedCondition = condition.substring(1);
            if (Array.isArray(value)) {
                isConditionMet = value.includes(negatedCondition) ? false : true;
            } else {
                isConditionMet = value !== negatedCondition;
            }
        } else {
            if (Array.isArray(value)) {
                isConditionMet = value.includes(condition) ? true : false;
            } else {
                isConditionMet = value === condition;
            }
        }

        return isConditionMet;
    }

    /**
     * Update formData if field value changes
     * @param {CustomEvent} event
     */
    handleChangeEvents(event) {
        // Action dropdown buttons
        if (event.detail && event.detail.option && event.detail.value) {
            const option = event.detail.option;
            const value = event.detail.value;

            // Toggle readOnly / edit mode
            if (option.value === 'cancel' && value === 'cancel') {
                if (this.readOnly) {
                    this.redirectToEditForm(true);
                    return;
                }
                const confirmed = confirm(
                    this._i18n.t('render-form.forms.base-object.form-exit-warning-message'),
                );
                if (confirmed) {
                    const form = this.shadowRoot.querySelector('form');
                    const data = gatherFormDataFromElement(form);
                    if (Object.keys(data).length) {
                        this.formData = data;
                    }

                    this.disableLeavePageWarning();
                    this.redirectToReadonlyForm();
                    this.readOnly = !this.readOnly;
                    return;
                } else {
                    // Do nothing if cancel was clicked
                    return;
                }
            }

            if (option.value === 'delete' && value === 'delete') {
                this.sendDeleteSubmission();
                return;
            }

            if (option.value === 'save' && value === 'save') {
                this.sendSaveSubmission();
                return;
            }
        }

        // Form elements
        if (event.detail && event.detail.fieldName && event.detail.value) {
            const fieldName = event.detail.fieldName;
            const value = event.detail.value;

            // Update form data
            this.formData[fieldName] = value;

            // Handle conditional fields
            const field = this._(`[name=${fieldName}]`);
            const condition = field.dataset?.condition;
            if (!condition) return;

            const isConditionMet = this.evaluateCondition(value, condition);

            // Update conditional fields
            this.conditionalFields = {
                ...this.conditionalFields,
                [fieldName]: isConditionMet,
            };
        }
    }

    /**
     * Handle conditional fields initialization.
     */
    async processConditionalFields() {
        const conditionalFields = this._a('[data-condition]');
        const conditionalFieldsCount = conditionalFields.length;

        conditionalFields.forEach((field) => {
            const value = field.value;
            if (value === undefined || value === '') return;

            const fieldName = field.getAttribute('name');
            const condition = field.dataset.condition;

            const isConditionMet = this.evaluateCondition(value, condition);

            if (this.conditionalFields[fieldName] !== undefined) {
                this.conditionalFields = {
                    ...this.conditionalFields,
                    [fieldName]: isConditionMet,
                };
            }
        });

        await this.updateComplete;

        // Run again to handle conditional fields inside other conditional fields just rendered
        const newConditionalFieldsCount = this._a('[data-condition]').length;
        if (newConditionalFieldsCount > conditionalFieldsCount) {
            await this.processConditionalFields();
        }
    }

    /**
     * Render submission details
     * Creation date, last modified, last modified by.
     * @returns {import('lit').TemplateResult} The HTML template result
     */
    renderSubmissionInfo() {
        const i18n = this._i18n;

        const dateCreated = formatDate(this.currentSubmission.dateCreated);
        const dateLastModified = formatDate(this.currentSubmission.dateLastModified);
        const deadLine = formatDate(this.currentSubmission.availabilityEnds);

        return html`
            <div class="submission-info">
                ${deadLine
                    ? html`
                          <div class="submission-deadline">
                              <span class="label">
                                  ${i18n.t(
                                      'render-form.forms.base-object.submission-deadline-label',
                                  )}:
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
                                      'render-form.forms.base-object.submission-creation-date-label',
                                  )}:
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
                                      'render-form.forms.base-object.last-modified-date-label',
                                  )}:
                              </span>
                              <span class="value">${dateLastModified}</span>
                          </div>
                      `
                    : ''}
                ${this.lastModifiedCreatorName
                    ? html`
                          <div class="last-modified-by">
                              <span class="label">
                                  ${i18n.t(
                                      'render-form.forms.base-object.last-modified-by-name-label',
                                  )}:
                              </span>
                              <span class="value">${this.lastModifiedCreatorName}</span>
                          </div>
                      `
                    : ''}
            </div>
        `;
    }

    async update(changedProperties) {
        super.update(changedProperties);

        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    break;
            }
        });

        if (changedProperties.has('data')) {
            console.log('[base-object] Data property changed:', this.data);
            // @ts-ignore
            // this.updateComplete.then(async () => {
            //     await this.processConditionalFields();
            //     // If query parameter 'validate' is set to true, validate required fields
            //     const urlParams = new URLSearchParams(window.location.search);
            //     if (this.readOnly === false && urlParams.get('validate') === 'true') {
            //         const formElement = this.shadowRoot.querySelector('form');
            //         this.isFormValid = await validateRequiredFields(formElement);
            //         if (!this.isFormValid) {
            //             this.scrollToFirstInvalidField(formElement, true);
            //             // Show notification
            //             sendNotification({
            //                 summary: this._i18n.t('errors.warning-title'),
            //                 body: this._i18n.t('errors.form-validation-warning-notification-body'),
            //                 type: 'warning',
            //                 timeout: 5,
            //             });
            //         }
            //     }
            // });
        }

        if (changedProperties.has('userAllSubmissions')) {
            this.setButtonStates();
        }

        if (changedProperties.has('formProperties')) {
            if (Object.keys(this.formProperties).length > 0) {
                this.allowedActionsWhenSubmitted = this.formProperties.allowedActionsWhenSubmitted;
                this.formGrantedSubmissionCollectionActions =
                    this.formProperties.grantedSubmissionCollectionActions;
                this.allowedTags = arrayToObject(this.formProperties.availableTags);
                this.fileUploadLimits = this.getFileUploadLimits(
                    this.formProperties?.dataFeedSchema,
                );
                this.isAdmin = this.formGrantedSubmissionCollectionActions.some(
                    (grant) =>
                        grant === SUBMISSION_COLLECTION_PERMISSIONS.MANAGE ||
                        grant === SUBMISSION_COLLECTION_PERMISSIONS.UPDATE,
                );
                this.setButtonStates();
            }
        }
    }

    /**
     * Sets the button states based on the submission state and user permissions.
     */
    setButtonStates() {
        console.log(
            `this.formGrantedSubmissionCollectionActions`,
            this.formGrantedSubmissionCollectionActions,
        );
        console.log(`this.submissionGrantedActions`, this.submissionGrantedActions);

        this.isViewModeButtonAllowed = false;
        this.isDraftButtonAllowed = false;
        this.isDeleteSubmissionButtonAllowed = false;
        this.isSubmitButtonEnabled = false;
        this.isPrintButtonAllowed = false;
        this.isDownloadButtonAllowed = false;
        this.isSaveButtonEnabled = false;

        // Dropdown actions
        this.isUserAllowedToEditSubmission = false;
        this.isUserAllowedToEditPermission = false;
        this.isUserAllowedToDeleteSubmission = false;
        this.isUserAllowedToDownloadPdf = false;

        // No state
        if (this.submissionBinaryState === SUBMISSION_STATES_BINARY.NONE) {
            this.isDraftButtonAllowed =
                isDraftStateEnabled(this.allowedSubmissionStates) &&
                (this.formGrantedSubmissionCollectionActions?.includes(
                    SUBMISSION_COLLECTION_PERMISSIONS.MANAGE,
                ) ||
                    this.formGrantedSubmissionCollectionActions?.includes(
                        SUBMISSION_COLLECTION_PERMISSIONS.CREATE_SUBMISSIONS,
                    ));

            this.isSubmitButtonEnabled =
                isSubmittedStateEnabled(this.allowedSubmissionStates) &&
                (this.formGrantedSubmissionCollectionActions?.includes(
                    SUBMISSION_COLLECTION_PERMISSIONS.MANAGE,
                ) ||
                    this.formGrantedSubmissionCollectionActions.includes(
                        SUBMISSION_COLLECTION_PERMISSIONS.CREATE_SUBMISSIONS,
                    ));
        }

        // DRAFT
        if (this.currentState === SUBMISSION_STATES.DRAFT) {
            this.isSubmitButtonEnabled =
                isSubmittedStateEnabled(this.allowedSubmissionStates) &&
                (this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.UPDATE));
            if (!this.readOnly) {
                // edit mode
                this.isViewModeButtonAllowed = true;
                this.isDraftButtonAllowed =
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.UPDATE);
            } else {
                // view mode
                this.isUserAllowedToDownloadPdf = true;
                this.isUserAllowedToEditSubmission =
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.UPDATE);
                this.isUserAllowedToEditPermission = this.submissionGrantedActions.includes(
                    SUBMISSION_PERMISSIONS.MANAGE,
                );
                this.isUserAllowedToDeleteSubmission =
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.DELETE);
            }
        }

        // SUBMITTED
        if (this.currentState === SUBMISSION_STATES.SUBMITTED) {
            if (!this.readOnly) {
                // edit mode
                this.isViewModeButtonAllowed = true;
                this.isSaveButtonEnabled =
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.UPDATE);
            } else {
                // view mode
                this.isUserAllowedToDownloadPdf = true;
                this.isUserAllowedToEditSubmission =
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.UPDATE);

                this.isUserAllowedToEditPermission = this.submissionGrantedActions.includes(
                    SUBMISSION_PERMISSIONS.MANAGE,
                );

                this.isUserAllowedToDeleteSubmission =
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                    this.submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.DELETE);
            }
        }
    }

    /**
     * @typedef {object} AttachmentApiFile
     * @property {string} fileName - name of the file
     * @property {string} downloadUrl - blob download URL
     * @property {number} [fileSize] - size of the file
     * @property {string} fileAttributeName - file attribute name
     * @property {string} identifier - file identifier uuid
     * @property {string} mimeType - file MIME type
     */

    /**
     * Transforms the API response to a File object.
     * @param {AttachmentApiFile[]} apiFileResponse
     * @returns {Promise<Map<string, File>>} A promise that resolves to a map of file identifiers to File objects
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
                    sendNotification({
                        summary: this._i18n.t('errors.other-title'),
                        body: this._i18n.t('errors.other-body'),
                        type: 'danger',
                        timeout: 0,
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

    /**
     * Get allowed file upload counts from the data feed schema.
     * @param {string} dataFeedSchema
     * @returns {object} - An object mapping file types to their allowed upload counts.
     */
    getAllowedFileUploadCount(dataFeedSchema) {
        if (!dataFeedSchema) return {};

        let formSchemaFields = {};
        let allowedFileUploadCount = {};
        try {
            formSchemaFields = JSON.parse(dataFeedSchema);
            if (formSchemaFields.files === undefined) return {};
            for (const [type, fileField] of Object.entries(formSchemaFields.files)) {
                allowedFileUploadCount[type] = fileField.maxNumber;
                fileField.maxSizeMb;
            }
            return allowedFileUploadCount;
        } catch (e) {
            console.log('Failed parsing json data', e);
            return {};
        }
    }

    /**
     * Get allowed file upload counts from the data feed schema.
     * @param {string} dataFeedSchema
     * @returns {object} - An object mapping file types to their limits.
     */
    getFileUploadLimits(dataFeedSchema) {
        if (!dataFeedSchema) return {};

        let formSchemaFields = {};
        let fileUploadLimits = {
            allowedFileUploadCount: {},
            fileSizeLimit: {},
        };

        try {
            formSchemaFields = JSON.parse(dataFeedSchema);
            if (formSchemaFields.files === undefined) return {};
            for (const [type, fileField] of Object.entries(formSchemaFields.files)) {
                fileUploadLimits.allowedFileUploadCount[type] = fileField.maxNumber;
                fileUploadLimits.fileSizeLimit[type] = fileField.maxSizeMb;
            }
            return fileUploadLimits;
        } catch (e) {
            console.log('Failed parsing json data', e);
            return {};
        }
    }

    /**
     * Loop through errorDetails object keys and format messages
     * @param {object} responseBody
     */
    displayValidationErrors(responseBody) {
        const errorDetails = responseBody['relay:errorDetails'];
        let errorDetailsMessages = [];
        Object.keys(errorDetails).forEach((fieldName) => {
            const fieldErrors = errorDetails[fieldName];
            fieldErrors.forEach((errorMessage) => {
                fieldName = fieldName.replace(/^\//, '');
                errorDetailsMessages.push(`${fieldName}: ${errorMessage}`);
            });
        });
        sendNotification({
            summary: this._i18n.t('errors.error-title'),
            body: this._i18n.t('errors.validation-failed', {
                details: errorDetailsMessages.join('; '),
            }),
            type: 'danger',
            timeout: 0,
        });
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
     * Add a 'is-pinned' class to the form header when it's sticky.
     */
    stickyHeaderObserver() {
        // Only attach observer if .form-header exists and not already observed
        if (!this._formHeaderObserved) {
            const formHeader = this._('.form-header');
            if (formHeader) {
                const options = {
                    rootMargin: '0px',
                    scrollMargin: '0px',
                    threshold: 0.45,
                };

                const callback = (entries, observer) => {
                    entries.forEach((entry) => {
                        entry.target.classList.toggle('is-pinned', entry.intersectionRatio < 0.45);
                    });
                };

                const observer = new IntersectionObserver(callback, options);
                observer.observe(formHeader);
                this._formHeaderObserved = true;
                this._formHeaderObserver = observer;
            }
        }
    }

    render() {
        console.log('-- Render BaseFormElement --');

        return html`
            <form>Please implement render() in your subclass! ${this.getButtonRowHtml()}</form>
        `;
    }
}
