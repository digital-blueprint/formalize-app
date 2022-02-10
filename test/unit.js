import {assert} from 'chai';

import '../src/dbp-formalize-activity';
import '../src/dbp-formalize.js';

suite('dbp-formalize-activity basics', () => {
    let node;

    suiteSetup(async () => {
        node = document.createElement('dbp-formalize-activity');
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
