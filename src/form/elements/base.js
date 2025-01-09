import {css} from 'lit';
import DBPLitElement from '@dbp-toolkit/common/src/dbp-lit-element.js';
import {getFieldsetCSS} from '../utils.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';

export class DbpBaseElement extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this.name = '';
        this.label = '';
        this.value = '';
        this.required = false;
    }

    static get properties() {
        return {
            name: {type: String},
            label: {type: String},
            value: {type: String, reflect: true},
            required: {type: Boolean},
        };
    }

    evaluateCallback(data) {
        console.log('evaluateCallback data', data);

        // TODO: Do custom validation

        return !(this.required && !this.value);
    }

    connectedCallback() {
        super.connectedCallback();

        this.addEventListener('evaluate', (event) => {
            const detail = event.detail;
            const result = this.evaluateCallback(detail.data); // Perform your evaluation
            detail.respond(result); // Send the result back to the caller
        });
    }

    static get styles() {
        // language=css
        return css`
            ${getFieldsetCSS()}
        `;
    }
}
