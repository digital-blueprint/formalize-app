# Formalize Application

[GitLab Repository](https://gitlab.tugraz.at/dbp/formalize/formalize) |
[npmjs package](https://www.npmjs.com/package/@dbp-topics/formalize) |
[Unpkg CDN](https://unpkg.com/browse/@dbp-topics/formalize/)

## Local development

```bash
# get the source
git clone git@gitlab.tugraz.at:dbp/formalize/formalize.git
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

If you want to install the DBP formalize App in a new folder `formalize-app` you can call:

```bash
npx @digital-blueprint/cli install-app formalize formalize-app /
```

**Warning:** There may be issues when you run these commands as root user, best use a non-root user, like `www-data`.
To do this you can for example open a shell with `runuser -u www-data -- bash`.

Afterwards you can point your Apache web-server to `formalize-app/public`.

Make sure you are allowing `.htaccess` files in your Apache configuration.

Also make sure to add all of your resources you are using (like your API and Keycloak servers) to the
`Content-Security-Policy` in your `formalize-app/public/.htaccess`, so the browser allows access to those sites.

You can also use this app directly from the [Unpkg CDN](https://unpkg.com/browse/@dbp-topics/formalize/)
for example like this: [dbp-formalize/index.html](https://gitlab.tugraz.at/dbp/formalize/formalize/-/tree/main/examples/dbp-formalize/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

### Update app

If you want to update the DBP formalize App in the current folder you can call:

```bash
npx @digital-blueprint/cli update-app formalize
```

**Warning:** There may be issues when you run these commands as root user, best use a non-root user, like `www-data`.
To do this you can for example open a shell with `runuser -u www-data -- bash`.

