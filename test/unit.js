import {assert} from 'chai';

import '../src/dbp-forms-activity';
import '../src/dbp-forms.js';

suite('dbp-forms-activity basics', () => {
    let node;

    suiteSetup(async () => {
        node = document.createElement('dbp-forms-activity');
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
