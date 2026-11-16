import {html} from 'lit';
import * as commonUtils from '@dbp-toolkit/common/utils.js';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {DbpBaseElement} from '@dbp-toolkit/form-elements/src/base-element.js';
import {ResourceSelect} from '@dbp-toolkit/resource-select';
import {createInstance} from '../../i18n.js';
import {DbpPersonSelectElement as BasePersonSelectElement} from '@dbp-toolkit/form-elements/src/elements/person-select.js';

export class PersonSelect extends ResourceSelect {
    constructor() {
        super();
        this._personI18n = createInstance();
        this.resourcePath = '/base/people';
        this.fetchMode = 'search';
        this.placeholder = this._getPersonPlaceholder();
    }

    update(changedProperties) {
        if (changedProperties.has('lang')) {
            void this._personI18n.changeLanguage(this.lang);
            this.placeholder = this._getPersonPlaceholder();
        }

        super.update(changedProperties);
    }

    _getPersonPlaceholder() {
        return this._personI18n.t('render-form.person-select.placeholder');
    }

    getCollectionQueryParameters(select) {
        return {
            sort: 'familyName',
            preparedFilter: 'staffAccountsOnly',
            includeLocal: 'email',
        };
    }

    getSearchQueryParameters(select, searchTerm) {
        return {
            search: searchTerm.trim(),
        };
    }

    getItemQueryParameters(select) {
        return {
            includeLocal: 'email',
        };
    }

    formatResource(select, person) {
        let text = person.givenName ?? '';
        if (person.familyName) {
            text += ` ${person.familyName}`;
        }

        const localDataText = this.formatLocalData(person);
        if (localDataText) {
            text += ` ${localDataText}`;
        }

        return text;
    }

    formatLocalData(person) {
        const attributes = person.localData ?? {};
        if (Object.values(attributes).length === 0) {
            return '';
        }

        return `(${Object.values(attributes).join(', ')})`;
    }
}

export class DbpPersonSelectElement extends ScopedElementsMixin(DbpBaseElement) {
    constructor() {
        super();
    }

    static get properties() {
        return {
            ...super.properties,
        };
    }

    static get scopedElements() {
        return {
            'dbp-person-resource-select': PersonSelect,
        };
    }

    handleInputValue(e) {
        e.stopPropagation();

        const personDataObject = e.detail.object;
        // Specify the value to be included in the form submission
        if (personDataObject != null) {
            let name = `${personDataObject.givenName} ${personDataObject.familyName}`;
            let email = `${personDataObject.localData.email}`;
            this.value = name + ' ' + email;
        } else {
            this.value = '';
        }

        // fire a change event
        this.dispatchEvent(
            new CustomEvent('change', {
                detail: {
                    value: personDataObject,
                },
                bubbles: true,
                composed: true,
            }),
        );
    }

    renderInput() {
        return html`
            <div class="control">
                <dbp-person-resource-select
                    id="${this.name}-picker"
                    name="${this.name}Picker"
                    subscribe="lang, auth, entry-point-url"
                    @change="${this.handleInputValue}"></dbp-person-resource-select>
            </div>
        `;
    }
}

/**
 * Person select used by the ethics commission form. It extends the toolkit person select
 * so the dropdown entries of the applicant and co-applicants also show their email address.
 */
export class ProjectPersonSelectElement extends BasePersonSelectElement {
    getPersonSearchQueryParameters(select, searchTerm) {
        return {
            search: searchTerm.trim(),
            sort: 'familyName',
            includeLocal: 'email',
        };
    }

    getPersonItemQueryParameters(select) {
        return {
            includeLocal: 'email',
        };
    }

    formatPerson(select, person) {
        let text = person.givenName ?? '';

        if (person.familyName) {
            text += ` ${person.familyName}`;
        }

        const email = person.localData?.email;
        return email ? `${text} (${email})` : text;
    }

    renderInput() {
        return html`
            <dbp-resource-select
                .auth=${this.auth ?? {}}
                .multiple=${this.multiple}
                .values=${this.getPersonSelectValues()}
                ?disabled=${this.disabled}
                lang="${this.lang}"
                resource-path="/base/people"
                fetch-mode="search"
                .getSearchQueryParameters=${this.getPersonSearchQueryParameters}
                .getItemQueryParameters=${this.getPersonItemQueryParameters}
                .formatResource=${this.formatPerson}
                @change=${this.handlePersonChange}
                entry-point-url="${this.entryPointUrl}"></dbp-resource-select>
        `;
    }
}

commonUtils.defineCustomElement('dbp-person-select-element', DbpPersonSelectElement);
commonUtils.defineCustomElement('dbp-project-person-select-element', ProjectPersonSelectElement);
