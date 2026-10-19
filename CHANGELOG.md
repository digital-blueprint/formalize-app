# Changelog

## Unreleased

- Forms overview and form submissions: removed "Berechtigungen bearbeiten"/"Edit permissions" from the multi-actions dropdown (task #76018). Permissions can now only be edited for a single form or submission in its row actions menu. The forms overview action `edit-permission` now has the `row` placement, and the unused `isEditSubmissionPermissionEnabled` state was removed from `FormSubmissions` and `ManageFormSubmissionsPage`
- Forms overview and form submissions: repaired the multi-actions dropdown (task #76017). The dropdown is no longer cut to a fixed width in the submission tables, so the "Mehrfachaktionen"/"Multi-actions" label doesn't wrap anymore. In the forms overview the dropdown is now always active, unless none of its actions is allowed. If bulk deletion is enabled (`enable-forms-bulk-delete`), it offers "Delete all ([n])" for all deletable forms when no form is selected and "Delete selected ([n])" when forms are selected, like in the submission tables. The action context passed to overview actions now also contains `allItems`
- Forms overview and form submissions: the multi-actions dropdown now only contains the actions that can be applied to multiple selected rows (forms: delete; submissions: tagging and delete). The single-item actions "Edit" and "Edit submission" were moved to the row actions menu
- Forms overview, form submissions and manage fields: the row action buttons were replaced by a row actions (kebab) menu that contains all actions that are possible for this single row. Forms: open submissions, website links, edit, edit permissions and delete (if bulk deletion is enabled), plus module actions such as the job offer preview. Submissions: quick view, detailed view, edit, edit permissions and delete, depending on the grants of the submission. Manage fields entries: edit and delete. The menu is shown as popover, so it isn't clipped by the table
- Forms overview, form submissions and manage fields: renamed the "Aktionen"/"Actions" dropdown above the tables to "Mehrfachaktionen"/"Multi-actions", because it contains the actions for the selected rows
- Forms overview: removed the hardcoded job-offer employer column (including the hardcoded university name); form modules can now add their own overview columns with `BaseObject.getManageFormsOverviewColumns()`. The manage-forms activities accept a `university-short-name` attribute, which modules can use for their column values
- Forms overview: fixed the employer column not being shown when it is enabled before the first render, and rebuild the column labels after the translation overrides are loaded, so overridden column titles are used
- Manage Forms activity (task #75970): replaced the "Website links" table column with a `link` row action that opens a "Website links" modal; each link is shown with its label, a description and the full URL in a read-only field, plus buttons to copy it and to open it in a new tab
- v1.4.1 follow-up to task #74995, comment #12061: restore submission management and submission/detail routes in Manage Forms; prominently offer copyable form-instance and submission website links. Rename Manage Submissions to My form submissions and remove its create-submission entry point. Existing activity URLs remain compatible.
- Split the Manage Forms activity into two activities: `dbp-formalize-manage-forms` (routing name `manage-forms`) for managing forms, permissions and their submissions, and the new My Form Submissions activity `dbp-formalize-manage-submissions` (routing name `manage-submissions`) for readable submissions, whether own, shared or accessible through collection-level permissions
- Manage Forms activity: only list forms the user has an edit right for (`grantedFormActions` contains `update` or `manage`); the edit action is now also available as a table row action; submission routes and the `hide-create-submission-button` and `enable-submission-permission-editing` options remain available
- v1.4.1 correction to task #74995: use the backend `whereMayReadSubmissions=true` filter directly to include forms with readable own/shared submissions or access to all submissions, including empty forms with collection-level access. Remove extra frontend ownership/grant filtering and the failing authorization grants request; submission lists rely on backend authorization.
- Extracted the shared parts into web components: `ManageFormsOverviewPage` now owns the forms table, its search, selection, actions dropdown and URL state, and the new `FormSubmissions` component contains the submission lists, details modal, export, deletion, tagging and submission permission editing of a form; `ManageFormsActivityBase` contains the shared module and form loading of both activities
- Overview actions: split the built-in actions into `createDefaultManageFormsOverviewActions()` (open submissions, website links, delete, edit, edit permissions) and `createDefaultManageSubmissionsOverviewActions()` (open submissions); the action context passed to `BaseObject.getManageFormsOverviewActions()` now contains the `activity` name
- Links to a form's submissions (e.g. after submitting a form) now point to the Manage Submissions activity (`getFormManageFormsUrl()` was renamed to `getFormManageSubmissionsUrl()`)

## v1.4.2

- Ethics form make `coApplicants` field optional

## v1.4.0

- Fixed course-selector prefilling and saved stable course identifiers.
- Fixed Personal data prefilling without overwriting existing submissions.
- Manage Forms activity: centralized forms-overview actions in shared descriptors containing placement, visibility, permission, labels, and handlers; the table rows and Actions dropdown now consume the same definitions, allowing modules to move or duplicate actions without additional component properties
- Manage Forms activity: replaced the module-specific overview action icon hook with `BaseObject.getManageFormsOverviewActions()`, allowing modules to modify, reorder, remove, or append table row actions; handlers receive the latest form data when invoked
- Edit form dialog: added two visually hidden skip links at the end of the form content that move focus to the primary save button and to the dialog's close button, both of which sit in the pinned header and therefore come before the form in the tab order; keyboard and screen reader users no longer have to tab back through the whole form to save or abort. The save link reuses the button's own label (`edit-form-dialog.skip-to-save-button`) so it stays correct in create and edit mode and with translation overrides, and it falls back to the action bar while the button is still disabled. Requires the toolkit's new `Modal.focusCloseButton()`
- Manage Forms activity: the open-submissions button in the forms table now takes its `aria-label` from the new `manage-forms.open-forms-aria` key instead of reusing the tooltip key, so apps can shorten the tooltip through a translation override without losing the form name from the accessible name
- Manage Fields activity: the table row action buttons (open form, create entry, edit entry) now have row-specific `aria-label`s naming the form or entry, while the tooltip stays short, so screen reader users can tell the repeated buttons apart
- Attachment lists in forms and in the submission detail popup: the view, download and delete buttons now also expose the file name as their `aria-label`, the submission detail popup got the file name tooltips that forms already had, and the button icons are marked `aria-hidden`
- Attachment button labels now use unescaped interpolation, so file names containing `&` or `'` are no longer shown as HTML entities
- Manage Forms activity: the icon-only search button now carries its label itself instead of on the inner icon, and its `aria-label` names the table (drafts or submitted) it searches
- Manage Forms activity: marked the decorative chevron and reset-search icons as `aria-hidden` instead of giving them labels that duplicated the adjacent controls
- Fixed `GetDetailsButton` and `GetSubmissionLink` translating their already translated `title` and `aria-label` a second time, which truncated any label containing a colon
- Manage Forms activity: only show forms when `grantedFormActions` contains `update`, `delete`, or `manage`, or `grantedSubmissionCollectionActions` contains `read` or `manage`
- Manage Forms and Manage Fields activities: remember the selected pagination size per user and browser; explicit Manage Forms URL pagination continues to take precedence
- Manage Forms activity: synchronize the forms overview search and pagination and both submission-list filters and pagination with `routing-url`; URL state is restored after loading table data and supports browser history and shareable links
- Manage Forms activity: add mount-independent submission detail URLs that open the submission popup from shareable links and return to the form URL when closed
- Prepare for update to formalize API v0.5.36 where `create_submissions` permission is moved from submission collection
  permissions to form permissions
- Remove unused methods
- Manage Forms activity: added bulk deletion of selected forms in the forms overview table, gated per form by its `grantedActions` (delete/manage); added `apiDeleteForm` (DELETE `/formalize/forms/{identifier}`); the feature is opt-in via the new `enable-forms-bulk-delete` attribute and disabled by default
- Manage Forms activity: add permission editing for multiple selected forms and submissions, make submission permission editing opt-in via `enable-submission-permission-editing`, and gate actions using `grantedActions`
- CourseSelect: only offer courses from the previous, current, and next semester
- Format base course teaching term as returned by the Public REST API to match the legacy API format (e.g. "Winter Term 2023/24")
- Update toolkit and adapt to the new version of PersonSelect
- Extracted common form functionality from `ethicsCommissionForm` to `BaseFormElement`
- Standardized form UI: buttons, tags, submission info, and validation indicators across all forms
- Unified permission-based button state management
- Centralized conditional field handling and tag management
- Translation keys: Moved common UI to `base-object.*` namespace
- Manage Forms activity: added `allow-list-frontend-keys` and `deny-list-frontend-keys` attributes to filter visible forms by `frontendKey`; a single key can match multiple forms, so a group of related forms can be shown or hidden at once; attributes accept comma-separated values in HTML and are parsed to arrays internally
- Manage Forms activity: use module schema labels when persisted submission schemas lack `localizedName`, support localized attachment column names, and translate the submission ID column

## v1.3.0

- new release

## v1.2.2

- Various improvements for the "accessible-exams-form" form
- Only show the "show registrations" activity if the user has the "ROLE_FORMALIZE_FORM_SUBMISSION_READER" frontend role

## v1.1.0

- update welcome message
