import {html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {DbpBaseElement} from '@dbp-toolkit/form-elements/src/base-element.js';
import {ResourceSelect} from '@dbp-toolkit/resource-select';
import {createInstance} from '../../i18n.js';

export class CourseSelect extends ResourceSelect {
    constructor() {
        super();
        this._courseI18n = createInstance();
        this.resourcePath = '/base/courses';
        this.fetchMode = 'search';
        this.placeholder = this._getCoursePlaceholder();
    }

    update(changedProperties) {
        if (changedProperties.has('lang')) {
            this._courseI18n.changeLanguage(this.lang);
            this.placeholder = this._getCoursePlaceholder();
        }

        super.update(changedProperties);
    }

    _getCoursePlaceholder() {
        return this._courseI18n.t('render-form.course-select.placeholder');
    }

    getCollectionQueryParameters(select) {
        return [
            ['includeLocal', 'semesterKey,typeKey,lecturers'],
            ['filter[localData.semesterKey][operator]', 'IN'],
            ...CourseSelect.getSemesterKeys().map((semesterKey) => [
                'filter[localData.semesterKey][value][]',
                semesterKey,
            ]),
        ];
    }

    getSearchQueryParameters(select, searchTerm) {
        return {
            // Course codes do not contain dots, but CAMPUSonline displays them with dots.
            search: searchTerm.replaceAll('.', '').trim(),
        };
    }

    getItemQueryParameters(select) {
        return {
            includeLocal: 'semesterKey,typeKey,lecturers',
        };
    }

    static getSemesterKeys() {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        if (currentMonth >= 10 || currentMonth <= 2) {
            const winterStartYear =
                currentMonth >= 10 && currentMonth <= 12 ? currentYear : currentYear - 1;
            const summerYear = winterStartYear + 1;

            return [`"${winterStartYear}S"`, `"${winterStartYear}W"`, `"${summerYear}S"`];
        }

        const yearBefore = currentYear - 1;
        return [`"${yearBefore}W"`, `"${currentYear}S"`, `"${currentYear}W"`];
    }

    formatResource(select, course) {
        return this.formatCourse(course);
    }

    formatCourse(course) {
        const courseCode = course.code ?? '';
        const courseName = course.name ?? '';
        const courseType = course.localData?.typeKey ?? '';
        let courseTerm = course.localData?.semesterKey ?? '';

        const courseTermParts = this.parseSemesterKey(courseTerm);
        if (courseTermParts) {
            courseTerm =
                courseTermParts.term === 'W'
                    ? this._courseI18n.t('render-form.course-select.winter-term', {
                          year: courseTermParts.year,
                          nextYear: courseTermParts.year + 1,
                      })
                    : this._courseI18n.t('render-form.course-select.summer-term', {
                          year: courseTermParts.year,
                      });
        }

        return `${courseCode}: ${courseName} (${courseType}, ${courseTerm})`;
    }

    parseSemesterKey(semesterKey) {
        if (typeof semesterKey !== 'string') return null;
        const match = semesterKey.match(/^(\d{4})([WS])$/i);
        if (!match) return null;

        return {year: Number(match[1]), term: match[2].toUpperCase()};
    }
}

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
        e.stopPropagation();

        let courseDataObject = e.detail.object;
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
        } else {
            this.value = '';
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
}

commonUtils.defineCustomElement('dbp-course-select-element', DbpCourseSelectElement);
