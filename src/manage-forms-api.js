// @ts-nocheck
/**
 * API helpers for the Manage Forms activity.
 *
 * Every function receives the calling element (`host`) as its first argument so
 * it can access `host.auth`, `host.entryPointUrl`, `host._i18n`, etc.
 * This keeps the functions stateless and easy to test.
 */

import {sendNotification} from '@dbp-toolkit/common';
import {
    getFormRenderUrl,
    SUBMISSION_STATES_BINARY,
    FORM_PERMISSIONS,
    SUBMISSION_PERMISSIONS,
} from './utils.js';
import xss from 'xss';
import {
    createDefaultManageFormsOverviewActions,
    createManageFormsOverviewActionContext,
    resolveManageFormsOverviewAction,
} from './manage-forms-overview-actions.js';
import {createRowActionsMenu} from './table-components.js';

// ---------------------------------------------------------------------------
// Utility helpers used only by the functions in this module
// ---------------------------------------------------------------------------

/**
 * Converts a timestamp to "YYYY-MM-DD HH:MM".
 * @param {string} value
 * @returns {string}
 */
export function humanReadableDate(value) {
    const d = Date.parse(value);
    const timestamp = new Date(d);
    const year = timestamp.getFullYear();
    const month = ('0' + (timestamp.getMonth() + 1)).slice(-2);
    const date = ('0' + timestamp.getDate()).slice(-2);
    const hours = ('0' + timestamp.getHours()).slice(-2);
    const minutes = ('0' + timestamp.getMinutes()).slice(-2);
    return year + '-' + month + '-' + date + ' ' + hours + ':' + minutes;
}

/**
 * Send a generic "something went wrong" notification.
 * @param {object} host
 */
function throwSomethingWentWrongNotification(host) {
    const i18n = host._i18n;
    sendNotification({
        summary: i18n.t('manage-forms.something-went-wrong-title'),
        body: i18n.t('manage-forms.something-went-wrong-body'),
        type: 'danger',
        timeout: 0,
    });
}

// ---------------------------------------------------------------------------
// Module loading
// ---------------------------------------------------------------------------

/**
 * Load form modules and create ID -> slug mapping.
 *
 * @param {object} host - The ManageForms element.
 * @returns {Promise<void>}
 */
export function loadModules(host) {
    // If a load is already in flight, return the same promise so concurrent
    // callers await the same completion instead of returning early and then
    // proceeding while modules are still resolving.
    if (host.loadModulesPromise) return host.loadModulesPromise;

    host.isLoadingModules = true;
    host.loadModulesPromise = (async () => {
        try {
            const response = await fetch(host.basePath + 'modules.json');
            const data = await response.json();

            for (const path of Object.values(data['forms'])) {
                // Resolve the module path relative to basePath so that relative paths
                // in modules.json (e.g. "./jobOfferForm.js") work correctly even when
                // the bundled API file lives in a sub-directory (e.g. /dist/shared/).
                const absolutePath = new URL(path, window.location.origin + host.basePath).href;
                const module = await import(absolutePath);
                const object = new module.default();

                if (object.getFormIdentifier && object.getUrlSlug) {
                    host.forms.set(object.getFormIdentifier(), {
                        formName: null,
                        formId: object.getFormIdentifier(),
                        formSlug: object.getUrlSlug(),
                        moduleInstance: object,
                    });
                    // Also store in a dedicated map so getCreatableModules() can enumerate
                    // only module definitions and is not confused by backend form instances.
                    host.loadedModules.set(object.getUrlSlug(), {
                        formId: object.getFormIdentifier(),
                        formSlug: object.getUrlSlug(),
                        formName: null,
                        moduleInstance: object,
                    });
                }
            }
        } catch (error) {
            console.error('Error loading modules:', error);
        } finally {
            host.isLoadingModules = false;
            // Clear the in-flight promise so a future call can trigger a fresh load.
            host.loadModulesPromise = null;
        }
    })();

    return host.loadModulesPromise;
}

// ---------------------------------------------------------------------------
// Forms list
// ---------------------------------------------------------------------------

/**
 * Creates the row actions menu of a form in the forms overview. It contains every action
 * that is visible and enabled for this single form, regardless of its placement.
 *
 * @param {object} host - The ManageForms element.
 * @param {Array<Record<string, any>>} actions - Overview action definitions.
 * @param {() => object} getContext - Returns the current action context of the row.
 * @returns {HTMLElement|null} The menu, or null if no action is available.
 */
export function createManageFormsOverviewRowActionsMenu(host, actions, getContext) {
    const initialContext = getContext();
    const menuActions = actions
        .filter((action) => action?.id && typeof action.handler === 'function')
        .map((action) => ({
            action,
            resolved: resolveManageFormsOverviewAction(action, initialContext),
        }))
        .filter(({resolved}) => resolved.visible && resolved.enabled)
        .map(({action, resolved}) => ({
            value: action.id,
            // The title is more descriptive than the short label used for toolbar buttons
            label: resolved.title || resolved.label,
            iconName: action.iconName,
            handler: (event) => {
                const currentContext = {...getContext(), event};
                const currentAction = resolveManageFormsOverviewAction(action, currentContext);
                if (currentAction.visible && currentAction.enabled) {
                    action.handler(currentContext);
                }
            },
        }));

    if (menuActions.length === 0) {
        return null;
    }

    const formName = initialContext.form?.formName ?? '';
    return createRowActionsMenu(
        host,
        host._i18n.t('manage-forms.row-actions-aria', {name: formName}),
        menuActions,
    );
}

