import {assert} from 'chai';
import {setFeatureFlag} from '@dbp-toolkit/common';

import '../src/dbp-formalize.js';
import {ManageForms, hasFormEditRight} from '../src/dbp-formalize-manage-forms';
import {ManageSubmissions} from '../src/dbp-formalize-manage-submissions.js';
import {FormSubmissions} from '../src/form-submissions.js';
import {ManageFormsOverviewPage} from '../src/manage-forms-overview-page.js';
import {ManageFormSubmissionsPage} from '../src/manage-form-submissions-page.js';
import {filterAvailableForms} from '../src/dbp-formalize-render-form.js';
import {apiCreateForm, apiUpdateForm, getListOfAllForms} from '../src/manage-forms-api.js';
import {
    BaseFormElement,
    BaseObject,
    FILE_SECURITY_VALIDATION_ERROR_ID,
} from '../src/form/base-object.js';
import {
    AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG,
    isAvailableFormsOverviewEnabled,
} from '../src/feature-flags.js';
import {
    setDefaultSubmissionTableOrder,
    setSubmissionFormOptions,
} from '../src/manage-forms-table-config.js';
import {
    createDefaultManageFormsOverviewActions,
    createDefaultManageSubmissionsOverviewActions,
} from '../src/manage-forms-overview-actions.js';
import {ROUTING_URL_CHANGE_EVENT} from '../src/manage-forms-routing.js';

customElements.define('test-manage-forms-overview-page', class extends ManageFormsOverviewPage {});
customElements.define('test-manage-forms', class extends ManageForms {});
customElements.define('test-manage-submissions', class extends ManageSubmissions {});
customElements.define('test-form-submissions', class extends FormSubmissions {});
customElements.define(
    'test-manage-form-submissions-page',
    class extends ManageFormSubmissionsPage {},
);
customElements.define('test-base-form-element', class extends BaseFormElement {});

suite('available forms feature flag', () => {
    teardown(() => {
        setFeatureFlag(AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG, false);
    });

    test('is disabled by default and can be enabled', () => {
        setFeatureFlag(AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG, false);
        assert.isFalse(isAvailableFormsOverviewEnabled());

        setFeatureFlag(AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG, true);
        assert.isTrue(isAvailableFormsOverviewEnabled());
    });

    test('controls whether the render-form menu entry is disabled', () => {
        const shell = document.createElement('dbp-formalize');
        shell.routes = ['render-form'];
        shell.metadata = {
            'render-form': {
                required_roles: [],
                visible: true,
                disabled: true,
                feature_flag: AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG,
            },
        };

        setFeatureFlag(AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG, false);
        shell._updateVisibleRoutes();
        assert.isTrue(shell.visibleRoutes[0].disabled);

        setFeatureFlag(AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG, true);
        shell._updateVisibleRoutes();
        assert.isFalse(shell.visibleRoutes[0].disabled);
    });
});

suite('available forms', () => {
    const formIdentifiers = {
        exam: 'exam-id',
        course: 'course-id',
    };

    test('only includes supported forms that the user can submit', () => {
        const forms = filterAvailableForms(
            [
                {
                    identifier: 'exam-id',
                    name: 'Exam',
                    localizedNames: [{languageTag: 'de', name: 'Prüfung'}],
                    grantedFormActions: ['create_submissions'],
                },
                {
                    identifier: 'course-id',
                    name: 'Course',
                    grantedFormActions: ['read'],
                },
                {
                    identifier: 'unsupported-id',
                    name: 'Unsupported',
                    grantedFormActions: ['manage'],
                },
            ],
            formIdentifiers,
            'de',
        );

        assert.deepEqual(forms, [
            {
                identifier: 'exam-id',
                name: 'Prüfung',
                slug: 'exam',
            },
        ]);
    });

    test('applies frontend key allow and deny lists', () => {
        const entries = [
            {
                identifier: 'exam-id',
                name: 'Exam',
                frontendKey: 'exam',
                grantedSubmissionCollectionActions: ['manage'],
            },
            {
                identifier: 'course-id',
                name: 'Course',
                frontendKey: 'course',
                grantedSubmissionCollectionActions: ['create_submissions'],
            },
        ];

        assert.deepEqual(filterAvailableForms(entries, formIdentifiers, 'en', ['exam'], []), [
            {identifier: 'exam-id', name: 'Exam', slug: 'exam'},
        ]);
        assert.deepEqual(filterAvailableForms(entries, formIdentifiers, 'en', [], ['exam']), [
            {identifier: 'course-id', name: 'Course', slug: 'course'},
        ]);
    });

    test('configures a sortable name and action column for the available forms table', () => {
        const node = document.createElement('dbp-formalize-render-form');
        node.availableForms = [{identifier: 'exam-id', name: 'Exam', slug: 'exam'}];

        const options = node.getAvailableFormsTableOptions();

        assert.equal(options.data, node.availableForms);
        assert.deepInclude(options.columns[0], {
            field: 'name',
            sorter: 'string',
        });
        assert.deepInclude(options.columns[3], {
            field: 'actionButton',
            formatter: 'html',
            headerSort: false,
        });
    });

    test('opens a form from its table action', () => {
        const node = document.createElement('dbp-formalize-render-form');
        const calls = [];
        node.sendSetPropertyEvent = (...args) => calls.push(args);
        node.createScopedElement = () => document.createElement('button');

        const action = node.createAvailableFormAction({slug: 'exam'});
        action.firstElementChild.dispatchEvent(new Event('click'));

        assert.deepEqual(calls, [['routing-url', '/exam', true]]);
    });

    test('searches and resets the available forms table', () => {
        const node = document.createElement('dbp-formalize-render-form');
        const calls = [];
        const input = {value: '  exam  ', focus: () => calls.push(['focus'])};
        const table = {
            setFilter: (...args) => calls.push(['setFilter', ...args]),
            clearFilter: () => calls.push(['clearFilter']),
        };
        node.getAvailableFormsSearchInput = () => input;
        node.getAvailableFormsTable = () => table;

        node.handleAvailableFormsSearch({preventDefault: () => calls.push(['preventDefault'])});
        node.handleAvailableFormsSearchReset();

        assert.deepEqual(calls, [
            ['preventDefault'],
            ['setFilter', [[{field: 'name', type: 'like', value: 'exam'}]]],
            ['clearFilter'],
            ['focus'],
        ]);
        assert.equal(input.value, '');
    });

    test('explicitly builds the table after it is rendered', async () => {
        const node = document.createElement('dbp-formalize-render-form');
        const calls = [];
        const table = {
            updateComplete: Promise.resolve(),
            options: null,
            data: [],
            tabulatorTable: null,
            tableReady: false,
            tableBuilding: false,
            buildTable: () => calls.push('build'),
        };
        node.availableForms = [{name: 'Exam'}];
        node.availableFormsTableOptions = {data: node.availableForms};
        node.getAvailableFormsTable = () => table;

        node.rebuildAvailableFormsTable();
        await table.updateComplete;

        assert.equal(table.options, node.availableFormsTableOptions);
        assert.equal(table.data, node.availableForms);
        assert.deepEqual(calls, ['build']);
    });
});

