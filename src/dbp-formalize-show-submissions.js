import {css, html} from 'lit';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {
    Button,
    Icon,
    IconButton,
    LoadingButton,
    MiniSpinner,
    Translated,
    sendNotification,
} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit/directives/class-map.js';
import {CustomTabulatorTable} from './table-components.js';
import MicroModal from './micromodal.es.js';
import {FileSink} from '@dbp-toolkit/file-handling';
import {
    SUBMISSION_STATES,
    getFormRenderUrl,
    getFormShowSubmissionsUrl,
    SUBMISSION_PERMISSIONS,
    isDraftStateEnabled,
    isSubmittedStateEnabled,
    SUBMISSION_STATES_BINARY,
    getDeletionConfirmation,
    handleDeletionConfirm,
    handleDeletionCancel,
} from './utils.js';
import {getSelectorFixCSS, getFileHandlingCss, getTagsCSS, getShowSubmissionCSS} from './styles.js';
import metadata from './dbp-formalize-show-submissions.metadata.json';
import xss from 'xss';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';
import {GrantPermissionDialog} from '@dbp-toolkit/grant-permission-dialog';
import {Modal} from '@dbp-toolkit/common/src/modal.js';

class ShowSubmissions extends ScopedElementsMixin(DBPFormalizeLitElement) {
    constructor() {
        super();
        this.allForms = [];
        this.isLoadingModules = false;
        this.boundKeyEventHandler = this.handleKeyEvents.bind(this);
        this.boundCloseActionsDropdownHandler = this.closeActionsDropdown.bind(this);
        this.boundTableSelectionChanges = this.handleTableSelectionChanges.bind(this);
        this.boundTablePaginationPageLoaded = this.handleTablePaginationPageLoaded.bind(this);
        this._deletionConfirmationResolve = null;
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
        this.options_submissions = {
            draft: {},
            submitted: {},
        };
        this.options_forms = {};
        this.forms = new Map();

        this.rawSubmissions = [];
        this.submissionsGrantedActions = new Map();
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
        this.navigateBetweenDetailedSubmissionsHandler =
            this.navigateBetweenDetailedSubmissions.bind(this);
        this.activeFormName = '';
        this.activeFormId = '';
        this.currentRow = null;
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
        this.userNameCache = new Map();
        this.isRequestDetailedView = false;
        this.submissionIdToOpen = null;
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-icon-button': IconButton,
            'dbp-translated': Translated,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
            'dbp-tabulator-table': CustomTabulatorTable,
            'dbp-grant-permission-dialog': GrantPermissionDialog,
            'dbp-modal': Modal,
            'dbp-file-sink': FileSink,
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

            selectedRowCount: {type: Object, attribute: false},
            allRowCount: {type: Object, attribute: false},
            visibleRowCount: {type: Object, attribute: false},
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
    }

    /**
     * Converts a timestamp to a readable date
     *
     * @param value
     * @returns {string} xlsx year-month-date hours:minutes
     */
    humanReadableDate(value) {
        const d = Date.parse(value);
        const timestamp = new Date(d);
        const year = timestamp.getFullYear();
        const month = ('0' + (timestamp.getMonth() + 1)).slice(-2);
        const date = ('0' + timestamp.getDate()).slice(-2);
        const hours = ('0' + timestamp.getHours()).slice(-2);
        const minutes = ('0' + timestamp.getMinutes()).slice(-2);
        return year + '-' + month + '-' + date + ' ' + hours + ':' + minutes;
    }

