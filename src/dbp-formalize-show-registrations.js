import {createInstance} from './i18n.js';
import {css, html} from 'lit';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {Icon, MiniSpinner, LoadingButton, getShadowRootDocument} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit/directives/class-map.js';
// import { send } from '@dbp-toolkit/common/notification';
import {Activity} from './activity.js';
// import {humanFileSize} from '@dbp-toolkit/common/i18next';
import Tabulator from 'tabulator-tables';
import * as XLSX from 'xlsx';
import MicroModal from './micromodal.es';
import {name as pkgName} from './../package.json';
import * as fileHandlingStyles from './styles';
import metadata from './dbp-formalize-show-registrations.metadata.json';

window.XLSX = XLSX;


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
        this.dataList = [];
        this.dragStartIndex = 0;
        this.dragList = [];
        this.initateOpenAdditionalMenu = false;
        this.boundCloseAdditionalMenuHandler = this.hideAdditionalMenu.bind(this);
        this.dragPos = 0;
        this.activeCourse = '';
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
            dataList: { type: Array, attribute: false },
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    connectedCallback() {
        super.connectedCallback();
        const i18n = this._i18n;
        this._loginStatus = '';
        this._loginState = [];

        this.updateComplete.then(() => {
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
                columns:[
                    {
                        align: 'center',
                        resizable: false,
                        headerSort: false,
                        formatter: 'responsiveCollapse',
                    },
                    { 
                        title:"Id", 
                        field:"id",
                        width: 100,
                    },
                    { 
                        title:"Name", 
                        field:"name",
                        widthGrow: 2,
                    },
                    { 
                        title:"Date", 
                        field:"date",
                        widthGrow: 1,
                        formatter: function (cell, formatterParams, onRendered) {
                            const d = Date.parse(cell.getValue());
                            const timestamp = new Date(d);
                            const year = timestamp.getFullYear();
                            const month = ('0' + (timestamp.getMonth() + 1)).slice(-2);
                            const date = ('0' + timestamp.getDate()).slice(-2);
                            const hours = ('0' + timestamp.getHours()).slice(-2);
                            const minutes = ('0' + timestamp.getMinutes()).slice(-2);
                            return date + '.' + month + '.' + year + ' ' + hours + ':' + minutes;
                        },
                    },
                    { 
                        title:"Actions",
                        field:"type",
                        width: 100,
                        formatter:"html" 
                    },    
                ],
                rows: [{
                    height: 33
                }],
                dataLoaded: () => {
                    if (this.submissionsTable !== null) {
                        this.changePaginationButtonText();
                    }
                }
            });

            /*
            this.submissionsTable = new Tabulator(this._('#submissions-table'), {
                layout: 'fitColumns',
                selectable: this.maxSelectedItems,
                selectableRangeMode: 'drag',
                placeholder: i18n.t('show-registrations.no-data'),
                responsiveLayout: 'collapse',
                responsiveLayoutCollapseStartOpen: false,
                resizableColumns: false,
                // autoColumns: true
                pagination: 'local',
                paginationSize: 10,
                downloadRowRange: 'selected',
                columns:[
                    {
                        align: 'center',
                        resizable: false,
                        headerSort: false,
                        formatter: 'responsiveCollapse',
                    },
                    {
                        title:
                            '<label id="select_all_wrapper" class="button-container select-all-icon">' +
                            '<input type="checkbox" id="select_all" name="select_all" value="select_all">' +
                            '<span class="checkmark" id="select_all_checkmark"></span>' +
                            '</label>',
                        field: 'type',
                        align: 'center',
                        headerSort: false,
                        width: 50,
                        responsive: 1,
                        formatter: (cell, formatterParams, onRendered) => {
                            let div = getShadowRootDocument(this).createElement('div');
                            return div;
                        },
                    },
                    {
                        title: 'Id', 
                        field: '@id',
                        widthGrow: 2,
                        formatter: function (cell, formatterParams, onRendered) {
                            const value = '' + cell.getValue();
                            const split = value.split('/');
                            return split[3]; //TODO 
                        }
                    },
                    {
                        title: 'Data', 
                        field: 'dataFeedElement',
                        widthGrow: 3
                    },
                    {
                        title: 'Date', 
                        field: 'dateCreated',
                        widthGrow: 1,
                        formatter: function (cell, formatterParams, onRendered) {
                            const d = Date.parse(cell.getValue());
                            const timestamp = new Date(d);
                            const year = timestamp.getFullYear();
                            const month = ('0' + (timestamp.getMonth() + 1)).slice(-2);
                            const date = ('0' + timestamp.getDate()).slice(-2);
                            const hours = ('0' + timestamp.getHours()).slice(-2);
                            const minutes = ('0' + timestamp.getMinutes()).slice(-2);
                            return date + '.' + month + '.' + year + ' ' + hours + ':' + minutes;
                        },
                    },
                    {
                        title: 'Actions',
                        width: 100,
                        field: 'type',
                        formatter: 'html',
                        download: false
                    },
                ],
                initialSort: [
                    {
                        column: 'dateCreated', 
                        dir: 'desc'
                    },
                ],
                rowSelectionChanged: (data, rows) => {
                    if (this.submissionsTable && this.submissionsTable.getSelectedRows().length > 0) {
                        this._('#export-select').disabled = false;
                    } else {
                        this._('#export-select').disabled = true;
                    }
                    if (this._('#select_all_checkmark')) {
                        this._('#select_all_checkmark').title = this.checkAllSelected()
                            ? i18n.t('show-registrations.select-nothing')
                            : i18n.t('show-registrations.select-all');
                    }
                    this.requestUpdate();
                },
                rowClick: (e, row) => {
                    if (!row.getElement().classList.contains('no-select')) {
                        if (this.submissionsTable !== null && 
                            this.submissionsTable.getSelectedRows().length === this.submissionsTable.getRows().length
                        ) {
                            this._('#select_all').checked = true;
                        } else {
                            this._('#select_all').checked = false;
                        }
                    } else {
                        row.deselect();
                    }
                },
            });
            */

            this.submissionsTable = new Tabulator(this._('#submissions-table'), {
                layout: "fitDataFill",
                virtualDomHoz: true,
                movableColumns: true,
                selectable: this.maxSelectedItems,
                selectableRangeMode: 'drag',
                placeholder: i18n.t('show-registrations.no-data'),
                autoColumns: true,
                resizableColumns: false,
                pagination: 'local',
                paginationSize: 10,
                downloadRowRange: 'selected',
                columns:[
                    {
                        width: 32,
                        minWidth: 32,
                        align: 'center',
                        resizable: false,
                        headerSort: false,
                        formatter: 'responsiveCollapse',
                    },

                ],
                rowSelectionChanged: (data, rows) => {
                    if (this.submissionsTable && this.submissionsTable.getSelectedRows().length > 0) {
                        this._('#export-select').disabled = false;
                    } else {
                        this._('#export-select').disabled = true;
                    }
                    if (this._('#select_all_checkmark')) {
                        this._('#select_all_checkmark').title = this.checkAllSelected()
                            ? i18n.t('show-registrations.select-nothing')
                            : i18n.t('show-registrations.select-all');
                    }
                    this.requestUpdate();
                },
                rowClick: (e, row) => {
                    if (!row.getElement().classList.contains('no-select')) {
                        if (this.submissionsTable !== null && 
                            this.submissionsTable.getSelectedRows().length === this.submissionsTable.getRows().length
                        ) {
                            this._('#select_all').checked = true;
                        } else {
                            this._('#select_all').checked = false;
                        }
                    } else {
                        row.deselect();
                    }
                },
                dataLoaded: () => {
                    if (this.submissionsTable !== null) {

                        this.changePaginationButtonText();

                      /*  this.submissionsTable.addColumn(     {
                            title:
                                '<label id="select_all_wrapper" class="button-container select-all-icon">' +
                                '<input type="checkbox" id="select_all" name="select_all" value="select_all">' +
                                '<span class="checkmark" id="select_all_checkmark"></span>' +
                                '</label>',
                            align: 'center',
                            field: 'no_display_1',
                            resizable: false,
                            headerSort: false,
                            sortable:false,
                            formatter: 'responsiveCollapse',
                            visible: true,
                        }, true);*/
                        this.submissionsTable.addColumn({
                            title:'<label id="select_all_wrapper" class="button-container select-all-icon">' +
                                '<input type="checkbox" id="select_all" name="select_all" value="select_all">' +
                                '<span class="checkmark" id="select_all_checkmark"></span>' +
                                '</label>',
                            align: 'center',
                            field: 'no_display_2',
                            width: 100,
                            formatter: 'html',
                            download: false,
                            headerSort:false,
                            sortable:false,
                            visible: true,
                        }, true);


                        if (this._('#select_all')) {
                            let boundSelectHandler = this.selectAllSubmissions.bind(this);
                            this._('#select_all').addEventListener('click', boundSelectHandler);
                        }

                       // this.addToggleEvent();

                        this.updateTableHeaderList();
                       // this.createHeaderList();

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

    changePaginationButtonText() {
        const i18n = this._i18n;
        
        let elements = [
            this._('#courses-table > .tabulator-footer > .tabulator-paginator').childNodes,
            this._('#submissions-table > .tabulator-footer > .tabulator-paginator').childNodes
        ];
        
        for (let j = 0; j < elements.length; j++) {

            let buttonList = elements[j];
            // console.log(buttonList);

            for (let i = 0; i < buttonList.length; i++) {
                let button = buttonList[i];
                let value = button.getAttribute('data-page');
                switch (value) {
                    case 'first': {
                        button.innerText = i18n.t('show-registrations.pagination-btn-first');
                        break;
                    }
                    case 'prev': {
                        button.innerText = i18n.t('show-registrations.pagination-btn-prev');
                        break;
                    }
                    case 'next': {
                        button.innerText = i18n.t('show-registrations.pagination-btn-next');
                        break;
                    }
                    case 'last': {
                        button.innerText = i18n.t('show-registrations.pagination-btn-last');
                        break;
                    }
                    default:
                        // console.log('number button detected');
                        break;
                }
            }
            // }
        }
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
        /*const i18n = this._i18n;
        
        const button_tag = this.getScopedTagName('dbp-loading-button');
        let button = `<${button_tag} name="" class="" id="summercourses-btn">` + i18n.t('show-registrations.show-submission-btn-text') + `</${button_tag}>`;
        let div = getShadowRootDocument(this).createElement('div');
        div.innerHTML = button;*/

        // Simulate fetching table data (xml)
        /*var tabledata = [
            {id:1, name:"Sommerkurse", date:"01/03/2022", type:div}
        ];
        
        div.firstChild.addEventListener("click", event => {
            this.requestAllCourseSubmissions();
            event.stopPropagation();
        });
        return tabledata;*/

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
                return;
            }
            let entry = data["hydra:member"][x];
            try {

                //let id = entry["@id"];

                let name = entry["form"];

                if (!name || courses.length > 0 && courses.includes(name)) {
                    continue;
                }
                let date = entry["dateCreated"];

                const button_tag = this.getScopedTagName('dbp-loading-button');
                let button = `<${button_tag} name="" class="" id="courses-btn">` + i18n.t('show-registrations.show-submission-btn-text') + `</${button_tag}>`;
                let div = getShadowRootDocument(this).createElement('div');
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

        await this.getListOfAllCourses();
        //this.coursesTable.setData(this.getListOfAllCourses());
    }
    
    async requestAllCourseSubmissions(name) {
        let dataList2 = [];
        let response = await this.getAllSubmissions();
        let data = await response.json();

        if (!data || !data["hydra:member"]) {
            this.showSubmissionsTable = true;
            return;
        }

        for(let x = 0; x <= data["hydra:member"].length; x++) {
            if (x === data["hydra:member"].length) {
                this.submissionsTable.setData(dataList2);
                this.activeCourse = name;
                this.showSubmissionsTable = true;
                return;
            }
            let entry = data["hydra:member"][x];
            try {
                if(entry && entry["form"] !== name)
                    continue;

                let json = JSON.parse(entry["dataFeedElement"]);
                dataList2.push(json);
            } catch(e) {
                 console.log('error');
            }

        }

        /*data["hydra:member"].forEach(entry => {
            // let id = entry["@id"].split('/')[3]; //TODO
            // console.log('id:', id);

            // const button_tag = this.getScopedTagName('dbp-loading-button');    
            // let button = `<${button_tag} name="" class="" id="` + id + `">Show</${button_tag}>`;
            // let div = getShadowRootDocument(this).createElement('div');
            // div.innerHTML = button;
            
            // div.firstChild.addEventListener("click", event => {
            //     this.requestDetailedSubmission(id);
            //     console.log('event target id:', event.target.id);
            //     let path = '';
            //     if (id === event.target.id) {
            //         path = id;
            //     }
            //     event.stopPropagation();
            // });

            // entry['type'] = div;

            try {
                let json = JSON.parse(entry["dataFeedElement"]);
                dataList2.push(json);
            } catch(e) {
                // console.log('error');
            }
        });
        this.submissionsTable.setData(dataList2);
        this.showSubmissionsTable = true;*/
    }

    async requestDetailedSubmission(identifier) {
        const i18n = this._i18n;

        let response = await this.getSubmissionForId(identifier);
        let data = await response.json();

        console.log("data: ", data);
        console.log("dataFeedElement: ", data["dataFeedElement"]);

        this._('#submission-modal-title').innerText = i18n.t('show-registrations.submission-dialog-title', {id: identifier});
        this._('.submission-modal-content-wrapper').innerText = data["dataFeedElement"];


    }

    exportPdf() {


        this.submissionsTable.download("pdf", "data.pdf", {
            orientation:"portrait", //set page orientation to portrait
            autoTable:function(doc){
                //doc - the jsPDF document object

                //add some text to the top left corner of the PDF
                doc.text("SOME TEXT", 1, 1);

                //return the autoTable config options object
                return {
                    styles: {
                        fillColor: [200, 0o0, 0o0]
                    },
                };
            },
        });

    }

    exportXLSX() {
        window.XLSX = XLSX;
        this.submissionsTable.download("xlsx", "data.xlsx", {sheetName:"My Data"});
        delete window.XLSX;
    }

    filterTable() {
        let filter = this._('#searchbar');
        let search = this._('#search-select');

        if (!filter || !search)
            return;

        filter = filter.value;
        search = search.value;

        if (search !== 'all') {
            this.submissionsTable.setFilter(search, 'like', filter);
            return;
        }

        //custom filter function
        function matchAny(data, filterParams) {
            var match = false;

            let searchKey = filterParams.value.toLowerCase();

            for (var key in data) {
                //console.log("key: " + key + "; data[key]: " + data[key]);
                let data_lowecase = String(data[key]).toLowerCase();
                if (data_lowecase.includes(searchKey)) {
                    match = true;
                }
            }

            return match;
        }

        this.submissionsTable.setFilter(matchAny, {value: filter});
    }

    updateTableHeaderList() {
        if (!this.submissionsTable)
            return;
        let columns = this.submissionsTable.getColumns();
        columns.forEach((col) => {
            let name = col.getDefinition().title;
            let field = col.getDefinition().field;
            if (field && !field.includes('no_display')) {
                this.submissionsColumns.push(name);
            }
        });
    }

    getTableHeaderOptions() {
        if (!this.submissionsTable)
            return;
        let options = [];
        options[0] = html`<option value="all">Alle Spalten</option>`;
        this.submissionsColumns.forEach((col, counter) => {
            options[counter + 1]= html`<option value="${col}">${col}</option>`;
        });
        return options;
    }

    createHeaderList() {
        if (this.submissionsColumns.length <= 0)
        {
            this.closeModal();
            console.log("Header list empty");
            return;
        }
        this.createList();
    }

/*
    createList() {
        const draggable_list = this._('#draggable-list');
        const check = this._('#check');
        if (!draggable_list || !check)
        {
            this.closeModal();
            console.log("Error");
            return;
        }

        [...this.submissionsColumns]
            .forEach((col, index) => {
                const listItem = document.createElement('li');

                listItem.setAttribute('data-index', index);

                listItem.innerHTML = `
                    <div class="draggable" draggable="true">
                      <span class="number">${index + 1}</span>
                      <p class="col-name">${col}</p>
                    </div>
                  `;
                this.dragList.push(listItem);

                draggable_list.appendChild(listItem);
            });

        this.addEventListeners();
    }

    dragStart(e) {
        console.log("---------e", e);
        this.dragStartIndex = +e.originalTarget.closest('li').getAttribute('data-index');

        e.target.style.backgroundColor = 'green';

    }

    dragEnter(e) {
        console.log('Event: ', 'dragenter');
        const dragEnterIndex = +e.originalTarget.closest('li').getAttribute('data-index');
        if (dragEnterIndex !== this.dragStartIndex) {
            this.swapItems(this.dragStartIndex, dragEnterIndex);
            this.dragStartIndex = dragEnterIndex;
        }
        this.dragPos = dragEnterIndex;
        this.classList.add('over');
    }

    dragLeave(e) {
        console.log('Event: ', 'dragleave', e);
        this.classList.remove('over');
        // first item
        if (this.dragPos === this.dragList.length)
    }

    dragOver(e) {
        console.log('Event: ', 'dragover');
        e.preventDefault();
    }

    dragDrop(e) {
        console.log('Event: ', 'drop');
        e.target.style.backgroundColor = 'white';

        const dragEndIndex = +e.originalTarget.closest('li').getAttribute('data-index');
        this.swapItems(this.dragStartIndex, dragEndIndex);

        this.classList.remove('over');
    }

    // Swap list items that are drag and drop
    swapItems(fromIndex, toIndex) {
        const itemOne = this.dragList[fromIndex].querySelector('.draggable');
        const itemTwo = this.dragList[toIndex].querySelector('.draggable');

        this.dragList[fromIndex].appendChild(itemTwo);
        this.dragList[toIndex].appendChild(itemOne);
    }

    // Check the order of list items
    saveOrder() {
        let newSubmissionsColumns = [];
        this.dragList.forEach((listItem, index) => {
            const col = listItem.querySelector('.draggable').innerText.trim();
            newSubmissionsColumns.push(col);
        });
        this.submissionsColumns = [...newSubmissionsColumns];
        this.updateTableHeader();
    }

    updateTableHeader() {
        let cols = this.submissionsTable.getColumns();
        this.submissionsColumns.slice().reverse().forEach((col) => {
            this.submissionsTable.moveColumn(col, cols[1], true);
        });

        this.submissionsTable.redraw();
        this.closeModal();
        this.addToggleEvent();
    }

    addEventListeners() {
        const draggables = this._a('.draggable');
        const dragListItems = this._a('.draggable-list li');

        if(!draggables || !dragListItems)
            return;

        draggables.forEach(draggable => {
            draggable.addEventListener('dragstart', this.dragStart.bind(this), false);
        });

        dragListItems.forEach(item => {
            item.addEventListener('dragover', this.dragOver.bind(this), false);
            item.addEventListener('drop', this.dragDrop.bind(this), false);
            item.addEventListener('dragenter', this.dragEnter.bind(this), false);
            item.addEventListener('dragleave', this.dragLeave.bind(this), false);
        });
    }
    */


    openModal() {
        let modal = this._('#submission-modal');
        if (modal) {
            MicroModal.show(modal, {

            });
        }
    }

    closeModal() {
        let modal = this._('#submission-modal');
        if (modal) {
            MicroModal.close(modal);
        }
    }

    showSearchModal() {
        //TODO
    }

    showExportModal() {
        //TODO
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

    hideAdditionalMenu() {
        if (this.initateOpenAdditionalMenu) {
            this.initateOpenAdditionalMenu = false;
            return;
        }
        const menu = this.shadowRoot.querySelector('ul.extended-menu');
        if (menu && !menu.classList.contains('hidden')) this.toggleMoreMenu();
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
            
            ${fileHandlingStyles.getDragListCss()}
            ${commonStyles.getButtonCSS()}

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
 
             .tabulator-row {
                 overflow: auto;
             }
 
             .back-navigation {
                 padding-top: 1rem;
             }
 
             .back-navigation {
                 color: var(--dbp-border);
                 
             }
 
             .back-navigation:before {
                 content: '\\00a0\\00a0\\00a0';
                 background-color: var(--dbp-content);
                 -webkit-mask-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3Csvg version='1.1' id='Layer_2_1_' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='0 0 100 100' style='enable-background:new 0 0 100 100;' xml:space='preserve'%3E%3Cpath d='M70.4,2.4L26.2,46.8c-0.9,0.9-1.3,2.1-1.3,3.3c0,1.2,0.5,2.4,1.3,3.3l44.2,44.2c1.1,1.1,2.8,1.1,3.9,0 c0.5-0.5,0.8-1.2,0.8-1.9c0-0.7-0.3-1.4-0.8-1.9L30.7,50.1L74.3,6.3c1.1-1.1,1.1-2.8,0-3.9C73.2,1.3,71.5,1.3,70.4,2.4z'/%3E%3C/svg%3E%0A");
                 mask-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3Csvg version='1.1' id='Layer_2_1_' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='0 0 100 100' style='enable-background:new 0 0 100 100;' xml:space='preserve'%3E%3Cpath d='M70.4,2.4L26.2,46.8c-0.9,0.9-1.3,2.1-1.3,3.3c0,1.2,0.5,2.4,1.3,3.3l44.2,44.2c1.1,1.1,2.8,1.1,3.9,0 c0.5-0.5,0.8-1.2,0.8-1.9c0-0.7-0.3-1.4-0.8-1.9L30.7,50.1L74.3,6.3c1.1-1.1,1.1-2.8,0-3.9C73.2,1.3,71.5,1.3,70.4,2.4z'/%3E%3C/svg%3E%0A");
                 -webkit-mask-repeat: no-repeat;
                 mask-repeat: no-repeat;
                 -webkit-mask-position: center -2px;
                 mask-position: center 37%;
                 margin: 0 0 0 4px;
                 padding: 0 0 0.25% 0;
                 -webkit-mask-size: 100%;
                 mask-size: 120%;
             }
 
             .back-navigation:hover {
                 color: var(--dbp-hover-color, var(--dbp-content));
                 border-color: var(--dbp-hover-color, var(--dbp-content));
                 background-color: var(--dbp-hover-background-color);
             }
 
             .back-navigation:hover::before {
                 background-color: var(--dbp-hover-color, var(--dbp-content));
             }
 
             .export-buttons {
                 display: flex;
                 flex-direction: row;
                 justify-content: flex-end;
                 gap: 4px;
             }
 
             .dragAndDropList {
                 overflow: auto;
             }
 
             .modal-container {
                 display: flex;
                 flex-direction: column;
                 justify-content: space-between;
                 text-align: center;
                 height: unset;
             }
 
             #submission-modal-content {
                 overflow: scroll;
                 align-items: baseline;
             }
             
             .modal-footer-btn {
                 float: right;
                 padding-right: 20px;
                 padding-bottom: 20px;
             }
 
             .export-buttons {
                 padding-top: 1rem;
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
 
             #courses-table .tabulator-cell {
                 height: 33px;
             }
 
             span.first {
                 margin-left: -6px;
             }
 
             select:not(.select) {
                 background-size: 13px;
                 background-position-x: calc(100% - 0.4rem);
                 padding-right: 1.3rem;
                 height: 26px;
             }
 
             select[disabled] {
                 opacity: 0.4;
                 cursor: not-allowed;
             }
 
             #searchbar {
                 height: 27px;
             }
 
             .search-wrapper {
                 display: flex;
             }
 
             .additional-menu {
                 display: none;
             }
 
             @media only screen and (orientation: portrait) and (max-width: 768px) {
 
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
                     position: inherit; /** absolute */
                    /** margin-right: -12px; */
                }

                .additional-menu button {
                    float: right;
                }

                .extended-menu-link {
                    padding: 7px;
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
                    margin: 4px 0 0 0;
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

                .nextcloud-nav {
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
                    <slot name="additional-information">
                        <p>
                            ${i18n.t('show-registrations.additional-information')}
                        </p>
                    </slot>
                </div>

                <div class="border-wrapper"></div>

                <div class="table-wrapper ${classMap({hidden: this.showSubmissionsTable })}">
                    <table id="courses-table"></table>
                </div>

                <div class="table-wrapper ${classMap({hideWithoutDisplay: !this.showSubmissionsTable })}">
                    <h3>${this.activeCourse}</h3>
                    <div class="nextcloud-nav ${classMap({hidden: !this.showSubmissionsTable})}">
                        <span class="back-navigation ${classMap({hidden: !this.showSubmissionsTable })}">
                            <a
                                @click="${() => {
                                    this.showSubmissionsTable = false;
                                    this.submissionsTable.clearData();
                                }}"
                                title="${i18n.t('show-registrations.back-text')}">
                                ${i18n.t('show-registrations.back-text')}
                            </a>
                        </span>
                        <div class="additional-menu ${classMap({hidden: !this.showSubmissionsTable })}">
                            <a class="extended-menu-link"
                                @click="${() => {
                                    this.toggleMoreMenu();
                                }}"
                                title="${i18n.t('nextcloud-file-picker.more-menu')}">
                                <dbp-icon name="menu-dots" class="more-menu"></dbp-icon>
                            </a>
                            <ul class="extended-menu hidden">
                                <li class="${classMap({active: false})}">
                                    <a class="" @click="${this.showSearchModal}">
                                        ${i18n.t('show-registrations.searchbar-placeholder')}
                                    </a>
                                </li>
                                <li class="${classMap({active: false})}">
                                    <a class="" @click="${this.showExportModal}">
                                        ${i18n.t('show-registrations.default-export-select')}
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
                    <div class="export-buttons">
                        <div class="search-wrapper">
                            <select id="search-select">
                               ${this.getTableHeaderOptions()}
                            </select>
                            <input type="text" id="searchbar" placeholder="${i18n.t('show-registrations.searchbar-placeholder')}"/>
                            <dbp-button class="button" id="search-button" title="${i18n.t('show-registrations.shearch-button')}"
                                                class="button" @click="${() => { this.filterTable(); }}"> 
                                <dbp-icon name="search"></dbp-icon>

                            </dbp-button>
                        </div>
                        <select id="export-select">
                            <option value="" disabled selected>${i18n.t('show-registrations.default-export-select')}</option>
                            <option value="csv" @click="${() => { this.submissionsTable.download("csv", "data.csv"); }}">CSV</option>
                            <option value="excel" @click="${() => { this.exportXLSX(); }}">Excel</option>
                            <option value="pdf" @click="${() => { this.exportPdf(); }}">PDF</option>
                        </select>
                        <!--<dbp-loading-button id="download-pdf" @click="${() => {this.openModal();}}">${i18n.t('show-registrations.filter-options-button-text')}</dbp-loading-button>-->
                    </div>
                    <div class="scrollable-table-wrapper">   
                        <table id="submissions-table"></table>
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
                            <h3 id="submission-modal-title">
                            </h3>
                        </header>
                        <main class="modal-content" id="submission-modal-content">
                            <div class="dragAndDropList">
                                <p>Drag and drop the items into their corresponding spots</p>
                                <ul class="draggable-list" id="draggable-list"></ul>
                                <button class="check-btn" id="check" @click="${() => {this.saveOrder();}}">
                                    Check Order
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </main>
                        <footer class="modal-footer">
                            <div class="modal-footer-btn">
                            </div>
                        </footer>
                    </div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-show-registrations', ShowRegistrations);
