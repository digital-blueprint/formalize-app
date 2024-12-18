import {BaseFormElement, BaseObject} from '../baseObject.js';
import {html} from 'lit';
import * as formElements from './formElements.js';

export default class extends BaseObject {
    getUrlSlug() {
        return 'demo';
    }

    /**
     * @returns {string}
     */
    getFormComponent() {
        return FormalizeFormElement;
    }

    getFormIdentifier() {
        return '14a79e34-616f-424b-8dd1-ede3e73b43ba';
    }
}

class FormalizeFormElement extends BaseFormElement {
    testRoutingUrl() {
        const routingUrl = '/test';
        this.sendSetPropertyEvent('routing-url', routingUrl, true);
    }

    render() {
        console.log('-- Render FormalizeFormElement --');
        console.log('this.data', this.data);
        const data = this.data || {};

        return html`
            <h1>Demo Form</h1>
            <input type="button" value="TestRoutingUrl" @click=${this.testRoutingUrl} />
            <form>
                ${formElements.stringElement('myString', 'My string', data.myString || '', true)}
                ${formElements.dateTimeElement('myDateTime', 'My datetime', data.myDateTime || '', true)}
                ${formElements.dateElement('myDate', 'My date', data.myDate || '', true)}
                ${formElements.enumElement('myEnum', 'My enum', data.myEnum || {}, {item1: 'Item 1', item2: 'Item 2'}, true)}
                ${formElements.checkboxElement('myCheckbox', 'My checkbox', data.myCheckbox || false)}
                ${this.getButtonRowHtml()}
            </form>
        `;
    }
}
