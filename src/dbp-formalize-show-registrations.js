import {createInstance} from './i18n.js';
import {css, unsafeCSS, html} from 'lit';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {Icon, MiniSpinner, LoadingButton, getShadowRootDocument, getIconSVGURL} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit/directives/class-map.js';
import {Activity} from './activity.js';
import Tabulator from 'tabulator-tables';
import MicroModal from './micromodal.es';
import {name as pkgName} from './../package.json';
import * as fileHandlingStyles from './styles';
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
        this.activeCourse = '';
        this.autoColumns = true;
        this.currentCell = null;
        this.currentBeautyId = 0;
        this.totalNumberOfItems = 0;
        this.isPrevEnabled = false;
        this.isNextEnabled = false;
        this.storeSession = true;
        this.activeCourseChecked = true;
        this.loadingCourseTable = false;
        this.loadingSubmissionTable = false;
        this.dataLoaded = false;
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
            loadingSubmissionTable: { type: Boolean, attribute: false }
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    humanReadableDate(value) {
        const d = Date.parse(value);
        const timestamp = new Date(d);
        const year = timestamp.getFullYear();
        const month = ('0' + (timestamp.getMonth() + 1)).slice(-2);
        const date = ('0' + timestamp.getDate()).slice(-2);
        const hours = ('0' + timestamp.getHours()).slice(-2);
        const minutes = ('0' + timestamp.getMinutes()).slice(-2);
        return date + '.' + month + '.' + year + ' ' + hours + ':' + minutes;
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
                responsiveLayout: 'collapse',
                responsiveLayoutCollapseStartOpen: false,
                resizableColumns: false,
                pagination: 'local',
                paginationSize: 10,
                locale: true,
                columns: [
                    {
                        align: 'center',
                        resizable: false,
                        headerSort: false,
                        formatter: 'responsiveCollapse',
                    },
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
                layout:"fitDataFill",
                selectable: this.maxSelectedItems,
                selectableRangeMode: 'drag',
                placeholder: i18n.t('show-registrations.no-data'),
                resizableColumns: false,
                pagination: 'local',
                paginationSize: 10,
                autoColumns: this.autoColumns,
                downloadRowRange:"selected",
                locale: true,
                columns: [
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
                    if (this.submissionsTable !== null) {

                        const that = this;

                        this.submissionsTable.setLocale(this.lang);

                        const openIcon = function(cell, formatterParams) {

                            const icon_tag = that.getScopedTagName('dbp-icon');
                            let id = cell.getData()['id'];
                            let button = `<${icon_tag} name="keyword-research" class="open-modal-icon" id="` + id + `"></${icon_tag}>`; //enter
                            let div = getShadowRootDocument(that).createElement('div');
                            div.innerHTML = button;
                            div.classList.add('open-detailed-modal-btn');

                            div.addEventListener("click", event => {
                                that.requestDetailedSubmission(cell);
                                let path = '';
                                if (id === event.target.id) {
                                 path = id;
                             }
                             event.stopPropagation();
                            });
                            return div;
                        };

                          this.submissionsTable.addColumn({
                              title: "",
                              align: 'center',
                              field: 'no_display_1',
                              download: false,
                              headerSort:false,
                              sortable:false,
                              visible: true,
                              formatter: openIcon,
                              frozen: true,
                          }, false);

                        let idCol = {
                            field: 'id',
                            title: 'ID',
                            download: false,
                            visible: false,

                        };
                        let beautyIdCol = {
                            field: 'id_',
                            title: 'ID',
                            align: 'center',
                            visible: false,
                            download: false,
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
                            formatter: function (cell, formatterParams, onRendered) {
                                return that.humanReadableDate(cell.getValue());
                            },
                        };
                        if (this.autoColumns) {
                            this.submissionsTable.deleteColumn('dateCreated');
                            this.submissionsTable.deleteColumn('id');
                            this.submissionsTable.deleteColumn('id_');
                        }
                        this.submissionsTable.addColumn(dateCol, true);
                        this.submissionsTable.addColumn(idCol, true);
                        this.submissionsTable.addColumn(beautyIdCol, true);
                        if (this.storeSession) {
                            this.getSubmissionTableSettings();
                        } else {
                            this.updateTableHeaderList();

                        }
                    }
                },
            });        

        });
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
                    if (this.submissionsTable)
                        this.submissionsTable.setLocale(this.lang);
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

        //TODO cache this data
        let dataList = [];
        let response = await this.getAllSubmissions();
        let data = await response.json();

        if (!data || !data["hydra:member"]) {
            this.showSubmissionsTable = true;
            return;
        }

        const i18n = this._i18n;


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
        let data = [];
        if (!response)
            return;
        try{
            data = await response.json();
        }catch(e) {
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
                this.submissionsTable.setData(dataList2);
                this.activeCourse = name;
                if (
                    this.storeSession &&
                    this.isLoggedIn()
                ) {
                    const publicId = this.auth['person-id'];
                    localStorage.setItem('dbp-formalize-activeCourse-' + publicId, name);
                }
                if (!this.getSubmissionTableSettings()) {
                    this.updateTableHeaderList();
                }
                this.updateTableHeader(false);
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

    requestDetailedSubmission(cell) {

        if (!this._('.detailed-submission-modal-content-wrapper'))
            return;
        this._('.detailed-submission-modal-content-wrapper').innerHTML = '';

        if (!this._('#apply-col-settings'))
            return;
        let colSettings = this._('#apply-col-settings').checked;

        let row = cell.getRow();
        let identifier = cell.getData()['id_'];

        if (!colSettings) {
            let cells = row.getData();

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
            let cells = row.getCells();
            for (let i = 0; i < cells.length; i++) {
                let cell = cells[i];
                let col = cell.getColumn();
                let key = col.getField();
                let data = cell.getElement().textContent;

                if (key.includes('no_display') || key.includes('id') || !col.getVisibility()) {
                    continue;
                }
                this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-left'>` + xss(key) + `:</div>`;

                if (data !== '') {
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-right'>` + xss(data) + `</div>`;
                } else {
                    this._('.detailed-submission-modal-content-wrapper').innerHTML += `<div class='element-right'></div>`;
                }
            }
        }
        this._('.detailed-submission-modal-content-wrapper > div:first-child').classList.add('first');
        this._('.detailed-submission-modal-content-wrapper > div:nth-child(2)').classList.add('first');

        this.currentCell = cell;
        this.currentBeautyId = identifier;
        this.isPrevEnabled = identifier !== 1;
        this.isNextEnabled = (identifier + 1) <= this.submissionsTable.getDataCount();

        this.showDetailedModal();

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
        this.submissionsTable.download("csv", "data.csv");
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
        this.submissionsTable.download("xlsx", this.activeCourse + ".xlsx", {sheetName: this.activeCourse});
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

    async updateTableHeaderList() {
        console.log("update");
        if (!this.submissionsTable)
            return;
        let columns = this.submissionsTable.getColumns();
        this.submissionsColumns = [];
        columns.forEach((col) => {
            let name = col.getDefinition().title;
            let field = col.getDefinition().field;
            let visible = col.getDefinition().visible;

            if (visible !== false) {
                if (field && !field.includes('no_display')) {
                    this.submissionsColumns.push({name: name, field: field, visibility: 1});
                }
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
            if(col.visibility === 0) {
                options[counter + 1]= html`<option disabled value="${col.field}">${col.name}</option>`;
            } else {
                options[counter + 1]= html`<option value="${col.field}">${col.name}</option>`;
            }
        });
        return options;
    }

    openModal() {
        let modal = this._('#submission-modal');
        if (modal) {
            MicroModal.show(modal, {
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
            MicroModal.show(modal);
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
                // Cancel the default action, if needed
                event.preventDefault();
                // Trigger the button element with a click
                this.filterTable();
                this.hideAdditionalSearchMenu(event);
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
            document.addEventListener('keyup', this.boundPressEnterAndSubmitSearchHandler);
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
            document.removeEventListener('keyup', this.boundPressEnterAndSubmitSearchHandler);

        }
    }

    changeVisibility(item) {
        item.visibility = item.visibility === 1 ? 0 : 1;
        if (item.visibility === 1) {
           this._("." + item.field + ' .header-visibility-icon-hide').classList.remove('hidden');
           this._("." + item.field + ' .header-visibility-icon-show').classList.add('hidden');
        } else {
            this._("." + item.field + ' .header-visibility-icon-hide').classList.add('hidden');
            this._("." + item.field + ' .header-visibility-icon-show').classList.remove('hidden');
        }
    }

    async updateTableHeader(close = true) {
        let cols = this.submissionsTable.getColumns();
        let lastCol = cols[0];
        this.submissionsColumns.slice().forEach((col, counter) => {

            let sub_col = this.submissionsTable.getColumn(col.field);
            if(sub_col) {
                if (col.visibility === 1) {
                    sub_col.show();
                } else {
                    sub_col.hide();
                }
                if(col.field !== cols[0].field) {
                    this.submissionsTable.moveColumn(col.field, lastCol, true);
                    lastCol = col.field;
                }
            }

        });
        if (close)
            this.closeModal();
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
                    this.updateTableHeader(false);
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
        if (this.currentCell !== null) {
            let row = this.currentCell.getRow().getPrevRow();
     
            if (row) {
                this.requestDetailedSubmission(row.getCells()[0]);
            }
        }
    }

    showNextEntry() {
        if (this.currentCell !== null) {
            let row = this.currentCell.getRow().getNextRow();
            
            if (row) {
                this.requestDetailedSubmission(row.getCells()[0]);
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
                max-height: calc(100vH - 97.8px); /*TODO calculate values*/
                overflow-y: auto;
                width: 100%;
            }

            .element-left {
                background-color: var(--dbp-primary-surface);
                color: var(--dbp-on-primary-surface);
                padding: 0 20px 12px 40px; /*left: 20px*/
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
 
             .button-container input[type="checkbox"] {
                 position: inherit;
             }
 
             .button-container .checkmark::after {
                 left: 6px;
                 top: 2px;
                 width: 5px;
                 height: 11px;
             }
 
             select-all-icon {
                 height: 30px;
             }
 
             .checkmark {
                 height: 20px;
                 width: 20px;
                 left: 11px;
                 top: 1px; 
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
                height: unset;
            }
            
            .button-container {
                text-align: left;
                padding-left: 29px;
                margin-bottom: 10px;
            }
            
            .checkmark {
                left: 0px
            }
            
             @media only screen and (orientation: portrait) and (max-width: 768px) {

                .element-right {
                    /*padding: 10px 0 10px 0;*/
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
                }

                .detailed-submission-modal-content-wrapper {
                    grid-template-columns: auto;
                    max-height: calc(100vH - 139px); /*TODO calculate values*/
                }

       

                #detailed-submission-modal-box .modal-footer .modal-footer-btn {
                    padding: 6px 12px 6px 12px;
                    flex-direction: column;
                    gap: 6px;
                }

                #detailed-submission-modal-box .modal-content {
                    overflow: auto;
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
                
                .extended-menu-link dbp-icon{
                    top: 0px;
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
                 }
                 
                  #submission-modal-box {
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

        if (this.coursesTable && this.isLoggedIn()) {
            this.requestCourses();
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

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                
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
                <div class="table-wrapper ${classMap({hideWithoutDisplay: !this.showSubmissionsTable || this.loadingSubmissionTable })}">
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
                    <div class='table-header'>
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
                                                 <dbp-icon title="${i18n.t('show-registrations.change-visability-off')}" class="header-visibility-icon-hide ${classMap({hidden: i.visibility === 0})}"
                                                           name="source_icons_eye-empty"></dbp-icon>
                                                 <dbp-icon title="${i18n.t('show-registrations.change-visability-on')}" class="header-visibility-icon-show ${classMap({hidden: i.visibility === 1})}"
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
                                <button class="check-btn button is-primary" id="check" @click="${() => {this.updateTableHeader(); this.setSubmissionTableSettings();}}">
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
                                <label class="button-container">
                                    ${i18n.t('show-registrations.apply-col-settings')}
                                    <input
                                        type="checkbox"
                                        id="apply-col-settings"
                                        name="apply-col-settings"
                                        @click="${() => {
                                            this.requestDetailedSubmission(this.currentCell);
                                        }}" />
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