/**
 * Returns true if a form collection entry grants actions relevant to managing the
 * form itself or its submissions. Used when the host does not define `isFormListed()`.
 *
 * @param {object} entry - Form entry from the API.
 * @returns {boolean}
 */
function isFormListedByDefault(entry) {
    const grantedFormActions = entry['grantedFormActions'] ?? [];
    const grantedSubmissionCollectionActions = entry['grantedSubmissionCollectionActions'] ?? [];
    const hasAllowedFormAction = grantedFormActions.some((action) =>
        [FORM_PERMISSIONS.UPDATE, FORM_PERMISSIONS.DELETE, FORM_PERMISSIONS.MANAGE].includes(
            action,
        ),
    );
    const hasAllowedSubmissionCollectionAction = grantedSubmissionCollectionActions.some((action) =>
        [SUBMISSION_PERMISSIONS.READ, SUBMISSION_PERMISSIONS.MANAGE].includes(action),
    );
    return hasAllowedFormAction || hasAllowedSubmissionCollectionAction;
}

/**
 * Builds the form collection URL including the host-specific filters.
 *
 * @param {object} host
 * @returns {string}
 */
function getFormsCollectionUrl(host) {
    const queryParams = new URLSearchParams({perPage: '9999'});
    const filters =
        typeof host.getFormsCollectionFilters === 'function'
            ? host.getFormsCollectionFilters()
            : {};
    for (const [name, value] of Object.entries(filters)) {
        queryParams.append(name, `${value}`);
    }
    return `${host.entryPointUrl}/formalize/forms?${queryParams.toString()}`;
}

/**
 * Returns the valid overview columns of a module (see `BaseObject.getManageFormsOverviewColumns()`).
 * The fields are prefixed, so they can't collide with the built-in columns of the overview.
 *
 * @param {object|null} moduleInstance
 * @param {object} host
 * @returns {Array<{field: string, title: (lng: string) => string, getValue: (form: Record<string, any>) => any, widthGrow?: number}>}
 */
export function getModuleOverviewColumns(moduleInstance, host) {
    const columns = moduleInstance?.getManageFormsOverviewColumns?.({host});
    if (!Array.isArray(columns)) return [];

    return columns
        .filter(
            (column) =>
                typeof column?.field === 'string' &&
                column.field !== '' &&
                typeof column.title === 'function' &&
                typeof column.getValue === 'function',
        )
        .map((column) => ({...column, field: `module-${column.field}`}));
}

/**
 * Fetch the list of all forms and populate `host.allForms`.
 *
 * Forms are filtered by `host.allowListFrontendKeys` and `host.denyListFrontendKeys`,
 * which contain `frontendKey` values. A single frontendKey may match multiple
 * forms, so one entry in the list can show a whole group of forms.
 *
 * The host can customize the request and the result with these optional methods:
 * - `getFormsCollectionFilters()`: query parameters added to the form collection request
 * - `isFormListed(entry)`: whether a form entry from the API is shown
 * - `createDefaultOverviewActions()`: the built-in overview actions passed to the modules
 *
 * Modules can add columns to the overview (`host.formsOverviewColumns`) with
 * `getManageFormsOverviewColumns()`.
 *
 * @param {object} host - The ManageForms element.
 * @returns {Promise<void>}
 */
