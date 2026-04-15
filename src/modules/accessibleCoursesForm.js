import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html, css} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import {sendNotification} from '@dbp-toolkit/common';
import {DbpStringElement, DbpStringView} from '@dbp-toolkit/form-elements';
import {CourseSelect} from './course-select.js';
import {DbpCourseSelectElement} from '../form/elements/courseselect.js';
import {DeletionConfirmationModal} from '../deletion-confirmation-modal.js';
import {getFormRenderUrl, SUBMISSION_STATES} from '../utils.js';
import {validateRequiredFields} from '@dbp-toolkit/form-elements/src/utils.js';

export default class extends BaseObject {
    getUrlSlug() {
        // URL-Slug
        return 'accessible-courses';
    }

    getFormComponent() {
        return FormalizeFormElement;
    }

    // Formalize-Formular-ID for course registration
    getFormIdentifier() {
        return '019ada3e-b7ff-7b35-b1dd-7b578d810955';
    }
}

class FormalizeFormElement extends BaseFormElement {
    constructor() {
        super();
        this.saveButtonEnabled = false;
        this.isUserAllowedToDownloadPdf = false;
        this._fetchingUserData = false;
        this._userDataFetched = false;

        // ensuring we have an object to extend
        this.formData = this.formData || {};

        this.handleFormDeleteSubmission = this.handleFormDeleteSubmission.bind(this);
        this.handleFormSaveSubmission = this.handleFormSaveSubmission.bind(this);
        this.handleValidationOnFocusOut = this.handleValidationOnFocusOut.bind(this);
    }

