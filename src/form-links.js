import {css, html} from 'lit';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {sendNotification} from '@dbp-toolkit/common';
import {setOverridesByGlobalCache} from '@dbp-toolkit/common/i18next.js';
import {createInstance} from './i18n.js';
import {getFormRenderUrl, getFormManageSubmissionsUrl} from './utils.js';

/** Visible, copyable website links for one managed form. */
export class FormLinks extends DBPLitElement {
    constructor() {
        super();
        this._i18n = createInstance();
        this.form = null;
        this.langDir = '';
    }

    static get properties() {
        return {
            ...super.properties,
            form: {type: Object, attribute: false},
            langDir: {type: String, attribute: 'lang-dir'},
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

    static get styles() {
        return css`
            :host {
                display: block;
                white-space: normal;
            }
            .link {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            a {
                color: var(--dbp-primary, #0645ad);
                overflow-wrap: anywhere;
            }
            button {
                cursor: pointer;
                font: inherit;
            }
        `;
    }

    async copyLink(url) {
        try {
            await navigator.clipboard.writeText(url);
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
        return html`
            <div class="link">
                <a href=${url} title=${url} aria-label=${`${label}: ${this.form?.formName ?? ''}`}>
                    ${label}
                </a>
                <button
                    type="button"
                    aria-label=${this._i18n.t('manage-forms.copy-link-aria', {
                        label,
                        formName: this.form?.formName ?? '',
                    })}
                    @click=${() => this.copyLink(url)}>
                    ${this._i18n.t('manage-forms.copy-link')}
                </button>
            </div>
        `;
    }

    render() {
        if (!this.form) return html``;
        const slug = this.form.moduleInstance?.getUrlSlug?.();
        return html`
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
        `;
    }
}
