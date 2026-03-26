// @ts-nocheck
import {css, html} from 'lit';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {Icon, Button, MiniSpinner} from '@dbp-toolkit/common';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {DbpStringElement} from '@dbp-toolkit/form-elements';
import * as commonStyles from '@dbp-toolkit/common/styles';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {createInstance} from './i18n.js';

/**
 * Dialog for creating a new form via POST /formalize/forms.
 *
 * Renders a modal with a form-type selector (only modules that implement
 * createForm()), fields for form name, localized names (en/de), and an
 * optional description. On submit it dispatches a `dbp-create-form-submit`
 * event with the collected payload plus the selected moduleInstance so
 * the parent component can call moduleInstance.createForm().
 */
export class CreateFormDialog extends ScopedElementsMixin(DBPLitElement) {
    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-button': Button,
            'dbp-modal': Modal,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-string-element': DbpStringElement,
        };
    }

    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;

        /** @type {Array<{formId: string, formSlug: string, moduleInstance: object}>} */
        this.creatableModules = [];
        /** @type {string} Currently selected module slug */
        this._selectedModuleSlug = '';
        /** @type {string} Default form name */
        this._formName = '';
        /** @type {string} English localized name */
        this._formNameEn = '';
        /** @type {string} German localized name */
        this._formNameDe = '';
        /** @type {string} Optional description text */
        this._description = '';
        /** @type {boolean} Whether the create request is in progress */
        this._isSubmitting = false;
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            creatableModules: {type: Array, attribute: false},
            _selectedModuleSlug: {state: true},
            _formName: {state: true},
            _formNameEn: {state: true},
            _formNameDe: {state: true},
            _description: {state: true},
            _isSubmitting: {state: true},
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

    /**
     * Returns the currently selected module entry, or null.
     * @returns {object|null}
     */
    get _selectedModule() {
        return this.creatableModules.find((m) => m.formSlug === this._selectedModuleSlug) || null;
    }

    /**
     * Returns true when all required fields have a non-empty value.
     * @returns {boolean}
     */
    get _isFormValid() {
        return (
            this._selectedModuleSlug !== '' &&
            this._formName.trim() !== '' &&
            this._formNameEn.trim() !== '' &&
            this._formNameDe.trim() !== ''
        );
    }

    /** Resets all form fields to empty defaults. */
    _resetForm() {
        this._selectedModuleSlug = '';
        this._formName = '';
        this._formNameEn = '';
        this._formNameDe = '';
        this._description = '';
        this._isSubmitting = false;
    }

    /** Opens the dialog and resets form state. */
    open() {
        this._resetForm();

        // Auto-select when there is exactly one option
        if (this.creatableModules.length === 1) {
            this._selectedModuleSlug = this.creatableModules[0].formSlug;
        }

        const dialog = this.renderRoot?.querySelector('dbp-modal');
        if (dialog) {
            dialog.open();
        }
    }

    /** Closes the dialog. */
    close() {
        const dialog = this.renderRoot?.querySelector('dbp-modal');
        if (dialog) {
            dialog.close();
        }
    }

    /**
     * Handles the form type selector change.
     * @param {Event} e
     */
    _onFormTypeChange(e) {
        this._selectedModuleSlug = e.target.value;
    }

    /**
     * Handles the create action. Validates and dispatches the
     * `dbp-create-form-submit` event with the form payload and
     * the selected module instance.
     */
    _onCreate() {
        if (!this._isFormValid || this._isSubmitting) {
            return;
        }

        const selectedModule = this._selectedModule;
        if (!selectedModule) {
            return;
        }

        this._isSubmitting = true;

        const detail = {
            moduleInstance: selectedModule.moduleInstance,
            name: this._formName.trim(),
            nameEn: this._formNameEn.trim(),
            nameDe: this._formNameDe.trim(),
        };

        // Include description if provided
        if (this._description.trim()) {
            detail.description = this._description.trim();
        }

        this.dispatchEvent(
            new CustomEvent('dbp-create-form-submit', {
                detail,
                bubbles: true,
                composed: true,
            }),
        );
    }

    /** Called by the parent after the API call completes (success or failure). */
    submitComplete() {
        this._isSubmitting = false;
    }

    render() {
        const i18n = this._i18n;
        const t = (key, opts) => (i18n ? i18n.t(key, opts) : key);
        const createDisabled = !this._isFormValid || this._isSubmitting;

        return html`
            <dbp-modal
                modal-id="create-form-dialog"
                lang="${this.lang}"
                sticky-footer
                style="--dbp-modal-min-width: min(95vw, 740px); --dbp-modal-max-width: min(95vw, 740px); --dbp-modal-max-height: 90vh; --dbp-modal-content-overflow-y: auto;">
                <!-- Title -->
                <div slot="title">
                    <h3 class="dialog-title">
                        <dbp-icon class="title-icon" name="plus" aria-hidden="true"></dbp-icon>
                        ${t('create-form.dialog-title')}
                    </h3>
                </div>

                <!-- Form content -->
                <div slot="content" class="dialog-content">
                    <!-- Action bar: Cancel (left) + Create (right) -->
                    <div class="dialog-actions-bar">
                        <button
                            class="button is-secondary cancel-btn"
                            type="button"
                            @click="${() => this.close()}">
                            <dbp-icon class="btn-icon" name="close" aria-hidden="true"></dbp-icon>
                            ${t('create-form.cancel')}
                        </button>
                        <button
                            class="button is-primary create-btn"
                            type="button"
                            ?disabled="${createDisabled}"
                            @click="${this._onCreate}">
                            ${this._isSubmitting
                                ? html`
                                      <dbp-mini-spinner></dbp-mini-spinner>
                                  `
                                : html`
                                      <dbp-icon
                                          class="btn-icon"
                                          name="save"
                                          aria-hidden="true"></dbp-icon>
                                  `}
                            ${t('create-form.create')}
                        </button>
                    </div>

                    <!-- General section -->
                    <h4 class="form-section-heading">${t('create-form.section-general')}</h4>

                    <!-- Form type selector -->
                    <div class="form-field">
                        <label class="form-label" for="form-type-select">
                            ${t('create-form.field-form-type')}
                            <span class="required-marker">*</span>
                        </label>
                        <select
                            id="form-type-select"
                            class="form-select"
                            .value="${this._selectedModuleSlug}"
                            @change="${this._onFormTypeChange}">
                            <option value="" ?selected="${this._selectedModuleSlug === ''}">
                                ${t('create-form.field-form-type-placeholder')}
                            </option>
                            ${this.creatableModules.map(
                                (m) => html`
                                    <option
                                        value="${m.formSlug}"
                                        ?selected="${this._selectedModuleSlug === m.formSlug}">
                                        ${m.formSlug}
                                    </option>
                                `,
                            )}
                        </select>
                    </div>

                    <!-- Form name (full width, required) -->
                    <dbp-string-element
                        name="form-name"
                        lang="${this.lang}"
                        label="${t('create-form.field-name')}"
                        .value="${this._formName}"
                        required
                        @change="${(e) => (this._formName = e.detail.value)}"></dbp-string-element>

                    <!-- Localized names section -->
                    <h4 class="form-section-heading">
                        ${t('create-form.section-localized-names')}
                    </h4>

                    <!-- English + German names side by side -->
                    <div class="form-row-2col">
                        <dbp-string-element
                            name="form-name-en"
                            lang="${this.lang}"
                            label="${t('create-form.field-name-en')}"
                            .value="${this._formNameEn}"
                            required
                            @change="${(e) =>
                                (this._formNameEn = e.detail.value)}"></dbp-string-element>
                        <dbp-string-element
                            name="form-name-de"
                            lang="${this.lang}"
                            label="${t('create-form.field-name-de')}"
                            .value="${this._formNameDe}"
                            required
                            @change="${(e) =>
                                (this._formNameDe = e.detail.value)}"></dbp-string-element>
                    </div>

                    <!-- Additional section -->
                    <h4 class="form-section-heading">${t('create-form.section-additional')}</h4>

                    <!-- Description textarea (full width, optional) -->
                    <dbp-string-element
                        name="description"
                        lang="${this.lang}"
                        label="${t('create-form.field-description')}"
                        placeholder="${t('create-form.field-description-placeholder')}"
                        .value="${this._description}"
                        rows="5"
                        @change="${(e) =>
                            (this._description = e.detail.value)}"></dbp-string-element>
                </div>
            </dbp-modal>
        `;
    }

    static get styles() {
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS()}
            ${commonStyles.getButtonCSS()}

            /* Match the color of the modal's own close button (--dbp-accent) */
            .title-icon {
                color: var(--dbp-accent);
                top: 0;
            }

            /* Dialog title layout */
            .dialog-title {
                display: inline-flex;
                align-items: center;
                gap: 0.4rem;
                margin: 0;
                font-size: 1.4rem;
                font-weight: 700;
            }

            /* Action bar: Cancel on the left, Create on the right */
            .dialog-actions-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
            }

            .cancel-btn,
            .create-btn {
                display: inline-flex;
                align-items: center;
                gap: 0.4rem;
            }

            /* Icon inside buttons: override the default top offset */
            .btn-icon {
                flex-shrink: 0;
                top: 0;
            }

            /* Section headings */
            .form-section-heading {
                font-size: 1rem;
                font-weight: 700;
                margin: 1.25rem 0 0.75rem;
            }

            /* Form field wrapper for native elements (select) */
            .form-field {
                margin-bottom: 0.75rem;
            }

            .form-label {
                display: block;
                font-weight: 600;
                margin-bottom: 0.35rem;
            }

            .required-marker {
                color: var(--dbp-danger, #e4154b);
            }

            .form-select {
                width: 100%;
                padding: 0.45rem 0.6rem;
                border: var(--dbp-border);
                border-radius: var(--dbp-border-radius, 0);
                font-size: 1rem;
                background-color: var(--dbp-background);
                color: var(--dbp-content);
                cursor: pointer;
            }

            .form-select:focus {
                outline: none;
                border-color: var(--dbp-accent, #007bff);
            }

            /* Two-column grid for side-by-side fields */
            .form-row-2col {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1rem;
                margin-bottom: 0.75rem;
            }

            @media (max-width: 540px) {
                .form-row-2col {
                    grid-template-columns: 1fr;
                }
            }

            /* Vertical spacing between consecutive form elements */
            .dialog-content dbp-string-element {
                display: block;
                margin-bottom: 0.75rem;
            }

            /* Reset bottom margin for elements inside a two-column row */
            .form-row-2col dbp-string-element {
                margin-bottom: 0;
            }
        `;
    }
}
