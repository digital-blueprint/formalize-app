import {css, html} from 'lit';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {Button, Icon, ScopedElementsMixin, sendNotification} from '@dbp-toolkit/common';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {setOverridesByGlobalCache} from '@dbp-toolkit/common/i18next.js';
import {createInstance} from './i18n.js';
import {MANAGE_FORMS_COMPONENT_STYLES} from './manage-forms-component-styles.js';
import {getFormRenderUrl, getFormManageSubmissionsUrl} from './utils.js';

/** Modal showing the copyable website links of one managed form. */
export class FormLinksModal extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.langDir = '';
        /** @type {Record<string, any>|null} */
        this.form = null;
        this.copiedUrl = '';
        /** @type {ReturnType<typeof setTimeout>|undefined} */
        this._copiedTimeout = undefined;
    }

    static get scopedElements() {
        return {
            'dbp-modal': Modal,
            'dbp-icon': Icon,
            'dbp-button': Button,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            langDir: {type: String, attribute: 'lang-dir'},
            form: {type: Object, attribute: false},
            copiedUrl: {type: String, attribute: false},
        };
    }

    async updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('lang')) {
            await this._i18n.changeLanguage(this.lang);
        }
        if ((changedProperties.has('lang') || changedProperties.has('langDir')) && this.langDir) {
            await setOverridesByGlobalCache(this._i18n, this);
        }
    }

    disconnectedCallback() {
        clearTimeout(this._copiedTimeout);
        super.disconnectedCallback();
    }

    static get styles() {
        return [
            MANAGE_FORMS_COMPONENT_STYLES,
            css`
                .modal--form-links {
                    /* The dialog adds 20px of horizontal padding on each side. */
                    --dbp-modal-width: min(640px, calc(100vw - 60px));
                    --dbp-modal-min-width: auto;
                    --dbp-modal-max-width: calc(100vw - 60px);
                    --dbp-modal-min-height: auto;
                }

                .intro {
                    margin: 0 0 1.5em;
                }

                .link-field + .link-field {
                    margin-top: 1.5em;
                }

                .link-field label {
                    display: block;
                    font-weight: bold;
                }

                .link-field .description {
                    margin: 0.25em 0 0.5em;
                    color: var(--dbp-muted);
                }

                .link-controls {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 0.5em;
                }

                .link-controls .input {
                    flex: 1 1 15em;
                    min-width: 0;
                    font-family: inherit;
                }

                .link-buttons {
                    display: flex;
                    gap: 0.5em;
                }

                .link-buttons .button {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4em;
                }

                .link-buttons dbp-icon {
                    top: 0;
                }

                .link-buttons .is-copied dbp-icon {
                    color: var(--dbp-success);
                }

                .footer-menu {
                    justify-content: flex-end;
                }
            `,
        ];
    }

    _getModal() {
        return /** @type {Modal|null} */ (this.renderRoot?.querySelector('#form-links-modal'));
    }

    /**
     * Opens the modal for the given form.
     *
     * @param {Record<string, any>} form
     */
    async open(form) {
        this.form = form;
        this.copiedUrl = '';
        await this.updateComplete;
        this._getModal()?.open();
    }

    close() {
        this._getModal()?.close();
    }

    /**
     * @returns {Array<{id: string, url: string, label: string, description: string}>}
     */
    getLinks() {
        if (!this.form) return [];
        const i18n = this._i18n;
        const slug = this.form.moduleInstance?.getUrlSlug?.();
        return [
            ...(slug
                ? [
                      {
                          id: 'fill-in',
                          url: getFormRenderUrl(slug, this.lang, this.form.formId),
                          label: i18n.t('manage-forms.fill-in-form-link'),
                          description: i18n.t('manage-forms.fill-in-form-link-description'),
                      },
                  ]
                : []),
            {
                id: 'my-submissions',
                url: getFormManageSubmissionsUrl(this.form.formId, this.lang),
                label: i18n.t('manage-forms.my-submissions-link'),
                description: i18n.t('manage-forms.my-submissions-link-description'),
            },
        ];
    }

    async copyLink(url) {
        try {
            await navigator.clipboard.writeText(url);
            this.copiedUrl = url;
            clearTimeout(this._copiedTimeout);
            this._copiedTimeout = setTimeout(() => {
                this.copiedUrl = '';
            }, 2000);
            sendNotification({
                summary: this._i18n.t('manage-forms.link-copied'),
                type: 'success',
                timeout: 5,
            });
        } catch {
            sendNotification({
                summary: this._i18n.t('manage-forms.copy-link-failed'),
                type: 'warning',
                timeout: 5,
            });
        }
    }

    renderLink({id, url, label, description}) {
        const i18n = this._i18n;
        const formName = this.form?.formName ?? '';
        const inputId = `form-link-${id}`;
        const descriptionId = `${inputId}-description`;
        const copied = this.copiedUrl === url;
        return html`
            <div class="link-field">
                <label for=${inputId}>${label}</label>
                <p id=${descriptionId} class="description">${description}</p>
                <div class="link-controls">
                    <input
                        id=${inputId}
                        class="input"
                        type="text"
                        readonly
                        aria-describedby=${descriptionId}
                        .value=${url}
                        @focus=${(event) => event.target.select()} />
                    <div class="link-buttons">
                        <button
                            type="button"
                            class="button ${copied ? 'is-copied' : ''}"
                            aria-label=${i18n.t('manage-forms.copy-link-aria', {label, formName})}
                            @click=${() => this.copyLink(url)}>
                            <dbp-icon
                                name=${copied ? 'checkmark' : 'clipboard'}
                                aria-hidden="true"></dbp-icon>
                            <span>
                                ${
                                    copied
                                        ? i18n.t('manage-forms.link-copied')
                                        : i18n.t('manage-forms.copy-link')
                                }
                            </span>
                        </button>
                        <a
                            class="button"
                            href=${url}
                            target="_blank"
                            rel="noopener"
                            aria-label=${i18n.t('manage-forms.open-link-aria', {label, formName})}>
                            <dbp-icon name="open-new-window" aria-hidden="true"></dbp-icon>
                            <span>${i18n.t('manage-forms.open-link')}</span>
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        const i18n = this._i18n;
        return html`
            <dbp-modal
                id="form-links-modal"
                class="modal modal--form-links"
                modal-id="form-links-modal"
                title=${i18n.t('manage-forms.share-links')}>
                <div slot="content">
                    ${
                        this.form
                            ? html`
                                  <p class="intro">
                                      ${i18n.t('manage-forms.share-links-intro', {
                                          formName: this.form.formName ?? '',
                                      })}
                                  </p>
                                  ${this.getLinks().map((link) => this.renderLink(link))}
                              `
                            : ''
                    }
                </div>
                <menu slot="footer" class="footer-menu">
                    <dbp-button
                        type="is-secondary"
                        no-spinner-on-click
                        aria-label=${i18n.t('manage-forms.close')}
                        @click=${() => this.close()}>
                        <dbp-icon name="close" aria-hidden="true"></dbp-icon>
                        <span class="button-label">${i18n.t('manage-forms.close')}</span>
                    </dbp-button>
                </menu>
            </dbp-modal>
        `;
    }
}