    static get properties() {
        return {
            ...super.properties,
            submissionError: {type: Boolean},
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Event listener for delete submission
            this.addEventListener(
                'DbpFormalizeFormDeleteSubmission',
                this.handleFormDeleteSubmission,
            );

            // Handle field validation on focus out
            this.shadowRoot.addEventListener('focusout', this.handleValidationOnFocusOut, {
                capture: true,
            });

            this.addEventListener('DbpFormalizeFormSaveSubmission', this.handleFormSaveSubmission);

            this.addEventListener('DbpFormalizeFormSubmission', async (event) => {
                const formData = event.detail.formData;

                // use Lecturer-Array from formData
                formData.lecturers = this.formData.lecturers || [];

                try {
                    this.isPostingSubmission = true;
                    if (this.wasSubmissionSuccessful) return;

                    // submit relevant data
                    const payload = {
                        courseName: formData.courseName,
                        lecturers: formData.lecturers,
                        adaptations: formData.adaptations,
                        matriculationNumber: formData.matriculationNumber ?? '',
                        studentGivenName: formData.studentGivenName ?? '',
                        studentFamilyName: formData.studentFamilyName ?? '',
                        studentEmail: formData.studentEmail ?? '',
                        comment: formData.comment ?? '',
                    };

                    const body = {
                        form: '/formalize/forms/' + '019ada3e-b7ff-7b35-b1dd-7b578d810955',
                        dataFeedElement: JSON.stringify(payload),
                    };

                    const response = await fetch(this.entryPointUrl + '/formalize/submissions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/ld+json',
                            Authorization: 'Bearer ' + this.auth.token,
                        },
                        body: JSON.stringify(body),
                    });

                    if (!response.ok) {
                        this.submissionError = true;
                        this.saveButtonEnabled = true;
                        throw new Error(`Response status: ${response.status}`);
                    } else {
                        this.wasSubmissionSuccessful = true;
                        this.submissionError = false;
                        this._('.form-title').style.display = 'none';
                        this._('.description').style.display = 'none';
                        this._('#accessible-courses-form').style.display = 'none';

                        // Notify parent component to refresh submission data
                        window.dispatchEvent(
                            new CustomEvent('dbpFormDataUpdated', {
                                detail: {needUpdate: true},
                                bubbles: true,
                                composed: true,
                            }),
                        );
                    }

                    this.submitted = this.wasSubmissionSuccessful;
                    return response;
                } catch (error) {
                    console.error(error.message);
                } finally {
                    this.isPostingSubmission = false;
                }
            });
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('DbpFormalizeFormSaveSubmission', this.handleFormSaveSubmission);
        this.removeEventListener(
            'DbpFormalizeFormDeleteSubmission',
            this.handleFormDeleteSubmission,
        );
        this.shadowRoot.removeEventListener('focusout', this.handleValidationOnFocusOut, {
            capture: true,
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

    static get scopedElements() {
        return {
            ...super.scopedElements,
            'dbp-form-string-element': DbpStringElement,
            'dbp-form-string-view': DbpStringView,
            'dbp-course-select-element': DbpCourseSelectElement,
            'dbp-course-select': CourseSelect,
            'dbp-deletion-confirmation-modal': DeletionConfirmationModal,
        };
    }

    async fetchUserData() {
        try {
            const response = await fetch(
                this.entryPointUrl +
                    '/base/people/' +
                    this.auth['user-id'] +
                    '?includeLocal=email,matriculationNumber',
                {
                    headers: {
                        'Content-Type': 'application/ld+json',
                        Authorization: 'Bearer ' + this.auth.token,
                    },
                },
            );
            if (!response.ok) throw new Error(response);

            const person = await response.json();

            // completing/updating fields
            this.formData = this.formData || {};

            this.formData.identifier = `${person['identifier']}`;
            this.formData.studentGivenName = `${person['givenName']}`;
            this.formData.studentFamilyName = `${person['familyName']}`;
            this.formData.matriculationNumber = `${person['localData']['matriculationNumber']}`;
            this.formData.studentEmail = `${person['localData']['email']}`;

            this.requestUpdate();
        } catch (error) {
            console.error(error.message);
        }
    }

    // Reaction to dbp-course-changed
    async handleCourseChange(e) {
        this.saveButtonEnabled = false;

        if (!this.formData) {
            this.formData = {};
        }

        const course = e.detail?.course;
        if (!course) {
            this.saveButtonEnabled = false;

            // if no course chosen, reset lecturers
            this.formData.lecturers = [];
            this.requestUpdate();
            return;
        }

        const lecturerIds = Array.isArray(course.localData?.lecturers)
            ? course.localData.lecturers.map((lecturer) =>
                  typeof lecturer === 'string' ? lecturer : lecturer.personIdentifier,
              )
            : [];

        const lecturerStrings = [];

        for (const lecturerId of lecturerIds) {
            try {
                const resp = await fetch(
                    `${this.entryPointUrl}/base/people/${lecturerId}?includeLocal=email`,
                    {
                        headers: {
                            'Content-Type': 'application/ld+json',
                            Authorization: 'Bearer ' + this.auth.token,
                        },
                    },
                );

                if (!resp.ok) {
                    console.warn('Lecturer fetch failed for', lecturerId, resp.status);
                    // Fallback: if person not found, return ID
                    lecturerStrings.push(lecturerId);
                    continue;
                }

                const person = await resp.json();
                const name = `${person.givenName ?? ''} ${person.familyName ?? ''}`.trim();
                const email = person.localData?.email ?? null;

                // concat String "Name (mail@tugraz.at)"
                const label = email ? `${name || lecturerId} (${email})` : name || lecturerId;

                lecturerStrings.push(label);
            } catch (err) {
                console.error('Error fetching lecturer', lecturerId, err);
                lecturerStrings.push(lecturerId); // Fallback bei Fehler
            }
        }
        // Enable submit button only after we have updated the lecturer data
        this.saveButtonEnabled = true;

        // store Array in formData
        this.formData.lecturers = lecturerStrings;

        // refresh UI
        this.requestUpdate();
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

        const confirmed = await this._('#deletion-modal').confirm();
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
                this.readOnly = false;
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

        const formData = event.detail.formData;

        const payload = {
            courseName: formData.courseName,
            lecturers: formData.lecturers,
            adaptations: formData.adaptations,
            matriculationNumber: formData.matriculationNumber ?? '',
            studentGivenName: formData.studentGivenName ?? '',
            studentFamilyName: formData.studentFamilyName ?? '',
            studentEmail: formData.studentEmail ?? '',
            comment: formData.comment ?? '',
        };

        const body = {
            form: '/formalize/forms/' + '019ada3e-b7ff-7b35-b1dd-7b578d810955',
            dataFeedElement: JSON.stringify(payload),
        };

        try {
            // const response = await fetch(url, options);
            const response = await fetch(this.entryPointUrl + '/formalize/submissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/ld+json',
                    Authorization: 'Bearer ' + this.auth.token,
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                await this.displayErrors(response);
            } else {
                // const responseBody = await response.json();

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
            console.error(error);
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t('errors.unknown-error-on-save-submission'),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    static get styles() {
        return [
            super.styles,
            commonStyles.getButtonCSS(),
            css`
                .title {
                    margin-top: 0;
                }

                .field-note {
                    margin-top: 0;
                    font-style: italic;
                }

                fieldset {
                    margin-bottom: 20px;
                }
            `,
        ];
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

        if (Object.keys(this.formData).length > 0) {
            // Check if submission already contains student data (from either key format)
            if (
                this.formData.studentGivenName &&
                this.formData.studentFamilyName &&
                this.formData.studentEmail &&
                this.formData.matriculationNumber
            ) {
                // Student data is already present, no need to fetch
                this._userDataFetched = true;
            } else if (!this._userDataFetched && !this._fetchingUserData) {
                // No student data from submission, fetch from logged-in user
                this._fetchingUserData = true;
                this.fetchUserData().finally(() => {
                    this._fetchingUserData = false;
                    this._userDataFetched = true;
                });
            }
        }

        const data = this.formData || {};

        // Extract courseId from courseName if available
        data.courseId = data.courseName ? data.courseName.replace(/^([a-zA-Z0-9]+): .*/, '$1') : '';

        return html`
            <form
                id="accessible-courses-form"
                class=${classMap({
                    hidden: this.hideForm,
                    'readonly-mode': this.readOnly,
                    'edit-mode': !this.readOnly,
                    'formalize-form': true,
                })}>
                <div class="form-header">${this.getButtonRowHtml()}</div>

                <h2 class="form-title">
                    ${i18n.t('render-form.forms.accessible-courses-form.title')}
                </h2>
                <p class="description">
                    ${i18n.t('render-form.forms.accessible-courses-form.mandatory-fields')}
                    <br />
                    ${i18n.t('render-form.forms.accessible-courses-form.course-information')}
                </p>

                <fieldset>
                    <legend>
                        ${i18n.t('render-form.forms.accessible-courses-form.course-data')}
                    </legend>

                    <dbp-course-select-element
                        subscribe="lang,auth,entry-point-url"
                        name="courseName"
                        label="${i18n.t('render-form.forms.accessible-courses-form.course-name')}"
                        value=${data.courseName || ''}
                        required
                        @dbp-course-changed=${(e) =>
                            this.handleCourseChange(e)}></dbp-course-select-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="lecturers"
                        label=${i18n.t('render-form.forms.accessible-courses-form.lecturers')}
                        value=${data.lecturers || ''}
                        disabled></dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="adaptations"
                        description=${i18n.t(
                            'render-form.forms.accessible-courses-form.description',
                        )}
                        aria-describedby="adapt-descr"
                        label=${i18n.t('render-form.forms.accessible-courses-form.adaptations')}
                        .value=${data.adaptations || ''}
                        required
                        rows="5"></dbp-form-string-element>
                </fieldset>

                <fieldset>
                    <legend>
                        ${i18n.t('render-form.forms.accessible-courses-form.personal-data')}
                    </legend>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="matriculationNumber"
                        label=${i18n.t(
                            'render-form.forms.accessible-courses-form.matriculation-number',
                        )}
                        value=${data.matriculationNumber || ''}
                        disabled></dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="studentGivenName"
                        label=${i18n.t('render-form.forms.accessible-courses-form.given-name')}
                        value=${data.studentGivenName || ''}
                        disabled></dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="studentFamilyName"
                        label=${i18n.t('render-form.forms.accessible-courses-form.family-name')}
                        value=${data.studentFamilyName || ''}
                        disabled></dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="studentEmail"
                        label=${i18n.t('render-form.forms.accessible-courses-form.email')}
                        value=${data.studentEmail || ''}
                        disabled></dbp-form-string-element>

                    ${this.isAdmin
                        ? html`
                              <dbp-form-string-element
                                  subscribe="lang"
                                  name="comment"
                                  label=${i18n.t(
                                      'render-form.forms.accessible-courses-form.comment',
                                  )}
                                  .value=${data.comment || ''}
                                  description=${i18n.t(
                                      'render-form.forms.accessible-courses-form.comment-placeholder',
                                  )}
                                  rows="5"></dbp-form-string-element>
                          `
                        : ''}
                </fieldset>
            </form>

            <dbp-deletion-confirmation-modal id="deletion-modal"></dbp-deletion-confirmation-modal>

            ${this.renderResult(this.submitted)} ${this.renderErrorMessage(this.submissionError)}
        `;
    }

    renderFormViews() {
        const i18n = this._i18n;
        const data = this.formData || {};

        return html`
            <form
                id="accessible-courses-form"
                class=${classMap({
                    hidden: this.hideForm,
                    'readonly-mode': this.readOnly,
                    'edit-mode': !this.readOnly,
                    'formalize-form': true,
                })}>
                <div class="form-header">${this.getButtonRowHtml()}</div>

                <h2 class="form-title">
                    ${i18n.t('render-form.forms.accessible-courses-form.title')}
                </h2>
                <fieldset>
                    <legend>
                        ${i18n.t('render-form.forms.accessible-courses-form.course-data')}
                    </legend>

                    <dbp-form-string-view
                        subscribe="lang,auth,entry-point-url"
                        name="courseName"
                        label="${i18n.t('render-form.forms.accessible-courses-form.course-name')}"
                        value=${data.courseName || ''}></dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="lecturers"
                        label=${i18n.t('render-form.forms.accessible-courses-form.lecturers')}
                        value=${data.lecturers || ''}></dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="adaptations"
                        description=${i18n.t(
                            'render-form.forms.accessible-courses-form.description',
                        )}
                        aria-describedby="adapt-descr"
                        label=${i18n.t('render-form.forms.accessible-courses-form.adaptations')}
                        .value=${data.adaptations || ''}></dbp-form-string-view>
                </fieldset>

                <fieldset>
                    <legend>
                        ${i18n.t('render-form.forms.accessible-courses-form.personal-data')}
                    </legend>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="matriculationNumber"
                        label=${i18n.t(
                            'render-form.forms.accessible-courses-form.matriculation-number',
                        )}
                        value=${data.matriculationNumber || ''}
                        disabled></dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="studentGivenName"
                        label=${i18n.t('render-form.forms.accessible-courses-form.given-name')}
                        value=${data.studentGivenName || ''}
                        disabled></dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="studentFamilyName"
                        label=${i18n.t('render-form.forms.accessible-courses-form.family-name')}
                        value=${data.studentFamilyName || ''}
                        disabled></dbp-form-string-view>

                    <dbp-form-string-view
                        subscribe="lang"
                        name="studentEmail"
                        label=${i18n.t('render-form.forms.accessible-courses-form.email')}
                        value=${data.studentEmail || ''}
                        disabled></dbp-form-string-view>

                    ${this.isAdmin
                        ? html`
                              <dbp-form-string-view
                                  subscribe="lang"
                                  name="comment"
                                  label=${i18n.t(
                                      'render-form.forms.accessible-courses-form.comment',
                                  )}
                                  .value=${data.comment || ''}
                                  description=${i18n.t(
                                      'render-form.forms.accessible-courses-form.comment-placeholder',
                                  )}
                                  rows="5"></dbp-form-string-view>
                          `
                        : ''}
                </fieldset>
            </form>

            <dbp-deletion-confirmation-modal id="deletion-modal"></dbp-deletion-confirmation-modal>
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

    async updated(changedProperties) {
        super.updated(changedProperties);
        const i18n = this._i18n;

        if (changedProperties.has('data') || changedProperties.has('readOnly')) {
            // Reset observer so it can re-attach if needed
            this._formHeaderObserved = false;
            this.stickyHeaderObserver();
        }

        if (changedProperties.has('data') && Object.keys(this.data).length > 0) {
            this.formData = JSON.parse(this.data.dataFeedElement);

            this.submissionId = this.data.identifier;
            this.currentSubmission = this.data;
            this.lastModifiedCreatorId = this.data.lastModifiedById;
            this.submissionBinaryState = this.data.submissionState;
            this.submissionGrantedActions = this.data.grantedActions;
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

            this.setButtonStates();
            this.isUserAllowedToDownloadPdf = false;

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
    }
}
