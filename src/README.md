# formalize Activities

Here you can find the individual activities of the `formalize` App. If you want to use the whole app look at [formalize](https://gitlab.tugraz.at/dbp/formalize/formalize).

## Activities

### dbp-formalize-show-registrations

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://api-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider

#### Slots

You use templates tags to inject slots into the activity.
These templates will be converted to div containers when the page is loaded and will not show up before that.

##### description

The content of this slot will be shown below the headline and can be used to provide
further information about the page.

Example:

```html
<dbp-formalize-show-registrations lang="de">
  <template slot="description">
    <dbp-translated subscribe="lang">
      <div slot="de">
        Verwalten Sie Kursanmeldungen.
      </div>
      <div slot="en">
        Manage course registrations.
      </div>
    </dbp-translated>
  </template>
</dbp-formalize-show-registrations>
```

##### additional-information

The content of this slot will be shown below the other text and can be used to provide
further information about the activity.

Example:

```html
<dbp-formalize-show-registrations lang="de">
  <template slot="additional-information">
    <dbp-translated subscribe="lang">
      <div slot="de">
          Hier steht weitere Information.
      </div>
      <div slot="en">
          You'll find more information here.
      </div>
    </dbp-translated>
  </template>
</dbp-formalize-show-registrations>
```

## Design Note

To ensure a uniform and responsive design these activities should occupy 100% width of the window when the activities' width are under 768 px.

## Mandatory attributes

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