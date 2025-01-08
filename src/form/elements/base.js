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
            value: {type: String},
            required: {type: Boolean},
        };
    }

    static get styles() {
        // language=css
        return css`
            ${getFieldsetCSS()}
        `;
    }
}
