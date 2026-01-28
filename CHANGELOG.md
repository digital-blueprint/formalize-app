# Changelog

## Unreleased

- Format base course teaching term as returned by the Public REST API to match the legacy API format (e.g. "Winter Term 2023/24")
- Update toolkit and adapt to the new version of PersonSelect

- Extracted common form functionality from `ethicsCommissionForm` to `BaseFormElement`
- Standardized form UI: buttons, tags, submission info, and validation indicators across all forms
- Unified permission-based button state management
- Centralized conditional field handling and tag management
- Translation keys: Moved common UI to `base-object.*` namespace

## v1.3.0

- new release

## v1.2.2

- Various improvements for the "accessible-exams-form" form
- Only show the "show registrations" activity if the user has the "ROLE_FORMALIZE_FORM_SUBMISSION_READER" frontend role

## v1.1.0

- update welcome message
