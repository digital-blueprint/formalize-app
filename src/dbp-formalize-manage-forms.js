// @ts-nocheck
import {html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {sendNotification} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {GrantPermissionDialog} from '@dbp-toolkit/grant-permission-dialog';
import {FORM_PERMISSIONS} from './utils.js';
import {DeletionConfirmationModal} from './deletion-confirmation-modal.js';
import {EditFormDialog} from './edit-form-dialog.js';
import {createDefaultManageFormsOverviewActions} from './manage-forms-overview-actions.js';
import {apiDeleteForm, getListOfAllForms, successFailureNotification} from './manage-forms-api.js';
import {ManageFormsActivityBase} from './manage-forms-activity-base.js';

/**
 * Statically reference translation keys that are only resolved dynamically
 * (passed as strings to helpers such as successFailureNotification). Without
 * this, the i18next extractor would treat them as unused and prune them.
 * The `{count}` argument ensures the plural (`_one`/`_other`) variants are
 * generated/kept.
 *
 * @param {(key: string, options?: object) => string} t
 */
const keepDynamicTranslations = (t) => {
    t('success.forms-processed', {count: 0});
    t('errors.forms-processing-failed', {count: 0});
};

/**
 * Returns true if the form grants the current user the right to edit it.
 *
 * @param {object} entry - Form entry from the API.
 * @returns {boolean}
 */
export function hasFormEditRight(entry) {
    const grantedFormActions = entry?.['grantedFormActions'] ?? [];
    return (
        grantedFormActions.includes(FORM_PERMISSIONS.UPDATE) ||
        grantedFormActions.includes(FORM_PERMISSIONS.MANAGE)
    );
}

/**
 * Activity to create, edit, delete forms and to edit their permissions.
 * Only forms the user has an edit right for (`update` or `manage`) are listed.
 *
 * Routing: `/` shows the forms overview, `/<formId>/edit` opens the edit dialog.
 *
 * @augments {ManageFormsActivityBase}
 */
export class ManageForms extends ManageFormsActivityBase {
    constructor() {
        super();
        // Bulk removal of forms in the overview is opt-in and disabled by default.
        this.enableFormsBulkDelete = false;
        // Number of loaded modules that implement getEditFormComponent(); drives button visibility
        this.creatableModulesCount = 0;
    }

    static get activityName() {
        return 'manage-forms';
    }

    static get scopedElements() {
        return {
            ...super.scopedElements,
            'dbp-grant-permission-dialog': GrantPermissionDialog,
            'dbp-formalize-deletion-confirmation-modal': DeletionConfirmationModal,
            'dbp-formalize-edit-form-dialog': EditFormDialog,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            creatableModulesCount: {type: Number, attribute: false},
            enableFormsBulkDelete: {
                type: Boolean,
                attribute: 'enable-forms-bulk-delete',
            },
        };
    }

    isFormListed(entry) {
        return hasFormEditRight(entry);
    }

    createDefaultOverviewActions() {
        return createDefaultManageFormsOverviewActions();
    }

    handleModulesLoaded() {
        // Refresh count after modules are loaded so the button visibility is updated
        this.getCreatableModules();
    }

    updated(changedProperties) {
        if (changedProperties.has('enableFormsBulkDelete')) {
            // The delete action is only visible when bulk deletion is enabled.
            this.getOverviewPage()?.updateActions();
        }
        return super.updated(changedProperties);
    }

    handleRoute() {
        this.showFormsOverview();

        const {pathSegments} = this.getRoutingData();
        const formId = pathSegments[0] || '';
        if (!formId || pathSegments[1] !== 'edit') {
            this.closeEditFormDialog();
            return;
        }

        if (!this.forms.has(formId)) {
            if (this.isLoggedIn() && !this.loadingFormsTable) {
                sendNotification({
                    summary: this._i18n.t('errors.notfound-title'),
                    body: this._i18n.t('errors.notfound-body'),
                    type: 'danger',
                    timeout: 0,
                });
            }
            return;
        }

        const dialog = this._('#edit-form-dialog');
        if (dialog?.existingForm?.formId !== formId) {
            this.handleOpenEditFormDialog(formId, false);
        }
    }

    /**
     * Returns the list of creatable form modules.
     * Each entry has { formId, formSlug, formName, moduleInstance }.
     * The formName is retrieved from the module's getFormName() method if available,
     * falling back to the URL slug for backwards compatibility.
     * Also updates creatableModulesCount so the overview page can react to it.
     * @returns {Array<object>}
     */
    getCreatableModules() {
        const modules = [];

        // Iterate only the module definitions loaded from modules.json, not backend form instances.
        for (const entry of this.loadedModules.values()) {
            if (
                !entry.moduleInstance ||
                typeof entry.moduleInstance.getEditFormComponent !== 'function'
            ) {
                continue;
            }

            const frontendKey =
                typeof entry.moduleInstance.getFormFrontendKey === 'function'
                    ? entry.moduleInstance.getFormFrontendKey()
                    : null;

            if (
                this.allowListFrontendKeys.length > 0 &&
                (frontendKey === null || !this.allowListFrontendKeys.includes(frontendKey))
            ) {
                continue;
            }

            if (
                this.denyListFrontendKeys.length > 0 &&
                frontendKey !== null &&
                this.denyListFrontendKeys.includes(frontendKey)
            ) {
                continue;
            }

            const formName =
                typeof entry.moduleInstance.getFormName === 'function'
                    ? entry.moduleInstance.getFormName(this.lang)
                    : entry.formSlug;

            modules.push({
                formId: entry.formId,
                formSlug: entry.formSlug,
                formName,
                moduleInstance: entry.moduleInstance,
            });
        }

        this.creatableModulesCount = modules.length;
        return modules;
    }

    /**
     * Opens the edit form dialog for creating a new form.
     */
    handleOpenCreateFormDialog() {
        const dialog = this._('#edit-form-dialog');
        if (dialog) {
            dialog.existingForm = null;
            dialog.creatableModules = this.getCreatableModules();
            dialog.open();
        }
    }

    /**
     * Opens the edit form dialog in edit mode for the given form.
     * @param {string} formId - Identifier of the form to edit.
     * @param {boolean} updateRoutingUrl - Whether to publish the edit URL.
     */
    handleOpenEditFormDialog(formId, updateRoutingUrl = true) {
        const dialog = this._('#edit-form-dialog');
        if (!dialog) return;

        const formEntry = this.forms.get(formId);
        if (!formEntry) return;

        dialog.existingForm = {
            formId: formEntry.formId,
            formSlug: formEntry.formSlug,
            formName: formEntry.formName,
            moduleInstance: formEntry.moduleInstance,
            additionalData: formEntry.additionalData || null,
            localizedNames: formEntry.localizedNames || [],
        };
        if (updateRoutingUrl) {
            this.sendSetPropertyEvent(
                'routing-url',
                this.getRoutingUrlWithQueryPrefixes(`/${formId}/edit`, ['forms-']),
                true,
            );
        }
        dialog.open();
    }

    handleEditFormDialogClosed(event) {
        if (event.detail?.id !== 'edit-form-dialog') return;

        const dialog = this._('#edit-form-dialog');
        if (dialog) {
            dialog.existingForm = null;
        }
        const {pathSegments} = this.getRoutingData();
        if (pathSegments[0] && pathSegments[1] === 'edit') {
            this.sendSetPropertyEvent(
                'routing-url',
                this.getRoutingUrlWithQueryPrefixes('/', ['forms-']),
                true,
            );
        }
    }

    closeEditFormDialog() {
        const dialog = this._('#edit-form-dialog');
        if (dialog?.existingForm) {
            dialog.close();
            dialog.existingForm = null;
        }
    }

    /**
     * Reloads the forms list after a form was created or edited.
     */
    async handleFormSaved() {
        await getListOfAllForms(this);
    }

    handleEditFormPermission(formIds) {
        const permissionDialog = this._('#form-grant-permission-dialog');
        if (!permissionDialog || !Array.isArray(formIds) || formIds.length === 0) return;

        permissionDialog.resourceIdentifier = formIds.length === 1 ? formIds[0] : '';
        permissionDialog.resourceIdentifiers = formIds;
        permissionDialog.open();
    }

    /**
     * Deletes either the explicitly provided forms or the selected table rows.
     * @param {string[]|null} formIds
     */
    async handleDeleteForms(formIds = null) {
        if (!this.enableFormsBulkDelete) return;

        const targetIds = Array.isArray(formIds)
            ? formIds.filter(Boolean)
            : (this.getOverviewPage()?.getSelectedItems() ?? [])
                  .map((form) => form.formId)
                  .filter(Boolean);
        const data = targetIds
            .map(
                (formId) =>
                    this.forms.get(formId) ?? this.allForms.find((form) => form.formId === formId),
            )
            .filter(Boolean);

        if (data.length === 0) {
            sendNotification({
                summary: this._i18n.t('errors.warning-title'),
                body: this._i18n.t('manage-forms.no-form-selected'),
                type: 'warning',
                timeout: 10,
            });
            return;
        }

        const deletionModal = this._('#deletion-modal');
        // Pass form-specific confirmation wording for this invocation only.
        const confirmed = deletionModal
            ? await deletionModal.confirm({
                  messageKey: 'manage-forms.delete-forms-confirmation-message',
                  messageLi2Key: 'manage-forms.delete-forms-confirmation-message-li2',
              })
            : false;
        if (!confirmed) return;

        const responseStatus = [];
        const deletedFormIds = new Set();
        for (const form of data) {
            const formId = form.formId;
            const grants = this.formsGrantedActions.get(formId) ?? form.grantedActions ?? [];

            // Skip forms the user is not allowed to delete.
            if (
                !grants.includes(FORM_PERMISSIONS.DELETE) &&
                !grants.includes(FORM_PERMISSIONS.MANAGE)
            ) {
                continue;
            }

            const response = await apiDeleteForm(this, formId);
            responseStatus.push(response);

            if (response === true) {
                deletedFormIds.add(formId);
                this.formsGrantedActions.delete(formId);
                this.forms.delete(formId);
            }
        }

        if (deletedFormIds.size > 0) {
            this.allForms = this.allForms.filter((entry) => !deletedFormIds.has(entry.formId));
        }

        // Keep the dynamically referenced notification keys in the i18next output.
        keepDynamicTranslations((key) => this._i18n.t(key));
        successFailureNotification(this, responseStatus, {
            successKey: 'success.forms-processed',
            failureKey: 'errors.forms-processing-failed',
        });
    }

    render() {
        const i18n = this._i18n;

        return html`
            ${this.renderLoginState()}

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isAuthPending()})}">
                <div>
                    <slot name="additional-information"></slot>
                </div>

                <div @create-form-request=${() => this.handleOpenCreateFormDialog()}>
                    ${this.renderOverview({creatableModulesCount: this.creatableModulesCount})}
                </div>
            </div>

            <dbp-grant-permission-dialog
                id="form-grant-permission-dialog"
                lang="${this.lang}"
                modal-title="${i18n.t('manage-forms.edit-permission-modal-title')}"
                subscribe="auth"
                entry-point-url="${this.entryPointUrl}"
                resource-class-identifier="DbpRelayFormalizeForm"></dbp-grant-permission-dialog>

            <dbp-formalize-deletion-confirmation-modal
                id="deletion-modal"
                lang-dir="${this.langDir}"
                subscribe="lang"></dbp-formalize-deletion-confirmation-modal>

            <dbp-formalize-edit-form-dialog
                id="edit-form-dialog"
                lang="${this.lang}"
                lang-dir="${this.langDir}"
                .auth="${this.auth}"
                entry-point-url="${this.entryPointUrl}"
                @dbp-modal-closed=${(event) => this.handleEditFormDialogClosed(event)}
                @dbp-create-form-created=${() => this.handleFormSaved()}
                @dbp-edit-form-saved=${() => this.handleFormSaved()}></dbp-formalize-edit-form-dialog>
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-manage-forms', ManageForms);
