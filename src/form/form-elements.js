import {css, html} from 'lit';

const sanitizeForHtmlId = (str) => {
    return str
        .replace(/[^a-z0-9]/gi, '-')  // Replace non-alphanumeric characters with hyphens
        .replace(/^-+|-+$/g, '')      // Remove leading and trailing hyphens
        .replace(/^[0-9]/, 'id-$&')   // Prepend 'id-' if the string starts with a number
        .toLowerCase();               // Convert to lowercase
};

const formatDateValue = (val) => {
    if (!val) return "";

    // Check if the value is a number (timestamp)
    const timestamp = Number(val);
    if (!isNaN(timestamp)) {
        // Convert timestamp to Date object
        const date = new Date(timestamp);

        // Check if it's a valid date
        if (!isNaN(date.getTime())) {
            // Format date as YYYY-MM-DD (required format for input type="date")
            return date.toISOString().split('T')[0];
        }
    }

    // If it's not a timestamp or invalid, return the original value
    return val;
};

export const getNationalityItems = () => {
    return {
        ALB: "Albanian",
        AND: "Andorran",
        AUT: "Austrian",
        BLR: "Belarusian",
        BEL: "Belgian",
        BIH: "Bosnian",
        BGR: "Bulgarian",
        HRV: "Croatian",
        CYP: "Cypriot",
        CZE: "Czech",
        DNK: "Danish",
        EST: "Estonian",
        FIN: "Finnish",
        FRA: "French",
        DEU: "German",
        GRC: "Greek",
        HUN: "Hungarian",
        ISL: "Icelandic",
        IRL: "Irish",
        ITA: "Italian",
        LVA: "Latvian",
        LIE: "Liechtensteiner",
        LTU: "Lithuanian",
        LUX: "Luxembourgish",
        MLT: "Maltese",
        MDA: "Moldovan",
        MCO: "Monégasque",
        MNE: "Montenegrin",
        NLD: "Dutch",
        MKD: "North Macedonian",
        NOR: "Norwegian",
        POL: "Polish",
        PRT: "Portuguese",
        ROU: "Romanian",
        RUS: "Russian",
        SMR: "Sammarinese",
        SRB: "Serbian",
        SVK: "Slovak",
        SVN: "Slovenian",
        ESP: "Spanish",
        SWE: "Swedish",
        CHE: "Swiss",
        UKR: "Ukrainian",
        GBR: "British",
        VAT: "Vatican"
    };
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

/**
 *
 * @param name
 * @param label
 * @param value - the string to display
 * @param isRequired
 * @param options
 */
export const stringElement = (name, label, value = "", isRequired = false, options = {}) => {
    const id = sanitizeForHtmlId(name);
    const rows = options.rows || 1;
    const errorMessagesRenderFunction = options.errorMessagesRenderFunction || null;

    return html`
        <fieldset>
            <label for="form-input-${name}">${label}</label>
            ${rows > 1
                ? html`<textarea
                    id="form-input-${id}"
                    name="${name}"
                    rows="${rows}"
                    ?required=${isRequired}
                  >${value}</textarea>`
                : html`<input
                    type="text"
                    id="form-input-${id}"
                    name="${name}"
                    value="${value}"
                    ?required=${isRequired}
                  >`
            }
            ${errorMessagesRenderFunction ? errorMessagesRenderFunction() : ``}
        </fieldset>
    `;
};

/**
 *
 * @param name
 * @param value
 */
export const hiddenElement = (name, value = "") => {
    const id = sanitizeForHtmlId(name);
    return html`
        <input type="hidden" id="form-input-${id}" name="${name}" value="${value}">
    `;
};

/**
 *
 * @param name
 * @param label
 * @param value - YYYY-MM-DD (iso8601)
 * @param isRequired
 */
export const dateElement = (name, label, value = "", isRequired = false) => {
    const id = sanitizeForHtmlId(name);
    const formattedValue = formatDateValue(value);

    return html`
        <fieldset>
            <label for="form-input-${name}">${label}</label>
            <input
                type="date"
                id="form-input-${id}"
                name="${name}"
                value="${formattedValue}"
                ?required=${isRequired} />
        </fieldset>
    `;
};

const fixDateTimeValue = (val) => {
    if (!val) return '';

    const date = new Date(val);
    if (isNaN(date.getTime())) return ''; // Invalid date

    // Return ISO 8601 string including a timezone, because we want also store the timezone in Blob metadata
    return date.toISOString();
};

const updateDateTimeElementDataValue = (input) => {
    // Set the data-value attribute to the ISO 8601 string including a timezone, because we want also store the timezone in Blob metadata
    input.setAttribute('data-value', fixDateTimeValue(input.value));
};

function isoToDatetimeLocal(isoString) {
    const date = new Date(isoString);

    // Check if the date is valid
    if (isNaN(date.getTime())) {
        return '';
    }

    // Adjust for local timezone
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));

    // Format to YYYY-MM-DDTHH:mm
    return localDate.toISOString().slice(0, 16);
}

/**
 *
 * @param name
 * @param label
 * @param value
 * @param isRequired
 */
export const dateTimeElement = (name, label, value = "", isRequired = false) => {
    const id = sanitizeForHtmlId(name);
    return html`
        <fieldset>
            <label for="form-input-${name}">${label}</label>
            <input
                type="datetime-local"
                id="form-input-${id}"
                @change=${e => updateDateTimeElementDataValue(e.target)}
                name="${name}"
                value="${isoToDatetimeLocal(value)}"
                ?required=${isRequired} />
        </fieldset>
    `;
};

export const enumElement = (name, label, value = "", items = {}, isRequired = false) => {
    const id = sanitizeForHtmlId(name);
    return html`
        <fieldset>
            <label for="form-input-${name}">${label}</label>
            <select
                id="form-input-${id}"
                name="${name}"
                ?required=${isRequired}>
                ${Object.keys(items).map((key) => html`
                    <option value="${key}" ?selected=${key === value}>${items[key]}</option>
                `)}
            </select>
        </fieldset>
    `;
};

/**
 *
 * @param name
 * @param label
 * @param value - is 'on' when checked
 * @param isRequired
 */
export const checkboxElement = (name, label, value, isRequired = false) => {
    const id = sanitizeForHtmlId(name);
    return html`
        <fieldset>
            <label for="form-input-${name}">${label}</label>
            <input
                type="checkbox"
                id="form-input-${id}"
                name="${name}"
                value="${value}"
                ?required=${isRequired} />
        </fieldset>
    `;
};