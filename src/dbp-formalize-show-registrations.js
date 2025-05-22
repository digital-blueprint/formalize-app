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
import {TabulatorTable} from '@dbp-toolkit/tabulator-table';
import MicroModal from './micromodal.es';
import {getFormRenderUrl, getFormShowSubmissionsUrl} from './utils.js';
import * as fileHandlingStyles from './styles';
import metadata from './dbp-formalize-show-registrations.metadata.json';
import xss from 'xss';
import {send} from '@dbp-toolkit/common/notification';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';

class ShowRegistrations extends ScopedElementsMixin(DBPFormalizeLitElement) {
    constructor() {
        super();
        this.allForms = [];
        this.activity = new Activity(metadata);
        this.boundPressEnterAndSubmitSearchHandler = this.pressEnterAndSubmitSearch.bind(this);
        this.options_submissions = {};
        this.options_forms = {};
        this.forms = new Map();
        this.submissions = [];
        this.showSubmissionsTable = false;
        this.showFormsTable = false;
        this.submissionSlug = '';
        this.formSlugsMap = new Map();
        this.submissionsColumns = [];
        this.submissionsColumnsInitial = [];
        this.initateOpenAdditionalMenu = false;
        this.initateOpenAdditionalSearchMenu = false;
        this.boundCloseAdditionalMenuHandler = this.hideAdditionalMenu.bind(this);
        this.boundCloseAdditionalSearchMenuHandler = this.hideAdditionalSearchMenu.bind(this);
        this.boundCloseAdditionalSearchMenuHandlerInner =
            this.hideAdditionalSearchMenuInner.bind(this);
        this.navigateBetweenDetailedSubmissionsHandler =
            this.navigateBetweenDetailedSubmissions.bind(this);
        this.activeCourse = '';
        this.activeForm = '';
        this.currentRow = null;
        this.currentBeautyId = 0;
        this.totalNumberOfItems = 0;
        this.isPrevEnabled = false;
        this.isNextEnabled = false;
        this.storeSession = true;
        this.loadingFormsTable = true;
        this.loadingSubmissionTable = false;
        this.modalContentHeight = 0;
        this.loadCourses = true;
        this.hiddenColumns = false;
        this.currentDetailPosition = 0;

        this.submissionTable = null;
        this.formsTable = null;
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-icon-button': IconButton,
            'dbp-translated': Translated,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
            'dbp-tabulator-table': TabulatorTable,
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
            showSubmissionsTable: {type: Boolean, attribute: false},
            submissionsColumns: {type: Array, attribute: false},
            isPrevEnabled: {type: Boolean, attribute: false},
            isNextEnabled: {type: Boolean, attribute: false},
            currentBeautyId: {type: Number, attribute: false},
            totalNumberOfItems: {type: Number, attribute: false},
            loadingFormsTable: {type: Boolean, attribute: false},
            loadingSubmissionTable: {type: Boolean, attribute: false},
            modalContentHeight: {type: Number, attribute: false},
            loadCourses: {type: Boolean, attribute: true},
            hasPermissions: {type: Boolean, attribute: false},
            hiddenColumns: {type: Boolean, attribute: false},
            options_submissions: {type: Object, attribute: false},
            options_forms: {type: Object, attribute: false},
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keyup', this.boundPressEnterAndSubmitSearchHandler);
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
        console.log('[connectedCallback] CALLED');

        super.connectedCallback();
        const i18n = this._i18n;

        let langs_forms = {
            en: {
                columns: {
                    id: i18n.t('show-registrations.id', {lng: 'en'}),
                    name: i18n.t('show-registrations.name', {lng: 'en'}),
                },
            },
            de: {
                columns: {
                    id: i18n.t('show-registrations.id', {lng: 'de'}),
                    name: i18n.t('show-registrations.name', {lng: 'de'}),
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

        let auto_langs = {
            en: {
                columns: {},
            },
            de: {
                columns: {},
            },
        };

        this.options_submissions = {
            langs: auto_langs,
            autoColumns: 'full',
            autoColumnsDefinitions: function (definitions) {
                definitions.forEach((column) => {
                    if (column.field.includes('date')) {
                        column.sorter = (a, b, aRow, bRow, column, dir, sorterParams) => {
                            //a, b - the two values being compared
                            //aRow, bRow - the row components for the values being compared (useful if you need to access additional fields in the row data for the sort)
                            //column - the column component for the column being sorted
                            const timeStampA = this.dateToTimestamp(a);
                            const timeStampB = this.dateToTimestamp(b);

                            return timeStampA - timeStampB;
                        };
                    }
                    column.sorter = 'string'; // add header sorter to every column
                    if (column.field === 'htmlButtons') {
                        column.formatter = 'html';
                        column.hozAlign = 'center';
                        column.headerSort = false;
                        column.title = '';
                        column.minWidth = 64;
                        column.frozen = true;
                    }
                });
                return definitions;
            },
            layout: 'fitData',
            layoutColumnsOnNewData: true,
            columnDefaults: {
                vertAlign: 'middle',
                hozAlign: 'left',
                resizable: false,
            },
        };

        this.updateComplete.then(async () => {
            // see: http://tabulator.info/docs/5.1
            document.addEventListener('keyup', this.boundPressEnterAndSubmitSearchHandler);
        });
    }

    async firstUpdated() {
        this.formsTable = this._('#tabulator-table-forms');
        this.submissionTable = this._('#tabulator-table-submissions');

        // Load forms to get formSlugs
        await this.loadModules();

        if (this.auth.token === '') {
            console.log('Not yet authenticated');
            return;
        }
        try {
            // If we arrive from another activity, auth is not updated
            // we need to init form loading here.
            await this.getListOfAllForms();
        } catch (error) {
            console.error('[firstUpdated] Error initializing tables:', error);
        }
    }

    async updated(changedProperties) {
        if (changedProperties.has('auth')) {
            if (!this.authTokenExists && this.auth.token !== '') {
                this.authTokenExists = true;

                if (this.forms.size == 0) {
                    await this.getListOfAllForms();
                }
            }
        }
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
                    this.formsTable = this._('#tabulator-table-forms');
                    if (this.formsTable && !this.formsTable.tableReady) {
                        this._('#tabulator-table-forms').buildTable();
                        this.loadingFormsTable = false;
                        this.showFormsTable = true;
                    }
                }
            }
        }

        if (changedProperties.has('routingUrl')) {
            const newUrl = !this.routingUrl.match(/^\//) ? `/${this.routingUrl}` : this.routingUrl;
            const prevUrl = changedProperties.get('routingUrl');
            // Prepend a slash to the URL if it doesn't start with one
            const oldUrl = prevUrl && !prevUrl.match(/^\//) ? '/' + prevUrl : prevUrl;

            if (oldUrl === undefined) return;

            if (oldUrl !== newUrl) {
                console.log('[updated - routingUrl]', oldUrl, '=>', newUrl);

                if (this.forms.size === 0 && this.authTokenExists) {
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
                    this.formsTable = this._('#tabulator-table-forms');
                    if (this.formsTable) {
                        if (!this.formsTable.tableReady) {
                            this._('#tabulator-table-forms').buildTable();
                        }
                        this.loadingFormsTable = false;
                        this.showFormsTable = true;
                        this.showSubmissionsTable = false;
                    }
                }
            }
        }

        super.updated(changedProperties);
    }

    throwSomethingWentWrongNotification() {
        const i18n = this._i18n;

        send({
            summary: i18n.t('show-registrations.something-went-wrong-title'),
            body: i18n.t('show-registrations.something-went-wrong-body'),
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
                    this.formSlugsMap.set(object.getFormIdentifier(), object.getUrlSlug());
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
        this.loadingSubmissionTable = true;
        this.getAllFormSubmissions(this.activeForm).then(async () => {
            this.sendSetPropertyEvent('routing-url', `/${form.formId}`, true);

            // Init submission table
            if (this.submissionTable) {
                this.options_submissions.data = this.submissions;
                this.submissionTable.buildTable();

                this.loadingSubmissionTable = false;
                this.showSubmissionsTable = true;
                this.showFormsTable = false;
            }

            this.setInitialSubmissionTableOrder();

            // Get table settings from localstorage
            this.getSubmissionTableSettings();

            if (this.submissions.length === 0) {
                // this.submissionTable.setColumns([]);
            }
            this.defineSettings();
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
                    // Only show forms for which the currently logged-in user has 'read_submissions' or 'manage' rights
                    const grantedActions = entry['grantedActions'];
                    if (
                        !Array.isArray(grantedActions) ||
                        (!grantedActions.includes('read_submissions') &&
                            !grantedActions.includes('manage'))
                    ) {
                        continue;
                    }
                    const id = x + 1;
                    const formName = entry['name'];
                    const formId = entry['identifier'];
                    const formSlug = this.formSlugsMap.get(formId) || null;

                    this.forms.set(formId, {
                        formName: formName,
                        formId: formId,
                        formSlug: formSlug,
                    });

                    let btn = this.createScopedElement('dbp-icon-button');
                    btn.setAttribute('icon-name', 'keyword-research');
                    btn.setAttribute('title', i18n.t('show-registrations.open-forms'));
                    btn.setAttribute('aria-label', i18n.t('show-registrations.open-forms'));

                    btn.addEventListener('click', async (event) => {
                        this.loadingSubmissionTable = true;
                        // Switch to form submissions table
                        this.routingUrl = `/${formId}`;
                        const formSubmissionUrl = getFormShowSubmissionsUrl(formId);
                        const url = new URL(formSubmissionUrl);
                        window.history.pushState({}, '', url);
                        this.sendSetPropertyEvent('routing-url', `/${formId}`, true);
                    });

                    let div = this.createScopedElement('div');
                    div.classList.add('button-wrapper');
                    div.appendChild(btn);

                    let new_form = {id: id, name: formName, actionButton: btn};
                    forms.push(new_form);
                }

                this.allForms = forms;
                // Set tabulator table data
                this.options_forms.data = this.allForms;
            }
        } catch (e) {
            console.log(e);
            this.loadCourses = true;
        }
    }

    /**
     * Gets the list of submissions for a specific form
     *
     * @param {string} formId - form identifier
     */
    async getAllFormSubmissions(formId) {
        const i18n = this._i18n;
        // Reset submissions
        this.submissions = [];
        let response;
        let data = [];
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
            this.submissions = [];
            return response;
        }

        let firstDataFeedElement = data['hydra:member'][0]['dataFeedElement'];
        firstDataFeedElement = JSON.parse(firstDataFeedElement);
        let columns = Object.keys(firstDataFeedElement);
        columns.unshift('dateCreated');

        let submissions_list = [];
        for (let x = 0; x < data['hydra:member'].length; x++) {
            let dateCreated = data['hydra:member'][x]['dateCreated'];
            dateCreated = this.humanReadableDate(dateCreated);
            let dataFeedElement = data['hydra:member'][x]['dataFeedElement'];
            dataFeedElement = JSON.parse(dataFeedElement);
            let submissionId = data['hydra:member'][x]['identifier'];

            const id = x + 1;
            const cols = {dateCreated: dateCreated, ...dataFeedElement};
            const btn = this.createScopedElement('dbp-icon-button');
            btn.setAttribute('icon-name', 'keyword-research');
            btn.setAttribute('title', i18n.t('show-registrations.open-detailed-view-modal'));
            btn.setAttribute('aria-label', i18n.t('show-registrations.open-detailed-view-modal'));
            btn.setAttribute('id', id.toString());
            btn.classList.add('open-modal-icon');
            btn.addEventListener('click', (event) => {
                // Redirect to render-form activity to display the readonly form with submission values
                const activeForm = this.forms.get(formId);
                const activeFormSlug = activeForm ? activeForm.formSlug : null;

                // @TODO: LunchLottery don't have a slug
                // other forms don't have read-only view
                // if (!activeFormSlug) {
                if (activeForm.formName !== 'Ethikkommission') {
                    console.error('No slug found for form ID:', formId);
                    this.requestDetailedSubmission(cols, id);
                    return;
                }
                const formSubmissionUrl =
                    getFormRenderUrl(activeFormSlug) + `/${submissionId}/readonly`;
                const url = new URL(formSubmissionUrl);
                window.history.pushState({}, '', url);
                console.log(`window.history`, window.history);
                window.location.href = url.toString();
                event.stopPropagation();
            });

            let div = this.createScopedElement('div');
            div.appendChild(btn);
            div.classList.add('actions-buttons');

            let entry = {dateCreated: dateCreated, ...dataFeedElement, htmlButtons: div};

            submissions_list.push(entry);
        }

        this.submissions = submissions_list;
        // Set tabulator table data
        this.options_submissions.data = this.submissions;
        this.totalNumberOfItems = submissions_list.length;

        return response;
    }

    setInitialSubmissionTableOrder() {
        const submissionsTable = this.submissionTable;

        if (!submissionsTable) return;
        let columns = submissionsTable.getColumns();
        if (columns) {
            columns.forEach((col) => {
                let name = col.getDefinition().title;
                let field = col.getDefinition().field;
                let visibility = col.isVisible();
                if (field && !field.includes('no_display') && field !== 'id' && field !== 'id_') {
                    this.submissionsColumnsInitial.push({
                        name: name,
                        field: field,
                        visibility: visibility,
                    });
                }
            });
        }
    }

    /**
     * Defines the editable settings based on the current submissions tabulator
     *
     */
    defineSettings() {
        const table = this.submissionTable;
        let settings = this._('#submission-modal-content');

        let list = document.createElement('ul');
        list.classList.add('headers');
        let columns = table.getColumns();
        columns.splice(-1, 1);

        columns.map((column, index) => {
            let element = document.createElement('li');
            element.classList.add('header-fields');
            element.classList.add(column.getField());
            element.setAttribute('data-index', index.toString());

            let div = document.createElement('div');
            div.classList.add('header-field');

            let header_order = document.createElement('span');
            header_order.textContent = index + 1;
            header_order.classList.add('header-button');
            header_order.classList.add('header-order');
            div.appendChild(header_order);

            let header_title = document.createElement('span');
            header_title.innerHTML = '<strong>' + column.getField() + '</strong>';
            header_title.classList.add('header-title');
            div.appendChild(header_title);

            let visibility = /** @type {IconButton} */ (
                this.createScopedElement('dbp-icon-button')
            );
            if (column.isVisible()) {
                visibility.iconName = 'source_icons_eye-empty';
            } else {
                visibility.iconName = 'source_icons_eye-off';
            }

            visibility.classList.add('header-visibility-icon');

            visibility.addEventListener('click', (event) => {
                if (visibility.iconName === 'source_icons_eye-empty') {
                    visibility.iconName = 'source_icons_eye-off';
                } else {
                    visibility.iconName = 'source_icons_eye-empty';
                }
            });
            div.appendChild(visibility);

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
            div.appendChild(header_move);

            element.appendChild(div);
            list.appendChild(element);
        });

        settings.appendChild(list);
    }

    /**
     * Removes settings that correspond to a former submissions tabulator
     *
     */
    deleteSettings() {
        let settings = this._('#submission-modal-content');

        let list = settings.children[0];
        if (list) {
            settings.removeChild(list);
        }
    }

    /**
     * Resets the settings to their currently not saved values
     *
     */
    resetSettings() {
        let list = this._('.headers');
        const listChilds = list.childNodes;
        const columns = this.submissionsColumnsInitial;
        // Remove show detail button column
        columns.splice(-1, 1);

        // Restore initial column order
        [...listChilds].forEach((element, index) => {
            let header_field = element.children[0];
            // Reset title
            header_field.children[1].innerHTML = '<strong>' + columns[index].name + '</strong>';
            // Reset visibilty
            let visibility = header_field.children[2];
            if (columns[index].visibility) {
                visibility.iconName = 'source_icons_eye-empty';
            } else if (!columns[index].visibility) {
                visibility.iconName = 'source_icons_eye-off';
            }
            // Delete previous settings from localstorage
            this.deleteSubmissionTableSettings();
        });
    }

    /**
     * Gets the detaildata of a specific row
     *
     * @param entry
     * @param pos
     */
    requestDetailedSubmission(entry, pos) {
        if (!this._('.detailed-submission-modal-content-wrapper') || !this._('#apply-col-settings'))
            return;
        this._('.detailed-submission-modal-content-wrapper').innerHTML = '';

        if (this.submissionsColumns.length !== 0) {
            for (let current_column of this.submissionsColumns) {
                if (entry[current_column.field] !== undefined) {
                    this._('.detailed-submission-modal-content-wrapper').innerHTML +=
                        `<div class='element-left'>` + xss(current_column.field) + `:</div>`;

                    if (current_column.field === 'dateCreated') {
                        this._('.detailed-submission-modal-content-wrapper').innerHTML +=
                            `<div class='element-right'>` +
                            this.humanReadableDate(entry[current_column.field]);
                    } else {
                        this._('.detailed-submission-modal-content-wrapper').innerHTML +=
                            `<div class='element-right'>` +
                            xss(entry[current_column.field]) +
                            `</div>`;
                    }
                }
            }
        } else {
            for (const [key, value] of Object.entries(entry)) {
                this._('.detailed-submission-modal-content-wrapper').innerHTML +=
                    `<div class='element-left'>` + xss(key) + `:</div>`;

                if (key === 'dateCreated') {
                    this._('.detailed-submission-modal-content-wrapper').innerHTML +=
                        `<div class='element-right'>` + this.humanReadableDate(value);
                } else {
                    this._('.detailed-submission-modal-content-wrapper').innerHTML +=
                        `<div class='element-right'>` + xss(value) + `</div>`;
                }
            }
        }

        this.currentDetailPosition = pos;
        this.currentBeautyId = pos;
        this.isPrevEnabled = pos !== 1;
        this.isNextEnabled = pos + 1 <= this.totalNumberOfItems;

        if (this._('.detailed-submission-modal-content-wrapper > div:first-child'))
            this._('.detailed-submission-modal-content-wrapper > div:first-child').classList.add(
                'first',
            );
        if (this._('.detailed-submission-modal-content-wrapper > div:nth-child(2)'))
            this._('.detailed-submission-modal-content-wrapper > div:nth-child(2)').classList.add(
                'first',
            );

        this.showDetailedModal();

        this.modalContentHeight =
            this._('#detailed-submission-modal-box > .modal-header').offsetHeight +
            this._('#detailed-submission-modal-box > .modal-footer').offsetHeight;
        this._('.detailed-submission-modal-content-wrapper').setAttribute(
            'style',
            'max-height: calc(100vH - ' + this.modalContentHeight + 'px);',
        );
    }

    /**
     * Export the specific table
     *
     * @param e
     */
    async exportSubmissionTable(e) {
        let exportInput = /** @type {HTMLSelectElement} */ (this._('#export-select'));
        if (!exportInput) return;

        let exportValue = exportInput.value;

        if (!exportValue || exportValue === '') return;

        if (e) e.stopPropagation();

        const table = this.submissionTable;
        table.download(exportValue, this.activeCourse);
        exportInput.value = '-';
    }

    /**
     * Filters the submissions table
     */
    filterTable() {
        let filter = /** @type {HTMLInputElement} */ (this._('#searchbar'));
        let search = /** @type {HTMLSelectElement} */ (this._('#search-select'));
        let operator = /** @type {HTMLSelectElement} */ (this._('#search-operator'));

        const table = this.submissionTable;

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
                let filter_object = {field: col, type: operatorValue, value: filterValue};
                listOfFilters.push(filter_object);
            }
            table.setFilter([listOfFilters]);
        }
    }

