// @ts-nocheck
import {html} from 'lit';
import {ScopedElementsMixin, Button, Icon} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {setOverridesByGlobalCache} from '@dbp-toolkit/common/i18next.js';
import {createInstance} from './i18n.js';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {MANAGE_FORMS_COMPONENT_STYLES} from './manage-forms-component-styles.js';

/**
 * Statically reference every translation key that can be shown by this modal.
 *
 * The actual message keys are configured at runtime through the `messageKey`
 * and `messageLi2Key` properties and resolved dynamically at call time.
 * Because the i18next extractor only detects literal string translation calls,
 * these keys would otherwise be considered unused and pruned from the
 * translation files. Listing them here keeps them in the extraction output.
 *
 * @param {(key: string) => string} t
 */
const keepDeletionModalTranslations = (t) => {
    t('manage-forms.delete-confirmation-message');
    t('manage-forms.delete-confirmation-message-li2');
    t('manage-forms.delete-forms-confirmation-message');
    t('manage-forms.delete-forms-confirmation-message-li2');
    t('manage-fields.delete-confirmation-message');
    t('manage-fields.delete-confirmation-message-li2');
};

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
        this.langDir = '';
        this._resolve = null;
        this.messageKey = 'manage-forms.delete-confirmation-message';
        this.messageLi2Key = 'manage-forms.delete-confirmation-message-li2';
        // Per-invocation message key overrides. When set (via confirm(options)),
        // they take precedence over the reactive properties for that single
        // dialog, and are cleared again once the dialog resolves. This avoids
        // permanently mutating the shared modal instance.
        this._overrideMessageKey = null;
        this._overrideMessageLi2Key = null;
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-modal': Modal,
            'dbp-icon': Icon,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            langDir: {type: String, attribute: 'lang-dir'},
            messageKey: {type: String, attribute: 'message-key'},
            messageLi2Key: {type: String, attribute: 'message-li2-key'},
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            if (propName === 'lang') {
                this._i18n.changeLanguage(this.lang);
            }

            if ((propName === 'lang' || propName === 'langDir') && this.langDir) {
                setOverridesByGlobalCache(this._i18n, this);
            }
        });
        super.update(changedProperties);
    }

    connectedCallback() {
        super.connectedCallback();

        if (this.langDir) {
            setOverridesByGlobalCache(this._i18n, this);
        }
    }

    static get styles() {
        return MANAGE_FORMS_COMPONENT_STYLES;
    }

    /**
     * Show the confirmation dialog and wait for user response.
     *
     * @param {{messageKey?: string, messageLi2Key?: string}} [options] Optional
     *   per-invocation message key overrides. They apply only to this dialog
     *   and are cleared once it resolves, leaving the shared modal untouched.
     * @returns {Promise<boolean>} true if confirmed, false if cancelled.
     */
    async confirm(options = {}) {
        this._overrideMessageKey = options.messageKey ?? null;
        this._overrideMessageLi2Key = options.messageLi2Key ?? null;
        // Reflect the override in the rendered dialog before opening it, so the
        // correct message is shown on first paint.
        this.requestUpdate();
        await this.updateComplete;

        return new Promise((resolve) => {
            this._resolve = resolve;
            const modal = this.renderRoot?.querySelector('#deletion-confirmation-modal--formalize');
            if (modal) {
                modal.open();
            }
        });
    }

    _resolveConfirm(result) {
        const modal = this.renderRoot?.querySelector('#deletion-confirmation-modal--formalize');
        if (modal) modal.close();
        // Clear per-invocation overrides so the next caller starts clean.
        this._overrideMessageKey = null;
        this._overrideMessageLi2Key = null;
        this.requestUpdate();
        if (this._resolve) {
            this._resolve(result);
            this._resolve = null;
        }
    }

    _handleConfirm() {
        this._resolveConfirm(true);
    }

    _handleCancel() {
        this._resolveConfirm(false);
    }

    getMessage() {
        // Ensure all possible message keys are preserved by the i18next extractor.
        keepDeletionModalTranslations((key) => this._i18n.t(key));
        // A per-invocation override wins; otherwise fall back to the configured
        // property (e.g. forms/job offers vs. submissions vs. fields).
        const key =
            this._overrideMessageKey ||
            this.messageKey ||
            'manage-forms.delete-confirmation-message';
        return this._i18n.t(key);
    }

    getMessageLi2() {
        const key =
            this._overrideMessageLi2Key ||
            this.messageLi2Key ||
            'manage-forms.delete-confirmation-message-li2';
        return this._i18n.t(key);
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
                    <p>${this.getMessage()}</p>
                    <ul>
                        <li>${i18n.t('manage-forms.delete-confirmation-message-li1')}</li>
                        <li>${this.getMessageLi2()}</li>
                    </ul>
                </div>
                <menu slot="footer" class="footer-menu">
                    <dbp-button
                        type="is-secondary"
                        no-spinner-on-click
                        @click="${() => this._handleCancel()}">
                        <dbp-icon name="close" aria-hidden="true"></dbp-icon>
                        ${i18n.t('manage-forms.abort')}
                    </dbp-button>
                    <dbp-button
                        type="is-danger"
                        no-spinner-on-click
                        @click="${() => this._handleConfirm()}">
                        <dbp-icon name="trash" aria-hidden="true"></dbp-icon>

                        ${i18n.t('manage-forms.delete')}
                    </dbp-button>
                </menu>
            </dbp-modal>
        `;
    }
}
