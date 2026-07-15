// @ts-nocheck
import {css, html} from 'lit';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {setOverridesByGlobalCache} from '@dbp-toolkit/common/i18next.js';
import {
    Button,
    Icon,
    IconButton,
    MiniSpinner,
    Translated,
    sendNotification,
} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {classMap} from 'lit/directives/class-map.js';
import {
    ColumnSettingsButton,
    CustomTabulatorTable,
    GetDetailsButton,
    GetSubmissionLink,
} from './table-components.js';
import {FileSink} from '@dbp-toolkit/file-handling';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {
    SUBMISSION_STATES,
    getFormRenderUrl,
    SUBMISSION_PERMISSIONS,
    FORM_PERMISSIONS,
    isDraftStateEnabled,
    isSubmittedStateEnabled,
    addDetailsToUrl,
    removeDetailsFromUrl,
} from './utils.js';
import {getSelectorFixCSS, getFileHandlingCss, getTagsCSS, getManageFormsCSS} from './styles.js';
import metadata from './dbp-formalize-manage-forms.metadata.json';
import xss from 'xss';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';
import {GrantPermissionDialog} from '@dbp-toolkit/grant-permission-dialog';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {ManageFormsOverviewPage} from './manage-forms-overview-page.js';
import {ManageFormSubmissionsPage} from './manage-form-submissions-page.js';
import {ManageSubmissionModal} from './manage-submission-modal.js';
import {BatchTaggingModal} from './batch-tagging-modal.js';
import {DeletionConfirmationModal} from './deletion-confirmation-modal.js';
import {EditFormDialog} from './edit-form-dialog.js';

// Extracted modules
import {
    loadModules,
    getListOfAllForms,
    getAllFormSubmissions,
    apiDeleteSubmission,
    apiDeleteForm,
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
    restoreSubmissionTableSettings,
    storeSubmissionTableSettings,
    resetSettings,
    toggleAllColumns,
    toggleVisibility,
    moveHeader,
    updateSubmissionTable,
} from './manage-forms-table-config.js';

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
    t('success.submissions-processed', {count: 0});
    t('errors.submissions-processing-failed', {count: 0});
};

// Accept JSON arrays and comma-separated HTML attribute values for frontendKey lists.
function parseFormListAttribute(value) {
    console.log('parseFormListAttribute input:', value);
    if (Array.isArray(value)) {
        return value.map((item) => `${item}`.trim()).filter((item) => item !== '');
    }

    if (typeof value !== 'string') {
        return [];
    }

    const trimmedValue = value.trim();

    if (trimmedValue === '') {
        return [];
    }

    try {
        const parsedValue = JSON.parse(trimmedValue);
        if (Array.isArray(parsedValue)) {
            return parsedValue.map((item) => `${item}`.trim()).filter((item) => item !== '');
        }
    } catch {
        // Fallback to comma-separated values for HTML attributes.
    }

    return trimmedValue
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
}

/**
 * @augments {DBPFormalizeLitElement}
 */
class ManageForms extends ScopedElementsMixin(DBPFormalizeLitElement) {
    constructor() {
        super();
        this.allForms = [];
        this.isLoadingModules = false;
        // Holds the in-flight loadModules() promise so concurrent callers await
        // the same load instead of returning early while modules resolve.
        this.loadModulesPromise = null;
        this.boundKeyEventHandler = this.handleKeyEvents.bind(this);
        this.boundCloseActionsDropdownHandler = this.closeActionsDropdown.bind(this);
        this.boundTableSelectionChanges = this.handleTableSelectionChanges.bind(this);
        this.boundTablePaginationPageLoaded = this.handleTablePaginationPageLoaded.bind(this);
        this.boundFileSinkDownloadStartedHandler = this.handleFileSinkDownloadStarted.bind(this);
        this.boundSwMessageHandler = this.handleSwMessage.bind(this);
        this.selectedRowCount = {
            draft: 0,
            submitted: 0,
        };
        this.allRowCount = {
            draft: 0,
            submitted: 0,
        };
        this.visibleRowCount = {
            draft: 0,
            submitted: 0,
        };
        this.searchIsActive = {
            draft: false,
            submitted: false,
        };
        this.options_submissions = {
            draft: {},
            submitted: {},
        };
        this.options_forms = {};
        // Bulk removal of forms in the overview is opt-in and disabled by default.
        // This has to be initialized before updateFormsTableOptions() because
        // that method decides whether the forms table gets row selection.
        this.enableFormsBulkDelete = false;
        // Initialize the forms table options (including `langs`) up front so the
        // table can be built before the `lang`/`langDir` branch of updated() runs.
        // Otherwise buildTable() may access options.langs while it is still undefined.
        this.updateFormsTableOptions();
        this._overridesReady = null;
        this.forms = new Map();
        /** @type {Map<string, {formId: string, formSlug: string, formName: string|null, moduleInstance: object}>} */
        this.loadedModules = new Map();

        this.rawSubmissions = [];
        this.submissionsGrantedActions = new Map();
        // Maps a form identifier to its grantedActions array (used to gate bulk form deletion).
        this.formsGrantedActions = new Map();
        // Number of currently selected forms in the overview table.
        this.selectedFormsCount = 0;
        // Whether deleting the selected forms is allowed (all selected forms grant delete/manage).
        this.isDeleteSelectedFormsEnabled = false;
        this.submissions = {
            draft: [],
            submitted: [],
        };
        this.showSubmissionTables = false;
        this.showFormsTable = false;
        this.submissionSlug = '';
        this.submissionsColumns = {
            draft: [],
            submitted: [],
        };
        this.submissionsColumnsInitial = {
            draft: [],
            submitted: [],
        };
        this.activeFormName = '';
        this.activeFormId = '';
        this.currentBeautyId = 0;
        this.totalNumberOfItems = {
            draft: 0,
            submitted: 0,
        };
        this.isPrevEnabled = false;
        this.isNextEnabled = false;
        // @TODO: remove unused property
        this.storeSession = true;
        this.loadingFormsTable = false;
        this.loadingSubmissionTables = false;
        this.noSubmissionAvailable = {
            draft: true,
            submitted: true,
        };
        this.modalContentHeight = 0;
        this.loadCourses = true;
        this.hiddenColumns = false;
        this.currentDetailPosition = 0;

        this.submissionTables = {
            submitted: null,
            draft: null,
        };
        this.formsTable = null;

        this.submissionsHasAttachment = {
            draft: false,
            submitted: false,
        };
        this.submittedFileDetails = {
            draft: new Map(),
            submitted: new Map(),
        };

        this.isDeleteSelectedSubmissionEnabled = {
            draft: false,
            submitted: false,
        };
        this.isDeleteAllSubmissionEnabled = {
            draft: false,
            submitted: false,
        };
        this.isEditSubmissionEnabled = {
            draft: false,
            submitted: false,
        };
        this.isBatchTaggingEnabled = {
            draft: false,
            submitted: false,
        };
        this.isEditSubmissionPermissionEnabled = {
            draft: false,
            submitted: false,
        };
        this.enabledStates = {
            draft: false,
            submitted: false,
        };
        this.searchWidgetIsOpen = {
            draft: false,
            submitted: false,
        };
        this.actionsWidgetIsOpen = {
            draft: false,
            submitted: false,
        };
        this.isActionAvailable = {
            draft: false,
            submitted: false,
        };
        this.needTableRebuild = {
            draft: false,
            submitted: false,
        };
        this.iconNameVisible = 'source_icons_eye-empty';
        this.iconNameHidden = 'source_icons_eye-off';
        this.createSubmissionUrl = '';
        this.isResetButtonDisabled = {
            draft: true,
            submitted: true,
        };
        this.useSubFoldersForExports = true;
        this.downloadFolderNamePattern = '';
        this.allowListFrontendKeys = [];
        this.denyListFrontendKeys = [];
        this.hideCreateSubmissionButton = false;
        this.noFormsAvailable = false;
        // Number of loaded modules that implement createForm(); drives button visibility
        this.creatableModulesCount = 0;
        this.userNameCache = new Map();
        this.isRequestDetailedView = false;
        this.submissionIdToOpen = null;
        this.submissionIdsForTagging = [];
        this.availableTags = [];
        this.attachmentsAreLoading = {
            draft: false,
            submitted: false,
        };
        this._abortAttachmentLoading = false;
        // Guard: prevents updated('submissions') from rebuilding tables while
        // switchToSubmissionTable is in progress.
        this._isSwitchingTable = false;
        // Counter: incremented on each switchToSubmissionTable call so that a
        // stale .then() callback from an earlier call is discarded.
        this._switchGeneration = 0;
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-icon-button': IconButton,
            'dbp-translated': Translated,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-tabulator-table': CustomTabulatorTable,
            'dbp-grant-permission-dialog': GrantPermissionDialog,
            'dbp-modal': Modal,
            'dbp-file-sink': FileSink,
            'dbp-formalize-column-settings-button': ColumnSettingsButton,
            'dbp-formalize-get-details-button': GetDetailsButton,
            'dbp-formalize-get-submission-link': GetSubmissionLink,
            'dbp-formalize-manage-forms-overview-page': ManageFormsOverviewPage,
            'dbp-formalize-manage-form-submissions-page': ManageFormSubmissionsPage,
            'dbp-formalize-manage-submission-modal': ManageSubmissionModal,
            'dbp-formalize-batch-tagging-modal': BatchTaggingModal,
            'dbp-formalize-deletion-confirmation-modal': DeletionConfirmationModal,
            'dbp-formalize-edit-form-dialog': EditFormDialog,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            allForms: {type: Array, attribute: false},
            form: {type: String},
            name: {type: String},
            activeFormName: {type: String, attribute: false},
            forms: {type: Object, attribute: false},
            submissions: {type: Object, attribute: false},
            emptyCoursesTable: {type: Boolean, attribute: true},
            showFormsTable: {type: Boolean, attribute: false},
            showSubmissionTables: {type: Boolean, attribute: false},
            loadingFormsTable: {type: Boolean, attribute: false},
            loadingSubmissionTables: {type: Boolean, attribute: false},
            submissionsColumns: {type: Object, attribute: false},
            isPrevEnabled: {type: Boolean, attribute: false},
            isNextEnabled: {type: Boolean, attribute: false},
            currentBeautyId: {type: Number, attribute: false},
            totalNumberOfItems: {type: Object, attribute: false},
            modalContentHeight: {type: Number, attribute: false},
            loadCourses: {type: Boolean, attribute: true},
            hasPermissions: {type: Boolean, attribute: false},
            hiddenColumns: {type: Boolean, attribute: false},
            options_submissions: {type: Object, attribute: false},
            options_forms: {type: Object, attribute: false},
            searchWidgetIsOpen: {type: Object, attribute: false},
            actionsWidgetIsOpen: {type: Object, attribute: false},
            isActionAvailable: {type: Object, attribute: false},
            noSubmissionAvailable: {type: Object, attribute: false},
            createSubmissionUrl: {type: String, attribute: false},
            schemaVisibilitySet: {type: Boolean, attribute: false},

            isDeleteSelectedSubmissionEnabled: {type: Boolean, attribute: false},
            isDeleteAllSubmissionEnabled: {type: Boolean, attribute: false},
            isEditSubmissionEnabled: {type: Boolean, attribute: false},

            selectedFormsCount: {type: Number, attribute: false},
            isDeleteSelectedFormsEnabled: {type: Boolean, attribute: false},

            selectedRowCount: {type: Object, attribute: false},
            allRowCount: {type: Object, attribute: false},
            visibleRowCount: {type: Object, attribute: false},
            searchIsActive: {type: Object, attribute: false},
            justAddTagsForBatchTagging: {type: Boolean, attribute: false},
            attachmentsAreLoading: {type: Object, attribute: false},
            noFormsAvailable: {type: Boolean, attribute: false},
            creatableModulesCount: {type: Number, attribute: false},
            // List of frontendKey values to include; forms without a matching frontendKey are hidden.
            allowListFrontendKeys: {
                type: Array,
                attribute: 'allow-list-frontend-keys',
                converter: {
                    fromAttribute: parseFormListAttribute,
                },
            },
            // List of frontendKey values to exclude; forms with a matching frontendKey are hidden.
            denyListFrontendKeys: {
                type: Array,
                attribute: 'deny-list-frontend-keys',
                converter: {
                    fromAttribute: parseFormListAttribute,
                },
            },
            hideCreateSubmissionButton: {
                type: Boolean,
                attribute: 'hide-create-submission-button',
            },
            enableFormsBulkDelete: {
                type: Boolean,
                attribute: 'enable-forms-bulk-delete',
            },
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keyup', this.boundKeyEventHandler);
        document.removeEventListener('click', this.boundCloseActionsDropdownHandler);
        document.removeEventListener(
            'dbp-tabulator-table-row-selection-changed-event',
            this.boundTableSelectionChanges,
        );
        document.removeEventListener(
            'dbp-tabulator-table-page-loaded-event',
            this.boundTablePaginationPageLoaded,
        );
        document.removeEventListener(
            'dbp-file-sink-download-started',
            this.boundFileSinkDownloadStartedHandler,
        );
        navigator.serviceWorker.removeEventListener('message', this.boundSwMessageHandler);
    }

