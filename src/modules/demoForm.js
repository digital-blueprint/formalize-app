import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html} from 'lit';
import {DbpStringElement, DbpDateElement, DbpDateTimeElement, DbpEnumElement, DbpCheckboxElement} from '@dbp-toolkit/form-elements';

// You need to import gatherFormDataFromElement from the form-elements package if you override the sendSubmission method
// import {gatherFormDataFromElement} from '@dbp-toolkit/form-elements/src/utils.js';

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
        this.enumItems = {item1: 'Item 1', item2: 'Item 2'};
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Add the event listener if you don't want to override the sendSubmission method
            this.addEventListener('DbpFormalizeFormSubmission', (event) => {
                // Access the data from the event detail
                const data = event.detail;

                // Handle the event
                console.log('Form submission data:', data);

                // Add your event handling logic here
            });
        });
    }

    testRoutingUrl() {
        const routingUrl = '/test';
        this.sendSetPropertyEvent('routing-url', routingUrl, true);
    }

    setRandomData() {
        // Sample data pools
        const words = ['Premium', 'Deluxe', 'Advanced', 'Smart', 'Pro', 'Elite', 'Ultra',
            'Essential', 'Classic', 'Modern', 'Digital', 'Custom'];

        const types = ['Laptop', 'Phone', 'Tablet', 'Camera', 'Monitor', 'Keyboard',
            'Mouse', 'Headphones', 'Speaker', 'Router'];

        const enumValues = ['item1', 'item2'];

        // Helper function to get random array element
        const randomFrom = arr => arr[Math.floor(Math.random() * arr.length)];

        // Generate random date within last year
        const randomDate = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
        const dateStr = randomDate.toISOString().split('T')[0];
        const dateTimeStr = randomDate.toISOString();

        this.formData = {
            myString: `${randomFrom(words)} ${randomFrom(types)}`,
            myLongString: `The ${randomFrom(words)} ${randomFrom(types)} features ${Math.floor(Math.random() * 6) + 2}\ndifferent ${randomFrom(words)} capabilities for enhanced\nperformance and reliability.`,
            mySpecialString: `SKU-${String(Math.floor(Math.random() * 9000) + 1000)}-${Math.random().toString(36).substring(2, 5)}`,
            myDate: dateStr,
            myDateTime: dateTimeStr,
            myEnum: randomFrom(enumValues),
            myCheckbox: Math.random() < 0.5
        };
    }

    static get scopedElements() {
        return {
            'dbp-form-string-element': DbpStringElement,
            'dbp-form-date-element': DbpDateElement,
            'dbp-form-datetime-element': DbpDateTimeElement,
            'dbp-form-enum-element': DbpEnumElement,
            'dbp-form-checkbox-element': DbpCheckboxElement,
        };
    }

    // You can override the sendSubmission method if you want to handle the form data differently
    // Or you can add a custom event listener for "DbpFormalizeFormSubmission" to handle the form data (see connectedCallback)
    /*
    sendSubmission(event) {
        this.saveButtonEnabled = false;
        const formElement = this.shadowRoot.querySelector('form');
        this.formData = gatherFormDataFromElement(formElement);
        console.log('sendSubmission data', this.formData);
    }
    */

    render() {
        console.log('-- Render FormalizeFormElement --');
        console.log('this.formData', this.formData);
        const data = this.formData || {};
        // const data = Object.keys(this.formData).length === 0 ? { myString: 'hi' } : this.formData;
        // const data = {myString: 'hi'};
        console.log('render data', data);

        return html`
            <h1>Demo Form</h1>
            <input type="button" value="Test routing-url" @click=${this.testRoutingUrl} />
            <input type="button" value="Set random data" @click=${this.setRandomData} />
            <form>
                <dbp-form-string-element
                    subscribe="lang"
                    name="myString"
                    label="My string"
                    .value=${data.myString || ''}
                    required>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="myLongString"
                    label="My long string"
                    .value=${data.myLongString || ''}
                    rows="5"
                    required>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="mySpecialString"
                    description="Shows the evaluation data in the error message if empty"
                    label="My special string"
                    .customValidator=${(value, evaluationData) => {
                        // If the value is empty, return an error message with the evaluation data
                        return value === '' ? ['evaluationData: ' + JSON.stringify(evaluationData)] : [];
                    }}
                    .value=${data.mySpecialString || ''}
                    required>
                </dbp-form-string-element>

                <dbp-form-date-element
                    subscribe="lang"
                    name="myDate"
                    label="My date"
                    .value=${data.myDate || ''}
                    required>
                </dbp-form-date-element>

                <dbp-form-datetime-element
                    subscribe="lang"
                    name="myDateTime"
                    description="Needs to be in the future"
                    label="My datetime"
                    .customValidator=${(value) => {
                        const date = new Date(value);
                        return date < new Date() ? ['The date needs to be in the future'] : [];
                    }}
                    .value=${data.myDateTime || ''}
                    required>
                </dbp-form-datetime-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="myEnum"
                    label="My enum"
                    .items=${this.enumItems}
                    .value=${data.myEnum || ''}
                    required>
                </dbp-form-enum-element>

                <dbp-form-checkbox-element
                    subscribe="lang"
                    name="myCheckbox"
                    label="My checkbox"
                    description="Check me"
                    value="check"
                    ?checked=${data.myCheckbox || false}>
                </dbp-form-checkbox-element>

                ${this.getButtonRowHtml()}
            </form>
            ${this.renderResult(this.formData)}
        `;
    }

    renderResult(data) {
        if (data && Object.keys(data).length > 0) {
            // Show the form data object
            return html`
                <div class="container">
                    <h2>Form data</h2>
                    <pre>${JSON.stringify(data, null, 2)}</pre>
                </div>
            `;
        }

        return html``;
    }
}
