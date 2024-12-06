import {BaseFormElement, BaseObject} from '../baseObject.js';
import {html} from 'lit';
import * as formElements from './formElements.js';

export default class extends BaseObject {
    getName() {
        return 'demo-form';
    }

    /**
     * @returns {string}
     */
    getFormComponent() {
        return FormalizeFormElement;
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
            <input type="button" value="TestRoutingUrl" @click=${this.testRoutingUrl} />
            <form>
                ${formElements.dateElement('dateCreated', 'Date created', data.dateCreated || '', true)}
                ${this.getButtonRowHtml()}
            </form>
        `;
    }
}
