import {css, html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {DbpBaseElement} from '@dbp-toolkit/form-elements/src/base-element.js';
import {ResourceSelect} from '@dbp-toolkit/resource-select';
import {createInstance} from '../../i18n.js';

export class RoomSelect extends ResourceSelect {
    constructor() {
        super();
        this._roomI18n = createInstance();
        this.resourcePath = '/base/rooms';
        this.fetchMode = 'search';
        this.placeholder = this._getRoomPlaceholder();
    }

    update(changedProperties) {
        if (changedProperties.has('lang')) {
            this._roomI18n.changeLanguage(this.lang);
            this.placeholder = this._getRoomPlaceholder();
        }

        super.update(changedProperties);
    }

    _getRoomPlaceholder() {
        return this._roomI18n.t('render-form.room-select.placeholder');
    }

    getSearchQueryParameters(select, searchTerm) {
        return {
            search: searchTerm.trim(),
        };
    }

    formatResource(select, room) {
        return room.code ?? '';
    }
}

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
        const roomDataObject = e.detail.object;

        // Specify the value to be included in the form submission
        if (roomDataObject != null) {
            this.value = roomDataObject.code;
        } else {
            this.value = '';
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
