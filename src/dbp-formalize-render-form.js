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
        this.submitAllowed = false;
    }

    static get scopedElements() {
        return {};
    }

    static get properties() {
        return {
            ...super.properties,
            submitAllowed: {type: Boolean, attribute: false},
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
        }
    }

    async handlePermissionsForCurrentForm() {
        const formIdentifier = this.formIdentifiers[this.formUrlSlug];
        console.log('handlePermissionsForCurrentForm formIdentifier', formIdentifier);

        this.submitAllowed = formIdentifier ? await this.checkPermissionsToForm(formIdentifier) : false;
        console.log('handlePermissionsForCurrentForm this.submitAllowed', this.submitAllowed);
    }

    async checkPermissionsToForm(identifier) {
        let response;
        let data = [];
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
        };

        response = await this.httpGetAsync(
            this.entryPointUrl + '/formalize/forms/' + identifier,
            options,
        );

        try {
            data = await response.json();
        } catch (e) {
            this.sendErrorAnalyticsEvent('checkPermissionsToForm', 'WrongResponse', e);
            console.error(e);
            return false;
        }

        console.log('checkPermissionsToForm data', data);

        if (data.error) {
            console.error('checkPermissionsToForm data.error', data.error);
        }

        return false;
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

            await this.handlePermissionsForCurrentForm();
        } catch (error) {
            console.error('Error loading modules:', error);
        }
    }

    getFormHtml(useFileHitDataCache = false) {
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
        return html`
            This is the form <strong>${this.formUrlSlug}</strong>!<br />
            Submit allowed: ${this.submitAllowed}
            <hr />
            ${this.getFormHtml()}
        `;
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'routingUrl':
                    this.updateFormUrlSlug();
                    this.handlePermissionsForCurrentForm();
                    break;
            }
        });

        super.update(changedProperties);
    }
}

commonUtils.defineCustomElement('dbp-formalize-render-form', RenderForm);
