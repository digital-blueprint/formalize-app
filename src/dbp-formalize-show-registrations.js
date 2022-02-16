import {createInstance} from './i18n.js';
import {css, html} from 'lit';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {LoadingButton, Icon} from '@dbp-toolkit/common';
import {classMap} from 'lit/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles';
// import { send } from '@dbp-toolkit/common/notification';
import {Activity} from './activity.js';
import metadata from './dbp-formalize-show-registrations.metadata.json';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
// import Tabulator from 'tabulator-tables';
// import {name as pkgName} from './../package.json';

class ShowRegistrations extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.auth = {};
        this.activity = new Activity(metadata);
        this.submissionsTable = null;
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-loading-button': LoadingButton,
        };
    }

    static get properties() {
        return {
            lang: {type: String},
            auth: { type: Object },
        };
    }

    disconnectedCallback() {
        window.removeEventListener('message', this._onReceiveWindowMessage);
        super.disconnectedCallback();
    }

    connectedCallback() {
        super.connectedCallback();
        // const i18n = this._i18n;
        this._loginStatus = '';
        this._loginState = [];

        this.updateComplete.then(() => {
            // see: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
            window.addEventListener('message', this._onReceiveWindowMessage);
            // see: http://tabulator.info/docs/4.7
            // this.submissionsTable = new Tabulator("#submissions-table", {
            //     layout: 'fitColumns',
            //     selectable: this.maxSelectedItems,
            //     selectableRangeMode: 'drag',
            //     placeholder: i18n.t('show-registrations.no-data'),
            //     responsiveLayout: 'collapse',
            //     responsiveLayoutCollapseStartOpen: false,
            //     resizableColumns: false,
            //     autoColumns: true,
            //     data: this.getListOfAllSubmissions(),
            // });
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
     * Gets the list of submissions
     *
     * @returns {object} response
     */
    async getListOfAllSubmissions() {
        // Simulate fetching table data (xml)
        var tabledata = [{id:1, name:"Sommerkurse", col:"red", date:"01/03/2022"}];

        return tabledata;
    }

    /**
     * Gets the list of submissions
     *
     * @returns {object} response
     */
    async getAllSubmissions() {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
        };

        return await this.httpGetAsync(this.entryPointUrl + '/formalize/submissions', options);
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

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getNotificationCSS()}
            ${commonStyles.getActivityCSS()}
        `;
    }

    render() {
        const i18n = this._i18n;
        // const tabulatorCss = commonUtils.getAssetURL(
        //     pkgName,
        //     'tabulator-tables/css/tabulator.min.css'
        // );

        return html`
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
             
            </div>

            <div class="table-wrapper">
                <table id="submissions-table" class=""></table>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-show-registrations', ShowRegistrations);
