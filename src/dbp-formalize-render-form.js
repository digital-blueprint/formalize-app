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
        this.formRef = createRef();
        this.formIdentifier = '';
    }

    static get scopedElements() {
        return {};
    }

    static get properties() {
        return {
            ...super.properties,
        };
    }

    connectedCallback() {
        super.connectedCallback();
        this.updateComplete.then(() => {
            console.log('-- updateComplete --');
            this.loadModules();
        });
    }

    updateFormIdentifier() {
        // console.log('updateFormIdentifier this.routingUrl', this.routingUrl);
        // console.log('updateFormIdentifier this.getRoutingData()', this.getRoutingData());

        // We will use the first URL segment after the activity as identifier for the form
        const formIdentifier = this.getRoutingData().pathSegments[0] || '';

        // Update the form identifier if it has changed
        if (this.formIdentifier !== formIdentifier) {
            this.formIdentifier = formIdentifier;
            console.log('updateFormIdentifier this.formIdentifier', this.formIdentifier);
        }
    }

    async loadModules() {
        try {
            // Fetch the JSON file containing module paths
            const response = await fetch(this.basePath + 'modules.json');
            const data = await response.json();
            console.log('loadModules data', data);

            console.log('data', data);
            let formComponents = {};

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
                    formComponents[object.getName()] = object.getFormComponent();
                }
            }

            this.formComponents = formComponents;
            console.log('formComponents', formComponents);
        } catch (error) {
            console.error('Error loading modules:', error);
        }
    }

    getFormHtml(useFileHitDataCache = false) {
        const formIdentifier = this.formIdentifier;
        const formComponents = this.formComponents;

        if (formIdentifier === '') {
            console.log('formIdentifier empty', formIdentifier);
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

        if (!formComponents[formIdentifier]) {
            console.log('formIdentifier not found', formIdentifier);
            return html`
                Form
                <strong>${formIdentifier}</strong>
                not found!
            `;
        }

        const tagPart = pascalToKebab(formIdentifier);
        const tagName = 'dbp-formalize-form-' + tagPart;

        console.log('getDocumentEditFormHtml formIdentifier', formIdentifier);
        console.log('getDocumentEditFormHtml tagName', tagName);
        console.log(
            'getDocumentEditFormHtml this.formComponents[formIdentifier]',
            this.formComponents[formIdentifier],
        );

        if (!customElements.get(tagName)) {
            customElements.define(tagName, this.formComponents[formIdentifier]);
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
            This is the form <strong>${this.formIdentifier}</strong>!
            <hr />
            ${this.getFormHtml()}
        `;
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'routingUrl':
                    this.updateFormIdentifier();
                    break;
            }
        });

        super.update(changedProperties);
    }
}

commonUtils.defineCustomElement('dbp-formalize-render-form', RenderForm);
