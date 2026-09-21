# Changelog

## Unreleased (v1.3.1)

- Manage Forms activity: only show forms whose `grantedFormActions` contain `manage`; update, delete, or submission collection permissions alone no longer make a form visible
- Manage Forms activity: the open-submissions button in the forms table now takes its `aria-label` from the new `manage-forms.open-forms-aria` key instead of reusing the tooltip key, so apps can shorten the tooltip through a translation override without losing the form name from the accessible name
- Manage Fields activity: the table row action buttons (open form, create entry, edit entry) now have row-specific `aria-label`s naming the form or entry, while the tooltip stays short, so screen reader users can tell the repeated buttons apart
- Attachment lists in forms and in the submission detail popup: the view, download and delete buttons now also expose the file name as their `aria-label`, the submission detail popup got the file name tooltips that forms already had, and the button icons are marked `aria-hidden`
- Attachment button labels now use unescaped interpolation, so file names containing `&` or `'` are no longer shown as HTML entities
- Manage Forms activity: the icon-only search button now carries its label itself instead of on the inner icon, and its `aria-label` names the table (drafts or submitted) it searches
- Manage Forms activity: marked the decorative chevron and reset-search icons as `aria-hidden` instead of giving them labels that duplicated the adjacent controls
- Fixed `GetDetailsButton` and `GetSubmissionLink` translating their already translated `title` and `aria-label` a second time, which truncated any label containing a colon
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
