# Changelog

## Unreleased (v1.3.1)

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

## v1.3.0

- new release

## v1.2.2

- Various improvements for the "accessible-exams-form" form
- Only show the "show registrations" activity if the user has the "ROLE_FORMALIZE_FORM_SUBMISSION_READER" frontend role

## v1.1.0

- update welcome message
