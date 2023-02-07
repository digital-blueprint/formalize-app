# Formalize Application

[GitHub Repository](https://github.com/digital-blueprint/formalize-app) |
[npmjs package](https://www.npmjs.com/package/@digital-blueprint/formalize-app) |
[Unpkg CDN](https://unpkg.com/browse/@digital-blueprint/formalize-app/) |
[Formalize Bundle](https://github.com/digital-blueprint/relay-formalize-bundle)

Management of form entries that have been created via external systems.

## Prerequisites

- You need the [API server](https://gitlab.tugraz.at/dbp/relay/dbp-relay-server-template) running
- You need the [DbpRelayFormalizeBundle](https://github.com/digital-blueprint/relay-formalize-bundle) for the API server to persist and fetch submissions

## Local development

```bash
# get the source
git clone git@github.com:digital-blueprint/formalize-app.git
cd formalize
git submodule update --init

# install dependencies
yarn install

# constantly build dist/bundle.js and run a local web-server on port 8001 
yarn run watch

# run tests
yarn test
```

Jump to <https://localhost:8001>, and you should get a Single Sign On login page.

## Using this app as pre-built package

### Install app

If you want to install the dbp formalize app in a new folder `formalize-app` you can call:

```bash
npx @digital-blueprint/cli install-app formalize formalize-app /
```

**Warning:** There may be issues when you run these commands as root user, best use a non-root user, like `www-data`.
To do this you can for example open a shell with `runuser -u www-data -- bash`.

Afterwards you can point your Apache web-server to `formalize-app/public`.

Make sure you are allowing `.htaccess` files in your Apache configuration.

Also make sure to add all of your resources you are using (like your API and Keycloak servers) to the
`Content-Security-Policy` in your `formalize-app/public/.htaccess`, so the browser allows access to those sites.

You can also use this app directly from the [Unpkg CDN](https://unpkg.com/browse/@digital-blueprint/formalize-app/)
for example like this: [dbp-formalize/index.html](https://github.com/digital-blueprint/formalize-app/tree/main/examples/dbp-formalize/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

### Update app

If you want to update the dbp formalize app in the current folder you can call:

```bash
npx @digital-blueprint/cli update-app formalize
```

**Warning:** There may be issues when you run these commands as root user, best use a non-root user, like `www-data`.
To do this you can for example open a shell with `runuser -u www-data -- bash`.

## Activities

This app has the following activity:

- `dbp-show-registrations`

You can find the documentation of the activity in the [formalize activities documentation](https://github.com/digital-blueprint/formalize-app/tree/main/src).

## Adapt app

### Functionality

You can add multiple attributes to the `<dbp-formalize>` tag.

| attribute name | value | description |
|----------------|-------| ------------|
| `provider-root` | Boolean | [app-shell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/app-shell) |
| `lang`         | String | [language-select](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/language-select) | 
| `entry-point-url` | String | [app-shell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/app-shell) |
| `keycloak-config` | Object | [app-shell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/app-shell) |
| `base-path` | String | [app-shell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/app-shell) |
| `src` | String | [app-shell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/app-shell) |
| `html-overrides` | String | [common](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/common) |
| `themes` | Array | [theme-switcher](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/theme-switcher) |
| `darkModeThemeOverride` | String | [theme-switcher](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/theme-switcher) |

#### Mandatory attributes

If you are not using the `provider-root` attribute to "terminate" all provider attributes
you need to manually add these attributes so that the topic will work properly:

```html
<dbp-formalize
    auth
    requested-login-status
    analytics-event
>
</dbp-formalize>
```

### Design

For frontend design customizations, such as logo, colors, font, favicon, and more, take a look at the [theming documentation](https://dbp-demo.tugraz.at/dev-guide/frontend/theming/).

## "dbp-formalize" slots

These are common slots for the app-shell. You can find the documentation of these slots in the [app-shell documentation](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/app-shell).
For the app specific slots take a look at the [formalize activities](https://github.com/digital-blueprint/formalize-app/tree/main/src).

## Notice

We are using autogenerated table header for creating the submission tables. 

A [get query](https://api-demo.tugraz.at/#operations-Formalize-getFormalizeSubmissionItem) is made to dbp-relay.
This returns a json. This json contains various data of the previous posted submission.

To post a form to the api, take a look at: [operations-Formalize-postFormalizeSubmissionCollection](https://api-demo.tugraz.at/#operations-Formalize-postFormalizeSubmissionCollection).
This post contains the name of the form "form" and the data of the form "dataFeedElement". the data must be a valid json as a string, i.e. quotation marks must be escaped with a "\".
The data keys of forms with the same "form" name must be consistent, otherwise the new keys are not displayed and no data would be displayed in the old key table header.