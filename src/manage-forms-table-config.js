// @ts-nocheck
/**
 * Table configuration helpers for the Manage Forms activity.
 *
 * Contains everything related to tabulator table column setup,
 * visibility, ordering, localStorage persistence, and submission
 * form options.
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
    let lang_submissions = {
        en: {columns: {}},
        de: {columns: {}},
    };

    const options_submissions = {
        langs: lang_submissions,
        autoColumns: 'full',
        rowHeight: 64,
        layout: 'fitDataStretch',
        layoutColumnsOnNewData: true,
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
        placeholder: 'No Submission data available',
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
                columnDefinition.formatter = 'html';
                columnDefinition.hozAlign = 'right';
                columnDefinition.vertAlign = 'middle';
                columnDefinition.headerSort = false;
                columnDefinition.minWidth = 64;
                columnDefinition.frozen = true;
                columnDefinition.headerHozAlign = 'right';
                columnDefinition.download = false;
                columnDefinition.titleFormatter = () => {
                    let columnSettingsButton = host.createScopedElement(
                        'dbp-formalize-column-settings-button',
                    );
                    columnSettingsButton.setAttribute('subscribe', 'lang');
                    columnSettingsButton.addEventListener('click', () => {
                        host.getSubmissionsPage()?.openColumnOptionsModal(state);
                    });
                    return columnSettingsButton;
                };
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
            if (schemaField.tableViewVisibleDefault !== undefined) {
                host.isResetButtonDisabled = {...host.isResetButtonDisabled, [state]: false};
            }

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
 * @param {Array} initialColumnDefinitions
 * @returns {Array}
 */
