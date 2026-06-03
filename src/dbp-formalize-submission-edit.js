import {css, html} from 'lit';
import {html as staticHtml, unsafeStatic} from 'lit/static-html.js';
import {ref, createRef} from 'lit/directives/ref.js';
import {
    ScopedElementsMixin,
    Button,
    Icon,
    MiniSpinner,
    sendNotification,
} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';
import {SUBMISSION_STATES_BINARY} from './utils.js';
import {DeletionConfirmationModal} from './deletion-confirmation-modal.js';
import {
    gatherFormDataFromElement,
    validateRequiredFields,
} from '@dbp-toolkit/form-elements/src/utils.js';

function parseSubmissionData(submission) {
    if (!submission?.dataFeedElement) {
        return {};
    }

    try {
        return JSON.parse(submission.dataFeedElement);
    } catch (error) {
        console.error('Failed to parse item data:', error);
        return {};
    }
}

function parseListAttribute(value) {
    if (Array.isArray(value)) {
        return value.map((item) => `${item}`.trim()).filter((item) => item !== '');
    }

    if (typeof value !== 'string') {
        return [];
    }

    const trimmedValue = value.trim();
    if (trimmedValue === '') {
        return [];
    }

    try {
        const parsedValue = JSON.parse(trimmedValue);
        if (Array.isArray(parsedValue)) {
            return parsedValue.map((item) => `${item}`.trim()).filter((item) => item !== '');
        }
    } catch {
        // Fallback to comma-separated values for HTML attributes.
    }

    return trimmedValue
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
}

function getLocalizedFormName(form, lang) {
    const localizedName = form?.localizedNames?.find((name) => name.languageTag === lang);
    return localizedName?.name || form?.name || form?.identifier || '';
}

const itemFormsCache = new Map();
const itemFormsInflight = new Map();

