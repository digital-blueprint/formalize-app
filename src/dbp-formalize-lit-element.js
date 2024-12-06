import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {createInstance} from './i18n';
import {send} from '@dbp-toolkit/common/notification.js';

export default class DBPFormalizeLitElement extends DBPLitElement {
    constructor() {
        super();
        this.auth = {};
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.basePath = '';
    }

    static get properties() {
        return {
            ...super.properties,
            auth: {type: Object},
            lang: {type: String},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            basePath: {type: String, attribute: 'base-path'},
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this._loginStatus = '';
        this._loginState = [];
    }

    /**
     *  Request a re-rendering every time isLoggedIn()/isLoading() changes
     */
    _updateAuth() {
        this._loginStatus = this.auth['login-status'];

        let newLoginState = [this.isLoggedIn(), this.isLoading()];
        if (this._loginState.toString() !== newLoginState.toString()) {
            this.requestUpdate();
        }
        this._loginState = newLoginState;
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
     * Returns if a person is set in or not
     * @returns {boolean} true or false
     */
    isLoggedIn() {
        return this.auth.person !== undefined && this.auth.person !== null;
    }

    /**
     * Returns true if a person has successfully logged in
     * @returns {boolean} true or false
     */
    isLoading() {
        if (this._loginStatus === 'logged-out') return false;
        return !this.isLoggedIn() && this.auth.token !== undefined;
    }

    /**
     * Send a fetch to given url with given options
     * @param url
     * @param options
     * @returns {object} response (error or result)
     */
    async httpGetAsync(url, options) {
        return await fetch(url, options)
            .then((result) => {
                if (!result.ok) throw result;
                return result;
            })
            .catch((error) => {
                return error;
            });
    }

    handleErrorResponse(response) {
        switch (response.status) {
            case 401:
                send({
                    summary: this._i18n.t('errors.unauthorized-title'),
                    body: this._i18n.t('errors.unauthorized-body'),
                    type: 'danger',
                    timeout: 5,
                });
                break;
            case 403:
                send({
                    summary: this._i18n.t('errors.unauthorized-title'),
                    body: this._i18n.t('errors.unauthorized-body'),
                    type: 'danger',
                    timeout: 5,
                });
                break;
            case 404:
                send({
                    summary: this._i18n.t('errors.notfound-title'),
                    body: this._i18n.t('errors.notfound-body'),
                    type: 'danger',
                    timeout: 5,
                });
                break;
            case 422: // unprocessable entity
                send({
                    summary: this._i18n.t('errors.unprocessable_entity-title'),
                    body: this._i18n.t('errors.unprocessable_entity-body'),
                    type: 'danger',
                    timeout: 5,
                });
                break;
            default:
                send({
                    summary: this._i18n.t('errors.other-title'),
                    body: this._i18n.t('errors.other-body'),
                    type: 'danger',
                    timeout: 5,
                });
        }
        //throw new Error(response);
    }
}
