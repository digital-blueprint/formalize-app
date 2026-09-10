import {assert} from 'chai';

import '../src/dbp-formalize.js';
import {ManageForms} from '../src/dbp-formalize-manage-forms';
import {ManageFormsOverviewPage} from '../src/manage-forms-overview-page.js';
import {ManageFormSubmissionsPage} from '../src/manage-form-submissions-page.js';
import {apiCreateForm, apiUpdateForm, getListOfAllForms} from '../src/manage-forms-api.js';

customElements.define('test-manage-forms-overview-page', class extends ManageFormsOverviewPage {});
customElements.define('test-manage-forms', class extends ManageForms {});
customElements.define(
    'test-manage-form-submissions-page',
    class extends ManageFormSubmissionsPage {},
);

suite('dbp-formalize-manage-forms basics', () => {
    let node;

    suiteSetup(async () => {
        node = document.createElement('dbp-formalize-manage-forms');
        node.auth = {token: ''};
        node.refreshTableReferences = () => {};
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

    test('should preserve form-list parameters when returning to the overview', () => {
        const calls = [];
        node.getRoutingData = () => ({
            pathname: '/job-offer',
            pathSegments: ['job-offer'],
            queryParams: new URLSearchParams(
                'forms-search=cont&forms-page=2&draft-search=application',
            ),
        });
        node.clearAllFilters = () => {};
        node.closeAllSearchWidgets = () => {};
        node.showFormsOverview = () => {};
        node.sendSetPropertyEvent = (...args) => calls.push(args);

        node.handleBackToOverview();

        assert.deepEqual(calls, [['routing-url', '/?forms-search=cont&forms-page=2', true]]);
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
            node.shadowRoot
                .querySelector('#form-grant-permission-dialog')
                .getAttribute('resource-class-identifier'),
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

    test('should only show forms with grants relevant to form management', async () => {
        const originalFetch = window.fetch;
        const moduleInstance = {
            getFormFrontendKey: () => 'job-offer',
            getUrlSlug: () => 'job-offer',
            getEditFormComponent: () => document.createElement('div'),
        };
        const makeHost = (
            grantedActions,
            grantedFormActions,
            grantedSubmissionCollectionActions,
        ) => ({
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
            apiGrantedFormActions: grantedFormActions,
            apiGrantedSubmissionCollectionActions: grantedSubmissionCollectionActions,
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
                                grantedFormActions: currentHost.apiGrantedFormActions,
                                grantedSubmissionCollectionActions:
                                    currentHost.apiGrantedSubmissionCollectionActions,
                            },
                        ],
                    }),
            });
        let currentHost;

        try {
            currentHost = makeHost(['read'], ['read'], []);
            await getListOfAllForms(currentHost);
            assert.isEmpty(currentHost.allForms);

            currentHost = makeHost(
                ['read', 'create_submissions'],
                ['read'],
                ['create_submissions'],
            );
            await getListOfAllForms(currentHost);
            assert.lengthOf(currentHost.allForms, 1);
            assert.equal(currentHost.allForms[0].actionButton.children.length, 1);

            currentHost = makeHost(['update'], ['update'], []);
            await getListOfAllForms(currentHost);
            assert.lengthOf(currentHost.allForms, 1);
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
        assert.isTrue(select.hasAttribute('disabled'));

        page.isEditSelectedFormPermissionEnabled = true;
        await page.updateComplete;
        assert.isFalse(select.hasAttribute('disabled'));

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
        assert.isFalse(select.hasAttribute('disabled'));

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
        const searchValues = [];
        let clearCount = 0;
        page.getFormsTable = () => ({
            setFilter: (filter) => filters.push(filter),
            clearFilter: () => clearCount++,
        });
        document.body.appendChild(page);
        page.addEventListener('forms-search-change', (event) => {
            searchValues.push(event.detail.value);
        });
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
        assert.deepEqual(searchValues, ['Job offer', '']);

        page.remove();
    });

    test('should put all submission filters into the routing URL', () => {
        const host = document.createElement('test-manage-forms');
        const searchInput = document.createElement('input');
        const searchColumn = document.createElement('select');
        const searchOperator = document.createElement('select');
        searchColumn.add(new Option('All', 'all'));
        searchColumn.add(new Option('Name', 'name'));
        searchOperator.add(new Option('Like', 'like'));
        searchOperator.add(new Option('Starts', 'starts'));
        searchInput.value = 'Alice';
        searchColumn.value = 'name';
        searchOperator.value = 'starts';

        host.routingUrl = '/job-offer?submitted-search=Existing';
        host.getRoutingData = () => ({
            pathname: '/job-offer',
            queryParams: new URLSearchParams('submitted-search=Existing'),
            hash: '',
        });
        host.getSubmissionsPage = () => ({
            getSearchbar: () => searchInput,
            getSearchSelect: () => searchColumn,
            getSearchOperator: () => searchOperator,
        });
        host.submissionTables.draft = {
            clearFilter: () => {},
            setFilter: () => {},
            getColumnsFields: () => ['name'],
            tabulatorTable: {
                deselectRow: () => {},
                getRows: () => [],
            },
        };
        let routingUrl = '';
        host.sendSetPropertyEvent = (name, value) => {
            if (name === 'routing-url') routingUrl = value;
        };

        host.filterTable('draft');

        const url = new URL(routingUrl, 'https://example.com');
        assert.equal(url.searchParams.get('draft-search'), 'Alice');
        assert.equal(url.searchParams.get('draft-search-column'), 'name');
        assert.equal(url.searchParams.get('draft-search-operator'), 'starts');
        assert.equal(url.searchParams.get('submitted-search'), 'Existing');
    });

    test('should put form and submission pagination into the routing URL', () => {
        const host = document.createElement('test-manage-forms');
        host.routingUrl = '/';
        host.getRoutingData = () => ({
            pathname: '/',
            queryParams: new URLSearchParams(),
            hash: '',
        });
        host.formsTable = {identifier: 'forms-table'};
        host._urlStateReadyTables.add('forms-table');
        let routingUrl = '';
        host.sendSetPropertyEvent = (name, value) => {
            if (name === 'routing-url') routingUrl = value;
        };

        host.handleTablePaginationPageLoaded({
            detail: {tableId: 'forms-table', page: 3, pageSize: 3, paginationSize: 20},
        });

        const url = new URL(routingUrl, 'https://example.com');
        assert.equal(url.searchParams.get('forms-page'), '3');
        assert.equal(url.searchParams.get('forms-page-size'), '20');

        host.submissionTables.draft = {
            identifier: 'submissions-table-draft',
            tabulatorTable: {getRows: () => []},
        };
        host._urlStateReadyTables.add('submissions-table-draft');
        host.handleTablePaginationPageLoaded({
            detail: {
                tableId: 'submissions-table-draft',
                page: 2,
                pageSize: 2,
                paginationSize: 10,
            },
        });

        const submissionUrl = new URL(routingUrl, 'https://example.com');
        assert.equal(submissionUrl.searchParams.get('draft-page'), '2');
        assert.equal(submissionUrl.searchParams.get('draft-page-size'), '10');
    });

    test('should put submission details into the activity routing URL', () => {
        const host = document.createElement('test-manage-forms');
        const formId = '11111111-1111-1111-1111-111111111111';
        const submissionId = '22222222-2222-2222-2222-222222222222';
        host.activeFormId = formId;
        host.getRoutingData = () => ({
            pathSegments: [formId],
            queryParams: new URLSearchParams('submitted-page=2'),
            hash: '',
        });
        let routingUrl = '';
        host.sendSetPropertyEvent = (name, value) => {
            if (name === 'routing-url') routingUrl = value;
        };

        host.setSubmissionDetailsRoute(submissionId);
        assert.equal(routingUrl, `/${formId}/details/${submissionId}?submitted-page=2`);

        host.setSubmissionDetailsRoute();
        assert.equal(routingUrl, `/${formId}?submitted-page=2`);
    });

    test('should restore submission filters and pagination from the routing URL', async () => {
        const host = document.createElement('test-manage-forms');
        const searchInput = document.createElement('input');
        const searchColumn = document.createElement('select');
        const searchOperator = document.createElement('select');
        searchColumn.add(new Option('All', 'all'));
        searchColumn.add(new Option('Name', 'name'));
        searchOperator.add(new Option('Like', 'like'));
        searchOperator.add(new Option('Starts', 'starts'));
        host.getRoutingData = () => ({
            queryParams: new URLSearchParams(
                'draft-search=Alice&draft-search-column=name&draft-search-operator=starts&draft-page=2&draft-page-size=10',
            ),
        });
        host.getSubmissionsPage = () => ({
            getSearchbar: () => searchInput,
            getSearchSelect: () => searchColumn,
            getSearchOperator: () => searchOperator,
        });
        const calls = [];
        host.submissionTables.draft = {
            identifier: 'submissions-table-draft',
            paginationSize: 5,
            setFilter: (filters) => calls.push(['filter', filters]),
            getColumnsFields: () => ['name'],
            tabulatorTable: {
                deselectRow: () => {},
                getRows: () => [],
                setPageSize: (size) => Promise.resolve(calls.push(['page-size', size])),
                setPage: (page) => Promise.resolve(calls.push(['page', page])),
            },
        };

        await host.restoreSubmissionTableState('draft');

        assert.equal(searchInput.value, 'Alice');
        assert.equal(searchColumn.value, 'name');
        assert.equal(searchOperator.value, 'starts');
        assert.deepInclude(calls, ['page-size', 10]);
        assert.deepInclude(calls, ['page', 2]);
        assert.isTrue(host._urlStateReadyTables.has('submissions-table-draft'));
    });

    test('should restore form pagination after table data has loaded', async () => {
        const host = document.createElement('test-manage-forms');
        let resolveData;
        const dataLoaded = new Promise((resolve) => {
            resolveData = resolve;
        });
        const calls = [];
        host.allForms = [{id: 1}];
        host.formsTable = {
            identifier: 'forms-table',
            tableReady: true,
            tableBuilding: false,
            setData: () => dataLoaded,
        };
        host.refreshTableReferences = () => {};
        host.restoreFormsTableState = () => {
            calls.push('restore');
        };
        host._urlStateReadyTables.add('forms-table');

        host.showFormsOverview();
        assert.deepEqual(calls, []);
        assert.isFalse(host._urlStateReadyTables.has('forms-table'));

        resolveData();
        await dataLoaded;
        await Promise.resolve();

        assert.deepEqual(calls, ['restore']);
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
