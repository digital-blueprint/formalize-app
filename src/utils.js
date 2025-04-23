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
