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

        // We are using the last path segment as the form identifier
        // TODO: Do we need some better way to get the form identifier?
        this.formIdentifier = this.getLastPathSegment();

        // If the last path segment is "render-form" (the activity path), we don't want to use it as the form identifier
        if (this.formIdentifier === 'render-form') {
            this.formIdentifier = '';
        }
    }

    getLastPathSegment() {
        return window.location.pathname.split('/').filter(segment => segment).pop();
    }

    static get scopedElements() {
        return {
        };
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
    async loadModules() {
        try {
            // Fetch the JSON file containing module paths
            const response = await fetch(this.basePath + 'modules.json');
            const data = await response.json();
            console.log('loadModules data', data);

            console.log('data', data);
            let formComponents = {};

            // Iterate over the module paths and dynamically import each module
            for (const [formKey, path] of Object.entries(data["forms"])) {
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
            return html`No form identifier provided!`;
        }

        if (!formComponents) {
            return html`Loading...`;
        }

        if (!formComponents[formIdentifier]) {
            console.log('formIdentifier not found', formIdentifier);
            return html`Form <strong>${formIdentifier}</strong> not found!`;
        }

        const tagPart = pascalToKebab(formIdentifier);
        const tagName = 'dbp-formalize-form-' + tagPart;

        console.log('getDocumentEditFormHtml formIdentifier', formIdentifier);
        console.log('getDocumentEditFormHtml tagName', tagName);
        console.log('getDocumentEditFormHtml this.formComponents[formIdentifier]', this.formComponents[formIdentifier]);

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
            Hello world for form "${this.formIdentifier}"!
            <hr />
            ${this.getFormHtml()}
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-render-form', RenderForm);
