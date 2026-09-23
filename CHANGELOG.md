# Changelog

## Unreleased (v1.3.1)

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
