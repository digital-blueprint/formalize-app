/**
 * Routing helpers shared by the manage-forms and manage-submissions activities
 * and their sub-components.
 *
 * Sub-components never talk to the provider directly. They dispatch a
 * ROUTING_URL_CHANGE_EVENT and the activity forwards the new URL to the app shell.
 */

export const ROUTING_URL_CHANGE_EVENT = 'dbp-formalize-routing-url-change';

export const PAGINATION_SIZES = [5, 10, 20, 50, 100];

export const DEFAULT_PAGINATION_SIZE = 5;

/**
 * @param {string|null|undefined} value
 * @param {number} fallback
 * @returns {number}
 */
export function getUrlPaginationValue(value, fallback) {
    const parsedValue = Number.parseInt(value ?? '', 10);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

/**
 * Returns a page size from the routing URL, falling back to the table's current size.
 *
 * @param {string|null|undefined} value
 * @param {number} fallback
 * @returns {number}
 */
export function getUrlPaginationSize(value, fallback) {
    const requestedPageSize = getUrlPaginationValue(value, fallback);
    return PAGINATION_SIZES.includes(requestedPageSize)
        ? requestedPageSize
        : DEFAULT_PAGINATION_SIZE;
}

/**
 * Builds a routing URL with updated query parameters. Empty values remove the parameter.
 *
 * @param {{pathname?: string, queryParams?: URLSearchParams, hash?: string}} routingData
 * @param {Record<string, any>} values
 * @returns {string}
 */
export function buildRoutingUrlWithQuery(routingData, values) {
    const {pathname = '/', queryParams, hash} = routingData ?? {};
    const updatedQueryParams = new URLSearchParams(queryParams ?? undefined);

    for (const [name, value] of Object.entries(values)) {
        if (value === undefined || value === null || value === '') {
            updatedQueryParams.delete(name);
        } else {
            updatedQueryParams.set(name, `${value}`);
        }
    }

    const queryString = updatedQueryParams.toString();
    return `${pathname}${queryString ? `?${queryString}` : ''}${hash ?? ''}`;
}

/**
 * Builds a routing URL for a new path that only keeps query parameters with the given prefixes.
 *
 * @param {{queryParams?: URLSearchParams}} routingData
 * @param {string} pathname
 * @param {string[]} prefixes
 * @returns {string}
 */
export function getRoutingUrlWithQueryPrefixes(routingData, pathname, prefixes) {
    const retainedQueryParams = new URLSearchParams();
    const queryParams = routingData?.queryParams ?? new URLSearchParams();

    for (const [name, value] of queryParams) {
        if (prefixes.some((prefix) => name.startsWith(prefix))) {
            retainedQueryParams.append(name, value);
        }
    }

    const queryString = retainedQueryParams.toString();
    return `${pathname}${queryString ? `?${queryString}` : ''}`;
}

/**
 * Asks the surrounding activity to change the routing URL.
 *
 * @param {HTMLElement} element
 * @param {string} url
 */
export function dispatchRoutingUrlChange(element, url) {
    element.dispatchEvent(
        new CustomEvent(ROUTING_URL_CHANGE_EVENT, {
            detail: {url},
            bubbles: true,
            composed: true,
        }),
    );
}

/**
 * @param {string} url
 * @returns {string}
 */
export function getQueryString(url) {
    return new URL(url || '/', window.location.origin).search;
}
