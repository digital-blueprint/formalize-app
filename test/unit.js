import {assert} from 'chai';

import '../src/dbp-formalize-show-submissions';
import '../src/dbp-formalize.js';

suite('dbp-formalize-show-submissions basics', () => {
    let node;

    suiteSetup(async () => {
        node = document.createElement('dbp-formalize-show-submissions');
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
