import {FORM_PERMISSIONS} from './utils.js';

export const OVERVIEW_ACTION_PLACEMENTS = {
    ROW: 'row',
    DROPDOWN: 'dropdown',
};

const getFormGrants = (form) => (Array.isArray(form?.grantedActions) ? form.grantedActions : []);

const canEditForm = (form) => {
    const grants = getFormGrants(form);
    return (
        typeof form?.moduleInstance?.getEditFormComponent === 'function' &&
        (grants.includes(FORM_PERMISSIONS.UPDATE) || grants.includes(FORM_PERMISSIONS.MANAGE))
    );
};

const canDeleteForm = (form) => {
    const grants = getFormGrants(form);
    return grants.includes(FORM_PERMISSIONS.DELETE) || grants.includes(FORM_PERMISSIONS.MANAGE);
};

const canManageForm = (form) => getFormGrants(form).includes(FORM_PERMISSIONS.MANAGE);

/**
 * Builds the context passed to overview action predicates and handlers.
 *
 * @param {Record<string, any>} host
 * @param {Array<Record<string, any>>} items
 * @param {Event|null} event
 * @returns {Record<string, any>}
 */
export function createManageFormsOverviewActionContext(host, items = [], event = null) {
    return {
        host,
        items,
        form: items[0] ?? null,
        event,
        t: host._i18n.t.bind(host._i18n),
    };
}

/**
 * Returns the built-in actions for the forms overview.
 *
 * @returns {Array<Record<string, any>>}
 */
export function createDefaultManageFormsOverviewActions() {
    return [
        {
            id: 'open-submissions',
            iconName: 'keyword-research',
            placements: [OVERVIEW_ACTION_PLACEMENTS.ROW],
            label: ({t, form}) => t('manage-forms.open-forms', {formName: form?.formName ?? ''}),
            ariaLabel: ({t, form}) =>
                t('manage-forms.open-forms-aria', {formName: form?.formName ?? ''}),
            isEnabled: ({items}) => items.length === 1,
            handler: ({host, form}) => {
                if (!form?.formId) return;
                host.loadingSubmissionTables = true;
                host.sendSetPropertyEvent(
                    'routing-url',
                    host.getRoutingUrlWithQueryPrefixes(`/${form.formId}`, ['forms-']),
                    true,
                );
            },
        },
        {
            id: 'delete',
            iconName: 'trash',
            placements: [OVERVIEW_ACTION_PLACEMENTS.DROPDOWN],
            label: ({t}) => t('manage-forms.delete'),
            ariaLabel: ({t, form}) =>
                t('manage-forms.delete-form-aria', {formName: form?.formName ?? ''}),
            isVisible: ({host}) => host.enableFormsBulkDelete,
            isEnabled: ({items}) => items.length > 0 && items.every(canDeleteForm),
            handler: ({host, items}) => {
                void host.handleDeleteForms(items.map((form) => form.formId));
            },
        },
        {
            id: 'edit',
            iconName: 'pencil',
            placements: [OVERVIEW_ACTION_PLACEMENTS.DROPDOWN],
            label: ({t}) => t('manage-forms.edit-button-text'),
            title: ({t}) => t('manage-forms.edit-form-button'),
            ariaLabel: ({t, form}) =>
                t('manage-forms.edit-form-aria', {formName: form?.formName ?? ''}),
            isEnabled: ({items}) => items.length === 1 && canEditForm(items[0]),
            handler: ({host, form}) => {
                if (form?.formId) host.handleOpenEditFormDialog(form.formId);
            },
        },
        {
            id: 'edit-permission',
            iconName: 'edit-permission',
            placements: [OVERVIEW_ACTION_PLACEMENTS.DROPDOWN],
            label: ({t}) => t('manage-forms.edit-permission-button-text'),
            ariaLabel: ({t, form}) =>
                t('manage-forms.edit-form-permission-aria', {formName: form?.formName ?? ''}),
            isEnabled: ({items}) => items.length > 0 && items.every(canManageForm),
            handler: ({host, items}) =>
                host.handleEditFormPermission(items.map((form) => form.formId)),
        },
    ];
}

const resolveValue = (value, context) =>
    typeof value === 'function' ? value(context) : (value ?? '');

/**
 * Resolves labels and state for an action in the supplied context.
 *
 * @param {Record<string, any>} action
 * @param {Record<string, any>} context
 * @returns {Record<string, any>}
 */
export function resolveManageFormsOverviewAction(action, context) {
    return {
        ...action,
        label: resolveValue(action.label, context),
        title: resolveValue(action.title ?? action.label, context),
        ariaLabel: resolveValue(action.ariaLabel ?? action.label, context),
        visible: typeof action.isVisible !== 'function' || action.isVisible(context),
        enabled: typeof action.isEnabled !== 'function' || action.isEnabled(context),
    };
}
