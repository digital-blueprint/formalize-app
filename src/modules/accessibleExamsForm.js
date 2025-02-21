import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html} from 'lit';
import {DbpStringElement, DbpDateTimeElement, DbpCheckboxElement} from '@dbp-toolkit/form-elements';
import {DbpPersonSelectElement} from '../form/elements/personselect.js';
import {PersonSelect} from '@dbp-toolkit/person-select';
import {CourseSelect} from './course-select.js';
import {RoomSelect} from './room-select.js';
import { DbpCourseSelectElement } from '../form/elements/courseselect.js';
import { DbpRoomSelectElement } from '../form/elements/roomselect.js';

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
        this.submitted = false;
    }

    static get properties() {
        return {
            ...super.properties,
            submitted: {type: Boolean},
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Override buildUrlData method of person select to include email address of examiner
            this._('#examiner-picker-element')._('#examiner-picker').buildUrlData = function(select, params) {
                return {
                    search: params.term.trim(),
                    includeLocal: 'email'
                };
            };

            // Event listener for form submission
            this.addEventListener('DbpFormalizeFormSubmission', async (event) => {
                // Access the data from the event detail
                const data = event.detail;
                // Include unique identifier for person who is submitting
                data.formData.identifier = this.formData.identifier;
                this.createUUID();
                data.formData.uuid = this.formData.uuid;
                this.createExamID();
                data.formData.examid = this.formData.examid;

                // Extract name and email from examiner data
                let examinerdata = this.getExaminerMail(data.formData.examiner);
                data.formData.examiner = examinerdata[0];
                data.formData.examinerMail = examinerdata[1];

                // Handle the event
                console.log('Form submission data:', data);

                try {
                    this.isPostingSubmission = true;

                    if (this.wasSubmissionSuccessful) {
                        return;
                    }

                    let body = {
                        form: '/formalize/forms/' + '0193cfbd-9b68-703a-81f9-c10d0e2375b7',
                        dataFeedElement: JSON.stringify(data.formData),
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
                        // this.handleErrorResponse(response);
                        throw new Error(`Response status: ${response.status}`);
                    } else {
                        this.wasSubmissionSuccessful = true;
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
            'dbp-form-datetime-element': DbpDateTimeElement,
            'dbp-form-checkbox-element': DbpCheckboxElement,
            'dbp-course-select-element': DbpCourseSelectElement,
            'dbp-room-select-element': DbpRoomSelectElement,
            'dbp-course-select': CourseSelect,
            'dbp-room-select': RoomSelect,
            'dbp-person-select-element': DbpPersonSelectElement,
            'dbp-person-select': PersonSelect
        };
    }

    async fetchUserData() {
        console.log("Fetching user data ...");

        // TODO: Error Handling

        let response = await fetch(this.entryPointUrl + '/base/people/' + this.auth['user-id'] + '?includeLocal=email,matriculationNumber', {
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
        });
        if (!response.ok) {
            throw new Error(response);
        }

        this.formData = await response.json();
        this.formData.identifier = `${this.formData['identifier']}`;
        this.formData.givenName = `${this.formData['givenName']}`;
        this.formData.familyName = `${this.formData['familyName']}`;
        this.formData.matriculationNumber = `${this.formData['localData']['matriculationNumber']}`;
        this.formData.email = `${this.formData['localData']['email']}`;
    }

    createUUID() {
        let uuid = self.crypto.randomUUID();
        console.log("Created UUID: " + uuid);
        this.formData.uuid = uuid;
    }

    createExamID() {
        // create a random five-digit ID
        let min = 10000;
        let max = 99999;
        let examid = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log("Created ExamID: " + examid);
        this.formData.examid = examid;
    }

    getExaminerMail(examinerdata) {
        const nameAndMail = examinerdata.split(" ");
        const name = nameAndMail.slice(0, -1).join(" ");
        const mail = nameAndMail[nameAndMail.length - 1];
        return [name, mail];
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
            <h2>${i18n.t('render-form.forms.accessible-exams-form.title')}</h2>
            <p>${i18n.t('render-form.forms.accessible-exams-form.mandatory-fields')}<br />
            ${i18n.t('render-form.forms.accessible-exams-form.exam-date')}</p>
            <form>
                <fieldset>
                <legend>${i18n.t('render-form.forms.accessible-exams-form.exam-data')}</legend>
                <dbp-course-select-element
                    subscribe="lang"
                    name="courseName"
                    label="${i18n.t('render-form.forms.accessible-exams-form.course-name')}"
                    value=${data.courseName || ''}
                    required
                    >
                </dbp-course-select-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="differentTerm"
                    label=${i18n.t('render-form.forms.accessible-exams-form.different-term')}
                    value=${data.differentTerm || ''}
                    hidden
                    >
                </dbp-form-string-element>

                <dbp-form-date-element
                    subscribe="lang"
                    name="date"
                    label=${i18n.t('render-form.forms.accessible-exams-form.date')}
                    .customValidator=${(value) => {
                        const date = new Date(value);
                        // The minimum date has to be two weeks ahead
                        const minDate = new Date(Date.now() + 1209600000);
                        minDate.setHours(0, 0, 0);
                        return (date < minDate) ? [i18n.t('render-form.forms.accessible-exams-form.start-date-time-validation-error')] : [];
                    }}
                    value=${data.date || ''}
                    required
                    >
                </dbp-form-date-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="beginTime"
                    label=${i18n.t('render-form.forms.accessible-exams-form.begin-time')}
                    value=${data.beginTime || ''}
                    required
                    >
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="endTime"
                    label=${i18n.t('render-form.forms.accessible-exams-form.end-time')}
                    value=${data.endTime || ''}
                    required
                    >
                </dbp-form-string-element>

                <dbp-person-select-element
                    id="examiner-picker-element"
                    subscribe="lang"
                    name="examiner"
                    label=${i18n.t('render-form.forms.accessible-exams-form.examiner')}
                    value=$${data.examiner || ''}
                    required
                    >
                </dbp-person-select-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="additionalExaminer"
                    label=${i18n.t('render-form.forms.accessible-exams-form.additional-examiner')}
                    value=${data.additionalExaminer || ''}
                    >
                </dbp-form-string-element>

                <dbp-room-select-element
                    subscribe="lang"
                    name="room"
                    label="${i18n.t('render-form.forms.accessible-exams-form.room')}"
                    value=${data.room || ''}
                    hidden
                    >
                </dbp-room-select-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="comment"
                    label=${i18n.t('render-form.forms.accessible-exams-form.comment')}
                    value=${data.comment || ''}
                    >
                </dbp-form-string-element>

                <dbp-form-checkbox-element
                    subscribe="lang"
                    name="group"
                    label=${i18n.t('render-form.forms.accessible-exams-form.group')}
                    hidden
                    value="check"
                    ?checked=${data.group || ''}>
                </dbp-form-checkbox-element>

                <dbp-form-checkbox-element
                    subscribe="lang"
                    name="online"
                    label=${i18n.t('render-form.forms.accessible-exams-form.online')}
                    value="check"
                    ?checked=${data.online || ''}>
                </dbp-form-checkbox-element>
                </fieldset>

                <fieldset>
                <legend>${i18n.t('render-form.forms.accessible-exams-form.personal-data')}</legend>
                <dbp-form-string-element
                    subscribe="lang"
                    name="matriculationNumber"
                    label=${i18n.t('render-form.forms.accessible-exams-form.matriculation-number')}
                    value=${data.matriculationNumber || ''}
                    disabled
                    >
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="givenName"
                    label=${i18n.t('render-form.forms.accessible-exams-form.given-name')}
                    value=${data.givenName || ''}
                    disabled
                    >
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="familyName"
                    label=${i18n.t('render-form.forms.accessible-exams-form.family-name')}
                    value=${data.familyName || ''}
                    disabled
                    >
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="email"
                    label=${i18n.t('render-form.forms.accessible-exams-form.email')}
                    value=${data.email || ''}
                    disabled
                    >
                </dbp-form-string-element>
                </fieldset>

                ${this.getButtonRowHtml()}
            </form>
            ${this.renderResult(this.submitted)}
        `;
    }

    renderResult(submitted) {
        const i18n = this._i18n;

        if (submitted) {
            return html`
                <div class="container">
                    <h2>${i18n.t('render-form.forms.accessible-exams-form.submission-result-thanks')}</h2>
                    <p>${i18n.t('render-form.forms.accessible-exams-form.submission-result-notification')}</p>
                </div>
            `;
        }

        return html``;
    }
}
