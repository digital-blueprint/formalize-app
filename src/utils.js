export const pascalToKebab = (str) => {
    // Replace capital letters with hyphen followed by the lowercase equivalent
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
};

export const getFormRenderUrl = (formUrlSlug) => {
    const currentUrl = new URL(window.location.href);
    const origin = currentUrl.origin;
    const basePath = currentUrl.pathname.replace(/^(.*\/[de][en])\/.*$/, '$1');
    return `${origin}${basePath}/render-form/${formUrlSlug}`;
};

export const getFormShowSubmissionsUrl = (formId) => {
    const currentUrl = new URL(window.location.href);
    const origin = currentUrl.origin;
    const basePath = currentUrl.pathname.replace(/^(.*\/[de][en])\/.*$/, '$1');
    return `${origin}${basePath}/show-submissions/${formId}`;
};

// Submission states
export const SUBMISSION_STATE_NONE = 0b0; // 0
export const SUBMISSION_STATE_DRAFT = 0b0001; // 1
export const SUBMISSION_STATE_SUBMITTED = 0b0100; // 4

export const SUBMISSION_STATES = Object.freeze({
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
});

export const SUBMISSION_STATES_BINARY = Object.freeze({
    NONE: SUBMISSION_STATE_NONE,
    DRAFT: SUBMISSION_STATE_DRAFT,
    SUBMITTED: SUBMISSION_STATE_SUBMITTED,
});

export const FORM_PERMISSIONS = Object.freeze({
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete',
    CREATE_SUBMISSIONS: 'create_submissions',
    READ_SUBMISSIONS: 'read_submissions',
    UPDATE_SUBMISSIONS: 'update_submissions',
    DELETE_SUBMISSIONS: 'delete_submissions',
    MANAGE: 'manage',
});

export const SUBMISSION_PERMISSIONS = Object.freeze({
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete',
    MANAGE: 'manage',
});

export function isDraftStateEnabled(allowedSubmissionStates) {
    return (allowedSubmissionStates & SUBMISSION_STATE_DRAFT) === SUBMISSION_STATE_DRAFT;
}

export function isSubmittedStateEnabled(allowedSubmissionStates) {
    return (allowedSubmissionStates & SUBMISSION_STATE_SUBMITTED) === SUBMISSION_STATE_SUBMITTED;
}

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
