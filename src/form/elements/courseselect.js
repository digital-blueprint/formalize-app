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
            let courseType = courseDataObject['localData']['typeKey'];
            let courseTerm = courseDataObject['localData']['semesterKey'];

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

    /**
     * Presets the CourseSelect element with the given course name.
     * It extracts the course ID from the name, fetches the course data,
     * and sets the CourseSelect's value and display text accordingly.
     *
     * @param {string} courseName - The course name in the format "12345: Course Name (Type, Term)". The number before the colon is used as the course ID.
     */
    async presetCourse(courseName) {
        if (!courseName) return;

        const courseId = courseName.replace(/^(.+?): .*/, '$1');
        const courseFilter = {
            'filter[foo][condition][path]': 'code',
            'filter[foo][condition][operator]': 'EQUALS',
            'filter[foo][condition][value]': `"${courseId}"`,
        };

        const courseFilterUrl = new URLSearchParams(courseFilter).toString();

        // Fetch the course object
        const resp = await fetch(
            this.entryPointUrl +
                `/base/courses?includeLocal=typeKey%2CsemesterKey&${courseFilterUrl}`,
            {headers: {Authorization: 'Bearer ' + this.auth.token}},
        );
        if (!resp.ok) return;

        const courseResponse = await resp.json();
        let course = courseResponse['hydra:member'][0];
        if (!course) return;

        // If the language isn't German, fetch German data for consistent naming
        // (same as handleInputValue does)
        if (this.lang !== 'de') {
            const germanData = await this.fetchGermanCourseData(course['@id']);
            if (germanData != null) {
                // Preserve localData from original since fetchGermanCourseData doesn't include it
                course = {...germanData, localData: course.localData};
            }
        }

        // Get the inner CourseSelect element and its Select2 instance
        const picker = this.shadowRoot.querySelector('#' + this.name + '-picker');
        const $select = picker?.$('#' + picker.selectId);
        if (!$select) return;

        // Format the display text (reuse CourseSelect's formatter)
        const text = picker.formatCourse(picker, course);

        // Inject the option and select it
        const option = new Option(text, courseId, true, true);
        $select.append(option).trigger('change');

        // Also set the data-object so handleInputValue can read it later
        picker.object = course;
        // Prevent CourseSelect.update() from calling initSelect2(), which would destroy
        // the option we just injected above.
        picker.ignoreValueUpdate = true;
        picker.value = courseId;
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        if (
            (changedProperties.has('value') || changedProperties.has('auth')) &&
            this.value &&
            this.auth?.token
        ) {
            this.updateComplete.then(() => {
                this.presetCourse(this.value);
            });
        }
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
