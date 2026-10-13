import {css, html} from 'lit';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {Icon, ScopedElementsMixin, sendNotification} from '@dbp-toolkit/common';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {setOverridesByGlobalCache} from '@dbp-toolkit/common/i18next.js';
import {createInstance} from './i18n.js';
import {getFormRenderUrl, getFormManageSubmissionsUrl} from './utils.js';

/** Visible, copyable website links for one managed form. */
export class FormLinks extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.form = null;
        this.langDir = '';
        this.copiedUrl = '';
        /** @type {ReturnType<typeof setTimeout>|undefined} */
        this._copiedTimeout = undefined;
    }

    static get scopedElements() {
        return {'dbp-icon': Icon};
    }

    static get properties() {
        return {
            ...super.properties,
            form: {type: Object, attribute: false},
            langDir: {type: String, attribute: 'lang-dir'},
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
            commonStyles.getThemeCSS(),
            commonStyles.getGeneralCSS(false),
            commonStyles.getButtonCSS(),
            css`
                :host {
                    display: block;
                    white-space: normal;
                }

                ul {
                    display: flex;
                    flex-direction: column;
                    gap: 0.125rem;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }

                li {
                    display: flex;
                    align-items: center;
                    min-width: 0;
                    min-height: 2rem;
                }

                a {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    min-width: 0;
                    padding: 0.125rem 0;
                    border-bottom: var(--dbp-border);
                    transition:
                        color 0.15s,
                        border-color 0.15s;
                }

                a:hover {
                    color: var(--dbp-hover-color, var(--dbp-content));
                    border-bottom-color: currentColor;
                }

                a:focus-visible,
                button.copy-button:focus-visible {
                    outline: 2px solid var(--dbp-accent);
                    outline-offset: 2px;
                }

                .link-text {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                dbp-icon {
                    flex-shrink: 0;
                    top: 0;
                }

                .link-icon {
                    font-size: 0.9em;
                    color: var(--dbp-muted);
                }

                button.copy-button {
                    --dbp-button-size: 2rem;
                    flex-shrink: 0;
                    margin-inline-start: 0.25rem;
                    border-radius: var(--dbp-border-radius);
                }

                button.copy-button dbp-icon {
                    font-size: 1.15rem;
                }

                button.copy-button.is-copied {
                    color: var(--dbp-success);
                }
            `,
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

    renderLink(url, label) {
        const copied = this.copiedUrl === url;
        return html`
            <li>
                <a href=${url} title=${url} aria-label=${`${label}: ${this.form?.formName ?? ''}`}>
                    <dbp-icon class="link-icon" name="link" aria-hidden="true"></dbp-icon>
                    <span class="link-text">${label}</span>
                </a>
                <button
                    type="button"
                    class="button is-icon copy-button ${copied ? 'is-copied' : ''}"
                    title=${
                        copied
                            ? this._i18n.t('manage-forms.link-copied')
                            : this._i18n.t('manage-forms.copy-link')
                    }
                    aria-label=${this._i18n.t('manage-forms.copy-link-aria', {
                        label,
                        formName: this.form?.formName ?? '',
                    })}
                    @click=${() => this.copyLink(url)}>
                    <dbp-icon
                        name=${copied ? 'checkmark' : 'clipboard'}
                        aria-hidden="true"></dbp-icon>
                </button>
            </li>
        `;
    }

    render() {
        if (!this.form) return html``;
        const slug = this.form.moduleInstance?.getUrlSlug?.();
        return html`
            <ul>
                ${
                    slug
                        ? this.renderLink(
                              getFormRenderUrl(slug, this.lang, this.form.formId),
                              this._i18n.t('manage-forms.fill-in-form-link'),
                          )
                        : ''
                }
                ${this.renderLink(
                    getFormManageSubmissionsUrl(this.form.formId, this.lang),
                    this._i18n.t('manage-forms.my-submissions-link'),
                )}
            </ul>
        `;
    }
}
