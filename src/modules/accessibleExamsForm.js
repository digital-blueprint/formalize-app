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
    connectedCallback() {
        const i18n = this._i18n;
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

    render() {
        const i18n = this._i18n;
        console.log('-- Render FormalizeFormElement --');

        if (!this.formData.givenName && !this.formData.familyName) {
            this.fetchUserData();
        }

        console.log('this.formData', this.formData);
        const data = this.formData || {};

        return html`
            <h1>${i18n.t('render-form.forms.accessible-exams-form.title')}</h1>
            <p>${i18n.t('render-form.forms.accessible-exams-form.mandatory-fields')}<br />
            ${i18n.t('render-form.forms.accessible-exams-form.exam-date')}</p>
            <form>
                <dbp-course-select-element
                    subscribe="lang"
                    name="courseName"
                    label="${i18n.t('render-form.forms.accessible-exams-form.courseName')}"
                    value=${data.courseName || ''}
                    required
                    >
                </dbp-course-select-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="differentTerm"
                    label=${i18n.t('render-form.forms.accessible-exams-form.different-term')}
                    value=${data.differentTerm || ''}
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
                    >
                </dbp-form-date-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="beginTime"
                    label=${i18n.t('render-form.forms.accessible-exams-form.begin-time')}
                    value=${data.beginTime || ''}
                    >
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="endTime"
                    label=${i18n.t('render-form.forms.accessible-exams-form.end-time')}
                    value=${data.endTime || ''}
                    >
                </dbp-form-string-element>

                <dbp-person-select-element
                    id="examiner-picker-element"
                    subscribe="lang"
                    name="examiner"
                    label=${i18n.t('render-form.forms.accessible-exams-form.examiner')}
                    value=$${data.examiner || ''}
                    >
                </dbp-person-select-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="additionalExaminer"
                    label=${i18n.t('render-form.forms.accessible-exams-form.additional-examiner')}
                    value=${data.additionalExaminer || ''}
                    >
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="matriculationNumber"
                    label=${i18n.t('render-form.forms.accessible-exams-form.matriculation-number')}
                    value=${data.matriculationNumber || ''}
                    >
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="givenName"
                    label=${i18n.t('render-form.forms.accessible-exams-form.given-name')}
                    value=${data.givenName || ''}
                    >
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="familyName"
                    label=${i18n.t('render-form.forms.accessible-exams-form.family-name')}
                    value=${data.familyName || ''}
                    >
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="email"
                    label=${i18n.t('render-form.forms.accessible-exams-form.email')}
                    value=${data.email || ''}
                    >
                </dbp-form-string-element>

                <!--
                <dbp-room-select-element
                    subscribe="lang"
                    name="room"
                    label="${i18n.t('render-form.forms.accessible-exams-form.room')}"
                    value=${data.room || ''}
                    >
                </dbp-room-select-element>
                -->

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

                ${this.getButtonRowHtml()}
            </form>
        `;
    }
}
