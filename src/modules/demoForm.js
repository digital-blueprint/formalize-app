import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html} from 'lit';
import * as formElements from '../form/form-elements.js';
import {DbpStringElement} from '../form/elements/string.js';
import {createRef, ref} from 'lit/directives/ref.js';
import {DbpDateElement} from '../form/elements/date.js';

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
    constructor() {
        super();
        this.mySpecialComponentStringRef = createRef();
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Add a custom validation function to the special string component
            this.mySpecialComponentStringRef.value.customValidationFnc = (value, evaluationData) => {
                if (value === '') {
                    return ['evaluationData: ' + JSON.stringify(evaluationData)];
                }

                return [];
            };
        });
    }

    testRoutingUrl() {
        const routingUrl = '/test';
        this.sendSetPropertyEvent('routing-url', routingUrl, true);
    }

    static get scopedElements() {
        return {
            'dbp-string-element': DbpStringElement,
            'dbp-date-element': DbpDateElement,
        };
    }

    render() {
        console.log('-- Render FormalizeFormElement --');
        console.log('this.data', this.data);
        const data = this.data || {};

        return html`
            <h1>Demo Form</h1>
            <input type="button" value="TestRoutingUrl" @click=${this.testRoutingUrl} />
            <form>
                <dbp-string-element subscribe="lang" name="myComponentString" label="My string" value=${data.myComponentString || ''} required></dbp-string-element>
                <dbp-string-element subscribe="lang" name="myComponentLongString" label="My long string" value=${data.myComponentLongString || ''} rows="5" required></dbp-string-element>
                <dbp-string-element ${ref(this.mySpecialComponentStringRef)} subscribe="lang" name="mySpecialComponentString" label="My special string" value=${data.mySpecialComponentString || ''} required></dbp-string-element>
                <dbp-date-element subscribe="lang" name="myComponentDate" label="My date" value=${data.myComponentDate || ''} required></dbp-date-element>
                ${formElements.dateTimeElement('myDateTime', 'My datetime', data.myDateTime || '', true)}
                ${formElements.enumElement('myEnum', 'My enum', data.myEnum || {}, {item1: 'Item 1', item2: 'Item 2'}, true)}
                ${formElements.checkboxElement('myCheckbox', 'My checkbox', data.myCheckbox || false)}
                ${this.getButtonRowHtml()}
            </form>
        `;
    }
}