suite('submission error handling', () => {
    test('should show a localized message for rejected files', async () => {
        const element = document.createElement('test-base-form-element');
        await element._i18n.changeLanguage('en');
        let notificationDetail;
        const notificationHandler = (event) => {
            notificationDetail = event.detail;
            event.preventDefault();
        };
        window.addEventListener('dbp-notification-send', notificationHandler);

        try {
            await element.displayErrors({
                status: 400,
                json: () =>
                    Promise.resolve({
                        'relay:errorId': FILE_SECURITY_VALIDATION_ERROR_ID,
                        'relay:errorDetails': [
                            'clamav_check: Virus detected in application.pdf: test-signature',
                        ],
                    }),
            });
        } finally {
            window.removeEventListener('dbp-notification-send', notificationHandler);
        }

        assert.equal(notificationDetail?.type, 'danger');
        assert.equal(
            notificationDetail?.body,
            'One or more files were rejected by the security scan. Remove or replace them and try again.',
        );
        assert.notInclude(notificationDetail?.body, 'test-signature');
    });
});

suite('manage forms table configuration', () => {
    test('should only show the employer column for job-offer-only activities', () => {
        const node = document.createElement('test-manage-forms');
        const page = document.createElement('test-manage-forms-overview-page');

        node.allowListFrontendKeys = [];
        page.showEmployerColumn = node.showEmployerColumn;
        page.updateTableOptions();
        assert.notInclude(
            page.optionsForms.columns.map(({field}) => field),
            'employer',
        );
        assert.equal(page.optionsForms.columns.find(({field}) => field === 'name').widthGrow, 4);

        node.allowListFrontendKeys = ['job-offer'];
        page.showEmployerColumn = node.showEmployerColumn;
        page.updateTableOptions();
        assert.include(
            page.optionsForms.columns.map(({field}) => field),
            'employer',
        );
        assert.equal(page.optionsForms.columns.find(({field}) => field === 'name').widthGrow, 2);

        node.allowListFrontendKeys = ['job-offer', 'other-form'];
        assert.isFalse(node.showEmployerColumn);
    });

    test('should use module schema labels when persisted labels are missing', () => {
        const definitions = [
            {field: 'dateCreated', title: 'Date created'},
            {field: 'givenName', title: 'givenName'},
            {field: 'attachments', title: 'attachments'},
            {field: 'submissionId', title: 'submissionId'},
        ];
        const host = {
            availableTags: [],
            form: {
                formId: 'job-offer',
                dataFeedSchema: JSON.stringify({
                    properties: {givenName: {}, attachments: {}},
                    files: {attachments: {}},
                }),
                moduleInstance: {
                    getDataFeedSchema: () => ({
                        properties: {
                            givenName: {
                                localizedName: {de: 'Vorname', en: 'First name'},
                            },
                        },
                        files: {
                            attachments: {
                                localizedName: {de: 'Anhänge', en: 'Attachments'},
                            },
                        },
                    }),
                },
            },
            lang: 'en',
            submissionTables: {
                submitted: {
                    getColumns: () =>
                        definitions.map((definition) => ({
                            getDefinition: () => definition,
                        })),
                },
            },
            submissionsColumnsInitial: {},
        };

        setDefaultSubmissionTableOrder(host, 'submitted');

        const columns = host.submissionsColumnsInitial.submitted;
        assert.equal(columns.find(({field}) => field === 'givenName').title, 'First name');
        assert.equal(columns.find(({field}) => field === 'attachments').title, 'Attachments');
        assert.equal(
            columns.find(({field}) => field === 'form_files-attachments').title,
            'Attachments',
        );
    });

    test('should localize the submission identifier column', () => {
        const host = {
            lang: 'de',
            _i18n: {t: (key) => ({'manage-forms.submission-id': 'Einreichungs-ID'})[key]},
            options_submissions: {},
        };
        setSubmissionFormOptions(host, 'submitted');
        const definitions = [{field: 'submissionId', title: 'submissionId'}];

        host.options_submissions.submitted.autoColumnsDefinitions(definitions);

        assert.equal(definitions[0].title, 'Einreichungs-ID');
    });
});

