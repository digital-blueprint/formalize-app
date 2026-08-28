import {assert} from 'chai';

import '../src/dbp-formalize-manage-forms';
import '../src/dbp-formalize.js';
import {getListOfAllForms} from '../src/manage-forms-api.js';

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
});

suite('manage forms actions', () => {
    let originalFetch;

    setup(() => {
        originalFetch = window.fetch;
    });

    teardown(() => {
        window.fetch = originalFetch;
    });

    test('adds permission-gated actions to each form', async () => {
        window.fetch = () =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        'hydra:member': [
                            {
                                identifier: 'managed-form',
                                name: 'Managed form',
                                localizedNames: [],
                                frontendKey: 'test-form',
                                grantedActions: ['manage'],
                            },
                            {
                                identifier: 'read-only-form',
                                name: 'Read-only form',
                                localizedNames: [],
                                frontendKey: 'test-form',
                                grantedActions: ['read'],
                            },
                        ],
                    }),
            });

        const calls = [];
        const moduleInstance = {
            getEditFormComponent: () => document.createElement('div'),
            getFormFrontendKey: () => 'test-form',
            getUrlSlug: () => 'test-form',
        };
        const host = {
            _i18n: {t: (key) => key},
            allForms: [],
            allowListFrontendKeys: [],
            auth: {token: 'token'},
            createScopedElement: (name) => {
                const element = document.createElement('button');
                element.dataset.scopedName = name;
                return element;
            },
            denyListFrontendKeys: [],
            entryPointUrl: 'https://example.test',
            forms: new Map(),
            formsGrantedActions: new Map(),
            handleDeleteForm: (formId) => calls.push(['delete', formId]),
            handleEditFormPermission: (formId) => calls.push(['permission', formId]),
            handleOpenEditFormDialog: (formId) => calls.push(['edit', formId]),
            loadedModules: new Map([['test-form', {formId: 'module-form', moduleInstance}]]),
            options_forms: {},
            sendSetPropertyEvent: (...args) => calls.push(['open', ...args]),
        };

        await getListOfAllForms(host);

        const managedActions = [...host.allForms[0].actionButton.children];
        assert.deepEqual(
            managedActions.map((button) => button.getAttribute('icon-name')),
            [null, 'pencil', 'edit-permission', 'trash'],
        );
        assert.lengthOf(host.allForms[1].actionButton.children, 1);

        managedActions.forEach((button) => button.click());
        assert.deepInclude(calls, ['edit', 'managed-form']);
        assert.deepInclude(calls, ['permission', 'managed-form']);
        assert.deepInclude(calls, ['delete', 'managed-form']);
    });
});
