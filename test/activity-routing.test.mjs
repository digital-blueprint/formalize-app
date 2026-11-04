import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getFormManageSubmissionsUrl} from '../src/utils.js';

const readJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

for (const [topicPath, metadataDirectory] of [
    ['assets/dbp-formalize.topic.metadata.json.ejs', 'src'],
    ['assets_custom/dbp-formalize.topic.metadata.json.ejs', 'assets_custom'],
    ['app-template/topic.metadata.json', 'src'],
]) {
    test(`${topicPath} routes middleware links to submissions without a slug collision`, () => {
        const topic = readJson(topicPath);
        const activities = topic.activities.map((entry) => ({
            ...readJson(`${metadataDirectory}/${entry.path.split('/').at(-1)}`),
            visible: entry.visible,
        }));
        const routes = activities.map((activity) => activity.routing_name);
        assert.equal(new Set(routes).size, routes.length);
        assert.ok(!routes.includes('manage-submissions'));

        const submissions = activities.find((activity) => activity.routing_name === 'manage-forms');
        assert.equal(submissions.element, 'dbp-formalize-manage-submissions');
        assert.equal(submissions.module_src, 'dbp-formalize-manage-submissions.js');
        assert.equal(submissions.visible, true);
        assert.equal(submissions.name.en, 'Manage forms');
        assert.equal(submissions.name.de, 'Formulare verwalten');

        const definitions = activities.find(
            (activity) => activity.routing_name === 'manage-form-definitions',
        );
        assert.equal(definitions.element, 'dbp-formalize-manage-forms');
        assert.equal(definitions.module_src, 'dbp-formalize-manage-forms.js');
        assert.equal(definitions.visible, false);
    });
}

test('generated submissions links use the middleware-compatible slug at each deployment base path', () => {
    const originalWindow = globalThis.window;
    try {
        for (const baseUrl of [
            'https://formulare.tugraz.at',
            'https://dbp-dev.tugraz.at/tugapps/formalize',
            'https://dbp-demo.tugraz.at/tugapps/formalize',
            'http://localhost:8001/dist',
        ]) {
            globalThis.window = {location: {href: `${baseUrl}/de/manage-forms/form-1`}};
            for (const lang of ['de', 'en']) {
                assert.equal(
                    getFormManageSubmissionsUrl('form-1', lang),
                    `${baseUrl}/${lang}/manage-forms/form-1`,
                );
            }
        }
    } finally {
        if (originalWindow === undefined) delete globalThis.window;
        else globalThis.window = originalWindow;
    }
});