export async function getListOfAllForms(host) {
    const i18n = host._i18n;
    // Make sure module loading has finished before building the list. Several
    // reactive triggers (lang, allow/deny lists, routing) can call this while a
    // loadModules() started by another trigger is still in flight; awaiting it
    // here guarantees moduleInstance is resolved so the edit button is included.
    if (host.loadModulesPromise) {
        await host.loadModulesPromise;
    }
    try {
        host.loadCourses = false;

        // Only show the loading spinner if the table hasn't been built yet.
        // On subsequent calls (e.g. triggered by a token refresh) we keep the
        // existing table visible so the user doesn't see a disruptive flash.
        const isInitialLoad = !host.allForms || host.allForms.length === 0;
        if (isInitialLoad) {
            host.loadingFormsTable = true;
        }

        const response = await fetch(getFormsCollectionUrl(host), {
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + host.auth.token,
            },
        });

        if (!response.ok) {
            host.handleErrorResponse(response);
        } else {
            let data = [];
            let forms = [];
            try {
                data = await response.json();
            } catch (e) {
                host.sendErrorAnalyticsEvent('LoadListOfAllCourses', 'WrongResponse', e);
                throwSomethingWentWrongNotification(host);
                host.loadCourses = true;
                return;
            }

            const allowList = Array.isArray(host.allowListFrontendKeys)
                ? host.allowListFrontendKeys
                : [];
            const denyList = Array.isArray(host.denyListFrontendKeys)
                ? host.denyListFrontendKeys
                : [];

            // Build a set of form identifiers that were loaded from modules.json.
            const loadedModuleFormIds = new Set();
            for (const entry of host.loadedModules.values()) {
                loadedModuleFormIds.add(entry.formId);
            }

            // Reset the per-form permission map so it reflects the current API response.
            if (host.formsGrantedActions instanceof Map) {
                host.formsGrantedActions.clear();
            }

            const entries = data['hydra:member'].filter((entry) => {
                const key = entry.frontendKey ?? null;
                return (
                    (allowList.length === 0 || allowList.includes(key)) && !denyList.includes(key)
                );
            });

            // Remove backend entries no longer present, so stale routes cannot bypass filtering.
            const currentFormIds = new Set(entries.map((entry) => entry.identifier));
            for (const formId of host.forms.keys()) {
                if (!loadedModuleFormIds.has(formId) && !currentFormIds.has(formId)) {
                    host.forms.delete(formId);
                }
            }

            let id = 0;
            const overviewActions = new Map();
            /** @type {Map<string, {field: string, title: (lng: string) => string, widthGrow?: number}>} */
            const overviewColumns = new Map();
            for (const entry of entries) {
                let localizedFormName = entry['localizedNames'].find((localizedName) => {
                    return localizedName.languageTag === host.lang;
                });
                const formName = localizedFormName ? localizedFormName.name : entry['name'];
                const formId = entry['identifier'];
                const frontendKey = entry['frontendKey'] ?? null;
                const dateCreated = entry['dateCreated'] ?? null;

                // Apply allow-list: if non-empty, only include forms whose frontendKey is in the list
                if (
                    allowList.length > 0 &&
                    (frontendKey === null || !allowList.includes(frontendKey))
                ) {
                    continue;
                }

                // Apply deny-list: skip forms whose frontendKey is in the list
                if (denyList.length > 0 && frontendKey !== null && denyList.includes(frontendKey)) {
                    continue;
                }

                const isListed =
                    typeof host.isFormListed === 'function'
                        ? host.isFormListed(entry)
                        : isFormListedByDefault(entry);
                if (!isListed) {
                    continue;
                }

                // Skip forms whose identifier does not match any locally loaded
                // module from modules.json.  This ensures that a whitelabel build
                // (which ships a reduced modules.json) does not display forms it
                // has no frontend code for.
                // if (!loadedModuleFormIds.has(formId)) {
                //     continue;
                // }

                id++;
                const allowedActionsWhenSubmitted = entry['allowedActionsWhenSubmitted'];
                const tagPermissionsForSubmitters = entry['tagPermissionsForSubmitters'];
                const allowedSubmissionStates = entry['allowedSubmissionStates'];
                const dataFeedSchema = entry['dataFeedSchema'];
                const grantedActions = entry['grantedActions'] ?? [];
                const grantedSubmissionCollectionActions =
                    entry['grantedSubmissionCollectionActions'] ?? [];

                const additionalData = entry['additionalData'] ?? null;
                const localizedNames = entry['localizedNames'] ?? [];

                // Find the module instance whose frontendKey matches this form's frontendKey.
                // Modules are enumerated from host.loadedModules (keyed by unique getUrlSlug()),
                // because host.forms keys by getFormIdentifier() which defaults to 'uuid' and
                // collides across modules. A form type is identified by its frontendKey, not by
                // a single UUID, since each backend form instance has its own generated UUID.
                let matchedModuleInstance = host.forms.get(formId)?.moduleInstance ?? null;
                if (!matchedModuleInstance && frontendKey) {
                    for (const moduleEntry of host.loadedModules.values()) {
                        if (
                            moduleEntry.moduleInstance &&
                            typeof moduleEntry.moduleInstance.getFormFrontendKey === 'function' &&
                            moduleEntry.moduleInstance.getFormFrontendKey() === frontendKey
                        ) {
                            matchedModuleInstance = moduleEntry.moduleInstance;
                            break;
                        }
                    }
                }

                host.forms.set(formId, {
                    ...host.forms.get(formId),
                    formName,
                    dateCreated,
                    formId,
                    formSlug:
                        host.forms.get(formId)?.formSlug ??
                        matchedModuleInstance?.getUrlSlug?.() ??
                        formId,
                    moduleInstance: matchedModuleInstance,
                    allowedSubmissionStates,
                    allowedActionsWhenSubmitted,
                    dataFeedSchema,
                    tagPermissionsForSubmitters,
                    additionalData,
                    localizedNames,
                    grantedActions,
                    grantedSubmissionCollectionActions,
                });

                // Store current grants before modules build permission-gated row actions.
                if (host.formsGrantedActions instanceof Map) {
                    host.formsGrantedActions.set(formId, grantedActions);
                }

                const managedForm = host.forms.get(formId);

                // Build the row actions container with a menu of all actions for this form.
                const actionContainer = document.createElement('span');
                actionContainer.style.cssText =
                    'display: inline-flex; gap: 0.5rem; align-items: center;';
                const actionContext = createManageFormsOverviewActionContext(host, [managedForm]);
                const getCurrentActionContext = () =>
                    createManageFormsOverviewActionContext(host, [host.forms.get(formId)]);
                const defaultActions =
                    typeof host.createDefaultOverviewActions === 'function'
                        ? host.createDefaultOverviewActions()
                        : createDefaultManageFormsOverviewActions();
                const customizedActions = matchedModuleInstance?.getManageFormsOverviewActions?.(
                    actionContext,
                    defaultActions,
                );
                const rowActions = Array.isArray(customizedActions)
                    ? customizedActions
                    : defaultActions;
                rowActions.forEach((action) => {
                    if (action?.id) {
                        overviewActions.set(action.id, action);
                    }
                });
                const rowActionsMenu = createManageFormsOverviewRowActionsMenu(
                    host,
                    rowActions,
                    getCurrentActionContext,
                );
                if (rowActionsMenu) {
                    actionContainer.appendChild(rowActionsMenu);
                }

                let new_form = {
                    id: id,
                    name: formName,
                    formId: formId,
                    dateCreated: dateCreated,
                    grantedActions: grantedActions,
                    // Filled in asynchronously by loadFormsSubmissionCounts()
                    numSubmissions: host.formsSubmissionCounts?.get(formId) ?? null,
                    actionButton: actionContainer,
                };

                // Add the values of the module-specific overview columns
                for (const column of getModuleOverviewColumns(matchedModuleInstance, host)) {
                    if (!overviewColumns.has(column.field)) {
                        overviewColumns.set(column.field, {
                            field: column.field,
                            title: column.title,
                            widthGrow: column.widthGrow,
                        });
                    }
                    new_form[column.field] = String(column.getValue(managedForm) ?? '');
                }
                forms.push(new_form);
            }

            host.formsOverviewActionDefinitions = [...overviewActions.values()];

            // Forms of other modules show an empty cell in module-specific columns
            const columnFields = [...overviewColumns.keys()];
            for (const form of forms) {
                for (const field of columnFields) {
                    form[field] ??= '';
                }
            }

            // Avoid replacing allForms when the set of forms hasn't changed.
            // A token refresh can cause this function to be re-invoked even
            // though the API returns the same data.  Skipping the assignment
            // prevents the Lit reactive cycle from re-triggering
            // updated('allForms'), which would rebuild/reset the tabulator
            // tables, show a loading spinner, and disrupt the user.
            const getRowsKey = (rows, fields) =>
                JSON.stringify([
                    fields,
                    rows.map((row) => [
                        row.formId,
                        row.name,
                        row.grantedActions,
                        ...fields.map((field) => row[field]),
                    ]),
                ]);
            const prevColumnFields = (host.formsOverviewColumns || []).map(({field}) => field);
            if (
                getRowsKey(host.allForms || [], prevColumnFields) ===
                    getRowsKey(forms, columnFields) &&
                (host.allForms || []).length > 0
            ) {
                // Forms unchanged — just make sure the loading spinner is hidden.
                host.loadingFormsTable = false;
                return;
            }

            host.formsOverviewColumns = [...overviewColumns.values()];
            host.allForms = forms;
        }
    } catch (e) {
        host.loadCourses = true;
        console.error('[updated] Error getting list of forms:', e);
        sendNotification({
            summary: i18n.t('manage-forms.failed-to-get-forms-title'),
            body: i18n.t('manage-forms.failed-to-get-forms-body'),
            type: 'danger',
            timeout: 0,
        });
    }
}

