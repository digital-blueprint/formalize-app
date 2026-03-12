import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html, css} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {
    DbpStringElement,
    DbpDateElement,
    DbpTimeElement,
    DbpBooleanElement,
} from '@dbp-toolkit/form-elements';
import {DbpPersonSelectElement} from '../form/elements/personselect.js';
import {PersonSelect} from '@dbp-toolkit/person-select';
import {CourseSelect} from './course-select.js';
import {RoomSelect} from './room-select.js';
import {DbpCourseSelectElement} from '../form/elements/courseselect.js';
import {DbpRoomSelectElement} from '../form/elements/roomselect.js';
import {createRef, ref} from 'lit/directives/ref.js';

export default class extends BaseObject {
    getUrlSlug() {
        return 'accessible-exams';
    }

    /**
     * @returns {string}
     */
    getFormComponent() {
        return FormalizeFormElement;
    }

    getFormIdentifier() {
        return '0193cfbd-9b68-703a-81f9-c10d0e2375b7';
    }
}

class FormalizeFormElement extends BaseFormElement {
    constructor() {
        super();
        this.beginTimeRef = createRef();
        this.examinerTextRef = createRef();
        this.examinerTextDisabled = false;
    }

    static get properties() {
        return {
            ...super.properties,
            submissionError: {type: Boolean},
            examinerTextDisabled: {type: Boolean},
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Event listener for form submission
            this.addEventListener('DbpFormalizeFormSubmission', async (event) => {
                // Get the form data from the event detail
                const formData = event.detail.formData;
                // Include unique identifier for the person who is submitting
                formData.identifier = this.formData.identifier;
                // Create UUID for each submission
                this.createUUID();
                formData.uuid = this.formData.uuid;
                // Create a human-readable exam id for each submission
                this.createExamID();
                formData.examid = this.formData.examid;

                if (formData.examinerText) {
                    // Set examinerText as examiner
                    formData.examiner = formData.examinerText;
                    formData.email_examiner = '';
                } else {
                    // Extract name and email from examiner data
                    let examinerData = this.getExaminerMail(formData.examiner);
                    formData.examiner = examinerData[0] ?? '';
                    formData.email_examiner = examinerData[1] ?? '';
                }

                // We always need to delete the examinerText field, because it's not in the schema
                delete formData.examinerText;

                // Extract name and email from additional examiner data
                let additionalExaminerData = this.getExaminerMail(formData.additionalExaminer);
                formData.additionalExaminer = additionalExaminerData[0];
                formData.email_additionalExaminer = additionalExaminerData[1];

                // Handle the event
                console.log('Form submission data:', formData);

                try {
                    this.isPostingSubmission = true;

                    if (this.wasSubmissionSuccessful) {
                        return;
                    }

                    let body = {
                        form: '/formalize/forms/' + '0193cfbd-9b68-703a-81f9-c10d0e2375b7',
                        dataFeedElement: JSON.stringify(formData),
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
                        await this.displayErrors(response);
                    } else {
                        this.wasSubmissionSuccessful = true;
                        this.submissionError = false;
                        // Hide form after successful submission
                        this._('#title').style.display = 'none';
                        this._('#description').style.display = 'none';
                        this._('#accessible-exams-form').style.display = 'none';
                    }

                    this.submitted = this.wasSubmissionSuccessful;
                    console.log(this.wasSubmissionSuccessful, response);
                    return response;
                } catch (error) {
                    console.error(error.message);
                } finally {
                    this.isPostingSubmission = false;
                }
            });
        });
    }

    static get scopedElements() {
        return {
            'dbp-form-string-element': DbpStringElement,
            'dbp-form-date-element': DbpDateElement,
            'dbp-form-time-element': DbpTimeElement,
            'dbp-form-boolean-element': DbpBooleanElement,
            'dbp-course-select-element': DbpCourseSelectElement,
            'dbp-room-select-element': DbpRoomSelectElement,
            'dbp-course-select': CourseSelect,
            'dbp-room-select': RoomSelect,
            'dbp-person-select-element': DbpPersonSelectElement,
            'dbp-person-select': PersonSelect,
        };
    }

    async fetchUser(id) {
        return await fetch(
            this.entryPointUrl + '/base/people/' + id + '?includeLocal=email,matriculationNumber',
            {
                headers: {
                    'Content-Type': 'application/ld+json',
                    Authorization: 'Bearer ' + this.auth.token,
                },
            },
        );
    }

    async getLecturer(id) {
        let response = await this.fetchUser(id);
        if (!response.ok) {
            throw new Error(response);
        }
        this.formData.examiner = response.firstname;
    }
    async fetchUserData() {
        console.log('Fetching user data ...');
        try {
            let response = await this.fetchUser(this.auth['user-id']);
            if (!response.ok) {
                throw new Error(response);
            }
            this.formData = await response.json();
            this.formData.identifier = `${this.formData['identifier']}`;
            this.formData.givenName = `${this.formData['givenName']}`;
            this.formData.familyName = `${this.formData['familyName']}`;
            this.formData.matriculationNumber = `${this.formData['localData']['matriculationNumber']}`;
            this.formData.email_student = `${this.formData['localData']['email']}`;
        } catch (error) {
            console.error(error.message);
        }
    }

    createUUID() {
        let uuid = self.crypto.randomUUID();
        console.log('Created UUID: ' + uuid);
        this.formData.uuid = uuid;
    }

    createExamID() {
        // create a random five-digit ID
        let min = 10000;
        let max = 99999;
        let examid = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log('Created ExamID: ' + examid);
        this.formData.examid = examid;
    }

    getExaminerMail(examinerdata) {
        const nameAndMail = examinerdata.split(' ');
        const name = nameAndMail.slice(0, -1).join(' ');
        const mail = nameAndMail[nameAndMail.length - 1];
        return [name, mail];
    }

    static get styles() {
        return [
            super.styles,
            css`
                #title {
                    margin-top: 0;
                }
            `,
        ];
    }

    render() {
        const i18n = this._i18n;
        console.log('-- Render FormalizeFormElement --');

        if (!this.formData.givenName && !this.formData.familyName) {
            this.fetchUserData();
        }

        console.log('this.formData', this.formData);
        const data = this.formData || {};

        return html`
            <h2 id="title">${i18n.t('render-form.forms.accessible-exams-form.title')}</h2>
            <p id="description">
                ${i18n.t('render-form.forms.accessible-exams-form.mandatory-fields')}
                <br />
                ${i18n.t('render-form.forms.accessible-exams-form.exam-date')}
            </p>
            <form id="accessible-exams-form" class="formalize-form">
                <fieldset>
                    <legend>${i18n.t('render-form.forms.accessible-exams-form.exam-data')}</legend>
                    <dbp-course-select-element
                        subscribe="lang,auth,entry-point-url"
                        name="courseName"
                        label="${i18n.t('render-form.forms.accessible-exams-form.course-name')}"
                        value=${data.courseName || ''}
                        required></dbp-course-select-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="differentTerm"
                        label=${i18n.t('render-form.forms.accessible-exams-form.different-term')}
                        value=${data.differentTerm || ''}
                        hidden></dbp-form-string-element>

                    <dbp-form-date-element
                        subscribe="lang"
                        name="date"
                        label=${i18n.t('render-form.forms.accessible-exams-form.date')}
                        .min=${new Date(Date.now() + 1209600000)}
                        .customValidator=${(value) => {
                            const date = new Date(value);
                            // The minimum date has to be two weeks ahead
                            const minDate = new Date(Date.now() + 1209600000);
                            minDate.setHours(0, 0, 0);
                            return date < minDate
                                ? [
                                      i18n.t(
                                          'render-form.forms.accessible-exams-form.date-validation-error',
                                      ),
                                  ]
                                : [];
                        }}
                        value=${data.date || ''}
                        required></dbp-form-date-element>

                    <dbp-form-time-element
                        ${ref(this.beginTimeRef)}
                        subscribe="lang"
                        name="beginTime"
                        label=${i18n.t('render-form.forms.accessible-exams-form.begin-time')}
                        value=${data.beginTime || ''}
                        required></dbp-form-time-element>

                    <dbp-form-time-element
                        subscribe="lang"
                        name="endTime"
                        label=${i18n.t('render-form.forms.accessible-exams-form.end-time')}
                        .customValidator=${(value) => {
                            return this.beginTimeRef.value.value > value
                                ? [
                                      i18n.t(
                                          'render-form.forms.accessible-exams-form.time-validation-error',
                                      ),
                                  ]
                                : [];
                        }}
                        value=${data.endTime || ''}
                        required></dbp-form-time-element>

                    <dbp-person-select-element
                        id="examiner-picker-element"
                        subscribe="lang"
                        name="examiner"
                        label=${i18n.t('render-form.forms.accessible-exams-form.examiner')}
                        value=${data.examiner || ''}
                        @change="${(e) => {
                            const hasValue = !!e.detail.value;
                            this.examinerTextDisabled = hasValue;
                            if (hasValue) {
                                this.examinerTextRef.value.value = '';
                            }
                        }}"
                        .customValidator=${(value, evaluationData) => {
                            // We can't use this.examinerCustomValidation directly, or this._i18n will not find the message key
                            return this.examinerCustomValidation(evaluationData);
                        }}></dbp-person-select-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        ${ref(this.examinerTextRef)}
                        name="examinerText"
                        label=${i18n.t('render-form.forms.accessible-exams-form.examiner-text')}
                        value=${data.examinerText || ''}
                        ?disabled=${this.examinerTextDisabled}
                        .customValidator=${(value, evaluationData) => {
                            // We can't use this.examinerCustomValidation directly, or this._i18n will not find the message key
                            return this.examinerCustomValidation(evaluationData);
                        }}></dbp-form-string-element>

                    <dbp-person-select-element
                        id="additional-examiner-picker-element"
                        subscribe="lang"
                        name="additionalExaminer"
                        label=${i18n.t(
                            'render-form.forms.accessible-exams-form.additional-examiner',
                        )}
                        value=${data.additionalExaminer || ''}></dbp-person-select-element>

                    <dbp-room-select-element
                        subscribe="lang"
                        name="room"
                        label="${i18n.t('render-form.forms.accessible-exams-form.room')}"
                        value=${data.room || ''}
                        hidden></dbp-room-select-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="comment"
                        label=${i18n.t('render-form.forms.accessible-exams-form.comment')}
                        value=${data.comment || ''}></dbp-form-string-element>

                    <dbp-form-boolean-element
                        subscribe="lang"
                        name="group"
                        label=${i18n.t('render-form.forms.accessible-exams-form.group')}
                        hidden
                        .state=${data.group || false}></dbp-form-boolean-element>

                    <dbp-form-boolean-element
                        subscribe="lang"
                        name="online"
                        label=${i18n.t('render-form.forms.accessible-exams-form.online')}
                        .state=${data.online || false}></dbp-form-boolean-element>
                </fieldset>

                <fieldset>
                    <legend>
                        ${i18n.t('render-form.forms.accessible-exams-form.personal-data')}
                    </legend>
                    <dbp-form-string-element
                        subscribe="lang"
                        name="matriculationNumber"
                        label=${i18n.t(
                            'render-form.forms.accessible-exams-form.matriculation-number',
                        )}
                        value=${data.matriculationNumber || ''}
                        disabled></dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="givenName"
                        label=${i18n.t('render-form.forms.accessible-exams-form.given-name')}
                        value=${data.givenName || ''}
                        disabled></dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="familyName"
                        label=${i18n.t('render-form.forms.accessible-exams-form.family-name')}
                        value=${data.familyName || ''}
                        disabled></dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="email_student"
                        label=${i18n.t('render-form.forms.accessible-exams-form.email')}
                        value=${data.email_student || ''}
                        disabled></dbp-form-string-element>
                </fieldset>

                ${this.getButtonRowHtml()}
            </form>
            ${this.renderResult(this.submitted)} ${this.renderErrorMessage(this.submissionError)}
        `;
    }

    examinerCustomValidation(evaluationData) {
        return evaluationData.examinerText === '' && evaluationData.examiner === ''
            ? [this._i18n.t('render-form.forms.accessible-exams-form.examiner-validation-error')]
            : [];
    }

    /**
     * Render the buttons needed for the form.
     * @returns {import('lit').TemplateResult} HTML for the button row.
     */
    getButtonRowHtml() {
        const i18n = this._i18n;
        return html`
            <div class="button-row">
                <button class="button is-secondary" type="button" @click=${this.resetForm} hidden>
                    ${i18n.t('render-form.button-row.reset')}
                </button>
                <button
                    class="button is-primary"
                    type="submit"
                    ?disabled=${!this.saveButtonEnabled}
                    @click=${(event) => this.validateAndSendSubmission(event)}>
                    ${i18n.t('render-form.button-row.submit')}
                    <dbp-mini-spinner
                        class="${classMap({hidden: this.saveButtonEnabled})}"></dbp-mini-spinner>
                </button>
            </div>
        `;
    }

    renderResult(submitted) {
        const i18n = this._i18n;

        if (submitted) {
            return html`
                <div class="container">
                    <h2>
                        ${i18n.t(
                            'render-form.forms.accessible-exams-form.submission-result-thanks',
                        )}
                    </h2>
                    <p>
                        ${i18n.t(
                            'render-form.forms.accessible-exams-form.submission-result-notification',
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
                    <h2>${i18n.t('render-form.forms.accessible-exams-form.submission-error')}</h2>
                    <p>
                        ${i18n.t(
                            'render-form.forms.accessible-exams-form.submission-error-notification',
                        )}
                    </p>
                </div>
            `;
        }

        return html``;
    }
}
