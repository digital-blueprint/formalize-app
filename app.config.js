export default {
    test: {
        basePath: '/',
        entryPointURL: 'http://test',
        keyCloakBaseURL: 'https://test',
        keyCloakRealm: '',
        keyCloakClientId: '',
        matomoUrl: '',
        matomoSiteId: -1,
    },
    local: {
        basePath: '/dist/',
        entryPointURL: 'http://127.0.0.1:8000',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'auth-dev-mw-frontend-local',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
    },
    development: {
        basePath: '/apps/starter-app/',
        entryPointURL: 'https://api-dev.tugraz.at',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'dbp-starter-app',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
    },
    demo: {
        basePath: '/apps/starter-app/',
        entryPointURL: 'https://api-demo.tugraz.at',
        keyCloakBaseURL: 'https://auth-demo.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'dbp-starter-app',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
    },
    production: {
        basePath: '/',
        entryPointURL: 'https://api.tugraz.at',
        keyCloakBaseURL: 'https://auth.tugraz.at/auth',
        keyCloakRealm: 'tugraz',
        keyCloakClientId: 'dbp-starter-app',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
    },
};