// ---------------------------------------------------------------------------
// Submission counts
// ---------------------------------------------------------------------------

/** Maximum number of forms whose submissions are counted at the same time. */
const SUBMISSION_COUNT_CONCURRENCY = 4;

/**
 * Returns true if the user may read all submitted submissions of a form, so the
 * number of readable submissions equals the number of submissions of the form.
 *
 * @param {object|undefined} form - Form entry of `host.forms`.
 * @returns {boolean}
 */
function mayReadAllFormSubmissions(form) {
    const actions = form?.grantedSubmissionCollectionActions ?? [];
    return actions.some((action) =>
        [SUBMISSION_PERMISSIONS.READ, SUBMISSION_PERMISSIONS.MANAGE].includes(action),
    );
}

/**
 * Counts the submitted (non-draft) submissions of a form.
 *
 * The API has no count endpoint and no submission state filter, so all readable
 * submissions are fetched (following the pagination) and counted.
 *
 * @param {object} host
 * @param {string} formId
 * @returns {Promise<number>}
 */
export async function apiGetSubmittedSubmissionsCount(host, formId) {
    const options = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/ld+json',
            Authorization: 'Bearer ' + host.auth.token,
        },
    };

    let url =
        host.entryPointUrl +
        '/formalize/submissions?' +
        new URLSearchParams({formIdentifier: formId, perPage: '9999'}).toString();
    let count = 0;
    while (url) {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`Failed to load submissions: ${response.status}`);
        }
        const page = await response.json();
        count += (page['hydra:member'] ?? []).filter(
            (submission) => submission.submissionState === SUBMISSION_STATES_BINARY.SUBMITTED,
        ).length;
        const next = page['hydra:view']?.['hydra:next'];
        url = next ? new URL(next, host.entryPointUrl).href : null;
    }
    return count;
}

/**
 * Loads the number of submitted submissions of all forms listed in the overview
 * and stores them in `host.formsSubmissionCounts` (form identifier -> count).
 *
 * Only forms whose submissions the user may read on form level are counted,
 * all other forms keep an empty cell. The map is replaced after every form, so
 * the overview can show the counts while the remaining ones are still loading.
 *
 * @param {object} host - The ManageForms element.
 * @returns {Promise<void>}
 */
