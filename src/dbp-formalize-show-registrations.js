import {createInstance} from './i18n.js';
import {css, unsafeCSS, html} from 'lit';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {Icon, IconButton, MiniSpinner, LoadingButton, getIconSVGURL} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit/directives/class-map.js';
import {Activity} from './activity.js';
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
        this.allCourses = [];
        this.auth = {};
        this.entryPointUrl = '';
        this.activity = new Activity(metadata);
        this.boundPressEnterAndSubmitSearchHandler = this.pressEnterAndSubmitSearch.bind(this);
        this.submissions = [];
        this.showSubmissionsTable = false;
        this.submissionsColumns = [];
        this.submissionsColumnsFields = [];
        this.initateOpenAdditionalMenu = false;
        this.initateOpenAdditionalSearchMenu = false;
        this.boundCloseAdditionalMenuHandler = this.hideAdditionalMenu.bind(this);
        this.boundCloseAdditionalSearchMenuHandler = this.hideAdditionalSearchMenu.bind(this);
        this.navigateBetweenDetailedSubmissionsHandler = this.navigateBetweenDetailedSubmissions.bind(this);
        this.activeCourse = '';
        this.activeForm = '';
        this.currentRow = null;
        this.currentBeautyId = 0;
        this.totalNumberOfItems = 0;
        this.isPrevEnabled = false;
        this.isNextEnabled = false;
        this.storeSession = true;
        this.loadingCourseTable = false;
        this.loadingSubmissionTable = false;
        this.modalContentHeight = 0;
        this.loadCourses = true;
        this.hasPermissions = true;
        this.hiddenColumns = false;
        this.currentDetailPosition = 0;
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
            allCourses: {type: Array, attribute: false},
            form: {type: String},
            name: {type: String},
            auth: {type: Object},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            forms: {type: Array, attribute: false},
            submissions: {type: Array, attribute: false},
            emptyCoursesTable: {type: Boolean, attribute: true},
            showSubmissionsTable: {type: Boolean, attribute: false},
            submissionsColumns: {type: Array, attribute: false},
            submissionsColumnsFields: {type: Array, attribute: false},
            isPrevEnabled: {type: Boolean, attribute: false},
            isNextEnabled: {type: Boolean, attribute: false},
            currentBeautyId: {type: Number, attribute: false},
            totalNumberOfItems: {type: Number, attribute: false},
            loadingCourseTable: {type: Boolean, attribute: false},
            loadingSubmissionTable: {type: Boolean, attribute: false},
            modalContentHeight: {type: Number, attribute: false},
            loadCourses: {type: Boolean, attribute: true},
            hasPermissions: {type: Boolean, attribute: false},
            hiddenColumns: {type: Boolean, attribute: false}
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
        super.connectedCallback();
        this._loginStatus = '';
        this._loginState = [];

        this.updateComplete.then(() => {
            // see: http://tabulator.info/docs/5.1
            document.addEventListener('keyup', this.boundPressEnterAndSubmitSearchHandler);
            this._a('.tabulator-table').forEach((table) => {
                table.buildTable();
            });
        });
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':

                    this._i18n.changeLanguage(this.lang);

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
                    return;
                }

                for (let x = 0; x < data["hydra:member"].length; x++) {

                    let entry = data['hydra:member'][x];
                    let id = x + 1;
                    let name = entry['name'];
                    let form = entry['identifier'];

                    let icon = this.createScopedElement('dbp-icon');
                    icon.setAttribute('name', 'chevron-right');
                    icon.setAttribute('title', i18n.t('show-registrations.open-forms'));
                    let btn = this.createScopedElement('dbp-button');

                    btn.addEventListener('click', async event => {

                        if(this.activeCourse) {
                            this.deleteSettings();
                        }
                        this.activeCourse = name;
                        this.activeForm = form;
                        this.showSubmissionsTable = true;
                        //console.log('get all settings ', this.getSubmissionTableSettings());
                        //console.log('stored settings ', this.submissionsColumns);
                        //TODO: check what happens to submissions table after logging out
                        this.getAllCourseSubmissions(this.activeForm).then(() => {
                            let table = this._('#tabulator-table-submissions');
                            this.getSubmissionTableSettings();
                            table.setData(this.submissions);

                            if(this.submissions.length === 0) {
                                table.setColumns([]);
                            }
                            else if(this.submissionsColumns.length !== 0) {
                                table.setColumns(this.submissionsColumns);
                            }
                            this.defineSettings();
                        });

                    });

                    btn.appendChild(icon);

                    let div = this.createScopedElement('div');
                    div.classList.add('button-wrapper');
                    div.appendChild(btn);

                    let new_form = {id: id, name: name, actionButton: btn};
                    forms.push(new_form);
                }
                this.allCourses = forms;
            }
        } finally {
            this.loadCourses = false;
        }

    }


    /**
     * Gets the list of submissions for a specific course
     *
     * @param {string} name
     */
    async getAllCourseSubmissions(form) {
        const i18n = this._i18n;
        let response;
        let data = [];
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token
            }
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/formalize/submissions?formIdentifier=' + form, options);

        try {
            data = await response.json();
        } catch (e) {
            this.sendErrorAnalyticsEvent('getAllSubmissions', 'WrongResponse', e);
            this.throwSomethingWentWrongNotification();
            return;
        }
        if(data['hydra:member'].length === 0) {
            this.submissions = [];
            return;
        }

        let firstDateCreated = data['hydra:member'][0]['dateCreated'];
        firstDateCreated = this.humanReadableDate(firstDateCreated);
        let firstDataFeedElement = data['hydra:member'][0]['dataFeedElement'];
        firstDataFeedElement = JSON.parse(firstDataFeedElement);
        let columns = Object.keys(firstDataFeedElement);
        columns.unshift('dateCreated');
        console.log('columns ', columns);
        //this.submissionsColumns = columns;

        let submissions_list = [];
        for (let x = 0; x < data["hydra:member"].length; x++) {
            let dateCreated = data['hydra:member'][x]['dateCreated'];
            dateCreated = this.humanReadableDate(dateCreated);
            let dataFeedElement = data['hydra:member'][x]['dataFeedElement'];
            dataFeedElement = JSON.parse(dataFeedElement);

            let cols = {dateCreated: dateCreated, ...dataFeedElement};
            let id = x + 1;
            //TODO: update details the moment you click on them
            let btn = this.createScopedElement('dbp-icon-button');
            btn.setAttribute('icon-name', 'keyword-research');
            btn.setAttribute('title', i18n.t('show-registrations.open-detailed-view-modal'));
            btn.setAttribute('aria-label', i18n.t('show-registrations.open-detailed-view-modal'));
            btn.setAttribute('id', id);
            btn.classList.add('open-modal-icon');
            btn.addEventListener('click', event => {
                this.requestDetailedSubmission(cols, id);
                event.stopPropagation();
            });

            let div = this.createScopedElement('div');
            div.appendChild(btn);
            div.classList.add('actions-buttons');


            let entry = {dateCreated: dateCreated, ...dataFeedElement, no_display_1: div};

            submissions_list.push(entry);
        };

        this.submissions = submissions_list;
        this.totalNumberOfItems = submissions_list.length;

        return response;
    }

    defineSettings() {
        let table = this._('#tabulator-table-submissions');
        let settings = this._('#submission-modal-content');

        let list = document.createElement('ul');
        list.classList.add('headers');
        let columns = table.getColumns();
        columns.splice(-1, 1);

        columns.map((column, index) => {
            let element = document.createElement("li");
            element.classList.add('header-fields');
            element.classList.add(column.getField());
            element.setAttribute('data-index', index);

            let div = document.createElement('div');
            div.classList.add('header-field');

            let header_order = document.createElement('span');
            header_order.textContent = (index + 1);
            header_order.classList.add('header-button');
            header_order.classList.add('header-order');
            div.appendChild(header_order);

            let header_title = document.createElement('span');
            header_title.innerHTML = '<strong>' + column.getField() + '</strong>';
            header_title.classList.add('header-title');
            div.appendChild(header_title);

            let visibility = this.createScopedElement('dbp-icon-button');
            if(column.isVisible()) {
                visibility.iconName = 'source_icons_eye-empty';
            } else {
                visibility.iconName = 'source_icons_eye-off';
            }

            //visibility.classList.add('header-button');
            visibility.classList.add('header-visibility-icon');


            visibility.addEventListener('click', event => {
                if(visibility.iconName === 'source_icons_eye-empty') {
                    visibility.iconName = 'source_icons_eye-off';
                }
                else {
                    visibility.iconName = 'source_icons_eye-empty';
                }
            });
            div.appendChild(visibility);

            let header_move = document.createElement('span');
            header_move.classList.add('header-move');
            let arrow_up = this.createScopedElement('dbp-icon-button');
            arrow_up.iconName = 'arrow-up';

            if(index === 0) {
                arrow_up.classList.add('first-arrow-up');
            }
            arrow_up.addEventListener('click', event => {
                if(index !== 0) {
                    this.moveHeaderUp(column);
                }

            });


            header_move.appendChild(arrow_up);
            let arrow_down = this.createScopedElement('dbp-icon-button');
            arrow_down.iconName = 'arrow-down';

            if(index === (columns.length - 1)) {
                arrow_down.classList.add('last-arrow-down');
            }

            arrow_down.addEventListener('click', event => {
                if(index !== (columns.length - 1)) {
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

    deleteSettings() {
        let settings = this._('#submission-modal-content');

        let list = settings.children[0];
        settings.removeChild(list);
    }

    resetSettings() {
        let list = this._('.headers');
        list = list.childNodes;
        let table = this._('#tabulator-table-submissions');
        let columns = table.getColumns();
        columns.splice(-1, 1);
        [...list].forEach((element, index) => {
            let header_field = element.children[0];
            let current_title = header_field.children[1].innerText;
            if(current_title !== columns[index].getField()) {
                header_field.children[1].innerHTML = '<strong>' + columns[index].getField() + '</strong>';
            }
            let visibility = header_field.children[2];
            if(visibility.iconName === 'source_icons_eye-off' && columns[index].isVisible()) {
                visibility.iconName = 'source_icons_eye-empty';
            }
            else if(visibility.iconName === 'source_icons_eye-empty' && !columns[index].isVisible()) {
                visibility.iconName = 'source_icons_eye-off';
            }
        });

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

    request

    /**
     * Gets the detaildata of a specific row
     *
     * @param row
     * @param data
     */
    requestDetailedSubmission(columns, pos) {

        if (!this._('.detailed-submission-modal-content-wrapper') || !this._('#apply-col-settings'))
            return;
        this._('.detailed-submission-modal-content-wrapper').innerHTML = '';



        let ordered;
        if(this.submissionsColumns.length !== 0) {
            for (let current_column of this.submissionsColumns) {
                if(columns[current_column.field] !== undefined) {
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-left'>` + xss(current_column.field) + `:</div>`;

                    if (current_column.field === 'dateCreated') {
                        this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-right'>` + this.humanReadableDate(columns[current_column.field]);
                    } else {
                        this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-right'>` + xss(columns[current_column.field]) + `</div>`;
                    }
                }
            }
        }
        else {
            for(const [column, value] of Object.entries(columns)) {
                this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-left'>` + xss(column) + `:</div>`;

                if (column === 'dateCreated') {
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-right'>` + this.humanReadableDate(value);
                } else {
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-right'>` + xss(value) + `</div>`;
                }
            }
        }

        this.currentDetailPosition = pos;
        this.currentBeautyId = pos;
        this.isPrevEnabled = pos !== 1;
        this.isNextEnabled = (pos + 1) <= this.totalNumberOfItems;

        if (this._('.detailed-submission-modal-content-wrapper > div:first-child'))
            this._('.detailed-submission-modal-content-wrapper > div:first-child').classList.add('first');
        if (this._('.detailed-submission-modal-content-wrapper > div:nth-child(2)'))
            this._('.detailed-submission-modal-content-wrapper > div:nth-child(2)').classList.add('first');

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

        let table = this._('#tabulator-table-submissions');
        table.download(exportValue, this.activeCourse);
        exportInput.value = '-';
    }

    /**
     * Function for filtering table
     *
     */
    filterTable() {
        let filter = this._('#searchbar');
        let search = this._('#search-select');
        let operator = this._('#search-operator');

        let table = this._('#tabulator-table-submissions');

        if (!filter || !search || !operator || !table)
            return;

        if (filter.value === "") {
            table.clearFilter();

            return;
        }
        filter = filter.value;
        search = search.value;
        operator = operator.value;



        if(search !== 'all')
        {
            let filter_object = {field: search, type: operator, value: filter};
            table.setFilter([filter_object]);
        }
        else
        {

            const columns = table.getColumnsFields();
            let listOfFilters = [];
            for (let col of columns) {
                let filter_object = {field: col, type: operator, value: filter};
                listOfFilters.push(filter_object);
            }
            table.setFilter([listOfFilters]);
        }

    }

    /*
     * Clear Filer
     */
    clearFilter() {
        let filter = this._('#searchbar');
        let search = this._('#search-select');
        let table = this._('#tabulator-table-submissions');

        if (!filter || !search || !table)
            return;

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

        if(this.submissions.length === 0) {
            return [];
        }
        else
        {
            let options = [];
            options[0] = html`
            <option value='all'>${i18n.t('show-registrations.all-columns')}</option>`;

            let cols = Object.keys(this.submissions[0]);

            for(let [counter, col] of cols.entries()) {
                if(col !== 'no_display_1') {
                    options[counter + 1] = html`
                    <option value='${col}'>${col}</option>`;
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
     * Update Submission Table (order and visibility)
     *
     */
    updateSubmissionTable() {
        //TODO change submissions list, not just current dbp-tabulator
        let list = this._('.headers');
        list = list.childNodes;
        let table = this._('#tabulator-table-submissions');

        let newColumns = [];
        let newColumnNames = [];
        [...list].forEach((element, index) => {
            let header_field = element.children[0];
            let current_title = header_field.children[1].innerText;
            let visibility_icon = header_field.children[2];
            let visibility;
            if(visibility_icon.iconName === 'source_icons_eye-off') {
                visibility = false;
            }
            else if(visibility_icon.iconName === 'source_icons_eye-empty') {
                visibility = true;
            }
            let new_column = {title: current_title, field: current_title, visible: visibility};
            newColumns.push(new_column);
            newColumnNames.push(current_title);
        });
        let columns = table.getColumns();
        let last_column = columns.pop();
        last_column = last_column.getDefinition();
        newColumns.push(last_column);
        table.setColumns(newColumns);
        this.submissionsColumns = newColumns;
        this.submissionsColumnsFields = newColumnNames;
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
                    console.log('options ', options);
                    this.submissionsColumns = [...options];
                    console.log('this.submissionsColumns ', this.submissionsColumns);
                }

            } catch (e) {
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
    moveHeaderUp(column) {

        let list = this._('.headers');
        //console.log('list ', list);
        list = list.childNodes;
        [...list].forEach((item, index) => {
            if(item.classList.contains(column.getField())) {
                let element = item;
                let swapElem = list[index - 1];
                this.swapHeader(element, swapElem);
                return
            }
        });
    }

    /**
     * Moves a header in this.submissionColumns Array and in DOM up
     *
     * @param {object} i
     */
    moveHeaderDown(column) {

        let list = this._('.headers');
        list = list.childNodes;
        [...list].forEach((item, index) => {
            if(item.classList.contains(column.getField())) {
                let element = item;
                let swapElem = list[index + 1];
                this.swapHeader(element, swapElem);
                return
            }
        });
    }

    /**
     * Swaps two elements in this.submissionColumns Array and in DOM
     *
     * @param {object} swapElem_
     * @param {number} elemIndex
     * @param {object} i
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

        if (positionToShow > this.totalNumberOfItems || positionToShow < 1)
            return;

        let table = this._('#tabulator-table-submissions');
        if(!table)
            return;

        let rows = table.getRows();

        let next_row = rows[positionToShow - 1];
        let cells = next_row.getCells();
        let next_data = {};
        for (let cell of cells) {

            let column = cell.getColumn();
            let definition = column.getDefinition();
            if(definition.formatter !== 'html') {
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

            .first-arrow-up, .last-arrow-down {
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

    setTableData() {
        let table = this._('#tabulator-table-forms');
        table.setData(this.allCourses);
    }

    render() {
        const i18n = this._i18n;
        const tabulatorCss = commonUtils.getAssetURL(
            pkgName,
            'tabulator-tables/css/tabulator.min.css'
        );

        if (this.isLoggedIn() && !this.isLoading() && this.loadCourses) {
            this.getListOfAllCourses().then(() => {
                this.setTableData();
            });
        }

        let langs_forms = {
            'en': {
                columns: {
                    'id': i18n.t('id', {lng: 'en'}),
                    'name': i18n.t('name', {lng: 'en'}),
                },
            },
            'de': {
                columns: {
                    'id': i18n.t('id', {lng: 'de'}),
                    'name': i18n.t('name', {lng: 'de'}),
                },
            },
        };

        let options_forms = {
            langs: langs_forms,
            layout: 'fitColumns',
            columns: [
                {field: 'id', width: 150},
                {field: 'name'},
                {field: 'actionButton', formatter:"html"},
            ],
            columnDefaults: {
                vertAlign: 'middle',
                hozAlign: 'left',
                resizable: false,
            },
        };

        let langs = {
            'en': {
                columns: {
                    'name': i18n.t('name', {lng: 'en'}),
                    'age': i18n.t('age', {lng: 'en'}),
                    'col': i18n.t('col', {lng: 'en'}),
                    'dob': i18n.t('dob', {lng: 'en'}),
                },
            },
            'de': {
                columns: {
                    'name': i18n.t('name', {lng: 'de'}),
                    'age': i18n.t('age', {lng: 'de'}),
                    'col': i18n.t('col', {lng: 'de'}),
                    'dob': i18n.t('dob', {lng: 'de'}),
                },
            },
        };

        //TODO: see about empty language

        let auto_langs = {
            'en': {
                columns: {},
            },
            'de': {
                columns: {},
            },
        };

        let auto_columns = {
            langs: auto_langs,
            autoColumns: true,
            layout: 'fitColumns',
            columnDefaults: {
                vertAlign: 'middle',
                hozAlign: 'left',
                resizable: false,
            },
            autoColumnsDefinitions:[
                {field: 'no_display_1', title: '', formatter: 'html', headerSort:false, download:false},
            ],
        };

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
                <!--see about extra arrow column-->
               
                <div class="container ${classMap({hidden: this.showSubmissionsTable})}">
                    <dbp-tabulator-table
                            lang="${this.lang}"
                            class="tabulator-table"
                            id="tabulator-table-forms"
                            pagination-enabled="true"
                            pagination-size="10"
                            options=${JSON.stringify(options_forms)}></dbp-tabulator-table>
                </div>
                    
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
                            this.showSubmissionsTable = false;
                            //this.submissionsColumns = [];
                            //this.clearFilter();
                            this.loadingCourseTable = false;
                        }}'
                        title='${i18n.t('show-registrations.back-text')}'>
                        <dbp-icon name='chevron-left'></dbp-icon>${i18n.t('show-registrations.back-text')}
                       </a>
                    </span>
                    <div class='table-header submissions'>
                        <h3>${this.activeCourse}</h3>
                        
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
                                @click='${() => { this.openColumnOptionsModal(); }}'></dbp-icon-button>
                            <select id='export-select' class='dropdown-menu' @change='${this.exportSubmissionTable}'>
                                <option value='-' disabled selected>
                                    ${i18n.t('show-registrations.default-export-select')}
                                </option>
                                <option value='csv'>CSV</option>
                                <option value='xlsx'>Excel</option>
                                <option value='pdf'>PDF</option>
                            </select>

                        </div>
                    </div>
                </div>
            </div>

            <div class="container ${classMap({hidden: !this.showSubmissionsTable})}">
                <dbp-tabulator-table
                        lang="${this.lang}"
                        class="tabulator-table"
                        id="tabulator-table-submissions"
                        options=${JSON.stringify(auto_columns)}
                        pagination-enabled="true"
                        pagination-size="10"
                        select-rows-enabled
                ></dbp-tabulator-table>
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
                                }}'></dbp-icon-button>
                            <p id='submission-modal-title'>
                                ${i18n.t('show-registrations.header-settings')}
                            </p>
                        </header>
                        <main class='modal-content' id='submission-modal-content'>
                            
                        </main>
                        <footer class='modal-footer'>

                            <div class='modal-footer-btn'>
                                <div>
                                    <button
                                        title='${i18n.t('show-registrations.abort')}'
                                        class='check-btn button is-secondary'
                                        @click='${() => {
                                            this.closeColumnOptionsModal();
                                        }}'>
                                        ${i18n.t('show-registrations.abort')}
                                    </button>
                                    <button
                                        title='${i18n.t('show-registrations.reset-filter')}'
                                        class='check-btn button is-secondary'
                                        @click='${() => {
                                            this.resetSettings();
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
                                            let nextIndex = previousPageItems + this.currentRow.getPosition() + 1;
                                            this.requestDetailedSubmission(this.currentRow, this.currentRow.getData());
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
