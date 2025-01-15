import {css, html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import {DbpBaseElement} from './base.js';

export class DbpCheckboxElement extends ScopedElementsMixin(DbpBaseElement) {
    constructor() {
        super();
        this.label = 'A checkbox field';
        this.checked = false;
        this.dataValue = '';
    }

    static get properties() {
        return {
            ...super.properties,
            checked: {type: Boolean},
            dataValue: {type: String, attribute: 'data-value', reflect: true},
        };
    }

    static get styles() {
        return [
            ...super.styles,
            css`
                .checkboxItem {
                    display: flex;
                    align-items: center;
                    column-gap: 4px;
                    width: fit-content;
                    line-height: 1;
                    cursor: pointer;
                    font-weight: normal;
                }

                .checkboxItem:not(:last-of-type) {
                    margin-bottom: 16px;
                }

                .checkbox {
                    appearance: none;
                    position: relative;
                    width: 20px;
                    height: 20px;
                    border: 1px solid var(--dbp-info-surface);
                    border-radius: 2px;
                    cursor: pointer;
                    margin-left: 0;
                }

                .checkbox:checked {
                    background-color: var(--dbp-info-surface);
                }

                .checkbox:checked::after {
                    content: "";
                    position: absolute;
                    top: 5px;
                    left: 3px;
                    width: 12px;
                    height: 6px;
                    border-bottom: 2px solid #ffffff;
                    border-left: 2px solid #ffffff;
                    transform: rotate(-45deg);
                }
            `
        ];
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'checked':
                    // Mimic the behavior of a real checkbox
                    this.dataValue = this.checked ? this.value : '';
                    break;
            }
        });

        super.update(changedProperties);
    }

    handleInputValue(e) {
        this.checked = e.target.checked;
    }

    render() {
        // Regenerate error messages in case the language has changed
        this.handleErrorsIfAny();

        return html`
            <fieldset>
                <label for="${this.id}">
                    ${this.label}
                    ${this.required ? html`(${this._i18n.t('render-form.base-object.required-field')})` : html``}
                </label>
                ${this.renderInput()}
                ${this.renderErrorMessages()}
            </fieldset>
        `;
    }

    renderInput() {
        return html`
            <label class="checkboxItem">
                <input
                    type="checkbox"
                    id="${this.id}"
                    name="${this.name}"
                    class="checkbox"
                    ?checked="${this.checked}"
                    @input="${this.handleInputValue}"
                    ?required=${this.isRequired} />
                ${this.description}
            </label>
        `;
    }
}

commonUtils.defineCustomElement('dbp-checkbox-element', DbpCheckboxElement);
