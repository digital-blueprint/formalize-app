import {assert} from 'chai';

import '../src/dbp-formalize-manage-forms';
import '../src/dbp-formalize.js';

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
});
