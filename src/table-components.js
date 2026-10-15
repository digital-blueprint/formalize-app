import {html, css} from 'lit';
import {createInstance} from './i18n.js';
import {ScopedElementsMixin, Icon, IconButton, DBPSelect} from '@dbp-toolkit/common';
import {TabulatorTable} from '@dbp-toolkit/tabulator-table';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';

const ROW_ACTIONS_MENU_OFFSET = 4;
const ROW_ACTIONS_MENU_VIEWPORT_MARGIN = 8;

/**
 * Kebab menu with the actions of a single table row.
 *
 * It reuses the keyboard handling and the `change` event of `dbp-select`, but renders an
 * icon-only trigger. The menu is shown as a popover in the top layer, so it isn't clipped
 * by the overflow of the table cell, and is positioned next to the trigger.
 *
 * The `label` is used as accessible name and tooltip of the trigger and should name the row.
 */
export class RowActionsMenu extends DBPSelect {
    constructor() {
        super();
        this.align = 'right';
        this._skipTriggerFocus = false;
        this._onViewportChange = (event) => {
            // Scrolling inside the menu itself must not close it
            if (event?.type === 'scroll' && event.composedPath?.().includes(this.renderRoot)) {
                return;
            }
            this._closeWithoutFocus();
        };

        // Clicks and key presses must not select the table row or trigger table key bindings
        this.addEventListener('click', (event) => event.stopPropagation());
        this.addEventListener('keydown', (event) => {
            if (this.open) {
                event.stopPropagation();
            }
        });
    }

    disconnectedCallback() {
        this._closeWithoutFocus();
        super.disconnectedCallback();
    }

    _closeWithoutFocus() {
        this._skipTriggerFocus = true;
        try {
            this.closeMenu();
        } finally {
            this._skipTriggerFocus = false;
        }
    }

    _focusTrigger() {
        // Moving the focus back is only wanted if the menu was closed by the user
        if (!this._skipTriggerFocus) {
            super._focusTrigger();
        }
    }

    _bindOutside() {
        super._bindOutside();
        window.addEventListener('scroll', this._onViewportChange, true);
        window.addEventListener('resize', this._onViewportChange);
    }

    _unbindOutside() {
        super._unbindOutside();
        window.removeEventListener('scroll', this._onViewportChange, true);
        window.removeEventListener('resize', this._onViewportChange);
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('open') && this.open) {
            const menu = /** @type {HTMLElement | null} */ (this.renderRoot.querySelector('.menu'));
            if (!menu) return;
            if (typeof menu.showPopover === 'function' && !menu.matches(':popover-open')) {
                menu.showPopover();
            }
            this._positionMenu(menu);
        }
    }

    /**
     * Places the menu below the trigger, aligned to its right edge. It opens above the
     * trigger if there isn't enough space below and is kept inside the viewport.
     *
     * @param {HTMLElement} menu
     */
    _positionMenu(menu) {
        const trigger = this.renderRoot.querySelector('.trigger');
        if (!trigger) return;

        const triggerRect = trigger.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const margin = ROW_ACTIONS_MENU_VIEWPORT_MARGIN;

        let top = triggerRect.bottom + ROW_ACTIONS_MENU_OFFSET;
        const topAbove = triggerRect.top - ROW_ACTIONS_MENU_OFFSET - menuRect.height;
        if (top + menuRect.height > window.innerHeight - margin && topAbove >= margin) {
            top = topAbove;
        }

        const left = Math.min(
            Math.max(margin, triggerRect.right - menuRect.width),
            Math.max(margin, window.innerWidth - margin - menuRect.width),
        );

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
    }

    static get styles() {
        // language=css
        return css`
            ${super.styles}

            :host {
                vertical-align: middle;
            }

            .trigger.button.is-icon {
                min-height: 0;
                border: 0 none;
                font-size: 1.2rem;
                justify-content: center;
            }

            .menu {
                position: fixed;
                inset: auto;
                margin: 0;
                overflow: visible;
                color: var(--dbp-content);
            }

            .item-button {
                white-space: nowrap;
            }
        `;
    }

    render() {
        return html`
            <div class="select-container">
                <button
                    id="action-trigger-button"
                    class="trigger button is-icon"
                    part="trigger"
                    type="button"
                    title="${this.label}"
                    aria-label="${this.label}"
                    @click=${this.toggle}
                    @keydown=${this._onTriggerKeydown}
                    ?disabled=${this.disabled}
                    aria-haspopup="menu"
                    aria-expanded=${String(this.open)}
                    aria-controls="action-dropdown">
                    <dbp-icon name="menu-dots" aria-hidden="true"></dbp-icon>
                </button>

                ${
                    this.open
                        ? html`
                              <ul
                                  id="action-dropdown"
                                  class="menu"
                                  part="menu"
                                  role="menu"
                                  popover="manual"
                                  aria-labelledby="action-trigger-button"
                                  @keydown=${this._onMenuKeydown}>
                                  ${this.options.map(
                                      (option) => html`
                                          <li role="none">
                                              <button
                                                  class="item-button button"
                                                  type="button"
                                                  role="menuitem"
                                                  data-value=${String(option.value)}
                                                  @click=${this._onItemClick}
                                                  ?disabled=${option.disabled ?? false}>
                                                  ${
                                                      option.iconName
                                                          ? html`
                                                                <dbp-icon
                                                                    name=${option.iconName}
                                                                    aria-hidden="true"></dbp-icon>
                                                            `
                                                          : null
                                                  }
                                                  <span>${option.label}</span>
                                              </button>
                                          </li>
                                      `,
                                  )}
                              </ul>
                          `
                        : null
                }
            </div>
        `;
    }
}