    connectedCallback() {
        super.connectedCallback();
        const i18n = this._i18n;

        let langs_forms = {
            en: {
                columns: {
                    id: i18n.t('show-submissions.id', {lng: 'en'}),
                    name: i18n.t('show-submissions.name', {lng: 'en'}),
                },
            },
            de: {
                columns: {
                    id: i18n.t('show-submissions.id', {lng: 'de'}),
                    name: i18n.t('show-submissions.name', {lng: 'de'}),
                },
            },
        };

        this.options_forms = {
            langs: langs_forms,
            layout: 'fitColumns',
            columns: [
                {field: 'id', width: 64, sorter: 'number'},
                {field: 'name', sorter: 'string'},
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

        this.setSubmissionFormOptions('draft');
        this.setSubmissionFormOptions('submitted');

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

            // Table built event listener
            document.addEventListener(
                'dbp-tabulator-table-built',
                (/** @type {CustomEvent} */ e) => {
                    if (e.detail.id) {
                        const state = this.getTableState(e.detail.id);
                        if (state) {
                            // console.log(`this.submissions`, this.submissions);
                            // Set visibility and name localization of columns based on form schema
                            this.setDefaultSubmissionTableOrder(state);

                            // Get settings from localStorage.
                            const columnsLoadedFromLocalStorage =
                                this.restoreSubmissionTableSettings(state);
                            if (!columnsLoadedFromLocalStorage) {
                                // If no saved settings found, use schema settings
                                this.submissionTables[state].setColumns(
                                    this.submissionsColumnsInitial[state],
                                );
                            }
                            this.setIsActionAvailable(state);

                            this.visibleRowCount[state] =
                                this.submissionTables[state].tabulatorTable.getRows(
                                    'visible',
                                ).length;

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

    setSubmissionFormOptions(state) {
        let lang_submissions = {
            en: {
                columns: {},
            },
            de: {
                columns: {},
            },
        };

        const options_submissions = {
            langs: lang_submissions,
            autoColumns: 'full', //'true',
            rowHeight: 64,
            layout: 'fitData',
            layoutColumnsOnNewData: true,
            selectableRows: 'highlight',
            // Checkbox selection
            rowHeader: {
                formatter: 'rowSelection',
                titleFormatter: 'rowSelection',
                titleFormatterParams: {
                    rowRange: 'visible', // only toggle the visible rows
                },
                headerSort: false,
                resizable: false,
                frozen: true,
                headerHozAlign: 'center',
                hozAlign: 'center',
            },
            columnDefaults: {
                vertAlign: 'middle',
                hozAlign: 'left',
                resizable: false,
            },
            placeholder: 'No Submission data available',
        };

        options_submissions.autoColumnsDefinitions = (definitions) => {
            definitions.forEach((columnDefinition) => {
                if (columnDefinition.field === 'submissionId') {
                    columnDefinition.visible = false;
                }
                if (columnDefinition.field === 'dateCreated') {
                    columnDefinition.visible = true;
                }
                if (columnDefinition.field === 'htmlButtons') {
                    columnDefinition.formatter = 'html';
                    columnDefinition.hozAlign = 'center';
                    columnDefinition.vertAlign = 'middle';
                    columnDefinition.headerSort = false;
                    columnDefinition.minWidth = 64;
                    columnDefinition.frozen = true;
                    columnDefinition.headerHozAlign = 'right';
                    // Add open columnSettings modal button
                    columnDefinition.titleFormatter = (cell, formatterParams, onRendered) => {
                        let columnSettingsButton = this.submissionTables[state].createScopedElement(
                            'dbp-formalize-column-settings-button',
                        );
                        columnSettingsButton.setAttribute('subscribe', 'lang');
                        columnSettingsButton.addEventListener('click', () => {
                            this.openColumnOptionsModal(state);
                        });
                        return columnSettingsButton;
                    };
                } else {
                    columnDefinition.sorter = 'string';
                }
                if (columnDefinition.field.includes('date')) {
                    columnDefinition.sorter = (a, b, aRow, bRow, column, dir, sorterParams) => {
                        const timeStampA = this.dateToTimestamp(a);
                        const timeStampB = this.dateToTimestamp(b);
                        return timeStampA - timeStampB;
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
                        const position = row.getPosition(true); // position in current data view
                        return (page - 1) * pageSize + position;
                    },
                    hozAlign: 'center',
                    headerHozAlign: 'center',
                    headerSort: false,
                    frozen: true,
                    width: 30,
                },
                ...definitions, // rest of the auto-generated columns
            ];
        };

        this.options_submissions[state] = {...options_submissions};
    }

    enableCheckboxSelection(state) {
        this.options_submissions[state].rowHeader = {
            formatter: 'rowSelection',
            titleFormatter: 'rowSelection',
            titleFormatterParams: {
                rowRange: 'visible', // only toggle the visible rows
            },
            headerSort: false,
            resizable: false,
            frozen: true,
            headerHozAlign: 'center',
            hozAlign: 'center',
        };
        this.options_submissions[state].headerVisible = true;
    }

    disableCheckboxSelection(state) {
        this.options_submissions[state].rowHeader = false;
        this.options_submissions[state].headerVisible = false;
    }

    disablePagination(state) {
        this.submissionTables[state].paginationEnabled = false;
    }

    enablePagination(state) {
        if (this.submissionTables[state].paginationEnabled === false) {
            this.submissionTables[state].paginationEnabled = true;
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

    async firstUpdated() {
        this.formsTable = /** @type {CustomTabulatorTable} */ (this._('#tabulator-table-forms'));
        for (const state of Object.values(SUBMISSION_STATES)) {
            this.submissionTables[state] = /** @type {CustomTabulatorTable} */ (
                this._(`#tabulator-table-submissions-${state}`)
            );
        }

        if (this.auth.token === '' || this.allForms.length > 0) {
            return;
        }

        // If we arrive from another activity, auth is not updated
        // we need to init form-loading here.
        if (this.forms.size === 0) {
            await this.loadModules();
        }
        await this.getListOfAllForms();
    }

    async loginCallback() {
        if (this.forms.size === 0) {
            await this.loadModules();
        }
        await this.getListOfAllForms();
    }

    async updated(changedProperties) {
        if (changedProperties.has('allForms')) {
            // Build tables
            if (this.allForms && this.allForms.length > 0) {
                // We will use the first URL segment after the activity as identifier for the form's submissions
                const formId = this.getRoutingData().pathSegments[0] || '';

                if (formId) {
                    // Check if the form-id is one of the forms identifiers.
                    const form = this.forms.get(formId);
                    if (form) {
                        this.switchToSubmissionTable(form);
                    } else {
                        sendNotification({
                            summary: this._i18n.t('errors.notfound-title'),
                            body: this._i18n.t('errors.notfound-body'),
                            type: 'danger',
                            timeout: 0,
                        });
                    }
                } else {
                    this.formsTable = /** @type {CustomTabulatorTable} */ (
                        this._('#tabulator-table-forms')
                    );
                    if (this.formsTable) {
                        this.formsTable.buildTable();
                        this.loadingFormsTable = false;
                        this.showFormsTable = true;
                        this.showSubmissionTables = false;
                    }
                }
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
                // console.log('[updated - routingUrl]', oldUrl, '=>', newUrl);

                if (this.forms.size === 0 && this.isLoggedIn()) {
                    await this.loadModules();
                    await this.getListOfAllForms();
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
                    this.formsTable = /** @type {CustomTabulatorTable} */ (
                        this._('#tabulator-table-forms')
                    );
                    if (this.formsTable && !this.formsTable.tableReady) {
                        this._('#tabulator-table-forms').buildTable();
                        this.loadingFormsTable = false;
                        this.showFormsTable = true;
                        this.showSubmissionTables = false;
                    }
                }
            }
        }

        if (changedProperties.has('submissions')) {
            // const oldValue = changedProperties.get('submissions');
            // console.log(`*** [updated] oldValue`, oldValue);
            // console.log(`*** [updated] this.submissions`, this.submissions);

            for (const state in this.submissions) {
                if (this.submissions[state]?.length === 0) {
                    this.noSubmissionAvailable[state] = true;
                    this.disableCheckboxSelection(state);
                    this.disablePagination(state);
                    if (this.submissionTables[state].tabulatorTable) {
                        this.submissionTables[state].tabulatorTable.destroy();
                        this.setSubmissionFormOptions(state);
                        this.submissionTables[state].buildTable();
                    }
                } else {
                    this.noSubmissionAvailable[state] = false;
                    this.enableCheckboxSelection(state);
                    this.enablePagination(state);
                }

                if (this.needTableRebuild[state]) {
                    this.submissionTables[state].buildTable();
                    this.needTableRebuild[state] = false;
                }
            }
        }

        if (changedProperties.has('lang')) {
            await this.getListOfAllForms();

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

        super.updated(changedProperties);
    }

    throwSomethingWentWrongNotification() {
        const i18n = this._i18n;

        sendNotification({
            summary: i18n.t('show-submissions.something-went-wrong-title'),
            body: i18n.t('show-submissions.something-went-wrong-body'),
            type: 'danger',
            timeout: 0,
        });
    }

    /**
     * Load form modules and create ID -> slug mapping
     */
    async loadModules() {
        if (this.isLoadingModules) return;
        this.isLoadingModules = true;

        try {
            // Fetch the JSON file containing module paths
            const response = await fetch(this.basePath + 'modules.json');
            const data = await response.json();

            // Iterate over the module paths and dynamically import each module
            for (const path of Object.values(data['forms'])) {
                const module = await import(path);
                const object = new module.default();

                // Store the mapping of form identifier to slug
                if (object.getFormIdentifier && object.getUrlSlug) {
                    this.forms.set(object.getFormIdentifier(), {
                        formName: null,
                        formId: object.getFormIdentifier(),
                        formSlug: object.getUrlSlug(),
                    });
                }
            }
        } catch (error) {
            console.error('Error loading modules:', error);
        } finally {
            this.isLoadingModules = false;
        }
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
        this.getAllFormSubmissions(this.activeFormId).then(async () => {
            const activeForm = this.forms.get(this.activeFormId);
            const activeFormSlug = activeForm ? activeForm.formSlug : null;
            this.createSubmissionUrl = activeFormSlug
                ? getFormRenderUrl(activeFormSlug, this.lang)
                : '';

            // For tabulatorTable 'draft' and 'submitted'
            for (const state of Object.keys(this.submissionTables)) {
                if (this.submissionTables[state]) {
                    if (this.submissions[state].length === 0) {
                        // There is no submission data
                        this.loadingSubmissionTables = false;
                        this.showSubmissionTables = true; // show back button
                        this.showFormsTable = false;
                        this.disableCheckboxSelection(state);
                        this.disablePagination(state);

                        // Reset data
                        this.options_submissions[state].data = [];
                        // this.submissionTables[state].clearData();
                        this.submissionTables[state].buildTable();
                    } else {
                        this.enableCheckboxSelection(state);
                        this.enablePagination(state);

                        this.loadingSubmissionTables = false;
                        this.showSubmissionTables = true;
                        this.showFormsTable = false;

                        // Open submission details modal if /details/[uuid] is in the URL
                        // this.handleOpenDetailedSubmissionFromUrl()
                        const routingData = this.getRoutingData();
                        this.submissionIdToOpen =
                            routingData.pathSegments[2] &&
                            routingData.pathSegments[2].match(/[0-9a-f-]+/)
                                ? routingData.pathSegments[2]
                                : null;
                        const isRequestDetailedView =
                            routingData.pathSegments[1] === 'details' && this.submissionIdToOpen;

                        this.submissionTables[state].buildTable();

                        // Open modal from the `dbp-tabulator-table-built` event listener
                        this.isRequestDetailedView = isRequestDetailedView;
                    }
                }
            }
        });
    }

    /**
     * Gets the list of courses
     *
     * @returns {Promise<object>} response
     */
    async getListOfAllForms() {
        const i18n = this._i18n;
        try {
            this.loadCourses = false;
            this.loadingFormsTable = true;

            const response = await fetch(
                this.entryPointUrl + '/formalize/forms' + '?perPage=9999',
                {
                    headers: {
                        'Content-Type': 'application/ld+json',
                        Authorization: 'Bearer ' + this.auth.token,
                    },
                },
            );

            if (!response.ok) {
                this.handleErrorResponse(response);
            } else {
                let data = [];
                let forms = [];
                try {
                    data = await response.json();
                } catch (e) {
                    this.sendErrorAnalyticsEvent('LoadListOfAllCourses', 'WrongResponse', e);
                    this.throwSomethingWentWrongNotification();
                    this.loadCourses = true;
                    return;
                }

                for (let x = 0; x < data['hydra:member'].length; x++) {
                    const entry = data['hydra:member'][x];
                    const id = x + 1;
                    let localizedFormName = entry['localizedNames'].find((localizedName) => {
                        return localizedName.languageTag === this.lang;
                    });
                    const formName = localizedFormName ? localizedFormName.name : entry['name'];
                    const formId = entry['identifier'];
                    const allowedActionsWhenSubmitted = entry['allowedActionsWhenSubmitted'];
                    const tagPermissionsForSubmitters = entry['tagPermissionsForSubmitters'];
                    // const formGrantedActions = entry['grantedActions'];
                    const allowedSubmissionStates = entry['allowedSubmissionStates'];
                    const dataFeedSchema = entry['dataFeedSchema'];

                    this.forms.set(formId, {
                        ...this.forms.get(formId),
                        formName,
                        formId,
                        allowedSubmissionStates,
                        allowedActionsWhenSubmitted,
                        // formGrantedActions,
                        dataFeedSchema,
                        tagPermissionsForSubmitters,
                    });

                    let btn = this.formsTable.createScopedElement(
                        'dbp-formalize-get-details-button',
                    );
                    btn.setAttribute('subscribe', 'lang');
                    btn.title = i18n.t('show-submissions.open-forms');
                    btn.ariaLabel = i18n.t('show-submissions.open-forms');
                    btn.addEventListener('click', async (event) => {
                        this.loadingSubmissionTables = true;
                        // Switch to form submissions table
                        this.routingUrl = `/${formId}`;
                        const formSubmissionUrl = getFormShowSubmissionsUrl(formId, this.lang);
                        const url = new URL(formSubmissionUrl);
                        window.history.pushState({}, '', url);
                        this.sendSetPropertyEvent('routing-url', `/${formId}`, true);
                    });

                    let new_form = {id: id, name: formName, actionButton: btn};
                    forms.push(new_form);
                }

                this.allForms = forms;
                // Set tabulator table data
                this.options_forms.data = this.allForms;
            }
        } catch (e) {
            this.loadCourses = true;
            console.error('[updated] Error getting list of forms:', e);
            sendNotification({
                summary: i18n.t('show-submissions.failed-to-get-forms-title'),
                body: i18n.t('show-submissions.failed-to-get-forms-body'),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    /**
     * Gets the list of submissions for a specific form
     *
     * @param {string} formId - form identifier
     */
    async getAllFormSubmissions(formId) {
        // const i18n = this._i18n;
        let response;
        let data = [];
        this.submissions = {
            submitted: [],
            draft: [],
        };
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
        };

        try {
            response = await this.httpGetAsync(
                this.entryPointUrl +
                    '/formalize/submissions?formIdentifier=' +
                    formId +
                    '&perPage=9999',
                options,
            );
            data = await response.json();
        } catch (e) {
            this.sendErrorAnalyticsEvent('getAllSubmissions', 'WrongResponse', e);
            this.throwSomethingWentWrongNotification();
            return Promise.reject(e);
        }

        this.rawSubmissions = data['hydra:member'];

        this.submissionsGrantedActions = new Map();

        this.rawSubmissions.forEach((submission) => {
            this.submissionsGrantedActions.set(submission.identifier, submission.grantedActions);
        });

        if (data['hydra:member'].length === 0) {
            this.noSubmissionAvailable = {
                draft: true,
                submitted: true,
            };
            return response;
        }

        // Separate submissions by their state
        const submissions = {};
        submissions.submitted = data['hydra:member'].filter((submission) => {
            return submission.submissionState === SUBMISSION_STATES_BINARY.SUBMITTED;
        });
        submissions.draft = data['hydra:member'].filter((submission) => {
            return submission.submissionState === SUBMISSION_STATES_BINARY.DRAFT;
        });

        for (const state of Object.keys(this.submissions)) {
            // No submissions available - disable actions, checkboxes, pagination and add placeholder message
            if (submissions[state].length === 0) {
                this.noSubmissionAvailable = {...this.noSubmissionAvailable, [state]: true};
                continue;
            } else {
                this.noSubmissionAvailable = {...this.noSubmissionAvailable, [state]: false};
            }

            let submissions_list = [];
            // Add additional columns to the table
            // dateCreated, submissionId, attachments, action Buttons
            for (let [x, submission] of submissions[state].entries()) {
                let dateCreated = submission['dateCreated'];
                dateCreated = this.humanReadableDate(dateCreated);

                let dataFeedElement = submission['dataFeedElement'];
                dataFeedElement = JSON.parse(dataFeedElement);
                let submissionId = submission['identifier'];
                // const grantedActions = submission['grantedActions'];

                // Iterate trough dataFeedElement
                for (const [key, value] of Object.entries(dataFeedElement)) {
                    // Find array fields and convert them to strings
                    if (Array.isArray(value)) {
                        dataFeedElement[key] = value.join(', ');
                    }
                    // Convert user identifier to user full name
                    if (key === 'identifier' && value) {
                        if (!this.userNameCache.has(value)) {
                            try {
                                const response = await this.apiGetUserDetails(value);
                                const userObject = await response.json();
                                const fullName = `${userObject['givenName']} ${userObject['familyName']}`;
                                dataFeedElement[key] = fullName;
                                this.userNameCache.set(value, fullName);
                            } catch (e) {
                                console.error(e);
                                dataFeedElement[key] = value;
                            }
                        } else {
                            dataFeedElement[key] = this.userNameCache.get(value);
                        }
                    }
                    // Remove formTags if no permission to view
                    // if (key === 'formTags') {
                    //     const currentForm = this.forms.get(formId);
                    //     const tagPermissions = currentForm?.tagPermissionsForSubmitters;
                    //     const isAdmin = currentForm.formGrantedActions.some((grant) => {
                    //         return (
                    //             grant === SUBMISSION_COLLECTION_PERMISSIONS.MANAGE ||
                    //             grant === SUBMISSION_COLLECTION_PERMISSIONS.UPDATE_SUBMISSIONS
                    //         );
                    //     });
                    //     if (tagPermissions < 1 && !isAdmin) {
                    //         delete dataFeedElement[key];
                    //     }
                    // }
                }

                const id = x + 1;
                let cols = {
                    dateCreated: dateCreated,
                    ...dataFeedElement,
                    submissionId: submissionId,
                };

                // Get attachments
                const submittedFilesBasicResponse = submission['submittedFiles'];
                const allAttachmentDetails = {};
                if (
                    submittedFilesBasicResponse &&
                    Array.isArray(submittedFilesBasicResponse) &&
                    submittedFilesBasicResponse.length > 0
                ) {
                    this.submissionsHasAttachment[state] = true;
                    // Extract file names from the submittedFiles array
                    try {
                        this.submittedFileDetails[state].set(
                            submissionId,
                            await this.getAttachmentFilesDetails(submissionId),
                        );
                    } catch (e) {
                        console.error(e);
                    }

                    // Separate attachments and voting files
                    for (const attachment of this.submittedFileDetails[state].get(submissionId)) {
                        const fieldName = `form_files-${attachment.fileAttributeName}`;
                        if (allAttachmentDetails[fieldName] === undefined) {
                            allAttachmentDetails[fieldName] = [];
                        }
                        allAttachmentDetails[fieldName].push(attachment.fileName);
                    }
                }

                for (const fieldName of Object.keys(allAttachmentDetails)) {
                    if (allAttachmentDetails[fieldName]) {
                        cols[fieldName] = Array.isArray(allAttachmentDetails[fieldName])
                            ? allAttachmentDetails[fieldName].join(', ')
                            : allAttachmentDetails[fieldName];
                    }
                }

                let actionButtonsDiv = this.createScopedElement('div');
                const activeForm = this.forms.get(formId);

                // Add link to show submission in render form view
                // @TODO: only for forms that we are rendering ourselves and have readonly view
                // activeForm.formSlug && hasReadonlyView(activeForm);
                if (
                    activeForm.formName === 'Ethikantrag' ||
                    activeForm.formName === 'Ethics Proposal'
                ) {
                    const submissionDetailsFormButton = this.submissionTables[
                        state
                    ].createScopedElement('dbp-formalize-get-submission-link');
                    // Set submission URL
                    const activeFormSlug = activeForm.formSlug ? activeForm.formSlug : null;
                    if (activeFormSlug) {
                        let formSubmissionUrl =
                            getFormRenderUrl(activeFormSlug, this.lang) +
                            `/${submissionId}/readonly`;
                        /*
                            t('show-submissions.open-detailed-view-form')
                        */
                        submissionDetailsFormButton.ariaLabel =
                            'show-submissions.open-detailed-view-form';
                        submissionDetailsFormButton.submissionUrl = formSubmissionUrl;
                        submissionDetailsFormButton.iconName = 'open-new-window';
                        submissionDetailsFormButton.title =
                            'show-submissions.open-detailed-view-form';
                        submissionDetailsFormButton.id = id.toString();
                        submissionDetailsFormButton.setAttribute('subscribe', 'lang');
                        submissionDetailsFormButton.addEventListener('click', (event) => {
                            event.stopPropagation();
                        });
                        actionButtonsDiv.appendChild(submissionDetailsFormButton);
                    }
                }

                // Add button to show submission details in a modal
                const submissionDetailsButton = this.submissionTables[state].createScopedElement(
                    'dbp-formalize-get-details-button',
                );
                /*
                    t('show-submissions.open-detailed-view-modal')
                */
                submissionDetailsButton.ariaLabel = 'show-submissions.open-detailed-view-modal';
                submissionDetailsButton.title = 'show-submissions.open-detailed-view-modal';
                submissionDetailsButton.id = id.toString();
                submissionDetailsButton.setAttribute('subscribe', 'lang');
                submissionDetailsButton.addEventListener('click', (event) => {
                    event.stopPropagation();

                    // Add 'details/submissionId' to the URL when opening submission details modal
                    const routingData = this.getRoutingData();
                    const formId = routingData.pathSegments[0];
                    if (formId.match(/[0-9a-f-]+/)) {
                        this.addDetailsToUrl(submissionId);

                        this.requestDetailedSubmission(state, cols, id);
                    }
                    return;
                });

                actionButtonsDiv.appendChild(submissionDetailsButton);
                actionButtonsDiv.classList.add('actions-buttons');

                cols.htmlButtons = actionButtonsDiv;
                submissions_list.push(cols);
            }

            // Remove attachments if all empty
            const noAttachments = submissions_list.every(
                (submission) => submission.attachments === '',
            );
            submissions_list = noAttachments
                ? submissions_list.map(({attachments, ...rest}) => rest)
                : submissions_list;

            this.submissions[state] = submissions_list;

            this.options_submissions[state].autoColumnsDefinitions = (definitions) => {
                definitions.forEach((columnDefinition) => {
                    if (columnDefinition.field === 'submissionId') {
                        columnDefinition.visible = true;
                    }
                    if (columnDefinition.field === 'dateCreated') {
                        columnDefinition.visible = true;
                    }
                    if (columnDefinition.field === 'htmlButtons') {
                        columnDefinition.formatter = 'html';
                        columnDefinition.hozAlign = 'center';
                        columnDefinition.vertAlign = 'middle';
                        columnDefinition.headerSort = false;
                        columnDefinition.minWidth = 64;
                        columnDefinition.frozen = true;
                        columnDefinition.headerHozAlign = 'right';
                        // Add open columnSettings modal button
                        columnDefinition.titleFormatter = (cell, formatterParams, onRendered) => {
                            let columnSettingsButton = this.submissionTables[
                                state
                            ].createScopedElement('dbp-formalize-column-settings-button');
                            columnSettingsButton.setAttribute('subscribe', 'lang');
                            columnSettingsButton.addEventListener('click', () => {
                                this.openColumnOptionsModal(state);
                            });
                            return columnSettingsButton;
                        };
                    } else {
                        columnDefinition.sorter = 'string';
                    }
                    if (columnDefinition.field.includes('date')) {
                        columnDefinition.sorter = (a, b, aRow, bRow, column, dir, sorterParams) => {
                            const timeStampA = this.dateToTimestamp(a);
                            const timeStampB = this.dateToTimestamp(b);
                            return timeStampA - timeStampB;
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
                            const position = row.getPosition(true); // position in current data view
                            return (page - 1) * pageSize + position;
                        },
                        field: 'rowIndex',
                        hozAlign: 'center',
                        headerHozAlign: 'center',
                        headerSort: false,
                        frozen: true,
                        width: 30,
                    },
                    ...definitions, // rest of the auto-generated columns
                ];
            };

            // this.setSubmissionFormOptions(state);
            // console.log(`*** this.options_submissions[${state}]`, this.options_submissions[state]);

            // Set tabulator table data
            this.options_submissions[state].data = this.submissions[state];
            this.totalNumberOfItems[state] = submissions_list.length;

            submissions_list = [];
        }
        return response;
    }

    /**
     * Convert date string to timestamp
     * @param {string} dateInput
     * @returns {number} timestamp
     */
    dateToTimestamp(dateInput) {
        const d = new Date(dateInput);
        if (isNaN(d)) throw new Error('Invalid date');
        console.log(`timestamp`, Math.floor(d.getTime() / 1000));
        return Math.floor(d.getTime() / 1000);
    }

    /**
     * @typedef {object} AttachmentDetails
     * @property {string} fileName - name of the file
     * @property {string} downloadUrl - blob download URL
     * @property {number} [fileSize] - size of the file
     * @property {string} fileAttributeName - file attribute name
     * @property {string} identifier - file identifier uuid
     * @property {string} mimeType - file MIME type
     */

    /**
     * Get details of attachment files for a specific submission
     * fileName, fileSize, downloadUrl
     * @param {string} submissionId
     * @returns {Promise<AttachmentDetails[]>} List of attachment details
     */
    async getAttachmentFilesDetails(submissionId) {
        let submissionData = {};

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
        };

        try {
            const response = await this.httpGetAsync(
                this.entryPointUrl + '/formalize/submissions/' + submissionId,
                options,
            );
            if (!response.ok) {
                this.handleErrorResponse(response);
            }
            submissionData = await response.json();
        } catch (e) {
            console.error(e);
        }

        if (
            submissionData['submittedFiles'] &&
            Array.isArray(submissionData['submittedFiles']) &&
            submissionData['submittedFiles'].length > 0
        ) {
            return submissionData['submittedFiles'];
        } else {
            return [];
        }
    }

    /**
     * Sets the initial visibility [/order] of the submission table columns from the schema.
     * @param {string} state - The state of the submission table ('draft' or 'submitted').
     */
    setDefaultSubmissionTableOrder(state) {
        const activeForm = this.forms.get(this.activeFormId);
        if (!activeForm) return;

        const formSchemaFields = this._getFormSchema(activeForm);

        this.isResetButtonDisabled[state] = true;

        // Set download folder name pattern from schema
        this.downloadFolderNamePattern =
            formSchemaFields?.submissionExport?.downloadFolderPattern || '';
        this.useSubFoldersForExports = formSchemaFields?.submissionExport?.subfolders ?? true;

        const submissionsTable = this.submissionTables[state];
        if (!submissionsTable) return;

        const initialColumnDefinitions = this._getInitialColumnDefinitions(submissionsTable);
        if (initialColumnDefinitions.length === 0) return;

        const isCatchAll = this._isCatchAllSchema(formSchemaFields);

        const schemaFields = this._getSchemaFields(
            formSchemaFields,
            isCatchAll,
            initialColumnDefinitions,
            state,
        );
        const attachmentFields = this._getAttachmentFields(formSchemaFields);
        const systemFields = this._getSystemFields(initialColumnDefinitions);

        const schemaColumnDefinitions = [...schemaFields, ...attachmentFields, ...systemFields];

        this.submissionsColumnsInitial[state] =
            this.cloneColumnDefinitions(schemaColumnDefinitions);
        this.submissionsColumns[state] = this.cloneColumnDefinitions(
            this.submissionsColumnsInitial[state],
        );
    }

    /**
     * Check if the form schema is a catch-all schema.
     * @param {object} formSchemaFields - The parsed form schema.
     * @returns {boolean} - True if it's a catch-all schema, false otherwise.
     */
    _isCatchAllSchema(formSchemaFields) {
        return (
            !formSchemaFields?.properties || Object.keys(formSchemaFields?.properties).length === 0
        );
    }

    /**
     * Get the parsed form schema from the active form.
     * @param {object} activeForm - The active form object.
     * @returns {object|null} - The parsed form schema or null if parsing fails.
     */
    _getFormSchema(activeForm) {
        try {
            return JSON.parse(activeForm.dataFeedSchema);
        } catch (e) {
            console.log('Failed parsing json data', e);
            return null;
        }
    }

    /**
     * Get the initial column definitions from the submissions table.
     * @param {object} submissionsTable - The submissions table instance.
     * @returns {Array} - An array of column definitions.
     */
    _getInitialColumnDefinitions(submissionsTable) {
        const columnComponents = submissionsTable.getColumns();
        if (!columnComponents || columnComponents.length === 0) return [];
        return columnComponents.map((column) => column.getDefinition());
    }

    /**
     * Get schema fields, handling visibility and localization.
     * @param {object} formSchemaFields - The parsed form schema.
     * @param {boolean} isCatchAll - Whether the schema is a catch-all schema.
     * @param {Array} initialColumnDefinitions - The initial column definitions.
     * @param {string} state - The state of the submission table ('draft' or 'submitted').
     * @returns {Array} - An array of schema field definitions.
     */
    _getSchemaFields(formSchemaFields, isCatchAll, initialColumnDefinitions, state) {
        const schemaFields = [];

        // Always include dateCreated at the beginning
        const dateCreatedDef = initialColumnDefinitions.find((def) => def.field === 'dateCreated');
        if (dateCreatedDef) {
            schemaFields.push(dateCreatedDef);
        }

        if (isCatchAll) {
            initialColumnDefinitions.forEach((def) => {
                if (
                    def.field &&
                    def.field !== 'rowIndex' &&
                    def.field !== 'dateCreated' &&
                    def.field !== 'identifier' &&
                    def.field !== 'submissionId' &&
                    def.field !== 'htmlButtons'
                ) {
                    def.visible = true;
                    schemaFields.push(def);
                }
            });
        } else {
            Object.keys(formSchemaFields.properties).forEach((field) => {
                const schemaField = formSchemaFields.properties[field];
                if (schemaField.tableViewVisibleDefault !== undefined) {
                    this.isResetButtonDisabled[state] = false;
                }

                const definition = {
                    field: field,
                    visible: schemaField?.tableViewVisibleDefault ?? true,
                    title: schemaField?.localizedName?.[this.lang] || field,
                };
                schemaFields.push(definition);
            });
        }
        return schemaFields;
    }

    /**
     * Get attachment fields from the form schema.
     * @param {object} formSchemaFields - The parsed form schema.
     * @returns {Array} - An array of attachment field definitions.
     */
    _getAttachmentFields(formSchemaFields) {
        const attachmentFields = [];
        if (formSchemaFields.files && typeof formSchemaFields.files === 'object') {
            Object.keys(formSchemaFields.files).forEach((attachmentType) => {
                attachmentFields.push({
                    field: `form_files-${attachmentType}`,
                    title: attachmentType,
                    visible: true,
                });
            });
        }
        return attachmentFields;
    }

    /**
     * Get system fields that should always be present.
     * @param {Array} initialColumnDefinitions - The initial column definitions.
     * @returns {Array} - An array of system field definitions.
     */
    _getSystemFields(initialColumnDefinitions) {
        return initialColumnDefinitions.filter(
            (def) =>
                def.field === 'identifier' ||
                def.field === 'submissionId' ||
                def.field === 'htmlButtons',
        );
    }

    /**
     * Resets the settings to their currently not saved values
     * @param {string} state - The state of the submission table ('draft' or 'submitted').
     */
    resetSettings(state) {
        this.submissionsColumns[state] = this.cloneColumnDefinitions(
            this.submissionsColumnsInitial[state],
        );
    }

    /**
     * Clone an array of column definitions so mutations don't affect the source.
     * @param {object[]} definitions
     * @returns {object[]}
     */
    cloneColumnDefinitions(definitions) {
        if (!Array.isArray(definitions)) {
            return [];
        }

        return definitions.map((definition) => this.cloneColumnDefinition(definition));
    }

    /**
     * Clone a single column definition, including nested column groups.
     * @param {object} definition
     * @returns {object}
     */
    cloneColumnDefinition(definition) {
        if (!definition || typeof definition !== 'object') {
            return definition;
        }

        const clone = {...definition};

        if (Array.isArray(definition.columns)) {
            clone.columns = this.cloneColumnDefinitions(definition.columns);
        }

        return clone;
    }

    /**
     * Set all columns hidden in Column Settings Modal
     * @param {string} state
     * @param {string} action - 'hide' or 'show'
     */
    toggleAllColumns(state, action) {
        // let columnDefinitions = [];
        this.submissionsColumns[state].forEach((column) => {
            if (column.frozen) return; // skip frozen columns (ID, htmlButtons)
            column.visible = action === 'hide' ? false : true;
        });
        this.requestUpdate();
    }

    /**
     * Gets the detailed data of a specific row
     * @param {string} state - The state of the submission ('draft' or 'submitted').
     * @param entry
     * @param pos
     */
    requestDetailedSubmission(state, entry, pos) {
        if (
            !this._(`#detailed-submission-modal-${state} .content-wrapper`) ||
            !this._(`#apply-col-settings-${state}`)
        ) {
            return;
        }

        // Reset modal content
        this._(`#detailed-submission-modal-${state} .content-wrapper`).innerHTML = '';

        if (this.submissionsColumns[state].length !== 0) {
            for (let current_column of this.submissionsColumns[state]) {
                if (current_column.field && current_column.field !== 'htmlButtons') {
                    const labelText = current_column.title
                        ? xss(current_column.title)
                        : xss(current_column.field);
                    this._(`#detailed-submission-modal-${state} .content-wrapper`).innerHTML +=
                        `<div class='element-left'>` + labelText + `:</div>`;

                    if (current_column.field === 'dateCreated') {
                        this._(`#detailed-submission-modal-${state} .content-wrapper`).innerHTML +=
                            `<div class='element-right'>` +
                            this.humanReadableDate(entry[current_column.field]);
                    } else {
                        this._(`#detailed-submission-modal-${state} .content-wrapper`).innerHTML +=
                            `<div class='element-right'>` +
                            xss(entry[current_column.field]) +
                            `</div>`;
                    }
                }
            }
        } else {
            for (const [key, value] of Object.entries(entry)) {
                // Skip the action buttons column and empty keys
                if (!key || key === 'htmlButtons' || key === 'rowIndex') continue;

                this._(`#detailed-submission-modal-${state} .content-wrapper`).innerHTML +=
                    `<div class='element-left'>` + xss(key) + `:</div>`;

                if (key === 'dateCreated') {
                    this._(`#detailed-submission-modal-${state} .content-wrapper`).innerHTML +=
                        `<div class='element-right'>` + this.humanReadableDate(value);
                } else {
                    this._(`#detailed-submission-modal-${state} .content-wrapper`).innerHTML +=
                        `<div class='element-right'>` + xss(value) + `</div>`;
                }
            }
        }

        this.currentDetailPosition = pos;
        this.currentBeautyId = pos;
        this.isPrevEnabled = pos !== 1;
        this.isNextEnabled = pos + 1 <= this.totalNumberOfItems[state];

        if (this._(`#detailed-submission-modal-${state} .content-wrapper > div:first-child`))
            this._(
                `#detailed-submission-modal-${state} .content-wrapper > div:first-child`,
            ).classList.add('first');
        if (this._(`#detailed-submission-modal-${state} .content-wrapper > div:nth-child(2)`))
            this._(
                `#detailed-submission-modal-${state} .content-wrapper > div:nth-child(2)`,
            ).classList.add('first');

        this.showDetailedModal(state);
    }

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
            let rowsToExport = [];
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

        // ${SCHEMA_FIELD_PREFIX/applicant}_${SYSTEM_ATTRIBUTE_PREFIX/lastModifiedDate}_${SCHEMA_FIELD_PREFIX/userTitleShort}
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

    /**
     * Filters the submissions table
     */
    filterTable(state) {
        let filter = /** @type {HTMLInputElement} */ (this._(`#searchbar--${state}`));
        let search = /** @type {HTMLSelectElement} */ (this._(`#search-select--${state}`));
        let operator = /** @type {HTMLSelectElement} */ (this._(`#search-operator--${state}`));

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
            table.setFilter([filter_object]);
        } else {
            const columns = table.getColumnsFields();
            let listOfFilters = [];
            for (let col of columns) {
                if (col && col !== 'htmlButtons') {
                    let filter_object = {field: col, type: operatorValue, value: filterValue};
                    listOfFilters.push(filter_object);
                }
            }
            table.setFilter([listOfFilters]);
        }
    }

    toggleSearchFilters(state) {
        if (this.searchWidgetIsOpen[state]) {
            // Close search filters widget
            this.searchWidgetIsOpen = {
                ...this.searchWidgetIsOpen,
                [state]: false,
            };
        } else {
            // Open search filters widget
            this.searchWidgetIsOpen = {
                ...this.searchWidgetIsOpen,
                [state]: true,
            };
        }
    }

    /**
     * Removes the current filters from the submissions table
     */
    clearAllFilters() {
        for (const state of Object.keys(this.submissionTables)) {
            let searchInput = /** @type {HTMLInputElement} */ (this._(`#searchbar--${state}`));
            let searchColumn = /** @type {HTMLSelectElement} */ (
                this._(`#search-select--${state}`)
            );
            let searchOperator = /** @type {HTMLSelectElement} */ (
                this._(`#search-operator--${state}`)
            );
            const table = this.submissionTables[state];

            if (!table || !searchInput || !searchColumn || !searchOperator) return;

            searchInput.value = '';
            searchColumn.value = 'all';
            searchOperator.value = 'like';
            table.clearFilter();
        }
    }

    /**
     * Creates options for a select box of
     * this.submissionColumns Array (all possible cols of active table)
     *
     * @param {string} state - The state of the submission table ('draft' or 'submitted')
     * @returns {import('lit').TemplateResult[]} Array of option template results
     */
    getTableHeaderOptions(state) {
        const i18n = this._i18n;

        if (this.submissions[state].length === 0) {
            return [];
        } else {
            let options = [];
            options.push(html`
                <option value="all">${i18n.t('show-submissions.all-columns')}</option>
            `);

            let submissions = [];
            if (this.submissions[state].length > 0) {
                submissions = this.submissions[state];
            }

            let cols = Object.keys(submissions[0]);

            let schemaFields = null;
            if (this.activeFormId) {
                const activeForm = this.forms.get(this.activeFormId);
                try {
                    const formSchema = JSON.parse(activeForm.dataFeedSchema);
                    schemaFields = formSchema?.properties;
                } catch (e) {
                    console.log('Failed parsing json data', e);
                }
            }

            for (let col of cols) {
                if (col && col !== 'htmlButtons') {
                    // Get localized name from the schema if available
                    const localizedName = schemaFields?.[col]?.localizedName?.[this.lang];
                    const displayName = localizedName || col;
                    options.push(html`
                        <option value="${col}">${displayName}</option>
                    `);
                }
            }
            return options;
        }
    }

    getTableFilterOptions() {
        const i18n = this._i18n;
        return html`
            <option value="like">${i18n.t('show-submissions.search-operator-like')}</option>
            <option value="=">${i18n.t('show-submissions.search-operator-equal')}</option>
            <option value="!=">${i18n.t('show-submissions.search-operator-notequal')}</option>
            <option value="starts">${i18n.t('show-submissions.search-operator-starts')}</option>
            <option value="ends">${i18n.t('show-submissions.search-operator-ends')}</option>
            <option value="<">${i18n.t('show-submissions.search-operator-less')}</option>
            <option value="<=">
                ${i18n.t('show-submissions.search-operator-lessthanorequal')}
            </option>
            <option value=">">${i18n.t('show-submissions.search-operator-greater')}</option>
            <option value=">=">${i18n.t('show-submissions.search-operator-greaterorequal')}</option>
            <option value="regex">${i18n.t('show-submissions.search-operator-regex')}</option>
            <option value="keywords">${i18n.t('show-submissions.search-operator-keywords')}</option>
        `;
    }

    /**
     * Opens submission Columns Modal
     * @param {string} state
     */
    openColumnOptionsModal(state) {
        let modal = this._(`#column-options-modal-${state}`);
        if (modal) {
            MicroModal.show(modal, {
                disableScroll: true,
                disableFocus: false,
            });
        }

        // Scroll list to top disableScroll: true
        let scrollWrapper = this._('#submission-modal-content');
        if (scrollWrapper) {
            scrollWrapper.scrollTo(0, 0);
        }
    }

    /**
     * Close Column Options Modal
     * @param {string} state
     */
    closeColumnOptionsModal(state) {
        let modal = this._(`#column-options-modal-${state}`);
        if (modal) {
            MicroModal.close(modal);
        }
    }

    /**
     * Close submission Columns Modal
     * @param {string} state
     */
    closeDetailModal(state) {
        let modal = this._(`#detailed-submission-modal-${state}`);
        if (modal) {
            // Remove the details part from the URL when closing the modal
            this.removeDetailsFromUrl();
            MicroModal.close(modal);
        }
    }

    /**
     * Append 'details/submissionId' to the URL
     * (called when opening the modal)
     * @param {string} submissionId
     */
    addDetailsToUrl(submissionId) {
        const currentUrl = new URL(window.location.href);
        const pathSegments = currentUrl.pathname.split('/');
        const baseIndex = pathSegments.indexOf(metadata['routing_name']);
        // Remove everything before and including the routing_name
        if (baseIndex > -1) {
            pathSegments.splice(0, baseIndex + 1);

            // Check if we already have details in the URL (while paginating)
            if (
                pathSegments[0].match(/[0-9a-f-]+/) &&
                pathSegments[1] === 'details' &&
                pathSegments[2].match(/[0-9a-f-]+/)
            ) {
                currentUrl.pathname = currentUrl.pathname.replace(
                    /\/details\/.*$/,
                    `/details/${submissionId}`,
                );
            } else {
                currentUrl.pathname += `/details/${submissionId}`;
            }

            const submissionDetailsUrl = new URL(currentUrl.toString());
            window.history.pushState({}, '', submissionDetailsUrl.toString());
        }
    }

    /**
     * Remove 'details/submissionId' from the URL
     * (called when closing the modal or pressing ESC)
     */
    removeDetailsFromUrl() {
        const currentUrl = new URL(window.location.href);
        const pathSegments = currentUrl.pathname.split('/');
        const detailsIndex = pathSegments.indexOf('details');
        if (detailsIndex > -1) {
            // Remove 'details' and the submissionId from the URL
            pathSegments.splice(detailsIndex, 2);
            currentUrl.pathname = pathSegments.join('/');
            window.history.pushState({}, '', currentUrl.toString());
        }
    }

    /**
     * Opens submission detail Modal
     *
     */
    showDetailedModal(state) {
        let modal = this._(`#detailed-submission-modal-${state}`);
        if (modal) {
            MicroModal.show(modal, {
                disableScroll: true,
                onClose: () => {
                    document.removeEventListener(
                        'keydown',
                        this.navigateBetweenDetailedSubmissionsHandler,
                    );
                },
                onShow: () => {
                    document.addEventListener(
                        'keydown',
                        this.navigateBetweenDetailedSubmissionsHandler,
                        true /* useCapture to run before the micromodal's keydown listener.*/,
                    );
                },
            });
        }
    }

    /**
     * Handle key events for the searchBar
     *
     * @param event
     */
    handleKeyEvents(event) {
        const activeElement = this.shadowRoot.activeElement;

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
        const actionsContainers = this._a('.actions-container');
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

        this.visibleRowCount = {
            ...this.visibleRowCount,
            [state]: this.submissionTables[state].tabulatorTable.getRows('visible').length,
        };
    }

    /**
     * Keydown Event function if left or right pressed, then we can change the detailed submissions
     *
     * @param event
     */
    navigateBetweenDetailedSubmissions(event) {
        const state = event
            .composedPath()
            .find((element) => element.classList.contains('micromodal-slide'))
            .getAttribute('data-state');
        if (!state) return;

        // left
        if (event.keyCode === 37) {
            let backBtn = /** @type {HTMLButtonElement} */ (
                this._(`#detailed-submission-modal-box-${state} .back-btn`)
            );
            if (backBtn && !backBtn.disabled) {
                this.showEntryOfPos(state, this.currentDetailPosition - 1, 'previous');
            }
        }

        //right
        if (event.keyCode === 39) {
            //and modal is open and left is not disabled
            let nextBtn = /** @type {HTMLButtonElement} */ (
                this._(`#detailed-submission-modal-box-${state} .next-btn`)
            );
            if (nextBtn && !nextBtn.disabled) {
                this.showEntryOfPos(state, this.currentDetailPosition + 1, 'next');
            }
        }

        // ESC
        if (event.keyCode === 27) {
            this.removeDetailsFromUrl();
        }
    }

    /**
     * Update Submission Table (order and visibility)
     * Based on the column-options-modal icon state
     * @param {string} state - 'draft' or 'submitted'
     */
    updateSubmissionTable(state) {
        const table = this.submissionTables[state];
        table.setColumns(this.submissionsColumns[state]);
    }

    /**
     * Gets stored submission table settings from localStorage
     * @param {string} state - 'draft' or 'submitted'
     * @returns {boolean} success
     */
    restoreSubmissionTableSettings(state) {
        if (this.storeSession && this.isLoggedIn()) {
            let optionsString = localStorage.getItem(
                `dbp-formalize-tableoptions-${this.activeFormName}-${state}-${this.auth['user-id']}`,
            );

            try {
                let options = JSON.parse(optionsString);
                if (!options) return false;

                // Get column definitions from the current table
                const table = this.submissionTables[state];
                let columns = table.getColumns();
                if (columns.length === 0) return false;

                const columnDefinitions = columns.map((column) => {
                    return column.getDefinition();
                });

                // Add back frozen columns
                const rowIndexDef = columnDefinitions.find((def) => def.field === 'rowIndex');
                const htmlButtonsDef = columnDefinitions.find((def) => def.field === 'htmlButtons');

                // Get all columns with formatter or sorter functions
                const formatterDefinitions = columnDefinitions.filter((columnDefinition) => {
                    if (
                        columnDefinition.formatter &&
                        (typeof columnDefinition.formatter === 'function' ||
                            typeof columnDefinition.titleFormatter === 'function')
                    ) {
                        return true;
                    }
                    if (columnDefinition.sorter && typeof columnDefinition.sorter === 'function') {
                        return true;
                    }
                });

                // Add back formatter and sorter functions
                options.forEach((storedColumnDefinition) => {
                    const columnWithFormatter = formatterDefinitions.find((columnDefinition) => {
                        return columnDefinition.field === storedColumnDefinition.field;
                    });

                    // rowIndex
                    if (columnWithFormatter?.formatter) {
                        storedColumnDefinition.formatter = columnWithFormatter?.formatter;
                    }

                    // htmlButtons
                    if (columnWithFormatter?.titleFormatter) {
                        storedColumnDefinition.titleFormatter = columnWithFormatter?.titleFormatter;
                    }
                    // dateCreated
                    if (columnWithFormatter?.sorter) {
                        storedColumnDefinition.sorter = columnWithFormatter?.sorter;
                    }
                });

                this.submissionsColumns[state] = [rowIndexDef, ...options, htmlButtonsDef];

                table.setColumns(this.submissionsColumns[state]);

                console.log(`this.submissionsColumns[${state}]`, this.submissionsColumns[state]);
            } catch (e) {
                console.error('Failed parsing stored table options', e);
                this.sendErrorAnalyticsEvent(
                    '[restoreSubmissionTableSettings]',
                    'WrongResponse',
                    e,
                );
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Stores submission Table settings in localStorage
     * @param {string} state - 'draft' or 'submitted'
     */
    storeSubmissionTableSettings(state) {
        if (this.storeSession && this.isLoggedIn()) {
            const publicId = this.auth['user-id'];
            // Filter out columns with non-serializable properties (like titleFormatter)
            // These columns (htmlButtons, ID) are frozen and auto-generated, so we don't need to store them
            const serializableColumns = this.submissionsColumns[state].filter((column) => {
                return column.frozen !== true;
            });

            localStorage.setItem(
                `dbp-formalize-tableoptions-${this.activeFormName}-${state}-${publicId}`,
                JSON.stringify(serializableColumns),
            );
        }
    }

    /**
     * Delete submission Table settings from localStorage
     * @param {string} state - 'draft' or 'submitted'
     */
    deleteSubmissionTableSettings(state) {
        if (this.storeSession && this.isLoggedIn()) {
            const publicId = this.auth['user-id'];
            localStorage.removeItem(
                `dbp-formalize-tableoptions-${this.activeFormName}-${state}-${publicId}`,
            );
        }
    }

    toggleVisibility(column, state) {
        const fieldName = column.field;
        this.submissionsColumns[state].map((col) => {
            if (col.field === fieldName) {
                col.visible = !col.visible;
            }
        });
        this.requestUpdate();
    }

    /**
     * Moves a header in this.submissionColumns Array and in DOM up
     *
     * @param {object} column - tabulator table column component
     * @param {string} state - draft or submitted
     * @param {string} direction - up or down
     */
    moveHeader(column, state, direction) {
        // Swap the two elements in  this.submissionsColumns
        const fieldName = column.field;
        const index = this.submissionsColumns[state].findIndex((col) => col.field === fieldName);
        const originalColumn = this.submissionsColumns[state][index];

        const delta = direction === 'up' ? -1 : 1;

        this.submissionsColumns[state][index] = this.submissionsColumns[state][index + delta];
        this.submissionsColumns[state][index + delta] = originalColumn;

        this.requestUpdate();
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
        this.addDetailsToUrl(next_data.submissionId);

        this.requestDetailedSubmission(state, next_data, positionToShow);
    }

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
                ${getShowSubmissionCSS()}

                .visually-hidden {
                    clip: rect(0 0 0 0);
                    clip-path: inset(50%);
                    height: 1px;
                    overflow: hidden;
                    position: absolute;
                    white-space: nowrap;
                    width: 1px;
                }
        `;
    }

    renderSubmissionDetailsModal(state) {
        const i18n = this._i18n;

        return html`
            <div
                class="modal micromodal-slide"
                id="detailed-submission-modal-${state}"
                data-state=${state}
                aria-hidden="true">
                <div class="modal-overlay" tabindex="-2">
                    <div
                        class="modal-container detailed-submission-modal-box"
                        id="detailed-submission-modal-box-${state}"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="detailed-submission-modal-title">
                        <header class="modal-header">
                            <dbp-icon-button
                                title="${i18n.t('show-submissions.modal-close')}"
                                aria-label="${i18n.t('show-submissions.modal-close')}"
                                class="modal-close"
                                icon-name="close"
                                @click="${() => {
                                    this.closeDetailModal(state);
                                }}"></dbp-icon-button>
                            <h3
                                id="detailed-submission-modal-title-${state}"
                                class="detailed-submission-modal-title">
                                ${i18n.t('show-submissions.detailed-submission-dialog-title')}
                            </h3>
                        </header>
                        <main
                            class="modal-content detailed-submission-modal-content"
                            id="detailed-submission-modal-content-${state}">
                            <div class="content-wrapper"></div>
                        </main>
                        <footer class="modal-footer">
                            <div class="modal-footer-btn">
                                <label
                                    class="button-container ${classMap({
                                        hidden: !this.hiddenColumns,
                                    })}">
                                    ${i18n.t('show-submissions.apply-col-settings')}
                                    <input
                                        type="checkbox"
                                        id="apply-col-settings-${state}"
                                        class="apply-col-settings"
                                        name="apply-col-settings"
                                        @click="${() => {
                                            this.requestDetailedSubmission(
                                                state,
                                                this.currentRow,
                                                this.currentRow.getData(),
                                            );
                                        }}"
                                        checked />
                                    <span class="checkmark"></span>
                                </label>
                                <div class="btn-row-left">
                                    <dbp-button
                                        class="back-btn"
                                        no-spinner-on-click
                                        title="${i18n.t(
                                            'show-submissions.previous-entry-btn-title',
                                        )}"
                                        @click="${() => {
                                            this.showEntryOfPos(
                                                state,
                                                this.currentDetailPosition - 1,
                                                'previous',
                                            );
                                        }}"
                                        ?disabled=${!this.isPrevEnabled}>
                                        <dbp-icon name="chevron-left" aria-hidden="true"></dbp-icon>
                                        ${i18n.t('show-submissions.previous-entry-btn-title')}
                                    </dbp-button>
                                    <div class="page-numbering">
                                        ${i18n.t('show-submissions.detailed-submission-dialog-id', {
                                            id: this.currentBeautyId,
                                            nItems: this.totalNumberOfItems[state],
                                        })}
                                    </div>
                                    <dbp-button
                                        class="next-btn"
                                        no-spinner-on-click
                                        title="${i18n.t('show-submissions.next-entry-btn-title')}"
                                        @click="${() => {
                                            this.showEntryOfPos(
                                                state,
                                                this.currentDetailPosition + 1,
                                                'next',
                                            );
                                        }}"
                                        ?disabled=${!this.isNextEnabled}>
                                        ${i18n.t('show-submissions.next-entry-btn-title')}
                                        <dbp-icon
                                            name="chevron-right"
                                            aria-hidden="true"></dbp-icon>
                                    </dbp-button>
                                </div>
                            </div>
                        </footer>
                    </div>
                </div>
            </div>
        `;
    }

    renderColumnSettingsModal(state) {
        const i18n = this._i18n;

        // Remove columns that we don't want to show in the settings modal (frozen columns)
        const columns = this.submissionsColumns[state].filter((column) => {
            return column && column.frozen !== true;
        });

        if (columns.length === 0) {
            return;
        }

        return html`
            <div
                class="modal micromodal-slide"
                id="column-options-modal-${state}"
                aria-hidden="true">
                <div class="modal-overlay" tabindex="-2" data-micromodal-close>
                    <div
                        class="modal-container"
                        id="filter-modal-box"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="submission-modal-title">
                        <header class="modal-header">
                            <dbp-icon-button
                                title="${i18n.t('show-submissions.modal-close')}"
                                aria-label="${i18n.t('show-submissions.modal-close')}"
                                class="modal-close"
                                icon-name="close"
                                @click="${() => {
                                    this.closeColumnOptionsModal(state);
                                }}"></dbp-icon-button>
                            <p id="submission-modal-title">
                                ${i18n.t('show-submissions.header-settings')}
                                <span class="tag tag--state">${state}</span>
                            </p>
                        </header>
                        <main
                            class="modal-content submission-modal-content"
                            id="submission-modal-content-${state}">
                            <ul class="headers">
                                ${columns.map(
                                    (column, index) => html`
                                        <li
                                            class="header-field"
                                            data-index="${index}"
                                            data-fieldname="${column.field}">
                                            <div class="header-order">${index + 1}</div>
                                            <div class="header-title">${column.title}</div>
                                            <dbp-icon-button
                                                data-visibility="${column.visible}"
                                                icon-name=${column.visible
                                                    ? this.iconNameVisible
                                                    : this.iconNameHidden}
                                                @click="${() => {
                                                    this.toggleVisibility(column, state);
                                                }}"
                                                class="header-visibility-icon"></dbp-icon-button>

                                            <div class="button-wrapper">
                                                <div class="header-move">
                                                    <dbp-icon-button
                                                        class="arrow-up ${classMap({
                                                            'first-arrow-up': index === 0,
                                                        })}"
                                                        icon-name="arrow-up"
                                                        title="${i18n.t(
                                                            'show-submissions.move-column-up',
                                                        )}"
                                                        @click="${() => {
                                                            this.moveHeader(column, state, 'up');
                                                        }}"></dbp-icon-button>
                                                    <dbp-icon-button
                                                        class="header-button arrow-down ${classMap({
                                                            'last-arrow-down':
                                                                index ===
                                                                this.submissionsColumns[state]
                                                                    .length -
                                                                    1,
                                                        })}"
                                                        icon-name="arrow-down"
                                                        title="${i18n.t(
                                                            'show-submissions.move-column-down',
                                                        )}"
                                                        @click="${() => {
                                                            this.moveHeader(column, state, 'down');
                                                        }}"></dbp-icon-button>
                                                </div>
                                            </div>
                                        </li>
                                    `,
                                )}
                            </ul>
                        </main>
                        <footer class="modal-footer">
                            <div class="modal-footer-btn">
                                <div>
                                    <button
                                        title="${i18n.t('show-submissions.abort')}"
                                        class="check-btn button is-secondary"
                                        @click="${() => {
                                            this.closeColumnOptionsModal(state);
                                        }}">
                                        ${i18n.t('show-submissions.abort')}
                                    </button>
                                </div>
                                <div>
                                    <button
                                        title="${i18n.t('show-submissions.reset-filter')}"
                                        class="check-btn button button--reset is-secondary"
                                        .disabled="${this.isResetButtonDisabled[state]}"
                                        @click="${() => {
                                            this.resetSettings(state);
                                        }}">
                                        ${i18n.t('show-submissions.reset-filter')}
                                    </button>
                                    <button
                                        title="${i18n.t('show-submissions.all-filters-hide')}"
                                        class="check-btn button button--hide-all is-secondary"
                                        @click="${() => {
                                            this.toggleAllColumns(state, 'hide');
                                        }}">
                                        ${i18n.t('show-submissions.all-filters-hide')}
                                    </button>
                                    <button
                                        title="${i18n.t('show-submissions.all-filters-show')}"
                                        class="check-btn button button--show-all is-secondary"
                                        @click="${() => {
                                            this.toggleAllColumns(state, 'show');
                                        }}">
                                        ${i18n.t('show-submissions.all-filters-show')}
                                    </button>
                                </div>
                                <button
                                    class="check-btn button button--save is-primary"
                                    id="check"
                                    @click="${() => {
                                        this.updateSubmissionTable(state);
                                        this.storeSubmissionTableSettings(state);
                                        this.closeColumnOptionsModal(state);
                                    }}">
                                    ${i18n.t('show-submissions.save-columns')}
                                </button>
                            </div>
                        </footer>
                    </div>
                </div>
            </div>
        `;
    }

    renderExportWidget(state) {
        const i18n = this._i18n;

        const exportCount =
            this.selectedRowCount[state] === 0
                ? this.allRowCount[state]
                : this.selectedRowCount[state];

        return html`
            <div class="export-container">
                <select
                    id="export-select"
                    class="dropdown-menu"
                    aria-label="${i18n.t('show-submissions.export-select-aria-label')}"
                    @change="${(e) => {
                        this.exportSubmissionTable(e, state);
                    }}">
                    <option value="-" disabled selected>
                        ${i18n.t('show-submissions.default-export-select')}
                    </option>
                    <option value="csv">
                        ${i18n.t('show-submissions.export-csv-label', {
                            n: exportCount,
                        })}
                    </option>
                    <option value="xlsx">
                        ${i18n.t('show-submissions.export-xlsx-label', {
                            n: exportCount,
                        })}
                    </option>
                    <option value="pdf">
                        ${i18n.t('show-submissions.export-pdf-label', {
                            n: exportCount,
                        })}
                    </option>
                    ${this.submissionsHasAttachment[state]
                        ? html`
                              <option value="attachments">
                                  ${i18n.t('show-submissions.export-attachments-label', {
                                      n: exportCount,
                                  })}
                              </option>
                          `
                        : ''}
                </select>
                <dbp-icon
                    class="export-select-icon"
                    name="chevron-down"
                    aria-hidden="true"></dbp-icon>
            </div>
        `;
    }

    renderActionsWidget(state) {
        const i18n = this._i18n;

        return html`
            <div
                class="actions-container ${classMap({open: this.actionsWidgetIsOpen[state]})}"
                id="actions-container--${state}">
                <button
                    class="button open-actions-button is-secondary"
                    id="action-button-${state}"
                    ?disabled=${!this.isActionAvailable[state]}
                    @click="${() => {
                        this.setActionButtonsStates(state);
                        this.toggleActionsDropdown(state);
                    }}">
                    ${i18n.t('show-submissions.actions-button-text')}
                    <dbp-icon
                        class="icon-chevron"
                        name="chevron-down"
                        aria-hidden="true"></dbp-icon>
                </button>
                <div class="actions-dropdown" ?inert=${!this.actionsWidgetIsOpen[state]}>
                    <ul class="actions-list">
                        <li class="action">
                            <button
                                class="button action-button button--edit-submission"
                                ?disabled=${!this.isEditSubmissionEnabled[state]}
                                @mousedown="${async (event) => {
                                    await this.handleEditSubmissions(event, state);
                                    this.toggleActionsDropdown(state);
                                }}">
                                <dbp-icon name="pencil" aria-hidden="true"></dbp-icon>
                                ${i18n.t('show-submissions.edit-submission-button-text')}
                            </button>
                        </li>
                        <li class="action">
                            <button
                                class="button action-button button--edit-permission"
                                ?disabled=${!this.isEditSubmissionPermissionEnabled[state]}
                                @click="${async () => {
                                    await this.handleEditSubmissionsPermission(state);
                                    this.toggleActionsDropdown(state);
                                }}">
                                <dbp-icon name="edit-permission" aria-hidden="true"></dbp-icon>
                                ${i18n.t('show-submissions.edit-permission-button-text')}
                            </button>
                        </li>
                        ${this.isDeleteAllSubmissionEnabled[state]
                            ? html`
                                  <li class="action">
                                      <button
                                          class="button action-button button--delete-all"
                                          @click="${async () => {
                                              await this.handleDeleteSubmissions(state);
                                          }}">
                                          <dbp-icon name="trash" aria-hidden="true"></dbp-icon>
                                          ${i18n.t(
                                              'show-submissions.delete-all-submissions-button-text',
                                              {n: this.allRowCount[state]},
                                          )}
                                      </button>
                                  </li>
                              `
                            : ''}
                        ${this.isDeleteSelectedSubmissionEnabled[state]
                            ? html`
                                  <li class="action">
                                      <button
                                          class="button action-button button--delete-selected"
                                          @click="${async () => {
                                              await this.handleDeleteSubmissions(state, true);
                                          }}">
                                          <dbp-icon
                                              name="delete-selection"
                                              aria-hidden="true"></dbp-icon>
                                          ${i18n.t(
                                              'show-submissions.delete-selected-submissions-button-text',
                                              {n: this.selectedRowCount[state]},
                                          )}
                                      </button>
                                  </li>
                              `
                            : ''}
                    </ul>
                </div>
            </div>
        `;
    }

    setIsActionAvailable(state) {
        this.setActionButtonsStates(state);
        if (
            this.isEditSubmissionEnabled[state] === false &&
            this.isEditSubmissionPermissionEnabled[state] === false &&
            this.isDeleteAllSubmissionEnabled[state] === false &&
            this.isDeleteSelectedSubmissionEnabled[state] === false
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
        const selectedRows = this.submissionTables[state].tabulatorTable.getSelectedRows();
        const allRows = this.submissionTables[state].tabulatorTable.getRows('all');
        // const activeForm = this.forms.get(this.activeFormId);
        // const formGrantedActions = activeForm.formGrantedActions;

        let selectedSubmissionsGrants = [];
        for (const row of selectedRows) {
            const submissionId = row.getData().submissionId;
            selectedSubmissionsGrants.push(...this.submissionsGrantedActions.get(submissionId));
        }
        // console.log(`selectedSubmissionsGrants`, selectedSubmissionsGrants);

        let allSubmissionsGrants = [];
        for (const row of allRows) {
            const submissionId = row.getData().submissionId;
            allSubmissionsGrants.push(...this.submissionsGrantedActions.get(submissionId));
        }
        // console.log(`allSubmissionsGrants`, allSubmissionsGrants);

        // Set row counts
        this.selectedRowCount[state] = selectedRows.length;
        this.allRowCount[state] = allRows.length;

        this.isDeleteSelectedSubmissionEnabled[state] =
            this.selectedRowCount[state] > 0 &&
            // If we can delete any of the selected submissions
            (selectedSubmissionsGrants.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                selectedSubmissionsGrants.includes(SUBMISSION_PERMISSIONS.DELETE));

        this.isDeleteAllSubmissionEnabled[state] =
            this.selectedRowCount[state] === 0 &&
            // If we can delete any of the submissions
            (allSubmissionsGrants.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                allSubmissionsGrants.includes(SUBMISSION_PERMISSIONS.DELETE));

        this.isEditSubmissionEnabled[state] =
            this.selectedRowCount[state] === 1 &&
            (selectedSubmissionsGrants.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                selectedSubmissionsGrants.includes(SUBMISSION_PERMISSIONS.UPDATE));

        this.isEditSubmissionPermissionEnabled[state] =
            this.selectedRowCount[state] === 1 &&
            selectedSubmissionsGrants.includes(SUBMISSION_PERMISSIONS.MANAGE);

        this.requestUpdate();
    }

    successFailureNotification(responseStatus) {
        const successCount = responseStatus.filter((status) => status === true).length;
        if (successCount > 0) {
            sendNotification({
                summary: this._i18n.t('success.success-title'),
                body: this._i18n.t('success.submissions-processed', {count: successCount}),
                type: 'success',
                timeout: 5,
            });
        }

        const errorCount = responseStatus.filter((status) => status === false).length;
        if (errorCount > 0) {
            sendNotification({
                summary: this._i18n.t('errors.error-title'),
                body: this._i18n.t('errors.submissions-processing-failed', {count: errorCount}),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    /**
     * Reset action buttons state if table selection changes
     * @param {CustomEvent} tableEvent
     */
    handleTableSelectionChanges(tableEvent) {
        const selectedRows = tableEvent.detail.selected;
        const deSelectedRows = tableEvent.detail.deselected;

        const activeTable =
            selectedRows.length > 0 ? selectedRows[0].getTable() : deSelectedRows[0].getTable();

        const root = activeTable.element.getRootNode();
        if (root instanceof ShadowRoot) {
            const tabulatorTableComponent = root.host;
            const state = this.getTableState(tabulatorTableComponent.identifier);
            this.selectedRowCount[state] = selectedRows.length;

            this.setIsActionAvailable(state);
        }
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

    handleEditSubmissions(event, state) {
        const data = this.submissionTables[state].tabulatorTable.getSelectedData();
        const submissionId = data[0].submissionId;

        // Redirect to render-form activity to display the readonly form with submission values
        const activeForm = this.forms.get(this.activeFormId);
        const activeFormSlug = activeForm ? activeForm.formSlug : null;

        // @TODO: LunchLottery don't have a slug
        // other forms don't have read-only view
        if (activeForm.formName === 'Ethikantrag' || activeForm.formName === 'Ethics Proposal') {
            // Go to the readonly view of the form submission
            let formSubmissionUrl =
                getFormRenderUrl(activeFormSlug, this.lang) + `/${submissionId}`;
            const url = new URL(formSubmissionUrl);
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
            const confirmed = await getDeletionConfirmation(this);
            if (!confirmed) return;

            let responseStatus = [];
            let failedRequestToSelect = [];
            let index = 0;
            for (const submission of data) {
                const response = await this.apiDeleteSubmissions(submission.submissionId);
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
                    this.options_submissions[state].data = this.options_submissions[
                        state
                    ].data.filter((sub) => {
                        return sub.submissionId !== submission.submissionId;
                    });
                } else {
                    failedRequestToSelect.push(submission.submissionId);
                }
                index++;
            }
            this.needTableRebuild[state] = true;
            // Update row-indexes
            this.submissionTables[state].tabulatorTable.redraw(true);
            // Report
            this.successFailureNotification(responseStatus);

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

    async apiDeleteSubmissions(submissionId) {
        if (!submissionId) {
            sendNotification({
                summary: this._i18n.t('errors.error-title'),
                body: this._i18n.t('errors.no-submission-id-provided'),
                type: 'danger',
                timeout: 0,
            });
            return false;
        }

        try {
            const response = await fetch(
                this.entryPointUrl + `/formalize/submissions/${submissionId}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer ' + this.auth.token,
                    },
                },
            );

            if (!response.ok) {
                console.warn(`Failed to delete submission. Response status: ${response.status}`);
                return false;
            } else {
                return true;
            }
        } catch (error) {
            console.error(error.message);
            return false;
        }
    }

    closeAllSearchWidgets() {
        this.searchWidgetIsOpen = {
            draft: false,
            submitted: false,
        };
    }

    closeSearchWidget(state) {
        const extendableSearchbar = this._(`#extendable-searchbar--${state}`);
        extendableSearchbar.classList.add('closing');

        setTimeout(() => {
            this.searchWidgetIsOpen = {...this.searchWidgetIsOpen, [state]: false};
            extendableSearchbar.classList.remove('closing');
        }, 250);
    }

    renderSearchWidget(state) {
        const i18n = this._i18n;

        return html`
            <div class="search-container">
                <div
                    id="extendable-searchbar--${state}"
                    class="extendable-searchbar ${classMap({
                        open: this.searchWidgetIsOpen[state],
                    })}">
                    <div
                        class="extended-menu ${classMap({open: this.searchWidgetIsOpen[state]})}"
                        id="searchbar-menu--${state}">
                        <div class="search-input">
                            <label for="searchbar--${state}">
                                ${i18n.t('show-submissions.search-input-label')}:
                            </label>

                            <input
                                type="text"
                                id="searchbar--${state}"
                                data-state="${state}"
                                class="searchbar"
                                placeholder="${i18n.t('show-submissions.searchbar-placeholder')}" />

                            <button
                                class="button search-button"
                                id="search-button--${state}"
                                @click="${() => {
                                    this.filterTable(state);
                                }}">
                                <dbp-icon
                                    title="${i18n.t('show-submissions.search-button')}"
                                    aria-label="${i18n.t('show-submissions.search-button')}"
                                    name="search"></dbp-icon>
                            </button>
                            <button
                                class="button search-toggle-filters-button"
                                id="search-toggle-filters-button--${state}"
                                aria-expanded="${this.searchWidgetIsOpen[state]}"
                                aria-controls="search-filter-columns--${state} search-filter-operator--${state}"
                                @click="${() => {
                                    this.toggleSearchFilters(state);
                                }}">
                                <dbp-icon
                                    name="chevron-down"
                                    title="${i18n.t('show-submissions.filter-toggle-button')}"
                                    aria-label="${i18n.t(
                                        'show-submissions.filter-toggle-button',
                                    )}"></dbp-icon>
                                <span class="visually-hidden">
                                    ${this.searchWidgetIsOpen[state]
                                        ? i18n.t('show-submissions.close-search-filters')
                                        : i18n.t('show-submissions.open-search-filters')}
                                </span>
                            </button>
                        </div>

                        <div
                            id="search-filter-columns--${state}"
                            role="region"
                            aria-label="${i18n.t('show-submissions.search-filters-region')}"
                            class="search-filter-columns ${classMap({
                                open: this.searchWidgetIsOpen[state],
                            })}">
                            <label for="search-select-${state}">
                                ${i18n.t('show-submissions.search-in')}:
                            </label>
                            <select
                                id="search-select--${state}"
                                class="button dropdown-menu search-select"
                                title="${i18n.t('show-submissions.search-in-column')}"
                                @change="${(e) => {
                                    this.filterTable(state);
                                }}">
                                <optgroup label="${i18n.t('show-submissions.search-in-column')}">
                                    <legend>${i18n.t('show-submissions.search-in-column')}:</legend>
                                    ${this.getTableHeaderOptions(state)}
                                </optgroup>
                            </select>
                            <dbp-icon
                                name="chevron-down"
                                title="${i18n.t('show-submissions.filter-toggle-button')}"
                                aria-label="${i18n.t(
                                    'show-submissions.filter-toggle-button',
                                )}"></dbp-icon>
                        </div>

                        <div
                            id="search-filter-operator--${state}"
                            role="region"
                            aria-label="${i18n.t('show-submissions.search-operator')}"
                            class="search-filter-operator ${classMap({
                                open: this.searchWidgetIsOpen[state],
                            })}">
                            <label for="search-operator--${state}">
                                ${i18n.t('show-submissions.search-operator')}:
                            </label>
                            <select
                                id="search-operator--${state}"
                                title="${i18n.t('show-submissions.search-operator')}"
                                class="button dropdown-menu search-operator"
                                @change="${(e) => {
                                    this.filterTable(state);
                                }}">
                                <optgroup label="${i18n.t('show-submissions.search-operator')}">
                                    <legend>${i18n.t('show-submissions.search-operator')}:</legend>
                                    ${this.getTableFilterOptions()}
                                </optgroup>
                            </select>
                            <dbp-icon
                                name="chevron-down"
                                title="${i18n.t('show-submissions.filter-toggle-button')}"
                                aria-label="${i18n.t(
                                    'show-submissions.filter-toggle-button',
                                )}"></dbp-icon>
                        </div>
                    </div>
                    <div class="statusbar" role="status" aria-live="polite" aria-atomic="true">
                        <span class="selection-info">
                            ${i18n.t('show-submissions.n-items-shown-label', {
                                n: this.visibleRowCount[state],
                            })}${this.selectedRowCount[state] > 0
                                ? html`
                                      ,
                                      ${i18n.t('show-submissions.n-items-selected-label', {
                                          n: this.selectedRowCount[state],
                                      })}
                                  `
                                : ''}
                        </span>
                        <button
                            class="reset-search"
                            @click="${() => {
                                this.clearAllFilters();
                            }}">
                            <dbp-icon
                                name="spinner-arrow"
                                title="${i18n.t('show-submissions.reset-search-label')}"
                                aria-label="${i18n.t(
                                    'show-submissions.reset-search-label',
                                )}"></dbp-icon>
                            ${i18n.t('show-submissions.reset-search-label')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        const i18n = this._i18n;

        // console.log(`this.submissions`, this.submissions);

        return html`
            <div
                class="notification is-warning ${classMap({
                    hidden: this.isLoggedIn(),
                })}">
                ${i18n.t('error-login-message')}
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

                <div
                    class="control forms-spinner ${classMap({
                        hidden: !this.loadingFormsTable || this.showSubmissionTables,
                    })}">
                    <span class="loading">
                        <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
                    </span>
                </div>

                <div class="container forms-table ${classMap({hidden: !this.showFormsTable})}">
                    <dbp-tabulator-table
                        lang="${this.lang}"
                        class="tabulator-table"
                        id="tabulator-table-forms"
                        identifier="forms-table"
                        pagination-enabled
                        pagination-size="5"
                        .options=${this.options_forms}></dbp-tabulator-table>
                </div>

                <div
                    class="control submissions-spinner ${classMap({
                        hidden: !this.loadingSubmissionTables || this.showFormsTable,
                    })}">
                    <span class="loading">
                        <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
                    </span>
                </div>

                <div
                    class="table-wrapper submissions${classMap({
                        hideWithoutDisplay: !this.showSubmissionTables,
                    })}">
                    <span class="back-navigation">
                        <a
                            @click="${() => {
                                this.showSubmissionTables = false;
                                this.loadingSubmissionsTables = false;
                                this.clearAllFilters();
                                this.closeAllSearchWidgets();
                                this.loadingFormsTable = false;
                                this.showFormsTable = true;
                                this.activeFormId = null;
                                this.sendSetPropertyEvent('routing-url', '/', true);
                            }}"
                            title="${i18n.t('show-submissions.back-text')}">
                            <dbp-icon name="chevron-left"></dbp-icon>
                            ${i18n.t('show-submissions.back-text')}
                        </a>
                    </span>
                    <div class="table-header submissions">
                        <h3>${this.activeFormName}</h3>
                        ${this.createSubmissionUrl
                            ? html`
                                  <a
                                      class="create-submission-button"
                                      href="${this.createSubmissionUrl}"
                                      target="_blank">
                                      ${i18n.t('show-submissions.create-submission-button')}
                                  </a>
                              `
                            : ''}
                    </div>
                </div>
            </div>

            <div
                class="container submissions-table ${classMap({
                    hidden: !this.showSubmissionTables,
                })}">
                ${Object.values(SUBMISSION_STATES).map((state) => {
                    const submissionTableTitle = {
                        draft: i18n.t('show-submissions.submission-table-draft-title'),
                        submitted: i18n.t('show-submissions.submission-table-submitted-title'),
                    };
                    if (this.activeFormId) {
                        const activeForm = this.forms.get(this.activeFormId);
                        const allowedSubmissionStates = activeForm.allowedSubmissionStates;
                        this.enabledStates = {
                            draft: isDraftStateEnabled(allowedSubmissionStates),
                            submitted: isSubmittedStateEnabled(allowedSubmissionStates),
                        };
                    }
                    return html`
                        <div
                            class="${classMap({
                                hidden: this.enabledStates[state] ? false : true,
                            })}">
                            <h3 class="table-title">${submissionTableTitle[state]}</h3>

                            <div class="table-buttons table-buttons--${state}">
                                ${this.noSubmissionAvailable[state] === true
                                    ? ''
                                    : html`
                                          <div class="action-buttons-container">
                                              ${this.renderActionsWidget(state)}
                                              ${this.renderExportWidget(state)}
                                          </div>
                                          <div class="search-bar-container">
                                              ${this.renderSearchWidget(state)}
                                          </div>
                                      `}
                            </div>

                            <dbp-tabulator-table
                                lang="${this.lang}"
                                class="tabulator-table tabulator-table--${state}"
                                id="tabulator-table-submissions-${state}"
                                identifier="submissions-table-${state}"
                                .options=${this.options_submissions[state]}
                                pagination-size="5"
                                sticky-header></dbp-tabulator-table>
                        </div>
                        ${this.renderColumnSettingsModal(state)}
                        ${this.renderSubmissionDetailsModal(state)}
                    `;
                })}
            </div>

            <dbp-grant-permission-dialog
                id="grant-permission-dialog"
                lang="${this.lang}"
                modal-title="${i18n.t('show-submissions.edit-permission-modal-title')}"
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

            <!-- Deletion Confirmation Modal -->
            <dbp-modal
                id="deletion-confirmation-modal--formalize"
                class="modal modal--confirmation"
                modal-id="deletion-confirmation-modal"
                title="${i18n.t('show-submissions.delete-confirmation-title')}"
                subscribe="lang">
                <div slot="content">
                    <p>${i18n.t('show-submissions.delete-confirmation-message')}</p>
                </div>
                <menu slot="footer" class="footer-menu">
                    <dbp-button
                        type="is-secondary"
                        no-spinner-on-click
                        @click="${() => handleDeletionCancel(this)}">
                        ${i18n.t('show-submissions.abort')}
                    </dbp-button>
                    <dbp-button
                        type="is-danger"
                        no-spinner-on-click
                        @click="${() => handleDeletionConfirm(this)}">
                        ${i18n.t('show-submissions.delete')}
                    </dbp-button>
                </menu>
            </dbp-modal>
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-show-submissions', ShowSubmissions);
