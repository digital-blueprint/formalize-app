import {BaseFormElement, BaseObject} from '../baseObject.js';
import {html} from 'lit';
import * as formElements from './formElements.js';

export default class extends BaseObject {
    getName() {
        return 'accessible-exams-form';
    }

    /**
     * @returns {string}
     */
    getFormComponent() {
        return FormalizeFormElement;
    }
}

class FormalizeFormElement extends BaseFormElement {
    render() {
        console.log('-- Render FormalizeFormElement --');
        console.log('this.data', this.data);
        const data = this.data || {};

        return html`
            <form>
                ${formElements.stringElement('subject', 'Subject', data.subject || '')}    
                ${formElements.dateTimeElement('startDateTime', 'Start of Exam', data.startDateTime || '', true)}
                ${formElements.dateTimeElement('endDateTime', 'End of Exam', data.endDateTime || '', true)}
                ${formElements.stringElement('matriculationNumber', 'Matriculation number', data.matriculationNumber || '')}
                ${formElements.stringElement('email', 'Email address', data.email || '')}
                ${formElements.stringElement('room', 'Original room', data.room || '')}
                ${formElements.stringElement('comment', 'Comment', data.comment || '')}
                ${this.getCommonFormElements()}
            </form>
        `;
    }
}
