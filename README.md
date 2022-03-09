# Formalize Application

[GitLab Repository](https://gitlab.tugraz.at/dbp/formalize/formalize)

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
