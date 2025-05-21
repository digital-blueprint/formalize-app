import {html, css} from 'lit';
import {html as staticHtml, unsafeStatic} from 'lit/static-html.js';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';
import {BaseObject} from './form/base-object.js';
import {pascalToKebab, getFormRenderUrl, getFormShowSubmissionsUrl} from './utils.js';
import {createRef, ref} from 'lit/directives/ref.js';
import {send} from '@dbp-toolkit/common/notification.js';
import * as commonStyles from '@dbp-toolkit/common/src/styles.js';

class RenderForm extends ScopedElementsMixin(DBPFormalizeLitElement) {
    constructor() {
        super();
        this.formComponents = {};
        this.formIdentifiers = {};
        this.formRef = createRef();
        this.formUrlSlug = '';
        this.submissionId = '';
        this.loadedSubmission = {};
        this.userAllSubmissions = [];
        this.userAllDraftSubmissions = [];
        this.usersSubmissionCount = 0;
        this.formProperties = {};
        this.authTokenExists = false;
        this.submissionAllowed = false;
        this.formDisplayDenied = false;
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
        this.updateComplete.then(() => {
            console.log('-- updateComplete --');
            this.loadModules();
        });
    }

    updateFormUrlSlug() {
        console.log('updateFormUrlSlug this.routingUrl', this.routingUrl);
        console.log('updateFormUrlSlug this.getRoutingData()', this.getRoutingData());

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

        console.log('checkPermissionsToForm data', data);

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
            (data.grantedActions.includes('manage') ||
                data.grantedActions.includes('create_submissions'))
        );
    }

    async loadModules() {
        try {
            // Fetch the JSON file containing module paths
            const response = await fetch(this.basePath + 'modules.json');
            const data = await response.json();

            // console.log('loadModules data', data);

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
                this.entryPointUrl + `/formalize/submissions?formIdentifier=${formIdentifier}`,
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
                this.userAllSubmittedSubmissions = responseBody['hydra:member'].filter(
                    (submission) => submission.submissionState == 4,
                );
                this.userAllDraftSubmissions = responseBody['hydra:member'].filter(
                    (submission) => submission.submissionState == 1,
                );
                this.usersSubmissionCount = this.userAllSubmittedSubmissions.length;
                this.requestUpdate();
            }
        } catch (e) {
            console.error(e);
        }
        console.log('Users submissions data:', this.userAllSubmissions);
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
        console.log('this.loadedSubmission', this.loadedSubmission);
    }

    getFormHtml() {
        const formUrlSlug = this.formUrlSlug;
        const formComponents = this.formComponents;

        if (formUrlSlug === '') {
            // console.log('formUrlSlug empty', formUrlSlug);
            // TODO: Show better error message
            return html`
                No form identifier provided!
            `;
        }

        if (!formComponents) {
            return html`
                Loading...
            `;
        }

        // console.log('getFormHtml formComponents', formComponents);
        // console.log('getFormHtml formUrlSlug', formUrlSlug);

        if (!formComponents[formUrlSlug]) {
            console.log('formUrlSlug not found', formUrlSlug);
            return html`
                Form
                <strong>${formUrlSlug}</strong>
                not found!
            `;
        }

        const tagPart = pascalToKebab(formUrlSlug);
        const tagName = 'dbp-formalize-form-' + tagPart;
        const form = this.formComponents[formUrlSlug];

        // console.log('getDocumentEditFormHtml formUrlSlug', formUrlSlug);
        // console.log('getDocumentEditFormHtml tagName', tagName);
        // console.log('getDocumentEditFormHtml form', form);

        if (!this.registry.get(tagName)) {
            this.registry.define(tagName, form);
        }

        const formIdentifier = this.formIdentifiers[this.formUrlSlug];
        const allowedSubmissionStates = this.formProperties.allowedSubmissionStates;
        const maxNumberOfSubmissionsPerUser = this.formProperties.maxNumSubmissionsPerCreator;
        const allowedActionsWhenSubmitted = this.formProperties.allowedActionsWhenSubmitted;

        if (this.usersSubmissionCount > 0) {
            if (maxNumberOfSubmissionsPerUser == 1) {
                // Form already submitted, can't submit again
                if (
                    allowedActionsWhenSubmitted.includes('read') ||
                    allowedActionsWhenSubmitted.includes('manage')
                ) {
                    // User can read the submission or manage the form show read-only form
                    const oldSubmissionId = this.userAllSubmittedSubmissions.pop().identifier;
                    const submissionUrl = `${getFormRenderUrl(this.formUrlSlug)}/${oldSubmissionId}/readonly`;
                    return html`
                        <div class="notification is-warning">
                            ${this._i18n.t('render-form.form-already-submitted-warning')}
                            <a href="${submissionUrl}">
                                ${this._i18n.t('render-form.check-previous-submissions-warning')}
                            </a>
                        </div>
                    `;
                } else {
                    // User can't read the submission show a warning
                    return html`
                        <div class="notification is-warning">
                            ${this._i18n.t('render-form.form-already-submitted-warning')}
                        </div>
                    `;
                }
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
            // and show a link to the submissions in the show-registrations page
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
            // and show a link to the submissions in the show-registrations page
            formAlreadySubmittedWarning = html`
                <div class="notification is-warning">
                    ${this._i18n.t('render-form.form-already-submitted-warning')}
                    <a href="${getFormShowSubmissionsUrl(this.formIdentifiers[this.formUrlSlug])}">
                        ${this._i18n.t('render-form.check-previous-submissions-warning')}
                    </a>
                </div>
            `;
        }

        console.log('RENDER-FORM-RENDER: formProperties', this.formProperties);
        console.log('RENDER-FORM-RENDER: usersSubmissions', this.userAllSubmissions);
        console.log('RENDER-FORM-RENDER: data', data);

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

        if (!this.submissionAllowed) {
            return html`
                <div class="notification is-warning">
                    ${i18n.t('render-form.form-not-accessible')}
                </div>
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