    /**
     * Removes the current filters from the submissions table
     *
     */
    clearFilter() {
        let filter = /** @type {HTMLInputElement} */ (this._('#searchbar'));
        let search = /** @type {HTMLSelectElement} */ (this._('#search-select'));
        const table = this.submissionTable;

        if (!filter || !search || !table) return;

        filter.value = '';
        search.value = 'all';
        table.clearFilter();
    }

    /**
     * Creates options for a select box of the t
     * this.submissionColumns Array (all possible cols of active table)
     *
     * @returns {Array<html>} options
     */
    getTableHeaderOptions() {
        const i18n = this._i18n;

        if (this.submissions.length === 0) {
            return [];
        } else {
            let options = [];
            options[0] = html`
                <option value="all">${i18n.t('show-registrations.all-columns')}</option>
            `;

            let cols = Object.keys(this.submissions[0]);

            for (let [counter, col] of cols.entries()) {
                if (col !== 'no_display_1') {
                    options[counter + 1] = html`
                        <option value="${col}">${col}</option>
                    `;
                }
            }
            return options;
        }
    }

    /**
     * Opens submission Columns Modal
     *
     */
    openColumnOptionsModal() {
        let modal = this._('#column-options-modal');
        if (modal) {
            MicroModal.show(modal, {
                disableScroll: true,
                disableFocus: false,
            });
        }

        // Scroll list to topdisableScroll: true
        let scrollWrapper = this._('#submission-modal-content');
        if (scrollWrapper) {
            scrollWrapper.scrollTo(0, 0);
        }
    }