/**
 * Creates an overview page with the given forms selected in a stubbed table.
 */
function createOverviewPage({
    actionHost,
    actionDefinitions = createDefaultManageFormsOverviewActions(),
    formsById = new Map(),
    selectedForms = [],
}) {
    const page = document.createElement('test-manage-forms-overview-page');
    page.getFormsTable = () => ({
        tabulatorTable: {getSelectedData: () => selectedForms},
    });
    page.actionHost = actionHost;
    page.actionDefinitions = actionDefinitions;
    page.formsById = formsById;
    page.updateActions();
    return page;
}

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
        const host = document.createElement('test-manage-submissions');
        const calls = [];
        host.getRoutingData = () => ({
            pathname: '/job-offer',
            pathSegments: ['job-offer'],
            queryParams: new URLSearchParams(
                'forms-search=cont&forms-page=2&draft-search=application',
            ),
        });
        host.sendSetPropertyEvent = (...args) => calls.push(args);

        host.handleBackToOverview();

        assert.deepEqual(calls, [['routing-url', '/?forms-search=cont&forms-page=2', true]]);
        assert.equal(host.activeFormId, '');
        assert.isTrue(host.showFormsTable);
    });

    test('should open an edit URL instead of the submissions page', () => {
        const calls = [];
        node.forms.set('job-offer', {formId: 'job-offer'});
        node.getRoutingData = () => ({pathSegments: ['job-offer', 'edit']});
        node._ = () => ({existingForm: null});
        node.handleOpenEditFormDialog = (formId, updateRoutingUrl) =>
            calls.push(`edit:${formId}:${updateRoutingUrl}`);

        node.handleRoute();

        assert.isTrue(node.showFormsTable);
        assert.deepEqual(calls, ['edit:job-offer:false']);
    });

    test('should open the submissions of a routed form', () => {
        const host = document.createElement('test-manage-submissions');
        host.forms.set('job-offer', {formId: 'job-offer'});
        host.getRoutingData = () => ({pathSegments: ['job-offer']});

        host.handleRoute();

        assert.equal(host.activeFormId, 'job-offer');
        assert.isFalse(host.showFormsTable);
    });

    test('should resolve enabled overview actions for one manageable form', () => {
        const form = {
            formId: 'job-offer',
            grantedActions: ['manage'],
        };
        const page = createOverviewPage({
            actionHost: {enableFormsBulkDelete: true, _i18n: {t: (key) => key}},
            formsById: new Map([
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
            selectedForms: [form],
        });

        assert.equal(page.selectedFormsCount, 1);
        assert.deepEqual(
            page.actions.map(({value, disabled}) => ({value, disabled})),
            [
                {value: 'delete', disabled: false},
                {value: 'edit', disabled: false},
                {value: 'edit-permission', disabled: false},
            ],
        );
    });

    test('should disable form actions without the required grants', () => {
        const form = {formId: 'job-offer', grantedActions: ['read']};
        const page = createOverviewPage({
            actionHost: {enableFormsBulkDelete: true, _i18n: {t: (key) => key}},
            formsById: new Map([['job-offer', {moduleInstance: {getEditFormComponent: () => {}}}]]),
            selectedForms: [form],
        });

        assert.isTrue(page.actions.every((action) => action.disabled));
    });

    test('should execute a resolved overview action without action-specific dispatch code', () => {
        const form = {formId: 'job-offer'};
        let handledContext = null;
        const page = createOverviewPage({
            actionHost: {_i18n: {t: (key) => key}},
            actionDefinitions: [
                {
                    id: 'custom-action',
                    placements: ['dropdown'],
                    label: 'Custom action',
                    handler: (context) => (handledContext = context),
                },
            ],
            formsById: new Map([['job-offer', form]]),
            selectedForms: [form],
        });

        page.runAction('custom-action');

        assert.equal(handledContext.form.formId, form.formId);
        assert.deepEqual(
            handledContext.items.map((item) => item.formId),
            [form.formId],
        );
    });

    test('should require manage on every form for multi-form permission editing', () => {
        const forms = [
            {formId: 'job-offer-1', grantedActions: ['manage']},
            {formId: 'job-offer-2', grantedActions: ['delete']},
        ];
        const page = createOverviewPage({
            actionHost: {enableFormsBulkDelete: true, _i18n: {t: (key) => key}},
            formsById: new Map(forms.map((form) => [form.formId, form])),
            selectedForms: forms,
        });

        const actions = Object.fromEntries(page.actions.map((action) => [action.value, action]));
        assert.isFalse(actions.delete.disabled);
        assert.isTrue(actions.edit.disabled);
        assert.isTrue(actions['edit-permission'].disabled);
    });

    test('should disable deletion when form bulk deletion is not enabled', () => {
        const form = {formId: 'job-offer', grantedActions: ['manage']};
        const page = createOverviewPage({
            actionHost: {enableFormsBulkDelete: false, _i18n: {t: (key) => key}},
            formsById: new Map([['job-offer', {moduleInstance: {getEditFormComponent: () => {}}}]]),
            selectedForms: [form],
        });

        assert.notInclude(
            page.actions.map((action) => action.value),
            'delete',
        );
        assert.isFalse(page.actions.find((action) => action.value === 'edit').disabled);
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

        FormSubmissions.prototype.handleEditSubmissionsPermission.call(actionHost, 'submitted');

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

        FormSubmissions.prototype.setActionButtonsStates.call(actionHost, 'submitted');
        assert.isFalse(actionHost.isEditSubmissionPermissionEnabled.submitted);

        actionHost.submissionsGrantedActions.set('submission-2', ['manage']);
        FormSubmissions.prototype.setActionButtonsStates.call(actionHost, 'submitted');
        assert.isTrue(actionHost.isEditSubmissionPermissionEnabled.submitted);
    });
});

