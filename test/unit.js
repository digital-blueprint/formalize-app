import {assert} from 'chai';

import '../src/dbp-formalize-show-registrations';
import '../src/dbp-formalize.js';

suite('dbp-formalize-show-registrations basics', () => {
    let node;

    suiteSetup(async () => {
        node = document.createElement('dbp-formalize-show-registrations');
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
