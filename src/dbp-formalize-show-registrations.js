import {createInstance} from './i18n.js';
import {css, html} from 'lit';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Icon} from '@dbp-toolkit/common';
import * as commonStyles from '@dbp-toolkit/common/styles';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import metadata from './dbp-formalize-show-registrations.metadata.json';
import {Activity} from './activity.js';
import {TabulatorTable} from '@dbp-toolkit/tabulator-table';

class ShowRegistrations extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.activity = new Activity(metadata);
        this.auth = null;
        this.name = null;
        this.entryPointUrl = null;
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-tabulator-table': TabulatorTable,
        };
    }

    static get properties() {
        return {
            lang: {type: String},
            auth: {type: Object},
            name: {type: String},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
        };
    }

    connectedCallback() {
        super.connectedCallback();
        this.updateComplete.then(() => {
            this._a('.tabulator-table-demo').forEach((table) => {
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
            }
        });

        super.update(changedProperties);
    }

    static get styles() {
        return [
            commonStyles.getThemeCSS(),
            css`
                .hidden {
                    display: none;
                }
            `,
        ];
    }

    async onClick(event) {
        let response = await fetch(this.entryPointUrl + '/base/people/' + this.auth['user-id'], {
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
        });
        if (!response.ok) {
            throw new Error(response);
        }

        let data = await response.json();
        this.name = `${data['givenName']} ${data['familyName']}`;
    }

    render() {
        let data = [
            {id: 1, name: 'Oli Bob', age: '12', col: 'red', dob: ''},
            {id: 2, name: 'Mary May', age: '1', col: 'blue', dob: '14/05/1982'},
            {id: 3, name: 'Christine Lobowski', age: '42', col: 'green', dob: '22/05/1982'},
            {id: 4, name: 'Brendon Philips', age: '95', col: 'orange', dob: '01/08/1980'},
            {id: 5, name: 'Margret Marmajuke', age: '16', col: 'yellow', dob: '31/01/1999'},
        ];

        let options = {
            layout: 'fitColumns',
            columns: [
                {title: 'Name', field: 'name', width: 150},
                {title: 'Age', field: 'age', hozAlign: 'left', formatter: 'progress'},
                {title: 'Favourite Color', field: 'col'},
                {title: 'Date Of Birth', field: 'dob', sorter: 'date', hozAlign: 'center'},
            ],
            columnDefaults: {
                vertAlign: 'middle',
                hozAlign: 'left',
                resizable: false,
            },
        };
        let loggedIn = this.auth && this.auth.token;
        let i18n = this._i18n;

        return html`
            <h3>${this.activity.getName(this.lang)}</h3>
            <p>${this.activity.getDescription(this.lang)}</p>

            <div class="${loggedIn ? '' : 'hidden'}">
                <div class="container">
                    <dbp-tabulator-table
                            lang="${this.lang}"
                            class="tabulator-table-demo"
                            id="tabulator-table-demo-1"
                            data=${JSON.stringify(data)}
                            options=${JSON.stringify(options)}></dbp-tabulator-table>
                </div>
                
            </div>

            

            <div class="${!loggedIn ? '' : 'hidden'}">
                <p>${i18n.t('please-log-in')}</p>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-show-registrations', ShowRegistrations);
