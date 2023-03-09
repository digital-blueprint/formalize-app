import path from 'path';
import url from 'url';
import {globSync} from 'glob';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import serve from 'rollup-plugin-serve';
import urlPlugin from '@rollup/plugin-url';
import license from 'rollup-plugin-license';
import del from 'rollup-plugin-delete';
import emitEJS from 'rollup-plugin-emit-ejs';
import {getBabelOutputPlugin} from '@rollup/plugin-babel';
import {
    getPackagePath,
    getBuildInfo,
    generateTLSConfig,
    getDistPath,
} from './vendor/toolkit/rollup.utils.js';

let appName = 'dbp-formalize';
const pkg = require('./package.json');
const appEnv = typeof process.env.APP_ENV !== 'undefined' ? process.env.APP_ENV : 'local';
const watch = process.env.ROLLUP_WATCH === 'true';
const buildFull = (!watch && appEnv !== 'test') || process.env.FORCE_FULL !== undefined;
let useTerser = buildFull;
let useBabel = buildFull;
let checkLicenses = buildFull;
let treeshake = buildFull;
let useHTTPS = true;

// if true, app assets and configs are whitelabel
let whitelabel;
// path to non whitelabel assets and configs
let formalizePath;
// development path
let devPath = 'assets_local/';
// deployment path
let deploymentPath = '../';

// set whitelabel bool according to used environment
if ((appEnv.length > 6 && appEnv.substring(appEnv.length - 6) == "Custom") || appEnv == "demo" || appEnv == "production") {
    whitelabel = false;
} else {
    whitelabel = true;
}

// load devconfig for local development if present
let devConfig = require("./app.config.json");
try {
    console.log("Loading " + "./" + devPath + "app.config.json ...");
    devConfig = require("./" + devPath + "app.config.json");
    formalizePath = devPath;
} catch(e) {
    if (e.code == "MODULE_NOT_FOUND") {
        console.warn("no dev-config found, try deployment config instead ...");

        // load devconfig for deployment if present
        try {
            console.log("Loading " + "./" + deploymentPath + "app.config.json ...");
            devConfig = require("./" + deploymentPath + "app.config.json");
            formalizePath = deploymentPath;
        } catch(e) {
            if (e.code == "MODULE_NOT_FOUND") {
                console.warn("no dev-config found, use default whitelabel config instead ...");
            } else {
                throw e;
            }
        }
    } else {
        throw e;
    }
}

// decide on which configs to use
let config;
if ((devConfig != undefined && appEnv in devConfig)) {
    // choose devConfig if available
    if (devConfig != undefined && appEnv in devConfig) {
        config = devConfig[appEnv];
    }
} else if (appEnv === 'test') {
    config = {
        basePath: '/',
        entryPointURL: 'https://test',
        keyCloakBaseURL: 'https://test',
        keyCloakClientId: '',
        keyCloakRealm: '',
        matomoUrl: '',
        matomoSiteId: -1,
        searchQRString: '',
        universityShortName: 'Test',
        universityFullName: 'Test Environment',
    };
} else {
    console.error(`Unknown build environment: '${appEnv}', use one of '${Object.keys(devConfig)}'`);
    process.exit(1);
}

if (watch) {
    config.basePath = '/dist/';
}

function getOrigin(url) {
    if (url) return new URL(url).origin;
    return '';
}

config.CSP = `default-src 'self' 'unsafe-eval' 'unsafe-inline' \
    ${getOrigin(config.matomoUrl)} ${getOrigin(config.keyCloakBaseURL)} ${getOrigin(
    config.entryPointURL
)};\
    img-src * blob: data:`;

