import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {createInstance} from './i18n';
import {send} from '@dbp-toolkit/common/notification.js';
import {getStackTrace} from '@dbp-toolkit/common/src/error.js';
import {AuthMixin, LangMixin} from '@dbp-toolkit/common';

export default class DBPFormalizeLitElement extends LangMixin(
    AuthMixin(DBPLitElement),
    createInstance,
) {
    constructor() {
        super();
        this._initialized = false;
        this.entryPointUrl = '';
        this.basePath = '';
    }

    static get properties() {
        return {
            ...super.properties,
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            basePath: {type: String, attribute: 'base-path'},
        };
    }

    connectedCallback() {
        super.connectedCallback();
    }

    loginCallback() {
        if (!this._initialized) {
            this.initialize();
            this._initialized = true;
        }
    }

    initialize() {}

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {});

        super.update(changedProperties);
    }

    /**
     * Returns true if a person has successfully logged in
     * @returns {boolean} true or false
     */
    isLoading() {
        return this.isAuthPending();
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
            stack: getStackTrace().slice(1, 6),
        };

        this.sendSetPropertyEvent('analytics-event', {
            category: category,
            action: action,
            name: JSON.stringify(data),
        });
    }
}
