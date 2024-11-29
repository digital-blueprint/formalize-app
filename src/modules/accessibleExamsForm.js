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
                ${formElements.dateElement('dateCreated', 'Date created 1', data.dateCreated1 || '', true)}
                ${formElements.dateElement('dateCreated', 'Date created 2', data.dateCreated2 || '', true)}
                ${this.getCommonFormElements()}
            </form>
        `;
    }
}