suite('manage forms action menus', () => {
    test('should render supplied dropdown actions', async () => {
        const element = document.createElement('test-manage-forms-overview-page');
        element.selectedFormsCount = 1;
        element.actions = [{value: 'edit', label: 'Edit', iconName: 'pencil', disabled: false}];
        document.body.appendChild(element);
        await element.updateComplete;

        const select = element.shadowRoot.querySelector('#forms-table-actions-select');
        assert.include(
            select.options.map((option) => option.value),
            'edit',
        );

        element.actions = [];
        await element.updateComplete;
        assert.notInclude(
            select.options.map((option) => option.value),
            'edit',
        );
        element.remove();
    });

    test('should let a module customize row actions without changing defaults', async () => {
        const originalFetch = window.fetch;
        const createModule = (frontendKey, iconName) => ({
            getFormFrontendKey: () => frontendKey,
            getUrlSlug: () => frontendKey,
            getManageFormsOverviewActions: (_context, actions) =>
                iconName ? actions.map((action) => ({...action, iconName})) : actions,
        });
        const host = {
            _i18n: {t: (key) => key},
            entryPointUrl: 'https://example.com',
            auth: {token: 'token'},
            allForms: [],
            allowListFrontendKeys: [],
            denyListFrontendKeys: [],
            loadedModules: new Map([
                ['custom', {formId: 'custom', moduleInstance: createModule('custom', 'list')}],
                ['default', {formId: 'default', moduleInstance: createModule('default', null)}],
            ]),
            forms: new Map(),
            formsGrantedActions: new Map(),
            lang: 'en',
            createDefaultOverviewActions: createDefaultManageSubmissionsOverviewActions,
            createScopedElement: () => {
                const button = document.createElement('button');
                button.iconName = 'keyword-research';
                return button;
            },
            sendSetPropertyEvent: () => {},
        };
        window.fetch = () =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        'hydra:member': ['custom', 'default'].map((frontendKey) => ({
                            identifier: frontendKey,
                            frontendKey,
                            name: frontendKey,
                            localizedNames: [],
                            grantedActions: ['read'],
                            grantedFormActions: ['update'],
                            grantedSubmissionCollectionActions: [],
                        })),
                    }),
            });

        try {
            await getListOfAllForms(host);
        } finally {
            window.fetch = originalFetch;
        }

        const getIconName = (formId) =>
            host.allForms
                .find((form) => form.formId === formId)
                .actionButton.querySelector('button').iconName;
        assert.equal(getIconName('custom'), 'list');
        assert.equal(getIconName('default'), 'keyword-research');
        const defaultActions = [{id: 'default'}];
        assert.equal(
            new BaseObject().getManageFormsOverviewActions({}, defaultActions),
            defaultActions,
        );
    });

    test('should append module actions beside the default row action', async () => {
        const originalFetch = window.fetch;
        let actionContext = null;
        let grantedActions = ['read'];
        const moduleInstance = {
            getFormFrontendKey: () => 'job-offer',
            getUrlSlug: () => 'job-offer',
            getEditFormComponent: () => document.createElement('div'),
            getManageFormsOverviewActions: (_context, actions) => [
                ...actions.map((action) =>
                    action.id === 'edit' ? {...action, placements: ['row']} : action,
                ),
                {
                    id: 'preview',
                    iconName: 'eye',
                    placements: ['row'],
                    title: 'Preview',
                    ariaLabel: 'Preview job offer',
                    handler: (context) => (actionContext = context),
                },
            ],
        };
        const host = {
            _i18n: {t: (key) => key},
            entryPointUrl: 'https://example.com',
            auth: {token: 'token'},
            allForms: [],
            allowListFrontendKeys: [],
            denyListFrontendKeys: [],
            loadedModules: new Map([['job-offer', {formId: 'job-offer', moduleInstance}]]),
            forms: new Map(),
            formsGrantedActions: new Map(),
            lang: 'en',
            createDefaultOverviewActions: () => [
                ...createDefaultManageSubmissionsOverviewActions(),
                ...createDefaultManageFormsOverviewActions(),
            ],
            createScopedElement: () => document.createElement('button'),
            sendSetPropertyEvent: () => {},
        };
        window.fetch = () =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        'hydra:member': [
                            {
                                identifier: 'job-1',
                                frontendKey: 'job-offer',
                                name: 'Developer',
                                localizedNames: [],
                                additionalData: {title: 'Developer'},
                                grantedActions,
                                grantedFormActions: ['update'],
                                grantedSubmissionCollectionActions: [],
                            },
                        ],
                    }),
            });

        try {
            await getListOfAllForms(host);

            const buttons = host.allForms[0].actionButton.querySelectorAll('button');
            assert.lengthOf(buttons, 2);
            assert.equal(buttons[0].dataset.action, 'open-submissions');
            assert.equal(buttons[1].dataset.action, 'preview');
            assert.equal(buttons[1].iconName, 'eye');

            host.forms.set('job-1', {...host.forms.get('job-1'), formName: 'Updated developer'});
            buttons[1].click();
            assert.equal(actionContext.host, host);
            assert.equal(actionContext.form.formId, 'job-1');
            assert.equal(actionContext.form.formName, 'Updated developer');
            assert.deepEqual(actionContext.form.grantedActions, ['read']);

            grantedActions = ['manage'];
            await getListOfAllForms(host);
            assert.deepEqual(host.allForms[0].grantedActions, ['manage']);
            assert.deepEqual(
                host.formsOverviewActionDefinitions.map((action) => action.id),
                ['open-submissions', 'delete', 'edit', 'edit-permission', 'preview'],
            );
            assert.deepEqual(
                [...host.allForms[0].actionButton.querySelectorAll('button')].map(
                    (button) => button.dataset.action,
                ),
                ['open-submissions', 'edit', 'preview'],
            );
        } finally {
            window.fetch = originalFetch;
        }
    });

    test('should forward submission authorization settings when saving forms', async () => {
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
            allowedActionsWhenSubmitted: ['read'],
        };

        try {
            await apiCreateForm(host, formData);
            await apiUpdateForm(host, 'form-1', formData);
        } finally {
            window.fetch = originalFetch;
        }

        assert.lengthOf(requests, 2);
        requests.forEach(({options}) => {
            const body = JSON.parse(options.body);
            assert.isTrue(body.grantBasedSubmissionAuthorization);
            assert.deepEqual(body.allowedActionsWhenSubmitted, ['read']);
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
            assert.isEmpty(currentHost.allForms);

            for (const action of ['update', 'delete', 'manage']) {
                currentHost = makeHost(['read'], [action], []);
                await getListOfAllForms(currentHost);
                assert.lengthOf(currentHost.allForms, 1);
            }

            for (const action of ['read', 'manage']) {
                currentHost = makeHost(['read'], [], [action]);
                await getListOfAllForms(currentHost);
                assert.lengthOf(currentHost.allForms, 1);
            }
        } finally {
            window.fetch = originalFetch;
        }
    });

    test('should only list forms with an edit right in the manage-forms activity', () => {
        assert.isFalse(hasFormEditRight({grantedFormActions: ['read']}));
        assert.isFalse(hasFormEditRight({grantedFormActions: ['read', 'delete']}));
        assert.isFalse(
            hasFormEditRight({
                grantedFormActions: [],
                grantedSubmissionCollectionActions: ['read'],
            }),
        );
        assert.isTrue(hasFormEditRight({grantedFormActions: ['read', 'update']}));
        assert.isTrue(hasFormEditRight({grantedFormActions: ['manage']}));

        const host = document.createElement('test-manage-forms');
        assert.isTrue(host.isFormListed({grantedFormActions: ['update']}));
        assert.isFalse(host.isFormListed({grantedFormActions: ['read', 'create_submissions']}));
        assert.deepEqual(
            host.createDefaultOverviewActions().map(({id}) => id),
            ['delete', 'edit', 'edit-permission'],
        );
    });

    test('should request forms with readable submissions in the manage-submissions activity', async () => {
        const originalFetch = window.fetch;
        const requestedUrls = [];
        const host = document.createElement('test-manage-submissions');
        host.entryPointUrl = 'https://example.com';
        host.auth = {token: 'token'};
        host.createScopedElement = () => document.createElement('button');
        window.fetch = (url) => {
            requestedUrls.push(url);
            return Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        'hydra:member': [
                            {
                                identifier: 'own-submissions',
                                name: 'Own submissions',
                                localizedNames: [],
                                grantedActions: ['read', 'create_submissions'],
                                grantedFormActions: ['read', 'create_submissions'],
                                grantedSubmissionCollectionActions: [],
                            },
                        ],
                    }),
            });
        };

        try {
            await getListOfAllForms(host);
        } finally {
            window.fetch = originalFetch;
        }

        const url = new URL(requestedUrls[0]);
        assert.equal(url.pathname, '/formalize/forms');
        assert.equal(url.searchParams.get('whereMayReadSubmissions'), 'true');
        assert.equal(url.searchParams.get('perPage'), '9999');
        // Forms with only own or shared submissions are listed as returned by the API.
        assert.lengthOf(host.allForms, 1);
        assert.deepEqual(
            [...host.allForms[0].actionButton.querySelectorAll('button')].map(
                (button) => button.dataset.action,
            ),
            ['open-submissions'],
        );
    });

    test('should add employers to job-offer rows and refresh changed employers', async () => {
        const originalFetch = window.fetch;
        let companyName = 'Example Company';
        const makeEntry = (identifier, frontendKey, additionalData) => ({
            identifier,
            frontendKey,
            name: identifier,
            localizedNames: [],
            grantedActions: ['read'],
            grantedFormActions: ['update'],
            grantedSubmissionCollectionActions: [],
            additionalData,
        });
        const host = {
            _i18n: {t: (key) => key},
            entryPointUrl: 'https://example.com',
            auth: {token: 'token'},
            allForms: [],
            allowListFrontendKeys: [],
            denyListFrontendKeys: [],
            loadedModules: new Map(),
            forms: new Map(),
            formsGrantedActions: new Map(),
            lang: 'en',
            createScopedElement: () => document.createElement('button'),
            sendSetPropertyEvent: () => {},
        };

        window.fetch = () =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        'hydra:member': [
                            makeEntry('external', 'job-offer', {
                                jobOfferType: 'external',
                                companyName,
                            }),
                            makeEntry('internal', 'job-offer', {
                                jobOfferType: 'internal',
                                organization: 'Faculty',
                            }),
                            makeEntry('other', 'other-form', {companyName: 'Ignored Company'}),
                        ],
                    }),
            });

        try {
            await getListOfAllForms(host);
            assert.deepEqual(
                host.allForms.map(({employer}) => employer),
                ['Example Company', 'TU Graz', ''],
            );

            companyName = 'Updated Company';
            await getListOfAllForms(host);
            assert.equal(host.allForms[0].employer, 'Updated Company');
        } finally {
            window.fetch = originalFetch;
        }
    });

    test('should disable the dropdown when all supplied actions are disabled', async () => {
        const page = document.createElement('test-manage-forms-overview-page');
        page.selectedFormsCount = 1;
        page.actions = ['delete', 'edit', 'edit-permission'].map((value) => ({
            value,
            label: value,
            disabled: true,
        }));
        document.body.appendChild(page);
        await page.updateComplete;

        const select = page.shadowRoot.querySelector('dbp-select');
        const actions = select.options.map(({value}) => value);
        assert.deepEqual(actions, ['delete', 'edit', 'edit-permission']);
        assert.isTrue(select.hasAttribute('disabled'));

        page.actions = page.actions.map((action) =>
            action.value === 'edit-permission' ? {...action, disabled: false} : action,
        );
        await page.updateComplete;
        assert.isFalse(select.hasAttribute('disabled'));

        page.remove();
    });

    test('should render only supplied dropdown actions', async () => {
        const page = document.createElement('test-manage-forms-overview-page');
        page.selectedFormsCount = 1;
        page.actions = [
            {value: 'edit', label: 'Edit', disabled: false},
            {value: 'edit-permission', label: 'Edit permissions', disabled: false},
        ];
        document.body.appendChild(page);
        await page.updateComplete;

        const select = page.shadowRoot.querySelector('dbp-select');
        assert.deepEqual(
            select.options.map(({value}) => value),
            ['edit', 'edit-permission'],
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
        searchInput.dispatchEvent(new Event('input'));
        await page.updateComplete;

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

    test('should search submissions as the user types', async () => {
        const page = document.createElement('test-manage-form-submissions-page');
        page.noSubmissionAvailable = {draft: false, submitted: true};
        page.submissions = {draft: [{name: 'Draft'}], submitted: []};
        page.isActionAvailable = {draft: false, submitted: false};
        const searchedStates = [];
        page.addEventListener('submission-search', (event) => {
            searchedStates.push(event.detail.state);
        });
        document.body.appendChild(page);
        await page.updateComplete;

        const searchInput = page.getSearchbar('draft');
        searchInput.value = 'Draft';
        searchInput.dispatchEvent(new Event('input'));

        assert.deepEqual(searchedStates, ['draft']);
        page.remove();
    });

    test('should put all submission filters into the routing URL', () => {
        const host = document.createElement('test-form-submissions');
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
        host.addEventListener(ROUTING_URL_CHANGE_EVENT, (event) => {
            routingUrl = event.detail.url;
        });

        host.filterTable('draft');

        const url = new URL(routingUrl, 'https://example.com');
        assert.equal(url.searchParams.get('draft-search'), 'Alice');
        assert.equal(url.searchParams.get('draft-search-column'), 'name');
        assert.equal(url.searchParams.get('draft-search-operator'), 'starts');
        assert.equal(url.searchParams.get('submitted-search'), 'Existing');
    });

    test('should put form and submission pagination into the routing URL', () => {
        const page = document.createElement('test-manage-forms-overview-page');
        page.routingUrl = '/';
        page._urlStateReady = true;
        let routingUrl = '';
        page.addEventListener(ROUTING_URL_CHANGE_EVENT, (event) => {
            routingUrl = event.detail.url;
        });

        page.handleTablePageLoaded({
            detail: {tableId: 'forms-table', page: 3, pageSize: 3, paginationSize: 20},
        });

        const url = new URL(routingUrl, 'https://example.com');
        assert.equal(url.searchParams.get('forms-page'), '3');
        assert.equal(url.searchParams.get('forms-page-size'), '20');

        const host = document.createElement('test-form-submissions');
        host.routingUrl = '/form-1';
        host.addEventListener(ROUTING_URL_CHANGE_EVENT, (event) => {
            routingUrl = event.detail.url;
        });
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
        assert.equal(submissionUrl.pathname, '/form-1');
        assert.equal(submissionUrl.searchParams.get('draft-page'), '2');
        assert.equal(submissionUrl.searchParams.get('draft-page-size'), '10');
    });

    test('should scope pagination size storage to the current user and activity', () => {
        const host = document.createElement('test-manage-forms');
        host.auth = {'user-id': 'user-1'};
        host.isLoggedIn = () => true;

        assert.equal(host.getPaginationSizeStorageKey(), 'formalize-manage-forms-user-1');

        host.auth = {'user-id': 'user-2'};
        assert.equal(host.getPaginationSizeStorageKey(), 'formalize-manage-forms-user-2');

        const submissionsHost = document.createElement('test-manage-submissions');
        submissionsHost.auth = {'user-id': 'user-1'};
        submissionsHost.isLoggedIn = () => true;
        assert.equal(
            submissionsHost.getPaginationSizeStorageKey(),
            'formalize-manage-submissions-user-1',
        );
    });

    test('should put submission details into the activity routing URL', () => {
        const host = document.createElement('test-form-submissions');
        const formId = '11111111-1111-1111-1111-111111111111';
        const submissionId = '22222222-2222-2222-2222-222222222222';
        host.form = {formId};
        host.getRoutingData = () => ({
            pathSegments: [formId],
            queryParams: new URLSearchParams('submitted-page=2'),
            hash: '',
        });
        let routingUrl = '';
        host.addEventListener(ROUTING_URL_CHANGE_EVENT, (event) => {
            routingUrl = event.detail.url;
        });

        host.setSubmissionDetailsRoute(submissionId);
        assert.equal(routingUrl, `/${formId}/details/${submissionId}?submitted-page=2`);

        host.setSubmissionDetailsRoute();
        assert.equal(routingUrl, `/${formId}?submitted-page=2`);
    });

    test('should restore submission filters and pagination from the routing URL', async () => {
        const host = document.createElement('test-form-submissions');
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

    test('should keep the stored page size when the routing URL has no page size', async () => {
        const host = document.createElement('test-form-submissions');
        const searchInput = document.createElement('input');
        const searchColumn = document.createElement('select');
        const searchOperator = document.createElement('select');
        searchColumn.add(new Option('All', 'all'));
        searchOperator.add(new Option('Like', 'like'));
        host.getRoutingData = () => ({queryParams: new URLSearchParams()});
        host.getSubmissionsPage = () => ({
            getSearchbar: () => searchInput,
            getSearchSelect: () => searchColumn,
            getSearchOperator: () => searchOperator,
        });
        const calls = [];
        host.submissionTables.draft = {
            identifier: 'submissions-table-draft',
            paginationSize: 20,
            clearFilter: () => {},
            setFilter: () => {},
            getColumnsFields: () => [],
            tabulatorTable: {
                deselectRow: () => {},
                getRows: () => [],
                setPageSize: (size) => Promise.resolve(calls.push(['page-size', size])),
                setPage: () => Promise.resolve(),
            },
        };

        await host.restoreSubmissionTableState('draft');

        assert.deepInclude(calls, ['page-size', 20]);
    });

    test('should restore form pagination after table data has loaded', async () => {
        const page = document.createElement('test-manage-forms-overview-page');
        let resolveData;
        const dataLoaded = new Promise((resolve) => {
            resolveData = resolve;
        });
        const calls = [];
        page.forms = [{id: 1}];
        page.showFormsTable = true;
        const table = {
            identifier: 'forms-table',
            tableReady: true,
            tableBuilding: false,
            setData: () => dataLoaded,
        };
        page.getFormsTable = () => table;
        page.restoreTableState = () => {
            calls.push('restore');
        };
        page._urlStateReady = true;

        page.syncTable();
        assert.deepEqual(calls, []);
        assert.isFalse(page._urlStateReady);

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

suite('manage-forms and manage-submissions activities', () => {
    const forms = [
        {
            identifier: 'form-own',
            name: 'Own submissions only',
            localizedNames: [],
            grantedActions: ['read', 'create_submissions'],
            grantedFormActions: ['read', 'create_submissions'],
            grantedSubmissionCollectionActions: [],
            allowedSubmissionStates: 4,
            dateCreated: '2026-01-01T10:00:00+00:00',
        },
        {
            identifier: 'form-edit',
            name: 'Editable form',
            localizedNames: [],
            grantedActions: ['manage'],
            grantedFormActions: ['manage'],
            grantedSubmissionCollectionActions: ['manage'],
            allowedSubmissionStates: 5,
            dateCreated: '2026-02-01T10:00:00+00:00',
        },
    ];
    let originalFetch;
    let requests;

    const waitFor = async (predicate, timeout = 5000) => {
        const start = Date.now();
        while (!predicate()) {
            if (Date.now() - start > timeout) throw new Error('Timed out waiting for condition');
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
    };

    const mountActivity = (tagName) => {
        const element = document.createElement(tagName);
        element.setAttribute('entry-point-url', 'https://api.example.com');
        element.setAttribute('base-path', '/');
        element.setAttribute('lang', 'en');
        element.routingUrl = '/';
        element.routes = [];
        element.sendSetPropertyEvent = (name, value) => {
            if (name === 'routing-url') {
                element.routes.push(value);
                element.routingUrl = value;
            }
        };
        document.body.appendChild(element);
        element.auth = {token: 'token', 'login-status': 'logged-in', 'user-id': 'user-1'};
        return element;
    };

    const getOverviewTable = (element) =>
        element.shadowRoot
            ?.querySelector('#overview-page')
            ?.shadowRoot?.querySelector('#tabulator-table-forms');

    setup(() => {
        originalFetch = window.fetch;
        requests = [];
        const json = (data) => Promise.resolve({ok: true, json: () => Promise.resolve(data)});
        window.fetch = (input) => {
            const url = new URL(/** @type {string} */ (input), window.location.origin);
            requests.push(url);
            if (url.pathname === '/modules.json') return json({forms: {}});
            if (url.pathname === '/formalize/forms') return json({'hydra:member': forms});
            if (url.pathname.startsWith('/formalize/forms/')) return json({availableTags: []});
            if (url.pathname === '/formalize/submissions') {
                const formId = url.searchParams.get('formIdentifier');
                return json({
                    'hydra:member': [1, 2].map((index) => ({
                        identifier: `${formId}-submission-${index}`,
                        submissionState: 4,
                        dateCreated: `2026-03-0${index}T10:00:00+00:00`,
                        dataFeedElement: JSON.stringify({firstName: `Alice ${index}`}),
                        tags: [],
                        submittedFiles: [],
                        grantedActions: ['read'],
                    })),
                });
            }
            return json({});
        };
    });

    teardown(() => {
        window.fetch = originalFetch;
        document
            .querySelectorAll('dbp-formalize-manage-forms, dbp-formalize-manage-submissions')
            .forEach((element) => element.remove());
    });

    test('manage-forms only lists editable forms', async () => {
        const element = mountActivity('dbp-formalize-manage-forms');
        await waitFor(() => getOverviewTable(element)?.tabulatorTable?.getData().length > 0);

        const formsRequest = requests.find((url) => url.pathname === '/formalize/forms');
        assert.isNull(formsRequest.searchParams.get('whereMayReadSubmissions'));
        assert.deepEqual(
            element.allForms.map(({formId}) => formId),
            ['form-edit'],
        );
        assert.isNull(element.shadowRoot.querySelector('dbp-formalize-form-submissions'));
    });

    test('manage-submissions lists forms with readable submissions and opens them', async () => {
        const element = mountActivity('dbp-formalize-manage-submissions');
        await waitFor(() => getOverviewTable(element)?.tabulatorTable?.getData().length === 2);

        const formsRequest = requests.find((url) => url.pathname === '/formalize/forms');
        assert.equal(formsRequest.searchParams.get('whereMayReadSubmissions'), 'true');

        // Open the submissions with the row action
        const row = element.allForms.find(({formId}) => formId === 'form-own');
        row.actionButton.querySelector('[data-action="open-submissions"]').click();
        assert.equal(element.routes.at(-1), '/form-own');

        const formSubmissions = element.shadowRoot.querySelector('dbp-formalize-form-submissions');
        await waitFor(
            () =>
                formSubmissions.submissionTables.submitted?.tabulatorTable?.getData().length === 2,
        );
        assert.equal(formSubmissions.activeFormName, 'Own submissions only');
        assert.isFalse(element.showFormsTable);
        assert.isTrue(
            requests.some(
                (url) =>
                    url.pathname === '/formalize/submissions' &&
                    url.searchParams.get('formIdentifier') === 'form-own',
            ),
        );

        // Submission search is reflected in the activity routing URL
        const page = formSubmissions.getSubmissionsPage();
        const searchInput = page.getSearchbar('submitted');
        searchInput.value = 'Alice 1';
        searchInput.dispatchEvent(new Event('input'));
        assert.equal(element.routes.at(-1), '/form-own?submitted-search=Alice+1');

        // Back to the overview keeps only the forms list parameters
        page.shadowRoot.querySelector('.back-navigation button').click();
        await element.updateComplete;
        assert.equal(element.routes.at(-1), '/');
        assert.isTrue(element.showFormsTable);
        assert.equal(element.activeFormId, '');
    });
});
