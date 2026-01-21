import {css, html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {DbpBaseElement} from '@dbp-toolkit/form-elements/src/base-element.js';
import {CourseSelect} from '../../modules/course-select.js';

export class DbpCourseSelectElement extends ScopedElementsMixin(DbpBaseElement) {
    constructor() {
        super();
        this.entryPointUrl = null;
    }

    static get properties() {
        return {
            ...super.properties,
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
        };
    }

    static get scopedElements() {
        return {
            'dbp-course-select': CourseSelect,
        };
    }

    async fetchGermanCourseData(idPath) {
        const response = await fetch(this.entryPointUrl + idPath, {
            headers: {
                'Content-Type': 'application/ld+json',
                'Accept-Language': 'de',
                Authorization: 'Bearer ' + this.auth.token,
            },
        });

        if (!response.ok) {
            return null;
        } else {
            try {
                return await response.json();
            } catch {
                return null;
            }
        }
    }

    async handleInputValue(e) {
        let courseDataObject = JSON.parse(e.target.getAttribute('data-object'));
        const originalCourseObject = courseDataObject;

        // Specify the value to be included in the form submission
        if (courseDataObject != null) {
            // We get the course type and term from the original data object
            // because we will not get the localData with the API request
            let courseType = courseDataObject['localData']['type'];
            let courseTerm = courseDataObject['localData']['teachingTerm'];

            // If the language wasn't German, try to fetch German data
            if (this.lang !== 'de') {
                const data = await this.fetchGermanCourseData(courseDataObject['@id']);
                if (data != null) {
                    courseDataObject = data;
                }
            }

            let courseCode = courseDataObject['code'];
            let courseName = courseDataObject['name'];
            this.value = `${courseCode}: ${courseName} (${courseType}, ${courseTerm})`;
        }
        this.dispatchEvent(
            new CustomEvent('dbp-course-changed', {
                detail: {course: originalCourseObject},
                bubbles: true,
                composed: true,
            }),
        );
    }

    renderInput() {
        return html`
            <div class="control">
                <dbp-course-select
                    id="${this.name}-picker"
                    name="${this.name}Picker"
                    subscribe="lang,auth,entry-point-url"
                    @change="${(e) => this.handleInputValue(e)}"></dbp-course-select>
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
            `,
        ];
    }
}

commonUtils.defineCustomElement('dbp-course-select-element', DbpCourseSelectElement);
