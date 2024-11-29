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
        const i18n = this._i18n;
        console.log('-- Render FormalizeFormElement --');
        console.log('this.data', this.data);
        const data = this.data || {};

        return html`
            <form>
                ${formElements.stringElement('subject', i18n.t('accessible-exams-form.subject'), data.subject || '')}    
                ${formElements.dateTimeElement('startDateTime', i18n.t('accessible-exams-form.startDateTime'), data.startDateTime || '', true)}
                ${formElements.dateTimeElement('endDateTime', i18n.t('accessible-exams-form.endDateTime'), data.endDateTime || '', true)}
                ${formElements.stringElement('matriculationNumber', i18n.t('accessible-exams-form.matriculationNumber'), data.matriculationNumber || '')}
                ${formElements.stringElement('email', i18n.t('accessible-exams-form.email'), data.email || '')}
                ${formElements.stringElement('room', i18n.t('accessible-exams-form.room'), data.room || '')}
                ${formElements.stringElement('comment', i18n.t('accessible-exams-form.comment'), data.comment || '')}
                ${this.getCommonFormElements()}
            </form>
        `;
    }
}
