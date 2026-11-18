/** Identifies the API and authenticated session without sharing data across sessions. */
export function getApiRequestScope(host) {
    return JSON.stringify([host.entryPointUrl, host.auth?.['user-id'], host.auth?.token]);
}

/** Shares collection requests and briefly bridges counting and opening a form. */
export class SubmissionDataLoader {
    constructor({maxAge = 30000, now = Date.now} = {}) {
        this.maxAge = maxAge;
        this.now = now;
        this.scope = null;
        this.requests = new Map();
        this.recent = new Map();
    }

    invalidate(formId = null) {
        const ids = formId === null ? [...this.recent.keys()] : [formId];
        for (const id of ids) {
            clearTimeout(this.recent.get(id)?.timer);
            this.recent.delete(id);
        }
        if (formId === null) this.requests.clear();
        else this.requests.delete(formId);
    }

    load(
        host,
        formId,
        {reuseRecent = false, remember = false, purpose = reuseRecent ? 'table' : 'count'} = {},
    ) {
        const scope = getApiRequestScope(host);
        if (this.scope !== scope) {
            this.invalidate();
            this.scope = scope;
        }

        const cached = this.recent.get(formId);
        if (reuseRecent && cached && cached.purpose !== purpose && cached.expiresAt > this.now()) {
            clearTimeout(cached.timer);
            this.recent.delete(formId);
            return Promise.resolve(this.copy(cached.result));
        }
        // Only bridge counting and opening; repeated counts or table reloads stay fresh.
        clearTimeout(cached?.timer);
        this.recent.delete(formId);

        let request = this.requests.get(formId);
        if (!request) {
            request = {remember, purposes: new Set([purpose])};
            this.requests.set(formId, request);
            request.promise = this.fetchCollection(host, formId)
                .then((result) => {
                    if (
                        this.requests.get(formId) === request &&
                        request.remember &&
                        request.purposes.size === 1
                    ) {
                        const cached = {
                            result,
                            purpose,
                            expiresAt: this.now() + this.maxAge,
                            timer: setTimeout(() => this.recent.delete(formId), this.maxAge),
                        };
                        this.recent.set(formId, cached);
                    }
                    return result;
                })
                .finally(() => {
                    if (this.requests.get(formId) === request) this.requests.delete(formId);
                });
        } else {
            request.remember ||= remember;
            request.purposes.add(purpose);
        }

        // Table preparation and tagging must not mutate another consumer's response.
        return request.promise.then((result) => this.copy(result));
    }

    copy({response, data}) {
        return {response, data: structuredClone(data)};
    }

    async fetchCollection(host, formId) {
        const entryPointUrl = host.entryPointUrl;
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: `Bearer ${host.auth.token}`,
            },
        };
        /** @type {string|null} */
        let url = `${entryPointUrl}/formalize/submissions?${new URLSearchParams({
            formIdentifier: formId,
            perPage: '9999',
        })}`;
        let response;
        let data;
        while (url) {
            const pageResponse = await fetch(url, options);
            if (!pageResponse.ok) {
                throw new Error(`Failed to load submissions: ${pageResponse.status}`);
            }
            const page = await pageResponse.json();
            if (!data) {
                response = pageResponse;
                data = {...page, 'hydra:member': [...(page['hydra:member'] ?? [])]};
            } else {
                data['hydra:member'].push(...(page['hydra:member'] ?? []));
            }
            const next = page['hydra:view']?.['hydra:next'];
            url = next ? new URL(next, entryPointUrl).href : null;
        }
        return {response, data};
    }
}
