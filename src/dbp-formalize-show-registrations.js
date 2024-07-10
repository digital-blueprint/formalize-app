import {createInstance} from './i18n.js';
import {css, unsafeCSS, html} from 'lit';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {Icon, IconButton, MiniSpinner, LoadingButton, getIconSVGURL} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit/directives/class-map.js';
import {Activity} from './activity.js';
import {TabulatorFull as Tabulator} from 'tabulator-tables';
import {TabulatorTable} from '@dbp-toolkit/tabulator-table';
import MicroModal from './micromodal.es';
import {name as pkgName} from './../package.json';
import * as fileHandlingStyles from './styles';
import * as tabulatorStyles from './tabulator-table-styles';
import metadata from './dbp-formalize-show-registrations.metadata.json';
import xss from 'xss';
import {send} from '@dbp-toolkit/common/notification';
import {getStackTrace} from '@dbp-toolkit/common/error';


/**
 * Imports xlsx plugin
 *
 * @returns {object} xlsx
 */
async function importXLSX() {
    return await import('xlsx');
}


/**
 * Imports jsPDF and include jspdf-autotable plugin
 *
 * @returns {object} jspdf
 */
async function importJsPDF() {
    let jspdf = await import('jspdf');
    let autotable = await import('jspdf-autotable');
    autotable.applyPlugin(jspdf.jsPDF);
    return jspdf;
}


