import {css, html} from 'lit';
import {html as staticHtml, unsafeStatic} from 'lit/static-html.js';
import {ref, createRef} from 'lit/directives/ref.js';
import {
    ScopedElementsMixin,
    Button,
    Icon,
    IconButton,
    MiniSpinner,
    sendNotification,
} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import DBPFormalizeLitElement from './dbp-formalize-lit-element.js';
import {SUBMISSION_STATES_BINARY} from './utils.js';
import {DeletionConfirmationModal} from './deletion-confirmation-modal.js';
import {CustomTabulatorTable, GetDetailsButton} from './table-components.js';
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

class ManageFields extends ScopedElementsMixin(DBPFormalizeLitElement) {
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
        this._submissionsLoadPromise = null;
        this._submissionsLoadFormIdentifier = '';
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-icon-button': IconButton,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-formalize-get-details-button': GetDetailsButton,
            'dbp-tabulator-table': CustomTabulatorTable,
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
            this.errorMessage = this._i18n.t('manage-fields.load-error');
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

        const formIdentifier = this.activeForm.identifier;
        if (
            this._submissionsLoadPromise &&
            this._submissionsLoadFormIdentifier === formIdentifier
        ) {
            await this._submissionsLoadPromise;
            return;
        }

        this.loadingItems = true;
        this._submissionsLoadFormIdentifier = formIdentifier;
        const loadPromise = this.fetchSubmissions(formIdentifier).finally(() => {
            if (this._submissionsLoadPromise === loadPromise) {
                this._submissionsLoadPromise = null;
                this._submissionsLoadFormIdentifier = '';
                this.loadingItems = false;
            }
        });
        this._submissionsLoadPromise = loadPromise;

