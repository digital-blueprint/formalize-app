// @ts-nocheck
import {html} from 'lit';
import {ScopedElementsMixin, sendNotification} from '@dbp-toolkit/common';
import {setOverridesByGlobalCache} from '@dbp-toolkit/common/i18next.js';
import {FileSink} from '@dbp-toolkit/file-handling';
import {GrantPermissionDialog} from '@dbp-toolkit/grant-permission-dialog';
import xss from 'xss';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';
import {CustomTabulatorTable, GetDetailsButton, GetSubmissionLink} from './table-components.js';
import {ManageFormSubmissionsPage} from './manage-form-submissions-page.js';
import {ManageSubmissionModal} from './manage-submission-modal.js';
import {BatchTaggingModal} from './batch-tagging-modal.js';
import {DeletionConfirmationModal} from './deletion-confirmation-modal.js';
import {
    SUBMISSION_STATES,
    SUBMISSION_PERMISSIONS,
    getFormRenderUrl,
    isDraftStateEnabled,
    isSubmittedStateEnabled,
} from './utils.js';
import {
    getAllFormSubmissions,
    apiDeleteSubmission,
    apiUpdateSubmissionTags,
    apiGetTags,
    humanReadableDate,
    successFailureNotification,
} from './manage-forms-api.js';
import {
    setSubmissionFormOptions,
    setDefaultSubmissionTableOrder,
    enableCheckboxSelection,
    disableCheckboxSelection,
    enablePagination,
    disablePagination,
} from './manage-forms-table-config.js';
import {
    buildRoutingUrlWithQuery,
    dispatchRoutingUrlChange,
    getQueryString,
    getUrlPaginationSize,
    getUrlPaginationValue,
} from './manage-forms-routing.js';
import {getManageFormsActivityStyles} from './manage-forms-activity-styles.js';

/**
 * Statically reference translation keys that are only resolved dynamically
 * (default keys of successFailureNotification). Without this, the i18next
 * extractor would treat them as unused and prune them.
 *
 * @param {(key: string, options?: object) => string} t
 */
const keepDynamicTranslations = (t) => {
    t('success.submissions-processed', {count: 0});
    t('errors.submissions-processing-failed', {count: 0});
};

const UUID_PATTERN = /[\w\d]{8}-[\w\d]{4}-[\w\d]{4}-[\w\d]{4}-[\w\d]{12}/;

/**
 * Shows the draft and submitted submissions of a single form.
 *
 * Provides searching, filtering, exporting, deleting, tagging and permission
 * editing of submissions, plus the submission details modal. Search, pagination
 * and the opened submission are kept in the routing URL of the surrounding activity:
 * `/<formId>[/details/<submissionId>]?<state>-search=...&<state>-page=...`.
 *
 * Routing URL changes are requested with a `dbp-formalize-routing-url-change` event,
 * the "back" button dispatches a `back-to-overview` event.
 */
export class FormSubmissions extends ScopedElementsMixin(DBPFormalizeLitElement) {
    constructor() {
        super();
        /** @type {object|null} The form entry ({formId, formName, formSlug, moduleInstance, ...}) */
        this.form = null;
        this.hideCreateSubmissionButton = false;
        this.enableSubmissionPermissionEditing = false;
        this.paginationSizeStorageKey = '';
        this.boundCloseActionsDropdownHandler = this.closeActionsDropdown.bind(this);
        this._overridesReady = null;

        this.rawSubmissions = [];
        this.submissionsGrantedActions = new Map();
        this.submissions = {draft: [], submitted: []};
        this.selectedRowCount = {draft: 0, submitted: 0};
        this.allRowCount = {draft: 0, submitted: 0};
        this.visibleRowCount = {draft: 0, submitted: 0};
        this.searchIsActive = {draft: false, submitted: false};
        this.options_submissions = {draft: {}, submitted: {}};
        this.submissionsColumnsInitial = {draft: [], submitted: []};
        this.currentBeautyId = 0;
        this.totalNumberOfItems = {draft: 0, submitted: 0};
        this.isPrevEnabled = false;
        this.isNextEnabled = false;
        this.storeSession = true;
        this.loadingSubmissionTables = false;
        this.showSubmissionTables = false;
        this.noSubmissionAvailable = {draft: true, submitted: true};
        this.hiddenColumns = false;
        this.currentDetailPosition = 0;
        this.submissionTables = {submitted: null, draft: null};
        this.submissionsHasAttachment = {draft: false, submitted: false};
        this.submittedFileDetails = {draft: new Map(), submitted: new Map()};
        this.isDeleteSelectedSubmissionEnabled = {draft: false, submitted: false};
        this.isDeleteAllSubmissionEnabled = {draft: false, submitted: false};
        this.isEditSubmissionEnabled = {draft: false, submitted: false};
        this.isEditSubmissionPermissionEnabled = {draft: false, submitted: false};
        this.isBatchTaggingEnabled = {draft: false, submitted: false};
        this.enabledStates = {draft: false, submitted: false};
        this.searchWidgetIsOpen = {draft: false, submitted: false};
        this.actionsWidgetIsOpen = {draft: false, submitted: false};
        this.isActionAvailable = {draft: false, submitted: false};
        this.needTableRebuild = {draft: false, submitted: false};
        this.createSubmissionUrl = '';
        this.useSubFoldersForExports = true;
        this.downloadFolderNamePattern = '';
        this.userNameCache = new Map();
        this.isRequestDetailedView = false;
        this.submissionIdToOpen = null;
        this.submissionIdsForTagging = [];
        this.currentStateForBatchTagging = null;
        this.availableTags = [];
        // Guard: prevents updated('submissions') from rebuilding tables while
        // loadSubmissions() is in progress.
        this._isSwitchingTable = false;
        // Counter: incremented on each loadSubmissions() call so that a
        // stale .then() callback from an earlier call is discarded.
        this._switchGeneration = 0;
        this._restoringUrlStateTables = new Set();
        this._urlStateReadyTables = new Set();
    }

