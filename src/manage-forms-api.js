// @ts-nocheck
/**
 * API helpers for the Manage Forms activity.
 *
 * Every function receives the calling element (`host`) as its first argument so
 * it can access `host.auth`, `host.entryPointUrl`, `host._i18n`, etc.
 * This keeps the functions stateless and easy to test.
 */

import {sendNotification} from '@dbp-toolkit/common';
import {getFormRenderUrl, SUBMISSION_STATES_BINARY, addDetailsToUrl} from './utils.js';
import metadata from './dbp-formalize-manage-forms.metadata.json';
import xss from 'xss';

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
export async function loadModules(host) {
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
 * Fetch the list of all forms and populate `host.allForms`.
 *
 * Forms are filtered by `host.allowListFrontendKeys` and `host.denyListFrontendKeys`,
 * which contain `frontendKey` values. A single frontendKey may match multiple
 * forms, so one entry in the list can show a whole group of forms.
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

        const response = await fetch(host.entryPointUrl + '/formalize/forms' + '?perPage=9999', {
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

            let id = 0;
            for (let x = 0; x < data['hydra:member'].length; x++) {
                const entry = data['hydra:member'][x];
                let localizedFormName = entry['localizedNames'].find((localizedName) => {
                    return localizedName.languageTag === host.lang;
                });
                const formName = localizedFormName ? localizedFormName.name : entry['name'];
                const formId = entry['identifier'];
                const frontendKey = entry['frontendKey'] ?? null;

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
                });

                // Build the action button container (view submissions + optional edit button)
                const formEntry = host.forms.get(formId);
                const actionContainer = document.createElement('span');
                actionContainer.style.cssText =
                    'display: inline-flex; gap: 0.5rem; align-items: center;';

                let btn = host.createScopedElement('dbp-formalize-get-details-button');
                btn.setAttribute('subscribe', 'lang');
                btn.title = i18n.t('manage-forms.open-forms');
                btn.ariaLabel = i18n.t('manage-forms.open-forms');
                btn.addEventListener('click', async () => {
                    host.loadingSubmissionTables = true;
                    // Let the router handle the history entry via sendSetPropertyEvent.
                    // A manual pushState here would create a duplicate history entry,
                    // requiring the user to press the back button twice.
                    host.sendSetPropertyEvent('routing-url', `/${formId}`, true);
                });
                actionContainer.appendChild(btn);

                // Show an edit button only for forms whose module implements getEditFormComponent()
                if (
                    formEntry.moduleInstance &&
                    typeof formEntry.moduleInstance.getEditFormComponent === 'function'
                ) {
                    let editBtn = host.createScopedElement('dbp-icon-button');
                    editBtn.setAttribute('subscribe', 'lang');
                    editBtn.setAttribute('icon-name', 'pencil');
                    editBtn.title = i18n.t('manage-forms.edit-form-button');
                    editBtn.setAttribute('aria-label', i18n.t('manage-forms.edit-form-button'));
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        host.handleOpenEditFormDialog(formId);
                    });
                    actionContainer.appendChild(editBtn);
                }

                // Store the granted actions for this form so the overview can gate bulk deletion.
                const grantedActions = entry['grantedActions'] ?? [];
                if (host.formsGrantedActions instanceof Map) {
                    host.formsGrantedActions.set(formId, grantedActions);
                }

                let new_form = {
                    id: id,
                    name: formName,
                    formId: formId,
                    grantedActions: grantedActions,
                    actionButton: actionContainer,
                };
                forms.push(new_form);
            }

            // Avoid replacing allForms when the set of forms hasn't changed.
            // A token refresh can cause this function to be re-invoked even
            // though the API returns the same data.  Skipping the assignment
            // prevents the Lit reactive cycle from re-triggering
            // updated('allForms'), which would rebuild/reset the tabulator
            // tables, show a loading spinner, and disrupt the user.
            const prevIds = (host.allForms || []).map((f) => f.name).join('\0');
            const nextIds = forms.map((f) => f.name).join('\0');
            if (prevIds === nextIds && host.allForms.length > 0) {
                // Forms unchanged — just make sure the loading spinner is hidden.
                host.loadingFormsTable = false;
                return;
            }

            host.allForms = forms;
            host.options_forms.data = host.allForms;
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
        response = await host.httpGetAsync(
            host.entryPointUrl +
                '/formalize/submissions?formIdentifier=' +
                formId +
                '&perPage=9999',
            options,
        );
        data = await response.json();
    } catch (e) {
        host.sendErrorAnalyticsEvent('getAllSubmissions', 'WrongResponse', e);
        throwSomethingWentWrongNotification(host);
        return Promise.reject(e);
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
        const activeForm = host.forms.get(formId);
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

            let actionButtonsDiv = host.createScopedElement('div');

            // Add link to manage form entry in render form view (only for forms with a slug and read-only mode)
            if (
                activeForm.formSlug &&
                activeForm.moduleInstance &&
                typeof activeForm.moduleInstance.hasReadOnlyMode === 'function' &&
                activeForm.moduleInstance.hasReadOnlyMode()
            ) {
                const submissionDetailsFormButton = host.createScopedElement(
                    'dbp-formalize-get-submission-link',
                );
                let formSubmissionUrl =
                    getFormRenderUrl(activeForm.formSlug, host.lang) + `/${submissionId}/readonly`;
                /*
                    t('manage-forms.open-detailed-view-form')
                */
                submissionDetailsFormButton.ariaLabel = 'manage-forms.open-detailed-view-form';
                submissionDetailsFormButton.submissionUrl = formSubmissionUrl;
                submissionDetailsFormButton.iconName = 'open-new-window';
                submissionDetailsFormButton.title = 'manage-forms.open-detailed-view-form';
                submissionDetailsFormButton.id = id.toString();
                submissionDetailsFormButton.setAttribute('subscribe', 'lang');
                submissionDetailsFormButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                });
                actionButtonsDiv.appendChild(submissionDetailsFormButton);
            }

            // Add button to show submission details in a modal
            const submissionDetailsButton = host.createScopedElement(
                'dbp-formalize-get-details-button',
            );
            /*
                t('manage-forms.open-detailed-view-modal')
            */
            submissionDetailsButton.ariaLabel = 'manage-forms.open-detailed-view-modal';
            submissionDetailsButton.title = 'manage-forms.open-detailed-view-modal';
            submissionDetailsButton.id = id.toString();
            submissionDetailsButton.setAttribute('subscribe', 'lang');
            submissionDetailsButton.addEventListener('click', (event) => {
                event.stopPropagation();
                const routingData = host.getRoutingData();
                const routeFormId = routingData.pathSegments[0];
                if (routeFormId.match(/[0-9a-f-]+/)) {
                    addDetailsToUrl(submissionId, metadata['routing_name']);
                    host.requestDetailedSubmission(state, cols, id);
                }
            });

            actionButtonsDiv.appendChild(submissionDetailsButton);
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
                }
                if (columnDefinition.field === 'dateCreated') {
                    columnDefinition.visible = true;
                    columnDefinition.title = host.lang === 'de' ? 'Erstellt am' : 'Date created';
                }
                if (columnDefinition.field === 'tags') {
                    columnDefinition.formatter = 'html';
                }
                if (columnDefinition.field === 'htmlButtons') {
                    columnDefinition.formatter = 'html';
                    columnDefinition.hozAlign = 'right';
                    columnDefinition.vertAlign = 'middle';
                    columnDefinition.headerSort = false;
                    columnDefinition.minWidth = 64;
                    columnDefinition.frozen = true;
                    columnDefinition.headerHozAlign = 'right';
                    columnDefinition.download = false;
                    columnDefinition.titleFormatter = () => {
                        let columnSettingsButton = host.createScopedElement(
                            'dbp-formalize-column-settings-button',
                        );
                        columnSettingsButton.setAttribute('subscribe', 'lang');
                        columnSettingsButton.addEventListener('click', () => {
                            host.getSubmissionsPage()?.openColumnOptionsModal(state);
                        });
                        return columnSettingsButton;
                    };
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
        response = await host.httpGetAsync(
            host.entryPointUrl + '/formalize/forms/' + identifier,
            options,
        );

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
 * @returns {Promise<object|null>} The created form object from the API, or null on failure.
 */
export async function apiCreateForm(host, formData) {
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
 * @returns {Promise<object|null>} The updated form object from the API, or null on failure.
 */
export async function apiUpdateForm(host, formIdentifier, formData) {
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
 */
export function successFailureNotification(host, responseStatus) {
    const successCount = responseStatus.filter((status) => status === true).length;
    if (successCount > 0) {
        sendNotification({
            summary: host._i18n.t('success.success-title'),
            body: host._i18n.t('success.submissions-processed', {count: successCount}),
            type: 'success',
            timeout: 5,
        });
    }

    const errorCount = responseStatus.filter((status) => status === false).length;
    if (errorCount > 0) {
        sendNotification({
            summary: host._i18n.t('errors.error-title'),
            body: host._i18n.t('errors.submissions-processing-failed', {count: errorCount}),
            type: 'danger',
            timeout: 0,
        });
    }
}
