import {css, html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {DbpBaseElement} from '@dbp-toolkit/form-elements/src/base.js';
import {CourseSelect} from '../../modules/course-select.js';

export class DbpCourseSelectElement extends ScopedElementsMixin(DbpBaseElement) {
    constructor() {
        super();
    }

    static get properties() {
        return {
            ...super.properties,
        };
    }

    static get ScopedElements() {
        return {
            'dbp-course-select': CourseSelect,
        };
    }

    handleInputValue(e) {
        let courseDataObject = JSON.parse(e.target.getAttribute('data-object'));
        // Specify the value to be included in the form submission
        if (courseDataObject != null) {
            this.value = courseDataObject.name;
        }
    }

    renderInput() {
        return html`
            <div class="control">
                <dbp-course-select
                    id="${this.id}-picker"
                    name="${this.name}Picker"
                    subscribe="lang, auth, entry-point-url"
                    @change="${this.handleInputValue}"
                    >
                </dbp-course-select>
            </div>
        `;
    }

    static get styles() {
        return [
            ...super.styles,
            // language=css
            css`
                /* For some reasons the selector chevron was very large */
                select:not(.select) {
                    background-size: 1em;
                }
            `
        ];
    }
}

commonUtils.defineCustomElement('dbp-course-select-element', DbpCourseSelectElement);
