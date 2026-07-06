// @ts-nocheck
import {html} from 'lit';
import {createRef, ref} from 'lit/directives/ref.js';
import {ScopedElementsMixin, Button, Icon, LoadingButton} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {createInstance} from './i18n.js';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {MANAGE_FORMS_COMPONENT_STYLES} from './manage-forms-component-styles.js';

/**
 * A modal dialog for batch-tagging submissions.
 *
 * Events dispatched:
 * - `batch-tagging-confirm` — user clicked confirm, detail contains `{ tags, justAdd }`
 * - `batch-tagging-cancel`  — user cancelled
 */
export class BatchTaggingModal extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.availableTags = [];
        this.selectedTags = [];
        this.justAddTags = false;
        this.submissionCount = 0;
        this.modalRef = createRef();
        this.confirmButtonRef = createRef();
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-loading-button': LoadingButton,
            'dbp-modal': Modal,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            availableTags: {type: Array, attribute: false},
            selectedTags: {type: Array, attribute: false},
            justAddTags: {type: Boolean, attribute: false},
            submissionCount: {type: Number, attribute: false},
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            if (propName === 'lang') {
                this._i18n.changeLanguage(this.lang);
            }
        });
        super.update(changedProperties);
    }

    static get styles() {
        return MANAGE_FORMS_COMPONENT_STYLES;
    }

    /**
     * Open the modal. Resets selected tags.
     */
    open() {
        this.selectedTags = [];
        this.justAddTags = false;
        this.requestUpdate();
        this.modalRef.value?.open();
    }

    /**
     * Close the modal.
     */
    close() {
        this.selectedTags = [];
        this.requestUpdate();
        this.modalRef.value?.close();
    }

    /**
     * Access the confirm button (so the parent can show/hide spinner).
     * @returns {HTMLElement|null}
     */
    getConfirmButton() {
        return this.confirmButtonRef.value ?? null;
    }

    handleConfirm() {
        this.dispatchEvent(
            new CustomEvent('batch-tagging-confirm', {
                detail: {
                    tags: [...this.selectedTags],
                    justAdd: this.justAddTags,
                },
                bubbles: true,
                composed: true,
            }),
        );
    }

    handleCancel() {
        this.close();
        this.dispatchEvent(
            new CustomEvent('batch-tagging-cancel', {
                bubbles: true,
                composed: true,
            }),
        );
    }

    render() {
        const i18n = this._i18n;

        return html`
            <dbp-modal
                ${ref(this.modalRef)}
                id="batch-tagging-dialog-modal"
                class="modal modal--batch-tagging"
                modal-id="batch-tagging-dialog"
                title="${i18n.t('manage-forms.batch-tagging-title')}"
                subscribe="lang">
                <div slot="content">
                    <div class="batch-tagging-modal-content">
                        <p>
                            ${i18n.t('manage-forms.batch-tagging-message', {
                                count: this.submissionCount,
                            })}
                        </p>
                        <fieldset class="checkbox-container">
                            <legend>
                                <dbp-icon name="tags" aria-hidden="true"></dbp-icon>
                                Available tags
                            </legend>
                            ${
                                this.availableTags && this.availableTags.length > 0
                                    ? html`
                                          ${this.availableTags.map(
                                              (tag) => html`
                                                  <div class="tag-checkbox">
                                                      <input
                                                          type="checkbox"
                                                          id="batch-tagging-tag-${tag.identifier}"
                                                          name="batch-tagging-tag-${tag.identifier}"
                                                          value="${tag.identifier}"
                                                          .checked="${this.selectedTags.includes(
                                                              tag.identifier,
                                                          )}"
                                                          @change="${(e) => {
                                                              if (e.target.checked) {
                                                                  this.selectedTags = [
                                                                      ...this.selectedTags,
                                                                      tag.identifier,
                                                                  ];
                                                              } else {
                                                                  this.selectedTags =
                                                                      this.selectedTags.filter(
                                                                          (t) =>
                                                                              t !== tag.identifier,
                                                                      );
                                                              }
                                                          }}" />
                                                      <label
                                                          for="batch-tagging-tag-${tag.identifier}">
                                                          ${tag.identifier}
                                                      </label>
                                                  </div>
                                              `,
                                          )}
                                      `
                                    : html`
                                          <p>
                                              <dbp-icon
                                                  name="warning"
                                                  aria-hidden="true"></dbp-icon>
                                              ${i18n.t('manage-forms.no-available-tags-label')}
                                          </p>
                                      `
                            }
                        </fieldset>
                    </div>
                </div>
                <menu slot="footer" class="footer-menu">
                    <div class="just-add-tags">
                        <input
                            type="checkbox"
                            id="just-add-tags-checkbox"
                            name="just-add-tags-checkbox"
                            value="just-add-tags"
                            @change="${(e) => {
                                this.justAddTags = e.target.checked;
                            }}" />
                        <label for="just-add-tags-checkbox">
                            ${i18n.t('manage-forms.just-add-tags-label')}
                        </label>
                    </div>
                    <div class="button-container">
                        <dbp-button
                            type="is-secondary"
                            no-spinner-on-click
                            @click="${() => this.handleCancel()}">
                            ${i18n.t('manage-forms.abort')}
                        </dbp-button>
                        <dbp-button
                            ${ref(this.confirmButtonRef)}
                            id="process-batch-tagging-button"
                            type="is-danger"
                            @click="${() => this.handleConfirm()}">
                            ${
                                this.justAddTags
                                    ? i18n.t('manage-forms.batch-tagging-button-text-add')
                                    : i18n.t('manage-forms.batch-tagging-button-text-replace')
                            }
                        </dbp-button>
                    </div>
                </menu>
            </dbp-modal>
        `;
    }
}
