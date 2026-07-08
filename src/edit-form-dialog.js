// @ts-nocheck
import {css, html} from 'lit';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {Icon, Button, MiniSpinner} from '@dbp-toolkit/common';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {Notification} from '@dbp-toolkit/notification';
import * as commonStyles from '@dbp-toolkit/common/styles';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {setOverridesByGlobalCache} from '@dbp-toolkit/common/i18next.js';
import {createInstance} from './i18n.js';
import {getSelectorFixCSS} from './styles.js';

/**
 * Dialog for creating or editing a form via POST/PATCH /formalize/forms.
 *
 * Renders a modal with a form-type selector (only modules that implement
 * getEditFormComponent()). When a form type is selected, the edit form
 * component from getEditFormComponent() is rendered below the selector.
 * That embedded component handles form fields, validation, API call, and
 * error handling. On success the component dispatches `dbp-edit-form-saved`
 * which this dialog relays upward and then closes.
 *
 * The edit-form component is mounted imperatively into a container div to
 * avoid issues with dynamic tag names in Lit templates with ScopedElementsMixin.
 */
export class EditFormDialog extends ScopedElementsMixin(DBPLitElement) {
    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-button': Button,
            'dbp-modal': Modal,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-notification': Notification,
        };
    }

    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.langDir = '';

        /** @type {Array<{formId: string, formSlug: string, formName: string, moduleInstance: object}>} */
        this.creatableModules = [];
        /** @type {string} Currently selected module slug */
        this._selectedModuleSlug = '';
        /** @type {boolean} Whether the save request is in progress */
        this._isSubmitting = false;
        /** @type {string|null} Custom element tag name for the selected edit-form component */
        this._formComponentTag = null;
        /** @type {HTMLElement|null} Currently mounted form component instance */
        this._formComponentInstance = null;
        /** @type {object} Auth object with token */
        this.auth = {};
        /** @type {string} API entry point URL */
        this.entryPointUrl = '';
        /**
         * When set, the dialog operates in edit mode.
         * Shape: { formId, formSlug, formName, moduleInstance, additionalData, localizedNames }
         * @type {object|null}
         */
        this.existingForm = null;
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            langDir: {type: String, attribute: 'lang-dir'},
            auth: {type: Object},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            creatableModules: {type: Array, attribute: false},
            existingForm: {type: Object, attribute: false},
            _selectedModuleSlug: {state: true},
            _isSubmitting: {state: true},
            _formComponentTag: {state: true},
        };
    }

    connectedCallback() {
        super.connectedCallback();

        if (this.langDir) {
            setOverridesByGlobalCache(this._i18n, this);
        }
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

    updated(changedProperties) {
        super.updated(changedProperties);

        if (
            changedProperties.has('creatableModules') &&
            !this._isEditMode &&
            this.creatableModules.length === 1 &&
            this._selectedModuleSlug === ''
        ) {
            this._selectedModuleSlug = this.creatableModules[0].formSlug;
            this._registerAndSetFormComponent(this.creatableModules[0]);
        }

        // Sync the imperatively-managed form component whenever the tag or passed props change
        if (
            changedProperties.has('_formComponentTag') ||
            changedProperties.has('lang') ||
            changedProperties.has('auth') ||
            changedProperties.has('entryPointUrl') ||
            changedProperties.has('existingForm')
        ) {
            this._syncFormComponent();
        }
    }

    /**
     * Mounts or unmounts the edit-form component in the container div based on _formComponentTag.
     * Properties are kept in sync on every relevant update.
     */
    _syncFormComponent() {
        const container = this.renderRoot?.querySelector('#form-component-container');
        if (!container) {
            return;
        }

        if (!this._formComponentTag) {
            // Remove any existing component
            container.innerHTML = '';
            this._formComponentInstance = null;
            return;
        }

        // Create a new element if the tag changed or none exists yet
        if (
            !this._formComponentInstance ||
            this._formComponentInstance.tagName.toLowerCase() !== this._formComponentTag
        ) {
            container.innerHTML = '';
            // Use createScopedElement so the element is created in the correct scoped registry
            this._formComponentInstance = this.createScopedElement(this._formComponentTag);
            container.appendChild(this._formComponentInstance);
        }

        // Keep properties in sync
        this._formComponentInstance.lang = this.lang;
        this._formComponentInstance.langDir = this.langDir;
        this._formComponentInstance.auth = this.auth;
        this._formComponentInstance.entryPointUrl = this.entryPointUrl;
        // Pass the existing form data when in edit mode so the component can pre-populate fields
        this._formComponentInstance.existingForm = this.existingForm || null;
    }

    /**
     * Returns the currently selected module entry, or null.
     * @returns {object|null}
     */
    get _selectedModule() {
        return this.creatableModules.find((m) => m.formSlug === this._selectedModuleSlug) || null;
    }

    /**
     * Returns true when in edit mode.
     * @returns {boolean}
     */
    get _isEditMode() {
        return this.existingForm !== null && this.existingForm !== undefined;
    }

    /**
     * Returns true when a form type is selected and the component is registered.
     * @returns {boolean}
     */
    get _isFormValid() {
        return this._selectedModuleSlug !== '' && this._formComponentTag !== null;
    }

    /** Resets all form fields to empty defaults. */
    _resetForm() {
        this._selectedModuleSlug = '';
        this._isSubmitting = false;
        this._formComponentTag = null;
        this._formComponentInstance = null;

        const container = this.renderRoot?.querySelector('#form-component-container');
        if (container) {
            container.replaceChildren();
        }
    }

    /** Opens the dialog and resets form state. */
    open() {
        this._resetForm();

        if (this._isEditMode) {
            // In edit mode, pre-select the module for the existing form
            this._selectedModuleSlug = this.existingForm.formSlug;
            this._registerAndSetFormComponent(this.existingForm);
        } else if (this.creatableModules.length === 1) {
            // Auto-select when there is exactly one option
            this._selectedModuleSlug = this.creatableModules[0].formSlug;
            this._registerAndSetFormComponent(this.creatableModules[0]);
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

        this._resetForm();
    }

    /**
     * Registers the edit-form component via ScopedElementsMixin's scoped registry
     * and sets _formComponentTag so _syncFormComponent() can imperatively mount it.
     * @param {object} moduleEntry - Entry from creatableModules
     */
    _registerAndSetFormComponent(moduleEntry) {
        if (!moduleEntry || typeof moduleEntry.moduleInstance.getEditFormComponent !== 'function') {
            this._formComponentTag = null;
            return;
        }

        const FormComponent = moduleEntry.moduleInstance.getEditFormComponent();
        if (!FormComponent) {
            this._formComponentTag = null;
            return;
        }

        // Derive a stable custom element tag from the form slug
        const tag = `dbp-edit-form-${moduleEntry.formSlug}`;

        // Register via the scoped registry so the element is recognised inside this shadow root
        this.defineScopedElement(tag, FormComponent);

        this._formComponentTag = tag;
    }

    /**
     * Handles the form type selector change.
     * @param {Event} e
     */
    _onFormTypeChange(e) {
        this._selectedModuleSlug = e.target.value;

        // Mount the edit-form component for the newly selected module
        const selectedModule = this.creatableModules.find(
            (m) => m.formSlug === this._selectedModuleSlug,
        );
        this._registerAndSetFormComponent(selectedModule || null);
    }

    /**
     * Handles the create/save action. Delegates to the imperatively-mounted
     * edit-form component's submit() method.
     */
    async _onSave() {
        if (!this._isFormValid || this._isSubmitting) {
            return;
        }

        this._isSubmitting = true;

        const formComponent = this._formComponentInstance;
        if (formComponent && typeof formComponent.submit === 'function') {
            const result = await formComponent.submit();
            if (result) {
                if (this._isEditMode) {
                    // Relay the edit success event upward so the parent can refresh
                    this.dispatchEvent(
                        new CustomEvent('dbp-edit-form-saved', {
                            detail: {form: result},
                            bubbles: true,
                            composed: true,
                        }),
                    );
                } else {
                    // Relay the create success event upward so the parent can refresh
                    this.dispatchEvent(
                        new CustomEvent('dbp-create-form-created', {
                            detail: {form: result},
                            bubbles: true,
                            composed: true,
                        }),
                    );
                }
                this.close();
            }
        }

        this._isSubmitting = false;
    }

    /** Called by the parent after the API call completes (success or failure). */
    submitComplete() {
        this._isSubmitting = false;
    }

    render() {
        const i18n = this._i18n;
        const t = (key, opts) => (i18n ? i18n.t(key, opts) : key);
        const isEdit = this._isEditMode;
        const saveDisabled = !this._isFormValid || this._isSubmitting;
        const showFormTypeSelector = !isEdit && this.creatableModules.length > 1;
        const generalSectionTitle = t('create-form.section-general');

        return html`
            <dbp-modal
                modal-id="edit-form-dialog"
                lang="${this.lang}"
                sticky-footer
                style="--dbp-modal-min-width: min(95vw, 740px); --dbp-modal-max-width: min(95vw, 740px); --dbp-modal-max-height: 90vh; --dbp-modal-content-overflow-y: auto;">
                <!-- Title -->
                <div slot="title">
                    <h3 class="dialog-title">
                        <dbp-icon
                            class="title-icon"
                            name="${isEdit ? 'pencil' : 'plus'}"
                            aria-hidden="true"></dbp-icon>
                        ${isEdit ? t('edit-form.dialog-title') : t('create-form.dialog-title')}
                    </h3>
                </div>

                <!-- Header content stays pinned above the scrollable modal content. -->
                <div slot="header">
                    <!-- Action bar: Cancel (left) + Create/Save (right) -->
                    <div class="dialog-actions-bar">
                        <p class="required-fields-hint">
                            <span class="required-marker">
                                ${t('render-form.required-files-asterisk')}
                            </span>
                            ${t('render-form.required-files-text')}
                        </p>
                        <button
                            class="button is-primary save-btn"
                            type="button"
                            ?disabled="${saveDisabled}"
                            @click="${this._onSave}">
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
                            ${isEdit ? t('edit-form.save') : t('create-form.create')}
                        </button>
                    </div>

                    <!-- In-dialog notifications (appear above the modal, anchored to it) -->
                    <dbp-notification
                        id="edit-form-dialog-notification"
                        inline
                        lang="${this.lang}"></dbp-notification>
                </div>

                <!-- Form content -->
                <div slot="content" class="dialog-content">
                    ${generalSectionTitle
                        ? html`
                              <h4 class="form-section-heading">${generalSectionTitle}</h4>
                          `
                        : ''}

                    <!-- Form type selector: only shown when there are multiple create options -->
                    ${showFormTypeSelector
                        ? html`
                              <div class="form-field">
                                  <label class="form-label" for="form-type-select">
                                      ${t('create-form.field-form-type')}
                                      <span class="required-marker">*</span>
                                  </label>
                                  <div class="select-wrapper">
                                      <select
                                          id="form-type-select"
                                          class="form-select"
                                          .value="${this._selectedModuleSlug}"
                                          @change="${this._onFormTypeChange}">
                                          <option
                                              value=""
                                              ?selected="${this._selectedModuleSlug === ''}">
                                              ${t('create-form.field-form-type-placeholder')}
                                          </option>
                                          ${this.creatableModules.map(
                                              (m) => html`
                                                  <option
                                                      value="${m.formSlug}"
                                                      ?selected="${this._selectedModuleSlug ===
                                                      m.formSlug}">
                                                      ${m.formName || m.formSlug}
                                                  </option>
                                              `,
                                          )}
                                      </select>
                                  </div>
                              </div>
                          `
                        : ''}

                    <!-- Container where the edit-form component is mounted imperatively -->
                    <div
                        id="form-component-container"
                        class="form-component-area"
                        ?hidden="${!this._formComponentTag}"></div>
                </div>
            </dbp-modal>
        `;
    }

    static get styles() {
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS()}
            ${commonStyles.getButtonCSS()}
            ${getSelectorFixCSS()}

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

            /* Action bar: Cancel on the left, Save on the right */
            .dialog-actions-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .cancel-btn,
            .save-btn {
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

            /* Wrapper provides relative positioning for the chevron icon */
            .select-wrapper {
                position: relative;
            }

            /* Native select styled to match the manage-forms table action header selectors */
            .form-select {
                box-sizing: border-box;
                width: 100%;
                height: 2.25rem;
                padding: 0 2rem 0 0.6rem;
                border: var(--dbp-border);
                border-radius: var(--dbp-border-radius, 0);
                font-size: 1rem;
                color: var(--dbp-content);
                background-color: var(--dbp-background);
                /* background-size is controlled by getSelectorFixCSS() to fix oversized chevron */
                cursor: pointer;
                appearance: auto;
            }

            .form-select:focus {
                outline: none;
                border-color: var(--dbp-accent, #007bff);
            }

            .form-select:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }

            /* Edit-form component area */
            .form-component-area {
                margin-top: 1rem;
            }
        `;
    }
}
