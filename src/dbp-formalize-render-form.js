import {html} from 'lit';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';
import {BaseObject} from './baseObject.js';

class RenderForm extends ScopedElementsMixin(DBPFormalizeLitElement) {
    constructor() {
        super();
        this.formComponents = {};
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

                if (object.name) {
                    const name = object.name;
                    console.log(name);
                    // If the name starts with "file", add it to the list of file document types
                    if (name.startsWith('file') && object.getAdditionalTypes) {
                        for (const [key, value] of Object.entries(object.getAdditionalTypes())) {
                            this.fileDocumentTypeNames[name + '---' + key] = value;
                        }
                    }
                }

                if (object.getFormComponent) {
                    formComponents[object.name] = object.getFormComponent();
                }
            }

            this.formComponents = formComponents;
            console.log('formComponents', formComponents);
        } catch (error) {
            console.error('Error loading modules:', error);
        }
    }

    render() {
        return html`
            Hello world!
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-render-form', RenderForm);
