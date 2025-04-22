export const pascalToKebab = (str) => {
    // Replace capital letters with hyphen followed by the lowercase equivalent
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
};

export const getBasePath = (path) => {
    //
    return path.replace(/^(.*\/[de][en]).*$/, '$1');
};

// Submission states
export const SUBMISSION_STATE_DRAFT = 0b0001;
export const SUBMISSION_STATE_SUBMITTED = 0b0100;