    getOverviewPage() {
        return this._('dbp-formalize-manage-forms-overview-page');
    }

    getSubmissionsPage() {
        return this._('dbp-formalize-manage-form-submissions-page');
    }

    getSubmissionModal(state) {
        return this._(`#submission-modal-${state}`);
    }

    refreshTableReferences() {
        const overviewPage = this.getOverviewPage();
        if (overviewPage) {
            this.formsTable = /** @type {CustomTabulatorTable} */ (overviewPage.getFormsTable());
        }

        const submissionsPage = this.getSubmissionsPage();
        if (submissionsPage) {
            for (const state of Object.values(SUBMISSION_STATES)) {
                this.submissionTables[state] = /** @type {CustomTabulatorTable} */ (
                    submissionsPage.getSubmissionTable(state)
                );
            }
        }
    }

    connectedCallback() {
        super.connectedCallback();

        // Build table options after overrides are loaded so that column
        // labels use the overridden text on the very first render.
        // connectedCallback cannot be async, so we chain the work.
        const initTableOptions = async () => {
            if (this.langDir) {
                await setOverridesByGlobalCache(this._i18n, this);
            }
            this.updateFormsTableOptions();
            setSubmissionFormOptions(this, 'draft');
            setSubmissionFormOptions(this, 'submitted');
        };

        // Store the promise so other code paths can await it
        this._overridesReady = initTableOptions();

        this.updateComplete.then(async () => {
            // see: http://tabulator.info/docs/5.1
            document.addEventListener('keyup', this.boundKeyEventHandler);
            document.addEventListener('click', this.boundCloseActionsDropdownHandler);
            document.addEventListener(
                'dbp-tabulator-table-row-selection-changed-event',
                this.boundTableSelectionChanges,
            );
            document.addEventListener(
                'dbp-tabulator-table-page-loaded-event',
                this.boundTablePaginationPageLoaded,
            );

            document.addEventListener(
                'dbp-file-sink-download-started',
                this.boundFileSinkDownloadStartedHandler,
            );

            // listen for the SW message indicating that the download has started, to hide the loading indicator in the UI
            navigator.serviceWorker.addEventListener('message', this.boundSwMessageHandler);

            // Table built event listener
            document.addEventListener(
                'dbp-tabulator-table-built',
                (/** @type {CustomEvent} */ e) => {
                    if (e.detail.id) {
                        const state = this.getTableState(e.detail.id);
                        if (state) {
                            // Set visibility and name localization of columns based on form schema
                            setDefaultSubmissionTableOrder(this, state);

                            // Get settings from localStorage.
                            const columnsLoadedFromLocalStorage = restoreSubmissionTableSettings(
                                this,
                                state,
                            );
                            if (!columnsLoadedFromLocalStorage) {
                                // If no saved settings found, use schema settings
                                this.submissionTables[state].setColumns(
                                    this.submissionsColumnsInitial[state],
                                );
                            }
                            this.setIsActionAvailable(state);
                            this.setVisibleRowCount(state);

                            // Open detailed view modal if /details/[uuid] is in the URL
                            if (this.isRequestDetailedView) {
                                // Get the selected submission
                                const selectedIndex = this.submissions[state].findIndex(
                                    (submission) =>
                                        submission.submissionId === this.submissionIdToOpen,
                                );
                                const selectedSubmission =
                                    selectedIndex !== -1
                                        ? this.submissions[state][selectedIndex]
                                        : null;

                                if (selectedSubmission) {
                                    const cols = selectedSubmission;
                                    const id = selectedIndex + 1;
                                    // Open details modal
                                    this.requestDetailedSubmission(state, cols, id);
                                }
                            }
                        }
                    }
                },
            );
        });
    }

