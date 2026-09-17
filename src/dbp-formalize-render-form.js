import {html, css} from 'lit';
import {html as staticHtml, unsafeStatic} from 'lit/static-html.js';
import {ScopedElementsMixin, sendNotification, MiniSpinner} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Icon} from '@dbp-toolkit/common';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';
import {
    SUBMISSION_STATES_BINARY,
    pascalToKebab,
    getFormRenderUrl,
    getFormManageFormsUrl,
    FORM_PERMISSIONS,
    SUBMISSION_COLLECTION_PERMISSIONS,
} from './utils.js';
import {createRef, ref} from 'lit/directives/ref.js';
import * as commonStyles from '@dbp-toolkit/common/src/styles.js';
import {CustomTabulatorTable, GetDetailsButton} from './table-components.js';
import {isAvailableFormsOverviewEnabled} from './feature-flags.js';

/** @typedef {import('./form/base-object.js').BaseObject} BaseObject */

const parseFormListAttribute = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || value.trim() === '') return [];

    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
    } catch {
        // Fall back to comma-separated attribute values.
    }

    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
};

export function filterAvailableForms(
    entries,
    formIdentifiers,
    lang,
    allowList = [],
    denyList = [],
) {
    return entries
        .filter((entry) => {
            const frontendKey = entry.frontendKey ?? null;
            if (allowList.length > 0 && (!frontendKey || !allowList.includes(frontendKey))) {
                return false;
            }
            if (frontendKey && denyList.includes(frontendKey)) return false;

            const formActions = entry.grantedFormActions ?? [];
            const submissionActions = entry.grantedSubmissionCollectionActions ?? [];
            return (
                formActions.includes(FORM_PERMISSIONS.CREATE_SUBMISSIONS) ||
                formActions.includes(FORM_PERMISSIONS.MANAGE) ||
                submissionActions.includes(SUBMISSION_COLLECTION_PERMISSIONS.CREATE_SUBMISSIONS) ||
                submissionActions.includes(SUBMISSION_COLLECTION_PERMISSIONS.MANAGE)
            );
        })
        .map((entry) => {
            const slug = Object.keys(formIdentifiers).find(
                (candidate) => formIdentifiers[candidate] === entry.identifier,
            );
            if (!slug) return null;

            const localizedName = (entry.localizedNames ?? []).find(
                (name) => name.languageTag === lang,
            );
            return {
                identifier: entry.identifier,
                name: localizedName?.name ?? entry.name ?? slug,
                slug,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name, lang));
}

/**
 * @augments {DBPFormalizeLitElement}
 */
class RenderForm extends ScopedElementsMixin(DBPFormalizeLitElement) {
    constructor() {
        super();
        this.formIsRendered = false;
        this.formComponents = {};
        this.formIdentifiers = {};
        this.formRef = createRef();
        this.formUrlSlug = '';
        this.submissionId = '';
        this.loadedSubmission = {};
        this.userAllSubmissions = [];
        this.usersSubmittedSubmissionCount = null;
        this.formProperties = {};
        this.authTokenExists = false;
        this.submissionAllowed = false;
        this.formDisplayDenied = false;
        this.disableBeforeUnloadWarning = false;
        this.availableForms = [];
        this.availableFormsLoading = true;
        this.availableFormsLoadFailed = false;
        this.availableFormsTableOptions = this.getAvailableFormsTableOptions();
        this.allowListFrontendKeys = [];
        this.denyListFrontendKeys = [];

        this._onReceiveBeforeUnload = this.onReceiveBeforeUnload.bind(this);
        this._onDisableBeforeunloadWarning = this.onDisableBeforeunloadWarning.bind(this);
        this._onFormDataUpdated = this.onFormDataUpdated.bind(this);
        this._onFormReset = this.onFormReset.bind(this);
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-tabulator-table': CustomTabulatorTable,
            'dbp-formalize-get-details-button': GetDetailsButton,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            submissionAllowed: {type: Boolean, attribute: false},
            formDisplayDenied: {type: Boolean, attribute: false},
            loadedSubmission: {type: Object, attribute: false},
            userAllSubmissions: {type: Object, attribute: false},
            formProperties: {type: Array, attribute: false},
            availableForms: {type: Array, attribute: false},
            availableFormsLoading: {type: Boolean, attribute: false},
            availableFormsLoadFailed: {type: Boolean, attribute: false},
            availableFormsTableOptions: {type: Object, attribute: false},
            allowListFrontendKeys: {
                type: Array,
                attribute: 'allow-list-frontend-keys',
                converter: {fromAttribute: parseFormListAttribute},
            },
            denyListFrontendKeys: {
                type: Array,
                attribute: 'deny-list-frontend-keys',
                converter: {fromAttribute: parseFormListAttribute},
            },
        };
    }

    connectedCallback() {
        super.connectedCallback();

        window.addEventListener('beforeunload', this._onReceiveBeforeUnload);
        window.addEventListener('disableBeforeunloadWarning', this._onDisableBeforeunloadWarning);
        window.addEventListener('dbpFormDataUpdated', this._onFormDataUpdated);
        window.addEventListener('DbpFormalizeFormReset', this._onFormReset);

        void this.updateComplete.then(() => {
            console.log('-- updateComplete --');
            void this.loadModules();
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        // Remove event listeners using bound methods
        window.removeEventListener('beforeunload', this._onReceiveBeforeUnload);
        window.removeEventListener(
            'disableBeforeunloadWarning',
            this._onDisableBeforeunloadWarning,
        );
        window.removeEventListener('dbpFormDataUpdated', this._onFormDataUpdated);
        window.removeEventListener('DbpFormalizeFormReset', this._onFormReset);
    }

    updateFormUrlSlug() {
        // We will use the first URL segment after the activity as identifier for the form
        const formUrlSlug = this.getRoutingData().pathSegments[0] || '';

        // Get submission ID
        const pathSegment = this.getRoutingData().pathSegments[1] || '';
        const regex = /^[a-z,0-9,-]{36,36}$/;
        if (regex.test(pathSegment)) {
            this.submissionId = pathSegment;
        }

        if (this.submissionId && this.getRoutingData().pathSegments[2] === 'readonly') {
            // Load the submission data in readonly mode
            this.readOnly = true;
        } else {
            this.readOnly = false;
        }

        // Update the formUrlSlug if it has changed
        if (this.formUrlSlug !== formUrlSlug) {
            this.formUrlSlug = formUrlSlug;
            console.log('updateFormUrlSlug this.formUrlSlug', this.formUrlSlug);

            // We need to check permissions, because the user has navigated to a different form
            void this.handlePermissionsForCurrentForm();
        }
    }

    async handlePermissionsForCurrentForm() {
        const formIdentifier = this.formIdentifiers[this.formUrlSlug];

        this.submissionAllowed = formIdentifier
            ? await this.checkPermissionsToForm(formIdentifier)
            : false;
    }

    async checkPermissionsToForm(identifier) {
        // If the user is not logged in yet, we can't check permissions
        if (this.getToken() === '') {
            return false;
        }

        this.authTokenExists = true;
        let response;
        let data;

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.getToken(),
            },
        };

        try {
            response = await fetch(this.entryPointUrl + '/formalize/forms/' + identifier, options);

            if (!response.ok) {
                return false;
            }

            data = await response.json();
        } catch (e) {
            void this.sendErrorAnalyticsEvent('checkPermissionsToForm', 'WrongResponse', e);
            console.error(e);
            return false;
        }

        if (data.error) {
            console.error('checkPermissionsToForm data.error', data.error);
            return false;
        }

        if (data['@type'] === 'hydra:Error') {
            console.error('checkPermissionsToForm hydra:Error', data.detail);
            return false;
        }

        this.formProperties = data;
        // If the user has READ permission we can allow to view the form in read-only mode
        // Without READ permission `response.ok` is false and we return before
        return true;
    }

    async loadModules() {
        try {
            // Fetch the JSON file containing module paths
            const response = await fetch(this.basePath + 'modules.json');
            const data = await response.json();

            let formComponents = {};
            let formIdentifiers = {};

            // Iterate over the module paths and dynamically import each module
            for (const [formKey, path] of Object.entries(data['forms'])) {
                const module = await import(path);

                console.log('formKey', formKey);
                // console.log('path', path);
                // console.log('module', module);

                /**
                 * @type {BaseObject}
                 */
                const object = new module.default();

                if (object.getFormComponent) {
                    formComponents[object.getUrlSlug()] = object.getFormComponent();
                }

                if (object.getFormIdentifier) {
                    formIdentifiers[object.getUrlSlug()] = object.getFormIdentifier();
                }
            }

            this.formComponents = formComponents;
            this.formIdentifiers = formIdentifiers;
            // console.log('formComponents', formComponents);
            // console.log('formIdentifiers', formIdentifiers);

            // We want to check permissions after the modules have been loaded,
            // because we finally have a formIdentifier
            await this.handlePermissionsForCurrentForm();

            await this.loadAvailableForms();

            // Get users all submission for this form
            await this.getUserAllSubmissionsData(this.formIdentifiers[this.formUrlSlug]);

            this.requestUpdate();
        } catch (error) {
            console.error('Error loading modules:', error);
        }
    }

    async loadAvailableForms() {
        if (!isAvailableFormsOverviewEnabled() || !this.auth?.token || this.formUrlSlug !== '') {
            this.availableFormsLoading = false;
            return;
        }

        this.availableFormsLoading = true;
        this.availableFormsLoadFailed = false;
        try {
            const response = await fetch(`${this.entryPointUrl}/formalize/forms?perPage=9999`, {
                headers: {
                    'Content-Type': 'application/ld+json',
                    Authorization: `Bearer ${this.auth.token}`,
                },
            });
            if (!response.ok) throw new Error(`Failed to load forms: ${response.status}`);

            const data = await response.json();
            this.availableForms = filterAvailableForms(
                data['hydra:member'] ?? [],
                this.formIdentifiers,
                this.lang,
                this.allowListFrontendKeys,
                this.denyListFrontendKeys,
            ).map((form) => ({
                ...form,
                actionButton: this.createAvailableFormAction(form),
            }));
            this.availableFormsTableOptions = this.getAvailableFormsTableOptions();
        } catch (error) {
            console.error('Error loading available forms:', error);
            this.availableForms = [];
            this.availableFormsLoadFailed = true;
        } finally {
            this.availableFormsLoading = false;
        }
    }

    getAvailableFormsTableOptions() {
        return {
            data: this.availableForms,
            layout: 'fitColumns',
            langs: {
                en: {columns: {name: this._i18n.t('render-form.form-name', {lng: 'en'})}},
                de: {columns: {name: this._i18n.t('render-form.form-name', {lng: 'de'})}},
            },
            columns: [
                {
                    field: 'name',
                    sorter: 'string',
                },
                {field: 'identifier', visible: false},
                {field: 'slug', visible: false},
                {
                    field: 'actionButton',
                    formatter: 'html',
                    hozAlign: 'right',
                    widthShrink: 1,
                    minWidth: 44,
                    headerSort: false,
                },
            ],
            columnDefaults: {
                vertAlign: 'middle',
                hozAlign: 'left',
                resizable: false,
            },
            initialSort: [{column: 'name', dir: 'asc'}],
        };
    }

    createAvailableFormAction(form) {
        const container = document.createElement('span');
        container.style.cssText = 'display: inline-flex; align-items: center;';

        const button = this.createScopedElement('dbp-formalize-get-details-button');
        button.setAttribute('subscribe', 'lang');
        button.title = this._i18n.t('render-form.open-form');
        button.ariaLabel = this._i18n.t('render-form.open-form');
        button.addEventListener('click', () => {
            this.sendSetPropertyEvent('routing-url', `/${form.slug}`, true);
        });
        container.appendChild(button);

        return container;
    }

    getAvailableFormsTable() {
        return /** @type {CustomTabulatorTable | null} */ (
            this.renderRoot?.querySelector('#available-forms-table') ?? null
        );
    }

    getAvailableFormsSearchInput() {
        return /** @type {HTMLInputElement | null} */ (
            this.renderRoot?.querySelector('#available-forms-search') ?? null
        );
    }

    handleAvailableFormsSearch(event) {
        event?.preventDefault();
        const input = this.getAvailableFormsSearchInput();
        if (!input) return;

        this.applyAvailableFormsSearch(input.value.trim());
    }

    applyAvailableFormsSearch(value) {
        const table = this.getAvailableFormsTable();
        if (!table) return;

        if (value === '') {
            table.clearFilter();
            return;
        }

        const filters = (this.availableFormsTableOptions.columns ?? [])
            .filter(
                (column) => column.field && column.visible !== false && column.formatter !== 'html',
            )
            .map((column) => ({field: column.field, type: 'like', value}));
        table.setFilter([filters]);
    }

    handleAvailableFormsSearchReset() {
        const input = this.getAvailableFormsSearchInput();
        const table = this.getAvailableFormsTable();
        if (!input || !table) return;

        input.value = '';
        table.clearFilter();
        input.focus();
    }

    rebuildAvailableFormsTable() {
        const table = this.getAvailableFormsTable();
        if (!table) return;

        void table.updateComplete.then(() => {
            table.options = this.availableFormsTableOptions;
            table.data = this.availableForms;

            if (table.tabulatorTable) {
                table.tabulatorTable.destroy();
            }
            table.tableReady = false;
            table.tableBuilding = false;
            table.buildTable();
        });
    }

    async getUserAllSubmissionsData(formIdentifier) {
        const auth = this.auth;
        if (!formIdentifier || !auth?.token) {
            return;
        }

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + auth.token,
            },
        };

        try {
            // @TODO: API does not return DRAFT state submissions!
            const response = await fetch(
                this.entryPointUrl +
                    `/formalize/submissions?formIdentifier=${formIdentifier}&perPage=100000&creatorIdEquals=` +
                    this.getUserId(),
                options,
            );

            if (!response.ok) {
                return;
            }

            const responseBody = await response.json();
            if (
                responseBody !== undefined &&
                responseBody['hydra:member'] &&
                responseBody['hydra:member'].length > 0
            ) {
                this.userAllSubmissions = responseBody['hydra:member'];
                this.requestUpdate();
            }
        } catch (e) {
            console.error(e);
        }
    }

    async getSubmissionData() {
        if (!this.submissionId) {
            return false;
        }

        let data = {};

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.getToken(),
            },
        };

        try {
            const response = await fetch(
                this.entryPointUrl + '/formalize/submissions/' + this.submissionId,
                options,
            );

            if (!response.ok) {
                this.handleErrorResponse(response);
                this.formDisplayDenied = true;
            }

            data = await response.json();
        } catch (e) {
            console.error(e);
            this.formDisplayDenied = true;
        }

        this.loadedSubmission = data;
    }

    async onFormReset() {
        this.loadedSubmission = {};
        this.submissionId = '';
        this.readOnly = false;
        if (this.formIdentifiers[this.formUrlSlug]) {
            await this.getUserAllSubmissionsData(this.formIdentifiers[this.formUrlSlug]);
        }
        this.requestUpdate();
    }

    /**
     * Update this.loadedSubmission and this.userAllSubmissions
     * if a form changes submission data
     * @param {CustomEvent} event
     */
    async onFormDataUpdated(event) {
        if (event.detail && event.detail.needUpdate) {
            await this.getSubmissionData();
            if (this.formIdentifiers[this.formUrlSlug]) {
                await this.getUserAllSubmissionsData(this.formIdentifiers[this.formUrlSlug]);
            }
        }
    }

    onDisableBeforeunloadWarning(event) {
        this.disableBeforeUnloadWarning = true;
    }

    /**
     * Decides if the "beforeunload" event needs to be canceled
     *
     * @param event
     */
    onReceiveBeforeUnload(event) {
        // we don't need to stop if there are no form rendered
        // or the form is read-only.
        if (this.formIsRendered === false || this.readOnly || this.disableBeforeUnloadWarning) {
            this.disableBeforeUnloadWarning = false;
            return;
        }

        // we need to handle custom events ourselves
        if (!event.isTrusted) {
            // note that this only works with custom event since calls of "confirm" are ignored
            // in the non-custom event, see https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
            const result = confirm(this._i18n.t('render-form.form-exit-warning-message'));

            // don't stop the page leave if the user wants to leave
            if (result) {
                return;
            }
        }

        // Browser default message for user navigation
        // This message cannot be customized for security reasons in modern browsers
        // Cancel the event as stated by the standard
        event.preventDefault();
        // Chrome requires returnValue to be set
        event.returnValue = '';
    }

    getFormHtml() {
        const formUrlSlug = this.formUrlSlug;
        const formComponents = this.formComponents;

        if (Object.keys(formComponents).length === 0) {
            return html`
                Loading...
            `;
        }

        if (formUrlSlug === '') {
            if (!isAvailableFormsOverviewEnabled()) {
                return html`
                    <div class="notification is-warning">
                        <dbp-icon name="warning-high"></dbp-icon>
                        ${this._i18n.t('render-form.form-not-found')}
                    </div>
                `;
            }

            if (this.availableFormsLoading) {
                return html`
                    <dbp-mini-spinner text="${this._i18n.t('loading-message')}"></dbp-mini-spinner>
                `;
            }

            if (this.availableFormsLoadFailed) {
                return html`
                    <div class="notification is-danger">
                        <dbp-icon name="warning-high"></dbp-icon>
                        ${this._i18n.t('render-form.available-forms-load-failed')}
                    </div>
                `;
            }

            return html`
                <section class="available-forms" aria-labelledby="available-forms-title">
                    <h1 id="available-forms-title">
                        ${this._i18n.t('render-form.available-forms-title')}
                    </h1>
                    <p>${this._i18n.t('render-form.available-forms-description')}</p>
                    ${
                        this.availableForms.length === 0
                            ? html`
                                  <p>${this._i18n.t('render-form.no-available-forms')}</p>
                              `
                            : html`
                                  <div class="forms-table-actions">
                                      <form
                                          class="search-input forms-search"
                                          @submit=${this.handleAvailableFormsSearch}>
                                          <label for="available-forms-search">
                                              ${this._i18n.t('render-form.search-input-label')}:
                                          </label>
                                          <input
                                              id="available-forms-search"
                                              class="searchbar"
                                              type="text"
                                              placeholder="${this._i18n.t(
                                                  'render-form.search-placeholder',
                                              )}"
                                              @input=${this.handleAvailableFormsSearch} />
                                          <button
                                              class="button search-button"
                                              type="submit"
                                              title="${this._i18n.t('render-form.search-button')}"
                                              aria-label="${this._i18n.t(
                                                  'render-form.search-button',
                                              )}">
                                              <dbp-icon name="search" aria-hidden="true"></dbp-icon>
                                          </button>
                                      </form>
                                      <button
                                          class="reset-search"
                                          type="button"
                                          @click=${this.handleAvailableFormsSearchReset}>
                                          <dbp-icon
                                              name="spinner-arrow"
                                              aria-hidden="true"></dbp-icon>
                                          ${this._i18n.t('render-form.reset-search-label')}
                                      </button>
                                  </div>
                                  <dbp-tabulator-table
                                      id="available-forms-table"
                                      identifier="available-forms-table"
                                      lang="${this.lang}"
                                      pagination-enabled
                                      pagination-size="10"
                                      .options=${
                                          this.availableFormsTableOptions
                                      }></dbp-tabulator-table>
                              `
                    }
                </section>
            `;
        }

        if (!formComponents[formUrlSlug]) {
            return html`
                <div class="notification is-warning">
                    <dbp-icon name="warning-high"></dbp-icon>
                    ${this._i18n.t('render-form.form-with-slug-not-found', {
                        slug: formUrlSlug,
                        interpolation: {escapeValue: false},
                    })}
                </div>
            `;
        }

        if (!this.submissionAllowed) {
            return html`
                <div class="notification is-warning">
                    <dbp-icon name="warning-high"></dbp-icon>
                    ${this._i18n.t('render-form.form-not-accessible')}
                </div>
            `;
        }

        const tagPart = pascalToKebab(formUrlSlug);
        const tagName = 'dbp-formalize-form-' + tagPart;
        const form = this.formComponents[formUrlSlug];
        this.defineScopedElement(tagName, form);

        const formIdentifier = this.formIdentifiers[this.formUrlSlug];
        const allowedSubmissionStates = this.formProperties.allowedSubmissionStates;
        const maxNumberOfSubmissionsPerUser = this.formProperties.maxNumSubmissionsPerCreator;
        // const allowedActionsWhenSubmitted = this.formProperties.allowedActionsWhenSubmitted;
        this.grantedActions = this.formProperties.grantedActions;

        // this.usersSubmissionCount = this.formProperties.numSubmissionsByCurrentUser;
        // Only count SUBMITTED state submissions
        this.usersSubmittedSubmissionCount = this.userAllSubmissions.filter((submission) => {
            return submission.submissionState === SUBMISSION_STATES_BINARY.SUBMITTED;
        }).length;

        // Don't display the form before setting usersSubmissionCount.
        if (this.usersSubmittedSubmissionCount === null) return;

        if (this.usersSubmittedSubmissionCount > 0) {
            // Form already submitted, can't submit again
            if (maxNumberOfSubmissionsPerUser === 1) {
                let submissionUrl = '';
                // User can read the submission or manage the form show read-only form
                // We have READ permission if we can see previous submissions
                if (this.userAllSubmissions.length > 0) {
                    const oldSubmissionId = this.userAllSubmissions[0].identifier;
                    submissionUrl = `${getFormRenderUrl(this.formUrlSlug, this.lang)}/${oldSubmissionId}/readonly`;
                }
                return html`
                    <div class="notification is-warning">
                        <dbp-icon name="warning-high"></dbp-icon>
                        ${this._i18n.t('render-form.form-already-submitted-warning')}
                        ${
                            submissionUrl
                                ? html`
                                      <a href="${submissionUrl}">
                                          ${this._i18n.t(
                                              'render-form.check-previous-submissions-warning',
                                          )}
                                      </a>
                                  `
                                : ''
                        }
                    </div>
                `;
            }
        }

        let data = {};
        // Load submission data if available
        if (Object.keys(this.loadedSubmission).length > 0) {
            // Check if the submission is for the current form
            if (
                this.loadedSubmission.form ===
                `/formalize/forms/${this.formIdentifiers[formUrlSlug]}`
            ) {
                data = this.loadedSubmission;
            } else {
                sendNotification({
                    summary: this._i18n.t('errors.error-title'),
                    body: this._i18n.t('errors.invalid-submission-data'),
                    type: 'danger',
                    timeout: 0,
                });
                this.formDisplayDenied = true;
            }
        }

        if (this.formDisplayDenied) {
            return html`
                <div class="notification is-warning">
                    <dbp-icon name="warning-high"></dbp-icon>
                    ${this._i18n.t('render-form.form-not-accessible')}
                </div>
            `;
        }

        if (this.usersSubmittedSubmissionCount >= maxNumberOfSubmissionsPerUser) {
            // User can't submit the form again
            // A message is shown that the user already submitted the form
            // and show a link to the submissions in the manage-forms page
            return html`
                <div class="notification is-warning">
                    <dbp-icon name="warning-high"></dbp-icon>
                    ${this._i18n.t('render-form.form-already-submitted-n-times-warning', {
                        n: this.usersSubmittedSubmissionCount,
                    })}
                    <a
                        href="${getFormManageFormsUrl(
                            this.formIdentifiers[this.formUrlSlug],
                            this.lang,
                        )}">
                        ${this._i18n.t('render-form.check-previous-submissions-warning')}
                    </a>
                </div>
            `;
        }

        let formAlreadySubmittedWarning = html``;
        if (this.usersSubmittedSubmissionCount > 0) {
            // An empty form is shown with the message that the user already submitted the form
            // and show a link to the submissions in the manage-forms page
            formAlreadySubmittedWarning = html`
                <div class="notification is-info">
                    <dbp-icon name="information-circle"></dbp-icon>
                    <a
                        href="${getFormManageFormsUrl(
                            this.formIdentifiers[this.formUrlSlug],
                            this.lang,
                        )}">
                        ${this._i18n.t('render-form.check-previous-submissions-warning')}
                    </a>
                </div>
            `;
        }

        this.formIsRendered = true;

        // We need to use staticHtml and unsafeStatic here, because we want to set the tag name from
        // a variable and need to set the "data" property from a variable too!
        return staticHtml`

            ${formAlreadySubmittedWarning}

            <${unsafeStatic(tagName)}
                ${ref(this.formRef)}
                id="edit-form"
                subscribe="auth,lang,entry-point-url,nextcloud-web-app-password-url,nextcloud-web-dav-url,nextcloud-auth-url,nextcloud-name,nextcloud-file-url"
                form-identifier=${formIdentifier}
                form-url-slug=${formUrlSlug}
                max-number-of-submissions=${maxNumberOfSubmissionsPerUser}
                allowed-submission-states=${allowedSubmissionStates}
                ?read-only=${this.readOnly}
                .formProperties=${this.formProperties}
                .userAllSubmissions=${this.userAllSubmissions}
                .data=${data}></${unsafeStatic(tagName)}>
        `;
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getNotificationCSS()}
            ${commonStyles.getButtonCSS()}

            .notification {
                margin-bottom: 2em;
                display: flex;
                justify-content: flex-start;
                align-items: center;
            }

            .notification dbp-icon {
                position: static;
            }

            .notification a {
                text-underline-offset: 2px;
            }

            .available-forms h1 {
                margin-top: 0;
            }

            .forms-table-actions {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin: 1.5rem 0 0.5rem;
            }

            .forms-search {
                flex: 1;
                min-width: 12rem;
            }

            .forms-search label {
                clip: rect(0 0 0 0);
                clip-path: inset(50%);
                height: 1px;
                overflow: hidden;
                position: absolute;
                white-space: nowrap;
                width: 1px;
            }

            .search-input {
                display: flex;
                position: relative;
            }

            .searchbar,
            .search-button {
                box-sizing: border-box;
                height: 32px;
            }

            .searchbar {
                flex-grow: 1;
                padding: 0 0.5em;
                border: 1px solid var(--dbp-content);
            }

            .search-button {
                position: absolute;
                top: 0;
                right: 0;
                border: 0;
                background: transparent;
            }

            .reset-search {
                border: 0;
                background: none;
                cursor: pointer;
                padding: 5px;
            }

            .search-button dbp-icon,
            .reset-search dbp-icon {
                position: static;
            }

            @media (max-width: 530px) {
                .forms-table-actions {
                    align-items: stretch;
                    flex-wrap: wrap;
                }

                .forms-search {
                    flex-basis: 100%;
                }
            }
        `;
    }

    _onLoginClicked(e) {
        this.sendSetPropertyEvent('requested-login-status', 'logged-in');
        e.preventDefault();
    }

    render() {
        const i18n = this._i18n;

        if (!this.isLoggedIn() && !this.isAuthPending()) {
            return html`
                <div class="notification is-warning">
                    ${i18n.t('error-login-message')}
                    <a href="#" @click="${this._onLoginClicked}">${i18n.t('error-login-link')}</a>
                </div>
            `;
        }

        return html`
            ${this.getFormHtml()}
        `;
    }

    async update(changedProperties) {
        if (changedProperties.has('auth')) {
            if (!this.authTokenExists && this.auth && this.auth.token !== '') {
                this.authTokenExists = true;
                void this.handlePermissionsForCurrentForm();

                await this.getUserAllSubmissionsData(this.formIdentifiers[this.formUrlSlug]);
                await this.getSubmissionData();
            }

            if (this.auth?.token && Object.keys(this.formIdentifiers).length > 0) {
                await this.loadAvailableForms();
            }
        }
        if (changedProperties.has('routingUrl')) {
            this.updateFormUrlSlug();
            if (Object.keys(this.formIdentifiers).length > 0) {
                await this.loadAvailableForms();
            }
        }

        if (
            (changedProperties.has('lang') ||
                changedProperties.has('allowListFrontendKeys') ||
                changedProperties.has('denyListFrontendKeys')) &&
            Object.keys(this.formIdentifiers).length > 0
        ) {
            await this.loadAvailableForms();
        }

        super.update(changedProperties);
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        if (
            !this.availableFormsLoading &&
            this.availableForms.length > 0 &&
            (changedProperties.has('availableFormsTableOptions') ||
                changedProperties.has('availableFormsLoading'))
        ) {
            this.rebuildAvailableFormsTable();
        }
    }
}

commonUtils.defineCustomElement('dbp-formalize-render-form', RenderForm);
