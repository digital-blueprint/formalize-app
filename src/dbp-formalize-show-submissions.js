import {css, html, unsafeCSS} from 'lit';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {
    getIconSVGURL,
    Button,
    Icon,
    IconButton,
    LoadingButton,
    MiniSpinner,
    Translated,
} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit/directives/class-map.js';
import {Activity} from './activity.js';
import {CustomTabulatorTable} from './table-components.js';
import MicroModal from './micromodal.es.js';
import {getFormRenderUrl, getFormShowSubmissionsUrl, SUBMISSION_PERMISSIONS} from './utils.js';
import {getSelectorFixCSS, getFileHandlingCss} from './styles.js';
import metadata from './dbp-formalize-show-submissions.metadata.json';
import xss from 'xss';
import {send} from '@dbp-toolkit/common/notification';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';

class ShowSubmissions extends ScopedElementsMixin(DBPFormalizeLitElement) {
    constructor() {
        super();
        this.allForms = [];
        this.activity = new Activity(metadata);
        this.boundPressEnterAndSubmitSearchHandler = this.pressEnterAndSubmitSearch.bind(this);
        this.boundCloseActionsDropdownHandler = this.closeActionsDropdown.bind(this);
        this.options_submissions = {
            draft: {},
            submitted: {},
            accepted: {},
        };
        this.options_forms = {};
        this.forms = new Map();

        // Submission states (?)
        this.submissionStates = ['draft', 'submitted', 'accepted'];

        this.rawSubmissions = [];
        this.submissions = {
            draft: [],
            submitted: [],
            accepted: [],
        };
        this.showSubmissionTables = false;
        this.showFormsTable = false;
        this.submissionSlug = '';
        this.submissionsColumns = {
            draft: [],
            submitted: [],
            accepted: [],
        };
        this.submissionsColumnsInitial = {
            draft: [],
            submitted: [],
            accepted: [],
        };
        this.tableSettingsInitialized = {
            draft: false,
            submitted: false,
            accepted: false,
        };
        this.navigateBetweenDetailedSubmissionsHandler =
            this.navigateBetweenDetailedSubmissions.bind(this);
        this.activeCourse = '';
        this.activeForm = '';
        this.currentRow = null;
        this.currentBeautyId = 0;
        this.totalNumberOfItems = {
            draft: 0,
            submitted: 0,
            accepted: 0,
        };
        this.isPrevEnabled = false;
        this.isNextEnabled = false;
        this.storeSession = true;
        this.loadingFormsTable = false;
        this.loadingSubmissionTables = false;
        this.noSubmissionAvailable = true;
        this.modalContentHeight = 0;
        this.loadCourses = true;
        this.hiddenColumns = false;
        this.currentDetailPosition = 0;

        this.submissionTables = {
            submitted: null,
            draft: null,
            accept: null,
        };
        this.formsTable = null;

        this.isDeleteSelectedSubmissionEnabled = false;
        this.isDeleteAllSubmissionEnabled = false;
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
        };
    }

    static get properties() {
        return {
            ...super.properties,
            allForms: {type: Array, attribute: false},
            form: {type: String},
            name: {type: String},
            forms: {type: Array, attribute: false},
            submissions: {type: Array, attribute: false},
            emptyCoursesTable: {type: Boolean, attribute: true},
            showFormsTable: {type: Boolean, attribute: false},
            showSubmissionTables: {type: Boolean, attribute: false},
            loadingFormsTable: {type: Boolean, attribute: false},
            loadingSubmissionTables: {type: Boolean, attribute: false},
            submissionsColumns: {type: Array, attribute: false},
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

            isDeleteSelectedSubmissionEnabled: {type: Boolean, attribute: false},
            isDeleteAllSubmissionEnabled: {type: Boolean, attribute: false},
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keyup', this.boundPressEnterAndSubmitSearchHandler);
        document.removeEventListener('click', this.boundCloseActionsDropdownHandler);
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
            autoColumns: true, //'full',
            rowHeight: 64,
            layout: 'fitData',
            layoutColumnsOnNewData: true,
            selectableRows: true,
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
        };

        this.options_submissions.submitted = {...options_submissions};
        this.options_submissions.draft = {...options_submissions};
        this.options_submissions.accepted = {...options_submissions};

        this.updateComplete.then(async () => {
            // see: http://tabulator.info/docs/5.1
            document.addEventListener('keyup', this.boundPressEnterAndSubmitSearchHandler);
            document.addEventListener('click', this.boundCloseActionsDropdownHandler);

            // Table built event listener
            document.addEventListener(
                'dbp-tabulator-table-built',
                (/** @type {CustomEvent} */ e) => {
                    if (e.detail.id) {
                        const state = this.getTableState(e.detail.id);
                        if (state) {
                            this.getSubmissionTableSettings(state);
                            // this.setInitialSubmissionTableOrder(state);
                            this.defineSettings(state);
                            this.updateSubmissionTable(state);
                        }
                    }
                },
            );
        });
    }

    getTableState(tableId) {
        for (const state of Object.keys(this.submissionTables)) {
            if (this.submissionTables[state] && tableId === this.submissionTables[state].id) {
                return state;
            }
        }
        return null;
    }

    async firstUpdated() {
        this.formsTable = /** @type {CustomTabulatorTable} */ (this._('#tabulator-table-forms'));
        this.submissionStates.forEach((state) => {
            this.submissionTables[state] = /** @type {CustomTabulatorTable} */ (
                this._(`#tabulator-table-submissions-${state}`)
            );
        });

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
                    }
                } else {
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

        super.updated(changedProperties);
    }

    throwSomethingWentWrongNotification() {
        const i18n = this._i18n;

        send({
            summary: i18n.t('show-submissions.something-went-wrong-title'),
            body: i18n.t('show-submissions.something-went-wrong-body'),
            type: 'danger',
            timeout: 5,
        });
    }

    /**
     * Load form modules and create ID -> slug mapping
     */
    async loadModules() {
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
        }
    }

    /**
     * Display the form submission table for the given form
     * @param {object} form - form object
     */
    switchToSubmissionTable(form) {
        if (this.activeCourse) {
            this.deleteSettings();
        }
        this.activeCourse = form.formName;
        this.activeForm = form.formId;
        this.showFormsTable = false;
        this.loadingSubmissionTables = true;
        this.getAllFormSubmissions(this.activeForm).then(async () => {
            this.sendSetPropertyEvent('routing-url', `/${form.formId}`, true);

            for (const state of Object.keys(this.submissionTables)) {
                if (this.submissionTables[state]) {
                    this.options_submissions[state].data = this.submissions[state];

                    if (this.submissions[state].length === 0) {
                        this.loadingSubmissionTables = false;
                        this.showSubmissionTables = true; // show back button
                        this.showFormsTable = false;

                        this.submissionTables[state].clearData();
                        this.submissionTables[state].buildTable();
                    } else {
                        this.submissionTables[state].buildTable();
                        // Get table settings from localstorage
                        this.getSubmissionTableSettings(state);
                        // this.setInitialSubmissionTableOrder(state);
                        this.defineSettings(state);
                        this.updateSubmissionTable(state);

                        this.loadingSubmissionTables = false;
                        this.showSubmissionTables = true;
                        this.showFormsTable = false;
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

            const response = await fetch(this.entryPointUrl + '/formalize/forms/', {
                headers: {
                    'Content-Type': 'application/ld+json',
                    Authorization: 'Bearer ' + this.auth.token,
                },
            });

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
                    const formName = entry['name'];
                    const formId = entry['identifier'];
                    // const allowedActionsWhenSubmitted = entry['allowedActionsWhenSubmitted'];
                    const formGrantedActions = entry['grantedActions'];

                    this.forms.set(formId, {
                        ...this.forms.get(formId),
                        formName,
                        formId,
                        // allowedActionsWhenSubmitted,
                        formGrantedActions,
                    });

                    let btn = this.formsTable.createScopedElement(
                        'dbp-formalize-get-details-button',
                    );
                    btn.setAttribute('subscribe', 'lang');
                    btn.setAttribute('title', 'show-submissions.open-forms');
                    btn.setAttribute('aria-label', 'show-submissions.open-forms');
                    btn.addEventListener('click', async (event) => {
                        this.loadingSubmissionTables = true;
                        // Switch to form submissions table
                        this.routingUrl = `/${formId}`;
                        const formSubmissionUrl = getFormShowSubmissionsUrl(formId);
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
            send({
                summary: i18n.t('show-submissions.failed-to-get-forms-title'),
                body: i18n.t('show-submissions.failed-to-get-forms-body'),
                type: 'danger',
                timeout: 5,
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
            accepted: [],
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
        if (data['hydra:member'].length === 0) {
            this.noSubmissionAvailable = true;
            return response;
        }
        this.noSubmissionAvailable = false;

        this.rawSubmissions = data['hydra:member'];

        let firstDataFeedElement = data['hydra:member'][0]['dataFeedElement'];
        firstDataFeedElement = JSON.parse(firstDataFeedElement);
        let columns = Object.keys(firstDataFeedElement);
        columns.unshift('dateCreated');

        const submissions = {};
        submissions.submitted = data['hydra:member'].filter((submission) => {
            return submission.submissionState === 4;
        });
        submissions.draft = data['hydra:member'].filter((submission) => {
            return submission.submissionState === 1;
        });
        submissions.accepted = data['hydra:member'].filter((submission) => {
            return submission.submissionState === 16;
        });

        for (const state of Object.keys(this.submissions)) {
            let submissions_list = [];
            for (let [x, submission] of submissions[state].entries()) {
                let dateCreated = submission['dateCreated'];
                dateCreated = this.humanReadableDate(dateCreated);
                let dataFeedElement = submission['dataFeedElement'];
                dataFeedElement = JSON.parse(dataFeedElement);
                let submissionId = submission['identifier'];

                const id = x + 1;
                const cols = {dateCreated: dateCreated, ...dataFeedElement};

                // Add show details button
                const submissionDetailsButton = this.submissionTables[state].createScopedElement(
                    'dbp-formalize-get-details-button',
                );
                submissionDetailsButton.setAttribute('subscribe', 'lang');
                submissionDetailsButton.setAttribute(
                    'title',
                    'show-submissions.open-detailed-view-modal',
                );
                submissionDetailsButton.setAttribute(
                    'aria-label',
                    'show-submissions.open-detailed-view-modal',
                );
                // this._i18n.t('show-submissions.open-detailed-view-modal');
                // this._i18n.t('show-submissions.open-forms');
                submissionDetailsButton.setAttribute('id', id.toString());
                submissionDetailsButton.classList.add('open-modal-icon');
                submissionDetailsButton.addEventListener('mousedown', (event) => {
                    event.stopPropagation();
                    // Redirect to render-form activity to display the readonly form with submission values
                    const activeForm = this.forms.get(formId);
                    const activeFormSlug = activeForm ? activeForm.formSlug : null;

                    // @TODO: LunchLottery don't have a slug
                    // other forms don't have read-only view
                    // if (!activeFormSlug) {
                    if (activeForm.formName !== 'Ethikkommission') {
                        this.requestDetailedSubmission(state, cols, id);
                        return;
                    }
                    // Go to the readonly view of the form submission
                    let formSubmissionUrl = getFormRenderUrl(activeFormSlug) + `/${submissionId}`;
                    // Open drafts in editable mode
                    if (state !== 'draft') {
                        formSubmissionUrl += '/readonly';
                    }
                    const url = new URL(formSubmissionUrl);
                    window.history.pushState({}, '', url);

                    // Middle click opens in a new tab
                    if (event.button === 1) {
                        window.open(url.toString(), '_blank');
                    } else {
                        // Left click navigates to the URL
                        window.location.href = url.toString();
                    }
                });

                let actionButtonsDiv = this.createScopedElement('div');
                actionButtonsDiv.appendChild(submissionDetailsButton);
                actionButtonsDiv.classList.add('actions-buttons');

                let entry = {
                    submissionId: submissionId,
                    dateCreated: dateCreated,
                    ...dataFeedElement,
                    htmlButtons: actionButtonsDiv,
                };

                submissions_list.push(entry);
            }

            this.submissions[state] = submissions_list;

            this.options_submissions[state].autoColumnsDefinitions = (definitions) => {
                definitions.forEach((column) => {
                    if (column.field === 'submissionId') {
                        column.visible = false;
                    }
                    if (column.field === 'htmlButtons') {
                        column.formatter = 'html';
                        column.hozAlign = 'center';
                        column.vertAlign = 'middle';
                        column.headerSort = false;
                        column.minWidth = 64;
                        column.frozen = true;
                        column.headerHozAlign = 'center';
                        // Add column settings button
                        column.titleFormatter = (cell, formatterParams, onRendered) => {
                            let columnSettingsButton = this.submissionTables[
                                state
                            ].createScopedElement('dbp-formalize-column-settings-button');
                            columnSettingsButton.setAttribute('subscribe', 'lang');
                            columnSettingsButton.addEventListener('click', () => {
                                this.defineSettings(state);
                                this.openColumnOptionsModal(state);
                            });
                            return columnSettingsButton;
                        };
                    } else {
                        column.sorter = 'string';
                    }
                    if (column.field.includes('date')) {
                        column.sorter = (a, b, aRow, bRow, column, dir, sorterParams) => {
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
                        width: 50,
                    },
                    ...definitions, // rest of the auto-generated columns
                ];
            };

            // Set tabulator table data
            this.options_submissions[state].data = this.submissions[state];
            this.totalNumberOfItems[state] = submissions_list.length;

            submissions_list = [];
        }
        return response;
    }

    /**
     * Sets the initial order of the submission table columns.
     * @param {string} state - The state of the submission table ('draft', 'submitted' or 'accepted').
     */
    // @TODO: should be renamed set to DefaultSubmissionTableOrder.
    // Get the default field visibility form the schema.
    // setInitialSubmissionTableOrder(state) {
    //     console.log('*** [setInitialSubmissionTableOrder] CALLED');
    //     const submissionsTable = this.submissionTables[state];

    //     if (!submissionsTable) return;
    //     let columns = submissionsTable.getColumns();
    //     if (columns) {
    //         columns.forEach((col) => {
    //             let name = col.getDefinition().title;
    //             let field = col.getDefinition().field;

    //             const savedVisibility = this.submissionsColumns[state].filter(savedField => {
    //                 return savedField.field === field;
    //             });

    //             let visibility;
    //             if (savedVisibility.length === 1) {
    //                 visibility = savedVisibility[0].visible;
    //             } else {
    //                 visibility = col.isVisible();
    //             }

    //             if (field && !field.includes('no_display') && field !== 'id' && field !== 'id_') {
    //                 this.submissionsColumnsInitial[state].push({
    //                     title: name,
    //                     field: field,
    //                     visible: visibility,
    //                 });
    //             }
    //         });
    //         submissionsTable.setColumns(this.submissionsColumnsInitial[state]);
    //     }
    // }

    /**
     * Defines the editable settings based on the current submissions tabulator columns.
     * @param {string} state - The state of the submission table ('draft', 'submitted' or 'accepted').
     */
    defineSettings(state) {
        const table = this.submissionTables[state];

        let settingsModal = this._(`#submission-modal-content-${state}`);
        // Reset modal content
        while (settingsModal.childElementCount > 0) {
            settingsModal.removeChild(settingsModal.firstChild);
        }

        let list = document.createElement('ul');
        list.classList.add('headers');

        let columns = table.getColumns();
        if (!columns || columns.length === 0) {
            return;
        }

        // Remove field that user should not change the position
        // Selection checkboxes (rowSelection), rowID (title=ID), submissionID and actionButtons (frozen).
        columns = columns.filter((column) => {
            const fieldDefinition = column.getDefinition();

            if (fieldDefinition.titleFormatter === 'rowSelection') return false;
            if (fieldDefinition.title === 'ID') return false;
            if (fieldDefinition.field === 'submissionId') return false;
            if (fieldDefinition.frozen) return false;

            return true;
        });

        columns.map((column, index) => {
            const fieldName = column.getField();
            let li = document.createElement('li');
            li.classList.add('header-fields');
            li.classList.add(fieldName);
            li.setAttribute('data-index', index.toString());

            let headerField = document.createElement('div');
            headerField.classList.add('header-field');

            let header_order = document.createElement('span');
            header_order.textContent = index + 1;
            header_order.classList.add('header-button');
            header_order.classList.add('header-order');
            headerField.appendChild(header_order);

            let header_title = document.createElement('span');
            header_title.innerHTML = `<strong>${fieldName}</strong>`;
            header_title.classList.add('header-title');
            headerField.appendChild(header_title);

            let visibility = /** @type {IconButton} */ (
                this.createScopedElement('dbp-icon-button')
            );

            const savedField = this.submissionsColumns[state].filter((field) => {
                return field.field === fieldName;
            });

            if (savedField.length === 1 && savedField[0].visible === false) {
                visibility.iconName = 'source_icons_eye-off';
            } else {
                visibility.iconName = 'source_icons_eye-empty';
            }

            visibility.classList.add('header-visibility-icon');

            visibility.addEventListener('click', (event) => {
                if (visibility.iconName === 'source_icons_eye-empty') {
                    visibility.iconName = 'source_icons_eye-off';
                } else {
                    visibility.iconName = 'source_icons_eye-empty';
                }
            });
            headerField.appendChild(visibility);

            let header_move = document.createElement('span');
            header_move.classList.add('header-move');
            let arrow_up = /** @type {IconButton} */ (this.createScopedElement('dbp-icon-button'));
            arrow_up.iconName = 'arrow-up';

            if (index === 0) {
                arrow_up.classList.add('first-arrow-up');
            }
            arrow_up.addEventListener('click', (event) => {
                if (index !== 0) {
                    this.moveHeaderUp(column);
                }
            });

            header_move.appendChild(arrow_up);
            let arrow_down = /** @type {IconButton} */ (
                this.createScopedElement('dbp-icon-button')
            );
            arrow_down.iconName = 'arrow-down';

            if (index === columns.length - 1) {
                arrow_down.classList.add('last-arrow-down');
            }

            arrow_down.addEventListener('click', (event) => {
                if (index !== columns.length - 1) {
                    this.moveHeaderDown(column);
                }
            });
            header_move.appendChild(arrow_down);
            headerField.appendChild(header_move);

            li.appendChild(headerField);
            list.appendChild(li);
        });

        settingsModal.appendChild(list);
    }

    /**
     * Removes settings that correspond to a former submissions tabulator
     *
     */
    deleteSettings() {
        let settings = this._a('.submission-modal-content');

        settings.forEach((setting) => {
            let list = setting.children[0];
            if (list) {
                setting.removeChild(list);
            }
        });
    }

    /**
     * Resets the settings to their currently not saved values
     * @param {string} state - The state of the submission table ('draft', 'submitted' or 'accepted').
     */
    resetSettings(state) {
        let list = this._(`#column-options-modal-${state} .headers`);
        const listChilds = list.childNodes;
        const columns = this.submissionsColumns[state];
        // Skip show detail button column
        columns.splice(-1, 1);

        // Restore initial column order
        [...listChilds].forEach((element, index) => {
            let header_field = element.children[0];
            // Reset title
            header_field.children[1].innerHTML = '<strong>' + columns[index].title + '</strong>';
            // Reset visibilty
            let visibility = header_field.children[2];
            if (columns[index].visible) {
                visibility.iconName = 'source_icons_eye-empty';
            } else if (!columns[index].visible) {
                visibility.iconName = 'source_icons_eye-off';
            }
            // Delete previous settings from localstorage
            this.deleteSubmissionTableSettings(state);
        });
    }

    /**
     * Set all columns hidden in Column Settings Modal
     * @param {string} state
     * @param {string} action - 'hide' or 'show'
     */
    toggleAllColumns(state, action) {
        let headerFields = this._a(`#column-options-modal-${state} .header-field`);

        // Restore initial column order
        [...headerFields].forEach((headerField, index) => {
            const visibility = headerField.querySelector('dbp-icon-button');
            action == 'hide'
                ? (visibility.iconName = 'source_icons_eye-off')
                : (visibility.iconName = 'source_icons_eye-empty');
        });
    }

    /**
     * Gets the detaildata of a specific row
     * @param {string} state - The state of the submission ('draft', 'submitted' or 'accepted').
     * @param entry
     * @param pos
     */
    requestDetailedSubmission(state, entry, pos) {
        if (
            !this._(`#detailed-submission-modal-${state} .content-wrapper`) ||
            !this._(`#apply-col-settings-${state}`)
        )
            return;
        this._(`#detailed-submission-modal-${state} .content-wrapper`).innerHTML = '';

        if (this.submissionsColumns[state].length !== 0) {
            for (let current_column of this.submissionsColumns[state]) {
                if (entry[current_column.field] !== undefined) {
                    this._(`#detailed-submission-modal-${state} .content-wrapper`).innerHTML +=
                        `<div class='element-left'>` + xss(current_column.field) + `:</div>`;

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

        this.modalContentHeight =
            this._(`#detailed-submission-modal-box-${state} > .modal-header`).offsetHeight +
            this._(`#detailed-submission-modal-box-${state} > .modal-footer`).offsetHeight;
        this._(`#detailed-submission-modal-box-${state} .content-wrapper`).setAttribute(
            'style',
            'max-height: calc(100vh - ' + this.modalContentHeight + 'px);',
        );
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

        const table = this.submissionTables[state];
        table.download(exportValue, this.activeCourse);
        exportInput.value = '-';
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
            table.clearFilter(state);
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
                let filter_object = {field: col, type: operatorValue, value: filterValue};
                listOfFilters.push(filter_object);
            }
            table.setFilter([listOfFilters]);
        }
    }

    /**
     * Removes the current filters from the submissions table
     * @param {string} state - The state of the submission table ('draft', 'submitted' or 'accepted').
     */
    clearFilter(state) {
        let filter = /** @type {HTMLInputElement} */ (this._(`#searchbar--${state}`));
        let search = /** @type {HTMLSelectElement} */ (this._(`#search-select--${state}`));
        const table = this.submissionTables[state];

        if (!filter || !search || !table) return;

        filter.value = '';
        search.value = 'all';
        table.clearFilter();
    }

    /**
     * Creates options for a select box of
     * this.submissionColumns Array (all possible cols of active table)
     *
     * @returns {Array<html>} options
     */
    getTableHeaderOptions() {
        const i18n = this._i18n;

        if (this.submissions.submitted.length === 0 && this.submissions.draft.length === 0) {
            return [];
        } else {
            let options = [];
            options.push(html`
                <option value="all">${i18n.t('show-submissions.all-columns')}</option>
            `);

            let submissions = [];
            if (this.submissions.submitted.length > 0) {
                submissions = this.submissions.submitted;
            } else if (this.submissions.draft.length > 0) {
                submissions = this.submissions.draft;
            }

            let cols = Object.keys(submissions[0]);

            for (let col of cols) {
                if (col !== 'no_display_1') {
                    options.push(html`
                        <option value="${col}">${col}</option>
                    `);
                }
            }
            return options;
        }
    }

    /**
     * Opens submission Columns Modal
     *
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
     *
     */
    closeColumnOptionsModal(state) {
        let modal = this._(`#column-options-modal-${state}`);
        if (modal) {
            MicroModal.close(modal);
        }
    }

    /**
     * Close submission Columns Modal
     *
     */
    closeDetailModal(state) {
        let modal = this._(`#detailed-submission-modal-${state}`);
        if (modal) {
            MicroModal.close(modal);
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
                    );
                },
            });
        }
    }

    /**
     * Keydown Event function if enter pressed, then start filtering the table
     *
     * @param event
     */
    pressEnterAndSubmitSearch(event) {
        if (event.keyCode === 13) {
            const activeElement = this.shadowRoot.activeElement;
            if (activeElement && activeElement.classList.contains('searchbar')) {
                event.preventDefault();
                const state = activeElement.getAttribute('data-state');
                this.filterTable(state);
                this.hideAdditionalSearchMenu(event);
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
        const clickedInsideAny = Array.from(actionsContainers).some((dropdown) =>
            path.includes(dropdown),
        );

        if (!clickedInsideAny) {
            this.closeAllActionsDropdown();
        }
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
    }

    /**
     * Update Submission Table (order and visibility)
     * Based on the column-options-modal icon state
     * @param {string} state - 'submitted', 'draft' or 'accepted'
     */
    updateSubmissionTable(state) {
        let list = this._(`#column-options-modal-${state} .headers`);
        if (!list) return;

        list = list.childNodes;
        const table = this.submissionTables[state];

        let newColumns = [];
        [...list].forEach((element, index) => {
            let header_field = element.children[0];
            let current_title = header_field.children[1].innerText;
            let visibility_icon = header_field.children[2];
            let visibility;
            // @TODO use data attribute instead of iconName
            if (visibility_icon.iconName === 'source_icons_eye-off') {
                visibility = false;
            } else if (visibility_icon.iconName === 'source_icons_eye-empty') {
                visibility = true;
            }
            let new_column = {title: current_title, field: current_title, visible: visibility};
            newColumns.push(new_column);
        });

        let columns = table.getColumns();
        // Put the Row-index column at the first place
        const columnRowIndex = columns.find((column) => {
            const definition = column.getDefinition();
            return definition.title === 'ID';
        });
        if (columnRowIndex) {
            newColumns.unshift(columnRowIndex.getDefinition());
        }

        // Put the htmlButtons at the end of the columns
        const columnActionButton = columns.find((column) => {
            const definition = column.getDefinition();
            return definition.field === 'htmlButtons';
        });
        if (columnActionButton) {
            newColumns.push(columnActionButton.getDefinition());
        }

        table.setColumns(newColumns);
        this.submissionsColumns[state] = newColumns;
        this.requestUpdate();
    }

    /**
     * Gets stored submission table settings from localStorage
     * @param {string} state - 'submitted', 'draft' or 'accepted'
     * @returns {boolean} success
     */
    getSubmissionTableSettings(state) {
        if (this.storeSession && this.isLoggedIn()) {
            this.tableSettingsInitialized[state] = true;

            let optionsString = localStorage.getItem(
                'dbp-formalize-tableoptions-' +
                    this.activeCourse +
                    '-' +
                    state +
                    '-' +
                    this.auth['user-id'],
            );
            if (!optionsString) {
                this.submissionsColumns[state] = [];
                return false;
            }

            try {
                let options = JSON.parse(optionsString);
                if (options) {
                    this.submissionsColumns[state] = [...options];
                }
            } catch (e) {
                this.sendErrorAnalyticsEvent(
                    '[getSubmissionTableSettings] getSubmissionTableSettings',
                    'WrongResponse',
                    e,
                );
                this.submissionsColumns[state] = [];
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Stores submission Table settings in localStorage
     * @param {string} state - 'submitted', 'draft'  or 'accepted'
     */
    setSubmissionTableSettings(state) {
        if (this.storeSession && this.isLoggedIn()) {
            const publicId = this.auth['user-id'];
            localStorage.setItem(
                'dbp-formalize-tableoptions-' + this.activeCourse + '-' + state + '-' + publicId,
                JSON.stringify(this.submissionsColumns[state]),
            );
        }
    }

    /**
     * Delete submission Table settings from localStorage
     * @param {string} state - 'submitted', 'draft'  or 'accepted'
     */
    deleteSubmissionTableSettings(state) {
        if (this.storeSession && this.isLoggedIn()) {
            const publicId = this.auth['user-id'];
            localStorage.removeItem(
                'dbp-formalize-tableoptions-' + this.activeCourse + '-' + state + '-' + publicId,
            );
        }
    }

    /**
     * Moves a header in this.submissionColumns Array and in DOM up
     *
     * @param {object} column
     */
    moveHeaderUp(column) {
        let list = this._('.headers');
        list = list.childNodes;
        [...list].forEach((item, index) => {
            if (item.classList.contains(column.getField())) {
                let element = item;
                let swapElem = list[index - 1];
                this.swapHeader(element, swapElem);
            }
        });
    }

    /**
     * Moves a header in this.submissionColumns Array and in DOM up
     *
     * @param {object} column
     */
    moveHeaderDown(column) {
        let list = this._('.headers');
        list = list.childNodes;
        [...list].forEach((item, index) => {
            if (item.classList.contains(column.getField())) {
                let element = item;
                let swapElem = list[index + 1];
                this.swapHeader(element, swapElem);
            }
        });
    }

    /**
     * Swaps two elements in this.submissionColumns Array and in DOM
     *
     * @param {object} elem
     * @param {number} swapElem
     */
    swapHeader(elem, swapElem) {
        let div_1 = elem.children[0];
        let span_1 = div_1.children[1];
        let aux = span_1.innerHTML;

        let div_2 = swapElem.children[0];
        let span_2 = div_2.children[1];
        span_1.innerHTML = span_2.innerHTML;
        span_2.innerHTML = aux;

        function removeClass() {
            swapElem.classList.remove('move-up');
        }

        function addClass() {
            swapElem.classList.add('move-up');
        }

        setTimeout(addClass.bind(swapElem), 0);

        setTimeout(removeClass.bind(swapElem), 400);
    }

    /**
     * Shows entry of a specific position of this.submissionTable
     * @param {string} state - 'submitted', 'draft'  or 'accepted'
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

        this.requestDetailedSubmission(state, next_data, positionToShow);
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getModalDialogCSS()}
            ${commonStyles.getRadioAndCheckboxCss()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getNotificationCSS()}
            ${commonStyles.getActivityCSS()}
            ${commonStyles.getButtonCSS()}
            ${getSelectorFixCSS()}
            ${getFileHandlingCss()}

            .visually-hidden {
                clip: rect(0 0 0 0);
                clip-path: inset(50%);
                height: 1px;
                overflow: hidden;
                position: absolute;
                white-space: nowrap;
                width: 1px;
            }

            .table-wrapper.submissions {
                padding-top: 0.5rem;
            }

            .table-header.submissions {
                margin-top: 0.5rem;
            }

            .btn-row-left {
                display: flex;
                justify-content: space-between;
                gap: 4px;
            }

            .btn-row-left > * {
                display: flex;
                align-items: center;
            }

            .next-btn dbp-icon,
            .back-btn dbp-icon {
                height: 15px;
                top: 3px;
            }

            .next-btn dbp-icon {
                margin-left: 0.2em;
                margin-right: -0.4em;
            }

            .back-btn dbp-icon {
                margin-left: -0.4em;
                margin-right: 0.2em;
            }

            .detailed-submission-modal-title {
                margin-bottom: 10px;
            }

            .detailed-submission-modal-content {
                padding: 0 20px 0 20px;
            }

            .detailed-submission-modal-box {
                height: auto;
                width: auto;
                overflow-y: hidden;
                min-height: 0;
                max-width: 768px;
                min-width: 768px;
            }

            .open-modal-icon {
                font-size: 1.3em;
            }

            .content-wrapper {
                display: grid;
                grid-template-columns: min-content auto;
                grid-template-rows: auto;
                max-height: calc(100vh - 149px);
                overflow-y: auto;
                width: 100%;
            }

            .element-left {
                background-color: var(--dbp-primary-surface);
                color: var(--dbp-on-primary-surface);
                padding: 0 20px 12px 40px;
                text-align: right;
            }

            .element-right {
                text-align: left;
                margin-left: 12px;
                padding: 0 0 12px 0;
            }

            .element-left.first,
            .element-right.first {
                padding-top: 12px;
            }

            .hideWithoutDisplay {
                opacity: 0;
                height: 0;
                overflow: hidden;
            }

            .scrollable-table-wrapper {
                width: 100%;
            }

            .tabulator-table {
                white-space: nowrap;
            }

            .tabulator-footer {
                text-align: center;
            }

            .back-navigation {
                padding-top: 1rem;
            }

            .table-wrapper {
                container-type: inline-size;
                container-name: table-wrapper;
            }

            .table-wrapper h3 {
                margin-top: 0.5em;
                margin-bottom: 1em;
            }

            .back-navigation dbp-icon {
                font-size: 0.8em;
                padding-right: 7px;
                padding-bottom: 2px;
            }

            .back-navigation:hover {
                color: var(--dbp-hover-color, var(--dbp-content));
                background-color: var(--dbp-hover-background-color);
            }

            .back-navigation:hover::before {
                background-color: var(--dbp-hover-color, var(--dbp-content));
            }

            .dropdown-menu {
                background-color: var(--dbp-secondary-surface);
                color: var(--dbp-on-secondary-surface);
                border-color: var(--dbp-secondary-surface-border-color);
                background-size: auto 45%;
                cursor: pointer;
                background-position-x: calc(100% - 0.4rem);
                box-sizing: content-box;
            }

            .table-title {
                border-left: 3px solid var(--dbp-primary);
                padding-left: 0.5em;
            }

            /* TABLE BUTTON HEADER */

            .table-buttons {
                display: grid;
                grid-template-columns: auto 1fr auto;
                gap: 1em;
                position: relative;

                container: table-buttons / inline-size;

                select,
                input[type='text'],
                button {
                    box-sizing: border-box;
                    height: 34px;
                    padding-block: 0;
                    color: var(--dbp-content);
                    background-color: var(--dbp-background);
                }
            }

            /* actions */

            .actions-container {
                position: relative;

                &.open {
                    .actions-dropdown {
                        opacity: 1;
                    }
                    .icon-chevron {
                        transform: rotate(180deg);
                    }
                }
            }

            .icon-chevron {
                transition: transform 250ms ease-in;
                margin-left: 0.5em;
            }

            .actions-dropdown {
                opacity: 0;
                position: absolute;
                top: 37px;
                left: 0;
                transition: opacity 250ms ease-in;
                z-index: 15;
                width: 250px;
                padding: 1em 4em 1em 1em;
                background-color: var(--dbp-background);
                border: 1px solid var(--dbp-content);
            }

            .actions-list {
                list-style: none;
                padding: 0;
                margin: 0;
                display: flex;
                flex-direction: column;
                gap: 0.5em;
            }

            .action {
                dbp-icon {
                    margin-right: 5px;
                }
            }

            @starting-style {
                .actions-wrapper.open .actions-dropdown {
                    opacity: 0;
                }
            }

            /* search bar */

            .search-container {
                overflow: hidden;
                height: 36px;
            }

            .extendable-searchbar {
                box-sizing: border-box;
                display: grid;
                grid-template-columns: 40px 1fr 40px;
                border-bottom: 1px solid transparent;
                transform: translateX(calc(100% - 2em));
                transition:
                    transform 500ms cubic-bezier(0, 0.014, 0, 0.986) 0ms,
                    border-color 250ms ease-in 50ms;

                &.open {
                    transform: translateX(0);
                    border-color: var(--dbp-content);
                }

                &.closing {
                    border-color: transparent;
                    transform: translateX(calc(100% - 2.5em));
                    transition:
                        transform 500ms cubic-bezier(0, 0.014, 0, 0.986) 0ms,
                        border-color 30ms ease-in 0ms;
                }
            }

            .extended-menu {
                display: grid;
                grid-template-columns: 1fr 40px 1fr 40px 1fr 40px;
                justify-items: center;
                height: 34px;

                input[type='text'],
                select {
                    border: 0 none;
                    text-align: left;
                    padding-left: 10px;
                    width: 100%;
                }

                label {
                    clip: rect(0 0 0 0);
                    clip-path: inset(50%);
                    height: 1px;
                    overflow: hidden;
                    position: absolute;
                    white-space: nowrap;
                    width: 1px;
                }

                & > :focus-visible {
                    box-shadow: none !important;
                    background-color: light-dark(#f7f7f7, #333333);
                }
            }

            @container table-buttons (width < 1040px) {
                .search-container {
                    overflow: visible;
                }

                .export-container {
                    .dropdown-menu {
                        position: relative;
                        z-index: 10;
                    }
                }

                .extendable-searchbar {
                    display: block;
                    position: relative;
                    border: 1px solid transparent;
                    clip-path: polygon(0 0, 100% 0, 100% 18%, 0 18%);
                    transition:
                        transform 500ms cubic-bezier(0, 0.014, 0, 0.986),
                        border-color 250ms ease-in 250ms,
                        clip-path 250ms ease-in 500ms;

                    input,
                    select,
                    .search-close-button,
                    label {
                        opacity: 0;
                        transition: opacity 250ms ease-in 250ms;
                    }

                    input,
                    select {
                        width: 100%;
                        padding: 0 1em;
                        max-width: 100%;
                        border: var(--dbp-border);
                        margin-bottom: 1em;
                        height: 40px;
                    }

                    .searchbar {
                        padding-left: 3em !important;
                        padding-right: 1em;
                        width: 100%;
                        background-color: var(--dbp-background);
                    }

                    &.open {
                        border-color: var(--dbp-content);
                        z-index: 15;
                        background: var(--dbp-background);
                        box-shadow: 0 0 6px 4px rgba(0, 0, 0, 0.1);
                        clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 100%);

                        .searchbar {
                            border: 0 none;
                            border-bottom: var(--dbp-border);
                        }

                        button.search-button {
                            top: 0.6em;
                            left: 1em;
                        }

                        .search-close-button,
                        label,
                        input,
                        select {
                            opacity: 1;
                        }
                    }

                    &.closing {
                        transform: translateX(calc(100% - 2em));
                        border-color: transparent;
                        clip-path: polygon(0 0, 100% 0, 100% 18%, 0 18%);
                        transition:
                            transform 500ms cubic-bezier(0, 0.014, 0, 0.986) 250ms,
                            border-color 250ms ease-in 0ms,
                            clip-path 250ms ease-in 0ms;

                        .searchbar {
                            border: 0 none;
                        }

                        button.search-button {
                            top: 0;
                            left: 0;
                        }

                        input,
                        select,
                        .search-close-button {
                            opacity: 0;
                            transition: opacity 100ms ease-in 0ms;
                        }
                    }
                }

                button.search-button {
                    position: absolute;
                    top: 0;
                    left: 0;
                    z-index: 5;
                }

                .search-close-button {
                    position: absolute;
                    top: 0.8em;
                    right: 1em;
                    z-index: 5;
                }

                .extended-menu {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    padding: 1em;
                    /*min-width: 300px;*/
                    height: auto;
                }

                .spacer {
                    display: none;
                }

                .extended-menu label {
                    clip: initial;
                    clip-path: initial;
                    height: auto;
                    overflow: visible;
                    position: static;
                    white-space: initial;
                    width: auto;
                }
            }

            @container table-buttons (width < 565px) {
                .actions-container,
                .export-container {
                    transition: opacity 250ms ease-in;
                    opacity: 1;
                }

                .table-buttons:has(.extendable-searchbar.open) .actions-container,
                .table-buttons:has(.extendable-searchbar.open) .export-container {
                    opacity: 0;
                    transition: opacity 250ms ease-in;
                }

                /* @TODO add some animation for the lupe icon to find it's way back */

                .extendable-searchbar {
                    width: 40px;
                    transform: none;
                    transition: opacity 250ms ease-in;

                    &.closing {
                        button.search-button {
                            opacity: 0;
                        }
                    }
                }

                .extendable-searchbar.open {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    width: auto;
                    transform: none;
                    transition: opacity 250ms ease-in;
                }

                .extendable-searchbar.closing {
                    transform: none;
                    transition: opacity 250ms ease-in;
                }
            }

            button.search-button {
                width: 34px;
                border: 0 none;
                padding: 0;
                border-radius: 100%;
                font-size: 20px;
                background-color: transparent;

                &:hover {
                    background-color: light-dark(#f7f7f7, #333333);
                }

                &:focus-visible {
                    box-shadow: none !important;
                    background-color: light-dark(#f7f7f7, #333333);
                }
            }

            button.search-close-button {
                width: 34px;
                border: 0 none;
                padding: 0;
                border-radius: 100%;
                font-size: 16px;
                background-color: transparent;

                &:hover {
                    background-color: light-dark(#f7f7f7, #333333);
                }

                &:focus-visible {
                    box-shadow: none !important;
                    background-color: light-dark(#f7f7f7, #333333);
                }
            }

            .spacer {
                color: #999999;
                font-size: 28px;
            }

            /* export button */

            .export-container .dropdown-menu {
                padding: 0rem 2rem 0rem 0.5rem;
            }

            /* TABLE BUTTON HEADER END */

            .modal-container {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                text-align: center;
            }

            .submission-modal-content {
                overflow: auto;
                align-items: baseline;
                height: 100%;
            }

            .modal-footer-btn {
                padding-right: 20px;
                padding-left: 20px;
                padding-bottom: 20px;
                padding-top: 10px;
            }

            span.first {
                margin-left: -6px;
            }

            select[disabled] {
                opacity: 0.4;
                cursor: not-allowed;
            }

            .scrollable-table-wrapper {
                position: relative;
            }

            .frozen-table-divider {
                position: absolute;
                height: calc(
                    100% - 118px
                ); /* table-header + pagination heights + scrollbar: 60px + 51px */
                top: 60px; /* table-header height */
                right: 36px;

                -webkit-box-shadow: -4px 3px 16px -6px var(--dbp-muted);
                box-shadow: -2px 0 2px 0 var(--dbp-muted);
                background-color: #fff0; /* transparent */
            }

            .headers {
                max-width: 100%;
                margin: 0;
                list-style-type: none;
                padding: 0;
                display: grid;
                width: 100%;
            }

            .header-field {
                align-items: center;
                height: 50px;
                border: 1px solid var(--dbp-muted);
                display: flex;
                margin-bottom: 5px;
                color: var(--dbp-content);
            }

            .header-button {
                justify-content: center;
                display: flex;
                align-items: center;
                height: 50px;
                width: 50px;
                min-width: 50px;
                flex-grow: 0;
                cursor: pointer;
            }

            .header-button dbp-icon {
                font-size: 1.3em;
                top: 0;
            }

            .header-button.hidden,
            .extended-menu.hidden {
                display: none !important;
            }

            .header-title {
                flex-grow: 2;
                text-overflow: ellipsis;
                overflow: hidden;
                padding-left: 5px;
                text-align: left;
            }

            .header-order {
                background-color: var(--dbp-muted-surface);
                color: var(--dbp-on-muted-surface);
                font-weight: bold;
            }

            .move-up .header-field {
                animation: added 0.4s ease;
            }

            .header-move {
                display: flex;
            }

            .first-header .header-move .header-button:first-child,
            .last-header .header-move .header-button:last-child {
                opacity: 0.4;
                cursor: default;
            }

            .first-arrow-up,
            .last-arrow-down {
                opacity: 0.4;
                cursor: default;
            }

            @keyframes added {
                0% {
                    background-color: var(--dbp-background);
                    color: var(--dbp-content);
                }
                50% {
                    background-color: var(--dbp-success-surface);
                    color: var(--dbp-on-success-surface);
                }
                100% {
                    background-color: var(--dbp-background);
                    color: var(--dbp-content);
                }
            }

            .button-wrapper {
                display: flex;
                height: 100%;
                justify-content: end;
                align-items: center;
                padding-right: 2px;
            }

            .open-menu {
                height: 45px;
                box-sizing: border-box;
                display: flex;
                align-items: center;
            }

            .additional-menu {
                display: none;
            }

            #filter-modal-box {
                min-width: 300px;
                min-height: unset;
            }

            #filter-modal-box .modal-footer-btn {
                display: flex;
                justify-content: space-between;
            }

            .button-container {
                text-align: left;
                margin-bottom: 10px;
                padding-left: 30px;
            }

            .checkmark {
                left: 0;
                height: 20px;
                width: 20px;
            }

            .button-container .checkmark::after {
                left: 8px;
                top: 2px;
            }

            .button.courses-btn {
                font-size: 1.2rem;
                display: flex;
                align-items: center;
                top: 0;
            }

            @media only screen and (orientation: portrait) and (max-width: 768px) {
                .mobile-hidden {
                    display: none;
                }

                button[data-page='prev'],
                button[data-page='next'],
                button[data-page='first'],
                button[data-page='last'] {
                    display: block;
                    white-space: nowrap !important;
                    overflow: hidden;
                    line-height: 0;
                }

                button[data-page='prev']:after,
                button[data-page='next']:after,
                button[data-page='first']:after,
                button[data-page='last']:after {
                    content: '\\00a0\\00a0\\00a0\\00a0';
                    background-color: var(--dbp-content);
                    -webkit-mask-repeat: no-repeat;
                    mask-repeat: no-repeat;
                    -webkit-mask-position: center center;
                    mask-position: center center;
                    padding: 0 0 0.25% 0;
                    -webkit-mask-size: 1.5rem !important;
                    mask-size: 1.4rem !important;
                }

                button[data-page='prev']:after {
                    -webkit-mask-image: url('${unsafeCSS(getIconSVGURL('chevron-left'))}');
                    mask-image: url('${unsafeCSS(getIconSVGURL('chevron-left'))}');
                }

                button[data-page='next']:after {
                    -webkit-mask-image: url('${unsafeCSS(getIconSVGURL('chevron-right'))}');
                    mask-image: url('${unsafeCSS(getIconSVGURL('chevron-right'))}');
                }

                button[data-page='first']:after {
                    content: '\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0';
                    -webkit-mask-image: url('${unsafeCSS(getIconSVGURL('angle-double-left'))}');
                    mask-image: url('${unsafeCSS(getIconSVGURL('angle-double-left'))}');
                }

                button[data-page='last']:after {
                    content: '\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0';
                    -webkit-mask-image: url('${unsafeCSS(getIconSVGURL('angle-double-right'))}');
                    mask-image: url('${unsafeCSS(getIconSVGURL('angle-double-right'))}');
                }

                .element-right {
                    margin-left: 12px;
                    padding: 0 0 12px 0;
                }

                .element-right.first {
                    padding-top: 0;
                }

                .element-left {
                    text-align: left;
                    padding: 10px 5px 10px 5px;
                    background-color: inherit;
                    color: inherit;
                    font-weight: 400;
                    border-top: 1px solid var(--dbp-muted);
                }

                .element-left.first {
                    margin-top: 10px;
                    border-top: 0;
                }

                .btn-row-left {
                    display: flex;
                    justify-content: space-between;
                    flex-direction: row;
                    gap: 4px;
                    height: 40px;
                }

                .detailed-submission-modal-box {
                    min-width: 320px;
                }

                .detailed-submission-modal-box .modal-footer .modal-footer-btn {
                    padding: 6px 12px 6px 12px;
                    flex-direction: column;
                    gap: 6px;
                }

                .detailed-submission-modal-box .modal-content {
                    align-items: flex-start;
                }

                .export-buttons {
                    gap: 0;
                }

                .select-all-icon {
                    height: 32px;
                }

                .additional-menu {
                    display: block;
                    white-space: nowrap;
                    height: 33px;
                    position: relative;
                }

                .additional-menu button {
                    float: right;
                }

                .options-nav {
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between;
                }

                .back-navigation {
                    padding-top: 0;
                }

                .table-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .table-wrapper h3,
                .table-buttons {
                    margin-bottom: 0.5em;
                }

                .courses-btn {
                    min-height: 40px;
                    padding-top: 8px;
                    min-width: 40px;
                }

                .search-wrapper {
                    min-width: unset;
                }

                .headers {
                    display: initial;
                    width: 100%;
                }

                #filter-modal-box,
                .detailed-submission-modal-box {
                    width: 100%;
                    height: 100%;
                    max-width: 100%;
                }

                .submission-modal-content,
                .detailed-submission-modal-content {
                    height: 100%;
                }

                .content-wrapper {
                    grid-template-columns: auto;
                }

                .button-container .checkmark::after {
                    left: 8px;
                    top: 2px;
                    width: 5px;
                    height: 11px;
                }

                .button-container .checkmark {
                    top: 0;
                }

                .button-container {
                    padding-left: 30px;
                }

                #filter-modal-box .modal-footer-btn {
                    flex-direction: column;
                    gap: 5px;
                }

                #filter-modal-box .modal-footer-btn div {
                    display: flex;
                    justify-content: space-between;
                }
            }
        `;
    }

    // Not in use...
    setTableData() {
        if (this.formsTable) {
            this.formsTable.setData(this.allForms);
        }
    }

    renderSubmissionDetailsModal(state) {
        const i18n = this._i18n;
        return html`
            <div
                class="modal micromodal-slide"
                id="detailed-submission-modal-${state}"
                data-state=${state}
                aria-hidden="true">
                <div class="modal-overlay" tabindex="-2" data-micromodal-close>
                    <div
                        class="modal-container detailed-submission-modal-box"
                        id="detailed-submission-modal-box-${state}"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="detailed-submission-modal-title">
                        <header class="modal-header">
                            <button
                                title="${i18n.t('show-submissions.modal-close')}"
                                class="modal-close"
                                aria-label="${i18n.t('show-submissions.modal-close')}"
                                @click="${() => {
                                    this.closeDetailModal(state);
                                }}">
                                <dbp-icon
                                    title="${i18n.t('show-submissions.modal-close')}"
                                    aria-hidden="true"
                                    name="close"
                                    class="close-icon"></dbp-icon>
                            </button>
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
                                ${i18n.t('show-submissions.header-settings')} ${state}
                            </p>
                        </header>
                        <main
                            class="modal-content submission-modal-content"
                            id="submission-modal-content-${state}"></main>
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
                                        class="check-btn button is-secondary"
                                        @click="${() => {
                                            this.resetSettings(state);
                                        }}">
                                        ${i18n.t('show-submissions.reset-filter')}
                                    </button>
                                    <button
                                        title="${i18n.t('show-submissions.all-filters-hide')}"
                                        class="check-btn button is-secondary"
                                        @click="${() => {
                                            this.toggleAllColumns(state, 'hide');
                                        }}">
                                        ${i18n.t('show-submissions.all-filters-hide')}
                                    </button>
                                    <button
                                        title="${i18n.t('show-submissions.all-filters-show')}"
                                        class="check-btn button is-secondary"
                                        @click="${() => {
                                            this.toggleAllColumns(state, 'show');
                                        }}">
                                        ${i18n.t('show-submissions.all-filters-show')}
                                    </button>
                                </div>
                                <button
                                    class="check-btn button is-primary"
                                    id="check"
                                    @click="${() => {
                                        this.updateSubmissionTable(state);
                                        this.closeColumnOptionsModal(state);
                                        this.setSubmissionTableSettings(state);
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
        return html`
            <div class="export-container">
                <select
                    id="export-select"
                    class="dropdown-menu"
                    @change="${(e) => {
                        this.exportSubmissionTable(e, state);
                    }}">
                    <option value="-" disabled selected>
                        ${i18n.t('show-submissions.default-export-select')}
                    </option>
                    <option value="csv">CSV</option>
                    <option value="xlsx">Excel</option>
                    <option value="pdf">PDF</option>
                </select>
            </div>
        `;
    }

    renderActionsWidget(state) {
        const i18n = this._i18n;
        return html`
            <div class="actions-container" id="actions-container--${state}">
                <button
                    class="button open-actions-button is-secondary"
                    id="action-button-${state}"
                    @click="${() => {
                        this.toggleActionsDropdown(state);
                    }}">
                    ${i18n.t('show-registrations.actions-button-text')}
                    <dbp-icon
                        class="icon-chevron"
                        name="chevron-down"
                        aria-hidden="true"></dbp-icon>
                </button>
                <div class="actions-dropdown" inert>
                    <ul class="actions-list">
                        <li class="action">
                            <button
                                class="button action-button button--delete-all"
                                disabled
                                @click="${async () => {
                                    this.toggleActionsDropdown(state);
                                }}">
                                <dbp-icon name="checkmark" aria-hidden="true"></dbp-icon>
                                Accept
                            </button>
                        </li>
                        <li class="action">
                            <button
                                class="button action-button button--delete-all"
                                disabled
                                @click="${async () => {
                                    this.toggleActionsDropdown(state);
                                }}">
                                <dbp-icon name="checkmark" aria-hidden="true"></dbp-icon>
                                Reopen
                            </button>
                        </li>
                        <li class="action">
                            <button
                                class="button action-button button--delete-all"
                                disabled
                                @click="${async () => {
                                    this.toggleActionsDropdown(state);
                                }}">
                                <dbp-icon name="pencil" aria-hidden="true"></dbp-icon>
                                Edit draft/submission
                            </button>
                        </li>
                        <li class="action">
                            <button
                                class="button action-button button--delete-all"
                                disabled
                                @click="${async () => {
                                    this.toggleActionsDropdown(state);
                                }}">
                                <dbp-icon name="edit-permission" aria-hidden="true"></dbp-icon>
                                Edit permission
                            </button>
                        </li>
                        ${this.isDeleteAllSubmissionEnabled
                            ? html`
                                  <li class="action">
                                      <button
                                          class="button action-button button--delete-all"
                                          @click="${async () => {
                                              await this.handleDeleteSubmissions(state);
                                              this.toggleActionsDropdown(state);
                                          }}">
                                          <dbp-icon name="trash" aria-hidden="true"></dbp-icon>
                                          Delete all
                                      </button>
                                  </li>
                              `
                            : ''}
                        ${this.isDeleteSelectedSubmissionEnabled
                            ? html`
                                  <li class="action">
                                      <button
                                          class="button action-button button--delete-selected"
                                          @click="${async () => {
                                              await this.handleDeleteSubmissions(state, true);
                                              this.toggleActionsDropdown(state);
                                          }}">
                                          <dbp-icon name="trash" aria-hidden="true"></dbp-icon>
                                          Delete selection
                                      </button>
                                  </li>
                              `
                            : ''}
                    </ul>
                </div>
            </div>
        `;
    }

    toggleActionsDropdown(state) {
        this.setActionButtonsStates(state);

        const actionsContainer = this._(`#actions-container--${state}`);
        const actionsDropdown = this._(`#actions-container--${state} .actions-dropdown`);
        actionsDropdown.toggleAttribute('inert');
        actionsContainer.classList.toggle('open');
    }

    closeAllActionsDropdown() {
        const actionsContainers = this._a(`.actions-container`);
        const actionsDropdowns = this._a(`.actions-container .actions-dropdown`);

        actionsDropdowns.forEach((dropdown) => {
            dropdown.setAttribute('inert', 'inert');
        });
        actionsContainers.forEach((container) => {
            container.classList.remove('open');
        });
    }

    setActionButtonsStates(state) {
        const selectedRows = this.submissionTables[state].tabulatorTable.getSelectedRows();
        const selectedRowCount = selectedRows.length;

        //  Get unique values of grantedActions
        const submissionGrantedActions = [
            ...new Set(this.rawSubmissions.flatMap((item) => item.grantedActions)),
        ];
        console.log(`submissionGrantedActions`, submissionGrantedActions);

        this.isDeleteSelectedSubmissionEnabled =
            selectedRowCount > 0 &&
            (submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.DELETE));

        this.isDeleteAllSubmissionEnabled =
            submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
            submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.DELETE);

        this.isEditSubmissionEnabled =
            selectedRowCount === 1 &&
            (submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.MANAGE) ||
                submissionGrantedActions.includes(SUBMISSION_PERMISSIONS.UPDATE));
    }

    successFailureNotification(deletedStatus) {
        const successCount = deletedStatus.filter((status) => status === true).length;
        if (successCount > 0) {
            send({
                summary: this._i18n.t('errors.success-title'),
                body: `${successCount} submission deleted successfully`,
                type: 'success',
                timeout: 5,
            });
        }

        const errorCount = deletedStatus.filter((status) => status === false).length;
        if (errorCount > 0) {
            send({
                summary: this._i18n.t('errors.error-title'),
                body: `${errorCount} submissions failed to delete`,
                type: 'danger',
                timeout: 5,
            });
        }
    }

    /**
     * Delete submissions visible in the table or all submissions
     * @param {string} state - form state. draft, submitted or accepted
     * @param {boolean} selectedOnly - if true only the selected submissions are deleted
     */
    async handleDeleteSubmissions(state, selectedOnly = false) {
        const data = selectedOnly
            ? this.submissionTables[state].tabulatorTable.getSelectedData()
            : this.submissionTables[state].tabulatorTable.getData('visible');

        const rows = selectedOnly
            ? this.submissionTables[state].tabulatorTable.getSelectedRows()
            : this.submissionTables[state].tabulatorTable.getRows('visible');

        if (data.length > 0) {
            let deletedStatus = [];
            let index = 0;
            for (const submission of data) {
                const response = await this.apiDeleteSubmissions(submission.submissionId);
                deletedStatus.push(response);
                // Delete row from the table
                if (response === true) {
                    rows[index].delete();
                }
                index++;
            }
            // Update row-indexes
            this.submissionTables[state].tabulatorTable.redraw(true);
            // Report
            this.successFailureNotification(deletedStatus);
        } else {
            send({
                summary: this._i18n.t('errors.warning-title'),
                body: this._i18n.t('errors.no-submission-selected'),
                type: 'warning',
                timeout: 5,
            });
        }
    }

    async apiDeleteSubmissions(submissionId) {
        if (!submissionId) {
            send({
                summary: 'Error',
                body: `No submission id provided`,
                type: 'danger',
                timeout: 5,
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
                this.deleteSubmissionError = true;
                send({
                    summary: 'Error',
                    body: `Failed to delete submission. Response status: ${response.status}`,
                    type: 'danger',
                    timeout: 5,
                });
                return false;
            } else {
                this.deleteSubmissionError = false;
                return true;
            }
        } catch (error) {
            console.error(error.message);
            send({
                summary: 'Error',
                body: error.message,
                type: 'danger',
                timeout: 5,
            });
            return false;
        } finally {
            console.log('delete submissions finally.');
        }
    }

    openActionsDropdown(state) {
        const actionsContainer = this._(`#actions-container--${state}`);
        const actionsDropdown = this._(`#actions-container--${state} .actions-dropdown`);
        actionsDropdown.toggleAttribute('inert');
        actionsContainer.classList.toggle('open');
    }

    renderSearchWidget(state) {
        const i18n = this._i18n;

        return html`
            <div class="search-container">
                <div id="extendable-searchbar--${state}" class="extendable-searchbar">
                    <button
                        class="search-button"
                        id="search-button--${state}"
                        @click="${() => {
                            const isOpen = this._(
                                `#extendable-searchbar--${state}`,
                            ).classList.contains('open');
                            if (!isOpen) {
                                this._(`#extendable-searchbar--${state}`).classList.add('open');
                                this._(
                                    `#extendable-searchbar--${state} .search-close-button`,
                                ).removeAttribute('inert');
                                this._(`#searchbar-menu--${state}`).removeAttribute('inert');
                            } else {
                                this.filterTable(state);
                            }
                        }}">
                        <dbp-icon
                            title="${i18n.t('show-registrations.search-button')}"
                            aria-label="${i18n.t('show-registrations.search-button')}"
                            name="search"></dbp-icon>
                    </button>

                    <div class="extended-menu" id="searchbar-menu--${state}" inert>
                        <input
                            type="text"
                            id="searchbar--${state}"
                            data-state="${state}"
                            class="searchbar"
                            placeholder="${i18n.t('show-registrations.searchbar-placeholder')}" />

                        <span class="spacer">/</span>

                        <label for="search-select--${state}">
                            ${i18n.t('show-registrations.search-in')}:
                <div id="extendable-searchbar" class="extendable-searchbar">
                    <input
                        type="text"
                        id="searchbar-${state}"
                        data-state="${state}"
                        class="searchbar"
                        placeholder="${i18n.t('show-submissions.searchbar-placeholder')}"
                        @click="${(e) => {
                            this.toggleSearchMenu(state);
                        }}" />
                    <dbp-icon-button
                        class="button is-icon search-button"
                        id="search-button-${state}"
                        title="${i18n.t('show-submissions.search-button')}"
                        aria-label="${i18n.t('show-submissions.search-button')}"
                        icon-name="search"
                        @click="${() => {
                            this.filterTable(state);
                        }}"></dbp-icon-button>
                    <div class="extended-menu hidden" id="searchbar-menu-${state}">
                        <label for="search-select-${state}">
                            ${i18n.t('show-submissions.search-in')}:
                        </label>
                        <select
                            id="search-select--${state}"
                            class="button dropdown-menu search-select"
                            title="${i18n.t('show-submissions.search-in-column')}:">
                            <optgroup label="Search in column:">
                                <legend>Search in column:</legend>
                                ${this.getTableHeaderOptions()}
                            </optgroup>
                        </select>

                        <span class="spacer">/</span>

                        <label for="search-operator--${state}">
                            ${i18n.t('show-submissions.search-operator')}:
                        </label>
                        <select
                            id="search-operator--${state}"
                            class="button dropdown-menu search-operator">
                            <optgroup label="Operator">
                                <legend>Operator:</legend>
                                <option value="like">
                                    ${i18n.t('show-submissions.search-operator-like')}
                                </option>
                                <option value="=">
                                    ${i18n.t('show-submissions.search-operator-equal')}
                                </option>
                                <option value="!=">
                                    ${i18n.t('show-submissions.search-operator-notequal')}
                                </option>
                                <option value="starts">
                                    ${i18n.t('show-submissions.search-operator-starts')}
                                </option>
                                <option value="ends">
                                    ${i18n.t('show-submissions.search-operator-ends')}
                                </option>
                                <option value="<">
                                    ${i18n.t('show-submissions.search-operator-less')}
                                </option>
                                <option value="<=">
                                    ${i18n.t('show-submissions.search-operator-lessthanorequal')}
                                </option>
                                <option value=">">
                                    ${i18n.t('show-submissions.search-operator-greater')}
                                </option>
                                <option value=">=">
                                    ${i18n.t('show-submissions.search-operator-greaterorequal')}
                                </option>
                                <option value="regex">
                                    ${i18n.t('show-submissions.search-operator-regex')}
                                </option>
                                <option value="keywords">
                                    ${i18n.t('show-submissions.search-operator-keywords')}
                                </option>
                            </optgroup>
                        </select>

                        <span class="spacer">/</span>
                    </div>

                    <button
                        inert
                        class="search-close-button"
                        @click=${() => {
                            this._(`#extendable-searchbar--${state}`).classList.add('closing');
                            this._(
                                `#extendable-searchbar--${state} .search-close-button`,
                            ).setAttribute('inert', true);
                            this._(`#searchbar-menu--${state}`).setAttribute('inert', true);
                            setTimeout(() => {
                                this._(`#extendable-searchbar--${state}`).classList.remove('open');
                                this._(`#extendable-searchbar--${state}`).classList.remove(
                                    'closing',
                                );
                            }, 500);
                        }}>
                        <dbp-icon name="close"></dbp-icon>
                        <span class="visually-hidden">Close search</span>
                    </button>
                </div>
            </div>
        `;
    }

    render() {
        const i18n = this._i18n;

        console.log(`this.submissions`, this.submissions);

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
                <h2>${this.activity.getUrlSlug(this.lang)}</h2>

                <div>
                    <p class="subheadline">
                        <slot name="description">${this.activity.getDescription(this.lang)}</slot>
                    </p>
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
                                this.clearFilter();
                                this.loadingFormsTable = false;
                                this.showFormsTable = true;
                                this.sendSetPropertyEvent('routing-url', '/', true);
                            }}"
                            title="${i18n.t('show-submissions.back-text')}">
                            <dbp-icon name="chevron-left"></dbp-icon>
                            ${i18n.t('show-submissions.back-text')}
                        </a>
                    </span>
                    <div class="table-header submissions">
                        <h3>${this.activeCourse}</h3>
                    </div>
                </div>
            </div>

            <div
                class="container submissions-table ${classMap({
                    hidden: !this.showSubmissionTables,
                })}">
                ${this.noSubmissionAvailable
                    ? html`
                          <div class="notification is-warning">
                              ${i18n.t('show-submissions.no-submission-available-message')}
                          </div>
                      `
                    : ''}
                ${this.submissionStates.map((state) => {
                    const submissionTableTitle = {
                        draft: i18n.t('show-submissions.submission-table-draft-title'),
                        submitted: i18n.t('show-submissions.submission-table-submitted-title'),
                        accepted: i18n.t('show-submissions.submission-table-accepted-title'),
                    };
                    return html`
                        <div
                            class="${classMap({
                                hidden: this.submissions[state].length === 0,
                            })}">
                            <h3 class="table-title">${submissionTableTitle[state]}</h3>

                            <div class="table-buttons table-buttons--${state}">
                                ${this.renderActionsWidget(state)} ${this.renderSearchWidget(state)}
                                ${this.renderExportWidget(state)}
                            </div>

                            <dbp-tabulator-table
                                lang="${this.lang}"
                                class="tabulator-table tabulator-table--${state}"
                                id="tabulator-table-submissions-${state}"
                                identifier="submissions-table-${state}"
                                .options=${this.options_submissions[state]}
                                pagination-enabled
                                pagination-size="5"
                                select-rows-enabled
                                sticky-header></dbp-tabulator-table>
                        </div>
                        ${this.renderColumnSettingsModal(state)}
                        ${this.renderSubmissionDetailsModal(state)}
                    `;
                })}
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-show-submissions', ShowSubmissions);
