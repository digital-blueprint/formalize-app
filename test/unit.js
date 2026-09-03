import {assert} from 'chai';

import '../src/dbp-formalize-manage-forms';
import '../src/dbp-formalize.js';
import {ManageFormsOverviewPage} from '../src/manage-forms-overview-page.js';
import {ManageFormSubmissionsPage} from '../src/manage-form-submissions-page.js';
import {apiCreateForm, apiUpdateForm, getListOfAllForms} from '../src/manage-forms-api.js';

customElements.define('test-manage-forms-overview-page', class extends ManageFormsOverviewPage {});
customElements.define(
    'test-manage-form-submissions-page',
    class extends ManageFormSubmissionsPage {},
);

suite('dbp-formalize-manage-forms basics', () => {
    let node;

    suiteSetup(async () => {
        node = document.createElement('dbp-formalize-manage-forms');
        node.auth = {token: ''};
        document.body.appendChild(node);
        await node.updateComplete;
    });

    suiteTeardown(() => {
        node.remove();
    });

    test('should render', () => {
        assert(!!node.shadowRoot);
    });

    test('should expose editing a form in the routing URL', () => {
        const calls = [];
        const dialog = {
            existingForm: null,
            open: () => calls.push(['open']),
        };
        const moduleInstance = {getEditFormComponent: () => document.createElement('div')};
        node.forms.set('job-offer', {
            formId: 'job-offer',
            formSlug: 'job-offer',
            formName: 'Job offer',
            moduleInstance,
            additionalData: {title: 'Job offer'},
            localizedNames: [],
        });
        node._ = () => dialog;
        node.sendSetPropertyEvent = (...args) => calls.push(args);

        node.handleOpenEditFormDialog('job-offer');

        assert.deepInclude(calls, ['routing-url', '/job-offer/edit', true]);
        assert.deepInclude(calls, ['open']);
        assert.equal(dialog.existingForm.formId, 'job-offer');
    });

    test('should open an edit URL instead of the submissions page', () => {
        const calls = [];
        const form = {formId: 'job-offer'};
        node.getRoutingData = () => ({pathSegments: ['job-offer', 'edit']});
        node._ = () => ({existingForm: null});
        node.showFormsOverview = () => calls.push('overview');
        node.handleOpenEditFormDialog = (formId) => calls.push(`edit:${formId}`);
        node.switchToSubmissionTable = () => calls.push('submissions');

        node.showRoutedForm(form);

        assert.deepEqual(calls, ['overview', 'edit:job-offer']);
    });

    test('should enable form actions for one selected manageable form', () => {
        const form = {
            formId: 'job-offer',
            grantedActions: ['manage'],
        };
        const actionHost = {
            enableFormsBulkDelete: true,
            forms: new Map([
                [
                    'job-offer',
                    {
                        formId: 'job-offer',
                        moduleInstance: {
                            getEditFormComponent: () => document.createElement('div'),
                        },
                    },
                ],
            ]),
            formsGrantedActions: new Map(),
            selectedFormsCount: 0,
            isDeleteSelectedFormsEnabled: false,
            isEditSelectedFormPermissionEnabled: false,
            formsTable: {
                tabulatorTable: {
                    getSelectedRows: () => [{getData: () => form}],
                    getSelectedData: () => [form],
                },
            },
        };
        node.setFormsActionButtonsState.call(actionHost);

        assert.equal(actionHost.selectedFormsCount, 1);
        assert.isTrue(actionHost.isDeleteSelectedFormsEnabled);
        assert.isTrue(actionHost.isEditSelectedFormPermissionEnabled);
    });

    test('should disable form actions without the required grants', () => {
        const form = {formId: 'job-offer', grantedActions: ['read']};
        const actionHost = {
            enableFormsBulkDelete: true,
            formsGrantedActions: new Map(),
            selectedFormsCount: 0,
            isDeleteSelectedFormsEnabled: true,
            isEditSelectedFormPermissionEnabled: true,
            formsTable: {
                tabulatorTable: {
                    getSelectedRows: () => [{getData: () => form}],
                },
            },
        };

        node.setFormsActionButtonsState.call(actionHost);

        assert.isFalse(actionHost.isDeleteSelectedFormsEnabled);
        assert.isFalse(actionHost.isEditSelectedFormPermissionEnabled);
    });

    test('should require manage on every form for multi-form permission editing', () => {
        const forms = [
            {formId: 'job-offer-1', grantedActions: ['manage']},
            {formId: 'job-offer-2', grantedActions: ['delete']},
        ];
        const actionHost = {
            enableFormsBulkDelete: true,
            formsGrantedActions: new Map(),
            selectedFormsCount: 0,
            isDeleteSelectedFormsEnabled: false,
            isEditSelectedFormPermissionEnabled: true,
            formsTable: {
                tabulatorTable: {
                    getSelectedRows: () => forms.map((form) => ({getData: () => form})),
                },
            },
        };

        node.setFormsActionButtonsState.call(actionHost);

        assert.isTrue(actionHost.isDeleteSelectedFormsEnabled);
        assert.isFalse(actionHost.isEditSelectedFormPermissionEnabled);
    });

    test('should enable permission editing for multiple manageable forms', () => {
        const forms = [
            {formId: 'job-offer-1', grantedActions: ['manage']},
            {formId: 'job-offer-2', grantedActions: ['manage']},
        ];
        const actionHost = {
            enableFormsBulkDelete: true,
            formsGrantedActions: new Map(),
            selectedFormsCount: 0,
            isDeleteSelectedFormsEnabled: false,
            isEditSelectedFormPermissionEnabled: false,
            formsTable: {
                tabulatorTable: {
                    getSelectedRows: () => forms.map((form) => ({getData: () => form})),
                },
            },
        };

        node.setFormsActionButtonsState.call(actionHost);

        assert.isTrue(actionHost.isEditSelectedFormPermissionEnabled);
    });

    test('should disable deletion when form bulk deletion is not enabled', () => {
        const form = {formId: 'job-offer', grantedActions: ['manage']};
        const actionHost = {
            enableFormsBulkDelete: false,
            formsGrantedActions: new Map(),
            selectedFormsCount: 0,
            isDeleteSelectedFormsEnabled: true,
            isEditSelectedFormPermissionEnabled: false,
            formsTable: {
                tabulatorTable: {
                    getSelectedRows: () => [{getData: () => form}],
                },
            },
        };

        node.setFormsActionButtonsState.call(actionHost);

        assert.isFalse(actionHost.isDeleteSelectedFormsEnabled);
        assert.isTrue(actionHost.isEditSelectedFormPermissionEnabled);
    });

    test('should open the permission dialog for a form resource', () => {
        const calls = [];
        const dialog = {
            resourceIdentifier: '',
            open: () => calls.push('open'),
        };
        const actionHost = {
            _: (selector) =>
                selector === '#form-grant-permission-dialog'
                    ? dialog
                    : document.createElement('div'),
        };

        node.handleEditFormPermission.call(actionHost, ['job-offer-1', 'job-offer-2']);

        assert.equal(dialog.resourceIdentifier, '');
        assert.deepEqual(dialog.resourceIdentifiers, ['job-offer-1', 'job-offer-2']);
        assert.deepEqual(calls, ['open']);
        assert.equal(
            node.shadowRoot.querySelector('#form-grant-permission-dialog').resourceClassIdentifier,
            'DbpRelayFormalizeForm',
        );
    });

    test('should open permission editing for selected submissions', () => {
        const calls = [];
        const dialog = {
            resourceIdentifier: '',
            resourceIdentifiers: [],
            open: () => calls.push('open'),
        };
        const actionHost = {
            enableSubmissionPermissionEditing: true,
            submissionTables: {
                submitted: {
                    tabulatorTable: {
                        getSelectedData: () => [
                            {submissionId: 'submission-1'},
                            {submissionId: 'submission-2'},
                        ],
                    },
                },
            },
            _: () => dialog,
        };

        node.handleEditSubmissionsPermission.call(actionHost, 'submitted');

        assert.equal(dialog.resourceIdentifier, '');
        assert.deepEqual(dialog.resourceIdentifiers, ['submission-1', 'submission-2']);
        assert.deepEqual(calls, ['open']);
    });

    test('should require manage on every selected submission', () => {
        const submissions = [{submissionId: 'submission-1'}, {submissionId: 'submission-2'}];
        const rows = submissions.map((submission) => ({getData: () => submission}));
        const actionHost = {
            enableSubmissionPermissionEditing: true,
            submissionTables: {
                submitted: {
                    tabulatorTable: {
                        getSelectedRows: () => rows,
                        getRows: () => rows,
                    },
                },
            },
            submissionsGrantedActions: new Map([
                ['submission-1', ['manage']],
                ['submission-2', ['read']],
            ]),
            selectedRowCount: {submitted: 0},
            allRowCount: {submitted: 0},
            isDeleteSelectedSubmissionEnabled: {submitted: false},
            isDeleteAllSubmissionEnabled: {submitted: false},
            isEditSubmissionEnabled: {submitted: false},
            isEditSubmissionPermissionEnabled: {submitted: false},
            isBatchTaggingEnabled: {submitted: false},
        };

        node.setActionButtonsStates.call(actionHost, 'submitted');
        assert.isFalse(actionHost.isEditSubmissionPermissionEnabled.submitted);

        actionHost.submissionsGrantedActions.set('submission-2', ['manage']);
        node.setActionButtonsStates.call(actionHost, 'submitted');
        assert.isTrue(actionHost.isEditSubmissionPermissionEnabled.submitted);
    });
});