    static get scopedElements() {
        return {
            'dbp-tabulator-table': CustomTabulatorTable,
            'dbp-grant-permission-dialog': GrantPermissionDialog,
            'dbp-file-sink': FileSink,
            'dbp-formalize-get-details-button': GetDetailsButton,
            'dbp-formalize-get-submission-link': GetSubmissionLink,
            'dbp-formalize-manage-form-submissions-page': ManageFormSubmissionsPage,
            'dbp-formalize-manage-submission-modal': ManageSubmissionModal,
            'dbp-formalize-batch-tagging-modal': BatchTaggingModal,
            'dbp-formalize-deletion-confirmation-modal': DeletionConfirmationModal,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            form: {type: Object, attribute: false},
            hideCreateSubmissionButton: {type: Boolean, attribute: 'hide-create-submission-button'},
            enableSubmissionPermissionEditing: {
                type: Boolean,
                attribute: 'enable-submission-permission-editing',
            },
            paginationSizeStorageKey: {type: String, attribute: false},

            submissions: {type: Object, attribute: false},
            showSubmissionTables: {type: Boolean, attribute: false},
            loadingSubmissionTables: {type: Boolean, attribute: false},
            isPrevEnabled: {type: Boolean, attribute: false},
            isNextEnabled: {type: Boolean, attribute: false},
            currentBeautyId: {type: Number, attribute: false},
            totalNumberOfItems: {type: Object, attribute: false},
            options_submissions: {type: Object, attribute: false},
            searchWidgetIsOpen: {type: Object, attribute: false},
            actionsWidgetIsOpen: {type: Object, attribute: false},
            isActionAvailable: {type: Object, attribute: false},
            noSubmissionAvailable: {type: Object, attribute: false},
            createSubmissionUrl: {type: String, attribute: false},
            enabledStates: {type: Object, attribute: false},
            isDeleteSelectedSubmissionEnabled: {type: Object, attribute: false},
            isDeleteAllSubmissionEnabled: {type: Object, attribute: false},
            isEditSubmissionEnabled: {type: Object, attribute: false},
            isEditSubmissionPermissionEnabled: {type: Object, attribute: false},
            isBatchTaggingEnabled: {type: Object, attribute: false},
            selectedRowCount: {type: Object, attribute: false},
            allRowCount: {type: Object, attribute: false},
            visibleRowCount: {type: Object, attribute: false},
            searchIsActive: {type: Object, attribute: false},
            submissionsHasAttachment: {type: Object, attribute: false},
        };
    }

    get activeFormId() {
        return this.form?.formId ?? '';
    }

    get activeFormName() {
        return this.form?.formName ?? '';
    }

    connectedCallback() {
        super.connectedCallback();

        // Build table options after overrides are loaded so that column
        // labels use the overridden text on the very first render.
        const initTableOptions = async () => {
            if (this.langDir) {
                await setOverridesByGlobalCache(this._i18n, this);
            }
            setSubmissionFormOptions(this, SUBMISSION_STATES.DRAFT);
            setSubmissionFormOptions(this, SUBMISSION_STATES.SUBMITTED);
        };
        this._overridesReady = initTableOptions();

        document.addEventListener('click', this.boundCloseActionsDropdownHandler);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('click', this.boundCloseActionsDropdownHandler);
    }

    getSubmissionsPage() {
        return this._('dbp-formalize-manage-form-submissions-page');
    }

    getSubmissionModal(state) {
        return this._(`#submission-modal-${state}`);
    }

    refreshTableReferences() {
        const submissionsPage = this.getSubmissionsPage();
        if (!submissionsPage) return;

        for (const state of Object.values(SUBMISSION_STATES)) {
            this.submissionTables[state] = /** @type {CustomTabulatorTable} */ (
                submissionsPage.getSubmissionTable(state)
            );
        }
    }

    getTableState(tableId) {
        for (const state of Object.keys(this.submissionTables)) {
            if (
                this.submissionTables[state] &&
                tableId === this.submissionTables[state].identifier
            ) {
                return state;
            }
        }
        return null;
    }

    getColumnConfigurationStorageKey(scope) {
        const userId = this.auth?.['user-id'];
        if (!this.storeSession || !this.isLoggedIn() || !userId) return '';
        return `formalize-${scope}-${userId}`;
    }

    willUpdate(changedProperties) {
        super.willUpdate(changedProperties);

        if (changedProperties.has('form')) {
            const allowedSubmissionStates = this.form?.allowedSubmissionStates;
            this.enabledStates = {
                draft: isDraftStateEnabled(allowedSubmissionStates),
                submitted: isSubmittedStateEnabled(allowedSubmissionStates),
            };
        }
    }

