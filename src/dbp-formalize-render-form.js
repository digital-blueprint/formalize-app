import {html, css} from 'lit';
import {html as staticHtml, unsafeStatic} from 'lit/static-html.js';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';
import {BaseObject} from './form/base-object.js';
import {
    pascalToKebab,
    getFormRenderUrl,
    getFormShowSubmissionsUrl,
    FORM_PERMISSIONS,
} from './utils.js';
import {createRef, ref} from 'lit/directives/ref.js';
import {send} from '@dbp-toolkit/common/notification.js';
import * as commonStyles from '@dbp-toolkit/common/src/styles.js';

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
        this.usersSubmissionCount = null;
        this.formProperties = {};
        this.authTokenExists = false;
        this.submissionAllowed = false;
        this.formDisplayDenied = false;
        this.disableBeforeUnloadWarning = false;

        this._onReceiveBeforeUnload = this.onReceiveBeforeUnload.bind(this);
        this._onDisableBeforeunloadWarning = this.onDisableBeforeunloadWarning.bind(this);
    }

    static get scopedElements() {
        return {};
    }

    static get properties() {
        return {
            ...super.properties,
            submissionAllowed: {type: Boolean, attribute: false},
            formDisplayDenied: {type: Boolean, attribute: false},
            loadedSubmission: {type: Object, attribute: false},
            userAllSubmissions: {type: Object, attribute: false},
            formProperties: {type: Array, attribute: false},
        };
    }

    connectedCallback() {
        super.connectedCallback();

        window.addEventListener('beforeunload', this._onReceiveBeforeUnload);
        window.addEventListener('disableBeforeunloadWarning', this._onDisableBeforeunloadWarning);

        this.updateComplete.then(() => {
            console.log('-- updateComplete --');
            this.loadModules();
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
        }

        // Update the formUrlSlug if it has changed
        if (this.formUrlSlug !== formUrlSlug) {
            this.formUrlSlug = formUrlSlug;
            console.log('updateFormUrlSlug this.formUrlSlug', this.formUrlSlug);

            // We need to check permissions, because the user has navigated to a different form
            this.handlePermissionsForCurrentForm();
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
        if (this.auth.token === '') {
            return false;
        }

        this.authTokenExists = true;
        let response;
        let data = [];

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
        };

        try {
            response = await this.httpGetAsync(
                this.entryPointUrl + '/formalize/forms/' + identifier,
                options,
            );

            if (!response.ok) {
                return false;
            }

            data = await response.json();
        } catch (e) {
            this.sendErrorAnalyticsEvent('checkPermissionsToForm', 'WrongResponse', e);
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

        // Check if the user has the permission to manage the form or create submissions
        return (
            Array.isArray(data.grantedActions) &&
            (data.grantedActions.includes(FORM_PERMISSIONS.MANAGE) ||
                data.grantedActions.includes(FORM_PERMISSIONS.CREATE_SUBMISSIONS))
        );
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

            // Get users all submission for this form
            await this.getUserAllSubmissionsData(this.formIdentifiers[this.formUrlSlug]);

            this.requestUpdate();
        } catch (error) {
            console.error('Error loading modules:', error);
        }
    }

    async getUserAllSubmissionsData(formIdentifier) {
        if (!formIdentifier || this.auth.token === '') {
            return;
        }

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
        };

        try {
            // @TODO: API does not return DRAFT state submissions!
            const response = await this.httpGetAsync(
                this.entryPointUrl +
                    `/formalize/submissions?formIdentifier=${formIdentifier}&perPage=100000&creatorIdEquals=` +
                    this.auth['user-id'],
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
                Authorization: 'Bearer ' + this.auth.token,
            },
        };

        try {
            const response = await this.httpGetAsync(
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
            return html`
                <div class="notification is-warning">
                    ${this._i18n.t('render-form.form-not-found')}
                </div>
            `;
        }

        if (!formComponents[formUrlSlug]) {
            return html`
                <div class="notification is-warning">
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
                    ${this._i18n.t('render-form.form-not-accessible')}
                </div>
            `;
        }

        const tagPart = pascalToKebab(formUrlSlug);
        const tagName = 'dbp-formalize-form-' + tagPart;
        const form = this.formComponents[formUrlSlug];

        if (!this.registry.get(tagName)) {
            this.registry.define(tagName, form);
        }

        const formIdentifier = this.formIdentifiers[this.formUrlSlug];
        const allowedSubmissionStates = this.formProperties.allowedSubmissionStates;
        const maxNumberOfSubmissionsPerUser = this.formProperties.maxNumSubmissionsPerCreator;
        const allowedActionsWhenSubmitted = this.formProperties.allowedActionsWhenSubmitted;
        this.usersSubmissionCount = this.formProperties.numSubmissionsByCurrentUser;

        // Don't display the form before setting usersSubmissionCount.
        if (this.usersSubmissionCount === null) return;

        if (this.usersSubmissionCount > 0) {
            if (maxNumberOfSubmissionsPerUser === 1) {
                // Form already submitted, can't submit again
                let submissionUrl = '';
                if (
                    allowedActionsWhenSubmitted.includes('read') ||
                    allowedActionsWhenSubmitted.includes('manage')
                ) {
                    // User can read the submission or manage the form show read-only form
                    const oldSubmissionId = this.userAllSubmissions[0].identifier;
                    submissionUrl = `${getFormRenderUrl(this.formUrlSlug)}/${oldSubmissionId}/readonly`;
                }
                return html`
                    <div class="notification is-warning">
                        ${this._i18n.t('render-form.form-already-submitted-warning')}
                        ${submissionUrl
                            ? html`
                                  <a href="${submissionUrl}">
                                      ${this._i18n.t(
                                          'render-form.check-previous-submissions-warning',
                                      )}
                                  </a>
                              `
                            : ''}
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
                send({
                    summary: 'Error',
                    body: 'Invalid submission data',
                    type: 'danger',
                    timeout: 5,
                });
                this.formDisplayDenied = true;
            }
        }

        if (this.formDisplayDenied) {
            return html`
                <div class="notification is-warning">
                    ${this._i18n.t('render-form.form-not-accessible')}
                </div>
            `;
        }

        if (this.usersSubmissionCount >= maxNumberOfSubmissionsPerUser) {
            // User can't submit the form again
            // A message is shown that the user already submitted the form
            // and show a link to the submissions in the show-submissions page
            return html`
                <div class="notification is-warning">
                    ${this._i18n.t('render-form.form-already-submitted-n-times-warning', {
                        n: this.usersSubmissionCount,
                    })}
                    <a href="${getFormShowSubmissionsUrl(this.formIdentifiers[this.formUrlSlug])}">
                        ${this._i18n.t('render-form.check-previous-submissions-warning')}
                    </a>
                </div>
            `;
        }

        let formAlreadySubmittedWarning = html``;
        if (
            this.usersSubmissionCount > 0 &&
            (allowedActionsWhenSubmitted.includes('read') ||
                allowedActionsWhenSubmitted.includes('manage'))
        ) {
            // An empty form is shown with the message that the user already submitted the form
            // and show a link to the submissions in the show-submissions page
            formAlreadySubmittedWarning = html`
                <div class="notification is-warning">
                    ${this._i18n.t('render-form.form-already-submitted-warning')}
                    <a href="${getFormShowSubmissionsUrl(this.formIdentifiers[this.formUrlSlug])}">
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
            ${commonStyles.getNotificationCSS()}

            .notification {
                margin-bottom: 2em;
            }
        `;
    }

    render() {
        const i18n = this._i18n;

        if (!this.isLoggedIn() && !this.isAuthPending()) {
            return html`
                <div class="notification is-warning">${i18n.t('error-login-message')}</div>
            `;
        }

        return html`
            ${this.getFormHtml()}
        `;
    }

    async update(changedProperties) {
        if (changedProperties.has('auth')) {
            if (!this.authTokenExists && this.auth.token !== '') {
                this.authTokenExists = true;
                this.handlePermissionsForCurrentForm();

                await this.getUserAllSubmissionsData(this.formIdentifiers[this.formUrlSlug]);
                await this.getSubmissionData();
            }
        }
        if (changedProperties.has('routingUrl')) {
            this.updateFormUrlSlug();
        }

        super.update(changedProperties);
    }
}

commonUtils.defineCustomElement('dbp-formalize-render-form', RenderForm);