        await this._submissionsLoadPromise;
    }

    async fetchSubmissions(formIdentifier) {
        const response = await fetch(
            this.entryPointUrl +
                '/formalize/submissions?formIdentifier=' +
                formIdentifier +
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
        if (this.activeForm?.identifier === formIdentifier) {
            this.items = data['hydra:member'] || [];
        }
    }

    getNormalizedRouteSegments() {
        const segments = [...this.getRoutingData().pathSegments];
        const basePathSegments = new URL(this.basePath || '/', window.location.origin).pathname
            .split('/')
            .filter((segment) => segment !== '');

        while (basePathSegments.length > 0 && segments[0] === basePathSegments[0]) {
            segments.shift();
            basePathSegments.shift();
        }

        if (this._i18n.languages.includes(segments[0])) {
            segments.shift();
        }

        const formSegmentIndex = segments.findIndex((segment) => {
            return this.itemFormEntries.some((entry) => entry.form.identifier === segment);
        });
        if (formSegmentIndex > 0) {
            return segments.slice(formSegmentIndex);
        }

        return segments;
    }

    async applyRoute() {
        if (!this._hasLoadedForms) {
            return;
        }

        const pathSegments = this.getNormalizedRouteSegments();
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

            try {
                await response.json();
            } catch {
                // The API may return an empty body for PATCH responses.
            }

            sendNotification({
                summary: this._i18n.t('success.success-title'),
                body: this._i18n.t(
                    this.selectedItem ? 'manage-fields.item-updated' : 'manage-fields.item-created',
                ),
                type: 'success',
                timeout: 5,
            });

            await this.loadSubmissions();
            this.setRoute(`/${this.activeForm.identifier}`);
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
            body: this._i18n.t('manage-fields.item-deleted'),
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
            this._i18n.t('manage-fields.unnamed-item')
        );
    }

    getFormTableData() {
        return this.itemFormEntries.map((entry) => ({
            name: getLocalizedFormName(entry.form, this.lang),
            entry,
        }));
    }

    getItemTableData() {
        return this.items.map((item) => ({
            title: this.getItemTitle(item),
            dateCreated: item.dateCreated || '',
            item,
        }));
    }

    createTableActionButton(iconName, title, onClick) {
        const button = this.createScopedElement('dbp-icon-button');
        button.setAttribute('subscribe', 'lang');
        button.setAttribute('icon-name', iconName);
        button.title = title;
        button.setAttribute('aria-label', title);
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            onClick();
        });

        return button;
    }

    createTableActions(buttons) {
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.flexWrap = 'wrap';
        actions.style.gap = '0.5rem';
        actions.style.alignItems = 'center';
        actions.style.justifyContent = 'flex-end';
        buttons.forEach((button) => actions.append(button));
        return actions;
    }

    createFormActions(entry) {
        const i18n = this._i18n;
        const openButton = this.createScopedElement('dbp-formalize-get-details-button');
        openButton.setAttribute('subscribe', 'lang');
        openButton.title = i18n.t('manage-fields.open-form');
        openButton.ariaLabel = i18n.t('manage-fields.open-form');
        openButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.openForm(entry);
        });

        return this.createTableActions([
            openButton,
            this.createTableActionButton('plus', i18n.t('manage-fields.create-item'), () =>
                this.createItem(entry),
            ),
        ]);
    }

    createItemActions(item) {
        const i18n = this._i18n;
        return this.createTableActions([
            this.createTableActionButton('pencil', i18n.t('manage-fields.edit-item'), () =>
                this.editItem(item),
            ),
            this.createTableActionButton('trash', i18n.t('manage-fields.delete-item'), () =>
                this.deleteItem(item),
            ),
        ]);
    }

    getFormTableOptions() {
        const i18n = this._i18n;
        const langsForms = {
            en: {
                columns: {
                    name: i18n.t('manage-fields.form', {lng: 'en'}),
                },
            },
            de: {
                columns: {
                    name: i18n.t('manage-fields.form', {lng: 'de'}),
                },
            },
        };

        return {
            langs: langsForms,
            data: this.getFormTableData(),
            layout: 'fitColumns',
            rowHeight: 64,
            columnDefaults: {
                vertAlign: 'middle',
                hozAlign: 'left',
                resizable: false,
            },
            placeholder: i18n.t('manage-fields.no-form'),
            columns: [
                {field: 'name', sorter: 'string', minWidth: 220},
                {
                    field: 'actions',
                    headerSort: false,
                    hozAlign: 'right',
                    formatter: (cell) => this.createFormActions(cell.getRow().getData().entry),
                    minWidth: 120,
                },
            ],
        };
    }

    getItemTableOptions() {
        const i18n = this._i18n;
        const langsItems = {
            en: {
                columns: {
                    title: i18n.t('manage-fields.item', {lng: 'en'}),
                    dateCreated: i18n.t('manage-fields.date-created', {lng: 'en'}),
                },
            },
            de: {
                columns: {
                    title: i18n.t('manage-fields.item', {lng: 'de'}),
                    dateCreated: i18n.t('manage-fields.date-created', {lng: 'de'}),
                },
            },
        };

        return {
            langs: langsItems,
            data: this.getItemTableData(),
            layout: 'fitColumns',
            rowHeight: 64,
            columnDefaults: {
                vertAlign: 'middle',
                hozAlign: 'left',
                resizable: false,
            },
            placeholder: i18n.t('manage-fields.no-items'),
            columns: [
                {field: 'title', sorter: 'string', minWidth: 220},
                {field: 'dateCreated', sorter: 'string', minWidth: 180},
                {
                    field: 'actions',
                    headerSort: false,
                    hozAlign: 'right',
                    formatter: (cell) => this.createItemActions(cell.getRow().getData().item),
                    minWidth: 120,
                },
            ],
        };
    }

    async syncTabulatorTable(selector, options) {
        const table = this.renderRoot?.querySelector(selector);
        if (!table) {
            return;
        }

        table.options = options;
        table.data = options.data;

        if (!table.tabulatorTable) {
            await table.updateComplete;
            if (!table.tabulatorTable && !table.tableBuilding) {
                table.buildTable();
            }
            return;
        }

        table.tabulatorTable.setColumns(options.columns);
        table.tabulatorTable.setLocale(this.lang);
        table.tabulatorTable.replaceData(options.data);
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
                <div class="notification is-warning">${i18n.t('manage-fields.no-form')}</div>
            `;
        }

        return html`
            <dbp-tabulator-table
                lang="${this.lang}"
                class="tabulator-table"
                id="manage-fields-form-table"
                identifier="manage-fields-form-table"
                pagination-enabled
                pagination-size="5"
                .options=${this.getFormTableOptions()}></dbp-tabulator-table>
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
                    ${i18n.t('manage-fields.back-to-forms')}
                </dbp-button>
                <h2>${getLocalizedFormName(this.activeForm, this.lang)}</h2>
                <dbp-button type="is-primary" no-spinner-on-click @click=${() => this.createItem()}>
                    <dbp-icon name="plus" aria-hidden="true"></dbp-icon>
                    ${i18n.t('manage-fields.create-item')}
                </dbp-button>
            </div>

            ${this.loadingItems
                ? html`
                      <dbp-mini-spinner text="${i18n.t('loading-message')}"></dbp-mini-spinner>
                  `
                : this.items.length === 0
                  ? html`
                        <p class="empty-state">${i18n.t('manage-fields.no-items')}</p>
                    `
                  : html`
                        <dbp-tabulator-table
                            lang="${this.lang}"
                            class="tabulator-table"
                            id="manage-fields-item-table"
                            identifier="manage-fields-item-table"
                            pagination-enabled
                            pagination-size="5"
                            .options=${this.getItemTableOptions()}></dbp-tabulator-table>
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
                            ? i18n.t('manage-fields.edit-item')
                            : i18n.t('manage-fields.create-item')}
                    </h2>
                    <span>${getLocalizedFormName(this.activeForm, this.lang)}</span>
                </div>
                <dbp-button
                    type="is-secondary"
                    no-spinner-on-click
                    @click=${() => this.cancelEdit()}>
                    <dbp-icon name="close" aria-hidden="true"></dbp-icon>
                    ${i18n.t('manage-fields.cancel')}
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
                    ${i18n.t('manage-fields.save-item')}
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
                    ${this._i18n.t('manage-fields.unknown-form')}
                </div>
                ${this.renderFormOverview()}
            `;
        }

        if (this.mode === 'unknown-item') {
            return html`
                <div class="notification is-warning">
                    ${this._i18n.t('manage-fields.unknown-item')}
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
                <div class="notification is-warning">${i18n.t('manage-fields.no-module')}</div>
            `;
        }

        return html`
            <dbp-formalize-deletion-confirmation-modal
                subscribe="lang"
                message-key="manage-fields.delete-confirmation-message"
                message-li2-key="manage-fields.delete-confirmation-message-li2"></dbp-formalize-deletion-confirmation-modal>
            <section class="manage-fields">
                <h1>${i18n.t('manage-fields.title')}</h1>
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

    updated(changedProperties) {
        super.updated?.(changedProperties);

        if (
            changedProperties.has('itemFormEntries') ||
            changedProperties.has('items') ||
            changedProperties.has('lang') ||
            changedProperties.has('mode')
        ) {
            this.syncTabulatorTable('#manage-fields-form-table', this.getFormTableOptions());
            this.syncTabulatorTable('#manage-fields-item-table', this.getItemTableOptions());
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

            .manage-fields {
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

            .edit-header span {
                color: var(--dbp-muted);
                display: block;
                font-size: 0.875rem;
                margin-top: 0.25rem;
            }

            .tabulator-table {
                width: 100%;
            }

            .empty-state {
                color: var(--dbp-muted);
            }

            @media (max-width: 640px) {
                .active-form-header,
                .edit-header,
                .button-row {
                    align-items: stretch;
                    flex-direction: column;
                }
            }
        `;
    }
}

commonUtils.defineCustomElement('dbp-formalize-manage-fields', ManageFields);
