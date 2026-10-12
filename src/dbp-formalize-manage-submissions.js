// @ts-nocheck
import {html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {sendNotification} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {FormSubmissions} from './form-submissions.js';
import {createDefaultManageSubmissionsOverviewActions} from './manage-forms-overview-actions.js';
import {ManageFormsActivityBase} from './manage-forms-activity-base.js';
import {getListOfAllForms} from './manage-forms-api.js';
import {
    getReadableSubmissionIds,
    isPersonalSubmission,
    readFormSubmissions,
} from './personal-submissions.js';

/**
 * Activity to view and manage form submissions.
 *
 * Only forms containing the user's own or explicitly shared submissions are listed.
 * Collection-level access alone does not qualify a form or submission.
 *
 * Routing: `/` shows the forms overview, `/<formId>` the submissions of a form and
 * `/<formId>/details/<submissionId>` additionally opens a submission.
 *
 * @augments {ManageFormsActivityBase}
 */
export class ManageSubmissions extends ManageFormsActivityBase {
    constructor() {
        super();
        this.activeFormId = '';
        this.enableSubmissionPermissionEditing = false;
    }

    static get activityName() {
        return 'manage-submissions';
    }

    static get scopedElements() {
        return {
            ...super.scopedElements,
            'dbp-formalize-form-submissions': FormSubmissions,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            activeFormId: {type: String, attribute: false},
            enableSubmissionPermissionEditing: {
                type: Boolean,
                attribute: 'enable-submission-permission-editing',
            },
        };
    }

    getFormsCollectionFilters() {
        return {whereMayReadSubmissions: 'true'};
    }

    async filterFormsCollection(entries) {
        if (entries.length === 0) return [];
        const readableIds = await getReadableSubmissionIds(this);
        // Sequential requests avoid flooding the API when many forms are available.
        const personalForms = [];
        for (const entry of entries) {
            const submissions = await readFormSubmissions(this, entry.identifier);
            const personalSubmissionIds = new Set(
                submissions
                    .filter((submission) =>
                        isPersonalSubmission(submission, this.auth?.['user-id'], readableIds),
                    )
                    .map((submission) => submission.identifier),
            );
            if (personalSubmissionIds.size > 0) {
                personalForms.push({...entry, personalSubmissionIds});
            }
        }
        return personalForms;
    }

    isFormListed(entry) {
        return true;
    }

    createDefaultOverviewActions() {
        return createDefaultManageSubmissionsOverviewActions();
    }

    getFormSubmissions() {
        return this._('dbp-formalize-form-submissions');
    }

    handleRoute() {
        const formId = this.getRoutingData().pathSegments[0] || '';
        if (!formId) {
            this.activeFormId = '';
            this.showFormsOverview();
            return;
        }

        if (!this.allForms.some((form) => form.formId === formId)) {
            if (this.isLoggedIn() && !this.loadingFormsTable) {
                sendNotification({
                    summary: this._i18n.t('errors.notfound-title'),
                    body: this._i18n.t('errors.notfound-body'),
                    type: 'danger',
                    timeout: 0,
                });
            }
            this.activeFormId = '';
            this.showFormsOverview();
            return;
        }

        this.activeFormId = formId;
        this.showFormsTable = false;
    }

    /**
     * Shows the submissions of the given form.
     * @param {string} formId
     */
    openFormSubmissions(formId) {
        this.setRoutingUrl(this.getRoutingUrlWithQueryPrefixes(`/${formId}`, ['forms-']));
    }

    handleBackToOverview() {
        this.activeFormId = '';
        this.showFormsOverview();
        this.setRoutingUrl(this.getRoutingUrlWithQueryPrefixes('/', ['forms-']));
    }

    handleSubmissionsDeleted(event) {
        if (event.detail.formId !== this.activeFormId) return;
        if (event.detail.remainingCount === 0) this.handleBackToOverview();
        // Deleting the last personal submission must remove the form from the overview.
        void getListOfAllForms(this);
    }

    render() {
        const activeForm = this.activeFormId ? (this.forms.get(this.activeFormId) ?? null) : null;

        return html`
            ${this.renderLoginState()}

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isAuthPending()})}">
                <div>
                    <slot name="additional-information"></slot>
                </div>

                ${this.renderOverview()}

                <dbp-formalize-form-submissions
                    class="${classMap({hidden: !activeForm})}"
                    lang="${this.lang}"
                    lang-dir="${this.langDir}"
                    entry-point-url="${this.entryPointUrl}"
                    .auth=${this.auth}
                    .routingUrl=${this.routingUrl}
                    .form=${activeForm}
                    .hideCreateSubmissionButton=${true}
                    .enableSubmissionPermissionEditing=${this.enableSubmissionPermissionEditing}
                    .paginationSizeStorageKey=${this.getPaginationSizeStorageKey()}
                    @submissions-deleted=${(event) => this.handleSubmissionsDeleted(event)}
                    @back-to-overview=${() =>
                        this.handleBackToOverview()}></dbp-formalize-form-submissions>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-manage-submissions', ManageSubmissions);