class SubmissionEdit extends ScopedElementsMixin(DBPFormalizeLitElement) {
    constructor() {
        super();
        this.formRef = createRef();
        this.itemModules = [];
        this.itemFormEntries = [];
        this.activeModule = null;
        this.activeForm = null;
        this.items = [];
        this.selectedItem = null;
        this.mode = 'forms';
        this.loading = true;
        this.loadingItems = false;
        this.saving = false;
        this.errorMessage = '';
        this.itemFrontendKeys = '';
        this._hasLoadedForms = false;
        this._isLoadingForms = false;
        this._lastFrontendKeys = '';
        this._routeApplyPromise = Promise.resolve();
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-formalize-deletion-confirmation-modal': DeletionConfirmationModal,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            itemModules: {type: Array, attribute: false},
            itemFormEntries: {type: Array, attribute: false},
            activeModule: {type: Object, attribute: false},
            activeForm: {type: Object, attribute: false},
            items: {type: Array, attribute: false},
            selectedItem: {type: Object, attribute: false},
            mode: {type: String, attribute: false},
            loading: {type: Boolean, attribute: false},
            loadingItems: {type: Boolean, attribute: false},
            saving: {type: Boolean, attribute: false},
            errorMessage: {type: String, attribute: false},
            itemFrontendKeys: {type: String, attribute: 'item-frontend-keys'},
        };
    }

    async initialize() {
        await this.loadItemForms();
    }

    async loadItemForms() {
        if (!this.auth?.token || this._isLoadingForms) {
            return;
        }

        const cacheKey = `${this.basePath}|${this.entryPointUrl}|${this.itemFrontendKeys}`;
        const cachedResult = itemFormsCache.get(cacheKey);
        if (cachedResult) {
            this.itemModules = cachedResult.itemModules;
            this.itemFormEntries = cachedResult.itemFormEntries;
            this._hasLoadedForms = true;
            this._lastFrontendKeys = this.itemFrontendKeys;
            await this.applyRoute();
            return;
        }

        this._isLoadingForms = true;
        this.loading = true;
        this.errorMessage = '';

        try {
            let inflight = itemFormsInflight.get(cacheKey);
            if (!inflight) {
                inflight = this.loadItemFormEntries().finally(() => {
                    itemFormsInflight.delete(cacheKey);
                });
                itemFormsInflight.set(cacheKey, inflight);
            }

            const result = await inflight;
            itemFormsCache.set(cacheKey, result);

            this.itemModules = result.itemModules;
            this.itemFormEntries = result.itemFormEntries;
            this._hasLoadedForms = true;
            this._lastFrontendKeys = this.itemFrontendKeys;
            await this.applyRoute();
        } catch (error) {
            console.error(error);
            this.errorMessage = this._i18n.t('submission-edit.load-error');
        } finally {
            this._isLoadingForms = false;
            this.loading = false;
        }
    }

    async loadItemFormEntries() {
        const itemModules = await this.getItemModules();
        const itemFormEntries = await this.getMatchingForms(itemModules);
        return {itemModules, itemFormEntries};
    }

    async getItemModules() {
        const response = await fetch(this.basePath + 'modules.json');
        const data = await response.json();
        const itemEntries = Object.entries(data.items || {});
        const frontendKeys = parseListAttribute(this.itemFrontendKeys);

        const modules = [];
        for (const [, path] of itemEntries) {
            const absolutePath = new URL(path, window.location.origin + this.basePath).href;
            const module = await import(absolutePath);
            const object = new module.default();
            const frontendKey = object.getFormFrontendKey?.();

            if (
                object.getFormComponent &&
                object.getItemText &&
                (frontendKeys.length === 0 || frontendKeys.includes(frontendKey))
            ) {
                modules.push(object);
            }
        }

        return modules;
    }

    async getMatchingForms(itemModules) {
        if (itemModules.length === 0) {
            return [];
        }

        const frontendKeys = parseListAttribute(this.itemFrontendKeys);
        const formsUrl = new URL(this.entryPointUrl + '/formalize/forms');
        formsUrl.searchParams.set('perPage', '9999');
        frontendKeys.forEach((frontendKey) => {
            formsUrl.searchParams.append('whereFrontendKeyIn[]', frontendKey);
        });

        const response = await fetch(formsUrl.href, {
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
        });

        if (!response.ok) {
            this.handleErrorResponse(response);
            return [];
        }

        const data = await response.json();
        const forms = data['hydra:member'] || [];
        const entries = [];

        for (const form of forms) {
            const module = itemModules.find((candidate) => {
                const frontendKey = candidate.getFormFrontendKey?.();
                const formIdentifier = candidate.getFormIdentifier?.();
                return (
                    (frontendKey && form.frontendKey === frontendKey) ||
                    (formIdentifier && form.identifier === formIdentifier)
                );
            });

            if (module) {
                entries.push({form, module});
            }
        }

        return entries;
    }

    async loadSubmissions() {
        if (!this.activeForm) {
            this.items = [];
            return;
        }

        this.loadingItems = true;

        try {
            const response = await fetch(
                this.entryPointUrl +
                    '/formalize/submissions?formIdentifier=' +
                    this.activeForm.identifier +
                    '&perPage=9999',
                {
                    headers: {
                        'Content-Type': 'application/ld+json',
                        Authorization: 'Bearer ' + this.auth.token,
                    },
                },
            );

            if (!response.ok) {
                this.handleErrorResponse(response);
                this.items = [];
                return;
            }

            const data = await response.json();
            this.items = data['hydra:member'] || [];
        } finally {
            this.loadingItems = false;
        }
    }

    async applyRoute() {
        if (!this._hasLoadedForms) {
            return;
        }

        const pathSegments = this.getRoutingData().pathSegments;
        const formIdentifier = pathSegments[0] || '';
        const actionOrItemIdentifier = pathSegments[1] || '';
        const editMarker = pathSegments[2] || '';

        if (!formIdentifier) {
            this.activeForm = null;
            this.activeModule = null;
            this.selectedItem = null;
            this.items = [];
            this.mode = 'forms';
            return;
        }

        const entry = this.itemFormEntries.find((itemFormEntry) => {
            return itemFormEntry.form.identifier === formIdentifier;
        });

        if (!entry) {
            this.activeForm = null;
            this.activeModule = null;
            this.selectedItem = null;
            this.items = [];
            this.mode = 'unknown-form';
            return;
        }

        const activeFormChanged = this.activeForm?.identifier !== entry.form.identifier;
        this.activeForm = entry.form;
        this.activeModule = entry.module;

        if (activeFormChanged || this.items.length === 0) {
            await this.loadSubmissions();
        }

        if (actionOrItemIdentifier === 'create') {
            this.selectedItem = null;
            this.mode = 'edit';
            return;
        }

        if (actionOrItemIdentifier && editMarker === 'edit') {
            this.selectedItem =
                this.items.find((item) => item.identifier === actionOrItemIdentifier) || null;
            this.mode = this.selectedItem ? 'edit' : 'unknown-item';
            return;
        }

        this.selectedItem = null;
        this.mode = 'list';
    }

    setRoute(path) {
        this.sendSetPropertyEvent('routing-url', path, true);
    }

    openForm(entry) {
        this.setRoute(`/${entry.form.identifier}`);
    }

    createItem(entry = null) {
        const form = entry?.form || this.activeForm;
        if (!form) {
            return;
        }

        this.setRoute(`/${form.identifier}/create`);
    }

    editItem(item) {
        if (!this.activeForm) {
            return;
        }

        this.setRoute(`/${this.activeForm.identifier}/${item.identifier}/edit`);
    }

    cancelEdit() {
        if (!this.activeForm) {
            this.setRoute('/');
            return;
        }

        this.setRoute(`/${this.activeForm.identifier}`);
    }

    async saveItem() {
        const formElement = this.formRef.value?.shadowRoot?.querySelector('form');
        if (!formElement) {
            return;
        }

        const isValid = await validateRequiredFields(formElement);
        if (!isValid) {
            sendNotification({
                summary: this._i18n.t('errors.warning-title'),
                body: this._i18n.t('errors.form-validation-warning-notification-body'),
                type: 'warning',
                timeout: 5,
            });
            return;
        }

        this.saving = true;
        const formData = new FormData();
        formData.append('dataFeedElement', JSON.stringify(gatherFormDataFromElement(formElement)));

        if (!this.selectedItem) {
            formData.append('form', '/formalize/forms/' + this.activeForm.identifier);
            formData.append('submissionState', String(SUBMISSION_STATES_BINARY.SUBMITTED));
        }

        try {
            const response = await fetch(
                this.selectedItem
                    ? this.entryPointUrl + '/formalize/submissions/' + this.selectedItem.identifier
                    : this.entryPointUrl + '/formalize/submissions',
                {
                    method: this.selectedItem ? 'PATCH' : 'POST',
                    headers: {
                        Authorization: 'Bearer ' + this.auth.token,
                    },
                    body: formData,
                },
            );

            if (!response.ok) {
                this.handleErrorResponse(response);
                return;
            }

            let savedItem = {};
            try {
                savedItem = await response.json();
            } catch {
                savedItem = {};
            }

            sendNotification({
                summary: this._i18n.t('success.success-title'),
                body: this._i18n.t(
                    this.selectedItem
                        ? 'submission-edit.item-updated'
                        : 'submission-edit.item-created',
                ),
                type: 'success',
                timeout: 5,
            });

            await this.loadSubmissions();
            const itemIdentifier = this.selectedItem?.identifier || savedItem.identifier;
            if (itemIdentifier) {
                this.setRoute(`/${this.activeForm.identifier}/${itemIdentifier}/edit`);
            } else {
                this.setRoute(`/${this.activeForm.identifier}`);
            }
        } finally {
            this.saving = false;
        }
    }

    async deleteItem(item) {
        const confirmed = await this.renderRoot
            .querySelector('dbp-formalize-deletion-confirmation-modal')
            ?.confirm();
        if (!confirmed) {
            return;
        }

        const response = await fetch(
            this.entryPointUrl + '/formalize/submissions/' + item.identifier,
            {
                method: 'DELETE',
                headers: {
                    Authorization: 'Bearer ' + this.auth.token,
                },
            },
        );

        if (!response.ok) {
            this.handleErrorResponse(response);
            return;
        }

        sendNotification({
            summary: this._i18n.t('success.success-title'),
            body: this._i18n.t('submission-edit.item-deleted'),
            type: 'success',
            timeout: 5,
        });
        await this.loadSubmissions();
        this.setRoute(`/${this.activeForm.identifier}`);
    }

    getItemTitle(item) {
        const data = parseSubmissionData(item);
        return (
            this.activeModule?.getItemText?.(data, this.lang) ||
            this._i18n.t('submission-edit.unnamed-item')
        );
    }

    getFormHtml() {
        if (!this.activeModule || !this.activeForm) {
            return html``;
        }

        const tagName = 'dbp-formalize-item-' + this.activeModule.getUrlSlug();
        if (!this.registry.get(tagName)) {
            this.registry.define(tagName, this.activeModule.getFormComponent());
        }

        const formData = this.selectedItem ? parseSubmissionData(this.selectedItem) : {};

        return staticHtml`
            <${unsafeStatic(tagName)}
                ${ref(this.formRef)}
                subscribe="auth,lang,entry-point-url"
                form-identifier=${this.activeForm.identifier}
                form-url-slug=${this.activeModule.getUrlSlug()}
                .formProperties=${this.activeForm}
                .formData=${formData}></${unsafeStatic(tagName)}>
        `;
    }

    renderFormOverview() {
        const i18n = this._i18n;

        if (this.itemFormEntries.length === 0) {
            return html`
                <div class="notification is-warning">${i18n.t('submission-edit.no-form')}</div>
            `;
        }

        return html`
            <div class="form-list">
                ${this.itemFormEntries.map(
                    (entry) => html`
                        <article class="form-row">
                            <div>
                                <strong>${getLocalizedFormName(entry.form, this.lang)}</strong>
                                <span>${entry.form.frontendKey || entry.form.identifier}</span>
                            </div>
                            <div class="item-actions">
                                <dbp-button
                                    type="is-secondary"
                                    no-spinner-on-click
                                    @click=${() => this.openForm(entry)}>
                                    <dbp-icon name="list" aria-hidden="true"></dbp-icon>
                                    ${i18n.t('submission-edit.open-form')}
                                </dbp-button>
                                <dbp-button
                                    type="is-primary"
                                    no-spinner-on-click
                                    @click=${() => this.createItem(entry)}>
                                    <dbp-icon name="plus" aria-hidden="true"></dbp-icon>
                                    ${i18n.t('submission-edit.create-item')}
                                </dbp-button>
                            </div>
                        </article>
                    `,
                )}
            </div>
        `;
    }

    renderList() {
        const i18n = this._i18n;

        return html`
            <div class="active-form-header">
                <dbp-button
                    type="is-secondary"
                    no-spinner-on-click
                    @click=${() => this.setRoute('/')}>
                    <dbp-icon name="arrow-left" aria-hidden="true"></dbp-icon>
                    ${i18n.t('submission-edit.back-to-forms')}
                </dbp-button>
                <h2>${getLocalizedFormName(this.activeForm, this.lang)}</h2>
                <dbp-button type="is-primary" no-spinner-on-click @click=${() => this.createItem()}>
                    <dbp-icon name="plus" aria-hidden="true"></dbp-icon>
                    ${i18n.t('submission-edit.create-item')}
                </dbp-button>
            </div>

            ${this.loadingItems
                ? html`
                      <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
                  `
                : this.items.length === 0
                  ? html`
                        <p class="empty-state">${i18n.t('submission-edit.no-items')}</p>
                    `
                  : html`
                        <div class="item-list">
                            ${this.items.map(
                                (item) => html`
                                    <article class="item-row">
                                        <div>
                                            <strong>${this.getItemTitle(item)}</strong>
                                            <span>${item.dateCreated || ''}</span>
                                        </div>
                                        <div class="item-actions">
                                            <dbp-button
                                                type="is-secondary"
                                                no-spinner-on-click
                                                @click=${() => this.editItem(item)}>
                                                <dbp-icon
                                                    name="pencil"
                                                    aria-hidden="true"></dbp-icon>
                                                ${i18n.t('submission-edit.edit-item')}
                                            </dbp-button>
                                            <dbp-button
                                                type="is-danger"
                                                no-spinner-on-click
                                                @click=${() => this.deleteItem(item)}>
                                                <dbp-icon
                                                    name="trash"
                                                    aria-hidden="true"></dbp-icon>
                                                ${i18n.t('submission-edit.delete-item')}
                                            </dbp-button>
                                        </div>
                                    </article>
                                `,
                            )}
                        </div>
                    `}
        `;
    }

    renderEdit() {
        const i18n = this._i18n;

        return html`
            <div class="edit-header">
                <div>
                    <h2>
                        ${this.selectedItem
                            ? i18n.t('submission-edit.edit-item')
                            : i18n.t('submission-edit.create-item')}
                    </h2>
                    <span>${getLocalizedFormName(this.activeForm, this.lang)}</span>
                </div>
                <dbp-button
                    type="is-secondary"
                    no-spinner-on-click
                    @click=${() => this.cancelEdit()}>
                    <dbp-icon name="close" aria-hidden="true"></dbp-icon>
                    ${i18n.t('submission-edit.cancel')}
                </dbp-button>
            </div>
            ${this.getFormHtml()}
            <div class="button-row">
                <dbp-button
                    type="is-primary"
                    ?disabled=${this.saving}
                    no-spinner-on-click
                    @click=${() => this.saveItem()}>
                    <dbp-icon name="checkmark-circle" aria-hidden="true"></dbp-icon>
                    ${i18n.t('submission-edit.save-item')}
                </dbp-button>
            </div>
        `;
    }

    renderContent() {
        if (this.mode === 'forms') {
            return this.renderFormOverview();
        }

        if (this.mode === 'unknown-form') {
            return html`
                <div class="notification is-warning">
                    ${this._i18n.t('submission-edit.unknown-form')}
                </div>
                ${this.renderFormOverview()}
            `;
        }

        if (this.mode === 'unknown-item') {
            return html`
                <div class="notification is-warning">
                    ${this._i18n.t('submission-edit.unknown-item')}
                </div>
                ${this.renderList()}
            `;
        }

        return this.mode === 'edit' ? this.renderEdit() : this.renderList();
    }

    render() {
        const i18n = this._i18n;

        if (!this.isLoggedIn() && !this.isAuthPending()) {
            return html`
                <div class="notification is-warning">
                    ${i18n.t('error-login-message')}
                    <a
                        href="#"
                        @click=${(event) => {
                            event.preventDefault();
                            this.sendSetPropertyEvent('requested-login-status', 'logged-in');
                        }}>
                        ${i18n.t('error-login-link')}
                    </a>
                </div>
            `;
        }

        if ((this.loading && !this._hasLoadedForms) || this.isAuthPending()) {
            return html`
                <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
            `;
        }

        if (this.errorMessage) {
            return html`
                <div class="notification is-danger">${this.errorMessage}</div>
            `;
        }

        if (this.itemModules.length === 0) {
            return html`
                <div class="notification is-warning">${i18n.t('submission-edit.no-module')}</div>
            `;
        }

        return html`
            <dbp-formalize-deletion-confirmation-modal
                subscribe="lang"></dbp-formalize-deletion-confirmation-modal>
            <section class="submission-edit">
                <h1>${i18n.t('submission-edit.title')}</h1>
                ${this.renderContent()}
            </section>
        `;
    }

    update(changedProperties) {
        super.update(changedProperties);

        const oldAuth = changedProperties.get('auth');
        const oldToken = oldAuth?.token || '';
        const newToken = this.auth?.token || '';
        const gainedToken = !oldToken && newToken;
        const itemFrontendKeysChanged =
            changedProperties.has('itemFrontendKeys') &&
            this._lastFrontendKeys !== this.itemFrontendKeys;

        if (((gainedToken && !this._hasLoadedForms) || itemFrontendKeysChanged) && newToken) {
            this.loadItemForms();
            return;
        }

        if (changedProperties.has('routingUrl') && this._hasLoadedForms) {
            this._routeApplyPromise = this._routeApplyPromise.then(() => this.applyRoute());
        }
    }

    static get styles() {
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getNotificationCSS()}

            :host {
                display: block;
            }

            .submission-edit {
                display: grid;
                gap: 1rem;
            }

            .active-form-header,
            .edit-header,
            .button-row {
                align-items: center;
                display: flex;
                gap: 0.75rem;
                justify-content: space-between;
            }

            .active-form-header h2,
            .edit-header h2 {
                margin: 0;
            }

            .edit-header span,
            .form-row span,
            .item-row span {
                color: var(--dbp-muted);
                display: block;
                font-size: 0.875rem;
                margin-top: 0.25rem;
            }

            .form-list,
            .item-list {
                display: grid;
                gap: 0.75rem;
            }

            .form-row,
            .item-row {
                align-items: center;
                border: var(--dbp-border);
                border-radius: 0.25rem;
                display: flex;
                gap: 1rem;
                justify-content: space-between;
                padding: 1rem;
            }

            .item-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                justify-content: end;
            }

            .empty-state {
                color: var(--dbp-muted);
            }

            @media (max-width: 640px) {
                .active-form-header,
                .edit-header,
                .button-row,
                .form-row,
                .item-row {
                    align-items: stretch;
                    flex-direction: column;
                }

                .item-actions {
                    justify-content: start;
                }
            }
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-submission-edit', SubmissionEdit);