suite('manage forms action menus', () => {
    test('should forward grant-based submission authorization when saving forms', async () => {
        const originalFetch = window.fetch;
        const requests = [];
        window.fetch = (url, options) => {
            requests.push({url, options});
            return Promise.resolve({ok: true, json: () => Promise.resolve({identifier: 'form-1'})});
        };
        const host = {
            auth: {token: 'token'},
            entryPointUrl: 'https://example.com',
            _i18n: {t: (key) => key},
        };
        const formData = {
            name: 'Job offer',
            localizedNames: [],
            frontendKey: 'job-offer',
            grantBasedSubmissionAuthorization: true,
        };

        try {
            await apiCreateForm(host, formData);
            await apiUpdateForm(host, 'form-1', formData);
        } finally {
            window.fetch = originalFetch;
        }

        assert.lengthOf(requests, 2);
        requests.forEach(({options}) => {
            assert.isTrue(JSON.parse(options.body).grantBasedSubmissionAuthorization);
        });
    });

    test('should only show inline edit for forms with update or manage grants', async () => {
        const originalFetch = window.fetch;
        const moduleInstance = {
            getFormFrontendKey: () => 'job-offer',
            getUrlSlug: () => 'job-offer',
            getEditFormComponent: () => document.createElement('div'),
        };
        const makeHost = (grantedActions) => ({
            _i18n: {t: (key) => key},
            entryPointUrl: 'https://example.com',
            auth: {token: 'token'},
            allForms: [],
            allowListFrontendKeys: [],
            denyListFrontendKeys: [],
            loadedModules: new Map([['job-offer', {formId: 'job-offer', moduleInstance}]]),
            forms: new Map(),
            formsGrantedActions: new Map(),
            options_forms: {},
            lang: 'en',
            createScopedElement: () => document.createElement('button'),
            sendSetPropertyEvent: () => {},
            apiGrantedActions: grantedActions,
        });
        window.fetch = () =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        'hydra:member': [
                            {
                                identifier: 'job-offer',
                                frontendKey: 'job-offer',
                                name: 'Job offer',
                                localizedNames: [],
                                grantedActions: currentHost.apiGrantedActions,
                            },
                        ],
                    }),
            });
        let currentHost;

        try {
            currentHost = makeHost(['read']);
            await getListOfAllForms(currentHost);
            assert.equal(currentHost.allForms[0].actionButton.children.length, 1);

            currentHost = makeHost(['update']);
            await getListOfAllForms(currentHost);
            assert.equal(currentHost.allForms[0].actionButton.children.length, 2);
        } finally {
            window.fetch = originalFetch;
        }
    });

    test('should provide delete and permission actions for forms', async () => {
        const page = document.createElement('test-manage-forms-overview-page');
        page.enableFormsBulkDelete = true;
        page.selectedFormsCount = 1;
        document.body.appendChild(page);
        await page.updateComplete;

        const select = page.shadowRoot.querySelector('dbp-select');
        const actions = select.options.map(({value}) => value);
        assert.deepEqual(actions, ['delete', 'edit-permission']);
        assert.isTrue(select.disabled);

        page.isEditSelectedFormPermissionEnabled = true;
        await page.updateComplete;
        assert.isFalse(select.disabled);

        page.remove();
    });

    test('should omit delete when form bulk deletion is not enabled', async () => {
        const page = document.createElement('test-manage-forms-overview-page');
        page.selectedFormsCount = 1;
        page.isEditSelectedFormPermissionEnabled = true;
        document.body.appendChild(page);
        await page.updateComplete;

        const select = page.shadowRoot.querySelector('dbp-select');
        assert.deepEqual(
            select.options.map(({value}) => value),
            ['edit-permission'],
        );
        assert.isFalse(select.disabled);

        page.remove();
    });

    test('should search visible form table fields and reset the search', async () => {
        const page = document.createElement('test-manage-forms-overview-page');
        page.optionsForms = {
            columns: [
                {field: 'id'},
                {field: 'name'},
                {field: 'formId', visible: false},
                {field: 'actionButton', formatter: 'html'},
            ],
        };
        const filters = [];
        let clearCount = 0;
        page.getFormsTable = () => ({
            setFilter: (filter) => filters.push(filter),
            clearFilter: () => clearCount++,
        });
        document.body.appendChild(page);
        await page.updateComplete;

        const searchInput = page.getSearchbar();
        searchInput.value = 'Job offer';
        page.shadowRoot.querySelector('.forms-search').requestSubmit();

        assert.deepEqual(filters, [
            [
                [
                    {field: 'id', type: 'like', value: 'Job offer'},
                    {field: 'name', type: 'like', value: 'Job offer'},
                ],
            ],
        ]);

        page.shadowRoot.querySelector('.reset-search').click();
        assert.equal(searchInput.value, '');
        assert.equal(clearCount, 1);

        page.remove();
    });

    test('should not provide a permission action for submissions', async () => {
        const page = document.createElement('test-manage-form-submissions-page');
        page.noSubmissionAvailable = {draft: false, submitted: true};
        page.isActionAvailable = {draft: false, submitted: false};
        document.body.appendChild(page);
        await page.updateComplete;

        const actions = page.shadowRoot
            .querySelector('#action-dropdown--draft')
            .options.map(({value}) => value);
        assert.notInclude(actions, 'edit-permission');

        page.remove();
    });

    test('should provide submission permission editing when enabled', async () => {
        const page = document.createElement('test-manage-form-submissions-page');
        page.noSubmissionAvailable = {draft: false, submitted: true};
        page.isActionAvailable = {draft: true, submitted: false};
        page.enableSubmissionPermissionEditing = true;
        page.isEditSubmissionPermissionEnabled = {draft: true, submitted: false};
        document.body.appendChild(page);
        await page.updateComplete;

        const select = page.shadowRoot.querySelector('#action-dropdown--draft');
        const permissionAction = select.options.find(({value}) => value === 'edit-permission');
        assert.isDefined(permissionAction);
        assert.isFalse(permissionAction.disabled);

        page.remove();
    });
});
