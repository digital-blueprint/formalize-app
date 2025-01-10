import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html} from 'lit';
import * as formElements from '../form/form-elements.js';
import {DbpStringElement} from '../form/elements/string.js';
import {createRef, ref} from 'lit/directives/ref.js';
import {DbpDateElement} from '../form/elements/date.js';
import {DbpDateTimeElement} from '../form/elements/datetime.js';
import {DbpEnumElement} from '../form/elements/enum.js';

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
        this.myComponentDateTimeRef = createRef();
        this.myComponentEnumRef = createRef();
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Add a custom validation function to the special string component
            this.mySpecialComponentStringRef.value.customValidationFnc = (value, evaluationData) => {
                // If the value is empty, return an error message with the evaluation data
                return value === '' ? ['evaluationData: ' + JSON.stringify(evaluationData)] : [];
            };

            // Add a custom validation function to the datetime component
            this.myComponentDateTimeRef.value.customValidationFnc = (value) => {
                const date = new Date(value);
                return date < new Date() ? ['The date needs to be in the future'] : [];
            };

            // Set items for the enum component
            this.myComponentEnumRef.value.setItems({item1: 'Item 1', item2: 'Item 2'});
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
            'dbp-datetime-element': DbpDateTimeElement,
            'dbp-enum-element': DbpEnumElement,
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
                <dbp-string-element
                    subscribe="lang"
                    name="myComponentString"
                    label="My string"
                    value=${data.myComponentString || ''}
                    required>
                </dbp-string-element>

                <dbp-string-element
                    subscribe="lang"
                    name="myComponentLongString"
                    label="My long string"
                    value=${data.myComponentLongString || ''}
                    rows="5"
                    required>
                </dbp-string-element>

                <dbp-string-element
                    ${ref(this.mySpecialComponentStringRef)}
                    subscribe="lang"
                    name="mySpecialComponentString"
                    description="Shows the evaluation data in the error message if empty"
                    label="My special string"
                    value=${data.mySpecialComponentString || ''}
                    required>
                </dbp-string-element>

                <dbp-date-element
                    subscribe="lang"
                    name="myComponentDate"
                    label="My date"
                    value=${data.myComponentDate || ''}
                    required>
                </dbp-date-element>

                <dbp-datetime-element
                    ${ref(this.myComponentDateTimeRef)}
                    subscribe="lang"
                    name="myComponentDateTime"
                    description="Needs to be in the future"
                    label="My datetime"
                    value=${data.myComponentDateTime || ''}
                    required>
                </dbp-datetime-element>

                <dbp-enum-element
                    ${ref(this.myComponentEnumRef)}
                    subscribe="lang"
                    name="myComponentEnum"
                    label="My enum"
                    value=${data.myComponentEnum || ''}
                    required>
                </dbp-enum-element>

                ${formElements.checkboxElement('myCheckbox', 'My checkbox', data.myCheckbox || false)}
                ${this.getButtonRowHtml()}
            </form>
        `;
    }
}
