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
import MicroModal from './micromodal.es';
import {name as pkgName} from './../package.json';
import * as fileHandlingStyles from './styles';
import metadata from './dbp-formalize-show-registrations.metadata.json';

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
        this.directoryPath = '/';
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
            directoryPath: {type: String, attribute: 'directory-path'},
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
                }]
            });

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
                    {column: 'dateCreated', dir: 'desc'},
                ],
                rowSelectionChanged: (data, rows) => {
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
        });
    }

    async firstUpdated() {
        // Give the browser a chance to paint
        await new Promise((r) => setTimeout(r, 0));
        if (this._('#select_all')) {
            let boundSelectHandler = this.selectAllSubmissions.bind(this);
            this._('#select_all').addEventListener('click', boundSelectHandler);
        }
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
    getListOfAllCourses() {
        const button_tag = this.getScopedTagName('dbp-loading-button');    
        let button = `<${button_tag} name="" class="" id="summercourses-btn">Show</${button_tag}>`;
        let div = getShadowRootDocument(this).createElement('div');
        div.innerHTML = button;

        // Simulate fetching table data (xml)
        var tabledata = [
            {id:1, name:"Sommerkurse", date:"01/03/2022", type:div}
        ];
        
        div.firstChild.addEventListener("click", event => {
            this.requestAllCourseSubmissions();

            let path = '';
            tabledata.forEach((element) => {
                if (element['id'] === event.detail) {
                    path = element['name'];
                }
            });
            this.directoryPath = '/' + path;

            event.stopPropagation();
        });
        return tabledata;
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

    requestCourses() {
        this.coursesTable.setData(this.getListOfAllCourses());
    }

    async requestAllCourseSubmissions() {
        let response = await this.getAllSubmissions();
        let data = await response.json();

        console.log("data: ", data["hydra:member"]);

        data["hydra:member"].forEach(entry => {
            let id = entry["@id"].split('/')[3]; //TODO
            // console.log('id:', id);

            const button_tag = this.getScopedTagName('dbp-loading-button');    
            let button = `<${button_tag} name="" class="" id="` + id + `">Show</${button_tag}>`;
            let div = getShadowRootDocument(this).createElement('div');
            div.innerHTML = button;
            
            div.firstChild.addEventListener("click", event => {
                this.doDetailedRequest(id);
                console.log('event target id:', event.target.id);
                let path = '';
                if (id === event.target.id) {
                    path = id;
                }
                this.directoryPath += '/' + path; 
                event.stopPropagation();
            });

            entry['type'] = div;
        });

        this.submissionsTable.setData(data['hydra:member']);
        this.showSubmissionsTable = true;
    }

    async doDetailedRequest(identifier) {
        const i18n = this._i18n;

        let response = await this.getSubmissionForId(identifier);
        let data = await response.json();

        console.log("data: ", data);
        console.log("dataFeedElement: ", data["dataFeedElement"]);

        this._('#submission-modal-title').innerText = i18n.t('show-registrations.submission-dialog-title', {id: identifier});
        this._('.submission-modal-content-wrapper').innerText = data["dataFeedElement"];

        MicroModal.show(this._('#submission-modal'));
    }

    exportPdf() {
        //TODO
        console.log('PDF export requested');
    }

    /**
     * Returns clickable breadcrumbs
     *
     * @returns {string} clickable breadcrumb path
     */
     getBreadcrumb() {
        const i18n = this._i18n;
        if (typeof this.directoryPath === 'undefined') {
            this.directoryPath = '';
        }
        let htmlpath = [];
        htmlpath[0] = html`
            <span class="breadcrumb">
                <a
                    class="home-link"
                    @click="${() => {
                        this.showSubmissionsTable = false;
                        this.submissionsTable.clearData();
                        this.directoryPath = '/';
                    }}"
                    title="${i18n.t('show-registrations.folder-home')}">
                    <dbp-icon name="home"></dbp-icon>
                </a>
            </span>
        `;

        const directories = this.directoryPath.split('/');
        if (directories[1] === '') {
            return htmlpath;
        }
        
        htmlpath[1] = html`
            <span class="first breadcrumb-arrow">›</span>
            <span class="breadcrumb">${directories[1]}</span>
        `;
        return htmlpath;
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getModalDialogCSS()}
            ${commonStyles.getRadioAndCheckboxCss()}
            ${commonStyles.getNotificationCSS()}
            ${commonStyles.getActivityCSS()}
            ${fileHandlingStyles.getFileHandlingCss()}

            .submission-modal-content-wrapper {
                overflow: auto;
            }

            .modal-container {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                text-align: center;
                height: unset;
            }

            .modal-footer-btn {
                float: right;
                padding-right: 20px;
                padding-bottom: 20px;
            }

            .table-wrapper {
                padding-top: 1rem;
            }

            .border-wrapper {
                margin-top: 2rem;
                padding-top: 1rem;
                border-top: 1px solid black;
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
                top: 1px; /*4px*/
            }

            .tabulator-cell[tabulator-field="type"] {
                padding: 0;
            }

            .tabulator-cell {
                height: 33px;
            }

            a.home-link {
                padding-left: 6px;
                padding-right: 6px;
                margin-left: -6px;
            }

            span.first {
                margin-left: -6px;
            }

            .nextcloud-nav a.home-link {
                font-size: 1.4em;
            }

            .breadcrumb-folder {
                padding-right: 5px;
                color: var(--dbp-muted);
                font-size: 1.4em;
                padding-top: 7px;
            }

            .breadcrumb.special a {
                overflow: visible;
            }

            .breadcrumb {
                border-bottom: var(--dbp-border);
            }

            .breadcrumb:last-child,
            .breadcrumb:first-child {
                border-bottom: none;
            }

            .breadcrumb a {
                display: inline-block;
                height: 33px;
                vertical-align: middle;
                line-height: 33px;
            }

            .breadcrumb-menu {
                display: inline;
            }

            @media only screen and (orientation: portrait) and (max-width: 768px) {

                .nextcloud-nav .home-link {
                    font-size: 1.2rem;
                }

                .breadcrumb-arrow {
                    font-size: 1.6em;
                    vertical-align: middle;
                    padding-bottom: 3px;
                    padding-left: 2px;
                    padding-right: 2px;
                    /**padding: 0px 2px 2px 3px;*/
                }

                .breadcrumb .extended-breadcrumb-menu a {
                    /* overflow: visible; */
                    display: inherit;
                }

                .select-all-icon {
                    height: 32px;
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

        if (this.coursesTable) {
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

                <div class="nextcloud-nav">
                    <p>${this.getBreadcrumb()}</p>
                </div>

                <div class="table-wrapper ${classMap({hidden: this.showSubmissionsTable })}">
                    <table id="courses-table"></table>
                </div>

                <div class="table-wrapper ${classMap({hidden: !this.showSubmissionsTable })}">
                    <div class="export-buttons">
                        <dbp-loading-button id="download-csv" class="button" @click="${() => { this.submissionsTable.download("csv", "data.csv"); }}">Export CSV</dbp-loading-button>
                        <dbp-loading-button id="download-xlsx" class="button" @click="${() => { this.submissionsTable.download("xlsx", "data.xlsx", {sheetName:"My Data"}); }}">Export XLSX</dbp-loading-button>
                        <dbp-loading-button id="download-pdf" class="button" @click="${() => { this.exportPdf(); }}">Export PDF</dbp-loading-button>
                    </div>         
                    <table id="submissions-table"></table>
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
                            <div class="submission-modal-content-wrapper"></div>
                        </main>
                        <footer class="modal-footer">
                            <div class="modal-footer-btn">
                                <dbp-loading-button
                                    class="button"
                                    @click="${() => {
                                        //TODO download single file
                                    }}">
                                    Export CSV
                                </dbp-loading-button>
                                <dbp-loading-button
                                    class="button"
                                    id=""
                                    @click="${() => {
                                        //TODO download single file
                                    }}">
                                    Export XLSX
                                </dbp-loading-button>
                                <dbp-loading-button
                                    class="button"
                                    id=""
                                    @click="${() => {
                                        //TODO download single file
                                    }}">
                                    Export PDF
                                </dbp-loading-button>
                            </div>
                        </footer>
                    </div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-show-registrations', ShowRegistrations);