    async updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('form')) {
            const previousFormId = changedProperties.get('form')?.formId ?? '';
            if (!this.form) {
                this.resetSubmissions();
            } else if (this.form.formId !== previousFormId || !this.showSubmissionTables) {
                // Avoid rebuilding intact tables when only the form entry got refreshed.
                void this.loadSubmissions();
            }
        }

        const langChanged =
            (changedProperties.has('lang') && changedProperties.get('lang') !== undefined) ||
            (changedProperties.has('langDir') && changedProperties.get('langDir') !== undefined);
        if (langChanged) {
            if (this.langDir) {
                await setOverridesByGlobalCache(this._i18n, this);
            }
            setSubmissionFormOptions(this, SUBMISSION_STATES.DRAFT);
            setSubmissionFormOptions(this, SUBMISSION_STATES.SUBMITTED);

            // Re-create the submission links and labels in the new language
            if (this.form && !changedProperties.has('form')) {
                void this.loadSubmissions();
            }
        }

        if (changedProperties.has('enableSubmissionPermissionEditing')) {
            for (const state of Object.values(SUBMISSION_STATES)) {
                if (this.submissionTables[state]?.tabulatorTable) {
                    this.setIsActionAvailable(state);
                } else if (!this.enableSubmissionPermissionEditing) {
                    this.isEditSubmissionPermissionEnabled = {
                        ...this.isEditSubmissionPermissionEnabled,
                        [state]: false,
                    };
                }
            }
        }

        if (changedProperties.has('routingUrl')) {
            const oldUrl = changedProperties.get('routingUrl');
            if (
                oldUrl !== undefined &&
                this.showSubmissionTables &&
                getQueryString(oldUrl) !== getQueryString(this.routingUrl)
            ) {
                // Detail modal routes only change the path. Reapplying the current
                // filter would deselect the row that opened the modal.
                void this.restoreVisibleTableState();
            }
        }

        if (changedProperties.has('submissions') && !this._isSwitchingTable) {
            this.handleSubmissionsChanged();
        }
    }

    handleSubmissionsChanged() {
        this.refreshTableReferences();

        for (const state in this.submissions) {
            if (!this.submissionTables[state]) continue;

            if (this.submissions[state]?.length === 0) {
                this.noSubmissionAvailable = {...this.noSubmissionAvailable, [state]: true};
                disablePagination(this, state);
                if (this.submissionTables[state].tabulatorTable) {
                    this.submissionTables[state].tabulatorTable.destroy();
                    setSubmissionFormOptions(this, state);
                    // disableCheckboxSelection must be called after setSubmissionFormOptions
                    // because setSubmissionFormOptions creates a fresh options object,
                    // overwriting any prior headerVisible/rowHeader changes.
                    disableCheckboxSelection(this, state);
                    // Push the fresh empty options directly onto the component
                    // so buildTable() doesn't read stale cached options.data.
                    this.submissionTables[state].options = this.options_submissions[state];
                    this.submissionTables[state].data = [];
                    this.submissionTables[state].buildTable();
                }
            } else {
                this.noSubmissionAvailable = {...this.noSubmissionAvailable, [state]: false};
                enableCheckboxSelection(this, state);
                enablePagination(this, state);
            }

            if (this.needTableRebuild[state]) {
                this.submissionTables[state].buildTable();
                this.needTableRebuild[state] = false;
            }
        }
    }

    /**
     * Resets the component when no form is shown.
     */
    resetSubmissions() {
        // Invalidate any in-flight loadSubmissions() call
        this._switchGeneration++;
        this._isSwitchingTable = false;
        this.showSubmissionTables = false;
        this.loadingSubmissionTables = false;
        this.isRequestDetailedView = false;
        this.closeAllSearchWidgets();
    }

    /**
     * Loads the submissions of the current form and (re)builds the tables.
     */
    async loadSubmissions() {
        const form = this.form;
        if (!form) return;

        if (this._overridesReady !== null) {
            await this._overridesReady;
        }

        this.showSubmissionTables = false;
        this.loadingSubmissionTables = true;

        // Reset availableTags when switching forms
        this.availableTags = [];

        // Prevent updated('submissions') from interfering while we load
        this._isSwitchingTable = true;

        // Reset submissions so stale data from a previous form is never shown.
        this.submissions = {submitted: [], draft: []};
        // Invalidate any previous in-flight call
        const generation = ++this._switchGeneration;

        try {
            await getAllFormSubmissions(this, form.formId);

            // If a newer call was started while we were waiting, discard this stale result.
            if (generation !== this._switchGeneration) return;

            // Ensure the child component has rendered so table refs exist
            await this.updateComplete;
            const submissionsPage = this.getSubmissionsPage();
            if (submissionsPage) {
                await submissionsPage.updateComplete;
            }
            this.refreshTableReferences();

            // If the slug is a UUID, do not create a submission URL as it is not a renderable form
            this.createSubmissionUrl =
                form.formSlug && !form.formSlug.match(UUID_PATTERN)
                    ? getFormRenderUrl(form.formSlug, this.lang)
                    : '';

            // Fetch available tags before building the table, so they are available
            // when setDefaultSubmissionTableOrder runs
            await apiGetTags(this, form.formId);

            if (generation !== this._switchGeneration) return;

            for (const state of Object.keys(this.submissionTables)) {
                const tableComponent = this.submissionTables[state];
                if (!tableComponent) continue;

                // Destroy the old tabulator so stale data and event
                // listeners from a previous form don't bleed through.
                if (tableComponent.tabulatorTable) {
                    tableComponent.tabulatorTable.destroy();
                }
                // Reset the wrapper component's build flags so that a
                // subsequent Lit property update doesn't skip buildTable().
                tableComponent.tableReady = false;
                tableComponent.tableBuilding = false;
                tableComponent.data = [];

                // Re-create options from scratch so we never inherit stale state
                setSubmissionFormOptions(this, state);

                if (this.submissions[state].length === 0) {
                    disableCheckboxSelection(this, state);
                    disablePagination(this, state);
                    this.options_submissions[state].data = [];
                } else {
                    enableCheckboxSelection(this, state);
                    enablePagination(this, state);
                    this.options_submissions[state].data = this.submissions[state];

                    // Open the submission details modal if /details/[uuid] is in the URL.
                    // The modal is opened from handleTableBuilt().
                    const routingData = this.getRoutingData();
                    this.submissionIdToOpen =
                        routingData.pathSegments[2] &&
                        routingData.pathSegments[2].match(/[0-9a-f-]+/)
                            ? routingData.pathSegments[2]
                            : null;
                    this.isRequestDetailedView =
                        routingData.pathSegments[1] === 'details' && !!this.submissionIdToOpen;
                }
            }

            this.loadingSubmissionTables = false;
            this.showSubmissionTables = true;

            // Reactively propagate the final options so the child component
            // has the same reference the tabulator will use.
            this.options_submissions = {...this.options_submissions};
        } catch (error) {
            console.error('Loading form submissions failed:', error);
            if (generation === this._switchGeneration) {
                this.loadingSubmissionTables = false;
            }
        } finally {
            if (generation === this._switchGeneration) {
                this._isSwitchingTable = false;
            }
        }
    }

    // -----------------------------------------------------------------------
    // Table events
    // -----------------------------------------------------------------------

    /**
     * @param {CustomEvent} event
     */
    handleTableBuilt(event) {
        const state = this.getTableState(event.detail?.id);
        if (!state) return;

        // Set visibility and name localization of columns based on form schema
        setDefaultSubmissionTableOrder(this, state);

        this.submissionTables[state].setColumns(this.submissionsColumnsInitial[state]);
        this.setIsActionAvailable(state);
        this.setVisibleRowCount(state);

        // Open detailed view modal if /details/[uuid] is in the URL
        if (this.isRequestDetailedView) {
            const selectedIndex = this.submissions[state].findIndex(
                (submission) => submission.submissionId === this.submissionIdToOpen,
            );
            if (selectedIndex !== -1) {
                this.requestDetailedSubmission(
                    state,
                    this.submissions[state][selectedIndex],
                    selectedIndex + 1,
                );
            }
        }
        void this.restoreSubmissionTableState(state);
    }

    /**
     * Reset action buttons state if table selection changes
     * @param {CustomEvent} event
     */
    handleTableSelectionChanges(event) {
        const tableId = event.composedPath?.()[0]?.identifier;
        const state = this.getTableState(tableId);
        if (!state) return;

        const selectedRows = event.detail?.allselected ?? event.detail?.selected ?? [];
        this.selectedRowCount = {...this.selectedRowCount, [state]: selectedRows.length};
        this.setIsActionAvailable(state);
    }

    handleTablePaginationPageLoaded(event) {
        const tableId = event.detail.tableId;
        const state = this.getTableState(tableId);
        if (!state) return;

        this.setVisibleRowCount(state);

        if (this._restoringUrlStateTables.has(tableId) || !this._urlStateReadyTables.has(tableId))
            return;

        const page = event.detail.page ?? 1;
        const pageSize = event.detail.paginationSize ?? event.detail.pageSize ?? 5;
        this.updateRoutingQuery({
            [`${state}-page`]: page === 1 ? null : page,
            [`${state}-page-size`]: pageSize === 5 ? null : pageSize,
        });
    }

    /**
     * Handle the Enter key in the search bars
     * @param {KeyboardEvent} event
     */
    handleKeyEvents(event) {
        const target = event.composedPath?.()[0];
        if (target?.classList?.contains('searchbar') && event.key === 'Enter') {
            event.preventDefault();
            this.filterTable(target.getAttribute('data-state'));
        }
    }

    /**
     * Close action-dropdowns if clicked outside of the dropdown
     * @param {Event} event
     */
    closeActionsDropdown(event) {
        const path = event.composedPath();
        const actionsContainers = this.getSubmissionsPage()?.getActionsContainers() ?? [];
        const clickedInsideAnyActionsDropdown = Array.from(actionsContainers).some((dropdown) =>
            path.includes(dropdown),
        );

        if (!clickedInsideAnyActionsDropdown) {
            this.closeAllActionsDropdown();
        }
    }

    setVisibleRowCount(state) {
        const tabulatorTable = this.submissionTables[state]?.tabulatorTable;
        if (!tabulatorTable) return;
        this.visibleRowCount = {
            ...this.visibleRowCount,
            [state]: tabulatorTable.getRows('active').length,
        };
    }

    setSelectedRowCount(state) {
        const selectedRows = this.submissionTables[state].tabulatorTable.getSelectedRows();
        this.selectedRowCount = {...this.selectedRowCount, [state]: selectedRows.length};
    }

    // -----------------------------------------------------------------------
    // Submission detail modal
    // -----------------------------------------------------------------------

    /**
     * Returns submitted files for a specific schema file field.
     * @param {string} state - The state of the submission ('draft' or 'submitted').
     * @param {string} submissionId
     * @param {string} fieldName
     * @returns {Array}
     */
    getSubmittedFilesForField(state, submissionId, fieldName) {
        if (!fieldName?.startsWith('form_files-') || !submissionId) {
            return [];
        }

        const submittedFiles = this.submittedFileDetails[state]?.get(submissionId) || [];
        const fileAttributeName = fieldName.replace('form_files-', '');
        return submittedFiles.filter((file) => file.fileAttributeName === fileAttributeName);
    }

    /**
     * Shows the details of a specific row in the modal
     * @param {string} state - The state of the submission ('draft' or 'submitted').
     * @param {object} entry
     * @param {number} pos
     */
    requestDetailedSubmission(state, entry, pos) {
        const modal = this.getSubmissionModal(state);
        if (!modal) {
            return;
        }

        const contentItems = [];

        const columnDefinitions =
            this.submissionTables[state]?.getColumnDefinitions?.() ||
            this.submissionsColumnsInitial[state];
        if (columnDefinitions.length !== 0) {
            for (let currentColumn of columnDefinitions) {
                if (
                    currentColumn &&
                    currentColumn.field &&
                    currentColumn.field !== 'htmlButtons' &&
                    currentColumn.field !== 'rowIndex'
                ) {
                    const labelText = currentColumn.title
                        ? xss(currentColumn.title)
                        : xss(currentColumn.field);
                    const files = this.getSubmittedFilesForField(
                        state,
                        entry.submissionId,
                        currentColumn.field,
                    );
                    const value =
                        currentColumn.field === 'dateCreated'
                            ? humanReadableDate(entry[currentColumn.field])
                            : xss(entry[currentColumn.field] ?? '');
                    contentItems.push(
                        files.length > 0
                            ? {label: labelText, type: 'files', files}
                            : {label: labelText, value},
                    );
                }
            }
        } else {
            for (const [key, value] of Object.entries(entry)) {
                // Skip the action buttons column and empty keys
                if (!key || key === 'htmlButtons' || key === 'rowIndex') continue;

                const files = this.getSubmittedFilesForField(state, entry.submissionId, key);

                contentItems.push(
                    files.length > 0
                        ? {label: xss(key), type: 'files', files}
                        : {
                              label: xss(key),
                              value:
                                  key === 'dateCreated'
                                      ? humanReadableDate(value)
                                      : xss(value ?? ''),
                          },
                );
            }
        }

        this.currentDetailPosition = pos;
        this.currentBeautyId = pos;
        this.isPrevEnabled = pos !== 1;
        this.isNextEnabled = pos + 1 <= this.totalNumberOfItems[state];

        modal.lang = this.lang;
        modal.state = state;
        modal.hiddenColumns = this.hiddenColumns;
        modal.isPrevEnabled = this.isPrevEnabled;
        modal.isNextEnabled = this.isNextEnabled;
        modal.currentBeautyId = this.currentBeautyId;
        modal.totalItems = this.totalNumberOfItems[state];
        modal.auth = this.auth;
        modal.contentItems = contentItems;

        modal.show();
    }

    /**
     * Shows entry of a specific position of the submission table
     * @param {string} state - 'draft' or 'submitted'
     * @param {number} positionToShow
     */
    showEntryOfPos(state, positionToShow) {
        if (positionToShow > this.totalNumberOfItems[state] || positionToShow < 1) return;

        const table = this.submissionTables[state];
        if (!table) return;

        const nextRow = table.getRows()[positionToShow - 1];
        const nextData = {};
        for (const cell of nextRow.getCells()) {
            const definition = cell.getColumn().getDefinition();
            if (definition.formatter !== 'html') {
                nextData[cell.getField()] = cell.getValue();
            }
        }

        this.setSubmissionDetailsRoute(nextData.submissionId);
        this.requestDetailedSubmission(state, nextData, positionToShow);
    }

    // -----------------------------------------------------------------------
    // Export
    // -----------------------------------------------------------------------

    /**
     * Export the table of the given state
     * @param {Event} e
     * @param {string} state
     */
    exportSubmissionTable(e, state) {
        const exportInput = /** @type {HTMLSelectElement} */ (e?.target);
        if (!exportInput) return;

        const exportValue = exportInput.value;
        if (!exportValue || exportValue === '') return;

        e.stopPropagation();

        if (exportValue === 'attachments') {
            // Download all attachments of the selected rows, or all rows if nothing is selected
            const downloadFiles = [];
            const tabulatorTable = this.submissionTables[state].tabulatorTable;
            const selectedRowsObjects = tabulatorTable.getSelectedRows();
            const rowsToExport =
                selectedRowsObjects && selectedRowsObjects.length > 0
                    ? selectedRowsObjects
                    : tabulatorTable.getRows();
            const selectedRowsSubmissionIds = rowsToExport.map((row) => row.getData().submissionId);

            for (const [submissionId, attachments] of this.submittedFileDetails[state]) {
                if (
                    selectedRowsSubmissionIds.length > 0 &&
                    !selectedRowsSubmissionIds.includes(submissionId)
                ) {
                    continue;
                }
                if (!attachments || attachments.length === 0) continue;

                // Add folder name from the schema if available, fallback to submissionId
                const downloadFolderName = this.getDownloadFolderName(submissionId, state);

                attachments.forEach((attachment) => {
                    downloadFiles.push({
                        name:
                            this.useSubFoldersForExports === false
                                ? attachment.fileName
                                : `${downloadFolderName}/${attachment.fileName}`,
                        url: attachment.downloadUrl,
                    });
                });
            }

            this._('#file-sink').files = downloadFiles;
        } else {
            this.submissionTables[state].download(exportValue, this.activeFormName);
        }

        exportInput.value = '-';
    }

    /**
     * Return the download folder name based on the pattern set in the form schema
     * @param {string} submissionId - identifier of the submission
     * @param {string} state - submission state (draft/submitted)
     * @returns {string} - the folder name for downloading attachments
     */
    getDownloadFolderName(submissionId, state) {
        const SCHEMA_FIELD_PREFIX = 'schemaField/';
        const SYSTEM_ATTRIBUTE_PREFIX = 'systemAttribute/';
        let patternMatchingFailed = false;

        if (this.useSubFoldersForExports === false) {
            return '';
        }

        const submissionData = this.submissions[state].find((submission) => {
            return submission.submissionId === submissionId;
        });

        if (!submissionData || !submissionData['submissionId']) {
            throw new Error('Submission data not found for submissionId: ' + submissionId);
        }

        // Fallback to submissionId if no pattern is set
        if (!this.downloadFolderNamePattern) {
            return submissionData['submissionId'];
        }

        const fieldPatterns = this.downloadFolderNamePattern.split('_');
        const folderNameParts = [];

        for (const fieldPattern of fieldPatterns) {
            // Remove ${ and } to get the field name
            const fieldName = fieldPattern.replace(/\${([a-zA-Z/]+)}/, '$1');

            // System attributes
            if (fieldName && fieldName.startsWith(SYSTEM_ATTRIBUTE_PREFIX)) {
                const systemAttribute = fieldName.replace(SYSTEM_ATTRIBUTE_PREFIX, '');
                const submission = this.rawSubmissions.find((submission) => {
                    return submission.identifier === submissionId;
                });
                if (submission && submission[systemAttribute]) {
                    folderNameParts.push(submission[systemAttribute].replace(/\s+/g, '-'));
                } else {
                    patternMatchingFailed = true;
                }
            }

            // Schema fields
            if (fieldName && fieldName.startsWith(SCHEMA_FIELD_PREFIX)) {
                const schemaField = fieldName.replace(SCHEMA_FIELD_PREFIX, '');
                if (!submissionData[schemaField]) {
                    patternMatchingFailed = true;
                } else {
                    folderNameParts.push(`${submissionData[schemaField]}`.replace(/\s+/g, '-'));
                }
            }
        }

        // Fallback to submissionId if pattern matching failed (no field data available)
        if (patternMatchingFailed || folderNameParts.length === 0) {
            return submissionData['submissionId'];
        }

        // Cut to max 230 characters to avoid issues with long file paths
        return folderNameParts.join('_').substring(0, 230);
    }

    // -----------------------------------------------------------------------
    // Routing
    // -----------------------------------------------------------------------

    /**
     * @param {Record<string, any>} values
     */
    updateRoutingQuery(values) {
        this.requestRoutingUrl(buildRoutingUrlWithQuery(this.getRoutingData(), values));
    }

    /**
     * @param {string} routingUrl
     */
    requestRoutingUrl(routingUrl) {
        if (routingUrl === this.routingUrl) return;

        // Update locally right away, so consecutive changes build on each other
        // before the activity passes the new URL back down.
        this.routingUrl = routingUrl;
        dispatchRoutingUrlChange(this, routingUrl);
    }

    setSubmissionDetailsRoute(submissionId = null) {
        const {pathSegments, queryParams, hash} = this.getRoutingData();
        const formId = this.activeFormId || pathSegments[0];
        if (!formId) return;

        const pathname = submissionId
            ? `/${formId}/details/${encodeURIComponent(submissionId)}`
            : `/${formId}`;
        const queryString = queryParams?.toString() ?? '';
        this.requestRoutingUrl(`${pathname}${queryString ? `?${queryString}` : ''}${hash ?? ''}`);
    }

    syncSubmissionFilterToUrl(state) {
        const submissionsPage = this.getSubmissionsPage();
        const searchInput = submissionsPage?.getSearchbar(state);
        const searchColumn = submissionsPage?.getSearchSelect(state);
        const searchOperator = submissionsPage?.getSearchOperator(state);
        if (!searchInput || !searchColumn || !searchOperator) return;

        this.updateRoutingQuery({
            [`${state}-search`]: searchInput.value,
            [`${state}-search-column`]: searchColumn.value === 'all' ? null : searchColumn.value,
            [`${state}-search-operator`]:
                searchOperator.value === 'like' ? null : searchOperator.value,
            [`${state}-page`]: null,
        });
    }

    async restoreSubmissionTableState(state) {
        const submissionsPage = this.getSubmissionsPage();
        const searchInput = submissionsPage?.getSearchbar(state);
        const searchColumn = submissionsPage?.getSearchSelect(state);
        const searchOperator = submissionsPage?.getSearchOperator(state);
        const table = this.submissionTables[state];
        if (!searchInput || !searchColumn || !searchOperator || !table?.tabulatorTable) return;

        const {queryParams} = this.getRoutingData();
        const columnValue = queryParams.get(`${state}-search-column`) ?? 'all';
        const operatorValue = queryParams.get(`${state}-search-operator`) ?? 'like';
        const page = getUrlPaginationValue(queryParams.get(`${state}-page`), 1);
        const pageSize = getUrlPaginationSize(
            queryParams.get(`${state}-page-size`),
            table.paginationSize,
        );

        this._restoringUrlStateTables.add(table.identifier);
        try {
            searchInput.value = queryParams.get(`${state}-search`) ?? '';
            searchColumn.value = Array.from(searchColumn.options).some(
                (option) => option.value === columnValue,
            )
                ? columnValue
                : 'all';
            searchOperator.value = Array.from(searchOperator.options).some(
                (option) => option.value === operatorValue,
            )
                ? operatorValue
                : 'like';
            table.paginationSize = pageSize;
            await table.tabulatorTable.setPageSize(pageSize);
            this.filterTable(state, false);
            await table.tabulatorTable.setPage(page);
        } finally {
            this._restoringUrlStateTables.delete(table.identifier);
            this._urlStateReadyTables.add(table.identifier);
        }
    }

    async restoreVisibleTableState() {
        for (const state of Object.values(SUBMISSION_STATES)) {
            await this.restoreSubmissionTableState(state);
        }
    }

    // -----------------------------------------------------------------------
    // Search / filter
    // -----------------------------------------------------------------------

    /**
     * Filters the submissions table
     * @param {string} state
     * @param {boolean} updateUrl
     */
    filterTable(state, updateUrl = true) {
        const submissionsPage = this.getSubmissionsPage();
        const filter = /** @type {HTMLInputElement} */ (submissionsPage?.getSearchbar(state));
        const search = /** @type {HTMLSelectElement} */ (submissionsPage?.getSearchSelect(state));
        const operator = /** @type {HTMLSelectElement} */ (
            submissionsPage?.getSearchOperator(state)
        );

        const table = this.submissionTables[state];

        if (!filter || !search || !operator || !table) return;

        if (filter.value === '') {
            table.clearFilter();
            this.searchIsActive = {...this.searchIsActive, [state]: false};
            this.setVisibleRowCount(state);
            if (updateUrl) this.syncSubmissionFilterToUrl(state);
            return;
        }
        const filterValue = filter.value;
        const searchValue = search.value;
        const operatorValue = operator.value;

        table.tabulatorTable.deselectRow();
        if (searchValue !== 'all') {
            table.setFilter([{field: searchValue, type: operatorValue, value: filterValue}]);
        } else {
            const listOfFilters = table
                .getColumnsFields()
                .filter((col) => col && col !== 'htmlButtons')
                .map((col) => ({field: col, type: operatorValue, value: filterValue}));
            table.setFilter([listOfFilters]);
        }

        this.setVisibleRowCount(state);
        this.searchIsActive = {...this.searchIsActive, [state]: true};

        if (updateUrl) this.syncSubmissionFilterToUrl(state);
    }

    /**
     * Removes the current filters from the submissions tables
     * @param {string|null} stateToClear
     * @param {boolean} updateUrl
     */
    clearAllFilters(stateToClear = null, updateUrl = true) {
        const states = stateToClear ? [stateToClear] : Object.keys(this.submissionTables);
        const queryUpdates = {};
        const submissionsPage = this.getSubmissionsPage();
        for (const state of states) {
            const searchInput = submissionsPage?.getSearchbar(state);
            const searchColumn = submissionsPage?.getSearchSelect(state);
            const searchOperator = submissionsPage?.getSearchOperator(state);
            const table = this.submissionTables[state];

            if (!table || !searchInput || !searchColumn || !searchOperator) continue;

            searchInput.value = '';
            searchColumn.value = 'all';
            searchOperator.value = 'like';
            table.clearFilter();
            this.searchIsActive = {...this.searchIsActive, [state]: false};
            this.setVisibleRowCount(state);
            queryUpdates[`${state}-search`] = null;
            queryUpdates[`${state}-search-column`] = null;
            queryUpdates[`${state}-search-operator`] = null;
            queryUpdates[`${state}-page`] = null;
        }
        if (updateUrl) this.updateRoutingQuery(queryUpdates);
    }

    closeAllSearchWidgets() {
        this.searchWidgetIsOpen = {draft: false, submitted: false};
    }

    // -----------------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------------

    setIsActionAvailable(state) {
        this.setActionButtonsStates(state);
        const isAvailable =
            this.isEditSubmissionEnabled[state] ||
            this.isEditSubmissionPermissionEnabled[state] ||
            this.isDeleteAllSubmissionEnabled[state] ||
            this.isDeleteSelectedSubmissionEnabled[state] ||
            this.isBatchTaggingEnabled[state];
        this.isActionAvailable = {...this.isActionAvailable, [state]: !!isAvailable};
    }

    closeAllActionsDropdown() {
        this.actionsWidgetIsOpen = {draft: false, submitted: false};
    }

    /**
     * Set action buttons states
     * @param {string} state - form state. draft or submitted
     */
    setActionButtonsStates(state) {
        if (!this.submissionTables[state]?.tabulatorTable) return;

        const selectedRows = this.submissionTables[state].tabulatorTable.getSelectedRows();
        const allRows = this.submissionTables[state].tabulatorTable.getRows('all');

        const collectGrants = (rows) => {
            const grants = new Set();
            for (const row of rows) {
                const submissionId = row.getData().submissionId;
                this.submissionsGrantedActions.get(submissionId)?.forEach((grant) => {
                    grants.add(grant);
                });
            }
            return grants;
        };
        const selectedSubmissionsGrants = collectGrants(selectedRows);
        const allSubmissionsGrants = collectGrants(allRows);

        const selectedCount = selectedRows.length;
        const allCount = allRows.length;

        // Replace objects with new references so Lit detects changes
        this.selectedRowCount = {...this.selectedRowCount, [state]: selectedCount};
        this.allRowCount = {...this.allRowCount, [state]: allCount};

        this.isDeleteSelectedSubmissionEnabled = {
            ...this.isDeleteSelectedSubmissionEnabled,
            [state]:
                selectedCount > 0 &&
                (selectedSubmissionsGrants.has(SUBMISSION_PERMISSIONS.MANAGE) ||
                    selectedSubmissionsGrants.has(SUBMISSION_PERMISSIONS.DELETE)),
        };

        this.isDeleteAllSubmissionEnabled = {
            ...this.isDeleteAllSubmissionEnabled,
            [state]:
                selectedCount === 0 &&
                (allSubmissionsGrants.has(SUBMISSION_PERMISSIONS.MANAGE) ||
                    allSubmissionsGrants.has(SUBMISSION_PERMISSIONS.DELETE)),
        };

        this.isEditSubmissionEnabled = {
            ...this.isEditSubmissionEnabled,
            [state]:
                selectedCount === 1 &&
                (selectedSubmissionsGrants.has(SUBMISSION_PERMISSIONS.MANAGE) ||
                    selectedSubmissionsGrants.has(SUBMISSION_PERMISSIONS.UPDATE)),
        };

        this.isEditSubmissionPermissionEnabled = {
            ...this.isEditSubmissionPermissionEnabled,
            [state]:
                this.enableSubmissionPermissionEditing &&
                selectedCount > 0 &&
                selectedRows.every((row) => {
                    const submissionId = row.getData().submissionId;
                    const grants = this.submissionsGrantedActions.get(submissionId) ?? [];
                    return grants.includes(SUBMISSION_PERMISSIONS.MANAGE);
                }),
        };

        // Batch tagging is disabled until tag-based permissions are implemented
        this.isBatchTaggingEnabled = {...this.isBatchTaggingEnabled, [state]: false};
    }

    async handleOpenBatchTaggingModal(state) {
        const data = this.submissionTables[state].tabulatorTable.getSelectedData();
        this.submissionIdsForTagging = data.map((submission) => submission.submissionId);
        await apiGetTags(this, this.activeFormId);
        this.currentStateForBatchTagging = state;

        const batchTaggingModal = this._('#batch-tagging-modal');
        if (batchTaggingModal) {
            batchTaggingModal.availableTags = this.availableTags;
            batchTaggingModal.submissionCount = this.submissionIdsForTagging.length;
            batchTaggingModal.open();
        }
    }

    handleEditSubmissionsPermission(state) {
        if (!this.enableSubmissionPermissionEditing) return;

        const submissionIds =
            this.submissionTables[state]?.tabulatorTable
                ?.getSelectedData()
                ?.map((submission) => submission.submissionId)
                .filter(Boolean) ?? [];
        const permissionDialog = this._('#submission-grant-permission-dialog');
        if (!permissionDialog || submissionIds.length === 0) return;

        permissionDialog.resourceIdentifier = submissionIds.length === 1 ? submissionIds[0] : '';
        permissionDialog.resourceIdentifiers = submissionIds;
        permissionDialog.open();
    }

    async handleBatchTaggingConfirm(event) {
        const {tags, justAdd} = event.detail;
        const batchTaggingModal = this._('#batch-tagging-modal');
        const button = batchTaggingModal?.getConfirmButton();

        if (button) {
            button.spinner = true;
            button.start();
        }

        // PATCH submissions with the new tags.
        const responseStatus = [];
        const responseDetailedStatus = [];
        const submissionFinalTagsMap = new Map();

        for (const submissionId of this.submissionIdsForTagging) {
            try {
                const rawSubmission = this.rawSubmissions.find(
                    (sub) => sub.identifier === submissionId,
                );
                const currentTags = rawSubmission?.tags || [];

                // Either add the new tags to the existing ones or replace them
                const finalTags = justAdd ? [...new Set([...currentTags, ...tags])] : [...tags];

                const response = await apiUpdateSubmissionTags(this, submissionId, finalTags);
                responseStatus.push(response);
                responseDetailedStatus.push({status: response, submissionId});

                if (response && rawSubmission) {
                    submissionFinalTagsMap.set(submissionId, finalTags);
                    rawSubmission.tags = finalTags;
                }
            } catch (error) {
                console.error(`Failed to update tags for submission ${submissionId}:`, error);
                responseStatus.push(false);
                responseDetailedStatus.push({status: false, submissionId});
            }
        }

        // Unselect processed rows and update table
        const state = this.currentStateForBatchTagging;
        const tabulatorTable = this.submissionTables[state].tabulatorTable;
        tabulatorTable
            .getRows()
            .filter((row) =>
                responseDetailedStatus.some(
                    (res) => res.submissionId === row.getData().submissionId && res.status === true,
                ),
            )
            .forEach((row) => {
                const finalTags = submissionFinalTagsMap.get(row.getData().submissionId) || [];
                row.update({
                    tags: finalTags.map((tag) => `<span class="tag">${xss(tag)}</span>`).join(' '),
                });
                row.deselect();
            });

        // Recalculate column widths after updating rows
        tabulatorTable.redraw(true);

        if (button) {
            button.spinner = false;
            button.stop();
        }
        batchTaggingModal?.close();

        this.requestUpdate();
        this.notifySubmissionsProcessed(responseStatus);
    }

    handleEditSubmissions(event, state) {
        const data = this.submissionTables[state].tabulatorTable.getSelectedData();
        const submissionId = data[0].submissionId;

        // Redirect to render-form activity to display the readonly form with submission values
        const activeForm = this.form;
        if (
            activeForm?.formSlug &&
            typeof activeForm.moduleInstance?.hasReadOnlyMode === 'function' &&
            activeForm.moduleInstance.hasReadOnlyMode()
        ) {
            const url = new URL(
                getFormRenderUrl(activeForm.formSlug, this.lang) + `/${submissionId}`,
            );
            url.searchParams.set('validate', 'true');
            window.history.pushState({}, '', url);

            // Middle click opens in a new tab
            if (event?.button === 1) {
                window.open(url.toString(), '_blank');
            } else {
                window.location.href = url.toString();
            }
        } else {
            sendNotification({
                summary: this._i18n.t('errors.warning-title'),
                body: this._i18n.t('errors.feature-not-implemented'),
                type: 'warning',
                timeout: 10,
            });
        }
    }

    /**
     * Delete all or only the selected submissions
     * @param {string} state - form state. draft or submitted
     * @param {boolean} selectedOnly - if true only the selected submissions are deleted
     */
    async handleDeleteSubmissions(state, selectedOnly = false) {
        const tabulatorTable = this.submissionTables[state].tabulatorTable;
        const data = selectedOnly
            ? tabulatorTable.getSelectedData()
            : tabulatorTable.getData('all');
        const rows = selectedOnly
            ? tabulatorTable.getSelectedRows()
            : tabulatorTable.getRows('all');

        if (data.length === 0) {
            sendNotification({
                summary: this._i18n.t('errors.warning-title'),
                body: this._i18n.t('errors.no-submission-selected'),
                type: 'warning',
                timeout: 10,
            });
            return;
        }

        const deletionModal = this._('#deletion-modal');
        const confirmed = deletionModal ? await deletionModal.confirm() : false;
        if (!confirmed) return;

        const responseStatus = [];
        const failedRequestToSelect = [];
        for (const [index, submission] of data.entries()) {
            const response = await apiDeleteSubmission(this, submission.submissionId);
            responseStatus.push(response);
            if (response !== true) {
                failedRequestToSelect.push(submission.submissionId);
                continue;
            }

            rows[index].delete();
            this.submissions = {
                ...this.submissions,
                [state]: this.submissions[state].filter(
                    (sub) => sub.submissionId !== submission.submissionId,
                ),
            };
            this.options_submissions = {
                ...this.options_submissions,
                [state]: {
                    ...this.options_submissions[state],
                    data: this.options_submissions[state].data.filter(
                        (sub) => sub.submissionId !== submission.submissionId,
                    ),
                },
            };
        }

        // When every row has been deleted, explicitly clear the table so
        // the last row doesn't stick around due to stale Tabulator state.
        if (this.submissions[state].length === 0) {
            tabulatorTable.clearData();
        }

        // Update status bar counters and action buttons state
        this.setVisibleRowCount(state);
        this.setSelectedRowCount(state);
        this.setIsActionAvailable(state);

        // Update row-indexes
        tabulatorTable.redraw(true);
        this.notifySubmissionsProcessed(responseStatus);

        // Re-select failed submissions
        for (const failedSubmissionId of failedRequestToSelect) {
            this.submissionTables[state]
                .getRows()
                .filter((row) => row.getData().submissionId === failedSubmissionId)
                .forEach((row) => row.select());
        }
    }

    // -----------------------------------------------------------------------
    // Child component event handlers
    // -----------------------------------------------------------------------

    handleBackToOverview() {
        // The `back-to-overview` event continues to bubble up to the activity.
        this.clearAllFilters(null, false);
        this.closeAllSearchWidgets();
        this.showSubmissionTables = false;
        this.loadingSubmissionTables = false;
    }

    handleSubmissionsPageSearchToggle(event) {
        const {state, open} = event.detail;
        this.searchWidgetIsOpen = {...this.searchWidgetIsOpen, [state]: open};
    }

    handleSubmissionsPageActionsToggle(event) {
        const {state, open} = event.detail;
        this.actionsWidgetIsOpen = {...this.actionsWidgetIsOpen, [state]: open};
    }

    handleSubmissionsPageAction(event) {
        const {action, state, payload} = event.detail;
        const effectiveEvent = payload?.event;

        switch (action) {
            case 'prepare-actions':
                this.setActionButtonsStates(state);
                break;
            case 'edit-submission':
                this.handleEditSubmissions(effectiveEvent, state);
                break;
            case 'batch-tagging':
                void this.handleOpenBatchTaggingModal(state);
                break;
            case 'edit-permission':
                if (this.isEditSubmissionPermissionEnabled[state]) {
                    this.handleEditSubmissionsPermission(state);
                }
                break;
            case 'delete-all':
                void this.handleDeleteSubmissions(state);
                break;
            case 'delete-selected':
                void this.handleDeleteSubmissions(state, true);
                break;
            case 'export':
                this.exportSubmissionTable(effectiveEvent, state);
                break;
        }
    }

    /**
     * @param {boolean[]} responseStatus
     */
    notifySubmissionsProcessed(responseStatus) {
        // Keep the dynamically referenced notification keys in the i18next output.
        keepDynamicTranslations((key) => this._i18n.t(key));
        successFailureNotification(this, responseStatus);
    }

    static get styles() {
        return getManageFormsActivityStyles();
    }

    render() {
        const i18n = this._i18n;

        return html`
            <dbp-formalize-manage-form-submissions-page
                lang="${this.lang}"
                lang-dir="${this.langDir}"
                id="submissions-page"
                .showFormsTable=${false}
                .showSubmissionTables=${this.showSubmissionTables}
                .loadingSubmissionTables=${this.loadingSubmissionTables}
                .activeFormName=${this.activeFormName}
                .paginationSizeStorageKey=${this.paginationSizeStorageKey}
                .columnConfigurationStorageKeys=${Object.fromEntries(
                    Object.values(SUBMISSION_STATES).map((state) => [
                        state,
                        this.getColumnConfigurationStorageKey(
                            `submissions-${this.activeFormId}-${state}`,
                        ),
                    ]),
                )}
                .createSubmissionUrl=${this.createSubmissionUrl}
                .hideCreateSubmissionButton=${this.hideCreateSubmissionButton}
                .enabledStates=${this.enabledStates}
                .noSubmissionAvailable=${this.noSubmissionAvailable}
                .searchWidgetIsOpen=${this.searchWidgetIsOpen}
                .actionsWidgetIsOpen=${this.actionsWidgetIsOpen}
                .isActionAvailable=${this.isActionAvailable}
                .isEditSubmissionEnabled=${this.isEditSubmissionEnabled}
                .enableSubmissionPermissionEditing=${this.enableSubmissionPermissionEditing}
                .isEditSubmissionPermissionEnabled=${this.isEditSubmissionPermissionEnabled}
                .isBatchTaggingEnabled=${this.isBatchTaggingEnabled}
                .isDeleteAllSubmissionEnabled=${this.isDeleteAllSubmissionEnabled}
                .isDeleteSelectedSubmissionEnabled=${this.isDeleteSelectedSubmissionEnabled}
                .optionsSubmissions=${this.options_submissions}
                .submissions=${this.submissions}
                .selectedRowCount=${this.selectedRowCount}
                .allRowCount=${this.allRowCount}
                .visibleRowCount=${this.visibleRowCount}
                .searchIsActive=${this.searchIsActive}
                .submissionsHasAttachment=${this.submissionsHasAttachment}
                @keyup=${(event) => this.handleKeyEvents(event)}
                @dbp-tabulator-table-built=${(event) => this.handleTableBuilt(event)}
                @dbp-tabulator-table-row-selection-changed-event=${(event) =>
                    this.handleTableSelectionChanges(event)}
                @dbp-tabulator-table-page-loaded-event=${(event) =>
                    this.handleTablePaginationPageLoaded(event)}
                @dbp-tabulator-table-page-size-changed-event=${(event) =>
                    this.handleTablePaginationPageLoaded(event)}
                @back-to-overview=${() => this.handleBackToOverview()}
                @submission-search-toggle=${(event) =>
                    this.handleSubmissionsPageSearchToggle(event)}
                @submission-actions-toggle=${(event) =>
                    this.handleSubmissionsPageActionsToggle(event)}
                @submission-search=${(event) => this.filterTable(event.detail.state)}
                @submission-search-reset=${(event) => this.clearAllFilters(event.detail.state)}
                @submission-action=${(event) =>
                    this.handleSubmissionsPageAction(
                        event,
                    )}></dbp-formalize-manage-form-submissions-page>

            ${Object.values(SUBMISSION_STATES).map(
                (state) => html`
                    <dbp-formalize-manage-submission-modal
                        lang="${this.lang}"
                        id="submission-modal-${state}"
                        .auth=${this.auth}
                        .state=${state}
                        @detail-modal-close=${() => this.setSubmissionDetailsRoute()}
                        @detail-modal-previous=${(event) =>
                            this.showEntryOfPos(event.detail.state, this.currentDetailPosition - 1)}
                        @detail-modal-next=${(event) =>
                            this.showEntryOfPos(
                                event.detail.state,
                                this.currentDetailPosition + 1,
                            )}></dbp-formalize-manage-submission-modal>
                `,
            )}
            ${
                this.enableSubmissionPermissionEditing
                    ? html`
                          <dbp-grant-permission-dialog
                              id="submission-grant-permission-dialog"
                              lang="${this.lang}"
                              modal-title="${i18n.t('manage-forms.edit-permission-modal-title')}"
                              subscribe="auth"
                              entry-point-url="${this.entryPointUrl}"
                              resource-class-identifier="DbpRelayFormalizeSubmission"></dbp-grant-permission-dialog>
                      `
                    : ''
            }

            <dbp-file-sink
                streamed
                id="file-sink"
                class="file-sink"
                lang="${this.lang}"
                allowed-mime-types="application/pdf,.pdf"
                decompress-zip
                enabled-targets="local,nextcloud"
                subscribe="auth,nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-sink>

            <dbp-formalize-deletion-confirmation-modal
                id="deletion-modal"
                lang-dir="${this.langDir}"
                subscribe="lang"></dbp-formalize-deletion-confirmation-modal>

            <dbp-formalize-batch-tagging-modal
                id="batch-tagging-modal"
                subscribe="lang"
                @batch-tagging-confirm=${(event) =>
                    this.handleBatchTaggingConfirm(event)}></dbp-formalize-batch-tagging-modal>
        `;
    }
}