class ShowRegistrations extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.auth = {};
        this.entryPointUrl = '';
        this.activity = new Activity(metadata);
        this.coursesTable = null;
        this.forms = null;
        this.submissionsTable = null;
        this.showSubmissionsTable = false;
        this.submissionsColumnsInitial = [];
        this.submissionsColumns = [];
        this.submissionsColumnsTmp = [];
        this.submissionsColumnsUpdated = false;
        this.initateOpenAdditionalMenu = false;
        this.initateOpenAdditionalSearchMenu = false;
        this.boundCloseAdditionalMenuHandler = this.hideAdditionalMenu.bind(this);
        this.boundCloseAdditionalSearchMenuHandler = this.hideAdditionalSearchMenu.bind(this);
        this.boundPressEnterAndSubmitSearchHandler = this.pressEnterAndSubmitSearch.bind(this);
        this.navigateBetweenDetailedSubmissionsHandler = this.navigateBetweenDetailedSubmissions.bind(this);
        this.activeCourse = '';
        this.currentRow = null;
        this.currentBeautyId = 0;
        this.totalNumberOfItems = 0;
        this.isPrevEnabled = false;
        this.isNextEnabled = false;
        this.storeSession = true;
        this.loadingCourseTable = false;
        this.loadingSubmissionTable = false;
        this.dataLoaded = false;
        this.modalContentHeight = 0;
        this.loadCourses = true;
        this.hasPermissions = true;
        this.hiddenColumns = false;
        this.currentDetailPosition = 0;
        this.openPage = 0;
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-icon-button': IconButton,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
            'dbp-tabulator-table': TabulatorTable,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            auth: {type: Object},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            coursesTable: {type: Object, attribute: false},
            forms: {type: Array, attribute: false},
            submissionsTable: {type: Object, attribute: false},
            showSubmissionsTable: {type: Boolean, attribute: false},
            submissionsColumns: {type: Array, attribute: false},
            submissionsColumnsUpdated: {type: Boolean, attribute: false},
            isPrevEnabled: {type: Boolean, attribute: false},
            isNextEnabled: {type: Boolean, attribute: false},
            currentBeautyId: {type: Number, attribute: false},
            totalNumberOfItems: {type: Number, attribute: false},
            loadingCourseTable: {type: Boolean, attribute: false},
            loadingSubmissionTable: {type: Boolean, attribute: false},
            modalContentHeight: {type: Number, attribute: false},
            loadCourses: {type: Boolean, attribute: false},
            hasPermissions: {type: Boolean, attribute: false},
            hiddenColumns: {type: Boolean, attribute: false}
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.submissionsTable.off('dataProcesseds');
        this.submissionsTable.off('pageLoaded');
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
        super.connectedCallback();
        const i18n = this._i18n;
        this._loginStatus = '';
        this._loginState = [];

        this.updateComplete.then(() => {
            const that = this;
            // see: http://tabulator.info/docs/5.1
            this._a('.tabulator-table-demo').forEach((table) => {
                table.buildTable();
            });

            this.coursesTable = new Tabulator(this._('#courses-table'), {
                layout: 'fitColumns',
                selectableRows: false,
                placeholder: i18n.t('show-registrations.no-data'),
                pagination: true,
                paginationMode: 'local',
                paginationSize: 10,
                paginationSizeSelector: true,
                locale: true,
                columnDefaults: {
                    vertAlign: 'middle',
                    resizable: false
                },
                columns: [
                    {
                        title: 'ID',
                        field: 'id',
                        widthGrow: 1,
                        maxWidth: 50,
                    },
                    {
                        title: 'Name',
                        field: 'name',
                        widthGrow: 2,
                    },
                    {
                        title: i18n.t('show-registrations.date'),
                        field: 'date',
                        widthGrow: 2,
                        formatter: function (cell, formatterParams, onRendered) {
                            return that.humanReadableDate(cell.getValue());
                        },
                        visible: false,
                    },
                    {
                        title: '',
                        maxWidth: 45,
                        field: 'actionButton',
                        formatter: 'html',
                        headerSort: false,
                    }
                ],
                langs: {
                    'en': {
                        'pagination': {
                            'page_size': 'Page size',
                            'page_size_title': 'Page size',
                            'first': '<span class="mobile-hidden">First</span>',
                            'first_title': 'First Page',
                            'last': '<span class="mobile-hidden">Last</span>',
                            'last_title': 'Last Page',
                            'prev': '<span class="mobile-hidden">Prev</span>',
                            'prev_title': 'Prev Page',
                            'next': '<span class="mobile-hidden">Next</span>',
                            'next_title': 'Next Page'
                        }
                    },
                    'de': {
                        'pagination': {
                            'page_size': 'Einträge pro Seite',
                            'page_size_title': 'Einträge pro Seite',
                            'first': '<span class="mobile-hidden">Erste</span>',
                            'first_title': 'Erste Seite',
                            'last': '<span class="mobile-hidden">Letzte</span>',
                            'last_title': 'Letzte Seite',
                            'prev': '<span class="mobile-hidden">Vorherige</span>',
                            'prev_title': 'Vorherige Seite',
                            'next': '<span class="mobile-hidden">Nächste</span>',
                            'next_title': 'Nächste Seite'
                        }
                    }
                }
            });

            this.coursesTable.on('rowClick', async (event, row) => {
                // Make the whole row clickable by triggering a click on the courses button.
                const clickedCell = /** @type {HTMLElement} */ (event.target);
                const clickedRow = clickedCell.closest('.tabulator-row');
                const buttonToClick = /** @type {HTMLElement} */ (clickedRow.querySelector('dbp-button.courses-btn'));
                if (buttonToClick) {
                    buttonToClick.click();
                }
                event.stopPropagation();
            });

            const actionsButtons = (cell, formatterParams) => {
                let id = cell.getData()['id'];
                let btn = this.createScopedElement('dbp-icon-button');
                btn.setAttribute('icon-name', 'keyword-research');
                btn.setAttribute('title', i18n.t('show-registrations.open-detailed-view-modal'));
                btn.setAttribute('aria-label', i18n.t('show-registrations.open-detailed-view-modal'));
                btn.setAttribute('id', id);
                btn.classList.add('open-modal-icon');
                btn.addEventListener('click', event => {
                    let row = cell.getRow();
                    let previousPageItems = (this.submissionsTable.getPage() - 1) * this.submissionsTable.getPageSize();
                    let index = previousPageItems + row.getPosition();
                    this.openPage = this.submissionsTable.getPage();
                    this.requestDetailedSubmission(row, row.getData(), index);
                    event.stopPropagation();
                });

                let div = this.createScopedElement('div');
                div.appendChild(btn);
                div.classList.add('actions-buttons');

                return div;
            };

            let customAccessor = (value, data, type, params, column, row) => {
                return this.humanReadableDate(value);
            };

            let paginationElement = this._('.tabulator-paginator');

            this.submissionsTable = new Tabulator(this._('#submissions-table'), {
                layout: 'fitDataFill',
                selectableRows: true,
                selectableRowsPersistence: false,
                placeholder: i18n.t('show-registrations.no-data'),
                columnDefaults: {
                    vertAlign: 'middle',
                    resizable: false
                },
                pagination: true,
                paginationMode: 'local',
                paginationSize: 10,
                paginationSizeSelector: true,
                paginationElement: paginationElement,
                autoColumns: true,
                downloadRowRange: 'selected',
                locale: true,
                langs: {
                    'en': {
                        'columns': {
                            'dateCreated': i18n.t('show-registrations.creation-date', { lng: 'en' }),
                            'firstname': i18n.t('show-registrations.firstname', { lng: 'en' }),
                            'lastname': i18n.t('show-registrations.lastname', { lng: 'en' }),
                        },
                        'pagination': {
                            'page_size': 'Page size',
                            'page_size_title': 'Page size',
                            'first': '<span class="mobile-hidden">First</span>',
                            'first_title': 'First Page',
                            'last': '<span class="mobile-hidden">Last</span>',
                            'last_title': 'Last Page',
                            'prev': '<span class="mobile-hidden">Prev</span>',
                            'prev_title': 'Prev Page',
                            'next': '<span class="mobile-hidden">Next</span>',
                            'next_title': 'Next Page'
                        }
                    },
                    'de': {
                        'columns': {
                           'dateCreated': i18n.t('show-registrations.creation-date', { lng: 'de' }),
                            'firstname': i18n.t('show-registrations.firstname', { lng: 'de' }),
                            'lastname': i18n.t('show-registrations.lastname', { lng: 'de' }),
                        },
                        'pagination': {
                            'page_size': 'Einträge pro Seite',
                            'page_size_title': 'Einträge pro Seite',
                            'first': '<span class="mobile-hidden">Erste</span>',
                            'first_title': 'Erste Seite',
                            'last': '<span class="mobile-hidden">Letzte</span>',
                            'last_title': 'Letzte Seite',
                            'prev': '<span class="mobile-hidden">Vorherige</span>',
                            'prev_title': 'Vorherige Seite',
                            'next': '<span class="mobile-hidden">Nächste</span>',
                            'next_title': 'Nächste Seite'
                        }
                    }
                },
                autoColumnsDefinitions: [
                    {
                        title: '',
                        hozAlign: 'center',
                        field: 'no_display_1',
                        download: false,
                        headerSort: false,
                        visible: true,
                        formatter: actionsButtons,
                        frozen: true
                    },
                    {
                        minWidth: 150,
                        field: 'dateCreated',
                        //title: i18n.t('show-registrations.creation-date'),
                        hozAlign: 'left',
                        sorter: (a, b, aRow, bRow, column, dir, sorterParams) => {
                            const a_timestamp = Date.parse(a);
                            const b_timestamp = Date.parse(b);
                            return a_timestamp - b_timestamp;
                        },
                        formatter: (cell, formatterParams, onRendered) => {
                            return this.humanReadableDate(cell.getValue());
                        },
                        accessorParams: {},
                        accessor: customAccessor
                    },
                    {
                        field: 'id',
                        title: 'ID',
                        download: false,
                        visible: false
                    },
                    {
                        field: 'id_',
                        title: 'ID',
                        hozAlign: 'center',
                        visible: false,
                        download: false
                    }
                ]
            });

            this.submissionsTable.on('dataProcessed', this.dataProcessedSubmissionTableFunction.bind(this));
            this.submissionsTable.on("pageLoaded", function(pageno){
                if (that._('#searchbar')) {
                    setTimeout(function () {
                        that._('#searchbar').scrollIntoView({behavior: 'smooth', block: 'start'});
                    }, 0);
                }
            });
            document.addEventListener('keyup', this.boundPressEnterAndSubmitSearchHandler);

        });
    }


    /**
     * An event function,
     * if we cant load table settings, then update the header list
     *
     */
    dataProcessedSubmissionTableFunction() {
        if (this.submissionsTable !== null) {
            if (!this.getSubmissionTableSettings()) {
                this.updateTableHeaderList();
            }
        }
        console.log("DATALOADED\n");
    }


    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    if (this.coursesTable) {
                        this.coursesTable.setLocale(this.lang);
                    }
                    if (this.submissionsTable) {
                        this.submissionsTable.setLocale(this.lang);
                    }
                    break;
                case 'auth':
                    this._updateAuth();
                    break;
            }
        });

        super.update(changedProperties);
    }

    /**
     * Sends an analytics error event
     *
     * @param category
     * @param action
     * @param information
     * @param responseData
     */
    async sendErrorAnalyticsEvent(category, action, information, responseData = {}) {
        let responseBody = {};
        // Use a clone of responseData to prevent "Failed to execute 'json' on 'Response': body stream already read"
        // after this function, but still a TypeError will occur if .json() was already called before this function
        try {
            responseBody = await responseData.clone().json();
        } catch {
            responseBody = responseData; // got already decoded data
        }

        const data = {
            status: responseData.status || '',
            url: responseData.url || '',
            description: responseBody['hydra:description'] || '',
            errorDetails: responseBody['relay:errorDetails'] || '',
            information: information,
            // get 5 items from the stack trace
            stack: getStackTrace().slice(1, 6)
        };

        this.sendSetPropertyEvent('analytics-event', {
            category: category,
            action: action,
            name: JSON.stringify(data)
        });
    }


    /**
     *  Request a re-render every time isLoggedIn()/isLoading() changes
     */
    _updateAuth() {
        this._loginStatus = this.auth['login-status'];

        let newLoginState = [this.isLoggedIn(), this.isLoading()];
        if (this._loginState.toString() !== newLoginState.toString()) {
            this.requestUpdate();
        }
        this._loginState = newLoginState;
    }


    /**
     * Returns if a person is set in or not
     *
     * @returns {boolean} true or false
     */
    isLoggedIn() {
        return (this.auth.person !== undefined && this.auth.person !== null);
    }

    /**
     * Returns true if a person has successfully logged in
     *
     * @returns {boolean} true or false
     */
    isLoading() {
        if (this._loginStatus === 'logged-out')
            return false;
        return (!this.isLoggedIn() && this.auth.token !== undefined);
    }


    /**
     * Send a fetch to given url with given options
     *
     * @param url
     * @param options
     * @returns {object} response (error or result)
     */
    async httpGetAsync(url, options) {
        let response = await fetch(url, options).then(result => {
            if (!result.ok) throw result;
            return result;
        }).catch(error => {
            return error;
        });

        return response;
    }

    throwSomethingWentWrongNotification() {
        const i18n = this._i18n;

        send({
            summary: i18n.t('show-registrations.something-went-wrong-title'),
            body: i18n.t('show-registrations.something-went-wrong-body'),
            type: 'danger',
            timeout: 5
        });
    }

    /**
     * Gets the list of courses
     *
     * @returns {object} response
     */
    async getListOfAllCourses() {
        const i18n = this._i18n;

        //TODO cache this data
        let dataList = [];
        let response = await this.getAllForms();


        if (!response) {
            this.sendErrorAnalyticsEvent('LoadListOfAllCourses', 'NoResponse', '');
            this.throwSomethingWentWrongNotification();
            return;
        }

        if (response.status !== 200) {
            if (response.status === 403) {
                this.hasPermissions = false;

                this.sendErrorAnalyticsEvent('LoadListOfAllCourses', 'NoPermission', '', response);
                send({
                    summary: i18n.t('show-registrations.load-courses-no-permission-title'),
                    body: i18n.t('show-registrations.load-courses-no-permission-body'),
                    type: 'danger',
                    timeout: 5
                });
                return;
            }
            this.sendErrorAnalyticsEvent('LoadListOfAllCourses', 'SomeWentWrong', '', response);
            this.throwSomethingWentWrongNotification();
            return;
        }

        let data = [];
        try {
            data = await response.json();
        } catch (e) {
            this.sendErrorAnalyticsEvent('LoadListOfAllCourses', 'WrongResponse', e);
            this.throwSomethingWentWrongNotification();
            return;
        }

        if (!data || !data['hydra:member']) {
            this.sendErrorAnalyticsEvent('LoadListOfAllCourses', 'WrongData', '');
            this.throwSomethingWentWrongNotification();
            return;
        }


        let id = 1;
        let courses = [];
        for (let x = 0; x <= data["hydra:member"].length; x++) {

            if (x === data['hydra:member'].length) {
                //this sets the data in the table
                this.coursesTable.setData(dataList);
                this.coursesTable.setLocale(this.lang);
                this.dataLoaded = true;
                return;
            }
            let entry = data['hydra:member'][x];
            try {

                let name = entry['name'];
                let form = entry['identifier'];
                // Load form only one time
                if (!name || courses.length > 0 && courses.includes(name)) {
                    continue;
                }
                let date = entry['dateCreated'];

                // create 'show form' button
                let icon = this.createScopedElement('dbp-icon');
                icon.setAttribute('name', 'chevron-right');
                icon.setAttribute('title', i18n.t('show-registrations.open-forms'));
                let btn = this.createScopedElement('dbp-button');
                btn.classList.add('button', 'courses-btn', 'is-icon');
                btn.addEventListener('click', async event => {
                    this.loadingSubmissionTable = true;
                    await this.requestAllCourseSubmissions(name, form);
                    this.loadingSubmissionTable = false;
                    event.stopPropagation();
                });
                btn.appendChild(icon);

                let div = this.createScopedElement('div');
                div.classList.add('button-wrapper');
                div.appendChild(btn);

                let course = {id: id, name: name, date: date, actionButton: div};
                id++;
                courses.push(name);

                dataList.push(course);
            } catch (e) {
                this.sendErrorAnalyticsEvent('LoadListOfAllCourses', 'ErrorInDataCreation', e);
            }
        }
    }

    /**
     * Gets the list of submissions
     *
     * @returns {object} response
     */
    async getAllSubmissions(form) {
        let response;

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token
            }
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/formalize/submissions?formIdentifier=' + form, options);
        return response;
    }

    async getAllForms() {
        let response;

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token
            }
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/formalize/forms', options);
        return response;
    }

    /**
     * Gets a submission for a given identifier
     *
     * @param identifier
     * @returns {object} response
     */
    async getSubmissionForId(identifier) {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token
            }
        };

        return await this.httpGetAsync(this.entryPointUrl + '/formalize/submissions/' + identifier, options);
    }

    /**
     * Initiate getListOfAllCourses and set Loading
     */
    async requestCourses() {
        if (!this.dataLoaded) {
            this.loadingCourseTable = true;
            await this.getListOfAllCourses();
            this.loadingCourseTable = false;
        }
    }

    /**
     * Gets the list of submissions for a specific course
     *
     * @param {string} name
     */
    async requestAllCourseSubmissions(name, form) {
        const i18n = this._i18n;
        let dataList2 = [];

        let response = await this.getAllSubmissions(form);

        this.submissionsColumns = [];
        this.submissionsColumnsInitial = [];

        if (!response) {
            this.sendErrorAnalyticsEvent('requestAllCourseSubmissions', 'NoResponse', '');
            this.throwSomethingWentWrongNotification();
            return;
        }
        if (response.status !== 200) {
            if (response.status === 403) {
                this.hasPermissions = false;
                this.sendErrorAnalyticsEvent('requestAllCourseSubmissions', 'NoPermission', '', response);
                send({
                    summary: i18n.t('show-registrations.load-courses-no-permission-title'),
                    body: i18n.t('show-registrations.load-courses-no-permission-body'),
                    type: 'danger',
                    timeout: 5
                });
                return;
            }
            this.sendErrorAnalyticsEvent('requestAllCourseSubmissions', 'NoResponse', '', response);
            this.throwSomethingWentWrongNotification();
            return;
        }

        let data = [];
        try {
            data = await response.json();
        } catch (e) {
            this.sendErrorAnalyticsEvent('requestAllCourseSubmissions', 'WrongResponse', e);
            this.throwSomethingWentWrongNotification();
            return;
        }

        if (!data || !data['hydra:member']) {
            this.showSubmissionsTable = true;
            this.sendErrorAnalyticsEvent('requestAllCourseSubmissions', 'WrongData', '');
            this.throwSomethingWentWrongNotification();
            return;
        }

        let itemsCount = 0;
        for (let x = 0; x <= data["hydra:member"].length; x++) {
            if (x === data['hydra:member'].length) {
                this.activeCourse = name;
                this.submissionsTable.setData(dataList2);
                this.submissionsTable.setLocale(this.lang);
                this.setInitalSubmissionTableOrder();
                this.updateSubmissionTable();
                this.showSubmissionsTable = true;
                this.totalNumberOfItems = this.submissionsTable.getDataCount("active");
                const that = this;
                setTimeout(function() {
                    if (that._('.subheadline')) {
                      //  that._('.subheadline').scrollIntoView({behavior: 'smooth', block: 'start'});
                    }
                }, 10);
                return;
            }
            let entry = data['hydra:member'][x];
            let id = entry['@id'].split('/')[3];
            let date = entry['dateCreated'];

            try {
                let json = JSON.parse(entry['dataFeedElement']);

                let jsonFirst = {};
                jsonFirst['id'] = id;
                jsonFirst['no_display_1'] = '';
                jsonFirst['id_'] = itemsCount + 1;
                jsonFirst['dateCreated'] = date;
                json = Object.assign(jsonFirst, json);
                dataList2.push(json);
                itemsCount++;
            } catch (e) {
                this.sendErrorAnalyticsEvent('LoadListOfAllCourses', 'ErrorInDataCreation', e);
            }


        }
    }

    /**
     * Gets the detaildata of a specific row
     *
     * @param row
     * @param data
     */
    requestDetailedSubmission(row, data, pos) {

        if (!this._('.detailed-submission-modal-content-wrapper') || !this._('#apply-col-settings'))
            return;
        this._('.detailed-submission-modal-content-wrapper').innerHTML = '';

        let columns = [];

        if (!this._('#apply-col-settings').checked) {
            columns = this.submissionsColumnsInitial;
        } else {
            columns = this.submissionsColumns;
        }

        for(const col of columns) {
            let field = col.field;
            let name = col.name === '' ? field : col.name;
            let cell = row.getCell(field);
            if (!cell || !col.visibility) {
                continue;
            }


            this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-left'>` + xss(name) + `:</div>`;

            if (field.includes('dateCreated')) {
                this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-right'>` + this.humanReadableDate(cell.getValue());
            } else {
                this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-right'>` + xss(cell.getValue()) + `</div>`;
            }
        }

        if (this._('.detailed-submission-modal-content-wrapper > div:first-child'))
            this._('.detailed-submission-modal-content-wrapper > div:first-child').classList.add('first');
        if (this._('.detailed-submission-modal-content-wrapper > div:nth-child(2)'))
            this._('.detailed-submission-modal-content-wrapper > div:nth-child(2)').classList.add('first');

        this.currentRow = row;
        this.currentDetailPosition = row.getPosition();
        this.currentBeautyId = pos;
        this.isPrevEnabled = pos !== 1;
        this.isNextEnabled = (pos + 1) <= this.submissionsTable.getDataCount("active");

        this.showDetailedModal();

        this.modalContentHeight = this._('#detailed-submission-modal-box > .modal-header').offsetHeight +
            this._('#detailed-submission-modal-box > .modal-footer').offsetHeight;
        this._('.detailed-submission-modal-content-wrapper').setAttribute('style', 'max-height: calc(100vH - ' + this.modalContentHeight + 'px);');
    }

    /**
     * Export the specific table
     *
     * @param e
     */
    async exportSubmissionTable(e) {
        let exportInput = this._('#export-select');
        if (!exportInput)
            return;

        let exportValue = exportInput.value;

        if (!exportValue || exportValue === '')
            return;

        if (e)
            e.stopPropagation();

        switch (exportValue) {
            case 'csv':
                this.exportCSV();
                break;
            case 'pdf':
                this.exportPdf();
                break;
            case 'excel':
                this.exportXLSX();
                break;
            default:
                break;
        }

        exportInput.value = '-';
    }

    /**
     * Export submissionTable data as CSV
     *
     */
    async exportCSV() {
        console.log('export csv');
        let selected = this.submissionsTable.getSelectedRows().length;
        let all = 'selected';
        if (selected === 0) {
            all = 'active';
        }
        this.submissionsTable.download('csv', this.activeCourse + '.csv', {}, all);
    }

    /**
     * Get color of a css var
     *
     * @param {string} cssVar
     * @returns {string} color
     */
    getColorFromCssVar(cssVar) {
        const docStyle = getComputedStyle(this);
        let color = docStyle.getPropertyValue(cssVar);
        if (color.includes('white')) {
            return '#ffffff';
        }

        if (color.includes('black')) {
            return '#000000';
        }

        return color.trim();
    }

    /**
     * Imports JsPdf,
     * Exports submissionTable data as PDF
     * Delets JsPdf Plugin
     *
     */
    async exportPdf() {
        let selected = this.submissionsTable.getSelectedRows().length;
        let all = 'selected';
        if (selected === 0) {
            all = 'active';
        }

        let headerBackground = this.getColorFromCssVar('--dbp-primary-surface');
        let headerContent = this.getColorFromCssVar('--dbp-on-primary-surface');
        if (!headerBackground || !headerContent) {
            headerBackground = '#000000';
            headerContent = '#ffffff';
        }

        window.jspdf = await importJsPDF();
        this.submissionsTable.download('pdf', this.activeCourse + '.pdf', {
            title: this.activeCourse,
            autoTable: { //advanced table styling
                theme: 'grid',
                styles: {
                    fontSize: 8
                },
                headStyles: {
                    Color: headerContent,
                    fillColor: headerBackground
                },
                margin: {top: 60},
                pageBreak: 'auto'
            }
        }, all);
        delete window.jspdf;
    }

    /**
     * import xlsx plgin
     * Export submissionTable data as Excel
     * delete xlsx plugin
     *
     */
    async exportXLSX() {
        console.log('export xlsx');

        window.XLSX = await importXLSX();

        let selected = this.submissionsTable.getSelectedRows().length;
        let all = 'selected';
        if (selected === 0) {
            all = 'active';
        }
        this.submissionsTable.download('xlsx', this.activeCourse + '.xlsx', {sheetName: this.activeCourse}, all);

        delete window.XLSX;
    }

    /**
     * Function for filtering table
     *
     */
    filterTable() {
        let filter = this._('#searchbar');
        let search = this._('#search-select');
        let operator = this._('#search-operator');

        if (!filter || !search || !operator || !this.submissionsTable)
            return;

        if (filter.value === "") {
            this.submissionsTable.clearFilter();
            this.totalNumberOfItems = this.submissionsTable.getDataCount("active");
            return;
        }
        filter = filter.value;
        search = search.value;
        operator = operator.value;

        if (search !== 'all') {
            this.submissionsTable.setFilter(search, operator, filter);
            return;
        }

        let filterArray = [];
        this.submissionsColumns.forEach(col => {
            filterArray.push({field: col.field, type: operator, value: filter});
        });
        this.submissionsTable.setFilter([filterArray]);
        this.totalNumberOfItems = this.submissionsTable.getDataCount("active");
    }

    /*
     * Clear Filer
     */
    clearFilter() {
        let filter = this._('#searchbar');
        let search = this._('#search-select');

        if (!filter || !search || !this.submissionsTable)
            return;

        filter.value = '';
        search.value = 'all';
        this.submissionsTable.clearFilter();
        this.totalNumberOfItems = this.submissionsTable.getDataCount("active");
    }

    /**
     * Updates the this.submissionColumns Array based on the actual columns of the this.submissionTable
     *
     */
    updateTableHeaderList() {
        if (!this.submissionsTable)
            return;
        let columns = this.submissionsTable.getColumns();
        this.submissionsColumns = [];
        columns.forEach((col) => {
            let name = col.getDefinition().title;
            let field = col.getDefinition().field;
            let visibility = col.isVisible();
            if (field && !field.includes('no_display') && field !== 'id' && field !== 'id_') {
                this.submissionsColumns.push({name: name, field: field, visibility: visibility});
            }
        });
    }

    /**
     * Creates options for a select box of the t
     * this.submissionColumns Array (all possible cols of active table)
     *
     * @returns {Array<html>} options
     */
    getTableHeaderOptions() {
        if (!this.submissionsTable)
            return [];
        const i18n = this._i18n;
        let options = [];
        options[0] = html`
            <option value='all'>${i18n.t('show-registrations.all-columns')}</option>`;
        this.submissionsColumns.forEach((col, counter) => {
            if (!col.visibility) {
                options[counter + 1] = html`
                    <option disabled value='${col.field}'>${col.name}</option>`;
            } else {
                options[counter + 1] = html`
                    <option value='${col.field}'>${col.name}</option>`;
            }
        });
        return options;
    }

    /**
     * Opens submission Columns Modal
     *
     */
    openColumnOptionsModal() {

        this.submissionsColumnsTmp =  JSON.parse(JSON.stringify(this.submissionsColumns));

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
            if (this._('.detailed-submission-modal-content-wrapper'))
                this._('.detailed-submission-modal-content-wrapper').removeAttribute('style');
            if (this.submissionsTable && this.openPage <= this.submissionsTable.getPageMax()) {
                this.submissionsTable.setPage(this.openPage);
            }
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
                onClose: () => {document.removeEventListener('keydown', this.navigateBetweenDetailedSubmissionsHandler);},
                onShow: () => {document.addEventListener('keydown', this.navigateBetweenDetailedSubmissionsHandler);}
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
            let backBtn = this._('#detailed-submission-modal-box .back-btn');
            if (backBtn && !backBtn.disabled)
            {
                this.showEntryOfPos(this.currentDetailPosition - 1, "previous");
            }
        }

        //right
        if (event.keyCode === 39) {
            //and modal is open and left is not disabled
            let nextBtn = this._('#detailed-submission-modal-box .next-btn');
            if (nextBtn && !nextBtn.disabled)
            {
                this.showEntryOfPos(this.currentDetailPosition + 1, "next");
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

        if (menu === null) {
            return;
        }

        menu.classList.remove('hidden');

        if (!menu.classList.contains('hidden')) {
            // add event listener for clicking outside of menu
            document.addEventListener('click', this.boundCloseAdditionalSearchMenuHandler);
            this.initateOpenAdditionalSearchMenu = true;
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

        if (e.type !== 'keyup' && e.keyCode !== 13
            && (e.originalTarget && e.originalTarget.parentElement
                && (e.originalTarget.parentElement.classList.contains('extended-menu') ||
                    e.originalTarget.parentElement.id === 'search-operator' ||
                    e.originalTarget.parentElement.id === 'search-operator' ||
                    e.originalTarget.parentElement.id === 'search-select')
                || e.originalTarget && e.originalTarget.id === 'searchbar-menu'
                || e.originalTarget && e.originalTarget.id === 'searchbar')) {
            return;
        }

        const menu = this._('#extendable-searchbar .extended-menu');
        if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
            document.removeEventListener('click', this.boundCloseAdditionalSearchMenuHandler);
        }
    }

    /**
     * Toggle visibility of an item
     *
     * @param {object} item
     */
    changeVisibility(item) {
        const i18n = this._i18n;
        item.visibility = !item.visibility;
        if (item.visibility) {
            this._('.' + item.field + ' .header-visibility-icon').setAttribute('icon-name', 'source_icons_eye-empty');
            this._('.' + item.field + ' .header-visibility-icon').setAttribute('title', `${i18n.t('show-registrations.change-visability-off')}`);
            this._('.' + item.field + ' .header-visibility-icon').setAttribute('aria-label', `${i18n.t('show-registrations.change-visability-off')}`);
        } else {
            this._('.' + item.field + ' .header-visibility-icon').setAttribute('icon-name', 'source_icons_eye-off');
            this._('.' + item.field + ' .header-visibility-icon').setAttribute('title', `${i18n.t('show-registrations.change-visability-on')}`);
            this._('.' + item.field + ' .header-visibility-icon').setAttribute('aria-label', `${i18n.t('show-registrations.change-visability-on')}`);
        }
        this.submissionsColumnsUpdated = !this.submissionsColumnsUpdated;
    }

    /**
     * Update Submission Table (order and visibility)
     *
     */
    updateSubmissionTable() {
        // Add all known colums in the right order
        let newDefs = [];
        let addedFields = [];
        for (let spec of this.submissionsColumns) {
            let col = this.submissionsTable.getColumn(spec.field);
            if (!col) {
                continue;
            }
            addedFields.push(spec.field);
            newDefs.push(col.getDefinition());
        }

        // Append everything we didn't know about
        for (let col of this.submissionsTable.getColumns()) {
            let def = col.getDefinition();
            if (addedFields.indexOf(def.field) === -1) {
                newDefs.push(def);
                addedFields.push(def.field);
            }
        }

        // Replace all columns
        this.submissionsTable.setColumns(newDefs);

        // Set the visibility status
        this.hiddenColumns = false;
        for (let spec of this.submissionsColumns) {
            let col = this.submissionsTable.getColumn(spec.field);
            if (!col) {
                continue;
            }
            if (spec.visibility) {
                col.show();
            } else {
                col.hide();
                this.hiddenColumns = true;
            }
        }
    }

    setInitalSubmissionTableOrder() {
        if (!this.submissionsTable)
            return;
        let columns = this.submissionsTable.getColumns();
        this.submissionsColumnsInitial = [];
        columns.forEach((col) => {
            let name = col.getDefinition().title;
            let field = col.getDefinition().field;
            let visibility = col.isVisible();
            if (field && !field.includes('no_display') && field !== 'id' && field !== 'id_') {
                this.submissionsColumnsInitial.push({name: name, field: field, visibility: visibility});
            }
        });
    }

    /**
     * Gets stored submission table settings from localStorage
     *
     * @returns {boolean} success
     */
    getSubmissionTableSettings() {
        if (
            this.storeSession &&
            this.isLoggedIn()
        ) {

            let optionsString = localStorage.getItem('dbp-formalize-tableoptions-' + this.activeCourse + '-' + this.auth['person-id']);
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
                this.submissionsColumns = [];
                console.log(e);
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
        if (
            this.storeSession &&
            this.isLoggedIn()
        ) {
            const publicId = this.auth['person-id'];
            localStorage.setItem('dbp-formalize-tableoptions-' + this.activeCourse + '-' + publicId, JSON.stringify(this.submissionsColumns));
        }
    }

    /**
     * Moves a header in this.submissionColumns Array and in DOM up
     *
     * @param {object} i
     */
    moveHeaderUp(i) {
        let elem = this._('.' + i.field);
        let elemIndex = elem.getAttribute('data-index');
        if (parseInt(elemIndex) === 0)
            return;

        let swapElem = this.submissionsColumns.find((col, index) => {

            return index + 1 <= this.submissionsColumns.length && this.submissionsColumns[index + 1].field === i.field;

        });
        this.swapHeader(swapElem, elemIndex, i);
    }

    /**
     * Moves a header in this.submissionColumns Array and in DOM up
     *
     * @param {object} i
     */
    moveHeaderDown(i) {
        let elem = this._('.' + i.field);
        let elemIndex = elem.getAttribute('data-index');
        if (parseInt(elemIndex) === this.submissionsColumns.length - 1)
            return;

        let swapElem = this.submissionsColumns.find((col, index) => {

            return index - 1 >= 0 && this.submissionsColumns[index - 1].field === i.field;


        });
        this.swapHeader(swapElem, elemIndex, i);
    }

    /**
     * Swaps two elements in this.submissionColumns Array and in DOM
     *
     * @param {object} swapElem_
     * @param {number} elemIndex
     * @param {object} i
     */
    swapHeader(swapElem_, elemIndex, i) {
        let swapElem = this._('.' + swapElem_.field);
        let swapElemIndex = swapElem.getAttribute('data-index');

        let tmp = this.submissionsColumns[elemIndex];
        this.submissionsColumns[elemIndex] = this.submissionsColumns[swapElemIndex];
        this.submissionsColumns[swapElemIndex] = tmp;

        this.submissionsColumnsUpdated = !this.submissionsColumnsUpdated;

        let swapElem2 = this._('.' + swapElem_.field);

        function removeClass() {
            swapElem2.classList.remove('move-up');
        }

        function addClass() {
            swapElem2.classList.add('move-up');

        }

        setTimeout(addClass.bind(swapElem2), 0);

        setTimeout(removeClass.bind(swapElem2), 400);
    }


    /**
     * Shows entry of a specific position of this.submissionTable
     *
     * @param {number} positionToShow
     * @param {"next"|"previous"} direction
     */
    async showEntryOfPos(positionToShow, direction) {
        if (!this.submissionsTable)
            return;

        let pageSize = this.submissionsTable.getPageSize();
        let previousPageItems = (this.submissionsTable.getPage() - 1) * pageSize;
        let nextIndex = previousPageItems + positionToShow;

        if (nextIndex > this.totalNumberOfItems || nextIndex < 1)
            return;

        let nextRow;
        if (positionToShow > 0 && positionToShow <= pageSize)
            nextRow = this.submissionsTable.getRowFromPosition(positionToShow);

        if (nextRow) {
            this.requestDetailedSubmission(nextRow._row, nextRow.getData(), nextIndex);
        } else {
            switch(direction){
                case "next":
                    await this.submissionsTable.nextPage();
                    this.showEntryOfPos(1);
                    break;

                case "previous":
                    await this.submissionsTable.previousPage();
                    this.showEntryOfPos(this.submissionsTable.getPageSize());
                    break;
            }
        }
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
            ${tabulatorStyles.getTabulatorStyles()}

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


            .next-btn dbp-icon, .back-btn dbp-icon {
                height: 15px;
                top: 0px;
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
                padding: 0 20px 0px 20px;
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

            .export-buttons{
                display: flex;
                justify-content: space-between;
                gap: 10px;
            }

            #export-select, #search-select, #search-operator, .dropdown-menu {
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

            .detailed-submission-modal-content-wrapper {
                display: grid;
                grid-template-columns: min-content auto;
                grid-template-rows: auto;
                max-height: calc(100vH - 149px);
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

            .element-left.first, .element-right.first {
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

            #courses-table .tabulator-cell[tabulator-field="actionButton"] {
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
                right: 0px;
                top: 0px;
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
                right: 0px;
                background-color: var(--dbp-background);
                padding: 10px;
                box-sizing: border-box;
                top: 33px;
                margin: 0px;
                border-top: unset;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            #search-select, #search-operator {
                margin-bottom: 10px;
                box-sizing: border-box;
                text-align: left;
            }

            .scrollable-table-wrapper {
                position: relative;
            }

            .frozen-table-divider {
                position: absolute;
                height: calc(100% - 118px);/* table-header + pagination heights + scrollbar: 60px + 51px */
                top: 60px; /* table-header height */
                right: 36px;

                -webkit-box-shadow: -4px 3px 16px -6px var(--dbp-muted);
                box-shadow: -2px 0px 2px 0px var(--dbp-muted);
                background-color: #fff0; /* transparent */
            }

            .headers {
                max-width: 100%;
                margin: 0px;
                list-style-type: none;
                padding: 0px;
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
                top: 0px;
            }

            .header-button.hidden, .extended-menu.hidden {
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

            .first-header .header-move .header-button:first-child, .last-header .header-move .header-button:last-child {
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

            #courses-table .tabulator-row {
                cursor: pointer;
            }

            #submissions-table .tabulator-row {
                cursor: default;
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

            .tabulator .tabulator-tableHolder .tabulator-placeholder span {
                margin-left: 0px;
            }

            #filter-modal-box {
                min-width: 300px;
                min-height: unset;
            }

            #filter-modal-box .modal-footer-btn{
                display: flex;
                justify-content: space-between;
            }

            .button-container {
                text-align: left;
                margin-bottom: 10px;
                padding-left: 30px;
            }

            .checkmark {
                left: 0px;
                height: 20px;
                width: 20px;
            }

            .button-container .checkmark::after {
                left: 8px;
                top: 2px;
            }

            .button.courses-btn{
                font-size: 1.2rem;
                display: flex;
                align-items: center;
                top: 0px;
            }


            @media only screen and (orientation: portrait) and (max-width: 768px) {

                .mobile-hidden {
                    display: none;
                }

                button[data-page="prev"], button[data-page="next"], button[data-page="first"], button[data-page="last"] {
                    display: block;
                    white-space: nowrap !important;
                    overflow: hidden;
                    line-height: 0;
                }

                button[data-page="prev"]:after, button[data-page="next"]:after, button[data-page="first"]:after, button[data-page="last"]:after {
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

                .tabulator .tabulator-footer .tabulator-paginator .tabulator-page{
                    border: none;
                }

                button[data-page="prev"]:after {
                    -webkit-mask-image: url("${unsafeCSS(
                            getIconSVGURL('chevron-left'))}");
                    mask-image: url("${unsafeCSS(
                            getIconSVGURL('chevron-left'))}");
                }

                button[data-page="next"]:after {
                    -webkit-mask-image: url("${unsafeCSS(
                            getIconSVGURL('chevron-right')
                    )}");
                    mask-image: url("${unsafeCSS(
                            getIconSVGURL('chevron-right')
                    )}");
                }

                button[data-page="first"]:after {
                    content: '\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0';
                    -webkit-mask-image: url("${unsafeCSS(
                            getIconSVGURL('angle-double-left')
                    )}");
                    mask-image: url("${unsafeCSS(
                            getIconSVGURL('angle-double-left')
                    )}");
                }

                button[data-page="last"]:after {
                    content: '\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0';
                    -webkit-mask-image: url("${unsafeCSS(
                            getIconSVGURL('angle-double-right')
                    )}");

                    mask-image: url("${unsafeCSS(
                            getIconSVGURL('angle-double-right')
                    )}");
                }

                .tabulator .tabulator-footer .tabulator-footer-contents .tabulator-paginator .tabulator-pages {
                    display: none;
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
                    display: none;
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
                    right: 12px;
                    border-radius: var(--dbp-border-radius);
                    padding: 0;
                    margin: -2px 0 0 0;
                    min-width: 50vw;
                    right: 0px;
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
                    width: 100%;
                    height: 40px;
                }

                #search-button {
                    position: absolute;
                    right: 0px;
                    top: 0px;
                    height: 40px;
                    box-sizing: border-box;
                }

                .search-wrapper {
                    width: 100%;
                }

                #search-select, #search-operator {
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

                .table-wrapper h3, .table-buttons {
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

                #filter-modal-box, #detailed-submission-modal-box {
                    width: 100%;
                    height: 100%;
                    max-width: 100%;
                }

                #submission-modal-content, #detailed-submission-modal-content {
                    height: 100%;
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
                    top: 0px;
                }

                .button-container {
                    padding-left: 30px;
                }

                #filter-modal-box .modal-footer-btn {
                    flex-direction: column;
                    gap: 5px;
                }

                #filter-modal-box .modal-footer-btn div{
                    display: flex;
                    justify-content: space-between;
                }
            }
        `;
    }
    render() {
        const i18n = this._i18n;
        const tabulatorCss = commonUtils.getAssetURL(
            pkgName,
            'tabulator-tables/css/tabulator.min.css'
        );

        if (this.coursesTable && this.isLoggedIn() && !this.isLoading() && this.loadCourses) {
            this.requestCourses().then(() => {
                this.loadCourses = false;
            });
        }

        return html`
            <link rel='stylesheet' href='${tabulatorCss}' />
            <div class='notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}'>
                ${i18n.t('error-login-message')}
            </div>

            <div class='control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}'>
                <span class='loading'>
                    <dbp-mini-spinner text='${i18n.t('loading-message')}'></dbp-mini-spinner>
                </span>
            </div>

            <div
                class='notification is-danger ${classMap({hidden: this.hasPermissions || !this.isLoggedIn() || this.isLoading()})}'>
                ${i18n.t('error-permission-message')}
            </div>

            <div class='${classMap({hidden: !this.isLoggedIn() || this.isLoading() || !this.hasPermissions})}'>

                <h2>${this.activity.getName(this.lang)}</h2>

                <div>
                    <p class='subheadline'>
                        <slot name='description'>
                            ${this.activity.getDescription(this.lang)}
                        </slot>
                    </p>
                    <slot name='additional-information'></slot>
                </div>


                <div class='control ${classMap({hidden: this.showSubmissionsTable || !this.loadingCourseTable})}'>
                        <span class='loading'>
                            <dbp-mini-spinner text='${i18n.t('loading-message')}'></dbp-mini-spinner>
                        </span>
                </div>
                <div
                    class='table-wrapper ${classMap({hidden: this.showSubmissionsTable || this.loadingCourseTable || this.loadingSubmissionTable})}'
                    <table id='courses-table'></table>
                </div>


                <div class='control ${classMap({hidden: !this.loadingSubmissionTable})}'>
                        <span class='loading'>
                            <dbp-mini-spinner text='${i18n.t('loading-message')}'></dbp-mini-spinner>
                        </span>
                </div>

                <div
                    class='table-wrapper submissions${classMap({hideWithoutDisplay: !this.showSubmissionsTable || this.loadingSubmissionTable})}'>
                    <span class='back-navigation ${classMap({hidden: !this.showSubmissionsTable})}'>
                       <a @click='${() => {
                            this.loadingCourseTable = true;
                            this.showSubmissionsTable = false;
                            this.submissionsColumns = [];
                            this.clearFilter();
                            this.submissionsTable.setData([{id: 1}]);
                            this.submissionsTable.clearData();
                            this.loadingCourseTable = false;
                        }}'
                        title='${i18n.t('show-registrations.back-text')}'>
                        <dbp-icon name='chevron-left'></dbp-icon>${i18n.t('show-registrations.back-text')}
                       </a>
                    </span>
                    <div class='table-header submissions'>
                        <h3>${this.activeCourse}</h3>
                        <div class='options-nav ${classMap({hidden: !this.showSubmissionsTable})}'>
                            <div class='additional-menu ${classMap({hidden: !this.showSubmissionsTable})}'>
                                <a class='extended-menu-link'
                                    @click='${() => {
                                        this.toggleMoreMenu();
                                    }}'
                                    title='${i18n.t('show-registrations.more-menu')}'>
                                    <dbp-icon name='menu-dots' class='more-menu'></dbp-icon>
                                </a>


                                <ul class='extended-menu hidden'>
                                    <li class='open-menu ${classMap({active: false})}'>
                                        <a class='' @click='${() => {
                                            this.exportCSV();
                                        }}'>
                                            CSV Export
                                        </a>
                                    </li>
                                    <li class='open-menu ${classMap({active: false})}'>
                                        <a class='' @click='${() => {
                                            this.exportXLSX();
                                        }}'>
                                            Excel Export
                                        </a>
                                    </li>
                                    <li class='open-menu ${classMap({active: false})}'>
                                        <a class='' @click='${() => {
                                            this.exportPdf();
                                        }}'>
                                            PDF Export
                                        </a>
                                    </li>
                                    <li class='${classMap({active: false})}'>
                                        <a class='' @click='${this.openColumnOptionsModal}'>
                                            ${i18n.t('show-registrations.filter-options-button-text')}
                                        </a>
                                    </li>

                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class='table-buttons'>
                        <div class='search-wrapper'>
                            <div id='extendable-searchbar'>
                                <input type='text' id='searchbar'
                                    placeholder='${i18n.t('show-registrations.searchbar-placeholder')}'
                                    @click='${() => {
                                        this.toggleSearchMenu();
                                    }}' />
                                <dbp-icon-button class='button is-icon' id='search-button'
                                    title='${i18n.t('show-registrations.search-button')}'
                                    aria-label='${i18n.t('show-registrations.search-button')}'
                                    icon-name="search"
                                    @click='${() => {
                                        this.filterTable();
                                    }}'></dbp-icon-button>
                                <ul class='extended-menu hidden' id='searchbar-menu'>
                                    <label for='search-select'>${i18n.t('show-registrations.search-in')}:</label>
                                    <select id='search-select' class='button dropdown-menu'
                                            title='${i18n.t('show-registrations.search-in-column')}:'>
                                        ${this.getTableHeaderOptions()}
                                    </select>

                                    <label for='search-operator'>${i18n.t('show-registrations.search-operator')}
                                        :</label>
                                    <select id='search-operator' class='button dropdown-menu'>
                                        <option value='like'>${i18n.t('show-registrations.search-operator-like')}
                                        </option>
                                        <option value='='>${i18n.t('show-registrations.search-operator-equal')}</option>
                                        <option value='!='>${i18n.t('show-registrations.search-operator-notequal')}
                                        </option>
                                        <option value='starts'>${i18n.t('show-registrations.search-operator-starts')}
                                        </option>
                                        <option value='ends'>${i18n.t('show-registrations.search-operator-ends')}
                                        </option>
                                        <option value='<'>${i18n.t('show-registrations.search-operator-less')}</option>
                                        <option value='<='>
                                            ${i18n.t('show-registrations.search-operator-lessthanorequal')}
                                        </option>
                                        <option value='>'>${i18n.t('show-registrations.search-operator-greater')}
                                        </option>
                                        <option value='>='>
                                            ${i18n.t('show-registrations.search-operator-greaterorequal')}
                                        </option>
                                        <option value='regex'>${i18n.t('show-registrations.search-operator-regex')}
                                        </option>
                                        <option value='keywords'>
                                            ${i18n.t('show-registrations.search-operator-keywords')}
                                        </option>
                                    </select>
                                </ul>
                            </div>


                        </div>
                        <div class='export-buttons'>
                            <dbp-icon-button title='${i18n.t('show-registrations.filter-options-button-text')}'
                                aria-label='${i18n.t('show-registrations.filter-options-button-text')}'
                                icon-name='iconoir_settings'
                                @click='${() => {this.openColumnOptionsModal(); }}'></dbp-icon-button>
                            <select id='export-select' class='dropdown-menu' @change='${this.exportSubmissionTable}'>
                                <option value='-' disabled selected>
                                    ${i18n.t('show-registrations.default-export-select')}
                                </option>
                                <option value='csv'>CSV</option>
                                <option value='excel'>Excel</option>
                                <option value='pdf'>PDF</option>
                            </select>

                        </div>
                    </div>
                    <div class='scrollable-table-wrapper'>
                        <table id='submissions-table'></table>
                        <div class='frozen-table-divider'></div>
                        <div class='tabulator' id='custom-pagination'>
                            <div class='tabulator-footer'>
                                <div class='tabulator-footer-contents'>
                                    <span class='tabulator-paginator'></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class='modal micromodal-slide' id='column-options-modal' aria-hidden='true'>
                <div class='modal-overlay' tabindex='-2' data-micromodal-close>
                    <div
                        class='modal-container'
                        id='filter-modal-box'
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby='submission-modal-title'>
                        <header class='modal-header'>
                            <dbp-icon-button
                                title='${i18n.t('show-registrations.modal-close')}'
                                aria-label='${i18n.t('show-registrations.modal-close')}'
                                class='modal-close'
                                icon-name='close'
                                @click='${() => {
                                    this.closeColumnOptionsModal();
                                    this.submissionsColumns = JSON.parse(JSON.stringify(this.submissionsColumnsTmp));
                                }}'></dbp-icon-button>
                            <p id='submission-modal-title'>
                                ${i18n.t('show-registrations.header-settings')}
                            </p>
                        </header>
                        <main class='modal-content' id='submission-modal-content'>
                            <ul class='headers'>
                                ${this.submissionsColumns.map((i, counter) => {
                                        let classes = '';
                                        classes += counter === 0 ? 'first-header ' : '';
                                        classes += counter === this.submissionsColumns.length - 1 ? 'last-header ' : '';
                                        classes += i.field;
                                        return html`
                                        <li class='header-fields ${classes}' data-index='${counter}'>
                                            <div class='header-field'>
                                                <span class='header-button header-order'>${counter + 1}</span>
                                                <span class='header-title'><strong>${i.name}</strong></span>
                                                <dbp-icon-button class='header-button header-visibility-icon'
                                                    @click='${() => {
                                                        this.changeVisibility(i);
                                                    }}'
                                                    icon-name='source_icons_eye-empty'
                                                    title='${i18n.t('show-registrations.change-visability-off')}'
                                                    aria-label='${i18n.t('show-registrations.change-visability-off')}'></dbp-icon-button>
                                                <span class='header-move'>
                                                    <dbp-icon-button class='header-button'
                                                        @click='${() => {
                                                            this.moveHeaderUp(i);
                                                        }}'
                                                        icon-name='arrow-up'
                                                        title='${i18n.t('show-registrations.move-up')}'
                                                        aria-label='${i18n.t('show-registrations.move-up')}'></dbp-icon-button>
                                                    <dbp-icon-button class='header-button'
                                                        @click='${() => {
                                                            this.moveHeaderDown(i);
                                                        }}'
                                                        icon-name='arrow-down'
                                                        title='${i18n.t('show-registrations.move-down')}'
                                                        aria-label='${i18n.t('show-registrations.move-down')}'></dbp-icon-button>
                                                </span>
                                            </div>
                                        </li>
                                    `;
        })}
                            </ul>
                        </main>
                        <footer class='modal-footer'>

                            <div class='modal-footer-btn'>
                                <div>
                                    <button
                                        title='${i18n.t('show-registrations.abort')}'
                                        class='check-btn button is-secondary'
                                        @click='${() => {
                                            this.closeColumnOptionsModal();
                                            this.submissionsColumns = [];
                                            this.submissionsColumns = JSON.parse(JSON.stringify(this.submissionsColumnsTmp));
                                            this.submissionsColumnsUpdated =  !this.submissionsColumnsUpdated;
                                        }}'>
                                        ${i18n.t('show-registrations.abort')}
                                    </button>
                                    <button
                                        title='${i18n.t('show-registrations.reset-filter')}'
                                        class='check-btn button is-secondary'
                                        @click='${() => {
                                            this.submissionsColumns = [];
                                            this.submissionsColumns = JSON.parse(JSON.stringify(this.submissionsColumnsInitial));
                                            this.submissionsColumnsUpdated =  !this.submissionsColumnsUpdated;
                                        }}'>
                                        ${i18n.t('show-registrations.reset-filter')}
                                    </button>
                                </div>
                                <button class='check-btn button is-primary' id='check' @click='${() => {
                                    this.updateSubmissionTable();
                                    this.closeColumnOptionsModal();
                                    this.setSubmissionTableSettings();
                                }}'>
                                    ${i18n.t('show-registrations.save-columns')}
                                </button>
                            </div>
                        </footer>
                    </div>
                </div>
            </div>

            <div class='modal micromodal-slide' id='detailed-submission-modal' aria-hidden='true'>
                <div class='modal-overlay' tabindex='-2' data-micromodal-close>
                    <div
                        class='modal-container'
                        id='detailed-submission-modal-box'
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby='detailed-submission-modal-title'>
                        <header class='modal-header'>
                            <button
                                title='${i18n.t('show-registrations.modal-close')}'
                                class='modal-close'
                                aria-label='${i18n.t('show-registrations.modal-close')}'
                                @click='${() => {
                                    this.closeDetailModal();
                                }}'>
                                <dbp-icon
                                    title='${i18n.t('show-registrations.modal-close')}'
                                    aria-hidden='true'
                                    name='close'
                                    class='close-icon'></dbp-icon>
                            </button>
                            <h3 id='detailed-submission-modal-title'>
                                ${i18n.t('show-registrations.detailed-submission-dialog-title')}</h3>
                        </header>
                        <main class='modal-content' id='detailed-submission-modal-content'>
                            <div class='detailed-submission-modal-content-wrapper'></div>
                        </main>
                        <footer class='modal-footer'>

                            <div class='modal-footer-btn'>
                                <label class='button-container ${classMap({hidden: !this.hiddenColumns})}'>
                                    ${i18n.t('show-registrations.apply-col-settings')}
                                    <input
                                        type='checkbox'
                                        id='apply-col-settings'
                                        name='apply-col-settings'
                                        @click='${() => {
                                            let previousPageItems = (this.submissionsTable.getPage() - 1) * this.submissionsTable.getPageSize();
                                            let nextIndex = previousPageItems + this.currentRow.getPosition() + 1;
                                            this.requestDetailedSubmission(this.currentRow, this.currentRow.getData(), nextIndex);
                                        }}'
                                        checked />
                                    <span class='checkmark'></span>
                                </label>
                                <div class='btn-row-left'>
                                    <dbp-button class='button back-btn'
                                                title='${i18n.t('show-registrations.last-entry-btn-title')}'
                                                @click='${() => {this.showEntryOfPos(this.currentDetailPosition - 1, "previous");}}'
                                                ?disabled='${!this.isPrevEnabled}'>
                                        <dbp-icon name='chevron-left' aria-hidden='true'></dbp-icon>
                                        ${i18n.t('show-registrations.last-entry-btn-title')}
                                    </dbp-button>
                                    <div>${i18n.t('show-registrations.detailed-submission-dialog-id', {
                                        id: this.currentBeautyId,
                                        nItems: this.totalNumberOfItems
                                    })}
                                    </div>
                                    <dbp-button class='button next-btn'
                                                title='${i18n.t('show-registrations.next-entry-btn-title')}'
                                                @click='${() => {this.showEntryOfPos(this.currentDetailPosition + 1, "next");}}'
                                                ?disabled='${!this.isNextEnabled}'>
                                        ${i18n.t('show-registrations.next-entry-btn-title')}
                                        <dbp-icon name='chevron-right' aria-hidden='true'></dbp-icon>
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
