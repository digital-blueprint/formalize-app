import {SUBMISSION_PERMISSIONS} from './utils.js';

/** Only ownership and submission-level grants count, never collection-level access. */
export function isPersonalSubmission(submission, userId, readableSubmissionIds) {
    return (
        (Boolean(userId) && submission.creatorId === userId) ||
        readableSubmissionIds.has(submission.identifier)
    );
}

/** Read every page of an authenticated JSON-LD collection. */
async function readCollection(host, path) {
    const entries = [];
    /** @type {URL|null} */
    let url = new URL(path, `${host.entryPointUrl.replace(/\/$/, '')}/`);
    while (url) {
        const response = await fetch(url.href, {
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: `Bearer ${host.auth.token}`,
            },
        });
        if (!response.ok)
            throw new Error(`Failed to load personal submissions: ${response.status}`);
        const data = await response.json();
        entries.push(...data['hydra:member']);
        const next = data['hydra:view']?.['hydra:next'];
        url = next ? new URL(next, url) : null;
    }
    return entries;
}

export async function getReadableSubmissionIds(host) {
    const grants = await readCollection(
        host,
        'authorization/granted-actions/DbpRelayFormalizeSubmission?perPage=9999',
    );
    return new Set(
        grants
            .filter((grant) =>
                grant.actions?.some((action) =>
                    [SUBMISSION_PERMISSIONS.READ, SUBMISSION_PERMISSIONS.MANAGE].includes(action),
                ),
            )
            .map((grant) => grant.resourceIdentifier),
    );
}

export function readFormSubmissions(host, formId) {
    const query = new URLSearchParams({formIdentifier: formId, perPage: '9999'});
    return readCollection(host, `formalize/submissions?${query}`);
}