    /**
     * Close Column Options Modal
     *
     */
    closeColumnOptionsModal() {
        let modal = this._('#column-options-modal');
        if (modal) {
            MicroModal.close(modal);
        }
    }

    /**
     * Close submission Columns Modal
     *
     */
    closeDetailModal() {
        let modal = this._('#detailed-submission-modal');
        if (modal) {
            MicroModal.close(modal);
        }
    }

    /**
     * Opens submission detail Modal
     *
     */
    showDetailedModal() {
        let modal = this._('#detailed-submission-modal');
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
     * Toggle additional functionalities menu on mobile
     *
     */
    toggleMoreMenu() {
        const menu = this.shadowRoot.querySelector('ul.extended-menu');
        const menuStart = this.shadowRoot.querySelector('a.extended-menu-link');

        if (menu === null || menuStart === null) {
            return;
        }

        menu.classList.toggle('hidden');

        if (!menu.classList.contains('hidden')) {
            // add event listener for clicking outside of menu
            document.addEventListener('click', this.boundCloseAdditionalMenuHandler);
            this.initateOpenAdditionalMenu = true;
        } else {
            document.removeEventListener('click', this.boundCloseAdditionalMenuHandler);
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
            if (activeElement && activeElement.id === 'searchbar') {
                event.preventDefault();
                this.filterTable();
                this.hideAdditionalSearchMenu(event);
            }
        }
    }

    /**
     * Keydown Event function if left or right pressed, then we can change the detailed submissions
     *
     * @param event
     */
    navigateBetweenDetailedSubmissions(event) {
        // left
        if (event.keyCode === 37) {
            let backBtn = /** @type {HTMLButtonElement} */ (
                this._('#detailed-submission-modal-box .back-btn')
            );
            if (backBtn && !backBtn.disabled) {
                this.showEntryOfPos(this.currentDetailPosition - 1, 'previous');
            }
        }

        //right
        if (event.keyCode === 39) {
            //and modal is open and left is not disabled
            let nextBtn = /** @type {HTMLButtonElement} */ (
                this._('#detailed-submission-modal-box .next-btn')
            );
            if (nextBtn && !nextBtn.disabled) {
                this.showEntryOfPos(this.currentDetailPosition + 1, 'next');
            }
        }
    }

    /**
     * Hide additional functionalities menu
     * This function is used as bounded event function,
     * if clicked outside then we can close the menu
     *
     */
    hideAdditionalMenu() {
        if (this.initateOpenAdditionalMenu) {
            this.initateOpenAdditionalMenu = false;
            return;
        }
        const menu = this.shadowRoot.querySelector('ul.extended-menu');
        if (menu && !menu.classList.contains('hidden')) this.toggleMoreMenu();
    }

    /**
     * Toggle search menu
     *
     */
    toggleSearchMenu() {
        const menu = this._('#extendable-searchbar .extended-menu');
        const searchBarMenu = this._('#searchbar-menu');

        if (menu === null) {
            return;
        }

        menu.classList.remove('hidden');

        if (!menu.classList.contains('hidden')) {
            // add event listener for clicking *outside* of menu
            document.addEventListener('click', this.boundCloseAdditionalSearchMenuHandler);
            // add event listener for clicking *inside* of menu
            searchBarMenu.addEventListener(
                'click',
                this.boundCloseAdditionalSearchMenuHandlerInner,
            );
            this.initateOpenAdditionalSearchMenu = true;
        }
    }

    hideAdditionalSearchMenuInner(event) {
        const searchBarMenu = this._('#searchbar-menu');
        // Don't close the search widget if clicking inside
        if (searchBarMenu.contains(event.target)) {
            event.stopPropagation();
            this.initateOpenAdditionalSearchMenu = false;
            return;
        }
    }

    /**
     * hide search menu
     *
     * @param e
     */
    hideAdditionalSearchMenu(e) {
        if (this.initateOpenAdditionalSearchMenu) {
            this.initateOpenAdditionalSearchMenu = false;
            return;
        }

        const menu = this._('#extendable-searchbar .extended-menu');
        const searchBarMenu = this._('#searchbar-menu');
        if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
            document.removeEventListener('click', this.boundCloseAdditionalSearchMenuHandler);
            searchBarMenu.removeEventListener(
                'click',
                this.boundCloseAdditionalSearchMenuHandlerInner,
            );
        }
    }