export function loadFormsSubmissionCounts(host) {
    if (host.loadSubmissionCountsPromise) return host.loadSubmissionCountsPromise;

    // Forms whose count was already requested in the running load
    const requestedFormIds = new Set();
    // Returns the next listed form that still needs to be counted. The list is read
    // again every time, so forms added while loading are counted as well.
    const getNextFormId = () =>
        (host.allForms ?? [])
            .map((form) => form.formId)
            .find(
                (formId) =>
                    !requestedFormIds.has(formId) &&
                    mayReadAllFormSubmissions(host.forms.get(formId)),
            );

    host.loadSubmissionCountsPromise = (async () => {
        const worker = async () => {
            let formId;
            while ((formId = getNextFormId()) !== undefined) {
                requestedFormIds.add(formId);
                try {
                    const count = await apiGetSubmittedSubmissionsCount(host, formId);
                    host.formsSubmissionCounts = new Map(host.formsSubmissionCounts).set(
                        formId,
                        count,
                    );
                } catch (e) {
                    console.error(`Error counting the submissions of form ${formId}:`, e);
                }
            }
        };

        try {
            await Promise.all(Array.from({length: SUBMISSION_COUNT_CONCURRENCY}, worker));
        } finally {
            host.loadSubmissionCountsPromise = null;
        }
    })();

    return host.loadSubmissionCountsPromise;
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

/**
 * Fetch all submissions for a form, separate by state, and prepare table data.
 *
 * @param {object} host - The ManageForms element.
 * @param {string} formId - Form identifier.
 * @returns {Promise<Response|undefined>}
 */
export async function getAllFormSubmissions(host, formId) {
    // The host is the form submissions component, `host.form` is the form being shown.
    const i18n = host._i18n;
    let response;
    let data;
    host.rawSubmissions = [];
    host.submittedFileDetails = {draft: new Map(), submitted: new Map()};
    host.submissionsHasAttachment = {draft: false, submitted: false};

    const options = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/ld+json',
            Authorization: 'Bearer ' + host.auth.token,
        },
    };

    try {
        response = await fetch(
            host.entryPointUrl +
                '/formalize/submissions?formIdentifier=' +
                formId +
                '&perPage=9999',
            options,
        );
        data = await response.json();
        // Follow API pagination so all readable submissions are included.
        let next = data['hydra:view']?.['hydra:next'];
        while (next) {
            const pageResponse = await fetch(new URL(next, host.entryPointUrl).href, options);
            if (!pageResponse.ok)
                throw new Error(`Failed to load submissions: ${pageResponse.status}`);
            const page = await pageResponse.json();
            data['hydra:member'].push(...page['hydra:member']);
            next = page['hydra:view']?.['hydra:next'];
        }
    } catch (e) {
        host.sendErrorAnalyticsEvent('getAllSubmissions', 'WrongResponse', e);
        throwSomethingWentWrongNotification(host);
        throw e;
    }

    host.rawSubmissions = data['hydra:member'];
    host.submissionsGrantedActions = new Map();

    host.rawSubmissions.forEach((submission) => {
        host.submissionsGrantedActions.set(submission.identifier, submission.grantedActions);
    });

    if (data['hydra:member'].length === 0) {
        host.noSubmissionAvailable = {draft: true, submitted: true};
        return response;
    }

    // Separate submissions by their state
    const submissions = {};
    submissions.submitted = data['hydra:member'].filter(
        (s) => s.submissionState === SUBMISSION_STATES_BINARY.SUBMITTED,
    );
    submissions.draft = data['hydra:member'].filter(
        (s) => s.submissionState === SUBMISSION_STATES_BINARY.DRAFT,
    );

    for (const state of Object.keys(host.submissions)) {
        if (submissions[state].length === 0) {
            host.noSubmissionAvailable = {...host.noSubmissionAvailable, [state]: true};
            continue;
        } else {
            host.noSubmissionAvailable = {...host.noSubmissionAvailable, [state]: false};
        }

        let submissions_list = [];
        const activeForm = host.form;
        const enumTranslations = activeForm?.moduleInstance?.getEnumTranslations
            ? activeForm.moduleInstance.getEnumTranslations(host.lang)
            : {};
        const commonTranslations = enumTranslations._common || {};

        for (let [x, submission] of submissions[state].entries()) {
            let dateCreated = humanReadableDate(submission['dateCreated']);
            let dataFeedElement = JSON.parse(submission['dataFeedElement']);
            let submissionId = submission['identifier'];
            const submissionTags = submission['tags'] || [];
            const submittedFiles = submission['submittedFiles'] || [];
            host.submittedFileDetails[state].set(submissionId, submittedFiles);
            if (submittedFiles.length > 0) {
                host.submissionsHasAttachment[state] = true;
            }

            // Group submitted file names by their attribute name so tabulator
            // can display them in the corresponding form_files-* columns.
            const fileFieldData = {};
            for (const file of submittedFiles) {
                const fieldName = `form_files-${file.fileAttributeName}`;
                if (fileFieldData[fieldName] === undefined) {
                    fileFieldData[fieldName] = [];
                }
                fileFieldData[fieldName].push(file.fileName);
            }
            for (const fieldName of Object.keys(fileFieldData)) {
                fileFieldData[fieldName] = fileFieldData[fieldName].join(', ');
            }

            // Flatten array values, resolve user identifiers
            for (const [key, value] of Object.entries(dataFeedElement)) {
                if (Array.isArray(value)) {
                    dataFeedElement[key] = value.join(', ');
                }
                if (key === 'identifier' && value) {
                    if (!host.userNameCache.has(value)) {
                        try {
                            const resp = await host.apiGetUserDetails(value);
                            const userObject = await resp.json();
                            const fullName = `${userObject['givenName']} ${userObject['familyName']}`;
                            dataFeedElement[key] = fullName;
                            host.userNameCache.set(value, fullName);
                        } catch (e) {
                            console.error(e);
                            dataFeedElement[key] = value;
                        }
                    } else {
                        dataFeedElement[key] = host.userNameCache.get(value);
                    }
                }
            }

            // Translate enum keys to human-readable labels
            for (const [key, value] of Object.entries(dataFeedElement)) {
                if (typeof value !== 'string') continue;
                const fieldMap = enumTranslations[key] || commonTranslations;
                if (!fieldMap || Object.keys(fieldMap).length === 0) continue;
                dataFeedElement[key] = value
                    .split(', ')
                    .map((v) => fieldMap[v.trim()] || v.trim())
                    .join(', ');
            }

            const id = x + 1;
            let cols = {
                dateCreated: dateCreated,
                tags: Array.isArray(submissionTags)
                    ? submissionTags.map((tag) => `<span class="tag">${xss(tag)}</span>`).join(' ')
                    : '',
                ...dataFeedElement,
                ...fileFieldData,
                submissionId: submissionId,
            };

            const actionButtonsDiv = host.createScopedElement('div');
            const submissionGrants = host.submissionsGrantedActions.get(submissionId) ?? [];
            const hasSubmissionGrant = (...permissions) =>
                permissions.some((permission) => submissionGrants.includes(permission));
            const hasReadOnlyMode =
                !!activeForm.formSlug &&
                typeof activeForm.moduleInstance?.hasReadOnlyMode === 'function' &&
                activeForm.moduleInstance.hasReadOnlyMode();
            const rowActions = [
                {
                    value: 'quick-view',
                    label: i18n.t('manage-forms.open-quick-view'),
                    iconName: 'keyword-research',
                    handler: () => {
                        const routingData = host.getRoutingData();
                        const routeFormId = routingData.pathSegments[0];
                        if (routeFormId.match(/[0-9a-f-]+/)) {
                            host.setSubmissionDetailsRoute(submissionId);
                            host.requestDetailedSubmission(state, cols, id);
                        }
                    },
                },
            ];

            // Link to the submission in the read-only render form view
            if (hasReadOnlyMode) {
                const formSubmissionUrl = new URL(
                    getFormRenderUrl(activeForm.formSlug, host.lang, activeForm.formId),
                );
                formSubmissionUrl.pathname += `/${submissionId}/readonly`;
                rowActions.push({
                    value: 'detailed-view',
                    label: i18n.t('manage-forms.open-detailed-view'),
                    iconName: 'open-new-window',
                    handler: () => {
                        window.open(formSubmissionUrl.href, '_blank', 'noopener,noreferrer');
                    },
                });
            }

            if (
                hasReadOnlyMode &&
                hasSubmissionGrant(SUBMISSION_PERMISSIONS.MANAGE, SUBMISSION_PERMISSIONS.UPDATE)
            ) {
                rowActions.push({
                    value: 'edit-submission',
                    label: i18n.t('manage-forms.edit-submission-button-text'),
                    iconName: 'pencil',
                    handler: (event) => host.handleEditSubmissions(event, state, submissionId),
                });
            }

            if (
                host.enableSubmissionPermissionEditing &&
                hasSubmissionGrant(SUBMISSION_PERMISSIONS.MANAGE)
            ) {
                rowActions.push({
                    value: 'edit-permission',
                    label: i18n.t('manage-forms.edit-permission-button-text'),
                    iconName: 'edit-permission',
                    handler: () => host.handleEditSubmissionsPermission(state, [submissionId]),
                });
            }

            if (hasSubmissionGrant(SUBMISSION_PERMISSIONS.MANAGE, SUBMISSION_PERMISSIONS.DELETE)) {
                rowActions.push({
                    value: 'delete',
                    label: i18n.t('manage-forms.delete'),
                    iconName: 'trash',
                    handler: () => void host.handleDeleteSubmissions(state, true, [submissionId]),
                });
            }

            actionButtonsDiv.appendChild(
                createRowActionsMenu(
                    host,
                    i18n.t('manage-forms.submission-row-actions-aria', {id}),
                    rowActions,
                ),
            );
            actionButtonsDiv.classList.add('actions-buttons');
            cols.htmlButtons = actionButtonsDiv;
            submissions_list.push(cols);
        }

        // Remove attachment column if all empty
        const noAttachments = submissions_list.every((submission) => submission.attachments === '');
        submissions_list = noAttachments
            ? submissions_list.map(({attachments, ...rest}) => rest)
            : submissions_list;

        host.submissions = {...host.submissions, [state]: submissions_list};

        host.options_submissions[state].autoColumnsDefinitions = (definitions) => {
            definitions.forEach((columnDefinition) => {
                if (columnDefinition.field === 'submissionId') {
                    columnDefinition.visible = true;
                    columnDefinition.title = host._i18n.t('manage-forms.submission-id');
                }
                if (columnDefinition.field === 'dateCreated') {
                    columnDefinition.visible = true;
                    columnDefinition.title = host.lang === 'de' ? 'Erstellt am' : 'Date created';
                }
                if (columnDefinition.field === 'tags') {
                    columnDefinition.formatter = 'html';
                }
                if (columnDefinition.field === 'htmlButtons') {
                    columnDefinition.title = '';
                    columnDefinition.formatter = 'html';
                    columnDefinition.hozAlign = 'right';
                    columnDefinition.vertAlign = 'middle';
                    columnDefinition.headerSort = false;
                    columnDefinition.minWidth = 64;
                    columnDefinition.frozen = true;
                    columnDefinition.headerHozAlign = 'right';
                    columnDefinition.download = false;
                } else {
                    columnDefinition.sorter = 'string';
                }
                if (columnDefinition.field.includes('date')) {
                    columnDefinition.sorter = (a, b) => {
                        return dateToTimestamp(a) - dateToTimestamp(b);
                    };
                }
            });
            return [
                {
                    title: 'ID',
                    formatter: function (cell) {
                        const row = cell.getRow();
                        const table = row.getTable();
                        const page = table.getPage();
                        const pageSize = table.getPageSize();
                        const position = row.getPosition(true);
                        return (page - 1) * pageSize + position;
                    },
                    field: 'rowIndex',
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    headerSort: false,
                    frozen: true,
                    width: 30,
                    download: false,
                },
                ...definitions,
            ];
        };

        host.options_submissions[state].data = host.submissions[state];
        host.totalNumberOfItems[state] = submissions_list.length;
    }
    return response;
}

