export const pascalToKebab = (str) => {
    // Replace capital letters with hyphen followed by the lowercase equivalent
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
};

export const getFormRenderUrl = (formUrlSlug, lang) => {
    const currentUrl = new URL(window.location.href);
    const origin = currentUrl.origin;
    const basePath = currentUrl.pathname.replace(/^(.*\/)[de][en]\/.*$/, '$1');
    return `${origin}${basePath}${lang}/render-form/${formUrlSlug}`;
};

export const getFormManageFormsUrl = (formId, lang) => {
    const currentUrl = new URL(window.location.href);
    const origin = currentUrl.origin;
    const basePath = currentUrl.pathname.replace(/^(.*\/)[de][en]\/.*$/, '$1');
    return `${origin}${basePath}${lang}/manage-forms/${formId}`;
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

export const SUBMISSION_COLLECTION_PERMISSIONS = Object.freeze({
    CREATE_SUBMISSIONS: 'create_submissions',
    MANAGE: 'manage',
    UPDATE: 'update',
});

export const SUBMISSION_PERMISSIONS = Object.freeze({
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete',
    MANAGE: 'manage',
    READ_TAGS: 'read_tags',
    ADD_TAGS: 'add_tags',
    REMOVE_TAGS: 'remove_tags',
    READ_ADD_REMOVE_TAGS: 'read_add_remove_tags',
});

// Granted actions returned by the API on a form resource. Used to determine
// which actions the current user may perform on a given form.
export const FORM_PERMISSIONS = Object.freeze({
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete',
    MANAGE: 'manage',
});

export const TAG_PERMISSIONS = Object.freeze({
    NONE: 0,
    READ: 1,
    READ_ADD: 2,
    READ_ADD_REMOVE: 3,
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

/**
 * Return an object with the same property names as the values
 * @param {Array} array
 * @returns {object}
 */
export const arrayToObject = (array) => {
    if (!Array.isArray(array) || array.length < 1) return {};

    const result = Object.create(null);

    for (const item of array) {
        const value = item.identifier;
        result[value] = value;
    }
    return result;
};

/**
 * Shows a confirmation dialog for deletion and waits for user response
 * @returns {Promise<boolean>} true if user confirms, false if user cancels
 */
export async function getDeletionConfirmation(host) {
    return new Promise((resolve) => {
        // Store the resolve function so we can call it from the modal buttons
        host._deletionConfirmationResolve = resolve;

        // Show the confirmation modal
        const modal = host._('#deletion-confirmation-modal--formalize');
        if (modal) {
            modal.open();
        }
    });
}

/**
 * Handles the confirmation button click
 */
export function handleDeletionConfirm(host) {
    const modal = host._('#deletion-confirmation-modal--formalize');
    if (modal) {
        modal.close();
    }
    if (host._deletionConfirmationResolve) {
        host._deletionConfirmationResolve(true);
        host._deletionConfirmationResolve = null;
    }
}

/**
 * Handles the cancel button click
 */
export function handleDeletionCancel(host) {
    const modal = host._('#deletion-confirmation-modal--formalize');
    if (modal) {
        modal.close();
    }
    if (host._deletionConfirmationResolve) {
        host._deletionConfirmationResolve(false);
        host._deletionConfirmationResolve = null;
    }
}

/**
 * Append 'details/submissionId' to the URL
 * (called when opening the submission detail modal)
 * @param {string} submissionId
 * @param {string} routingName - the routing name from metadata (e.g. 'manage-forms')
 */
export function addDetailsToUrl(submissionId, routingName) {
    const currentUrl = new URL(window.location.href);
    const pathSegments = currentUrl.pathname.split('/');
    const baseIndex = pathSegments.indexOf(routingName);
    if (baseIndex > -1) {
        pathSegments.splice(0, baseIndex + 1);

        // Check if we already have details in the URL (while paginating)
        if (
            pathSegments[0].match(/[0-9a-f-]+/) &&
            pathSegments[1] === 'details' &&
            pathSegments[2].match(/[0-9a-f-]+/)
        ) {
            currentUrl.pathname = currentUrl.pathname.replace(
                /\/details\/.*$/,
                `/details/${submissionId}`,
            );
        } else {
            currentUrl.pathname += `/details/${submissionId}`;
        }

        const submissionDetailsUrl = new URL(currentUrl.toString());
        window.history.pushState({}, '', submissionDetailsUrl.toString());
    }
}

/**
 * Remove 'details/submissionId' from the URL
 * (called when closing the modal or pressing ESC)
 */
export function removeDetailsFromUrl() {
    const currentUrl = new URL(window.location.href);
    const pathSegments = currentUrl.pathname.split('/');
    const detailsIndex = pathSegments.indexOf('details');
    if (detailsIndex > -1) {
        pathSegments.splice(detailsIndex, 2);
        currentUrl.pathname = pathSegments.join('/');
        window.history.pushState({}, '', currentUrl.toString());
    }
}
