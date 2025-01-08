import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html} from 'lit';
import * as formElements from '../form/form-elements.js';

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
        return 'e78869ce-e9b3-4df2-854b-cf88a35285f5';
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
                ${formElements.stringElement('myLongString', 'My long string', data.myLongString || '', true, {
                    rows: 5,
                    errorMessagesRenderFunction: () => this.renderFormElementErrorMessages('Error message')
                })}
                ${formElements.dateTimeElement('myDateTime', 'My datetime', data.myDateTime || '', true)}
                ${formElements.dateElement('myDate', 'My date', data.myDate || '', true)}
                ${formElements.enumElement('myEnum', 'My enum', data.myEnum || {}, {item1: 'Item 1', item2: 'Item 2'}, true)}
                ${formElements.checkboxElement('myCheckbox', 'My checkbox', data.myCheckbox || false)}
                ${this.getButtonRowHtml()}
            </form>
        `;
    }
}
