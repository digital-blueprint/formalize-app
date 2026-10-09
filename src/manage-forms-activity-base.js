// @ts-nocheck
import {html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {ScopedElementsMixin, Icon, MiniSpinner} from '@dbp-toolkit/common';
import {setOverridesByGlobalCache} from '@dbp-toolkit/common/i18next.js';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';
import {GetDetailsButton} from './table-components.js';
import {ManageFormsOverviewPage} from './manage-forms-overview-page.js';
import {loadModules, getListOfAllForms} from './manage-forms-api.js';
import {
    ROUTING_URL_CHANGE_EVENT,
    getRoutingUrlWithQueryPrefixes,
    getQueryString,
} from './manage-forms-routing.js';
import {getManageFormsActivityStyles} from './manage-forms-activity-styles.js';

// Accept JSON arrays and comma-separated HTML attribute values for frontendKey lists.
export function parseFormListAttribute(value) {
    if (Array.isArray(value)) {
        return value.map((item) => `${item}`.trim()).filter((item) => item !== '');
    }

    if (typeof value !== 'string') {
        return [];
    }

    const trimmedValue = value.trim();

    if (trimmedValue === '') {
        return [];
    }

    try {
        const parsedValue = JSON.parse(trimmedValue);
        if (Array.isArray(parsedValue)) {
            return parsedValue.map((item) => `${item}`.trim()).filter((item) => item !== '');
        }
    } catch {
        // Fallback to comma-separated values for HTML attributes.
    }

    return trimmedValue
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
}

/**
 * Base class of the manage-forms and manage-submissions activities.
 *
 * Loads the form modules and the form list, renders the shared forms overview and
 * forwards routing URL changes requested by sub-components to the app shell.
 *
 * Subclasses customize the behavior with:
 * - `static get activityName()`: used for storage keys and the action context
 * - `getFormsCollectionFilters()`: query parameters of the form collection request
 * - `isFormListed(entry)`: whether a form entry from the API is shown
 * - `createDefaultOverviewActions()`: the built-in overview actions
 * - `handleRoute()`: shows the view matching the current routing URL
 */
export class ManageFormsActivityBase extends ScopedElementsMixin(DBPFormalizeLitElement) {
    constructor() {
        super();
        this.allForms = [];
        /** @type {Map<string, object>} Form entries by form identifier */
        this.forms = new Map();
        /** @type {Map<string, {formId: string, formSlug: string, formName: string|null, moduleInstance: object}>} */
        this.loadedModules = new Map();
        this.isLoadingModules = false;
        // Holds the in-flight loadModules() promise so concurrent callers await
        // the same load instead of returning early while modules resolve.
        this.loadModulesPromise = null;
        // Maps a form identifier to its grantedActions array.
        this.formsGrantedActions = new Map();
        this.formsOverviewActionDefinitions = [];
        this.allowListFrontendKeys = [];
        this.denyListFrontendKeys = [];
        this.loadingFormsTable = false;
        this.showFormsTable = false;
        this.noFormsAvailable = false;
        this.loadCourses = true;
        this.storeSession = true;
        this._overridesReady = null;
        this.addEventListener(ROUTING_URL_CHANGE_EVENT, (event) =>
            this.handleRoutingUrlChangeRequest(/** @type {CustomEvent} */ (event)),
        );
    }

    /**
     * @returns {string}
     */
    static get activityName() {
        return 'manage-forms';
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            // Used for the row action buttons created in getListOfAllForms()
            'dbp-formalize-get-details-button': GetDetailsButton,
            'dbp-formalize-manage-forms-overview-page': ManageFormsOverviewPage,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            allForms: {type: Array, attribute: false},
            forms: {type: Object, attribute: false},
            formsOverviewActionDefinitions: {type: Array, attribute: false},
            loadingFormsTable: {type: Boolean, attribute: false},
            showFormsTable: {type: Boolean, attribute: false},
            noFormsAvailable: {type: Boolean, attribute: false},
            // List of frontendKey values to include; forms without a matching frontendKey are hidden.
            allowListFrontendKeys: {
                type: Array,
                attribute: 'allow-list-frontend-keys',
                converter: {fromAttribute: parseFormListAttribute},
            },
            // List of frontendKey values to exclude; forms with a matching frontendKey are hidden.
            denyListFrontendKeys: {
                type: Array,
                attribute: 'deny-list-frontend-keys',
                converter: {fromAttribute: parseFormListAttribute},
            },
        };
    }

    /**
     * Query parameters added to the form collection request.
     * @returns {Record<string, string>}
     */
    getFormsCollectionFilters() {
        return {};
    }

    /**
     * Whether a form entry from the API is listed in the overview.
     * @param {object} entry
     * @returns {boolean}
     */
    isFormListed(entry) {
        return true;
    }

    /**
     * @returns {Array<object>}
     */
    createDefaultOverviewActions() {
        return [];
    }

    /**
     * Shows the view matching the current routing URL.
     */
    handleRoute() {
        this.showFormsOverview();
    }

    get showEmployerColumn() {
        return (
            this.allowListFrontendKeys?.length === 1 &&
            this.allowListFrontendKeys[0] === 'job-offer'
        );
    }

    getOverviewPage() {
        return this._('dbp-formalize-manage-forms-overview-page');
    }

    getPaginationSizeStorageKey() {
        const userId = this.auth?.['user-id'];
        if (!this.storeSession || !this.isLoggedIn() || !userId) return '';
        return `formalize-${this.constructor.activityName}-${userId}`;
    }

    getRoutingUrlWithQueryPrefixes(pathname, prefixes) {
        return getRoutingUrlWithQueryPrefixes(this.getRoutingData(), pathname, prefixes);
    }

    /**
     * Sends a new routing URL to the app shell.
     * @param {string} routingUrl
     */
    setRoutingUrl(routingUrl) {
        if (routingUrl !== this.routingUrl) {
            this.sendSetPropertyEvent('routing-url', routingUrl, true);
        }
    }

    /**
     * Routing URL changes requested by sub-components.
     * @param {CustomEvent} event
     */
    handleRoutingUrlChangeRequest(event) {
        event.stopPropagation();
        this.setRoutingUrl(event.detail.url);
    }

    connectedCallback() {
        super.connectedCallback();

        if (this.langDir) {
            this._overridesReady = setOverridesByGlobalCache(this._i18n, this);
        }
    }

    async loadForms() {
        if (this.forms.size === 0) {
            await loadModules(this);
            this.handleModulesLoaded();
        }
        await getListOfAllForms(this);
    }

    /**
     * Called once the form modules are loaded.
     */
    handleModulesLoaded() {}

    async firstUpdated(changedProperties) {
        super.firstUpdated(changedProperties);

        // If we arrive from another activity, auth is not updated, we need to init form-loading here.
        if (!this.auth?.token || this.allForms.length > 0) {
            return;
        }
        await this.loadForms();
    }

    async loginCallback() {
        super.loginCallback();
        await this.loadForms();
    }

    async updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('allForms')) {
            if (this._overridesReady !== null) {
                await this._overridesReady;
            }
            this.loadingFormsTable = false;
            this.noFormsAvailable = this.allForms.length === 0;
            this.handleRoute();
        }

        if (changedProperties.has('routingUrl')) {
            const oldUrl = changedProperties.get('routingUrl');
            if (oldUrl !== undefined) {
                const pathChanged =
                    oldUrl.replace(/[?#].*$/, '') !== this.routingUrl.replace(/[?#].*$/, '');
                if (pathChanged || getQueryString(oldUrl) !== getQueryString(this.routingUrl)) {
                    if (this.forms.size === 0 && this.isLoggedIn()) {
                        await this.loadForms();
                    }
                    if (pathChanged) {
                        this.handleRoute();
                    }
                }
            }
        }

        if (changedProperties.has('lang') && changedProperties.get('lang') !== undefined) {
            if (this.isLoggedIn()) {
                // Reload to get the localized form names
                await getListOfAllForms(this);
            }
        }

        if (
            changedProperties.has('allowListFrontendKeys') ||
            changedProperties.has('denyListFrontendKeys')
        ) {
            // Deep-compare the old and new values so we don't refetch when the
            // provider re-dispatches the same arrays (e.g. after a token refresh).
            const allowChanged =
                changedProperties.has('allowListFrontendKeys') &&
                JSON.stringify(changedProperties.get('allowListFrontendKeys')) !==
                    JSON.stringify(this.allowListFrontendKeys);
            const denyChanged =
                changedProperties.has('denyListFrontendKeys') &&
                JSON.stringify(changedProperties.get('denyListFrontendKeys')) !==
                    JSON.stringify(this.denyListFrontendKeys);

            if ((allowChanged || denyChanged) && this.isLoggedIn()) {
                this.handleModulesLoaded();
                await getListOfAllForms(this);
            }
        }
    }

    showFormsOverview() {
        this.loadingFormsTable = false;
        this.showFormsTable = true;
    }

    _onLoginClicked(e) {
        this.sendSetPropertyEvent('requested-login-status', 'logged-in');
        e.preventDefault();
    }

    static get styles() {
        return getManageFormsActivityStyles();
    }

    /**
     * Renders the login hint and the auth spinner.
     */
    renderLoginState() {
        const i18n = this._i18n;
        return html`
            <div
                class="notification is-warning ${classMap({
                    hidden: this.isLoggedIn() || this.isLoading(),
                })}">
                ${i18n.t('error-login-message')}
                <a href="#" @click="${this._onLoginClicked}">${i18n.t('error-login-link')}</a>
            </div>

            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isAuthPending()})}">
                <span class="loading">
                    <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
                </span>
            </div>
        `;
    }

    /**
     * Renders the shared forms overview.
     * @param {{creatableModulesCount?: number}} options
     */
    renderOverview({creatableModulesCount = 0} = {}) {
        const i18n = this._i18n;
        return html`
            <span class="${classMap({hidden: !this.loadingFormsTable || this.showFormsTable})}">
                <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
            </span>
            <dbp-formalize-manage-forms-overview-page
                lang="${this.lang}"
                lang-dir="${this.langDir}"
                id="overview-page"
                .routingUrl=${this.routingUrl}
                .loadingFormsTable=${this.loadingFormsTable}
                .showFormsTable=${this.showFormsTable}
                .forms=${this.allForms}
                .formsById=${this.forms}
                .actionDefinitions=${this.formsOverviewActionDefinitions}
                .actionHost=${this}
                .showEmployerColumn=${this.showEmployerColumn}
                .paginationSizeStorageKey=${this.getPaginationSizeStorageKey()}
                .noFormsAvailable=${this.noFormsAvailable}
                .creatableModulesCount=${creatableModulesCount}></dbp-formalize-manage-forms-overview-page>
        `;
    }
}
