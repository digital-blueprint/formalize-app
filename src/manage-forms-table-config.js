// @ts-nocheck
/**
 * Table configuration helpers for the Manage Forms activity.
 *
 * Contains everything related to tabulator table column setup,
 * visibility, ordering, and submission form options.
 */

import {dateToTimestamp} from './manage-forms-api.js';

// ---------------------------------------------------------------------------
// Submission form options
// ---------------------------------------------------------------------------

/**
 * Build the `options_submissions[state]` object used to initialise the
 * tabulator table for a given submission state.
 *
 * @param {object} host - The ManageForms element.
 * @param {string} state - 'draft' or 'submitted'
 */
export function setSubmissionFormOptions(host, state) {
    const noSubmissionDataPlaceholder = host._i18n
        ? host._i18n.t('manage-forms.no-submission-data-available')
        : 'No submission data available';

    let lang_submissions = {
        en: {columns: {}},
        de: {columns: {}},
    };

    const options_submissions = {
        langs: lang_submissions,
        autoColumns: 'full',
        rowHeight: 64,
        layout: 'fitDataStretch',
        // layoutColumnsOnNewData: true,
        selectableRows: 'highlight',
        rowHeader: {
            formatter: 'rowSelection',
            titleFormatter: 'rowSelection',
            titleFormatterParams: {
                rowRange: 'visible',
            },
            headerSort: false,
            resizable: false,
            frozen: true,
            headerHozAlign: 'center',
            hozAlign: 'center',
        },
        columnDefaults: {
            vertAlign: 'middle',
            hozAlign: 'left',
            resizable: false,
        },
        placeholder: noSubmissionDataPlaceholder,
    };

    options_submissions.autoColumnsDefinitions = (definitions) => {
        definitions.forEach((columnDefinition) => {
            if (columnDefinition.field === 'submissionId') {
                columnDefinition.visible = false;
            }
            if (columnDefinition.field === 'dateCreated') {
                columnDefinition.visible = true;
                columnDefinition.title = host.lang === 'de' ? 'Erstellt am' : 'Date created';
            }
            if (columnDefinition.field === 'htmlButtons') {
                columnDefinition.title = '';
                columnDefinition.formatter = 'html';
                columnDefinition.hozAlign = 'right';
                columnDefinition.vertAlign = 'middle';
                columnDefinition.headerSort = false;
                columnDefinition.minWidth = 64;
                columnDefinition.frozen = true;
                columnDefinition.headerHozAlign = 'right';
                columnDefinition.download = false;
            } else {
                columnDefinition.sorter = 'string';
            }
            if (columnDefinition.field.includes('date')) {
                columnDefinition.sorter = (a, b) => {
                    return dateToTimestamp(a) - dateToTimestamp(b);
                };
            }
        });
        return [
            {
                title: 'ID',
                field: 'rowIndex',
                formatter: function (cell) {
                    const row = cell.getRow();
                    const table = row.getTable();
                    const page = table.getPage();
                    const pageSize = table.getPageSize();
                    const position = row.getPosition(true);
                    return (page - 1) * pageSize + position;
                },
                hozAlign: 'center',
                headerHozAlign: 'center',
                headerSort: false,
                frozen: true,
                width: 30,
                download: false,
            },
            ...definitions,
        ];
    };

    host.options_submissions[state] = {...options_submissions};
}

// ---------------------------------------------------------------------------
// Checkbox / pagination helpers
// ---------------------------------------------------------------------------

/**
 * @param {object} host
 * @param {string} state
 */
export function enableCheckboxSelection(host, state) {
    host.options_submissions[state].rowHeader = {
        formatter: 'rowSelection',
        titleFormatter: 'rowSelection',
        titleFormatterParams: {rowRange: 'visible'},
        headerSort: false,
        resizable: false,
        frozen: true,
        headerHozAlign: 'center',
        hozAlign: 'center',
    };
    host.options_submissions[state].headerVisible = true;
}

/**
 * @param {object} host
 * @param {string} state
 */
export function disableCheckboxSelection(host, state) {
    host.options_submissions[state].rowHeader = false;
    host.options_submissions[state].headerVisible = false;
}

