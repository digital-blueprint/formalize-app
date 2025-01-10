import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html} from 'lit';
import * as formElements from '../form/form-elements.js';
import {DbpStringElement} from '../form/elements/string.js';
import {createRef, ref} from 'lit/directives/ref.js';

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
                <dbp-string-element subscribe="lang" name="myComponentString" label="My string component" value=${data.myComponentString || ''} required></dbp-string-element>
                <dbp-string-element subscribe="lang" name="myComponentLongString" label="My long string component" value=${data.myComponentLongString || ''} rows="5" required></dbp-string-element>
                <dbp-string-element ${ref(this.mySpecialComponentStringRef)} subscribe="lang" name="mySpecialComponentString" label="My special string component" value=${data.mySpecialComponentString || ''} required></dbp-string-element>
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