    updateFormsTableOptions() {
        const i18n = this._i18n;

        let langs_forms = {
            en: {
                columns: {
                    id: i18n.t('manage-forms.id', {lng: 'en'}),
                    name: i18n.t('manage-forms.name', {lng: 'en'}),
                },
            },
            de: {
                columns: {
                    id: i18n.t('manage-forms.id', {lng: 'de'}),
                    name: i18n.t('manage-forms.name', {lng: 'de'}),
                },
            },
        };

        this.options_forms = {
            langs: langs_forms,
            layout: 'fitColumns',
            columns: [
                {field: 'id', width: 64, sorter: 'number'},
                {field: 'name', sorter: 'string'},
                // Hidden helper columns carrying data needed for bulk deletion.
                {field: 'formId', visible: false},
                {field: 'grantedActions', visible: false},
                {
                    field: 'actionButton',
                    formatter: 'html',
                    hozAlign: 'right',
                    minWidth: 64,
                    headerSort: false,
                },
            ],
            columnDefaults: {
                vertAlign: 'middle',
                hozAlign: 'left',
                resizable: false,
            },
        };

        // Row selection is only needed when bulk form removal is enabled.
        if (this.enableFormsBulkDelete) {
            this.options_forms.selectableRows = 'highlight';
            this.options_forms.rowHeader = {
                formatter: 'rowSelection',
                titleFormatter: 'rowSelection',
                titleFormatterParams: {
                    rowRange: 'visible',
                },
                headerSort: false,
                resizable: false,
                frozen: true,
                headerHozAlign: 'center',
                hozAlign: 'center',
                // With the "fitColumns" layout every column grows to fill the row.
                // Pin the selection column to the checkbox width so it doesn't
                // stretch across the table like it did before.
                width: 40,
                minWidth: 40,
                widthGrow: 0,
                widthShrink: 0,
            };
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

    rebuildFormsTable() {
        this.refreshTableReferences();
        if (!this.formsTable) return;

        // The child component receives `options_forms` through Lit rendering.
        // When this method is called during the same update cycle that changes
        // `options_forms`, that render may not have propagated yet. Push the
        // fresh options directly before rebuilding so Tabulator never builds
        // from stale options without the row-selection header.
        this.formsTable.options = this.options_forms;
        this.formsTable.data = this.allForms;

        if (this.formsTable.tabulatorTable) {
            this.formsTable.tabulatorTable.destroy();
        }
        this.formsTable.tableReady = false;
        this.formsTable.tableBuilding = false;
        this.formsTable.buildTable();
    }

    async firstUpdated() {
        this.refreshTableReferences();

        if (this.auth.token === '' || this.allForms.length > 0) {
            return;
        }

        // If we arrive from another activity, auth is not updated
        // we need to init form-loading here.
        if (this.forms.size === 0) {
            await loadModules(this);
            // Refresh count after modules are loaded so the button visibility is updated
            this.getCreatableModules();
        }
        await getListOfAllForms(this);
    }

    async loginCallback() {
        if (this.forms.size === 0) {
            await loadModules(this);
            // Refresh count after modules are loaded so the button visibility is updated
            this.getCreatableModules();
        }
        await getListOfAllForms(this);
    }

    async updated(changedProperties) {
        // Ensure translation overrides are loaded BEFORE any table is built
        // so that column labels, placeholders, etc. use overridden text on
        // the very first render — not just after a second language switch.
        if (changedProperties.has('lang') || changedProperties.has('langDir')) {
            if (this.langDir) {
                await setOverridesByGlobalCache(this._i18n, this);
            }

            this.updateFormsTableOptions();
            setSubmissionFormOptions(this, 'draft');
            setSubmissionFormOptions(this, 'submitted');

            this.rebuildFormsTable();
        }

        if (
            changedProperties.has('enableFormsBulkDelete') &&
            !changedProperties.has('lang') &&
            !changedProperties.has('langDir')
        ) {
            this.updateFormsTableOptions();
            this.setFormsActionButtonsState();

            this.rebuildFormsTable();
        }

        if (changedProperties.has('allForms')) {
            // Wait for the initial override load started in connectedCallback
            // so that column labels are correct on the very first table build.
            if (this._overridesReady) {
                await this._overridesReady;
            }

            // Build tables
            if (this.allForms && this.allForms.length > 0) {
                this.noFormsAvailable = false;
                // We will use the first URL segment after the activity as identifier for the form's submissions
                const formId = this.getRoutingData().pathSegments[0] || '';

                if (formId) {
                    // Check if the form-id is one of the forms identifiers.
                    const form = this.forms.get(formId);
                    if (form) {
                        // Skip switching if we are already showing this form's
                        // submissions and the table is still intact.  This
                        // prevents a full table destroy/rebuild cycle when
                        // allForms is reassigned with identical data (e.g.
                        // after a background token refresh).
                        const alreadyShowing =
                            this.activeFormId === formId &&
                            this.showSubmissionTables &&
                            !this.loadingSubmissionTables;
                        if (!alreadyShowing) {
                            this.switchToSubmissionTable(form);
                        }
                    } else {
                        sendNotification({
                            summary: this._i18n.t('errors.notfound-title'),
                            body: this._i18n.t('errors.notfound-body'),
                            type: 'danger',
                            timeout: 0,
                        });
                    }
                } else {
                    this.refreshTableReferences();
                    if (this.formsTable) {
                        // Only rebuild the forms table when it hasn't been
                        // built yet.  If it is already showing, just update
                        // the data in-place so the user doesn't see a flash.
                        if (!this.formsTable.tableReady) {
                            this.formsTable.options = this.options_forms;
                            this.formsTable.data = this.allForms;
                            this.formsTable.buildTable();
                        } else {
                            this.formsTable.setData(this.allForms);
                        }
                        this.loadingFormsTable = false;
                        this.showFormsTable = true;
                        this.showSubmissionTables = false;
                    }
                }
            } else if (this.allForms) {
                // allForms is defined but empty — all forms were filtered out by the allow/deny list.
                // Stop the loading spinner and show an empty table with a message instead.
                this.noFormsAvailable = true;
                this.refreshTableReferences();
                if (this.formsTable) {
                    this.formsTable.options = this.options_forms;
                    this.formsTable.data = [];
                    this.formsTable.buildTable();
                }
                this.loadingFormsTable = false;
                this.showFormsTable = true;
                this.showSubmissionTables = false;
            }
        }

        if (changedProperties.has('routingUrl')) {
            // Prepend a slash to the URL if it doesn't start with one
            let newUrl = !this.routingUrl.match(/^\//) ? `/${this.routingUrl}` : this.routingUrl;
            const prevUrl = changedProperties.get('routingUrl');
            let oldUrl = prevUrl && !prevUrl.match(/^\//) ? '/' + prevUrl : prevUrl;

            if (oldUrl === undefined) return;

            // Remove hash from URLs
            newUrl = newUrl.replace(/^(.*)#.*$/, '$1');
            oldUrl = oldUrl.replace(/^(.*)#.*$/, '$1');

            if (oldUrl !== newUrl) {
                if (this.forms.size === 0 && this.isLoggedIn()) {
                    await loadModules(this);
                    // Refresh count after modules are loaded so the button visibility is updated
                    this.getCreatableModules();
                    await getListOfAllForms(this);
                }

                // Show submission table
                const formId = this.getRoutingData().pathSegments[0] || '';
                if (formId) {
                    const form = this.forms.get(formId);
                    if (form) {
                        this.switchToSubmissionTable(form);
                    }
                } else {
                    // Show the forms table
                    this.refreshTableReferences();
                    if (this.formsTable) {
                        if (!this.formsTable.tableReady) {
                            this.formsTable.options = this.options_forms;
                            this.formsTable.data = this.allForms;
                            this.formsTable.buildTable();
                        }
                        this.loadingFormsTable = false;
                        this.showFormsTable = true;
                        this.showSubmissionTables = false;
                    }
                }
            }
        }

        if (changedProperties.has('submissions') && !this._isSwitchingTable) {
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
                        // so buildTable() doesn't read stale options.data that is
                        // still cached from ManageFormSubmissionsPage's previous
                        // render cycle.
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

        if (changedProperties.has('lang')) {
            await getListOfAllForms(this);

            const activeForm = this.forms.get(this.activeFormId);
            if (activeForm) {
                const activeFormSlug = activeForm ? activeForm.formSlug : null;
                this.createSubmissionUrl = activeFormSlug
                    ? getFormRenderUrl(activeFormSlug, this.lang)
                    : '';
                // To re-create get-submission-links with the new language
                this.switchToSubmissionTable(activeForm);
            }
        }

        if (
            changedProperties.has('allowListFrontendKeys') ||
            changedProperties.has('denyListFrontendKeys')
        ) {
            // Deep-compare the old and new values so we don't refetch when the
            // provider re-dispatches the same arrays (e.g. after a token refresh).
            const oldAllow = changedProperties.get('allowListFrontendKeys');
            const oldDeny = changedProperties.get('denyListFrontendKeys');
            const allowChanged =
                changedProperties.has('allowListFrontendKeys') &&
                JSON.stringify(oldAllow) !== JSON.stringify(this.allowListFrontendKeys);
            const denyChanged =
                changedProperties.has('denyListFrontendKeys') &&
                JSON.stringify(oldDeny) !== JSON.stringify(this.denyListFrontendKeys);

            if ((allowChanged || denyChanged) && this.isLoggedIn()) {
                console.log(
                    'updated: allowListFrontendKeys/denyListFrontendKeys changed',
                    this.allowListFrontendKeys,
                    this.denyListFrontendKeys,
                    'isLoggedIn:',
                    this.isLoggedIn(),
                );
                await getListOfAllForms(this);
            }
        }

        super.updated(changedProperties);
    }

    /**
     * Display the form submission table for the given form
     * @param {object} form - form object
     */
    switchToSubmissionTable(form) {
        this.activeFormName = form.formName;
        this.activeFormId = form.formId;
        this.showFormsTable = false;
        this.loadingSubmissionTables = true;

        // Reset availableTags when switching forms
        this.availableTags = [];

        // Prevent updated('submissions') from interfering while we load
        this._isSwitchingTable = true;

        // Reset submissions so stale data from a previous form is never shown.
        // Done after setting the guard so updated('submissions') won't react.
        this.submissions = {submitted: [], draft: []};
        // Invalidate any previous in-flight switchToSubmissionTable call
        const generation = ++this._switchGeneration;

        getAllFormSubmissions(this, this.activeFormId)
            .then(async () => {
                // If a newer switchToSubmissionTable was called while we were
                // waiting, discard this stale result.
                if (generation !== this._switchGeneration) return;

                // Ensure the child component has rendered so table refs exist
                const submissionsPage = this.getSubmissionsPage();
                if (submissionsPage) {
                    await submissionsPage.updateComplete;
                }
                this.refreshTableReferences();

                const activeForm = this.forms.get(this.activeFormId);
                const activeFormSlug = activeForm ? activeForm.formSlug : null;

                // if slug is an uuid ["e78869ce-e9b3-4df2-854b-cf88a35285f5"], do not create submission URL as it is not a renderable form
                this.createSubmissionUrl =
                    activeFormSlug &&
                    !activeFormSlug.match(/[\w\d]{8}-[\w\d]{4}-[\w\d]{4}-[\w\d]{4}-[\w\d]{12}/)
                        ? getFormRenderUrl(activeFormSlug, this.lang)
                        : '';

                // Fetch available tags for this form before building the table
                // This ensures availableTags is populated when setDefaultSubmissionTableOrder runs
                await apiGetTags(this, this.activeFormId);

                // Check again after the await — a newer call may have started
                if (generation !== this._switchGeneration) return;

                // For tabulatorTable 'draft' and 'submitted'
                for (const state of Object.keys(this.submissionTables)) {
                    if (this.submissionTables[state]) {
                        const tableComponent = this.submissionTables[state];

                        // Destroy the old tabulator so stale data and event
                        // listeners from a previous form don't bleed through.
                        if (tableComponent.tabulatorTable) {
                            tableComponent.tabulatorTable.destroy();
                        }
                        // Reset the wrapper component's build flags so that a
                        // subsequent Lit property update doesn't skip buildTable().
                        tableComponent.tableReady = false;
                        tableComponent.tableBuilding = false;
                        // Clear the component-level data so the old array doesn't
                        // survive into the next buildTable() cycle.
                        tableComponent.data = [];

                        // Re-create options from scratch so we never inherit stale state
                        setSubmissionFormOptions(this, state);

                        if (this.submissions[state].length === 0) {
                            // There is no submission data
                            this.loadingSubmissionTables = false;
                            this.showSubmissionTables = true; // show back button
                            this.showFormsTable = false;
                            disableCheckboxSelection(this, state);
                            disablePagination(this, state);

                            this.options_submissions[state].data = [];
                        } else {
                            enableCheckboxSelection(this, state);
                            enablePagination(this, state);

                            // Set the data on the freshly-created options object
                            this.options_submissions[state].data = this.submissions[state];

                            this.loadingSubmissionTables = false;
                            this.showSubmissionTables = true;
                            this.showFormsTable = false;

                            // Open submission details modal if /details/[uuid] is in the URL
                            const routingData = this.getRoutingData();
                            this.submissionIdToOpen =
                                routingData.pathSegments[2] &&
                                routingData.pathSegments[2].match(/[0-9a-f-]+/)
                                    ? routingData.pathSegments[2]
                                    : null;
                            const isRequestDetailedView =
                                routingData.pathSegments[1] === 'details' &&
                                this.submissionIdToOpen;

                            // Open modal from the `dbp-tabulator-table-built` event listener
                            this.isRequestDetailedView = isRequestDetailedView;
                        }
                    }
                }

                // Reactively propagate the final options so the child component
                // has the same reference the tabulator will use.
                this.options_submissions = {...this.options_submissions};

                this._isSwitchingTable = false;
            })
            .catch(() => {
                this._isSwitchingTable = false;
            });
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
     * Gets the detailed data of a specific row
     * @param {string} state - The state of the submission ('draft' or 'submitted').
     * @param entry
     * @param pos
     */
    requestDetailedSubmission(state, entry, pos) {
        const modal = this.getSubmissionModal(state);
        if (!modal) {
            return;
        }

        const contentItems = [];

        if (this.submissionsColumns[state].length !== 0) {
            for (let current_column of this.submissionsColumns[state]) {
                if (
                    current_column &&
                    current_column.field &&
                    current_column.field !== 'htmlButtons' &&
                    current_column.field !== 'rowIndex'
                ) {
                    const labelText = current_column.title
                        ? xss(current_column.title)
                        : xss(current_column.field);
                    const files = this.getSubmittedFilesForField(
                        state,
                        entry.submissionId,
                        current_column.field,
                    );
                    const value =
                        current_column.field === 'dateCreated'
                            ? humanReadableDate(entry[current_column.field])
                            : xss(entry[current_column.field] ?? '');
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
                        ? {
                              label: xss(key),
                              type: 'files',
                              files,
                          }
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

        this.showDetailedModal(state);
    }

    /**
     * Opens submission detail Modal
     */
    showDetailedModal(state) {
        const modal = this.getSubmissionModal(state);
        if (modal) {
            modal.show();
        }
    }

    /**
     * Shows entry of a specific position of this.submissionTable
     * @param {string} state - 'draft' or 'submitted'
     * @param {number} positionToShow
     * @param {"next"|"previous"} direction
     */
    async showEntryOfPos(state, positionToShow, direction) {
        if (positionToShow > this.totalNumberOfItems[state] || positionToShow < 1) return;

        const table = this.submissionTables[state];
        if (!table) return;

        let rows = table.getRows();

        let next_row = rows[positionToShow - 1];
        let cells = next_row.getCells();
        let next_data = {};
        for (let cell of cells) {
            let column = cell.getColumn();
            let definition = column.getDefinition();
            if (definition.formatter !== 'html') {
                next_data[cell.getField()] = cell.getValue();
            }
        }

        // Append /details/submissionId to the URL
        addDetailsToUrl(next_data.submissionId, metadata['routing_name']);

        this.requestDetailedSubmission(state, next_data, positionToShow);
    }

    // -----------------------------------------------------------------------
    // Export
    // -----------------------------------------------------------------------

    /**
     * Export the specific table
     *
     * @param e
     */
    async exportSubmissionTable(e, state) {
        const exportInput = /** @type {HTMLSelectElement} */ (e.target);

        if (!exportInput) return;

        let exportValue = exportInput.value;
        if (!exportValue || exportValue === '') return;

        if (e) e.stopPropagation();

        if (exportValue === 'attachments') {
            // Download all attachments of the current submission table
            const downloadFiles = [];

            // Get selected rows or all rows if no selection
            const selectedRowsObjects =
                this.submissionTables[state].tabulatorTable.getSelectedRows();
            let rowsToExport;
            let selectedRowsSubmissionIds = [];
            if (selectedRowsObjects && selectedRowsObjects.length > 0) {
                rowsToExport = selectedRowsObjects;
            } else {
                rowsToExport = this.submissionTables[state].tabulatorTable.getRows();
            }

            // Get submissionIds of selected rows
            rowsToExport.forEach((row) => {
                const data = row.getData();
                selectedRowsSubmissionIds.push(data.submissionId);
            });

            for (const [submissionId, attachments] of this.submittedFileDetails[state]) {
                // If there are selected rows, only download the attachments of the selected rows
                if (
                    selectedRowsSubmissionIds.length > 0 &&
                    !selectedRowsSubmissionIds.some((row) => row === submissionId)
                ) {
                    continue;
                }
                if (!attachments || attachments.length === 0) continue;

                // Add folder name from the schema if available, fallback to submissionId
                const downloadFolderName = this.getDownloadFolderName(submissionId, state);

                attachments.forEach((attachment) => {
                    // No subfolders, just download all files into one folder
                    if (this.useSubFoldersForExports === false) {
                        downloadFiles.push({
                            name: attachment.fileName,
                            url: attachment.downloadUrl,
                        });
                    } else {
                        // Use subfolder for each submission
                        downloadFiles.push({
                            name: `${downloadFolderName}/${attachment.fileName}`,
                            url: attachment.downloadUrl,
                        });
                    }
                });
            }

            this._('#file-sink').files = downloadFiles;
        } else {
            const table = this.submissionTables[state];
            table.download(exportValue, this.activeFormName);
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

        // Fallback to submissionId if no pattern is set or no submission data found
        if (
            !this.downloadFolderNamePattern ||
            this.downloadFolderNamePattern === '' ||
            !submissionData
        ) {
            return submissionData['submissionId'];
        }

        let fieldPatterns = this.downloadFolderNamePattern.split('_');
        let folderNameParts = [];

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
                    // Get field value and replace spaces with dashes
                    folderNameParts.push(`${submissionData[schemaField]}`.replace(/\s+/g, '-'));
                }
            }
        }

        // Fallback to submissionId if pattern matching failed (no field data available)
        if (patternMatchingFailed || folderNameParts.length === 0) {
            return submissionData['submissionId'];
        }

        const folderName = folderNameParts.join('_');
        // Cut to max 230 characters to avoid issues with long file paths
        return folderName.substring(0, 230);
    }

    // -----------------------------------------------------------------------
    // Search / filter
    // -----------------------------------------------------------------------

    /**
     * Filters the submissions table
     */
    filterTable(state) {
        const submissionsPage = this.getSubmissionsPage();
        let filter = /** @type {HTMLInputElement} */ (submissionsPage?.getSearchbar(state));
        let search = /** @type {HTMLSelectElement} */ (submissionsPage?.getSearchSelect(state));
        let operator = /** @type {HTMLSelectElement} */ (submissionsPage?.getSearchOperator(state));

        const table = this.submissionTables[state];

        if (!filter || !search || !operator || !table) return;

        if (filter.value === '') {
            table.clearFilter();
            return;
        }
        const filterValue = filter.value;
        const searchValue = search.value;
        const operatorValue = operator.value;

        if (searchValue !== 'all') {
            let filter_object = {field: searchValue, type: operatorValue, value: filterValue};
            table.tabulatorTable.deselectRow();

            table.setFilter([filter_object]);

            this.setVisibleRowCount(state);
            this.searchIsActive = {...this.searchIsActive, [state]: true};
        } else {
            const columns = table.getColumnsFields();
            let listOfFilters = [];
            for (let col of columns) {
                if (col && col !== 'htmlButtons') {
                    let filter_object = {field: col, type: operatorValue, value: filterValue};
                    listOfFilters.push(filter_object);
                }
            }
            table.tabulatorTable.deselectRow();
            table.setFilter([listOfFilters]);

            this.setVisibleRowCount(state);
            this.searchIsActive = {...this.searchIsActive, [state]: true};
        }
    }

    /**
     * Removes the current filters from the submissions table
     */
    clearAllFilters() {
        for (const state of Object.keys(this.submissionTables)) {
            const submissionsPage = this.getSubmissionsPage();
            let searchInput = /** @type {HTMLInputElement} */ (
                submissionsPage?.getSearchbar(state)
            );
            let searchColumn = /** @type {HTMLSelectElement} */ (
                submissionsPage?.getSearchSelect(state)
            );
            let searchOperator = /** @type {HTMLSelectElement} */ (
                submissionsPage?.getSearchOperator(state)
            );
            const table = this.submissionTables[state];

            if (!table || !searchInput || !searchColumn || !searchOperator) return;

            searchInput.value = '';
            searchColumn.value = 'all';
            searchOperator.value = 'like';
            table.clearFilter();
            this.searchIsActive = {...this.searchIsActive, [state]: false};
            this.setVisibleRowCount(state);
        }
    }

    // -----------------------------------------------------------------------
    // Event handlers
    // -----------------------------------------------------------------------

    /**
     * Handle key events for the searchBar
     */
    handleKeyEvents(event) {
        const activeElement = this.getSubmissionsPage()?.shadowRoot?.activeElement;

        if (activeElement && activeElement.classList.contains('searchbar')) {
            // ENTER
            if (event.keyCode === 13) {
                event.preventDefault();
                const state = activeElement.getAttribute('data-state');
                this.filterTable(state);
            }
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

    handleTablePaginationPageLoaded(event) {
        const tableId = event.detail.tableId;
        const state = this.getTableState(tableId);

        if (!state) return;

        this.setVisibleRowCount(state);
    }

    setVisibleRowCount(state) {
        this.visibleRowCount = {
            ...this.visibleRowCount,
            [state]: this.submissionTables[state].tabulatorTable.getRows('active').length,
        };
    }

    setSelectedRowCount(state) {
        const selectedRows = this.submissionTables[state].tabulatorTable.getSelectedRows();
        this.selectedRowCount = {...this.selectedRowCount, [state]: selectedRows.length};
    }

    handleFileSinkDownloadStarted(event) {
        this._downloadStreamingStarted = false;
        const modal = this.renderRoot?.querySelector('#loading-indicator-modal');
        if (modal) {
            modal.open();
        }
    }

    handleSwMessage(event) {
        if (event.data?.type === 'DOWNLOAD_STARTED') {
            const modal = this.renderRoot?.querySelector('#loading-indicator-modal');
            if (modal) {
                // Mark streaming as started so the close handler does not cancel the download
                this._downloadStreamingStarted = true;
                modal.close();
            }
        }
    }

    /**
     * Handle the loading indicator modal being closed.
     * If the download has already started streaming, closing the modal is just
     * cleanup and we must not cancel. Otherwise the user closed the modal
     * (via X button or Escape) to abort the in-flight preparation requests.
     */
    handleLoadingIndicatorModalClosed() {
        if (this._downloadStreamingStarted) {
            return;
        }

        const fileSink = this._('#file-sink');
        if (fileSink) {
            fileSink.cancelStreamedDownload();
        }
    }

    /**
     * Reset action buttons state if table selection changes
     * @param {CustomEvent} tableEvent
     */
    handleTableSelectionChanges(tableEvent) {
        const selectedRows = tableEvent.detail.selected;
        const deSelectedRows = tableEvent.detail.deselected;

        // The event can fire with both arrays empty (e.g. when a table clears
        // its selection while rebuilding). In that case there is no row to
        // derive the originating table from, so just refresh the forms bulk
        // action state (selection is now empty) and bail out.
        const referenceRow = selectedRows[0] ?? deSelectedRows[0];
        if (!referenceRow) {
            this.setFormsActionButtonsState();
            return;
        }

        const activeTable = referenceRow.getTable();

        const root = activeTable.element.getRootNode();
        if (root instanceof ShadowRoot) {
            const tabulatorTableComponent = root.host;

            // The forms overview table has its own selection handling for bulk deletion.
            if (tabulatorTableComponent.identifier === 'forms-table') {
                this.setFormsActionButtonsState();
                return;
            }

            const state = this.getTableState(tabulatorTableComponent.identifier);
            this.selectedRowCount = {...this.selectedRowCount, [state]: selectedRows.length};

            this.setIsActionAvailable(state);
        }
    }

    /**
     * Recompute whether the currently selected forms can be deleted.
     * Deletion is only allowed when every selected form grants the delete
     * (or manage) permission via its grantedActions.
     */
    setFormsActionButtonsState() {
        if (!this.enableFormsBulkDelete || !this.formsTable?.tabulatorTable) {
            this.selectedFormsCount = 0;
            this.isDeleteSelectedFormsEnabled = false;
            return;
        }

        const selectedRows = this.formsTable.tabulatorTable.getSelectedRows();
        this.selectedFormsCount = selectedRows.length;

        if (selectedRows.length === 0) {
            this.isDeleteSelectedFormsEnabled = false;
            return;
        }

        // Every selected form must grant delete or manage for the bulk action to be allowed.
        this.isDeleteSelectedFormsEnabled = selectedRows.every((row) => {
            const formId = row.getData().formId;
            const grants =
                this.formsGrantedActions.get(formId) ?? row.getData().grantedActions ?? [];
            return (
                grants.includes(FORM_PERMISSIONS.DELETE) || grants.includes(FORM_PERMISSIONS.MANAGE)
            );
        });
    }

    /**
     * Delete the currently selected forms after confirmation.
     * Only forms whose grantedActions allow deletion are removed.
     */
    async handleDeleteForms() {
        if (!this.enableFormsBulkDelete || !this.formsTable?.tabulatorTable) return;

        const rows = this.formsTable.tabulatorTable.getSelectedRows();
        const data = this.formsTable.tabulatorTable.getSelectedData();

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
        // The override is scoped to this call and does not mutate the shared
        // modal, so the submission deletion flow keeps its own text.
        const confirmed = deletionModal
            ? await deletionModal.confirm({
                  messageKey: 'manage-forms.delete-forms-confirmation-message',
                  messageLi2Key: 'manage-forms.delete-forms-confirmation-message-li2',
              })
            : false;
        if (!confirmed) return;

        let responseStatus = [];
        let index = 0;
        for (const form of data) {
            const formId = form.formId;
            const grants = this.formsGrantedActions.get(formId) ?? form.grantedActions ?? [];

            // Skip forms the user is not allowed to delete.
            if (
                !grants.includes(FORM_PERMISSIONS.DELETE) &&
                !grants.includes(FORM_PERMISSIONS.MANAGE)
            ) {
                index++;
                continue;
            }

            const response = await apiDeleteForm(this, formId);
            responseStatus.push(response);

            if (response === true) {
                rows[index].delete();
                this.formsGrantedActions.delete(formId);
                // Remove the deleted form from the cached lists.
                this.allForms = this.allForms.filter((entry) => entry.formId !== formId);
                this.forms.delete(formId);
            }
            index++;
        }

        this.noFormsAvailable = this.allForms.length === 0;
        this.setFormsActionButtonsState();
        // Keep the dynamically referenced notification keys in the i18next output.
        keepDynamicTranslations((key) => this._i18n.t(key));
        successFailureNotification(this, responseStatus, {
            successKey: 'success.forms-processed',
            failureKey: 'errors.forms-processing-failed',
        });
    }

    // -----------------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------------

    setIsActionAvailable(state) {
        this.setActionButtonsStates(state);
        if (
            this.isEditSubmissionEnabled[state] === false &&
            this.isEditSubmissionPermissionEnabled[state] === false &&
            this.isDeleteAllSubmissionEnabled[state] === false &&
            this.isDeleteSelectedSubmissionEnabled[state] === false &&
            this.isBatchTaggingEnabled[state] === false
        ) {
            this.isActionAvailable = {...this.isActionAvailable, [state]: false};
        } else {
            this.isActionAvailable = {...this.isActionAvailable, [state]: true};
        }
    }

    /**
     * Toggle actions dropdown
     * @param {string} state - form state. draft, or submitted
     */
    toggleActionsDropdown(state) {
        this.actionsWidgetIsOpen = {
            ...this.actionsWidgetIsOpen,
            [state]: !this.actionsWidgetIsOpen[state],
        };
    }

    /**
     * Close all actions dropdowns
     */
    closeAllActionsDropdown() {
        this.actionsWidgetIsOpen = {
            draft: false,
            submitted: false,
        };
    }

    /**
     * Set action buttons states
     * @param {string} state - form state. draft or submitted
     */
    setActionButtonsStates(state) {
        if (!this.submissionTables[state].tabulatorTable) return;

        const selectedRows = this.submissionTables[state].tabulatorTable.getSelectedRows();
        const allRows = this.submissionTables[state].tabulatorTable.getRows('all');

        let selectedSubmissionsGrants = new Set();
        for (const row of selectedRows) {
            const submissionId = row.getData().submissionId;
            const grants = this.submissionsGrantedActions.get(submissionId);
            grants?.forEach((grant) => selectedSubmissionsGrants.add(grant));
        }

        let allSubmissionsGrants = new Set();
        for (const row of allRows) {
            const submissionId = row.getData().submissionId;
            const grants = this.submissionsGrantedActions.get(submissionId);
            grants?.forEach((grant) => allSubmissionsGrants.add(grant));
        }
        console.log(`allSubmissionsGrants`, allSubmissionsGrants);

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

        // this.isBatchTaggingEnabled = {
        //     ...this.isBatchTaggingEnabled,
        //     [state]:
        //         selectedCount > 0 && selectedSubmissionsGrants.has(SUBMISSION_PERMISSIONS.ADD_TAGS),
        // };
        // Disable batch tagging for now until we implement tag-based permissions
        this.isBatchTaggingEnabled[state] = false;

        this.isEditSubmissionPermissionEnabled = {
            ...this.isEditSubmissionPermissionEnabled,
            [state]:
                selectedCount === 1 && selectedSubmissionsGrants.has(SUBMISSION_PERMISSIONS.MANAGE),
        };
    }

    handleEditSubmissionsPermission(state) {
        const permissionDialog = this._('#grant-permission-dialog');
        const data = this.submissionTables[state].tabulatorTable.getSelectedData();
        const submissionId = data[0].submissionId;

        if (submissionId) {
            permissionDialog.resourceIdentifier = submissionId;
            permissionDialog.open();
        }
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

    async handleBatchTaggingConfirm(event) {
        const {tags, justAdd} = event.detail;
        const batchTaggingModal = this._('#batch-tagging-modal');
        const button = batchTaggingModal?.getConfirmButton();

        if (button) {
            button.spinner = true;
            button.start();
        }

        // PATCH submissions with the new tags.
        let responseStatus = [];
        let responseDetailedStatus = [];
        let submissionFinalTagsMap = new Map();

        for (const submissionId of this.submissionIdsForTagging) {
            try {
                // Find current tags from rawSubmissions
                const rawSubmission = this.rawSubmissions.find(
                    (sub) => sub.identifier === submissionId,
                );
                const currentTags = rawSubmission?.tags || [];

                let finalTags;
                if (justAdd) {
                    // Add new tags to existing ones and remove duplicates
                    const mergedTags = [...currentTags, ...tags];
                    finalTags = [...new Set(mergedTags)];
                } else {
                    // Replace all tags with selected ones
                    finalTags = [...tags];
                }

                const response = await apiUpdateSubmissionTags(this, submissionId, finalTags);
                responseStatus.push(response);
                responseDetailedStatus.push({status: response, submissionId: submissionId});

                // Store final tags for table update and update rawSubmissions
                if (response && rawSubmission) {
                    submissionFinalTagsMap.set(submissionId, finalTags);
                    rawSubmission.tags = finalTags;
                }
            } catch (error) {
                console.error(`Failed to update tags for submission ${submissionId}:`, error);
                responseStatus.push(false);
                responseDetailedStatus.push({status: false, submissionId: submissionId});
            }
        }

        // Unselect processed rows and update table
        const state = this.currentStateForBatchTagging;
        const tabulatorTable = this.submissionTables[state].tabulatorTable;
        tabulatorTable
            .getRows()
            .filter((row) => {
                const res = responseDetailedStatus.find(
                    (res) => res.submissionId === row.getData().submissionId,
                );
                return res && res.status === true;
            })
            .forEach((row) => {
                const submissionId = row.getData().submissionId;
                const finalTags = submissionFinalTagsMap.get(submissionId) || [];
                row.update({
                    tags: Array.isArray(finalTags)
                        ? finalTags.map((tag) => `<span class="tag">${xss(tag)}</span>`).join(' ')
                        : '',
                });
                row.deselect();
            });

        // Recalculate column widths after updating rows
        tabulatorTable.redraw(true);

        if (button) {
            button.spinner = false;
            button.stop();
        }
        if (batchTaggingModal) {
            batchTaggingModal.close();
        }

        this.requestUpdate();
        // Report
        successFailureNotification(this, responseStatus);
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

        // Keep creatableModulesCount in sync so dependent components can react
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
     */
    handleOpenEditFormDialog(formId) {
        const dialog = this._('#edit-form-dialog');
        if (!dialog) return;

        const formEntry = this.forms.get(formId);
        if (!formEntry) return;

        // Build the existingForm object the dialog and form component need
        dialog.existingForm = {
            formId: formEntry.formId,
            formSlug: formEntry.formSlug,
            formName: formEntry.formName,
            moduleInstance: formEntry.moduleInstance,
            additionalData: formEntry.additionalData || null,
            localizedNames: formEntry.localizedNames || [],
        };
        dialog.open();
    }

    /**
     * Handles the form creation success from the dialog's embedded component.
     * Refreshes the forms list after a new form is created.
     * @param {CustomEvent} event
     */
    async handleCreateFormCreated(event) {
        // Reload the forms list to include the newly created form
        await getListOfAllForms(this);
    }

    /**
     * Handles the form edit success from the dialog's embedded component.
     * Refreshes the forms list to reflect the updated form data.
     * @param {CustomEvent} event
     */
    async handleEditFormSaved(event) {
        await getListOfAllForms(this);
    }

    handleEditSubmissions(event, state) {
        const data = this.submissionTables[state].tabulatorTable.getSelectedData();
        const submissionId = data[0].submissionId;

        // Redirect to render-form activity to display the readonly form with submission values
        const activeForm = this.forms.get(this.activeFormId);
        const activeFormSlug = activeForm ? activeForm.formSlug : null;

        if (
            activeForm &&
            activeFormSlug &&
            activeForm.moduleInstance &&
            typeof activeForm.moduleInstance.hasReadOnlyMode === 'function' &&
            activeForm.moduleInstance.hasReadOnlyMode()
        ) {
            // Go to the edit submission
            let formSubmissionUrl =
                getFormRenderUrl(activeFormSlug, this.lang) + `/${submissionId}`;
            const url = new URL(formSubmissionUrl);
            url.searchParams.set('validate', 'true');
            window.history.pushState({}, '', url);

            // Middle click opens in a new tab
            if (event.button === 1) {
                window.open(url.toString(), '_blank');
            } else {
                // Left click navigates to the URL
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
     * Delete submissions visible in the table or all submissions
     * @param {string} state - form state. draft or submitted
     * @param {boolean} selectedOnly - if true only the selected submissions are deleted
     */
    async handleDeleteSubmissions(state, selectedOnly = false) {
        const data = selectedOnly
            ? this.submissionTables[state].tabulatorTable.getSelectedData()
            : this.submissionTables[state].tabulatorTable.getData('all');

        const rows = selectedOnly
            ? this.submissionTables[state].tabulatorTable.getSelectedRows()
            : this.submissionTables[state].tabulatorTable.getRows('all');

        if (data.length > 0) {
            const deletionModal = this._('#deletion-modal');
            const confirmed = deletionModal ? await deletionModal.confirm() : false;
            if (!confirmed) return;

            let responseStatus = [];
            let failedRequestToSelect = [];
            let index = 0;
            for (const submission of data) {
                const response = await apiDeleteSubmission(this, submission.submissionId);
                responseStatus.push(response);
                // Delete row from the table
                if (response === true) {
                    rows[index].delete();

                    // Remove entry from this.submissions[state]
                    const filteredSubmissions = this.submissions[state].filter((sub) => {
                        return sub.submissionId !== submission.submissionId;
                    });
                    this.submissions = {...this.submissions, [state]: filteredSubmissions};

                    // Remove entry from options.data
                    this.options_submissions = {
                        ...this.options_submissions,
                        [state]: {
                            ...this.options_submissions[state],
                            data: this.options_submissions[state].data.filter((sub) => {
                                return sub.submissionId !== submission.submissionId;
                            }),
                        },
                    };
                } else {
                    failedRequestToSelect.push(submission.submissionId);
                }
                index++;
            }

            // When every row has been deleted, explicitly clear the table so
            // the last row doesn't stick around due to stale Tabulator state.
            if (this.submissions[state].length === 0) {
                this.submissionTables[state].tabulatorTable.clearData();
            }

            // Update status bar counters and action buttons state
            this.setVisibleRowCount(state);
            this.setSelectedRowCount(state);
            this.setIsActionAvailable(state);

            // Update row-indexes
            this.submissionTables[state].tabulatorTable.redraw(true);
            // Report
            successFailureNotification(this, responseStatus);

            // Re-select failed submissions
            if (failedRequestToSelect.length > 0) {
                const table = this.submissionTables[state];
                for (const failedSubmissionId of failedRequestToSelect) {
                    table
                        .getRows()
                        .filter((row) => row.getData().submissionId === failedSubmissionId)
                        .forEach((row) => row.select());
                }
            }
        } else {
            sendNotification({
                summary: this._i18n.t('errors.warning-title'),
                body: this._i18n.t('errors.no-submission-selected'),
                type: 'warning',
                timeout: 10,
            });
        }
    }

    // -----------------------------------------------------------------------
    // Navigation / routing helpers
    // -----------------------------------------------------------------------

    closeAllSearchWidgets() {
        this.searchWidgetIsOpen = {draft: false, submitted: false};
    }

    handleBackToOverview() {
        this.showSubmissionTables = false;
        this.loadingSubmissionTables = false;
        this.clearAllFilters();
        this.closeAllSearchWidgets();
        this.loadingFormsTable = false;
        this.showFormsTable = true;
        this.activeFormId = null;

        // Direct links to a submissions page skip the initial overview table build.
        this.refreshTableReferences();
        if (this.formsTable) {
            if (!this.formsTable.tableReady) {
                this.formsTable.options = this.options_forms;
                this.formsTable.data = this.allForms;
                this.formsTable.buildTable();
            } else {
                this.formsTable.setData(this.allForms);
            }
        }

        this.sendSetPropertyEvent('routing-url', '/', true);
    }

    // -----------------------------------------------------------------------
    // Child component event handlers
    // -----------------------------------------------------------------------

    handleSubmissionsPageSearchToggle(event) {
        const {state, open} = event.detail;
        this.searchWidgetIsOpen = {
            ...this.searchWidgetIsOpen,
            [state]: open,
        };
    }

    handleSubmissionsPageActionsToggle(event) {
        const {state, open} = event.detail;
        this.actionsWidgetIsOpen = {
            ...this.actionsWidgetIsOpen,
            [state]: open,
        };
    }

    handleSubmissionsPageAction(event) {
        const {action, state, payload} = event.detail;
        const effectivePayload = payload ?? {};
        const effectiveColumn = effectivePayload.column;
        const effectiveEvent = effectivePayload.event;

        switch (action) {
            case 'prepare-actions':
                this.setActionButtonsStates(state);
                break;
            case 'edit-submission':
                this.handleEditSubmissions(effectiveEvent, state);
                break;
            case 'batch-tagging':
                this.handleOpenBatchTaggingModal(state);
                break;
            case 'edit-permission':
                this.handleEditSubmissionsPermission(state);
                break;
            case 'delete-all':
                this.handleDeleteSubmissions(state);
                break;
            case 'delete-selected':
                this.handleDeleteSubmissions(state, true);
                break;
            case 'export':
                this.exportSubmissionTable(effectiveEvent, state);
                break;
            case 'toggle-column-visibility':
                toggleVisibility(this, effectiveColumn, state);
                break;
            case 'move-column-up':
                moveHeader(this, effectiveColumn, state, 'up');
                break;
            case 'move-column-down':
                moveHeader(this, effectiveColumn, state, 'down');
                break;
            case 'reset-columns':
                resetSettings(this, state);
                break;
            case 'hide-all-columns':
                toggleAllColumns(this, state, 'hide');
                break;
            case 'show-all-columns':
                toggleAllColumns(this, state, 'show');
                break;
            case 'save-columns':
                updateSubmissionTable(this, state);
                storeSubmissionTableSettings(this, state);
                break;
        }
    }

    handleSubmissionModalClose() {
        removeDetailsFromUrl();
    }

    handleSubmissionModalPrevious(event) {
        const {state} = event.detail;
        this.showEntryOfPos(state, this.currentDetailPosition - 1, 'previous');
    }

    handleSubmissionModalNext(event) {
        const {state} = event.detail;
        this.showEntryOfPos(state, this.currentDetailPosition + 1, 'next');
    }

    _onLoginClicked(e) {
        this.sendSetPropertyEvent('requested-login-status', 'logged-in');
        e.preventDefault();
    }

    // -----------------------------------------------------------------------
    // Styles
    // -----------------------------------------------------------------------

    static get styles() {
        // language=css
        return css`
            @layer theme, utility, formalize;
            @layer theme {
                ${commonStyles.getThemeCSS()}
                ${commonStyles.getModalDialogCSS()}
                ${commonStyles.getRadioAndCheckboxCss()}
                ${commonStyles.getGeneralCSS(false)}
                ${commonStyles.getNotificationCSS()}
                ${commonStyles.getActivityCSS()}
                ${commonStyles.getButtonCSS()}
                ${getSelectorFixCSS()}
                ${getFileHandlingCss()}
                ${getTagsCSS()}
            }

            @layer formalize {
                ${getManageFormsCSS()}

                .visually-hidden {
                    clip: rect(0 0 0 0);
                    clip-path: inset(50%);
                    height: 1px;
                    overflow: hidden;
                    position: absolute;
                    white-space: nowrap;
                    width: 1px;
                }
            }
        `;
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    render() {
        const i18n = this._i18n;

        if (this.activeFormId) {
            const activeForm = this.forms.get(this.activeFormId);
            const allowedSubmissionStates = activeForm?.allowedSubmissionStates;
            this.enabledStates = {
                draft: isDraftStateEnabled(allowedSubmissionStates),
                submitted: isSubmittedStateEnabled(allowedSubmissionStates),
            };
        }

        return html`
            <div
                class="notification is-warning ${classMap({
                    hidden: this.isLoggedIn() || this.isLoading(),
                })}">
                ${i18n.t('error-login-message')}
                <a href="#" @click="${this._onLoginClicked}">${i18n.t('error-login-link')}</a>
            </div>

            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isAuthPending()})}">
                <span class="loading">
                    <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
                </span>
            </div>

            <div
                class="${classMap({
                    hidden: !this.isLoggedIn() || this.isAuthPending(),
                })}">
                <div>
                    <slot name="additional-information"></slot>
                </div>

                <dbp-formalize-manage-forms-overview-page
                    lang="${this.lang}"
                    lang-dir="${this.langDir}"
                    id="overview-page"
                    .loadingFormsTable=${this.loadingFormsTable}
                    .showFormsTable=${this.showFormsTable}
                    .showSubmissionTables=${this.showSubmissionTables}
                    .optionsForms=${this.options_forms}
                    .noFormsAvailable=${this.noFormsAvailable}
                    .creatableModulesCount=${this.creatableModulesCount}
                    .enableFormsBulkDelete=${this.enableFormsBulkDelete}
                    .selectedFormsCount=${this.selectedFormsCount}
                    .isDeleteSelectedFormsEnabled=${this.isDeleteSelectedFormsEnabled}
                    @create-form-request=${() => this.handleOpenCreateFormDialog()}
                    @delete-forms-request=${() =>
                        this.handleDeleteForms()}></dbp-formalize-manage-forms-overview-page>

                <dbp-formalize-manage-form-submissions-page
                    lang="${this.lang}"
                    lang-dir="${this.langDir}"
                    id="submissions-page"
                    .showFormsTable=${this.showFormsTable}
                    .showSubmissionTables=${this.showSubmissionTables}
                    .loadingSubmissionTables=${this.loadingSubmissionTables}
                    .activeFormName=${this.activeFormName}
                    .createSubmissionUrl=${this.createSubmissionUrl}
                    .hideCreateSubmissionButton=${this.hideCreateSubmissionButton}
                    .enabledStates=${this.enabledStates}
                    .noSubmissionAvailable=${this.noSubmissionAvailable}
                    .searchWidgetIsOpen=${this.searchWidgetIsOpen}
                    .actionsWidgetIsOpen=${this.actionsWidgetIsOpen}
                    .isActionAvailable=${this.isActionAvailable}
                    .isEditSubmissionEnabled=${this.isEditSubmissionEnabled}
                    .isBatchTaggingEnabled=${this.isBatchTaggingEnabled}
                    .isEditSubmissionPermissionEnabled=${this.isEditSubmissionPermissionEnabled}
                    .isDeleteAllSubmissionEnabled=${this.isDeleteAllSubmissionEnabled}
                    .isDeleteSelectedSubmissionEnabled=${this.isDeleteSelectedSubmissionEnabled}
                    .optionsSubmissions=${this.options_submissions}
                    .submissions=${this.submissions}
                    .submissionsColumns=${this.submissionsColumns}
                    .iconNameVisible=${this.iconNameVisible}
                    .iconNameHidden=${this.iconNameHidden}
                    .isResetButtonDisabled=${this.isResetButtonDisabled}
                    .selectedRowCount=${this.selectedRowCount}
                    .allRowCount=${this.allRowCount}
                    .visibleRowCount=${this.visibleRowCount}
                    .searchIsActive=${this.searchIsActive}
                    .submissionsHasAttachment=${this.submissionsHasAttachment}
                    @back-to-overview=${() => this.handleBackToOverview()}
                    @submission-search-toggle=${(event) =>
                        this.handleSubmissionsPageSearchToggle(event)}
                    @submission-actions-toggle=${(event) =>
                        this.handleSubmissionsPageActionsToggle(event)}
                    @submission-search=${(event) => this.filterTable(event.detail.state)}
                    @submission-search-reset=${() => this.clearAllFilters()}
                    @submission-action=${(event) =>
                        this.handleSubmissionsPageAction(
                            event,
                        )}></dbp-formalize-manage-form-submissions-page>
            </div>

            ${Object.values(SUBMISSION_STATES).map(
                (state) => html`
                    <dbp-formalize-manage-submission-modal
                        lang="${this.lang}"
                        id="submission-modal-${state}"
                        .auth=${this.auth}
                        .state=${state}
                        @detail-modal-close=${() => this.handleSubmissionModalClose()}
                        @detail-modal-previous=${(event) =>
                            this.handleSubmissionModalPrevious(event)}
                        @detail-modal-next=${(event) =>
                            this.handleSubmissionModalNext(
                                event,
                            )}></dbp-formalize-manage-submission-modal>
                `,
            )}

            <dbp-grant-permission-dialog
                id="grant-permission-dialog"
                lang="${this.lang}"
                modal-title="${i18n.t('manage-forms.edit-permission-modal-title')}"
                subscribe="auth"
                entry-point-url="${this.entryPointUrl}"
                resource-identifier="${this.submissionId}"
                resource-class-identifier="DbpRelayFormalizeSubmission"></dbp-grant-permission-dialog>

            <dbp-file-sink
                streamed
                id="file-sink"
                class="file-sink"
                lang="${this.lang}"
                allowed-mime-types="application/pdf,.pdf"
                decompress-zip
                enabled-targets="local,clipboard,nextcloud"
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

            <dbp-formalize-edit-form-dialog
                id="edit-form-dialog"
                lang="${this.lang}"
                lang-dir="${this.langDir}"
                .auth="${this.auth}"
                entry-point-url="${this.entryPointUrl}"
                @dbp-create-form-created=${(event) => this.handleCreateFormCreated(event)}
                @dbp-edit-form-saved=${(event) =>
                    this.handleEditFormSaved(event)}></dbp-formalize-edit-form-dialog>

            <dbp-modal
                id="loading-indicator-modal"
                class="modal modal--loading-indicator"
                modal-id="loading-indicator-modal"
                title="${i18n.t('manage-forms.preparing-download')}"
                subscribe="lang"
                @dbp-modal-closed=${() => this.handleLoadingIndicatorModalClosed()}>
                <div slot="content">
                    <dbp-mini-spinner style="font-size: 4em"></dbp-mini-spinner>
                </div>
            </dbp-modal>
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-manage-forms', ManageForms);