/**
 * @param {object} host
 * @param {string} state
 */
export function disablePagination(host, state) {
    host.submissionTables[state].paginationEnabled = false;
}

/**
 * @param {object} host
 * @param {string} state
 */
export function enablePagination(host, state) {
    if (host.submissionTables[state].paginationEnabled === false) {
        host.submissionTables[state].paginationEnabled = true;
    }
}

// ---------------------------------------------------------------------------
// Column definitions helpers (schema-driven)
// ---------------------------------------------------------------------------

/**
 * Get the parsed form schema from the active form.
 * @param {object} activeForm
 * @returns {object|null}
 */
function getFormSchema(activeForm) {
    if (!activeForm.dataFeedSchema) return null;
    try {
        return JSON.parse(activeForm.dataFeedSchema);
    } catch (e) {
        console.log('Failed parsing json data', e);
        return null;
    }
}

/**
 * Get the initial column definitions from the submissions table.
 * @param {object} submissionsTable
 * @returns {Array}
 */
function getInitialColumnDefinitions(submissionsTable) {
    const columnComponents = submissionsTable.getColumns();
    if (!columnComponents || columnComponents.length === 0) return [];
    return columnComponents.map((column) => column.getDefinition());
}

/**
 * Check if the form schema is a catch-all (no explicit properties).
 * @param {object} formSchemaFields
 * @returns {boolean}
 */
function isCatchAllSchema(formSchemaFields) {
    return !formSchemaFields?.properties || Object.keys(formSchemaFields?.properties).length === 0;
}

/**
 * Get schema fields, handling visibility and localization.
 * @param {object} host
 * @param {object} formSchemaFields
 * @param {boolean} isCatchAll
 * @param {Array} initialColumnDefinitions
 * @param {string} state
 * @param {boolean} hasTagsColumn
 * @returns {Array}
 */
function getSchemaFields(
    host,
    formSchemaFields,
    isCatchAll,
    initialColumnDefinitions,
    state,
    hasTagsColumn,
) {
    const schemaFields = [];

    // Always include dateCreated at the beginning
    const dateCreatedDef = initialColumnDefinitions.find((def) => def.field === 'dateCreated');
    if (dateCreatedDef) {
        schemaFields.push(dateCreatedDef);
    }

    // Add tags column right after dateCreated if it exists
    if (hasTagsColumn) {
        const tagsField = initialColumnDefinitions.find((def) => def.field === 'tags');
        if (tagsField) {
            const tagsFieldClone = {...tagsField};
            tagsFieldClone.frozen = false;
            tagsFieldClone.formatter = 'html';
            if (tagsFieldClone.visible === undefined) {
                tagsFieldClone.visible = true;
            }
            schemaFields.push(tagsFieldClone);
        }
    }

    if (isCatchAll) {
        initialColumnDefinitions.forEach((def) => {
            if (
                def.field &&
                def.field !== 'rowIndex' &&
                def.field !== 'dateCreated' &&
                def.field !== 'tags' &&
                def.field !== 'identifier' &&
                def.field !== 'submissionId' &&
                def.field !== 'htmlButtons'
            ) {
                def.visible = true;
                schemaFields.push(def);
            }
        });
    } else {
        Object.keys(formSchemaFields.properties).forEach((field) => {
            const schemaField = formSchemaFields.properties[field];

            const definition = {
                field: field,
                visible: schemaField?.tableViewVisibleDefault ?? true,
                title: schemaField?.localizedName?.[host.lang] || field,
            };
            schemaFields.push(definition);
        });
    }
    return schemaFields;
}

/**
 * Get attachment fields from the form schema.
 * @param {object} formSchemaFields
 * @returns {Array}
 */
function getAttachmentFields(formSchemaFields) {
    const attachmentFields = [];
    if (formSchemaFields?.files && typeof formSchemaFields.files === 'object') {
        Object.keys(formSchemaFields.files).forEach((attachmentType) => {
            attachmentFields.push({
                field: `form_files-${attachmentType}`,
                title: attachmentType,
                visible: true,
            });
        });
    }
    return attachmentFields;
}

