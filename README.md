# dbp-starter-app

[GitLab Repository](https://gitlab.tugraz.at/dbp/web-components/dbp-starter-app)

## Local development

```bash
# get the source
git clone git@gitlab.tugraz.at:dbp//web-components/dbp-starter-app.git
cd checkin
git submodule update --init

# install dependencies
yarn install

# constantly build dist/bundle.js and run a local web-server on port 8001 
yarn run watch

# same as watch, but with babel, terser, etc active -> very slow
yarn run watch-full

# run tests
yarn test
```

Jump to <https://localhost:8001> and you should get a Single Sign On login page.

## Browser versions

These browser versions should work with the application.

- Firefox 67+ (2019-05)
- Chrome 67+ (2018-05)
- Edge 79+ (2020-01)
- Safari 11.1+ (2018-04)
- Opera 64+ (2019-10)
- iOS Safari 12+/iOS 12+ (2018-09)

We use a row of newer features:

- https://caniuse.com/#feat=custom-elementsv1
- https://caniuse.com/#feat=es6-module-dynamic-import
- https://caniuse.com/#feat=shadowdomv1
- https://caniuse.com/#feat=mdn-javascript_statements_import_meta
- https://caniuse.com/#feat=es6-module
- https://caniuse.com/#feat=async-functions

# Get started

To create your own app copy this Repository.

## The construct

### /assets/*

The main html construct is based in the asset folder: `dbp-frontend-starter-app.html.ejs`
You can change here favicons, the color variables, fonts and the outer html construct.

- To get started rename this file to `<your-app-name>.html.ejs`

For favicon support in multiple browsers there exist one folder and twi other files. The icons - in different size - are based in the folder `icon`. The file `dbp-frontend-starter-app.browserconfig.xml.ejs` is for styled windows tiles. `manifest.json` tells the browser information about the website on different device. (short name, name, start url, icons, colors ...)

- Change `dbp-frontend-starter-app.browserconfig.xml.ejs` to `<your-app-name>.browserconfig.xml.ejs`
    - (optional) Change the TitleColor
- In `manifest.json` change the short_name, the name, the starter url and the path to the icon folder
    - (optional) Change the background_color and/or the theme_color

The main structer - the topic - from the application is based in `dbp-frontend-starter-app.topic.metadata.json.ejs`
For more information about the structure look at: https://gitlab.tugraz.at/dbp/web-components/frontend-docs/-/blob/master/components.md

- Change the ``name`` in german and english (or add another language if you support one)
- Change the ```short_name```
- Add a ``description`` of your App 
- Change the ``routong_name``
- Add the path of your your activities.metadata.json

The activity metadatas should be also based in the assets folder. The file ``dbp-starter-activity.metadata.json`` is an example for an activity. It is contains basic description of an acitivty.

- Copy or rename the file ``dbp-starter-activity.metadata.json`` to ``<your-activity-name>.metadata.json``
- Change ```element``` to your element name.
- Change the ``module_src`` - this is the file where the code of your activity is based.
- Change the ``routing_name``, ``name``, ``short_name`` and add a ``description``,

### /src/*

The main logic is based in the `src` folder.

There are at least two files. One for a topic, one or more for an activity and some other files with e.g.: helper functions. (In our case ``i18n.js`` for the translation).

``dbp-frontend-starter-app.js`` is the entry point of the App. If you want to use it with the app [shell](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master/packages/app-shell) ():

- Rename the file ``dbp-frontend-starter-app.js`` to ``<your-app-name.js``
- Change the ``dbp-frontend-starter-app`` string to ``<your-app-name>``

``dbp-starter-activity.js`` is one activity of the topic. The main code of the activity is based there.

- Copy or rename the file ``dbp-starter-activity.js`` to ``<your-activity-name>.js`` (the name given in ``<your-activity-name>.metadata.json``: ``module_src``)

The class in this file is based on [lit-elements](https://lit-element.polymer-project.org/)

- Change the class name from ``StarterActivity`` to your prefered class name.
- Change in the last line ``commonUtils.defineCustomElement('dbp-starter-activity', StarterActivity);`` 
    - The first string ``dbp-starter-activity`` is the given ``element`` name in ``dbp-starter-activity.metadata.json``
    - The second string ``StarterActivity`` is your given class name in the point above.

There is another folder `i18n`. 
In this folder there is the whole translation based. You have subfolder for your different languages. In these subfolder you have a ``translation.json`` file where you can bin strings to your translation keys. For further information look at: https://www.i18next.com/



## Design

This source is delivered with a clean brandable design. If you want your own design fork the repo [toolkit](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/tree/master), make your own appshell and change vars in [common/styles.js](https://gitlab.tugraz.at/dbp/web-components/toolkit/-/blob/master/packages/common/styles.js)

The style for the activities itself, can be changed in ````src/<your-activity-name>.js``` in the function ```static get styles()```.

For TU Graz purposes go to `<your-app-name>.html.ejs` and simple delete the attributes `shell-name`, `shell-subname` and `no-brand` in line 111-113.