    /**
     * Update Submission Table (order and visibility)
     *
     */
    updateSubmissionTable() {
        let list = this._('.headers');
        list = list.childNodes;
        const table = this.submissionTable;

        let newColumns = [];
        [...list].forEach((element, index) => {
            let header_field = element.children[0];
            let current_title = header_field.children[1].innerText;
            let visibility_icon = header_field.children[2];
            let visibility;
            if (visibility_icon.iconName === 'source_icons_eye-off') {
                visibility = false;
            } else if (visibility_icon.iconName === 'source_icons_eye-empty') {
                visibility = true;
            }
            let new_column = {title: current_title, field: current_title, visible: visibility};
            newColumns.push(new_column);
        });
        let columns = table.getColumns();
        let last_column = columns.pop();
        last_column = last_column.getDefinition();
        newColumns.push(last_column);
        table.setColumns(newColumns);
        this.submissionsColumns = newColumns;
    }

    /**
     * Gets stored submission table settings from localStorage
     *
     * @returns {boolean} success
     */
    getSubmissionTableSettings() {
        if (this.storeSession && this.isLoggedIn()) {
            let optionsString = localStorage.getItem(
                'dbp-formalize-tableoptions-' + this.activeCourse + '-' + this.auth['user-id'],
            );
            if (!optionsString) {
                this.submissionsColumns = [];
                return false;
            }

            try {
                let options = JSON.parse(optionsString);
                if (options) {
                    this.submissionsColumns = [...options];
                }
            } catch (e) {
                this.sendErrorAnalyticsEvent('getSubmissionTableSettings', 'WrongResponse', e);
                this.submissionsColumns = [];
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Stores submission Table settings in localStorage
     *
     */
    setSubmissionTableSettings() {
        if (this.storeSession && this.isLoggedIn()) {
            const publicId = this.auth['user-id'];
            localStorage.setItem(
                'dbp-formalize-tableoptions-' + this.activeCourse + '-' + publicId,
                JSON.stringify(this.submissionsColumns),
            );
        }
    }

    /**
     * Delete submission Table settings from localStorage
     *
     */
    deleteSubmissionTableSettings() {
        if (this.storeSession && this.isLoggedIn()) {
            const publicId = this.auth['user-id'];
            localStorage.removeItem(
                'dbp-formalize-tableoptions-' + this.activeCourse + '-' + publicId,
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
     *
     * @param {number} positionToShow
     * @param {"next"|"previous"} direction
     */
    async showEntryOfPos(positionToShow, direction) {
        if (positionToShow > this.totalNumberOfItems || positionToShow < 1) return;

        const table = this.submissionTable;
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

        this.requestDetailedSubmission(next_data, positionToShow);
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getModalDialogCSS()}
            ${commonStyles.getRadioAndCheckboxCss()}
            ${commonStyles.getGeneralCSS(false)}
            ${fileHandlingStyles.getFileHandlingCss()}
            ${commonStyles.getNotificationCSS()}
            ${commonStyles.getActivityCSS()}
            ${commonStyles.getButtonCSS()}

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

            .actions-buttons {
                width: 40px;
                position: absolute;
                margin: auto;
                left: 0;
            }

            #detailed-submission-modal-title {
                margin-bottom: 10px;
            }

            #submission-modal-title {
                margin-top: unset;
                margin-bottom: unset;
            }

            #detailed-submission-modal-content {
                padding: 0 20px 0 20px;
            }

            #detailed-submission-modal-box {
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

            #export-select,
            #search-select,
            #search-operator,
            .dropdown-menu {
                background-color: var(--dbp-secondary-surface);
                color: var(--dbp-on-secondary-surface);
                border-color: var(--dbp-secondary-surface-border-color);
                background-size: auto 45%;
                padding-bottom: calc(0.375em - 1px);
                padding-left: 0.75em;
                padding-right: 1.5rem;
                padding-top: calc(0.375em - 1px);
                cursor: pointer;
                background-position-x: calc(100% - 0.4rem);
                box-sizing: content-box;
            }

            .export-buttons .dropdown-menu {
                margin-left: 6px;
            }

            .detailed-submission-modal-content-wrapper {
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

            .table-buttons {
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                gap: 4px;
                margin-bottom: 1em;
            }

            @container table-wrapper (width < 620px) {
                .table-buttons {
                    flex-direction: column;
                    gap: 10px;
                }
            }

            @container table-wrapper (width < 290px) {
                .export-buttons .dropdown-menu {
                    margin-left: 0;
                    margin-top: 10px;
                }
            }

            .modal-container {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                text-align: center;
            }

            #submission-modal-content {
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

            #courses-table .tabulator-cell[tabulator-field='actionButton'] {
                padding: 0;
            }

            span.first {
                margin-left: -6px;
            }

            select[disabled] {
                opacity: 0.4;
                cursor: not-allowed;
            }

            #searchbar {
                width: 100%;
                box-sizing: border-box;
                border: var(--dbp-border);
                padding: calc(0.375em - 1px) 10px calc(0.375em - 1px) 10px;
                border-radius: var(--dbp-border-radius);
                min-height: 40px;
                background-color: var(--dbp-background);
                color: var(--dbp-content);
            }

            #extendable-searchbar {
                flex-grow: 1;
                position: relative;
            }

            .search-wrapper {
                display: flex;
                justify-content: center;
                min-width: 320px;
            }

            #search-button {
                position: absolute;
                right: 0;
                top: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 1.2rem;
            }

