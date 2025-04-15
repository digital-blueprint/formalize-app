import {html} from 'lit';
import {html as staticHtml, unsafeStatic} from 'lit/static-html.js';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';
import {BaseObject} from './form/base-object.js';
import {pascalToKebab} from './utils.js';
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

        // Get query parameters
        // this.getRoutingData().queryParams || '';

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
        console.log('handlePermissionsForCurrentForm formIdentifier', formIdentifier);

        this.submissionAllowed = formIdentifier
            ? await this.checkPermissionsToForm(formIdentifier)
            : false;
        console.log(
            'handlePermissionsForCurrentForm this.submissionAllowed',
            this.submissionAllowed,
        );
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
            console.log('loadModules data', data);

            console.log('data', data);
            let formComponents = {};
            let formIdentifiers = {};

            // Iterate over the module paths and dynamically import each module
            for (const [formKey, path] of Object.entries(data['forms'])) {
                const module = await import(path);

                console.log('formKey', formKey);
                console.log('path', path);
                console.log('module', module);

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
            console.log('formComponents', formComponents);
            console.log('formIdentifiers', formIdentifiers);

            // We want to check permissions after the modules have been loaded,
            // because we finally have a formIdentifier
            await this.handlePermissionsForCurrentForm();
        } catch (error) {
            console.error('Error loading modules:', error);
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

        this.loadedSubmission = {
            form: data.form,
            submissionState: data.submissionState,
            dataFeedElement: data.dataFeedElement,
            submittedFiles: data.submittedFiles,
            grantedActions: data.grantedActions,
        };
    }

    getFormHtml() {
        const formUrlSlug = this.formUrlSlug;
        const formComponents = this.formComponents;

        if (formUrlSlug === '') {
            console.log('formUrlSlug empty', formUrlSlug);
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

        console.log('getFormHtml formComponents', formComponents);
        console.log('getFormHtml formUrlSlug', formUrlSlug);

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

        console.log('getDocumentEditFormHtml formUrlSlug', formUrlSlug);
        console.log('getDocumentEditFormHtml tagName', tagName);
        console.log('getDocumentEditFormHtml form', form);

        if (!this.registry.get(tagName)) {
            this.registry.define(tagName, form);
        }

        // TODO: Add data
        let data = {};

        // Load submission data if available
        if (Object.keys(this.loadedSubmission).length > 0) {
            // Check if the submission is for the current form
            if (
                this.loadedSubmission.form ===
                `/formalize/forms/${this.formIdentifiers[formUrlSlug]}`
            ) {
                data = this.loadedSubmission.dataFeedElement;
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

        // We need to use staticHtml and unsafeStatic here, because we want to set the tag name from
        // a variable and need to set the "fileHitData" property from a variable too!
        return staticHtml`
            <${unsafeStatic(tagName)}
             ${ref(this.formRef)}
             id="edit-form"
             subscribe="auth,lang,entry-point-url"
             .data=${data}></${unsafeStatic(tagName)}>
        `;
    }

    static get styles() {
        // language=css
        return [commonStyles.getNotificationCSS()];
    }

    render() {
        const i18n = this._i18n;

        if (!this.isLoggedIn() && !this.isLoading()) {
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

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'auth':
                    // We need to check permissions again once, because the user might not have been
                    // logged in yet when the modules were loaded
                    if (!this.authTokenExists && this.auth.token !== '') {
                        this.authTokenExists = true;
                        this.handlePermissionsForCurrentForm();
                        this.getSubmissionData();
                    }
                    break;
                case 'routingUrl':
                    this.updateFormUrlSlug();
                    break;
            }
        });

        super.update(changedProperties);
    }
}

commonUtils.defineCustomElement('dbp-formalize-render-form', RenderForm);
