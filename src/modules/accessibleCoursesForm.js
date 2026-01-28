import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html, css} from 'lit';
import {classMap} from 'lit-html/directives/class-map.js';
import {DbpStringElement} from '@dbp-toolkit/form-elements';
import {CourseSelect} from './course-select.js';
import {DbpCourseSelectElement} from '../form/elements/courseselect.js';

export default class extends BaseObject {
    getUrlSlug() {
        // URL-Slug für barrierefreie Kurse
        return 'accessible-courses';
    }

    getFormComponent() {
        return FormalizeFormElement;
    }

    // Formalize-Formular-ID für die Kurs-Anmeldung
    getFormIdentifier() {
        return '019ada3e-b7ff-7b35-b1dd-7b578d810955';
    }
}

class FormalizeFormElement extends BaseFormElement {
    constructor() {
        super();
    }

    static get properties() {
        return {
            ...super.properties,
            submissionError: {type: Boolean},
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            this.addEventListener('DbpFormalizeFormSubmission', async (event) => {
                const formData = event.detail.formData;

                // Identifier of the student
                formData.identifier = this.formData.identifier;

                // Lecturer Data
                formData.lecturerName = this.formData.lecturerName || '';
                formData.lecturerEmail = this.formData.lecturerEmail || '';
                try {
                    this.isPostingSubmission = true;
                    if (this.wasSubmissionSuccessful) return;

                    //submit relevant data
                    const payload = {
                        courseName: formData.courseName,
                        lecturerName: formData.lecturerName || '',
                        lecturerEmail: formData.lecturerEmail || '',
                        studentName: `${formData.givenName} ${formData.familyName}`,
                        studentEmail: formData.email_student,
                        comment: formData.comment,
                    };

                    const body = {
                        form: '/formalize/forms/' + '019ada3e-b7ff-7b35-b1dd-7b578d810955',
                        dataFeedElement: JSON.stringify(payload),
                    };

                    const response = await fetch(this.entryPointUrl + '/formalize/submissions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/ld+json',
                            Authorization: 'Bearer ' + this.auth.token,
                        },
                        body: JSON.stringify(body),
                    });

                    if (!response.ok) {
                        this.submissionError = true;
                        this.saveButtonEnabled = true;
                        throw new Error(`Response status: ${response.status}`);
                    } else {
                        this.wasSubmissionSuccessful = true;
                        this.submissionError = false;
                        this._('.title').style.display = 'none';
                        this._('.description').style.display = 'none';
                        this._('#accessible-courses-form').style.display = 'none';

                        // Notify parent component to refresh submission data
                        window.dispatchEvent(
                            new CustomEvent('dbpFormDataUpdated', {
                                detail: {needUpdate: true},
                                bubbles: true,
                                composed: true,
                            }),
                        );
                    }

                    this.submitted = this.wasSubmissionSuccessful;
                    return response;
                } catch (error) {
                    console.error(error.message);
                } finally {
                    this.isPostingSubmission = false;
                }
            });
        });
    }

    static get scopedElements() {
        return {
            'dbp-form-string-element': DbpStringElement,
            'dbp-course-select-element': DbpCourseSelectElement,
            'dbp-course-select': CourseSelect,
        };
    }

    async fetchUserData() {
        try {
            const response = await fetch(
                this.entryPointUrl +
                    '/base/people/' +
                    this.auth['user-id'] +
                    '?includeLocal=email,matriculationNumber',
                {
                    headers: {
                        'Content-Type': 'application/ld+json',
                        Authorization: 'Bearer ' + this.auth.token,
                    },
                },
            );
            if (!response.ok) throw new Error(response);

            this.formData = await response.json();
            this.formData.identifier = `${this.formData['identifier']}`;
            this.formData.givenName = `${this.formData['givenName']}`;
            this.formData.familyName = `${this.formData['familyName']}`;
            this.formData.matriculationNumber = `${this.formData['localData']['matriculationNumber']}`;
            this.formData.email_student = `${this.formData['localData']['email']}`;
        } catch (error) {
            console.error(error.message);
        }
    }

    // Reaction to dbp-course-changed
    async handleCourseChange(e) {
        if (!this.formData) {
            this.formData = {};
        }

        const course = e.detail?.course;
        if (!course) {
            this.formData.lecturerName = '';
            this.formData.lecturerEmail = '';
            this.requestUpdate();
            return;
        }
        const lecturerIds = course.localData?.lecturers || [];

        const lecturers = [];
        const lecturerNames = [];
        const lecturerEmails = [];

        for (const lecturerId of lecturerIds) {
            try {
                const resp = await fetch(
                    `${this.entryPointUrl}/base/people/${lecturerId}?includeLocal=email`,
                    {
                        headers: {
                            'Content-Type': 'application/ld+json',
                            Authorization: 'Bearer ' + this.auth.token,
                        },
                    },
                );

                if (!resp.ok) {
                    console.warn('Lecturer fetch failed for', lecturerId, resp.status);
                    lecturers.push({id: lecturerId, name: lecturerId, email: null});
                    lecturerNames.push(lecturerId);
                    continue;
                }

                const person = await resp.json();
                const name = `${person.givenName ?? ''} ${person.familyName ?? ''}`.trim();
                const email = person.localData?.email ?? null;

                lecturers.push({id: lecturerId, name: name || lecturerId, email});
                lecturerNames.push(name || lecturerId);
                if (email) {
                    lecturerEmails.push(email);
                }
            } catch (err) {
                console.error('Error fetching lecturer', lecturerId, err);
            }
        }
        // structured Data & Strings
        this.formData.lecturers = lecturers;
        this.formData.lecturerName = lecturerNames.join(', ');
        this.formData.lecturerEmail = lecturerEmails.join(', ');
        this.formData.lecturerId = lecturerIds.join(', ');

        //refresh UI
        this.requestUpdate();
    }

    static get styles() {
        return [
            super.styles,
            css`
                .title {
                    margin-top: 0;
                }
            `,
        ];
    }

    render() {
        const i18n = this._i18n;

        if (!this.formData.givenName && !this.formData.familyName) {
            this.fetchUserData();
        }

        const data = this.formData || {};

        return html`
            <h2 class="title">${i18n.t('render-form.forms.accessible-courses-form.title')}</h2>
            <p class="description">
                ${i18n.t('render-form.forms.accessible-courses-form.mandatory-fields')}
                <br />
                ${i18n.t('render-form.forms.accessible-courses-form.course-information')}
            </p>
            <form id="accessible-courses-form">
                <fieldset>
                    <legend>
                        ${i18n.t('render-form.forms.accessible-courses-form.course-data')}
                    </legend>

                    <dbp-course-select-element
                        subscribe="lang,auth,entry-point-url"
                        name="courseName"
                        label="${i18n.t('render-form.forms.accessible-courses-form.course-name')}"
                        value=${data.courseName || ''}
                        required
                        @dbp-course-changed="${(e) =>
                            this.handleCourseChange(e)}"></dbp-course-select-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="comment"
                        label=${i18n.t('render-form.forms.accessible-courses-form.comment')}
                        value=${data.comment || ''}></dbp-form-string-element>
                </fieldset>

                <fieldset>
                    <legend>
                        ${i18n.t('render-form.forms.accessible-courses-form.personal-data')}
                    </legend>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="matriculationNumber"
                        label=${i18n.t(
                            'render-form.forms.accessible-courses-form.matriculation-number',
                        )}
                        value=${data.matriculationNumber || ''}
                        disabled></dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="givenName"
                        label=${i18n.t('render-form.forms.accessible-courses-form.given-name')}
                        value=${data.givenName || ''}
                        disabled></dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="familyName"
                        label=${i18n.t('render-form.forms.accessible-courses-form.family-name')}
                        value=${data.familyName || ''}
                        disabled></dbp-form-string-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="email_student"
                        label=${i18n.t('render-form.forms.accessible-courses-form.email')}
                        value=${data.email_student || ''}
                        disabled></dbp-form-string-element>
                </fieldset>

                ${this.getButtonRowHtml()}
            </form>

            ${this.renderResult(this.submitted)} ${this.renderErrorMessage(this.submissionError)}
        `;
    }

    /**
     * Render the buttons needed for the form.
     * @returns {import('lit').TemplateResult} HTML for the button row.
     */
    getButtonRowHtml() {
        const i18n = this._i18n;
        return html`
            <div class="button-row">
                <button class="button is-secondary" type="button" @click=${this.resetForm} hidden>
                    ${i18n.t('render-form.button-row.reset')}
                </button>
                <button
                    class="button is-primary"
                    type="submit"
                    ?disabled=${!this.saveButtonEnabled}
                    @click=${(event) => this.validateAndSendSubmission(event)}>
                    ${i18n.t('render-form.button-row.submit')}
                    <dbp-mini-spinner
                        class="${classMap({hidden: this.saveButtonEnabled})}"></dbp-mini-spinner>
                </button>
            </div>
        `;
    }

    renderResult(submitted) {
        const i18n = this._i18n;

        if (submitted) {
            return html`
                <div class="container">
                    <h2>
                        ${i18n.t(
                            'render-form.forms.accessible-courses-form.submission-result-thanks',
                        )}
                    </h2>
                    <p>
                        ${i18n.t(
                            'render-form.forms.accessible-courses-form.submission-result-notification',
                        )}
                    </p>
                </div>
            `;
        }
        return html``;
    }

    renderErrorMessage(submissionError) {
        const i18n = this._i18n;

        if (submissionError) {
            return html`
                <div class="container">
                    <h2>${i18n.t('render-form.forms.accessible-courses-form.submission-error')}</h2>
                    <p>
                        ${i18n.t(
                            'render-form.forms.accessible-courses-form.submission-error-notification',
                        )}
                    </p>
                </div>
            `;
        }
        return html``;
    }
}