function getSystemFields(initialColumnDefinitions) {
    return initialColumnDefinitions.filter(
        (def) =>
            def.field === 'identifier' ||
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

    host.isResetButtonDisabled = {...host.isResetButtonDisabled, [state]: true};

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
    const systemFields = getSystemFields(initialColumnDefinitions);

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
    host.submissionsColumns = {
        ...host.submissionsColumns,
        [state]: cloneColumnDefinitions(host.submissionsColumnsInitial[state]),
    };
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

// ---------------------------------------------------------------------------
// Column visibility / ordering
// ---------------------------------------------------------------------------

/**
 * Reset column settings to the initial schema-derived defaults.
 * @param {object} host
 * @param {string} state
 */
export function resetSettings(host, state) {
    host.submissionsColumns = {
        ...host.submissionsColumns,
        [state]: cloneColumnDefinitions(host.submissionsColumnsInitial[state]),
    };
}

/**
 * Set all non-frozen columns visible or hidden.
 * @param {object} host
 * @param {string} state
 * @param {'hide'|'show'} action
 */
export function toggleAllColumns(host, state, action) {
    const updated = host.submissionsColumns[state].map((column) => {
        if (column.frozen) return column;
        return {...column, visible: action !== 'hide'};
    });
    host.submissionsColumns = {...host.submissionsColumns, [state]: updated};
}

/**
 * Toggle the visible flag for a specific column.
 * @param {object} host
 * @param {object} column
 * @param {string} state
 */
export function toggleVisibility(host, column, state) {
    const fieldName = column.field;
    const updated = host.submissionsColumns[state].map((col) => {
        if (col.field === fieldName) {
            return {...col, visible: !col.visible};
        }
        return col;
    });
    host.submissionsColumns = {...host.submissionsColumns, [state]: updated};
}

/**
 * Swap two adjacent column entries to reorder table columns.
 * @param {object} host
 * @param {object} column
 * @param {string} state
 * @param {'up'|'down'} direction
 */
export function moveHeader(host, column, state, direction) {
    const fieldName = column.field;
    const cols = [...host.submissionsColumns[state]];
    const index = cols.findIndex((col) => col.field === fieldName);
    const delta = direction === 'up' ? -1 : 1;

    const temp = cols[index];
    cols[index] = cols[index + delta];
    cols[index + delta] = temp;

    host.submissionsColumns = {...host.submissionsColumns, [state]: cols};
}

/**
 * Apply the current `submissionsColumns[state]` to the tabulator table.
 * @param {object} host
 * @param {string} state
 */
export function updateSubmissionTable(host, state) {
    const table = host.submissionTables[state];
    table.setColumns(host.submissionsColumns[state]);
}

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

/**
 * Restore submission table settings from localStorage.
 * @param {object} host
 * @param {string} state
 * @returns {boolean} true if settings were successfully restored.
 */
export function restoreSubmissionTableSettings(host, state) {
    if (!host.storeSession || !host.isLoggedIn()) return false;

    let optionsString = localStorage.getItem(
        `dbp-formalize-tableoptions-${host.activeFormName}-${state}-${host.auth['user-id']}`,
    );

    try {
        let options = JSON.parse(optionsString);
        if (!options) return false;

        const table = host.submissionTables[state];
        let columns = table.getColumns();
        if (columns.length === 0) return false;

        const columnDefinitions = columns.map((column) => column.getDefinition());

        // Add back frozen columns
        const rowIndexDef = columnDefinitions.find((def) => def.field === 'rowIndex');
        const htmlButtonsDef = columnDefinitions.find((def) => def.field === 'htmlButtons');

        // Get all columns with formatter or sorter functions
        const formatterDefinitions = columnDefinitions.filter((columnDefinition) => {
            if (
                columnDefinition.formatter &&
                (typeof columnDefinition.formatter === 'function' ||
                    typeof columnDefinition.titleFormatter === 'function')
            ) {
                return true;
            }
            if (columnDefinition.sorter && typeof columnDefinition.sorter === 'function') {
                return true;
            }
        });

        // Add back formatter, sorter functions, and current translated title
        options.forEach((storedColumnDefinition) => {
            const columnWithFormatter = formatterDefinitions.find(
                (columnDefinition) => columnDefinition.field === storedColumnDefinition.field,
            );

            if (columnWithFormatter?.formatter) {
                storedColumnDefinition.formatter = columnWithFormatter.formatter;
            }
            if (columnWithFormatter?.titleFormatter) {
                storedColumnDefinition.titleFormatter = columnWithFormatter.titleFormatter;
            }
            if (columnWithFormatter?.sorter) {
                storedColumnDefinition.sorter = columnWithFormatter.sorter;
            }

            // Always use the current (translated) title from submissionsColumnsInitial
            const initialDef = host.submissionsColumnsInitial[state]?.find(
                (def) => def.field === storedColumnDefinition.field,
            );
            if (initialDef?.title) {
                storedColumnDefinition.title = initialDef.title;
            }
        });

        host.submissionsColumns = {
            ...host.submissionsColumns,
            [state]: [rowIndexDef, ...options, htmlButtonsDef],
        };
        table.setColumns(host.submissionsColumns[state]);

        console.log(`this.submissionsColumns[${state}]`, host.submissionsColumns[state]);
    } catch (e) {
        console.error('Failed parsing stored table options', e);
        host.sendErrorAnalyticsEvent('[restoreSubmissionTableSettings]', 'WrongResponse', e);
        return false;
    }
    return true;
}

/**
 * Store submission table settings to localStorage.
 * @param {object} host
 * @param {string} state
 */
export function storeSubmissionTableSettings(host, state) {
    if (!host.storeSession || !host.isLoggedIn()) return;

    const publicId = host.auth['user-id'];
    const serializableColumns = host.submissionsColumns[state]
        .filter((column) => column.frozen !== true)
        .map(({title, ...rest}) => rest);

    localStorage.setItem(
        `dbp-formalize-tableoptions-${host.activeFormName}-${state}-${publicId}`,
        JSON.stringify(serializableColumns),
    );
}

/**
 * Delete submission table settings from localStorage.
 * @param {object} host
 * @param {string} state
 */
export function deleteSubmissionTableSettings(host, state) {
    if (!host.storeSession || !host.isLoggedIn()) return;

    const publicId = host.auth['user-id'];
    localStorage.removeItem(
        `dbp-formalize-tableoptions-${host.activeFormName}-${state}-${publicId}`,
    );
}
