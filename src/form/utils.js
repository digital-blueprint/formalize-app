import {css} from 'lit';

export const sanitizeForHtmlId = (str) => {
    return str
        .replace(/[^a-z0-9]/gi, '-')  // Replace non-alphanumeric characters with hyphens
        .replace(/^-+|-+$/g, '')      // Remove leading and trailing hyphens
        .replace(/^[0-9]/, 'id-$&')   // Prepend 'id-' if the string starts with a number
        .toLowerCase();               // Convert to lowercase
};

export const getSelectorFixCSS = () => {
    // language=css
    return css`
        /* For some reasons the selector chevron was very large */
        select:not(.select), .dropdown-menu {
            background-size: 1em;
        }
    `;
};

export const getFieldsetCSS = () => {
    // language=css
    return css`
        fieldset {
            border: none;
            margin: 15px 0;
            padding: 0;
        }

        fieldset label {
            font-weight: bold;
            display: block;
        }

        fieldset input, fieldset select, fieldset textarea {
            width: 95%;
        }
    `;
};
