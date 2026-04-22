// @ts-nocheck
import {css, html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {ScopedElementsMixin, Button, Icon, IconButton, sendNotification} from '@dbp-toolkit/common';
import {FileSink} from '@dbp-toolkit/file-handling';
import {PdfViewer} from '@dbp-toolkit/pdf-viewer';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {createInstance} from './i18n.js';
import MicroModal from './micromodal.es.js';
import {MANAGE_FORMS_COMPONENT_STYLES} from './manage-forms-component-styles.js';

export class ManageSubmissionModal extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.state = '';
        this.hiddenColumns = false;
        this.isPrevEnabled = false;
        this.isNextEnabled = false;
        this.currentBeautyId = 0;
        this.totalItems = 0;
        this.auth = {};
        this.isPdfPreviewOpen = false;
        this.contentItems = [];
        this.boundHandleKeydown = this.handleKeydown.bind(this);
        this.boundHandlePdfModalClosed = this.handlePdfModalClosed.bind(this);
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
            'dbp-icon': Icon,
            'dbp-icon-button': IconButton,
            'dbp-file-sink': FileSink,
            'dbp-modal': Modal,
            'dbp-pdf-viewer': PdfViewer,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            state: {type: String},
            hiddenColumns: {type: Boolean, attribute: false},
            isPrevEnabled: {type: Boolean, attribute: false},
            isNextEnabled: {type: Boolean, attribute: false},
            currentBeautyId: {type: Number, attribute: false},
            totalItems: {type: Number, attribute: false},
            auth: {type: Object, attribute: false},
            isPdfPreviewOpen: {type: Boolean, attribute: false},
            contentItems: {type: Array, attribute: false},
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
        return [
            MANAGE_FORMS_COMPONENT_STYLES,
            css`
                .submitted-files .file-block + .file-block {
                    margin-top: 0.75rem;
                }

                .submitted-files .file-action-buttons {
                    margin-top: 0.5rem;
                }
            `,
        ];
    }

    getModalElement() {
        return this.renderRoot?.querySelector(`#detailed-submission-modal-${this.state}`) ?? null;
    }

    show() {
        const modal = this.getModalElement();
        const pdfModal = this.renderRoot?.querySelector('#pdf-view-modal');
        if (!modal) {
            return;
        }

        pdfModal?.addEventListener('dbp-modal-closed', this.boundHandlePdfModalClosed);

        MicroModal.show(modal, {
            disableScroll: true,
            onClose: () => {
                document.removeEventListener('keydown', this.boundHandleKeydown, true);
                pdfModal?.removeEventListener('dbp-modal-closed', this.boundHandlePdfModalClosed);
                this.isPdfPreviewOpen = false;
                this.dispatchEvent(
                    new CustomEvent('detail-modal-close', {
                        detail: {state: this.state},
                        bubbles: true,
                        composed: true,
                    }),
                );
            },
            onShow: () => {
                document.addEventListener('keydown', this.boundHandleKeydown, true);
            },
        });
    }

    close() {
        const modal = this.getModalElement();
        if (modal) {
            MicroModal.close(modal);
        }
    }

    handleKeydown(event) {
        if (this.isPdfPreviewOpen && event.key === 'Escape') {
            event.stopPropagation();
            return;
        }

        if (event.keyCode === 37 && this.isPrevEnabled) {
            this.dispatchEvent(
                new CustomEvent('detail-modal-previous', {
                    detail: {state: this.state},
                    bubbles: true,
                    composed: true,
                }),
            );
        }

        if (event.keyCode === 39 && this.isNextEnabled) {
            this.dispatchEvent(
                new CustomEvent('detail-modal-next', {
                    detail: {state: this.state},
                    bubbles: true,
                    composed: true,
                }),
            );
        }
    }

    handlePdfModalClosed() {
        this.isPdfPreviewOpen = false;
    }

    formatFileSize(fileSize) {
        const normalizedFileSize = Number(fileSize);
        return Number.isFinite(normalizedFileSize)
            ? `${(normalizedFileSize / 1024).toFixed(2)} KB`
            : '';
    }

    isPdfFile(file) {
        const mimeType = (file?.mimeType || '').toLowerCase();
        const fileName = (file?.fileName || '').toLowerCase();
        return mimeType === 'application/pdf' || fileName.endsWith('.pdf');
    }

    async fetchDownloadableFile(file) {
        if (!file?.downloadUrl) {
            return null;
        }

        const headers = {};
        if (this.auth?.token) {
            headers.Authorization = 'Bearer ' + this.auth.token;
        }

        const response = await fetch(file.downloadUrl, {
            method: 'GET',
            headers,
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status}`);
        }

        const fileBlob = await response.blob();
        const downloadableFile = new File([fileBlob], file.fileName, {
            type: file.mimeType || fileBlob.type || 'application/octet-stream',
        });

        // FileSink expects this property for non-streamed single-file downloads.
        downloadableFile.filename = file.fileName;
        return downloadableFile;
    }

    async downloadFile(file) {
        const fileSink = this.renderRoot?.querySelector('#file-sink');
        if (!fileSink) {
            return;
        }

        try {
            const downloadableFile = await this.fetchDownloadableFile(file);
            if (!downloadableFile) {
                return;
            }

            fileSink.files = [downloadableFile];
        } catch (error) {
            console.error(error);
            sendNotification({
                summary: this._i18n.t('errors.other-title'),
                body: this._i18n.t('errors.other-body'),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    async previewPdfFile(file) {
        const pdfModal = this.renderRoot?.querySelector('#pdf-view-modal');
        const pdfViewer = this.renderRoot?.querySelector('#dbp-pdf-viewer');
        if (!pdfModal || !pdfViewer || !file?.downloadUrl) {
            return;
        }

        try {
            const pdfFile = await this.fetchDownloadableFile(file);
            if (!pdfFile) {
                return;
            }

            this.isPdfPreviewOpen = true;
            pdfModal.open();
            await pdfViewer.showPDF(pdfFile);
        } catch (error) {
            console.error(error);
            sendNotification({
                summary: this._i18n.t('errors.other-title'),
                body: this._i18n.t('errors.other-body'),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    renderFileItem(file) {
        const fileSize = this.formatFileSize(file.fileSize);

        return html`
            <div class="file-block">
                <span class="file-info">
                    <strong class="file-name">${file.fileName}</strong>
                    <span class="additional-data">
                        ${file.mimeType
                            ? html`
                                  <span class="file-type">(${file.mimeType})</span>
                              `
                            : ''}
                        ${fileSize
                            ? html`
                                  <span class="file-size">${fileSize}</span>
                              `
                            : ''}
                    </span>
                </span>
                <div class="file-action-buttons">
                    ${this.isPdfFile(file)
                        ? html`
                              <button
                                  class="view-file-button button is-secondary"
                                  @click=${(event) => {
                                      event.preventDefault();
                                      this.previewPdfFile(file);
                                  }}>
                                  <dbp-icon name="eye"></dbp-icon>
                                  ${this._i18n.t('render-form.download-widget.view-attachment')}
                              </button>
                          `
                        : ''}
                    <button
                        class="download-file-button button is-secondary"
                        @click=${(event) => {
                            event.preventDefault();
                            this.downloadFile(file);
                        }}>
                        <dbp-icon name="download"></dbp-icon>
                        ${this._i18n.t('render-form.download-widget.download-attachment')}
                    </button>
                </div>
            </div>
        `;
    }

    renderContentItem(item) {
        if (item.type === 'files' && item.files?.length > 0) {
            return html`
                <div class="fileblock-container submitted-files">
                    ${item.files.map((file) => this.renderFileItem(file))}
                </div>
            `;
        }

        return item.value;
    }

    render() {
        const i18n = this._i18n;

        return html`
            <div
                class="modal micromodal-slide"
                id="detailed-submission-modal-${this.state}"
                data-state="${this.state}"
                aria-hidden="true">
                <div class="modal-overlay" tabindex="-2">
                    <div
                        class="modal-container detailed-submission-modal-box"
                        id="detailed-submission-modal-box-${this.state}"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="detailed-submission-modal-title-${this.state}">
                        <header class="modal-header">
                            <dbp-icon-button
                                title="${i18n.t('manage-forms.modal-close')}"
                                aria-label="${i18n.t('manage-forms.modal-close')}"
                                class="modal-close"
                                icon-name="close"
                                @click="${() => {
                                    this.close();
                                }}"></dbp-icon-button>
                            <h3
                                id="detailed-submission-modal-title-${this.state}"
                                class="detailed-submission-modal-title">
                                ${i18n.t('manage-forms.detailed-submission-dialog-title')}
                            </h3>
                        </header>
                        <main
                            class="modal-content detailed-submission-modal-content"
                            id="detailed-submission-modal-content-${this.state}">
                            <div class="content-wrapper">
                                ${this.contentItems.map(
                                    (item, index) => html`
                                        <div class="element-left ${classMap({first: index === 0})}">
                                            ${item.label}:
                                        </div>
                                        <div
                                            class="element-right ${classMap({first: index === 0})}">
                                            ${this.renderContentItem(item)}
                                        </div>
                                    `,
                                )}
                            </div>
                        </main>
                        <footer class="modal-footer">
                            <div class="modal-footer-btn">
                                <label
                                    class="button-container ${classMap({
                                        hidden: !this.hiddenColumns,
                                    })}">
                                    ${i18n.t('manage-forms.apply-col-settings')}
                                    <input
                                        type="checkbox"
                                        id="apply-col-settings-${this.state}"
                                        class="apply-col-settings"
                                        name="apply-col-settings"
                                        checked />
                                    <span class="checkmark"></span>
                                </label>
                                <div class="btn-row-left">
                                    <dbp-button
                                        class="back-btn"
                                        no-spinner-on-click
                                        title="${i18n.t('manage-forms.previous-entry-btn-title')}"
                                        @click="${() => {
                                            this.dispatchEvent(
                                                new CustomEvent('detail-modal-previous', {
                                                    detail: {state: this.state},
                                                    bubbles: true,
                                                    composed: true,
                                                }),
                                            );
                                        }}"
                                        ?disabled=${!this.isPrevEnabled}>
                                        <dbp-icon name="chevron-left" aria-hidden="true"></dbp-icon>
                                        ${i18n.t('manage-forms.previous-entry-btn-title')}
                                    </dbp-button>
                                    <div class="page-numbering">
                                        ${i18n.t('manage-forms.detailed-submission-dialog-id', {
                                            id: this.currentBeautyId,
                                            nItems: this.totalItems,
                                        })}
                                    </div>
                                    <dbp-button
                                        class="next-btn"
                                        no-spinner-on-click
                                        title="${i18n.t('manage-forms.next-entry-btn-title')}"
                                        @click="${() => {
                                            this.dispatchEvent(
                                                new CustomEvent('detail-modal-next', {
                                                    detail: {state: this.state},
                                                    bubbles: true,
                                                    composed: true,
                                                }),
                                            );
                                        }}"
                                        ?disabled=${!this.isNextEnabled}>
                                        ${i18n.t('manage-forms.next-entry-btn-title')}
                                        <dbp-icon
                                            name="chevron-right"
                                            aria-hidden="true"></dbp-icon>
                                    </dbp-button>
                                </div>
                            </div>
                        </footer>

                        <dbp-file-sink
                            id="file-sink"
                            class="file-sink"
                            lang="${this.lang}"
                            allowed-mime-types="*/*"
                            decompress-zip
                            enabled-targets="local,clipboard,nextcloud"
                            subscribe="auth,nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-sink>

                        <dbp-modal
                            id="pdf-view-modal"
                            class="pdf-view-modal"
                            modal-id="pdf-viewer-modal-${this.state}"
                            subscribe="lang">
                            <div slot="content">
                                <dbp-pdf-viewer
                                    id="dbp-pdf-viewer"
                                    lang="${this.lang}"
                                    auto-resize="cover"></dbp-pdf-viewer>
                            </div>
                        </dbp-modal>
                    </div>
                </div>
            </div>
        `;
    }
}
