import {createInstance} from './i18n.js';
import {css, unsafeCSS, html} from 'lit';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {Icon, MiniSpinner, LoadingButton, getShadowRootDocument, getIconSVGURL} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit/directives/class-map.js';
import {Activity} from './activity.js';
import {Tabulator} from 'tabulator-tables';
import MicroModal from './micromodal.es';
import {name as pkgName} from './../package.json';
import * as fileHandlingStyles from './styles';
import * as tabulatorStyles from './tabulator-table-styles';
import metadata from './dbp-formalize-show-registrations.metadata.json';
import xss from 'xss';

async function importXLSX()
{
    return await import('xlsx');
}

async function importJsPDF()
{
    let jspdf = await import('jspdf');
    let autotable = await import('jspdf-autotable');
    autotable.applyPlugin(jspdf.jsPDF);
    return jspdf.jsPDF;
}

class ShowRegistrations extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.auth = {};
        this.entryPointUrl = '';
        this.activity = new Activity(metadata);
        this.maxSelectedItems = Number.MAX_VALUE;
        this.coursesTable = null;
        this.submissionsTable = null;
        this.showSubmissionsTable = false;
        this.submissionsColumns = [];
        this.submissionsColumnsUpdated = false;
        this.initateOpenAdditionalMenu = false;
        this.initateOpenAdditionalSearchMenu = false;
        this.boundCloseAdditionalMenuHandler = this.hideAdditionalMenu.bind(this);
        this.boundCloseAdditionalSearchMenuHandler = this.hideAdditionalSearchMenu.bind(this);
        this.boundPressEnterAndSubmitSearchHandler = this.pressEnterAndSubmitSearch.bind(this);
        this.boundDataLodaedFunction = this.dataLoadedFunction.bind(this);
        this.activeCourse = '';
        this.autoColumns = true;
        this.currentRow = null;
        this.currentBeautyId = 0;
        this.totalNumberOfItems = 0;
        this.isPrevEnabled = false;
        this.isNextEnabled = false;
        this.storeSession = true;
        this.activeCourseChecked = true;
        this.loadingCourseTable = false;
        this.loadingSubmissionTable = false;
        this.dataLoaded = false;
        this.modalContentHeight = 0;
        this.loadCourses = true;
        this.hasPermissions = true;
        this.hiddenColumns = false;
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
        };
    }

    static get properties() {
        return {
            lang: {type: String},
            auth: { type: Object },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            maxSelectedItems: {type: Number, attribute: 'max-selected-items'},
            coursesTable: { type: Object, attribute: false },
            submissionsTable: { type: Object, attribute: false },
            showSubmissionsTable: { type: Boolean, attribute: false },
            submissionsColumns: { type: Array, attribute: false },
            submissionsColumnsUpdated: { type: Boolean, attribute: false },
            autoColumns: {type: Boolean, attribute: 'auto-columns'},
            isPrevEnabled: { type: Boolean, attribute: false },
            isNextEnabled: { type: Boolean, attribute: false },
            currentBeautyId: { type: Number, attribute: false },
            loadingCourseTable: { type: Boolean, attribute: false },
            loadingSubmissionTable: { type: Boolean, attribute: false },
            modalContentHeight: { type: Number, attribute: false },
            loadCourses: { type: Boolean, attribute: false },
            hasPermissions: { type: Boolean, attribute: false },
            hiddenColumns: { type: Boolean, attribute: false },
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keyup', this.boundPressEnterAndSubmitSearchHandler);
    }

    humanReadableDate(value) {
        const d = Date.parse(value);
        const timestamp = new Date(d);
        const year = timestamp.getFullYear();
        const month = ('0' + (timestamp.getMonth() + 1)).slice(-2);
        const date = ('0' + timestamp.getDate()).slice(-2);
        const hours = ('0' + timestamp.getHours()).slice(-2);
        const minutes = ('0' + timestamp.getMinutes()).slice(-2);
        // return date + '.' + month + '.' + year + ' ' + hours + ':' + minutes;
        return year + '-' + month + '-' + date  + ' ' + hours + ':' + minutes;
    }

    connectedCallback() {
        super.connectedCallback();
        const i18n = this._i18n;
        this._loginStatus = '';
        this._loginState = [];

        this.updateComplete.then(() => {
            const that = this;
            // see: http://tabulator.info/docs/4.7
            this.coursesTable = new Tabulator(this._('#courses-table'), {
                layout: 'fitColumns',
                selectable: false,
                placeholder: i18n.t('show-registrations.no-data'),
                resizableColumns: false,
                pagination:true,
                paginationMode:'local',
                paginationSize: 10,
                locale: true,
                columns: [
                    { 
                        title:"ID",
                        field:"id",
                        widthGrow: 1,
                        maxWidth: 50,
                    },
                    { 
                        title:"Name", 
                        field:"name",
                        widthGrow: 2,
                    },
                    { 
                        title: i18n.t('show-registrations.date'),
                        field:"date",
                        widthGrow: 2,
                        formatter: function (cell, formatterParams, onRendered) {
                            return that.humanReadableDate(cell.getValue());
                        },
                        visible: false,
                    },
                    { 
                        title:"",
                        field:"type",
                        formatter:"html",
                        headerSort: false,
                    },    
                ],
                langs: {
                    "en": {
                        "pagination":{
                            "first":"First", 
                            "first_title":"First Page",
                            "last":"Last",
                            "last_title":"Last Page",
                            "prev":"Prev",
                            "prev_title":"Prev Page",
                            "next":"Next",
                            "next_title":"Next Page",
                        },
                    },
                    "de": {
                        "pagination":{
                            "first":"Erste", 
                            "first_title":"Erste Seite",
                            "last":"Letzte",
                            "last_title":"Letzte Seite",
                            "prev":"Vorherige",
                            "prev_title":"Vorherige Seite",
                            "next":"Nächste",
                            "next_title":"Nächste Seite",
                        },
                    }
                },
                dataLoaded: () => {
                    if (this.coursesTable !== null)
                        this.coursesTable.setLocale(this.lang);
                }
            });

            this.submissionsTable = new Tabulator(this._('#submissions-table'), {
                layout:'fitDataFill',
                selectable: this.maxSelectedItems,
                selectablePersistence:false,
                placeholder: i18n.t('show-registrations.no-data'),
                columnDefaults:{
                    resizable:'header',
                },
                pagination:true,
                paginationMode:'local',
                paginationSize: 10,
                autoColumns: this.autoColumns,
                downloadRowRange: 'selected',
                locale: true,
                langs: {
                    "en": {
                        "pagination":{
                            "first":"First", 
                            "first_title":"First Page",
                            "last":"Last",
                            "last_title":"Last Page",
                            "prev":"Prev",
                            "prev_title":"Prev Page",
                            "next":"Next",
                            "next_title":"Next Page",
                        },
                    },
                    "de": {
                        "pagination":{
                            "first":"Erste", 
                            "first_title":"Erste Seite",
                            "last":"Letzte",
                            "last_title":"Letzte Seite",
                            "prev":"Vorherige",
                            "prev_title":"Vorherige Seite",
                            "next":"Nächste",
                            "next_title":"Nächste Seite",
                        },
                    }
                },
            });

            this.submissionsTable.on("dataLoaded", function(){

            });
            document.addEventListener('keyup', this.boundPressEnterAndSubmitSearchHandler);
        });
    }

    dataLoadedFunction() {
        if (this.submissionsTable !== null) {
            if (!this.getSubmissionTableSettings()) {
                this.updateTableHeaderList();
            }
            this.updateSubmissionTable();
        }
    }

    addToggleEvent() {

        const that = this;
        setTimeout(function () {
            if (that._('.tabulator-responsive-collapse-toggle-open')) {
                that._a('.tabulator-responsive-collapse-toggle-open').forEach(
                    (element) =>
                        element.addEventListener(
                            'click',
                            that.toggleCollapse.bind(that)
                        )
                );
            }

            if (that._('.tabulator-responsive-collapse-toggle-close')) {
                that._a('.tabulator-responsive-collapse-toggle-close').forEach(
                    (element) =>
                        element.addEventListener(
                            'click',
                            that.toggleCollapse.bind(that)
                        )
                );
            }
        }, 0);
    }

    toggleCollapse(e) {
        const table = this.submissionsTable;
        setTimeout(function () {
            table.redraw();
        }, 0);
    }

    async firstUpdated() {
        // Give the browser a chance to paint

        await new Promise((r) => setTimeout(r, 0));

    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    if (this.coursesTable)
                        this.coursesTable.setLocale(this.lang);
                    if (this.submissionsTable) {
                        // Update column translations
                        this.updateSubmissionTable();
                    }
                    break;
                case 'auth':
                    this._updateAuth();
                    break;
            }
        });

        super.update(changedProperties);
    }

    _a(selector) {
        return this.shadowRoot === null
            ? this.querySelectorAll(selector)
            : this.shadowRoot.querySelectorAll(selector);
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
        this.loginCallback();
    }

    loginCallback() {
        if (this.isLoggedIn() && !this.activeCourseChecked && this.storeSession) {
            this.loadActiveCourse();
            this.activeCourseChecked = true;
        }
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
        if (this._loginStatus === "logged-out")
            return false;
        return (!this.isLoggedIn() && this.auth.token !== undefined);
    }

    /**
     * Select or deselect all files from tabulator table
     *
     */
    selectAllSubmissions() {
        let allSelected = this.checkAllSelected();

        if (allSelected) {
            this.submissionsTable.getSelectedRows().forEach((row) => row.deselect());
        } else {
            this.submissionsTable.selectRow(this.submissionsTable.getRows());
        }
    }

    /**
     * 
     * @returns {boolean} true if all items are selected, false otherwise
     */
    checkAllSelected() {
        if (this.submissionsTable) {
            let maxSelected = this.submissionsTable.getRows().length;
            let selected = this.submissionsTable.getSelectedRows().length;
            if (selected === maxSelected) {
                return true;
            }
        }
        return false;
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

    /**
     * Gets the list of courses
     *
     * @returns {object} response
     */
    async getListOfAllCourses() {
        const i18n = this._i18n;

        //TODO cache this data
        let dataList = [];
        let response = await this.getAllSubmissions();

        if (!response) {
            return;
        }
        
        if (response.status !== 200) {
            if (response.status === 403) {
                this.hasPermissions = false;
            }
            return;
        }

        let data = [];
        try {
            data = await response.json();
        } catch(e) {
            return;
        }

        if (!data || !data["hydra:member"]) {
            return;
        }

        let id = 1;
        let courses = [];
        for(let x = 0; x <= data["hydra:member"].length; x++) {

            if (x === data["hydra:member"].length) {
                this.coursesTable.setData(dataList);
                this.dataLoaded = true;
                return;
            }
            let entry = data["hydra:member"][x];
            try {

                let name = entry["form"];

                if (!name || courses.length > 0 && courses.includes(name)) {
                    continue;
                }
                let date = entry["dateCreated"];

                const button_tag = this.getScopedTagName('dbp-button');
                const icon_tag = this.getScopedTagName('dbp-icon');
                let button = `<${button_tag} name="" class="button courses-btn">` +
                    `<${icon_tag} name="chevron-right" title="${i18n.t('show-registrations.open-forms')}"></${icon_tag}>` + `</${button_tag}>`;
                let div = getShadowRootDocument(this).createElement('div');
                div.classList.add('button-wrapper');
                div.innerHTML = button;

                div.firstChild.addEventListener("click", event => {
                    this.requestAllCourseSubmissions(name);
                    event.stopPropagation();
                });

                let course = {id:id, name:name, date:date, type:div};
                id++;
                courses.push(name);

                dataList.push(course);
            } catch(e) {
                console.log('error');
            }

        }
    }

    /**
     * Gets the list of submissions
     *
     * @returns {object} response
     */
    async getAllSubmissions() {
        let response; 

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/formalize/submissions', options);
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
                Authorization: "Bearer " + this.auth.token
            },
        };

        return await this.httpGetAsync(this.entryPointUrl + '/formalize/submissions/' + identifier, options);
    }

    async requestCourses() {
        if (!this.dataLoaded) {
            this.loadingCourseTable = true;
            await this.getListOfAllCourses();
            this.loadingCourseTable = false;
        }
    }
    
    async requestAllCourseSubmissions(name) {
        this.loadingSubmissionTable = true;
        let dataList2 = [];

        let response = await this.getAllSubmissions();

        this.submissionsColumns = [];
        
        if (!response) {
            return;
        }
        if (response.status !== 200) {
            if (response.status === 403) {
                this.hasPermissions = false;
            }
            return;
        }
        
        let data = [];
        try {
            data = await response.json();
        } catch(e) {
            return;
        }
        let headerExists = this.autoColumns;

        if (!data || !data["hydra:member"]) {
            this.showSubmissionsTable = true;
            return;
        }

        let beautyId = 1;
        for(let x = 0; x <= data["hydra:member"].length; x++) {
            if (x === data["hydra:member"].length) {
                this.activeCourse = name;
                this.submissionsTable.setData(dataList2);
                if (
                    this.storeSession &&
                    this.isLoggedIn()
                ) {
                    const publicId = this.auth['person-id'];
                    localStorage.setItem('dbp-formalize-activeCourse-' + publicId, name);
                }
                this.loadingSubmissionTable = false;
                this.showSubmissionsTable = true;
                const that = this;
                setTimeout(function () {
                    if (that._(".back-navigation")) {
                        that._(".subheadline").scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 10);
                return;
            }
            let entry = data["hydra:member"][x];
            let id = entry["@id"].split('/')[3];
            let date = entry["dateCreated"];

            try {
                if(entry && entry["form"] !== name)
                    continue;

                let json = JSON.parse(entry["dataFeedElement"]);

                if (!headerExists) {
                    await this.setHeaderFromJson(json);
                    headerExists = true;
                }
                let jsonFirst = {};
                jsonFirst['id'] = id;
                jsonFirst['id_'] = beautyId;
                jsonFirst['dateCreated'] = date;
                json = Object.assign(jsonFirst, json);
                dataList2.push(json);
                beautyId++;
            } catch(e) {
                 console.log('error');
            }

        this.totalNumberOfItems = beautyId - 1;
        }
    }

    async setHeaderFromJson(json){
        for (let header in json) {
            let col = {};
            col.title = header;
            col.field = header;
            this.submissionsTable.addColumn(col);
        }
    }

    requestDetailedSubmission(row, data) {

        if (!this._('.detailed-submission-modal-content-wrapper'))
            return;
        this._('.detailed-submission-modal-content-wrapper').innerHTML = '';

        if (!this._('#apply-col-settings'))
            return;
        let colSettings = this._('#apply-col-settings').checked;
        let identifier = data['id_'];

       if (!colSettings) {
            let cells = data;

            for (let i = 0; i < Object.keys(cells).length; i++) {
                let key = Object.keys(cells)[i];
                if (key.includes('no_display') || key.includes('id')) {
                    continue;
                } else if (key.includes('dateCreated') && (cells[key] !== '')) {
                    let title = this.submissionsTable.getColumn('dateCreated').getDefinition().title;
                    title = title === '' ? key : title;
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class="element-left">` + title + `:</div>`;
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class="element-right">` + this.humanReadableDate(cells[key]); + `</div>`;
                    continue;
                }

                this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class="element-left">` + xss(key) + `:</div>`;

                if (cells[key] !== '') {
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class="element-right">` + xss(cells[key]) + `</div>`;
                } else {
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class="element-right"></div>`;
                }
            }
       } else {
            // If checkbox checked
            let cells = data;

            for (let i = 0; i < Object.keys(cells).length; i++) {
                let key = Object.keys(cells)[i];
                console.log('in else, row element: ', row.getElement());

                let isVisible = true;
                if (this.submissionsTable.getColumn(key)) {
                    console.log('in else, row display:', window.getComputedStyle(this.submissionsTable.getColumn(key).getElement()).display);
                    isVisible = window.getComputedStyle(this.submissionsTable.getColumn(key).getElement()).display === 'none' ? false : true;
                }

                if (key.includes('no_display') || key.includes('id') || !isVisible) {
                    console.log('ignore ', key);
                    continue;
                } else if (key.includes('dateCreated') && (cells[key] !== '')) {
                    let title = this.submissionsTable.getColumn('dateCreated').getDefinition().title;
                    title = title === '' ? key : title;
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class="element-left">` + title + `:</div>`;
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class="element-right">` + this.humanReadableDate(cells[key]); + `</div>`;
                    continue;
                }

                this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-left'>` + xss(key) + `:</div>`;

                if (cells[key]  !== '') {
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-right'>` + xss(cells[key] ) + `</div>`;
                } else {
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-right'></div>`;
                }
            }
        }
        if (this._('.detailed-submission-modal-content-wrapper > div:first-child'))
            this._('.detailed-submission-modal-content-wrapper > div:first-child').classList.add('first');
        if (this._('.detailed-submission-modal-content-wrapper > div:nth-child(2)'))
            this._('.detailed-submission-modal-content-wrapper > div:nth-child(2)').classList.add('first');

        this.currentRow = row;
        this.currentBeautyId = identifier;
        this.isPrevEnabled = identifier !== 1;
        this.isNextEnabled = (identifier + 1) <= this.submissionsTable.getDataCount();

        this.showDetailedModal();

        this.modalContentHeight = this._('#detailed-submission-modal-box > .modal-header').offsetHeight +
            this._('#detailed-submission-modal-box > .modal-footer').offsetHeight;
        this._('.detailed-submission-modal-content-wrapper').setAttribute('style', 'max-height: calc(100vH - ' + this.getModalContentHeight() + 'px);');
    }

    async exportSubmissionTable(e) {
        let exportInput = this._('#export-select');
        if (!exportInput)
            return;

        let exportValue = exportInput.value;

        if (!exportValue || exportValue === "")
            return;

        if (e)
            e.stopPropagation();

        switch (exportValue) {
            case "csv":
                this.exportCSV();
                break;
            case "pdf":
                this.exportPdf();
                break;
            case "excel":
                this.exportXLSX();
                break;
            default:
                break;
        }

        exportInput.value = "-";
    }

    async exportCSV() {
        console.log("export csv");
        let selected = this.submissionsTable.getSelectedRows().length;
        let all = "selected";
        if (selected === 0) {
            all = "active";
        }
        this.submissionsTable.download("csv", this.activeCourse + ".csv", {}, all);
    }

    async exportPdf() {
        let selected = this.submissionsTable.getSelectedRows().length;
        let all = "selected";
        if (selected === 0) {
            all = "active";
        }

        window.jsPDF = await importJsPDF();
        this.submissionsTable.download("pdf", this.activeCourse + ".pdf", {
            title: this.activeCourse,
            autoTable:{ //advanced table styling
                theme: 'grid',
                styles: {
                    fontSize: 8
                },
                margin: {top: 60},
                pageBreak: 'auto',
            },
        }, all);
        delete window.jsPDF;
    }

    async exportXLSX() {
        console.log("export xlsx");

        window.XLSX = await importXLSX();

        let selected = this.submissionsTable.getSelectedRows().length;
        let all = "selected";
        if (selected === 0) {
            all = "active";
        }
        this.submissionsTable.download("xlsx", this.activeCourse + ".xlsx", {sheetName: this.activeCourse}, all);
        
        delete window.XLSX;
    }

    filterTable() {
        let filter = this._('#searchbar');
        let search = this._('#search-select');
        let operator = this._('#search-operator');

        if (!filter || !search || !operator || !this.submissionsTable)
            return;

        filter = filter.value;
        search = search.value;
        operator = operator.value;

        if (search !== 'all') {
            this.submissionsTable.setFilter(search, operator, filter);
            return;
        }

        let filterArray = [];
        this.submissionsColumns.forEach(col => {
            filterArray.push({field:col.field, type:operator, value:filter});
        });
        this.submissionsTable.setFilter([filterArray]);
    }

    updateTableHeaderList() {
        console.log("update");
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

    getTableHeaderOptions() {
        if (!this.submissionsTable)
            return;
        const i18n = this._i18n;
        let options = [];
        options[0] = html`<option value="all">${i18n.t('show-registrations.all-columns')}</option>`;
        this.submissionsColumns.forEach((col, counter) => {
            if(!col.visibility) {
                options[counter + 1]= html`<option disabled value="${col.field}">${col.name}</option>`;
            } else {
                options[counter + 1]= html`<option value="${col.field}">${col.name}</option>`;
            }
        });
        return options;
    }

    openModal() {
        // XXX: this is just to update the translations
        this.updateTableHeaderList();

        let modal = this._('#submission-modal');
        if (modal) {
            MicroModal.show(modal, {
                disableScroll: true
            });
        }

        let scrollWrapper = this._("#submission-modal-content");
        if (scrollWrapper) {
            scrollWrapper.scrollTo(0, 0);
        }

    }

    closeModal() {
        let modal = this._('#submission-modal');
        if (modal) {
            MicroModal.close(modal);
        }
    }

    showDetailedModal() {
        let modal = this._('#detailed-submission-modal');
        if (modal) {
            MicroModal.show(modal, {
                disableScroll: true
            });
        }
    }

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

    pressEnterAndSubmitSearch(event) {
        if (event.keyCode === 13) {
                const activeElement = this.shadowRoot.activeElement;
                if(activeElement && activeElement.id === 'searchbar') {
                    event.preventDefault();
                    this.filterTable();
                    this.hideAdditionalSearchMenu(event);
                }
        }
    }

    hideAdditionalMenu() {
        if (this.initateOpenAdditionalMenu) {
            this.initateOpenAdditionalMenu = false;
            return;
        }
        const menu = this.shadowRoot.querySelector('ul.extended-menu');
        if (menu && !menu.classList.contains('hidden')) this.toggleMoreMenu();
    }

    toggleSearchMenu(e) {
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

    hideAdditionalSearchMenu(e) {
        if (this.initateOpenAdditionalSearchMenu) {
            this.initateOpenAdditionalSearchMenu = false;
            return;
        }

        if(e.type !== "keyup" && e.keyCode !== 13
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

    changeVisibility(item) {
        item.visibility = !item.visibility;
        if (item.visibility) {
           this._("." + item.field + ' .header-visibility-icon-hide').classList.remove('hidden');
           this._("." + item.field + ' .header-visibility-icon-show').classList.add('hidden');
        } else {
            this._("." + item.field + ' .header-visibility-icon-hide').classList.add('hidden');
            this._("." + item.field + ' .header-visibility-icon-show').classList.remove('hidden');
        }
    }

    updateSubmissionTable() {
        const i18n = this._i18n;

        this.submissionsTable.setLocale(this.lang);

        // Add all known colums in the right order
        let newDefs = [];
        let addedFields = [];
        for(let spec of this.submissionsColumns) {
            let col = this.submissionsTable.getColumn(spec.field);
            if(!col) {
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

        // Update the date created column
        let customAccessor = (value, data, type, params, column, row) => {
            return this.humanReadableDate(value);
        };
        let dateCol = {
            minWidth: 150,
            field: 'dateCreated',
            title: i18n.t('show-registrations.creation-date'),
            align: 'left',
            sorter: (a, b, aRow, bRow, column, dir, sorterParams) => {
                const a_timestamp = Date.parse(a);
                const b_timestamp = Date.parse(b);
                return a_timestamp - b_timestamp;
            },
            formatter: (cell, formatterParams, onRendered) => {
                return this.humanReadableDate(cell.getValue());
            },
            accessorParams:{},
            accessor: customAccessor,
        };
        newDefs[addedFields.indexOf(dateCol.field)] = dateCol;

        // Update the ID columns
        let idCol = {
            field: 'id',
            title: 'ID',
            download: false,
            visible: false,

        };
        newDefs[addedFields.indexOf(idCol.field)] = idCol;

        let beautyIdCol = {
            field: 'id_',
            title: 'ID',
            align: 'center',
            visible: false,
            download: false,
        };
        newDefs[addedFields.indexOf(beautyIdCol.field)] = beautyIdCol;

        // Add icon columns
        const openIcon = (cell, formatterParams) => {

            const icon_tag = this.getScopedTagName('dbp-icon');
            let id = cell.getData()['id'];
            let button = `<${icon_tag} name="keyword-research" class="open-modal-icon" id="` + id + `"></${icon_tag}>`; //enter
            let div = getShadowRootDocument(this).createElement('div');
            div.innerHTML = button;
            div.classList.add('open-detailed-modal-btn');

            div.addEventListener("click", event => {
                this.requestDetailedSubmission(cell.getRow(), cell.getRow().getData());
                event.stopPropagation();
            });
            return div;
        };

        let openIconCol = {
            title: "",
            align: 'center',
            field: 'no_display_1',
            download: false,
            headerSort:false,
            sortable:false,
            visible: true,
            formatter: openIcon,
            frozen: true,
        };
        if (addedFields.indexOf(openIconCol.field) == -1) {
            newDefs.push(openIconCol);
        } else {
            newDefs[addedFields.indexOf(openIconCol.field)] = openIconCol;
        }

        // Replace all columns
        this.submissionsTable.setColumns(newDefs);

        // Set the visibility status
        this.hiddenColumns = false;
        for(let spec of this.submissionsColumns) {
            let col = this.submissionsTable.getColumn(spec.field);
            if(!col) {
                col.hide();
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

    getSubmissionTableSettings() {
        if (
            this.storeSession &&
            this.isLoggedIn()
        ) {

            const publicId = this.auth['person-id'];
            let optionsString = localStorage.getItem('dbp-formalize-tableoptions-' + this.activeCourse + '-' + publicId);

            if (!optionsString)
                return false;

            try{

                let options = JSON.parse(optionsString);
                if (options) {
                    this.submissionsColumns = [...options];
                }

            } catch(e)
            {
                console.log(e);
                return false;
            }
            return true;
        }
        return false;
    }

    setSubmissionTableSettings() {
        if (
            this.storeSession &&
            this.isLoggedIn()
        ) {
            const publicId = this.auth['person-id'];
            localStorage.setItem('dbp-formalize-tableoptions-' + this.activeCourse + '-' + publicId, JSON.stringify(this.submissionsColumns));
        }
    }

    async loadActiveCourse() {
        const publicId = this.auth['person-id'];
        let activeCourse = localStorage.getItem('dbp-formalize-activeCourse-' + publicId);

        if (!activeCourse)
            return false;

        this.requestAllCourseSubmissions(activeCourse);
    }

    moveHeaderUp(i, e) {
        let elem = this._("." + i.field);
        let elemIndex = elem.getAttribute('data-index');
        if (parseInt(elemIndex) === 0)
            return;

        let swapElem_ = this.submissionsColumns.find((col, index) => {

            if( index + 1 <= this.submissionsColumns.length && this.submissionsColumns[index + 1].field === i.field) {
                return true;
            }
            return false;
        });
        this.swapHeader(swapElem_, elem, elemIndex, i);
    }

    moveHeaderDown(i, e) {
        let elem = this._("." + i.field);
        let elemIndex = elem.getAttribute('data-index');
        if (parseInt(elemIndex) === this.submissionsColumns.length - 1)
            return;

        let swapElem_ = this.submissionsColumns.find((col, index) => {

            if( index - 1 >= 0 && this.submissionsColumns[index - 1].field === i.field) {
                return true;
            }
            return false;

        });
       this.swapHeader(swapElem_, elem, elemIndex, i);
    }

    swapHeader(swapElem_, elem, elemIndex, i){
        let swapElem = this._("." + swapElem_.field);
        let swapElemIndex = swapElem.getAttribute('data-index');

        let tmp = this.submissionsColumns[elemIndex];
        this.submissionsColumns[elemIndex] = this.submissionsColumns[swapElemIndex];
        this.submissionsColumns[swapElemIndex] = tmp;

        this.submissionsColumnsUpdated = this.submissionsColumnsUpdated === false ? true : false;

        let swapElem2 = this._("." + swapElem_.field);

        function removeClass() {
            swapElem2.classList.remove('move-up');
        }

        function addClass() {
            swapElem2.classList.add('move-up');

        }
        setTimeout(addClass.bind(swapElem2), 0);

        setTimeout(removeClass.bind(swapElem2), 400);
    }

    showLastEntry() {
        if (this.currentRow !== null) {
            let currentRow = this.currentRow;
            let nextIndex = currentRow.getPosition() - 1;

            let nextRow;
            this.submissionsTable.getRows().forEach((row) => {
                if (row.getPosition() === nextIndex) {
                    nextRow = row;
                }
            });

            if (nextRow) {
                this.requestDetailedSubmission(nextRow, nextRow.getData());
            }
        }
    }

    showNextEntry() {
        if (this.currentRow !== null) {
            let currentRow = this.currentRow;
            let nextIndex = currentRow.getPosition() + 1;

            let nextRow;
            this.submissionsTable.getRows().forEach((row) => {
                if (row.getPosition() === nextIndex) {
                    nextRow = row;
                    console.log('next row:', nextRow);
                }
            });

            if (nextRow) {
                this.requestDetailedSubmission(nextRow, nextRow.getData());
            }
        }
    }

    getModalContentHeight() {
        return this.modalContentHeight;
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
          
            ${commonStyles.getModalDialogCSS()}
            ${commonStyles.getRadioAndCheckboxCss()}
            ${commonStyles.getGeneralCSS(false)}
            ${fileHandlingStyles.getFileHandlingCss()}
            ${tabulatorStyles.getTabulatorStyles()}
            
            ${commonStyles.getNotificationCSS()}
            ${commonStyles.getActivityCSS()}
            
            ${commonStyles.getButtonCSS()}

            .tabulator[tabulator-layout=fitDataFill] .tabulator-tableHolder .tabulator-table {
                min-width: calc(100% - 41px);
            }

            .table-wrapper.submissions {
                padding-top: 0.5rem;
            }

            .table-header.submissions {
                margin-top: 0.5rem;
            }

            .btn-row-left > *  {
                display: flex;
                align-items: center;
            }
            
            .next-btn, .back-btn, #modal-export-select {
                min-height: 33px;
            }

            .open-detailed-modal-btn {
                width: 33px;
                position: absolute;
                margin: auto;
                left: 10px;
            }

            #detailed-submission-modal-title {
                margin-bottom: 10px;
            }
            
            #submission-modal-title {
                margin-top: unset;
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

            .btn-row-left {
                display: flex;
                justify-content: space-between;
                gap: 4px;
            }

            .next-btn, .back-btn  {
                -moz-appearance: none;
                -webkit-appearance: none;
                /*background-size: 10%;*/
                background-size: 13px;
                border: var(--dbp-border);
                border-radius: var(--dbp-border-radius);
                color: var(--dbp-content);
                padding-bottom: calc(.375em - 1px);
                padding-top: calc(.375em - 1px);
            }

            .back-btn {
                background: calc(100% - 0.2rem) center no-repeat url("${unsafeCSS(
                    getIconSVGURL('chevron-left')
                )}");
                background-position-x: 0.4rem;
                padding-right: calc(.625em - 1px);
                padding-left: 1.3rem;
                background-size: 13px;
            }

            .next-btn {
                background: calc(100% - 0.2rem) center no-repeat url("${unsafeCSS(
                    getIconSVGURL('chevron-right')
                )}");
                background-position-x: calc(100% - 0.4rem);
                padding-left: calc(.625em - 1px);
                padding-right: 1.3rem;
                background-size: 13px;
            }

            .open-modal-icon {
                font-size: 1.3em;
            }

            #modal-export-select {
                height: 33px;
            }
            
            #export-select, #search-select, #search-operator, .dropdown-menu, #modal-export-select {
                background-size: auto 50%;
                padding-bottom: calc(0.375em - 1px);
                padding-left: 0.75em;
                padding-right: 1.3rem;
                padding-top: calc(0.375em - 1px);
                cursor: pointer;
                background-position-x: calc(100% - 0.4rem);
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

            .element-left.first {
                padding-top: 12px;
            }

            .element-right.first {
                padding-top: 12px;
            }

            .hideWithoutDisplay {
                opacity: 0;
                height: 0px;
                overflow: hidden;
            }

             .scrollable-table-wrapper {
                 width: 100%;
             }
 
             .tabulator-table {
                 overflow: auto;
                 white-space: nowrap;
             }

            .tabulator .tabulator-footer {
                text-align: center;
            }
 
             .back-navigation {
                 padding-top: 1rem;
               
             }
             
             .table-wrapper h3{
               margin-top: 0.5em;
               margin-bottom: 1em;
             }
             
             .back-navigation dbp-icon{
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
                 padding-bottom: 30px;
                 padding-top: 10px;
             }
 
             .border-wrapper {
                 margin-top: 2rem;
                 padding-top: 1rem;
                 border-top: var(--dbp-border);
             }
 
             #courses-table .tabulator-cell[tabulator-field="type"] {
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
             
             #search-button{
                 position: absolute;
                right: 0px;
                top: 0px;
             }
             
             #extendable-searchbar .extended-menu{
                 list-style: none;
                 border: var(--dbp-border);
                 background-color: var(--dbp-background);
                 z-index: 1000;
                 border-radius: var(--dbp-border-radius);
                 width: 100%;
                position: absolute;
                right: 0px;
                background-color: white;
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

            .frozen-table-divider{
                position: absolute;
                height: calc(100% - 61px);
                width: 3px;
                top: 10px;
                right: 38px;
                -webkit-box-shadow: -4px 3px 16px -6px var(--dbp-muted);
                box-shadow: -2px 0px 2px 0px var(--dbp-muted);
                background-color: #fff0;
            }
            
            tabulator-row,
            .tabulator-row.tabulator-row-even,
            .tabulator-row.tabulator-row-odd {
                padding-top: 10px;
                padding-bottom: 10px;
            }
            
            .headers{
                max-width: 100%;
                margin: 0px;
                list-style-type: none;
                padding: 0px;
                display: grid;
            }
            
 
            .header-field{
                align-items: center;
                height: 50px;
                border: 1px solid var(--dbp-muted);
                display: flex;
                margin-bottom: 5px;
            }
            
            .header-button{
                justify-content: center;
                display: flex;
                align-items: center;
                height: 50px;
                width: 50px;
                min-width: 50px;
                flex-grow: 0;
                cursor: pointer;
            }
            
            .header-button dbp-icon{
                font-size: 1.3em;
                top: 0px;
            }

            .header-button.hidden, .extended-menu.hidden{
                display: none !important;
            }
            
            .header-title{
                flex-grow: 2;
                text-overflow: ellipsis;
                overflow: hidden;
                padding-left: 5px;
                text-align: left;
            }
            
            .header-order{
                background-color: var(--dbp-muted-surface);
                color: var(--dbp-on-muted-surface);
                font-weight: bold;
            }
            
            .move-up .header-field{
                animation: added 0.4s ease;
            }
            
            .header-move{
                display: flex;
            }
            
            .first-header .header-move .header-button:first-child, .last-header .header-move .header-button:last-child{
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
            
            .tabulator .tabulator-tableHolder .tabulator-placeholder span {
                margin-left: 0px;
            }

            #submission-modal-box {
                width: unset;
                min-width: unset;
                min-height: unset;
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
            
             @media only screen and (orientation: portrait) and (max-width: 768px) {

                button[data-page="prev"] {
                    display: block;
                    width: 40px!important;
                    background: 50% center no-repeat url("${unsafeCSS(
                        getIconSVGURL('chevron-left')
                    )}")!important;
                    background-size: 1.5rem!important;
                    text-indent: 100px;
                    white-space: nowrap!important;
                    overflow: hidden;
                    line-height: 0;
                }

                button[data-page="next"] {
                    display: block;
                    width: 40px!important;
                    background: 50% center no-repeat url("${unsafeCSS(
                        getIconSVGURL('chevron-right')
                    )}")!important;
                    background-size: 1.5rem!important;
                    text-indent: 100px;
                    white-space: nowrap!important;
                    overflow: hidden;
                    line-height: 0;
                }

                button[data-page="first"] {
                    display: block;
                    width: 50px!important;
                    background: 50% center no-repeat url("${unsafeCSS(
                        getIconSVGURL('angle-double-left')
                    )}")!important;
                    background-size: 1.5rem!important;
                    text-indent: 100px;
                    white-space: nowrap!important;
                    overflow: hidden;
                    line-height: 0;
                }

                button[data-page="last"] {
                    display: block;
                    width: 50px!important;
                    background: 50% center no-repeat url("${unsafeCSS(
                        getIconSVGURL('angle-double-right')
                    )}")!important;
                    background-size: 1.5rem!important;
                    text-indent: 100px;
                    white-space: nowrap!important;
                    overflow: hidden;
                    line-height: 0;
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
                    /*overflow: auto;*/
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

                .extended-breadcrumb-menu li a {
                    max-width: none;
                    display: inline;
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

                .back-navigation::before {
                    mask-position: center 44%;
                }

                .border-wrapper {
                    margin: 0;
                }

                 #searchbar {
                     width: 100%;
                     height: 40px;
                 }


                 #search-button{
                     position: absolute;
                     right: 0px;
                     top: 0px;
                     height: 40px;
                     box-sizing: border-box;
                     padding-top: calc(0.6em - 1px);
                 }
                
                .search-wrapper{
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
                 
                 .headers{
                    display: initial;
                    width: 100%;
                 }
                 
                #submission-modal-box, #detailed-submission-modal-box {
                    height: 100vh;
                    max-height: 100vh;
                    width: 100vh;
                    max-width: 100%;
                }
                
                #submission-modal-content, #detailed-submission-modal-content {
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
                    top: 10px;
                }

                .button-container {
                    padding-left: 30px;
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
                console.log("requested");
                this.loadCourses = false;
            });
        }

        return html`
            <link rel="stylesheet" href="${tabulatorCss}" />
            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-login-message')}
            </div>

            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div class="notification is-danger ${classMap({hidden: this.hasPermissions || !this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-permission-message')}
            </div>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading() || !this.hasPermissions })}">
                
                <h2>${this.activity.getName(this.lang)}</h2>

                <div>
                    <p class="subheadline">
                        <slot name="description">
                            ${this.activity.getDescription(this.lang)}
                        </slot>
                    </p>
                    <slot name="additional-information"></slot>
                </div>


                <div class="control ${classMap({hidden: this.showSubmissionsTable || !this.loadingCourseTable})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                        </span>
                </div>
                <div class="table-wrapper ${classMap({hidden: this.showSubmissionsTable || this.loadingCourseTable || this.loadingSubmissionTable})}">
                    <table id="courses-table"></table>
                </div>


                <div class="control ${classMap({hidden: !this.loadingSubmissionTable})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                        </span>
                </div>
                <div class="table-wrapper submissions${classMap({hideWithoutDisplay: !this.showSubmissionsTable || this.loadingSubmissionTable })}">
                    <span class="back-navigation ${classMap({hidden: !this.showSubmissionsTable })}">
                       <a @click="${() => {
                                    this.loadingCourseTable = true;
                                    this.showSubmissionsTable = false;
                                    this.submissionsColumns = [];
                                    this.submissionsTable.clearData();
                                    this.loadingCourseTable = false;}}"
                                title="${i18n.t('show-registrations.back-text')}">
                                <dbp-icon name="chevron-left"></dbp-icon>${i18n.t('show-registrations.back-text')}
                       </a>
                    </span>
                    <div class='table-header submissions'>
                        <h3>${this.activeCourse}</h3>
                        <div class="options-nav ${classMap({hidden: !this.showSubmissionsTable})}">
                        
                        <div class="additional-menu ${classMap({hidden: !this.showSubmissionsTable })}">
                            <a class="extended-menu-link"
                                @click="${() => {
                                    this.toggleMoreMenu();
                                }}"
                                title="${i18n.t('show-registrations.more-menu')}">
                                <dbp-icon name="menu-dots" class="more-menu"></dbp-icon>
                            </a>
                            <ul class="extended-menu hidden">
                                <li class="open-menu ${classMap({active: false})}">
                                    <a class="" @click="${() => {this.exportCSV();}}">
                                        CSV Export
                                    </a>
                                </li>
                                <li class="open-menu ${classMap({active: false})}">
                                    <a class="" @click="${() => {this.exportXLSX();}}">
                                        Excel Export
                                    </a>
                                </li>
                                <li class="open-menu ${classMap({active: false})}">
                                    <a class="" @click="${() => {this.exportPdf();}}">
                                       PDF Export
                                    </a>
                                </li>
                                <li class="${classMap({active: false})}">
                                    <a class="" @click="${this.openModal}">
                                        ${i18n.t('show-registrations.filter-options-button-text')}
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                    </div>
                    
                    <div class="table-buttons">
                        <div class="search-wrapper">
                            <div id="extendable-searchbar">
                                <input type="text" id="searchbar" 
                                       placeholder="${i18n.t('show-registrations.searchbar-placeholder')}"  
                                       @click="${() => {this.toggleSearchMenu();}}"/>
                                <dbp-button class="button" id="search-button" title="${i18n.t('show-registrations.search-button')}"
                                            class="button" @click="${() => { this.filterTable(); }}">
                                    <dbp-icon name="search"></dbp-icon>

                                </dbp-button>
                                <ul class="extended-menu hidden" id='searchbar-menu'>
                                    <label for='search-select'>${i18n.t('show-registrations.search-in')}:</label>
                                    <select id="search-select" class='button dropdown-menu' title="${i18n.t('show-registrations.search-in-column')}:">          
                                       ${this.getTableHeaderOptions()}
                                    </select>

                                    <label for='search-operator'>${i18n.t('show-registrations.search-operator')}:</label>
                                    <select id="search-operator" class='button dropdown-menu'>
                                        <option value="like">${i18n.t('show-registrations.search-operator-like')}</option>
                                        <option value="=">${i18n.t('show-registrations.search-operator-equal')}</option>
                                        <option value="!=">${i18n.t('show-registrations.search-operator-notequal')}</option>
                                        <option value="starts">${i18n.t('show-registrations.search-operator-starts')}</option>
                                        <option value="ends">${i18n.t('show-registrations.search-operator-ends')}</option>
                                        <option value="<">${i18n.t('show-registrations.search-operator-less')}</option>
                                        <option value="<=">${i18n.t('show-registrations.search-operator-lessthanorequal')}</option>
                                        <option value=">">${i18n.t('show-registrations.search-operator-greater')}</option>
                                        <option value=">=">${i18n.t('show-registrations.search-operator-greaterorequal')}</option>
                                        <option value="regex">${i18n.t('show-registrations.search-operator-regex')}</option>
                                        <option value="keywords">${i18n.t('show-registrations.search-operator-keywords')}</option>
                                    </select>
                                </ul>
                            </div>
                            
                           
                        </div>
                        <div class='export-buttons'>
                            
                            <button class="button" title=" ${i18n.t('show-registrations.filter-options-button-text')}">
                                <a class="" @click="${this.openModal}">
                                    ${i18n.t('show-registrations.filter-options-button-text')}
                                </a>
                            </button>
                            <select id="export-select" class='dropdown-menu' @change='${this.exportSubmissionTable}'>
                                <option value="-" disabled selected>${i18n.t('show-registrations.default-export-select')}</option>
                                <option value="csv">CSV</option>
                                <option value="excel" >Excel</option>
                                <option value="pdf">PDF</option>
                            </select>
                           
                        </div>
                    </div>
                    <div class="scrollable-table-wrapper">   
                        <table id="submissions-table"></table>
                        <div class="frozen-table-divider"></div>
                    </div>
                </div>
            </div>
           
            <div class="modal micromodal-slide" id="submission-modal" aria-hidden="true">
                <div class="modal-overlay" tabindex="-2" data-micromodal-close>
                    <div
                        class="modal-container"
                        id="submission-modal-box"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="submission-modal-title">
                        <header class="modal-header">
                            <button
                                title="${i18n.t('show-registrations.modal-close')}"
                                class="modal-close"
                                aria-label="Close modal"
                                @click="${() => {
                                    MicroModal.close(this._('#submission-modal'));
                                }}">
                                <dbp-icon
                                    title="${i18n.t('show-registrations.modal-close')}"
                                    name="close"
                                    class="close-icon"></dbp-icon>
                            </button>
                            <p id="submission-modal-title">
                                ${i18n.t('show-registrations.header-settings')}
                            </p>
                        </header>
                        <main class="modal-content" id="submission-modal-content">
                            <ul class="headers">
                                 ${this.submissionsColumns.map((i, counter) => {
                        
                                     let classes = "";
                                     classes += counter === 0 ? "first-header " : "";
                                     classes += counter === this.submissionsColumns.length - 1 ? "last-header " : "";
                                     classes += i.field;
                                     return html`
                                     <li class="header-fields ${classes}" data-index="${counter}">
                                         <div class="header-field">
                                             <span class="header-button header-order">${counter + 1}</span>
                                             <span class="header-title"><strong>${i.name}</strong></span>
                                             <span class="header-button header-visibility-icon"
                                                   @click="${() => {
                                                       this.changeVisibility(i);
                                                   }}">
                                                 <dbp-icon title="${i18n.t('show-registrations.change-visability-off')}" class="header-visibility-icon-hide ${classMap({hidden: !i.visibility})}"
                                                           name="source_icons_eye-empty"></dbp-icon>
                                                 <dbp-icon title="${i18n.t('show-registrations.change-visability-on')}" class="header-visibility-icon-show ${classMap({hidden: i.visibility})}"
                                                           name="source_icons_eye-off"></dbp-icon>
                                             </span>
                                             <span class="header-move">
                                                <div class="header-button" @click="${(e) => { this.moveHeaderUp(i, e); }}"
                                                    title='${i18n.t('show-registrations.move-up')}'>
                                                    <dbp-icon name="arrow-up"></dbp-icon></div>
                                                 <div class="header-button"  @click="${(e) => { this.moveHeaderDown(i, e); }}"
                                                    title='${i18n.t('show-registrations.move-down')}'>
                                                     <dbp-icon name="arrow-down"></dbp-icon></div>
                                             </span>
                                         </div>
                                    </li>
                                 `;})}
                            </ul>
                        </main>
                        <footer class="modal-footer">
                            <div class="modal-footer-btn">
                                <button class="check-btn button is-primary" id="check" @click="${() => {this.updateSubmissionTable(); this.closeModal(); this.setSubmissionTableSettings();}}">
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
                                aria-label="Close modal"
                                @click="${() => {
                                    MicroModal.close(this._('#detailed-submission-modal'));
                                    this._('.detailed-submission-modal-content-wrapper').removeAttribute('style');
                                }}">
                                <dbp-icon
                                    title="${i18n.t('show-registrations.modal-close')}"
                                    name="close"
                                    class="close-icon"></dbp-icon>
                            </button>
                            <h3 id="detailed-submission-modal-title">${i18n.t('show-registrations.detailed-submission-dialog-title')}</h3>
                        </header>
                        <main class="modal-content" id="detailed-submission-modal-content">
                            <div class="detailed-submission-modal-content-wrapper"></div>
                        </main>
                        <footer class="modal-footer">
                            
                            <div class="modal-footer-btn">
                                <label class="button-container ${classMap({hidden: !this.hiddenColumns})}">
                                    ${i18n.t('show-registrations.apply-col-settings')}
                                    <input
                                        type="checkbox"
                                        id="apply-col-settings"
                                        name="apply-col-settings"
                                        @click="${() => {
                                            this.requestDetailedSubmission(this.currentRow, this.currentRow.getData());
                                        }}" 
                                        checked />
                                    <span class="checkmark"></span>
                                </label>
                                <div class="btn-row-left">
                                    <dbp-button class="button back-btn" title="${i18n.t('show-registrations.last-entry-btn-title')}"
                                        @click="${this.showLastEntry}"
                                        ?disabled="${!this.isPrevEnabled}">
                                        ${i18n.t('show-registrations.last-entry-btn-title')}
                                    </dbp-button>
                                    <div>${i18n.t('show-registrations.detailed-submission-dialog-id', {id: this.currentBeautyId, nItems: this.totalNumberOfItems})}</div>
                                    <dbp-button class="button next-btn" title="${i18n.t('show-registrations.next-entry-btn-title')}"
                                        @click="${this.showNextEntry}"
                                        ?disabled="${!this.isNextEnabled}">
                                        ${i18n.t('show-registrations.next-entry-btn-title')}
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
