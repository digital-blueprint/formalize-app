# Formalize activities

Here you can find the individual activities of the `formalize` app. If you want to use the whole app look at [formalize](https://github.com/digital-blueprint/formalize-app).

## Usage of an activity

You can use every activity alone. Take a look at our examples [here](https://github.com/digital-blueprint/formalize-app/tree/main/examples).

## Activities

### dbp-formalize-manage-forms

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://api-dev.tugraz.at"`
- `allow-list-frontend-keys` (optional): comma-separated list of `frontendKey` values; if set, only forms whose `frontendKey` matches one of the listed values are displayed; one key can match multiple forms (a group)
    - example `allow-list-frontend-keys="job-offer, ethics-proposal"`
- `deny-list-frontend-keys` (optional): comma-separated list of `frontendKey` values; forms whose `frontendKey` matches one of the listed values are hidden; one key can hide a whole group of forms
    - example `deny-list-frontend-keys="job-offer"`
- `hide-create-submission-button` (optional): hides the create submission button in the submissions view when set
    - example `hide-create-submission-button`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider

#### Slots

You use templates tags to inject slots into the activity.
These templates will be converted to div containers when the page is loaded and will not show up before that.

### dbp-formalize-render-from

An activity, hidden by the application, that renders forms for the user to fill out.

#### Attributes

- `routing-url`: identifier of the form to render
    - example `routing-url="demo-form"`
- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://api-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider

### dbp-formalize-submission-edit

An activity for editing submissions as generic items. The activity loads item modules from `modules.json` and uses the module's `getFormFrontendKey()` value to find matching forms in the Formalize API. If multiple matching forms are available, the activity first shows a form list so the user can choose which form to create submissions for.

#### Attributes

- `item-frontend-keys` (optional): comma-separated list of form `frontendKey` values to show in the activity. If set, only matching item modules are loaded and the form collection request is filtered with `whereFrontendKeyIn[]`.
    - example `item-frontend-keys="company"`
    - example `item-frontend-keys="company,event"`
- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://api-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider

For example, an application shell can expose the company item form with:

```html
<dbp-formalize-submission-edit
    subscribe="lang,entry-point-url,auth,base-path,item-frontend-keys"
    item-frontend-keys="company"></dbp-formalize-submission-edit>
```

If the activity shows "No matching item form is available.", verify that a form with the configured `frontendKey` exists and that the current user may read that form through the Formalize authorization rules.

#### Routing

The activity supports deep links through the app shell `routing-url` property:

- `/` shows the available item forms.
- `/<form-identifier>` lists items for the selected form.
- `/<form-identifier>/create` opens the create item form for the selected form.
- `/<form-identifier>/<submission-identifier>/edit` opens an existing item for editing.

The activity updates `routing-url` when the user opens a form, creates an item, edits an item, or returns to the form list. It does not reload forms or items just because the auth token refreshes; it only loads after the initial token becomes available or when `item-frontend-keys` changes.

## Design Note

To ensure a uniform and responsive design these activities should occupy 100% width of the window when the activities' width are under 768 px.

## Mandatory attributes

If you are not using the `provider-root` attribute to "terminate" all provider attributes
you need to manually add these attributes so that the topic will work properly:

```html
<dbp-formalize auth requested-login-status analytics-event entry-point-url></dbp-formalize>
```
