export const pascalToKebab = (str) => {
    // Replace capital letters with hyphen followed by the lowercase equivalent
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
};

export const getFormRenderUrl = (formUrlSlug) => {
    const currentUrl = new URL(window.location.href);
    const origin = currentUrl.origin;
    const basePath = currentUrl.pathname.replace(/^(.*\/[de][en]).*$/, '$1');
    return `${origin}${basePath}/render-form/${formUrlSlug}`;
};

export const getFormShowSubmissionsUrl = () => {
    const currentUrl = new URL(window.location.href);
    const origin = currentUrl.origin;
    const basePath = currentUrl.pathname.replace(/^(.*\/[de][en]).*$/, '$1');
    return `${origin}${basePath}/show-registrations`;
};

// Submission states
export const SUBMISSION_STATE_DRAFT = 0b0001;
export const SUBMISSION_STATE_SUBMITTED = 0b0100;

export function formatDate(value) {
    if (!value) return '';

    const date = new Date(value);
    return isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('de-DE', {
              second: '2-digit',
              minute: '2-digit',
              hour: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
          });
}

/**
 * Send a fetch to given url with given options
 * @param url
 * @param options
 * @returns {object} response (error or result)
 */
export async function httpGetAsync(url, options) {
    return await fetch(url, options)
        .then((result) => {
            if (!result.ok) throw result;
            return result;
        })
        .catch((error) => {
            return error;
        });
}
