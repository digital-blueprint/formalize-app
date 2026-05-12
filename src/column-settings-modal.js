// @ts-nocheck
import {css, html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {ScopedElementsMixin, Icon, IconButton} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {createInstance} from './i18n.js';
import {MANAGE_FORMS_COMPONENT_STYLES} from './manage-forms-component-styles.js';

export class ColumnSettingsModal extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.state = '';
        this.columns = [];
        this.iconNameVisible = 'source_icons_eye-empty';
        this.iconNameHidden = 'source_icons_eye-off';
        this.resetButtonDisabled = true;
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-icon-button': IconButton,
            'dbp-modal': Modal,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            state: {type: String},
            columns: {type: Array, attribute: false},
            iconNameVisible: {type: String, attribute: false},
            iconNameHidden: {type: String, attribute: false},
            resetButtonDisabled: {type: Boolean, attribute: false},
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            if (propName === 'lang') {
                this._i18n.changeLanguage(this.lang);
            }
        });

        super.update(changedProperties);
    }

    static get styles() {
        return [
            MANAGE_FORMS_COMPONENT_STYLES,
            css`
                dbp-modal.column-settings-modal {
                    --dbp-modal-max-width: 600px;
                    --dbp-modal-min-width: 300px;
                    --dbp-modal-width: 70%;
                    --dbp-modal-min-height: auto;
                }

                @media only screen and (max-width: 768px) {
                    dbp-modal.column-settings-modal {
                        --dbp-modal-width: calc(100vw - 40px);
                        --dbp-modal-max-width: calc(100vw - 40px);
                        --dbp-modal-min-width: 0;
                    }
                }
            `,
        ];
    }

    getModalElement() {
        return this.renderRoot?.querySelector('dbp-modal') ?? null;
    }

    getContentElement() {
        return this.renderRoot?.querySelector(`#submission-modal-content-${this.state}`) ?? null;
    }

    open() {
        this.getModalElement()?.open();
        this.getContentElement()?.scrollTo(0, 0);
    }

    close() {
        this.getModalElement()?.close();
    }

    handleAction(action, payload = null) {
        this.dispatchEvent(
            new CustomEvent('column-settings-action', {
                detail: {action, state: this.state, payload},
                bubbles: true,
                composed: true,
            }),
        );
    }

    renderColumn(column, index) {
        const i18n = this._i18n;

        return html`
            <li class="header-field" data-index="${index}">
                <div class="header-order">${index + 1}</div>
                <div class="header-title">${column.title}</div>
                <dbp-icon-button
                    data-visibility="${column.visible}"
                    icon-name=${column.visible ? this.iconNameVisible : this.iconNameHidden}
                    @click="${() => {
                        this.handleAction('toggle-column-visibility', {column});
                    }}"
                    class="header-visibility-icon"></dbp-icon-button>
                <div class="button-wrapper">
                    <div class="header-move">
                        <dbp-icon-button
                            class="arrow-up ${classMap({'first-arrow-up': index === 0})}"
                            icon-name="arrow-up"
                            title="${i18n.t('manage-forms.move-column-up')}"
                            @click="${() => {
                                this.handleAction('move-column-up', {column});
                            }}"></dbp-icon-button>
                        <dbp-icon-button
                            class="header-button arrow-down ${classMap({
                                'last-arrow-down': index === this.columns.length - 1,
                            })}"
                            icon-name="arrow-down"
                            title="${i18n.t('manage-forms.move-column-down')}"
                            @click="${() => {
                                this.handleAction('move-column-down', {column});
                            }}"></dbp-icon-button>
                    </div>
                </div>
            </li>
        `;
    }

    render() {
        const i18n = this._i18n;

        return html`
            <dbp-modal
                class="column-settings-modal"
                modal-id="column-options-modal-${this.state}"
                title="${i18n.t('manage-forms.header-settings')}"
                sticky-footer
                subscribe="lang">
                <div slot="header" class="modal-header-tag">
                    <p><span class="tag tag--state">${this.state}</span></p>
                </div>
                <div
                    slot="content"
                    class="modal-content submission-modal-content"
                    id="submission-modal-content-${this.state}">
                    <ul class="headers">
                        ${this.columns.map((column, index) => this.renderColumn(column, index))}
                    </ul>
                </div>
                <div slot="footer" class="modal-footer-btn">
                    <div class="top-button-row">
                        <button
                            type="button"
                            title="${i18n.t('manage-forms.reset-filter')}"
                            class="check-btn button button--reset is-secondary item-1"
                            .disabled="${this.resetButtonDisabled}"
                            @click="${() => {
                                this.handleAction('reset-columns');
                            }}">
                            <dbp-icon aria-hidden="true" name="spinner-arrow-mirrored"></dbp-icon>
                            ${i18n.t('manage-forms.reset-filter')}
                        </button>
                        <button
                            type="button"
                            title="${i18n.t('manage-forms.all-filters-hide')}"
                            class="check-btn button button--hide-all is-secondary item-2"
                            @click="${() => {
                                this.handleAction('hide-all-columns');
                            }}">
                            <dbp-icon aria-hidden="true" name="source_icons_eye-off"></dbp-icon>
                            ${i18n.t('manage-forms.all-filters-hide')}
                        </button>
                        <button
                            type="button"
                            title="${i18n.t('manage-forms.all-filters-show')}"
                            class="check-btn button button--show-all is-secondary item-3"
                            @click="${() => {
                                this.handleAction('show-all-columns');
                            }}">
                            <dbp-icon aria-hidden="true" name="source_icons_eye-empty"></dbp-icon>
                            ${i18n.t('manage-forms.all-filters-show')}
                        </button>
                    </div>
                    <div class="bottom-button-row">
                        <button
                            type="button"
                            title="${i18n.t('manage-forms.abort')}"
                            class="check-btn button is-secondary"
                            @click="${() => {
                                this.close();
                            }}">
                            <dbp-icon aria-hidden="true" name="close"></dbp-icon>
                            ${i18n.t('manage-forms.abort')}
                        </button>
                        <button
                            type="button"
                            class="check-btn button button--save is-primary"
                            id="check"
                            @click="${() => {
                                this.handleAction('save-columns');
                                this.close();
                            }}">
                            <dbp-icon aria-hidden="true" name="save"></dbp-icon>
                            ${i18n.t('manage-forms.save-columns')}
                        </button>
                    </div>
                </div>
            </dbp-modal>
        `;
    }
}
