import {html} from 'lit';
import {html as staticHtml, unsafeStatic} from 'lit/static-html.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';
import {BaseObject} from './baseObject.js';
import {pascalToKebab} from './utils.js';
import {createRef, ref} from 'lit/directives/ref.js';

class RenderForm extends ScopedElementsMixin(DBPFormalizeLitElement) {
    constructor() {
        super();
        this.formComponents = {};
        this.formIdentifiers = {};
        this.formRef = createRef();
        this.formUrlSlug = '';
        this.authTokenExists = false;
        this.submissionAllowed = false;
    }

    static get scopedElements() {
        return {};
    }

    static get properties() {
        return {
            ...super.properties,
            submissionAllowed: {type: Boolean, attribute: false},
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
        // console.log('updateFormUrlSlug this.routingUrl', this.routingUrl);
        // console.log('updateFormUrlSlug this.getRoutingData()', this.getRoutingData());

        // We will use the first URL segment after the activity as identifier for the form
        const formUrlSlug = this.getRoutingData().pathSegments[0] || '';

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

        this.submissionAllowed = formIdentifier ? await this.checkPermissionsToForm(formIdentifier) : false;
        console.log('handlePermissionsForCurrentForm this.submissionAllowed', this.submissionAllowed);
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
        return Array.isArray(data.grantedActions)  &&
            (data.grantedActions.includes('manage') ||
             data.grantedActions.includes('create_submissions'));
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

        if (!customElements.get(tagName)) {
            customElements.define(tagName, form);
        }

        // TODO: Add data
        const data = {};

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

    render() {
        // TODO: Don't show the form if this.submissionAllowed is false
        return html`
            This is the form <strong>${this.formUrlSlug}</strong>!<br />
            Submission allowed: ${this.submissionAllowed}
            <hr />
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