export default (async () => {
    let privatePath = await getDistPath(pkg.name);
    return {
        input:
            appEnv != 'test'
                ? (appEnv.length > 6 && appEnv.substring(appEnv.length - 6) == "Custom") ?
                    [
                        'src/' + appName + '.js',
                        'src/dbp-formalize-show-registrations.js',
                        await getPackagePath('@tugraz/web-components', 'src/logo.js')
                    ]
                    :
                    [
                        'src/' + appName + '.js',
                        'src/dbp-formalize-show-registrations.js'
                    ]
                : globSync('test/**/*.js'),
        output: {
            dir: 'dist',
            entryFileNames: '[name].js',
            chunkFileNames: 'shared/[name].[hash].[format].js',
            format: 'esm',
            sourcemap: true,
        },
        treeshake: treeshake,
        //preserveEntrySignatures: false,
        onwarn: function (warning, warn) {
            // ignore chai warnings
            if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.message.includes('chai')) {
                return;
            }
            // keycloak bundled code uses eval
            if (warning.code === 'EVAL' && warning.id.includes('sha256.js')) {
                return;
            }

            warn(warning);
        },
        plugins: [
            del({
                targets: 'dist/*',
            }),
            !whitelabel &&
            emitEJS({
                src: formalizePath,
                include: ['**/*.ejs', '**/.*.ejs'],
                data: {
                    getUrl: (p) => {
                        return url.resolve(config.basePath, p);
                    },
                    getPrivateUrl: (p) => {
                        return url.resolve(`${config.basePath}${privatePath}/`, p);
                    },
                    name: appName,
                    entryPointURL: config.entryPointURL,
                    basePath: config.basePath,
                    keyCloakBaseURL: config.keyCloakBaseURL,
                    keyCloakRealm: config.keyCloakRealm,
                    keyCloakClientId: config.keyCloakClientId,
                    CSP: config.CSP,
                    matomoUrl: config.matomoUrl,
                    matomoSiteId: config.matomoSiteId,
                    buildInfo: getBuildInfo(appEnv),
                    universityShortName: config.universityShortName,
                    universityFullName: config.universityFullName
                },
            }),
            whitelabel &&
            emitEJS({
                src: 'assets',
                include: ['**/*.ejs', '**/.*.ejs'],
                data: {
                    getUrl: (p) => {
                        return url.resolve(config.basePath, p);
                    },
                    getPrivateUrl: (p) => {
                        return url.resolve(`${config.basePath}${privatePath}/`, p);
                    },
                    name: appName,
                    entryPointURL: config.entryPointURL,
                    basePath: config.basePath,
                    keyCloakBaseURL: config.keyCloakBaseURL,
                    keyCloakRealm: config.keyCloakRealm,
                    keyCloakClientId: config.keyCloakClientId,
                    CSP: config.CSP,
                    matomoUrl: config.matomoUrl,
                    matomoSiteId: config.matomoSiteId,
                    buildInfo: getBuildInfo(appEnv),
                    universityShortName: config.universityShortName,
                    universityFullName: config.universityFullName
                },
            }),
            resolve({
                browser: true,
                preferBuiltins: true,
            }),
            checkLicenses &&
                license({
                    banner: {
                        commentStyle: 'ignored',
                        content: `
    License: <%= pkg.license %>
    Dependencies:
    <% _.forEach(dependencies, function (dependency) { if (dependency.name) { %>
    <%= dependency.name %>: <%= dependency.license %><% }}) %>
    `,
                    },
                    thirdParty: {
                        allow: {
                            test: '(MIT OR BSD-3-Clause OR Apache-2.0 OR LGPL-2.1-or-later OR 0BSD)',
                            failOnUnlicensed: true,
                            failOnViolation: false,
                        },
                    },
                }),
            commonjs({
                include: 'node_modules/**',
            }),
            json(),
            urlPlugin({
                limit: 0,
                include: ['node_modules/suggestions/**/*.css', 'node_modules/select2/**/*.css'],
                emitFiles: true,
                fileName: 'shared/[name].[hash][extname]',
            }),
            !whitelabel &&
            copy({
                targets: [
                    {src: formalizePath + 'silent-check-sso.html', dest: 'dist'},
                    {src: formalizePath + 'htaccess-shared', dest: 'dist/shared/', rename: '.htaccess'},
                    {src: formalizePath + '*.css', dest: 'dist/' + (await getDistPath(pkg.name))},
                    {src: formalizePath + '*.svg', dest: 'dist/' + (await getDistPath(pkg.name))},
                    {src: formalizePath + 'icon/*', dest: 'dist/' + (await getDistPath(pkg.name, 'icon'))},
                    {src: formalizePath + '*.metadata.json', dest: 'dist'},
                    {src: formalizePath + 'site.webmanifest', dest: 'dist', rename: pkg.internalName + '.webmanifest'},
                    {
                        src: await getPackagePath('@tugraz/font-source-sans-pro', 'files/*'),
                        dest: 'dist/' + (await getDistPath(pkg.name, 'fonts/source-sans-pro')),
                    },
                    {
                        src: await getPackagePath('@tugraz/web-components', 'src/spinner.js'),
                        dest: 'dist/' + (await getDistPath(pkg.name)), rename: 'tug_spinner.js'
                    },
                    {
                        src: await getPackagePath('@dbp-toolkit/common', 'src/spinner.js'),
                        dest: 'dist/' + (await getDistPath(pkg.name)),
                    },
                    {
                        src: await getPackagePath('@dbp-toolkit/common', 'misc/browser-check.js'),
                        dest: 'dist/' + (await getDistPath(pkg.name)),
                    },
                    {src: formalizePath + '*.metadata.json', dest: 'dist'},
                    {
                        src: await getPackagePath('@dbp-toolkit/common', 'assets/icons/*.svg'),
                        dest: 'dist/' + (await getDistPath('@dbp-toolkit/common', 'icons')),
                    },
                    {
                        src: await getPackagePath('tabulator-tables', 'dist/css'),
                        dest: 'dist/' + (await getDistPath(pkg.name, 'tabulator-tables')),
                    }
                ],
            }),
            whitelabel &&
            copy({
                targets: [
                    {src: 'assets/silent-check-sso.html', dest: 'dist'},
                    {src: 'assets/htaccess-shared', dest: 'dist/shared/', rename: '.htaccess'},
                    {src: 'assets/*.css', dest: 'dist/' + (await getDistPath(pkg.name))},
                    {src: 'assets/*.svg', dest: 'dist/' + (await getDistPath(pkg.name))},
                    {src: 'assets/icon/*', dest: 'dist/' + (await getDistPath(pkg.name, 'icon'))},
                    {src: 'src/*.metadata.json', dest: 'dist'},
                    {src: 'assets/site.webmanifest', dest: 'dist', rename: pkg.internalName + '.webmanifest'},
                    {
                        src: await getPackagePath('@tugraz/font-source-sans-pro', 'files/*'),
                        dest: 'dist/' + (await getDistPath(pkg.name, 'fonts/source-sans-pro')),
                    },
                    {
                        src: await getPackagePath('@dbp-toolkit/common', 'src/spinner.js'),
                        dest: 'dist/' + (await getDistPath(pkg.name)), rename: 'org_spinner.js'
                    },
                    {
                        src: await getPackagePath('@dbp-toolkit/common', 'src/spinner.js'),
                        dest: 'dist/' + (await getDistPath(pkg.name)),
                    },
                    {
                        src: await getPackagePath('@dbp-toolkit/common', 'misc/browser-check.js'),
                        dest: 'dist/' + (await getDistPath(pkg.name)),
                    },
                    {src: 'assets/*.metadata.json', dest: 'dist'},
                    {
                        src: await getPackagePath('@dbp-toolkit/common', 'assets/icons/*.svg'),
                        dest: 'dist/' + (await getDistPath('@dbp-toolkit/common', 'icons')),
                    },
                    {
                        src: await getPackagePath('tabulator-tables', 'dist/css'),
                        dest: 'dist/' + (await getDistPath(pkg.name, 'tabulator-tables')),
                    }
                ],
            }),
            useBabel &&
                getBabelOutputPlugin({
                    compact: false,
                    presets: [
                        [
                            '@babel/preset-env',
                            {
                                loose: true,
                                modules: false,
                                shippedProposals: true,
                                bugfixes: true,
                                targets: {
                                    esmodules: true,
                                },
                            },
                        ],
                    ],
                }),
            useTerser ? terser() : false,
            watch
                ? serve({
                      contentBase: '.',
                      host: '127.0.0.1',
                      port: 8001,
                      historyApiFallback: config.basePath + appName + '.html',
                      https: useHTTPS ? await generateTLSConfig() : false,
                      headers: {
                          'Content-Security-Policy': config.CSP,
                      },
                  })
                : false,
        ],
    };
})();