// ---------------------------------------------------------------------------
// Submission mutations
// ---------------------------------------------------------------------------

/**
 * Delete a single submission.
 *
 * @param {object} host
 * @param {string} submissionId
 * @returns {Promise<boolean>}
 */
export async function apiDeleteSubmission(host, submissionId) {
    if (!submissionId) {
        sendNotification({
            summary: host._i18n.t('errors.error-title'),
            body: host._i18n.t('errors.no-submission-id-provided'),
            type: 'danger',
            timeout: 0,
        });
        return false;
    }

    try {
        const response = await fetch(
            host.entryPointUrl + `/formalize/submissions/${submissionId}`,
            {
                method: 'DELETE',
                headers: {
                    Authorization: 'Bearer ' + host.auth.token,
                },
            },
        );

        if (!response.ok) {
            console.warn(`Failed to delete submission. Response status: ${response.status}`);
            return false;
        }
        return true;
    } catch (error) {
        console.error(error.message);
        return false;
    }
}

/**
 * Update tags on a submission via PATCH.
 *
 * @param {object} host
 * @param {string} submissionId
 * @param {string[]} finalTags
 * @returns {Promise<boolean>}
 */
export async function apiUpdateSubmissionTags(host, submissionId, finalTags) {
    if (!submissionId || !host.activeFormId) {
        sendNotification({
            summary: host._i18n.t('errors.error-title'),
            body: host._i18n.t('errors.no-submission-id-provided'),
            type: 'danger',
            timeout: 0,
        });
        return false;
    }

    const formData = new FormData();
    formData.append('form', '/formalize/forms/' + host.activeFormId);
    formData.append('tags', JSON.stringify(finalTags));

    const options = {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${host.auth.token}`,
        },
        body: formData,
    };
    const url = host.entryPointUrl + '/formalize/submissions/' + submissionId;

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            console.warn(`Failed to update submission tags. Response status: ${response.status}`);
            const errorData = await response.json().catch(() => ({}));
            console.warn('Error details:', errorData);
            return false;
        }
        return true;
    } catch (error) {
        console.error(error.message);
        return false;
    }
}

/**
 * Get available tags for a form.
 *
 * @param {object} host
 * @param {string} identifier - form identifier
 */
export async function apiGetTags(host, identifier) {
    if (host.auth.token === '') {
        host.availableTags = [];
        return;
    }

    let response;
    let data = [];

    const options = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/ld+json',
            Authorization: 'Bearer ' + host.auth.token,
        },
    };

    try {
        response = await fetch(host.entryPointUrl + '/formalize/forms/' + identifier, options);

        if (!response.ok) {
            host.availableTags = [];
        }

        data = await response.json();
    } catch (e) {
        host.sendErrorAnalyticsEvent('checkPermissionsToForm', 'WrongResponse', e);
        console.error(e);
        host.availableTags = [];
    }

    if (data.error) {
        console.error('checkPermissionsToForm data.error', data.error);
        host.availableTags = [];
    }

    if (data['@type'] === 'hydra:Error') {
        console.error('checkPermissionsToForm hydra:Error', data.detail);
        host.availableTags = [];
    }

    host.availableTags = data.availableTags || [];
}

// ---------------------------------------------------------------------------
// Helpers (re-exported for use by other modules)
// ---------------------------------------------------------------------------

/**
 * Create a new form via POST /formalize/forms.
 *
 * @param {object} host - The ManageForms element (needs host.auth, host.entryPointUrl, host._i18n).
 * @param {object} formData - The form payload.
 * @param {string} formData.name - Default name of the form.
 * @param {Array<{languageTag: string, name: string}>} formData.localizedNames - Localized names.
 * @param {string} formData.frontendKey - Frontend key for filtering (e.g. 'job-offer').
 * @param {object} [formData.additionalData] - Free-form metadata stored as the form's additionalData field.
 * @param {string} [formData.dataFeedSchema] - JSON Schema for validating submissions.
 * @param {boolean} [formData.grantBasedSubmissionAuthorization] - Whether submissions use resource grants.
 * @param {string[]} [formData.allowedActionsWhenSubmitted] - Actions granted to the submitter after submission.
 * @param {object} [options] - Notification options.
 * @param {string} [options.errorNotificationTargetId] - Notification component for errors.
 * @returns {Promise<object|null>} The created form object from the API, or null on failure.
 */
export async function apiCreateForm(host, formData, options = {}) {
    const i18n = host._i18n;

    const body = {
        name: formData.name,
        localizedNames: formData.localizedNames,
        frontendKey: formData.frontendKey,
    };

    // Store additional metadata as a nested additionalData field on the form
    if (formData.additionalData) {
        body.additionalData = formData.additionalData;
    }

    // Store the JSON Schema for validating submission data
    if (formData.dataFeedSchema) {
        body.dataFeedSchema = formData.dataFeedSchema;
    }

    if (typeof formData.grantBasedSubmissionAuthorization === 'boolean') {
        body.grantBasedSubmissionAuthorization = formData.grantBasedSubmissionAuthorization;
    }

    if (Array.isArray(formData.allowedActionsWhenSubmitted)) {
        body.allowedActionsWhenSubmitted = formData.allowedActionsWhenSubmitted;
    }

    try {
        const response = await fetch(host.entryPointUrl + '/formalize/forms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + host.auth.token,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Failed to create form:', response.status, errorData);
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t('create-form.error-create-failed', {status: response.status}),
                type: 'danger',
                timeout: 0,
                targetNotificationId: options.errorNotificationTargetId,
            });
            return null;
        }

        const createdForm = await response.json();
        sendNotification({
            summary: i18n.t('success.success-title'),
            body: i18n.t('create-form.success-created'),
            type: 'success',
            timeout: 5,
        });
        return createdForm;
    } catch (error) {
        console.error('Error creating form:', error);
        sendNotification({
            summary: i18n.t('errors.error-title'),
            body: error.message,
            type: 'danger',
            timeout: 0,
            targetNotificationId: options.errorNotificationTargetId,
        });
        return null;
    }
}

/**
 * Update an existing form via PATCH /formalize/forms/{identifier}.
 *
 * @param {object} host - The ManageForms element (needs host.auth, host.entryPointUrl, host._i18n).
 * @param {string} formIdentifier - The identifier of the form to update.
 * @param {object} formData - The form payload (same shape as apiCreateForm).
 * @param {string} formData.name - Default name of the form.
 * @param {Array<{languageTag: string, name: string}>} formData.localizedNames - Localized names.
 * @param {object} [formData.additionalData] - Free-form metadata stored as the form's additionalData field.
 * @param {string} [formData.dataFeedSchema] - JSON Schema for validating submissions.
 * @param {boolean} [formData.grantBasedSubmissionAuthorization] - Whether submissions use resource grants.
 * @param {string[]} [formData.allowedActionsWhenSubmitted] - Actions granted to the submitter after submission.
 * @param {object} [options] - Notification options.
 * @param {string} [options.errorNotificationTargetId] - Notification component for errors.
 * @returns {Promise<object|null>} The updated form object from the API, or null on failure.
 */
export async function apiUpdateForm(host, formIdentifier, formData, options = {}) {
    const i18n = host._i18n;

    const body = {
        name: formData.name,
        localizedNames: formData.localizedNames,
    };

    if (formData.additionalData) {
        body.additionalData = formData.additionalData;
    }

    if (formData.dataFeedSchema) {
        body.dataFeedSchema = formData.dataFeedSchema;
    }

    if (typeof formData.grantBasedSubmissionAuthorization === 'boolean') {
        body.grantBasedSubmissionAuthorization = formData.grantBasedSubmissionAuthorization;
    }

    if (Array.isArray(formData.allowedActionsWhenSubmitted)) {
        body.allowedActionsWhenSubmitted = formData.allowedActionsWhenSubmitted;
    }

    try {
        const response = await fetch(host.entryPointUrl + '/formalize/forms/' + formIdentifier, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/merge-patch+json',
                Authorization: 'Bearer ' + host.auth.token,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Failed to update form:', response.status, errorData);
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t('edit-form.error-update-failed', {status: response.status}),
                type: 'danger',
                timeout: 0,
                targetNotificationId: options.errorNotificationTargetId,
            });
            return null;
        }

        const updatedForm = await response.json();
        sendNotification({
            summary: i18n.t('success.success-title'),
            body: i18n.t('edit-form.success-updated'),
            type: 'success',
            timeout: 5,
        });
        return updatedForm;
    } catch (error) {
        console.error('Error updating form:', error);
        sendNotification({
            summary: i18n.t('errors.error-title'),
            body: error.message,
            type: 'danger',
            timeout: 0,
            targetNotificationId: options.errorNotificationTargetId,
        });
        return null;
    }
}

/**
 * Delete a single form via DELETE /formalize/forms/{identifier}.
 *
 * @param {object} host - The ManageForms element (needs host.auth, host.entryPointUrl, host._i18n).
 * @param {string} formIdentifier - The identifier of the form to delete.
 * @returns {Promise<boolean>} true on success, false on failure.
 */
export async function apiDeleteForm(host, formIdentifier) {
    if (!formIdentifier) {
        sendNotification({
            summary: host._i18n.t('errors.error-title'),
            body: host._i18n.t('errors.no-form-id-provided'),
            type: 'danger',
            timeout: 0,
        });
        return false;
    }

    try {
        const response = await fetch(host.entryPointUrl + '/formalize/forms/' + formIdentifier, {
            method: 'DELETE',
            headers: {
                Authorization: 'Bearer ' + host.auth.token,
            },
        });

        if (!response.ok) {
            console.warn(`Failed to delete form. Response status: ${response.status}`);
            return false;
        }
        return true;
    } catch (error) {
        console.error(error.message);
        return false;
    }
}

/**
 * Convert date string to a Unix timestamp (seconds).
 * @param {string} dateInput
 * @returns {number}
 */
export function dateToTimestamp(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d)) throw new Error('Invalid date');
    return Math.floor(d.getTime() / 1000);
}

/**
 * Send success/failure notifications for a batch of operations.
 * @param {object} host
 * @param {boolean[]} responseStatus
 * @param {object} [messageKeys] Optional overrides for the notification body
 *   translation keys so callers can tailor the wording (e.g. forms vs.
 *   submissions). Defaults to the submission wording.
 * @param {string} [messageKeys.successKey]
 * @param {string} [messageKeys.failureKey]
 */
export function successFailureNotification(host, responseStatus, messageKeys = {}) {
    const successKey = messageKeys.successKey || 'success.submissions-processed';
    const failureKey = messageKeys.failureKey || 'errors.submissions-processing-failed';

    const successCount = responseStatus.filter((status) => status === true).length;
    if (successCount > 0) {
        sendNotification({
            summary: host._i18n.t('success.success-title'),
            body: host._i18n.t(successKey, {count: successCount}),
            type: 'success',
            timeout: 5,
        });
    }

    const errorCount = responseStatus.filter((status) => status === false).length;
    if (errorCount > 0) {
        sendNotification({
            summary: host._i18n.t('errors.error-title'),
            body: host._i18n.t(failureKey, {count: errorCount}),
            type: 'danger',
            timeout: 0,
        });
    }
}