/**
 * Creates a row actions menu that runs the handler of the selected option.
 *
 * @param {{createScopedElement: (tagName: string) => HTMLElement}} host - Element whose scoped registry contains `dbp-formalize-row-actions-menu`.
 * @param {string} label - Accessible name of the menu trigger, which should name the row.
 * @param {Array<{value: string, label: string, iconName?: string, handler: (event: Event|null) => void}>} actions
 * @returns {HTMLElement}
 */
export function createRowActionsMenu(host, label, actions) {
    const menu = /** @type {RowActionsMenu} */ (
        host.createScopedElement('dbp-formalize-row-actions-menu')
    );
    menu.setAttribute('subscribe', 'lang');
    menu.label = label;
    menu.options = actions.map(({handler, ...option}) => option);
    menu.addEventListener('change', (event) => {
        // The selection is handled here, so it must not reach change listeners of the page
        event.stopPropagation();
        const detail = /** @type {CustomEvent} */ (event).detail;
        const action = actions.find((candidate) => candidate.value === detail?.value);
        action?.handler(detail?.originalEvent ?? null);
    });
    return menu;
}

export class CustomTabulatorTable extends TabulatorTable {
    static get scopedElements() {
        return {
            ...super.scopedElements,
            'dbp-formalize-get-details-button': GetDetailsButton,
            'dbp-formalize-get-submission-link': GetSubmissionLink,
            'dbp-formalize-row-actions-menu': RowActionsMenu,
        };
    }

    static get styles() {
        return [
            TabulatorTable.styles,
            css`
                :host {
                    display: block;
                }
            `,
        ];
    }
}

export class GetDetailsButton extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.title = '';
        this.ariaLabel = '';
        this.iconName = 'keyword-research';
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            title: {type: String},
            iconName: {type: String, attribute: 'icon-name'},
            ariaLabel: {type: String, attribute: 'aria-label'},
        };
    }

    static get scopedElements() {
        return {
            'dbp-icon-button': IconButton,
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    void this._i18n.changeLanguage(this.lang);
                    break;
            }
        });

        super.update(changedProperties);
    }

    static get styles() {
        return css`
            dbp-icon-button {
                font-size: 20px;
            }
        `;
    }

    render() {
        // The title and aria-label are already translated by the caller, so they must not be
        // passed through t() again: i18next would treat a ":" in the text as a namespace
        // separator and return only the part after it.
        return html`
            <dbp-icon-button
                icon-name="${this.iconName}"
                title="${this.title}"
                aria-label="${this.ariaLabel}"></dbp-icon-button>
        `;
    }
}

export class GetSubmissionLink extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.title = '';
        this.ariaLabel = '';
        this.iconName = 'keyword-research';
        this.submissionUrl = '';
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            title: {type: String},
            iconName: {type: String, attribute: 'icon-name'},
            submissionUrl: {type: String, attribute: 'submission-url'},
            ariaLabel: {type: String, attribute: 'aria-label'},
        };
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    void this._i18n.changeLanguage(this.lang);
                    break;
            }
        });

        super.update(changedProperties);
    }

    static get styles() {
        return css`
            :host {
                display: inline-block;
            }
            a {
                display: flex;
                text-decoration: none;
                height: 40px;
                width: 40px;
                line-height: 40px;
                color: var(--dbp-content);
                justify-content: center;
                color: currentColor;
            }
            dbp-icon {
                font-size: 24px;
                flex-shrink: 0;
                flex-grow: 0;
            }
        `;
    }

    render() {
        // The title and aria-label are already translated by the caller, so they must not be
        // passed through t() again: i18next would treat a ":" in the text as a namespace
        // separator and return only the part after it.
        return html`
            <a href="${this.submissionUrl}" target="_blank" rel="noopener noreferrer">
                <dbp-icon
                    name="${this.iconName}"
                    title="${this.title}"
                    aria-label="${this.ariaLabel}"></dbp-icon>
            </a>
        `;
    }
}
