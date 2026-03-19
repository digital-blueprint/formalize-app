// @ts-nocheck
import {html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {ScopedElementsMixin, Button, Icon, IconButton} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {createInstance} from './i18n.js';
import MicroModal from './micromodal.es.js';
import {MANAGE_FORMS_COMPONENT_STYLES} from './manage-forms-component-styles.js';

export class ManageSubmissionModal extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.state = '';
        this.hiddenColumns = false;
        this.isPrevEnabled = false;
        this.isNextEnabled = false;
        this.currentBeautyId = 0;
        this.totalItems = 0;
        this.contentItems = [];
        this.boundHandleKeydown = this.handleKeydown.bind(this);
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-icon-button': IconButton,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            state: {type: String},
            hiddenColumns: {type: Boolean, attribute: false},
            isPrevEnabled: {type: Boolean, attribute: false},
            isNextEnabled: {type: Boolean, attribute: false},
            currentBeautyId: {type: Number, attribute: false},
            totalItems: {type: Number, attribute: false},
            contentItems: {type: Array, attribute: false},
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
        return MANAGE_FORMS_COMPONENT_STYLES;
    }

    getModalElement() {
        return this.renderRoot?.querySelector(`#detailed-submission-modal-${this.state}`) ?? null;
    }

    show() {
        const modal = this.getModalElement();
        if (!modal) {
            return;
        }

        MicroModal.show(modal, {
            disableScroll: true,
            onClose: () => {
                document.removeEventListener('keydown', this.boundHandleKeydown, true);
                this.dispatchEvent(
                    new CustomEvent('detail-modal-close', {
                        detail: {state: this.state},
                        bubbles: true,
                        composed: true,
                    }),
                );
            },
            onShow: () => {
                document.addEventListener('keydown', this.boundHandleKeydown, true);
            },
        });
    }

    close() {
        const modal = this.getModalElement();
        if (modal) {
            MicroModal.close(modal);
        }
    }

    handleKeydown(event) {
        if (event.keyCode === 37 && this.isPrevEnabled) {
            this.dispatchEvent(
                new CustomEvent('detail-modal-previous', {
                    detail: {state: this.state},
                    bubbles: true,
                    composed: true,
                }),
            );
        }

        if (event.keyCode === 39 && this.isNextEnabled) {
            this.dispatchEvent(
                new CustomEvent('detail-modal-next', {
                    detail: {state: this.state},
                    bubbles: true,
                    composed: true,
                }),
            );
        }
    }

    render() {
        const i18n = this._i18n;

        return html`
            <div
                class="modal micromodal-slide"
                id="detailed-submission-modal-${this.state}"
                data-state="${this.state}"
                aria-hidden="true">
                <div class="modal-overlay" tabindex="-2">
                    <div
                        class="modal-container detailed-submission-modal-box"
                        id="detailed-submission-modal-box-${this.state}"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="detailed-submission-modal-title-${this.state}">
                        <header class="modal-header">
                            <dbp-icon-button
                                title="${i18n.t('manage-forms.modal-close')}"
                                aria-label="${i18n.t('manage-forms.modal-close')}"
                                class="modal-close"
                                icon-name="close"
                                @click="${() => {
                                    this.close();
                                }}"></dbp-icon-button>
                            <h3
                                id="detailed-submission-modal-title-${this.state}"
                                class="detailed-submission-modal-title">
                                ${i18n.t('manage-forms.detailed-submission-dialog-title')}
                            </h3>
                        </header>
                        <main
                            class="modal-content detailed-submission-modal-content"
                            id="detailed-submission-modal-content-${this.state}">
                            <div class="content-wrapper">
                                ${this.contentItems.map(
                                    (item, index) => html`
                                        <div class="element-left ${classMap({first: index === 0})}">
                                            ${item.label}:
                                        </div>
                                        <div
                                            class="element-right ${classMap({first: index === 0})}">
                                            ${item.value}
                                        </div>
                                    `,
                                )}
                            </div>
                        </main>
                        <footer class="modal-footer">
                            <div class="modal-footer-btn">
                                <label
                                    class="button-container ${classMap({
                                        hidden: !this.hiddenColumns,
                                    })}">
                                    ${i18n.t('manage-forms.apply-col-settings')}
                                    <input
                                        type="checkbox"
                                        id="apply-col-settings-${this.state}"
                                        class="apply-col-settings"
                                        name="apply-col-settings"
                                        checked />
                                    <span class="checkmark"></span>
                                </label>
                                <div class="btn-row-left">
                                    <dbp-button
                                        class="back-btn"
                                        no-spinner-on-click
                                        title="${i18n.t('manage-forms.previous-entry-btn-title')}"
                                        @click="${() => {
                                            this.dispatchEvent(
                                                new CustomEvent('detail-modal-previous', {
                                                    detail: {state: this.state},
                                                    bubbles: true,
                                                    composed: true,
                                                }),
                                            );
                                        }}"
                                        ?disabled=${!this.isPrevEnabled}>
                                        <dbp-icon name="chevron-left" aria-hidden="true"></dbp-icon>
                                        ${i18n.t('manage-forms.previous-entry-btn-title')}
                                    </dbp-button>
                                    <div class="page-numbering">
                                        ${i18n.t('manage-forms.detailed-submission-dialog-id', {
                                            id: this.currentBeautyId,
                                            nItems: this.totalItems,
                                        })}
                                    </div>
                                    <dbp-button
                                        class="next-btn"
                                        no-spinner-on-click
                                        title="${i18n.t('manage-forms.next-entry-btn-title')}"
                                        @click="${() => {
                                            this.dispatchEvent(
                                                new CustomEvent('detail-modal-next', {
                                                    detail: {state: this.state},
                                                    bubbles: true,
                                                    composed: true,
                                                }),
                                            );
                                        }}"
                                        ?disabled=${!this.isNextEnabled}>
                                        ${i18n.t('manage-forms.next-entry-btn-title')}
                                        <dbp-icon
                                            name="chevron-right"
                                            aria-hidden="true"></dbp-icon>
                                    </dbp-button>
                                </div>
                            </div>
                        </footer>
                    </div>
                </div>
            </div>
        `;
    }
}
