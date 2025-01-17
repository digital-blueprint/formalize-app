import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html} from 'lit';
import {createRef, ref} from 'lit/directives/ref.js';
import {DbpStringElement} from '../form/elements/string.js';
import {DbpDateTimeElement} from '../form/elements/datetime.js';
import {DbpCheckboxElement} from '../form/elements/checkbox.js';
import {CourseSelect} from '../modules/course-select.js';
import {RoomSelect} from '../modules/room-select.js';
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
        this.startDateTimeRef = createRef();
        this.endDateTimeRef = createRef();
    }

    connectedCallback() {
        const i18n = this._i18n;
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Custom validation function for the start datetime of the exam
            this.startDateTimeRef.value.customValidationFnc = (value) => {
                const date = new Date(value);
                // The minimum date has to be two weeks ahead
                const minDate = new Date(Date.now() + 1209600000);
                minDate.setHours(0, 0, 0);
                return (date < minDate) ? [i18n.t('render-form.forms.accessible-exams-form.start-date-time-validation-error')] : [];
            };

            // Custom validation function for the end datetime of the exam
            this.endDateTimeRef.value.customValidationFnc = (value) => {
                const endDate = new Date(value);
                const startDate = new Date(this.startDateTimeRef.value.value);
                return (endDate < startDate) ? [i18n.t('render-form.forms.accessible-exams-form.end-date-time-validation-error')] : [];
            };
        });
    }

    static get scopedElements() {
        return {
            'dbp-string-element': DbpStringElement,
            'dbp-datetime-element': DbpDateTimeElement,
            'dbp-checkbox-element': DbpCheckboxElement,
            'dbp-course-select-element': DbpCourseSelectElement,
            'dbp-room-select-element': DbpRoomSelectElement,
            'dbp-course-select': CourseSelect,
            'dbp-room-select': RoomSelect
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

        this.data = await response.json();
        this.data.givenName = `${this.data['givenName']}`;
        this.data.familyName = `${this.data['familyName']}`;
        this.data.matriculationNumber = `${this.data['localData']['matriculationNumber']}`;
        this.data.email = `${this.data['localData']['email']}`;
    }

    render() {
        const i18n = this._i18n;
        console.log('-- Render FormalizeFormElement --');

        if (!this.data.givenName && !this.data.familyName) {
            this.fetchUserData();
        }

        console.log('this.data', this.data);
        const data = this.data || {};

        return html`
            <h1>${i18n.t('render-form.forms.accessible-exams-form.title')}</h1>
            <p>${i18n.t('render-form.forms.accessible-exams-form.mandatory-fields')}<br />
            ${i18n.t('render-form.forms.accessible-exams-form.exam-date')}</p>
            <form>
                <dbp-course-select-element
                    subscribe="lang"
                    name="subject"
                    label="${i18n.t('render-form.forms.accessible-exams-form.subject') + " *"}"
                    value=${data.subject || ''}
                    required
                    >
                </dbp-course-select-element>

                <dbp-datetime-element
                    ${ref(this.startDateTimeRef)}
                    subscribe="lang"
                    name="startDateTime"
                    label=${i18n.t('render-form.forms.accessible-exams-form.start-date-time')}
                    value=${data.startDateTime || ''}
                    >
                </dbp-datetime-element>

                <dbp-datetime-element
                    ${ref(this.endDateTimeRef)}
                    subscribe="lang"
                    name="endDateTime"
                    label=${i18n.t('render-form.forms.accessible-exams-form.end-date-time')}
                    value=${data.endDateTime || ''}
                    >
                </dbp-datetime-element>

                <dbp-string-element
                    subscribe="lang"
                    name="matriculationNumber"
                    label=${i18n.t('render-form.forms.accessible-exams-form.matriculation-number')}
                    value=${data.matriculationNumber || ''}
                    >
                </dbp-string-element>

                <dbp-string-element
                    subscribe="lang"
                    name="givenName"
                    label=${i18n.t('render-form.forms.accessible-exams-form.given-name')}
                    value=${data.givenName || ''}
                    >
                </dbp-string-element>

                <dbp-string-element
                    subscribe="lang"
                    name="familyName"
                    label=${i18n.t('render-form.forms.accessible-exams-form.family-name')}
                    value=${data.familyName || ''}
                    >
                </dbp-string-element>

                <dbp-string-element
                    subscribe="lang"
                    name="email"
                    label=${i18n.t('render-form.forms.accessible-exams-form.email')}
                    value=${data.email || ''}
                    >
                </dbp-string-element>

                <dbp-room-select-element
                    subscribe="lang"
                    name="room"
                    label="${i18n.t('render-form.forms.accessible-exams-form.room') + " *"}"
                    value=${data.room || ''}
                    >
                </dbp-room-select-element>

                <dbp-string-element
                    subscribe="lang"
                    name="lecturer"
                    label=${i18n.t('render-form.forms.accessible-exams-form.lecturer')}
                    value=${data.lecturer || ''}
                    >
                </dbp-string-element>

                <dbp-string-element
                    subscribe="lang"
                    name="comment"
                    label=${i18n.t('render-form.forms.accessible-exams-form.comment')}
                    value=${data.comment || ''}
                    >
                </dbp-string-element>

                <dbp-checkbox-element
                    subscribe="lang"
                    name="group"
                    label=${i18n.t('render-form.forms.accessible-exams-form.group')}
                    value="check"
                    ?checked=${data.group || false}>
                </dbp-checkbox-element>

                <dbp-checkbox-element
                    subscribe="lang"
                    name="online"
                    label=${i18n.t('render-form.forms.accessible-exams-form.online')}
                    value="check"
                    ?checked=${data.online || false}>
                </dbp-checkbox-element>

                ${this.getButtonRowHtml()}
            </form>
        `;
    }
}
