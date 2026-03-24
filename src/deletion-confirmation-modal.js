// @ts-nocheck
import {html} from 'lit';
import {ScopedElementsMixin, Button} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {createInstance} from './i18n.js';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {MANAGE_FORMS_COMPONENT_STYLES} from './manage-forms-component-styles.js';

/**
 * A self-contained deletion confirmation modal.
 *
 * Usage:
 *   const confirmed = await this._('#deletion-modal').confirm();
 *   if (confirmed) { ... }
 *
 * The `confirm()` method returns a Promise<boolean> that resolves when the
 * user clicks confirm or cancel.
 */
export class DeletionConfirmationModal extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this._resolve = null;
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-modal': Modal,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
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

    /**
     * Show the confirmation dialog and wait for user response.
     * @returns {Promise<boolean>} true if confirmed, false if cancelled.
     */
    confirm() {
        return new Promise((resolve) => {
            this._resolve = resolve;
            const modal = this.renderRoot?.querySelector('#deletion-confirmation-modal--formalize');
            if (modal) {
                modal.open();
            }
        });
    }

    _handleConfirm() {
        const modal = this.renderRoot?.querySelector('#deletion-confirmation-modal--formalize');
        if (modal) modal.close();
        if (this._resolve) {
            this._resolve(true);
            this._resolve = null;
        }
    }

    _handleCancel() {
        const modal = this.renderRoot?.querySelector('#deletion-confirmation-modal--formalize');
        if (modal) modal.close();
        if (this._resolve) {
            this._resolve(false);
            this._resolve = null;
        }
    }

    render() {
        const i18n = this._i18n;

        return html`
            <dbp-modal
                id="deletion-confirmation-modal--formalize"
                class="modal modal--confirmation"
                modal-id="deletion-confirmation-modal"
                title="${i18n.t('manage-forms.delete-confirmation-title')}"
                subscribe="lang">
                <div slot="content">
                    <p>${i18n.t('manage-forms.delete-confirmation-message')}</p>
                </div>
                <menu slot="footer" class="footer-menu">
                    <dbp-button
                        type="is-secondary"
                        no-spinner-on-click
                        @click="${() => this._handleCancel()}">
                        ${i18n.t('manage-forms.abort')}
                    </dbp-button>
                    <dbp-button
                        type="is-danger"
                        no-spinner-on-click
                        @click="${() => this._handleConfirm()}">
                        ${i18n.t('manage-forms.delete')}
                    </dbp-button>
                </menu>
            </dbp-modal>
        `;
    }
}
