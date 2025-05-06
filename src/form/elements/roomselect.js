import {css, html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {DbpBaseElement} from '@dbp-toolkit/form-elements/src/base-element.js';
import {RoomSelect} from '../../modules/room-select.js';

export class DbpRoomSelectElement extends ScopedElementsMixin(DbpBaseElement) {
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
            'dbp-room-select': RoomSelect,
        };
    }

    handleInputValue(e) {
        let roomDataObject = JSON.parse(e.target.getAttribute('data-object'));
        // Specify the value to be included in the form submission
        if (roomDataObject != null) {
            this.value = roomDataObject.code;
        }
    }

    renderInput() {
        return html`
            <div class="control">
                <dbp-room-select
                    id="${this.name}-picker"
                    name="${this.name}Picker"
                    subscribe="lang, auth, entry-point-url"
                    @change="${this.handleInputValue}"></dbp-room-select>
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

commonUtils.defineCustomElement('dbp-room-select-element', DbpRoomSelectElement);