/**
 * Get system fields that should always be present.
 * When the form schema explicitly defines a field (e.g. "identifier"), skip it
 * here so it is only rendered once – via the schema-driven column list.
 * @param {Array} initialColumnDefinitions
 * @param {object|null} formSchemaFields
 * @returns {Array}
 */
function getSystemFields(initialColumnDefinitions, formSchemaFields) {
    const schemaProperties = formSchemaFields?.properties || {};
    return initialColumnDefinitions.filter(
        (def) =>
            (def.field === 'identifier' && !Object.hasOwn(schemaProperties, 'identifier')) ||
            def.field === 'submissionId' ||
            def.field === 'htmlButtons',
    );
}

/**
 * Set the initial visibility/order of submission table columns from the form schema.
 * @param {object} host
 * @param {string} state
 */
export function setDefaultSubmissionTableOrder(host, state) {
    const activeForm = host.forms.get(host.activeFormId);
    if (!activeForm) return;

    const formSchemaFields = getFormSchema(activeForm);

    // Set download folder name pattern from schema
    host.downloadFolderNamePattern =
        formSchemaFields?.submissionExport?.downloadFolderPattern || '';
    host.useSubFoldersForExports = formSchemaFields?.submissionExport?.subfolders ?? true;

    const submissionsTable = host.submissionTables[state];
    if (!submissionsTable) return;

    const initialColumnDefinitions = getInitialColumnDefinitions(submissionsTable);
    if (initialColumnDefinitions.length === 0) return;

    const hasTagsColumn = Array.isArray(host.availableTags) && host.availableTags.length > 0;
    const catchAll = isCatchAllSchema(formSchemaFields);

    const schemaFields = getSchemaFields(
        host,
        formSchemaFields,
        catchAll,
        initialColumnDefinitions,
        state,
        hasTagsColumn,
    );
    const attachmentFields = getAttachmentFields(formSchemaFields);
    const systemFields = getSystemFields(initialColumnDefinitions, formSchemaFields);

    // Ensure rowIndex is included
    const rowIndexDef = initialColumnDefinitions.find((def) => def.field === 'rowIndex');
    const defaultRowIndexDef = {
        title: 'ID',
        field: 'rowIndex',
        formatter: function (cell) {
            const row = cell.getRow();
            const table = row.getTable();
            const page = table.getPage();
            const pageSize = table.getPageSize();
            const position = row.getPosition(true);
            return (page - 1) * pageSize + position;
        },
        hozAlign: 'center',
        headerHozAlign: 'center',
        headerSort: false,
        frozen: true,
        width: 30,
        download: false,
    };

    // Separate htmlButtons to place it last
    const htmlButtonsDef = systemFields.find((def) => def.field === 'htmlButtons');
    const otherSystemFields = systemFields.filter((def) => def.field !== 'htmlButtons');

    // Build columns: rowIndex first, schema/attachments/system, htmlButtons last
    const schemaColumnDefinitions = [
        rowIndexDef || defaultRowIndexDef,
        ...schemaFields,
        ...attachmentFields,
        ...otherSystemFields,
    ];

    if (htmlButtonsDef) {
        schemaColumnDefinitions.push(htmlButtonsDef);
    }

    host.submissionsColumnsInitial[state] = cloneColumnDefinitions(schemaColumnDefinitions);
}

// ---------------------------------------------------------------------------
// Column definitions cloning
// ---------------------------------------------------------------------------

/**
 * Clone an array of column definitions so mutations don't affect the source.
 * @param {object[]} definitions
 * @returns {object[]}
 */
export function cloneColumnDefinitions(definitions) {
    if (!Array.isArray(definitions)) return [];
    return definitions.map((definition) => cloneColumnDefinition(definition));
}

/**
 * Clone a single column definition, including nested column groups.
 * @param {object} definition
 * @returns {object}
 */
function cloneColumnDefinition(definition) {
    if (!definition || typeof definition !== 'object') return definition;
    const clone = {...definition};
    if (Array.isArray(definition.columns)) {
        clone.columns = cloneColumnDefinitions(definition.columns);
    }
    return clone;
}
