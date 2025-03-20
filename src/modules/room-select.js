import $ from 'jquery';
import {findObjectInApiResults} from '@dbp-toolkit/person-select/src/utils.js';
import select2 from 'select2';
import select2LangDe from '@dbp-toolkit/person-select/src/i18n/de/select2';
import select2LangEn from '@dbp-toolkit/person-select/src/i18n/en/select2';
import {css, html} from 'lit';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {createInstance} from '../i18n.js';
import {Icon, combineURLs} from '@dbp-toolkit/common';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';
import select2CSSPath from 'select2/dist/css/select2.min.css';
import * as errorUtils from '@dbp-toolkit/common/error';
import {AdapterLitElement} from '@dbp-toolkit/common';

export class RoomSelect extends ScopedElementsMixin(AdapterLitElement) {
    constructor() {
        super();
        Object.assign(RoomSelect.prototype, errorUtils.errorMixin);
        this.auth = {};
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = null;
        this.$select = null;
        this.active = false;
        // For some reason using the same ID on the whole page twice breaks select2 (regardless if they are in different custom elements)
        this.selectId = 'room-select-' + commonUtils.makeId(24);
        this.value = '';
        this.object = null;
        this.ignoreValueUpdate = false;
        this.isSearching = false;
        this.lastResult = {};
        this.showReloadButton = false;
        this.reloadButtonTitle = '';
        this.disabled = false;

        this._onDocumentClicked = this._onDocumentClicked.bind(this);

        select2(window, $);
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
        };
    }

    $(selector) {
        return $(this.shadowRoot.querySelector(selector));
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            active: {type: Boolean, attribute: false},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            value: {type: String},
            object: {type: Object, attribute: false},
            showReloadButton: {type: Boolean, attribute: 'show-reload-button'},
            reloadButtonTitle: {type: String, attribute: 'reload-button-title'},
            auth: {type: Object},
            disabled: {type: Boolean, reflect: true},
            name: {type: String},
            id: {type: String},
            required: {type: Boolean},
        };
    }

    clear() {
        this.object = null;
        $(this).attr('data-object', '');
        $(this).data('object', null);
        this.value = '';
        // Reset value attribute to really make sure it is empty and will trigger a change event
        // when it is set again with the previous value
        $(this).attr('value', '');
        this.$select.val(null).trigger('change').trigger('select2:unselect');
    }

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener('click', this._onDocumentClicked);

        this.updateComplete.then(() => {
            this.$select = this.$('#' + this.selectId);
            if (!this.select2IsInitialized()) {
                this.initSelect2();
            }
        });
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._onDocumentClicked);
        super.disconnectedCallback();
    }

    _onDocumentClicked(ev) {
        // Close the popup when clicking outside of select2
        if (!ev.composedPath().includes(this)) {
            const $select = this.$('#' + this.selectId);
            if ($select.length && this.select2IsInitialized()) {
                $select.select2('close');
            }
        }
    }

    /**
     * Initializes the Select2 selector
     *
     * @param ignorePreset
     */
    initSelect2(ignorePreset = false) {
        const i18n = this._i18n;
        const that = this;
        const $this = $(this);

        if (this.$select === null || this.entryPointUrl === null) {
            return false;
        }

        const apiUrl = combineURLs(this.entryPointUrl, '/base/rooms');

        // we need to destroy Select2 and remove the event listeners before we can initialize it again
        if (this.$select && this.$select.hasClass('select2-hidden-accessible')) {
            this.$select.select2('destroy');
            this.$select.off('select2:select');
            this.$select.off('select2:closing');
        }

        this.$select
            .select2({
                width: '100%',
                language: this.lang === 'de' ? select2LangDe() : select2LangEn(),
                minimumInputLength: 2,
                placeholder: this.authenticated()
                    ? i18n.t('render-form.room-select.placeholder')
                    : i18n.t('render-form.room-select.login-required'),
                dropdownParent: this.$('#room-select-dropdown'),
                ajax: {
                    delay: 500,
                    url: apiUrl,
                    contentType: 'application/ld+json',
                    beforeSend: function (jqXHR) {
                        jqXHR.setRequestHeader('Authorization', 'Bearer ' + that.auth.token);
                        that.isSearching = true;
                    },
                    data: (params) => {
                        return this.buildUrlData(this, params);
                    },
                    processResults: function (data) {
                        that.$('#room-select-dropdown').addClass('select2-bug');

                        that.lastResult = data;
                        let members = data['hydra:member'];
                        const results = [];
                        members.forEach((room) => {
                            results.push({
                                id: room['@id'],
                                text: that.formatRoom(that, room),
                            });
                        });

                        return {
                            results: results,
                        };
                    },
                    error: (jqXHR, textStatus, errorThrown) => {
                        this.handleXhrError(jqXHR, textStatus, errorThrown);
                    },
                    complete: (jqXHR, textStatus) => {
                        that.isSearching = false;
                    },
                },
            })
            .on('select2:select', function (e) {
                that.$('#room-select-dropdown').removeClass('select2-bug');

                // set custom element attributes
                const identifier = e.params.data.id;
                that.object = findObjectInApiResults(identifier, that.lastResult);

                $this.attr('data-object', JSON.stringify(that.object));
                $this.data('object', that.object);

                if ($this.attr('value') !== identifier) {
                    that.ignoreValueUpdate = true;
                    $this.attr('value', identifier);

                    // fire a change event
                    that.dispatchEvent(
                        new CustomEvent('change', {
                            detail: {
                                value: identifier,
                            },
                            bubbles: true,
                        }),
                    );
                }
            })
            .on('select2:closing', (e) => {
                if (that.isSearching) {
                    e.preventDefault();
                }
            });

        return true;
    }

    /**
     * Gets passed the select2 params (https://select2.org/data-sources/ajax#jquery-ajax-options)
     * and should return an object containing the query parameters send to the server.
     *
     * @param {object} select
     * @param {object} params
     * @returns {object}
     */
    buildUrlData(select, params) {
        return {
            search: params.term.trim(),
        };
    }

    /**
     * Gets passed a room object and should return a string representation that will
     * will be shown to the user.
     *
     * @param {object} select
     * @param {object} room
     * @returns {string}
     */
    formatRoom(select, room) {
        let text = room['code'] ?? '';
        return text;
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);

                    if (this.select2IsInitialized()) {
                        // no other way to set an other language at runtime did work
                        this.initSelect2(true);
                    }
                    break;
                case 'value':
                    if (!this.ignoreValueUpdate && this.select2IsInitialized()) {
                        this.initSelect2();
                    }

                    this.ignoreValueUpdate = false;
                    break;
                case 'entryPointUrl':
                    // we don't need to preset the selector if the entry point url changes
                    this.initSelect2(true);
                    break;
                case 'auth':
                    this.active = this.authenticated();
                    if (this.active && (!oldValue || !oldValue.token)) {
                        this.initSelect2();
                    }
                    break;
            }
        });

        super.update(changedProperties);
    }

    select2IsInitialized() {
        return this.$select !== null && this.$select.hasClass('select2-hidden-accessible');
    }

    reloadClick() {
        if (this.object === null) {
            return;
        }

        // fire a change event
        this.dispatchEvent(
            new CustomEvent('change', {
                detail: {
                    value: this.value,
                },
                bubbles: true,
            }),
        );
    }

    authenticated() {
        return (this.auth.token || '') !== '';
    }

    static get styles() {
        return [
            commonStyles.getThemeCSS(),
            commonStyles.getGeneralCSS(),
            commonStyles.getButtonCSS(),
            commonStyles.getFormAddonsCSS(),
            commonStyles.getSelect2CSS(),
            css`
                #room-select-dropdown {
                    position: relative;
                }

                .select2-control.control {
                    width: 100%;
                }

                .field .button.control {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: var(--dbp-border);
                    border-color: var(--dbp-muted);
                    -moz-border-radius-topright: var(--dbp-border-radius);
                    -moz-border-radius-bottomright: var(--dbp-border-radius);
                    line-height: 100%;
                }

                .field .button.control dbp-icon {
                    top: 0;
                }

                /* https://github.com/select2/select2/issues/5457 */
                .select2-bug .loading-results {
                    display: none !important;
                }

                .select2-results__option.loading-results,
                {
                    background-image: url("data:image/gif;base64,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")
                    background-repeat: no-repeat;
                    padding-left: 35px;
                    background-position: 10px 50%;
                }
            `,
        ];
    }

    render() {
        const i18n = this._i18n;
        const select2CSS = commonUtils.getAssetURL(select2CSSPath);
        return html`
            <link rel="stylesheet" href="${select2CSS}" />
            <style>
                #${this.selectId} {
                    width: 100%;
                }
            </style>

            <div class="select">
                <div class="field has-addons">
                    <div class="select2-control control">
                        <!-- https://select2.org-->
                        <select
                            id="${this.selectId}"
                            name="room"
                            class="select"
                            ?disabled=${!this.active || this.disabled}>
                            ${!this.authenticated()
                                ? html`
                                      <option value="" disabled selected>
                                          ${i18n.t('render-form.room-select.login-required')}
                                      </option>
                                  `
                                : ''}
                        </select>
                    </div>
                    <a
                        class="control button"
                        id="reload-button"
                        ?disabled=${this.object === null}
                        @click="${this.reloadClick}"
                        style="display: ${this.showReloadButton ? 'flex' : 'none'}"
                        title="${this.reloadButtonTitle}">
                        <dbp-icon name="reload"></dbp-icon>
                    </a>
                </div>
                <div id="room-select-dropdown"></div>
            </div>
        `;
    }
}
