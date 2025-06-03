import {css, html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {DbpBaseElement} from '@dbp-toolkit/form-elements/src/base-element.js';
import {PersonSelect} from '@dbp-toolkit/person-select';

export class DbpPersonSelectElement extends ScopedElementsMixin(DbpBaseElement) {
    constructor() {
        super();
    }

    static get properties() {
        return {
            ...super.properties,
        };
    }

    static get scopedElements() {
        return {
            'dbp-person-select': PersonSelect,
        };
    }

    handleInputValue(e) {
        let dataObjectText = e.target.getAttribute('data-object');
        let personDataObject = dataObjectText ? JSON.parse(dataObjectText) : null;
        // Specify the value to be included in the form submission
        if (personDataObject != null) {
            let name = `${personDataObject.givenName} ${personDataObject.familyName}`;
            let email = `${personDataObject.localData.email}`;
            this.value = name + ' ' + email;
        } else {
            this.value = '';
        }

        // fire a change event
        this.dispatchEvent(
            new CustomEvent('change', {
                detail: {
                    value: personDataObject,
                },
                bubbles: true,
            }),
        );
    }

    renderInput() {
        return html`
            <div class="control">
                <dbp-person-select
                    id="${this.name}-picker"
                    name="${this.name}Picker"
                    subscribe="lang, auth, entry-point-url"
                    @change="${this.handleInputValue}"></dbp-person-select>
            </div>
        `;
    }

    static get styles() {
        return [
            ...super.styles,
            // language=css
            css`
                /* For some reasons the selector chevron was very large */
                select:not(.select) {
                    background-size: 1em;
                }
            `,
        ];
    }
}

commonUtils.defineCustomElement('dbp-person-select-element', DbpPersonSelectElement);