            #extendable-searchbar .extended-menu {
                list-style: none;
                border: var(--dbp-border);
                background-color: var(--dbp-background);
                z-index: 1000;
                border-radius: var(--dbp-border-radius);
                width: 100%;
                position: absolute;
                right: 0;
                padding: 10px;
                box-sizing: border-box;
                top: 33px;
                margin: 0;
                border-top: unset;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            #search-select,
            #search-operator {
                margin-bottom: 10px;
                box-sizing: border-box;
                text-align: left;
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
                    border-top: 1px solid #3333;
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

                #detailed-submission-modal-box {
                    min-width: 320px;
                }

                #detailed-submission-modal-box .modal-footer .modal-footer-btn {
                    padding: 6px 12px 6px 12px;
                    flex-direction: column;
                    gap: 6px;
                }

                #detailed-submission-modal-box .modal-content {
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

                .extended-menu-link {
                    display: flex;
                    width: 40px;
                    box-sizing: border-box;
                    height: 40px;
                    justify-content: center;
                    align-items: center;
                }

                .extended-menu-link dbp-icon {
                    top: -3px;
                }

                .extended-menu li {
                    padding: 7px;
                    padding-right: 46px;
                }

                .extended-menu a.inactive {
                    color: var(--dbp-muted);
                    pointer-events: none;
                    cursor: default;
                }

                .extended-menu a {
                    padding: 8px;
                }

                .extended-menu {
                    list-style: none;
                    border: var(--dbp-border);
                    position: absolute;
                    background-color: var(--dbp-background);
                    z-index: 1000;
                    border-radius: var(--dbp-border-radius);
                    padding: 0;
                    margin: -2px 0 0 0;
                    min-width: 50vw;
                    right: 0;
                }

                .extended-menu li.active {
                    background-color: var(--dbp-content-surface);
                }

                .extended-menu li.active > a {
                    color: var(--dbp-on-content-surface);
                }

                .extended-menu li.inactive > a {
                    color: var(--dbp-muted);
                    pointer-events: none;
                    cursor: default;
                }

                .options-nav {
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between;
                }

                .back-navigation {
                    padding-top: 0;
                }

                #searchbar {
                    height: 40px;
                }

                #search-button {
                    position: absolute;
                    right: 0;
                    top: 0;
                    height: 40px;
                    box-sizing: border-box;
                }

                #search-select,
                #search-operator {
                    height: 40px;
                }

                #extendable-searchbar .extended-menu {
                    top: 40px;
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
                #detailed-submission-modal-box {
                    width: 100%;
                    height: 100%;
                    max-width: 100%;
                }

                #submission-modal-content,
                #detailed-submission-modal-content {
                    height: 100%;
                }

                .detailed-submission-modal-content-wrapper {
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

    render() {
        const i18n = this._i18n;

        return html`
            <div
                class="notification is-warning ${classMap({
                    hidden: this.isLoggedIn() || !this.isAuthPending(),
                })}">
                ${i18n.t('error-login-message')}
            </div>

            <div class="control ${classMap({hidden: this.isLoggedIn() || this.isAuthPending()})}">
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
                        hidden: this.showSubmissionsTable || !this.loadingFormsTable,
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
                        pagination-size="10"
                        .options=${this.options_forms}></dbp-tabulator-table>
                </div>

                <div
                    class="control submissions-spinner ${classMap({
                        hidden: !this.loadingSubmissionTable,
                    })}">
                    <span class="loading">
                        <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
                    </span>
                </div>

                <div
                    class="table-wrapper submissions${classMap({
                        hideWithoutDisplay:
                            !this.showSubmissionsTable || this.loadingSubmissionTable,
                    })}">
                    <span class="back-navigation">
                        <a
                            @click="${() => {
                                this.showSubmissionsTable = false;
                                this.clearFilter();
                                this.loadingCourseTable = false;
                                this.loadingFormsTable = false;
                                this.showFormsTable = true;
                                this.sendSetPropertyEvent('routing-url', '/', true);
                            }}"
                            title="${i18n.t('show-registrations.back-text')}">
                            <dbp-icon name="chevron-left"></dbp-icon>
                            ${i18n.t('show-registrations.back-text')}
                        </a>
                    </span>
                    <div class="table-header submissions">
                        <h3>${this.activeCourse}</h3>
                    </div>

                    <div class="table-buttons">
                        <div class="search-wrapper">
                            <div id="extendable-searchbar">
                                <input
                                    type="text"
                                    id="searchbar"
                                    placeholder="${i18n.t(
                                        'show-registrations.searchbar-placeholder',
                                    )}"
                                    @click="${() => {
                                        this.toggleSearchMenu();
                                    }}" />
                                <dbp-icon-button
                                    class="button is-icon"
                                    id="search-button"
                                    title="${i18n.t('show-registrations.search-button')}"
                                    aria-label="${i18n.t('show-registrations.search-button')}"
                                    icon-name="search"
                                    @click="${() => {
                                        this.filterTable();
                                    }}"></dbp-icon-button>
                                <ul class="extended-menu hidden" id="searchbar-menu">
                                    <label for="search-select">
                                        ${i18n.t('show-registrations.search-in')}:
                                    </label>
                                    <select
                                        id="search-select"
                                        class="button dropdown-menu"
                                        title="${i18n.t('show-registrations.search-in-column')}:">
                                        ${this.getTableHeaderOptions()}
                                    </select>

                                    <label for="search-operator">
                                        ${i18n.t('show-registrations.search-operator')}:
                                    </label>
                                    <select id="search-operator" class="button dropdown-menu">
                                        <option value="like">
                                            ${i18n.t('show-registrations.search-operator-like')}
                                        </option>
                                        <option value="=">
                                            ${i18n.t('show-registrations.search-operator-equal')}
                                        </option>
                                        <option value="!=">
                                            ${i18n.t('show-registrations.search-operator-notequal')}
                                        </option>
                                        <option value="starts">
                                            ${i18n.t('show-registrations.search-operator-starts')}
                                        </option>
                                        <option value="ends">
                                            ${i18n.t('show-registrations.search-operator-ends')}
                                        </option>
                                        <option value="<">
                                            ${i18n.t('show-registrations.search-operator-less')}
                                        </option>
                                        <option value="<=">
                                            ${i18n.t(
                                                'show-registrations.search-operator-lessthanorequal',
                                            )}
                                        </option>
                                        <option value=">">
                                            ${i18n.t('show-registrations.search-operator-greater')}
                                        </option>
                                        <option value=">=">
                                            ${i18n.t(
                                                'show-registrations.search-operator-greaterorequal',
                                            )}
                                        </option>
                                        <option value="regex">
                                            ${i18n.t('show-registrations.search-operator-regex')}
                                        </option>
                                        <option value="keywords">
                                            ${i18n.t('show-registrations.search-operator-keywords')}
                                        </option>
                                    </select>
                                </ul>
                            </div>
                        </div>

                        <div class="export-buttons">
                            <dbp-button
                                no-spinner-on-click
                                type="is-secondary"
                                @click="${() => {
                                    this.openColumnOptionsModal();
                                }}">
                                <dbp-icon
                                    title="${i18n.t(
                                        'show-registrations.filter-options-button-text',
                                    )}"
                                    aria-label="${i18n.t(
                                        'show-registrations.filter-options-button-text',
                                    )}"
                                    name="iconoir_settings"></dbp-icon>
                                ${i18n.t('show-registrations.table-config-button-text')}
                            </dbp-button>
                            <select
                                id="export-select"
                                class="dropdown-menu"
                                @change="${this.exportSubmissionTable}">
                                <option value="-" disabled selected>
                                    ${i18n.t('show-registrations.default-export-select')}
                                </option>
                                <option value="csv">CSV</option>
                                <option value="xlsx">Excel</option>
                                <option value="pdf">PDF</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div
                class="container submissions-table ${classMap({
                    hidden: !this.showSubmissionsTable,
                })}">
                <dbp-tabulator-table
                    lang="${this.lang}"
                    class="tabulator-table"
                    id="tabulator-table-submissions"
                    identifier="submissions-table"
                    .options=${this.options_submissions}
                    pagination-enabled
                    pagination-size="5"
                    sticky-header
                    select-rows-enabled></dbp-tabulator-table>
            </div>

            <div class="modal micromodal-slide" id="column-options-modal" aria-hidden="true">
                <div class="modal-overlay" tabindex="-2" data-micromodal-close>
                    <div
                        class="modal-container"
                        id="filter-modal-box"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="submission-modal-title">
                        <header class="modal-header">
                            <dbp-icon-button
                                title="${i18n.t('show-registrations.modal-close')}"
                                aria-label="${i18n.t('show-registrations.modal-close')}"
                                class="modal-close"
                                icon-name="close"
                                @click="${() => {
                                    this.closeColumnOptionsModal();
                                }}"></dbp-icon-button>
                            <p id="submission-modal-title">
                                ${i18n.t('show-registrations.header-settings')}
                            </p>
                        </header>
                        <main class="modal-content" id="submission-modal-content"></main>
                        <footer class="modal-footer">
                            <div class="modal-footer-btn">
                                <div>
                                    <button
                                        title="${i18n.t('show-registrations.abort')}"
                                        class="check-btn button is-secondary"
                                        @click="${() => {
                                            this.closeColumnOptionsModal();
                                        }}">
                                        ${i18n.t('show-registrations.abort')}
                                    </button>
                                    <button
                                        title="${i18n.t('show-registrations.reset-filter')}"
                                        class="check-btn button is-secondary"
                                        @click="${() => {
                                            this.resetSettings();
                                        }}">
                                        ${i18n.t('show-registrations.reset-filter')}
                                    </button>
                                </div>
                                <button
                                    class="check-btn button is-primary"
                                    id="check"
                                    @click="${() => {
                                        this.updateSubmissionTable();
                                        this.closeColumnOptionsModal();
                                        this.setSubmissionTableSettings();
                                    }}">
                                    ${i18n.t('show-registrations.save-columns')}
                                </button>
                            </div>
                        </footer>
                    </div>
                </div>
            </div>

            <div class="modal micromodal-slide" id="detailed-submission-modal" aria-hidden="true">
                <div class="modal-overlay" tabindex="-2" data-micromodal-close>
                    <div
                        class="modal-container"
                        id="detailed-submission-modal-box"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="detailed-submission-modal-title">
                        <header class="modal-header">
                            <button
                                title="${i18n.t('show-registrations.modal-close')}"
                                class="modal-close"
                                aria-label="${i18n.t('show-registrations.modal-close')}"
                                @click="${() => {
                                    this.closeDetailModal();
                                }}">
                                <dbp-icon
                                    title="${i18n.t('show-registrations.modal-close')}"
                                    aria-hidden="true"
                                    name="close"
                                    class="close-icon"></dbp-icon>
                            </button>
                            <h3 id="detailed-submission-modal-title">
                                ${i18n.t('show-registrations.detailed-submission-dialog-title')}
                            </h3>
                        </header>
                        <main class="modal-content" id="detailed-submission-modal-content">
                            <div class="detailed-submission-modal-content-wrapper"></div>
                        </main>
                        <footer class="modal-footer">
                            <div class="modal-footer-btn">
                                <label
                                    class="button-container ${classMap({
                                        hidden: !this.hiddenColumns,
                                    })}">
                                    ${i18n.t('show-registrations.apply-col-settings')}
                                    <input
                                        type="checkbox"
                                        id="apply-col-settings"
                                        name="apply-col-settings"
                                        @click="${() => {
                                            this.requestDetailedSubmission(
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
                                            'show-registrations.previous-entry-btn-title',
                                        )}"
                                        @click="${() => {
                                            this.showEntryOfPos(
                                                this.currentDetailPosition - 1,
                                                'previous',
                                            );
                                        }}"
                                        ?disabled=${!this.isPrevEnabled}>
                                        <dbp-icon name="chevron-left" aria-hidden="true"></dbp-icon>
                                        ${i18n.t('show-registrations.previous-entry-btn-title')}
                                    </dbp-button>
                                    <div class="page-numbering">
                                        ${i18n.t(
                                            'show-registrations.detailed-submission-dialog-id',
                                            {
                                                id: this.currentBeautyId,
                                                nItems: this.totalNumberOfItems,
                                            },
                                        )}
                                    </div>
                                    <dbp-button
                                        class="next-btn"
                                        no-spinner-on-click
                                        title="${i18n.t('show-registrations.next-entry-btn-title')}"
                                        @click="${() => {
                                            this.showEntryOfPos(
                                                this.currentDetailPosition + 1,
                                                'next',
                                            );
                                        }}"
                                        ?disabled=${!this.isNextEnabled}>
                                        ${i18n.t('show-registrations.next-entry-btn-title')}
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
}

commonUtils.defineCustomElement('dbp-formalize-show-registrations', ShowRegistrations);
