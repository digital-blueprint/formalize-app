import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html, css} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import {getMediaTransparencyFormCSS} from '../styles.js';
import {Translated, sendNotification} from '@dbp-toolkit/common';
import {Modal} from '@dbp-toolkit/common/src/modal.js';
import {FileSource, FileSink} from '@dbp-toolkit/file-handling';
import {
    DbpStringElement,
    DbpDateElement,
    DbpBooleanElement,
    DbpEnumElement,
    DbpStringView,
    DbpDateView,
    DbpEnumView,
} from '@dbp-toolkit/form-elements';
import {
    getFormRenderUrl,
    getDeletionConfirmation,
    handleDeletionConfirm,
    handleDeletionCancel,
    SUBMISSION_STATES,
    SUBMISSION_STATES_BINARY,
} from '../utils.js';
import {validateRequiredFields} from '@dbp-toolkit/form-elements/src/utils.js';

const OTHER_MEDIA_VALUE = 'Sonstiges';

/**
 * Lookup maps: camelCase key → full i18n translation key.
 * Keep in sync with MEDIA_NAME_OWNER_MAPPING.
 */
const SUBCATEGORY_TRANSLATION_KEYS = {
    // online subcategories
    Audio: 'render-form.forms.media-transparency-form.sub-categories-audio',
    App: 'render-form.forms.media-transparency-form.sub-categories-app',
    'Soziales Netzwerk': 'render-form.forms.media-transparency-form.sub-categories-social-media',
    Website: 'render-form.forms.media-transparency-form.sub-categories-website',
    Text: 'render-form.forms.media-transparency-form.sub-categories-text',
    Video: 'render-form.forms.media-transparency-form.sub-categories-video',
    Sonstiges: 'render-form.forms.media-transparency-form.sub-categories-else',
    // outOfHome subcategories
    Plakat: 'render-form.forms.media-transparency-form.sub-categories-billboard',
    Verkehrsmittel: 'render-form.forms.media-transparency-form.sub-categories-transportation',
    'Digitaler Screen': 'render-form.forms.media-transparency-form.sub-categories-digital-screen',
    // outdoorAdvertising:
    //     'render-form.forms.media-transparency-form.sub-categories-outdoor-advertising',
    Kino: 'render-form.forms.media-transparency-form.sub-categories-cinema',
};

const CATEGORY_TRANSLATION_KEYS = {
    Online: 'render-form.forms.media-transparency-form.categories-online',
    Print: 'render-form.forms.media-transparency-form.categories-print',
    'Out of Home': 'render-form.forms.media-transparency-form.categories-out-of-home',
    Hörfunk: 'render-form.forms.media-transparency-form.categories-radio',
    Fernsehen: 'render-form.forms.media-transparency-form.categories-television',
};

/**
 * Never called at runtime. The i18next-cli extractor uses static analysis and
 * only preserves keys it finds as string literals in t() calls. Since the keys
 * above are used via dynamic lookup (not direct t() calls), they would be
 * pruned by `i18next:fix`. This function prevents that. Do not remove.
 */
// eslint-disable-next-line no-unused-vars
const _i18nExtractKeys = (t) => {
    // subcategory keys — keep in sync with SUBCATEGORY_TRANSLATION_KEYS
    t('render-form.forms.media-transparency-form.sub-categories-audio');
    t('render-form.forms.media-transparency-form.sub-categories-app');
    t('render-form.forms.media-transparency-form.sub-categories-social-media');
    t('render-form.forms.media-transparency-form.sub-categories-website');
    t('render-form.forms.media-transparency-form.sub-categories-text');
    t('render-form.forms.media-transparency-form.sub-categories-video');
    t('render-form.forms.media-transparency-form.sub-categories-else');
    t('render-form.forms.media-transparency-form.sub-categories-billboard');
    t('render-form.forms.media-transparency-form.sub-categories-transportation');
    t('render-form.forms.media-transparency-form.sub-categories-digital-screen');
    t('render-form.forms.media-transparency-form.sub-categories-outdoor-advertising');
    t('render-form.forms.media-transparency-form.sub-categories-cinema');
    // category keys — keep in sync with CATEGORY_TRANSLATION_KEYS
    t('render-form.forms.media-transparency-form.categories-online');
    t('render-form.forms.media-transparency-form.categories-print');
    t('render-form.forms.media-transparency-form.categories-out-of-home');
    t('render-form.forms.media-transparency-form.categories-radio');
    t('render-form.forms.media-transparency-form.categories-television');
};

/**
 * Mapping of category → subcategory → mediaName → mediaOwnerName driven by CSV data.
 * Keys use form enum lowerCamelCase values for category and subcategory.
 * Categories with subcategories use subcategory keys directly.
 * Categories without subcategories use the sentinel key `_items` for their media names.
 */
export const MEDIA_NAME_OWNER_MAPPING = {
    Online: {
        Audio: {
            'Amazon Music': 'Amazon.com, Inc.',
            'Antenna Pod': 'Antenna Pod',
            'Apple Podcasts': 'Apple Inc.',
            Deezer: 'Deezer S.A.',
            fyyd: 'Christian Bednarek',
            'Listen Notes': 'Listen Notes, Inc.',
            'Pocket Casts': 'Automattic, Inc.',
            Spotify: 'Spotify AB',
        },
        App: {
            'Google Play': 'Google LLC',
            iTunes: 'Apple Inc.',
            'Podcast Addict': 'Guillemane Xavier - Podcast & Radio Addict',
        },
        'Soziales Netzwerk': {
            Facebook: 'Meta Platforms Ireland Limited',
            Instagram: 'Meta Platforms Ireland Limited',
            LinkedIn: 'LinkedIn Ireland Unlimited Company',
            Snapchat: 'Snap Inc.',
            'X (Twitter)': 'X Corp.',
            YouTube: 'Google Ireland Limited',
        },
        Website: {
            'c.socceruhd.online': 'socceruhd.online',
            'e-flux.com': 'e-flux Inc.',
            'google.com': 'Google Ireland Limited',
            'grazer.at': 'Media 21 GmbH',
            'industriemagazin.at': 'WEKA Industrie Medien GmbH',
            'kleinezeitung.at': 'Kleine Zeitung GmbH & Co KG',
            'science.apa.at': 'APA - Austria Presse Agentur eG',
            'spiritofstyria.at': 'GRAZETTA GmbH',
        },
        Text: {
            'Industriemagazin Newsletter': 'WEKA Industrie Medien GmbH',
            'Newsletter Automobil + Motoren': 'Springer Fachmedien Wiesbaden GmbH',
        },
        Video: {},
        Sonstiges: {},
    },
    Print: {
        _items: {
            'ADDITIVE FERTIGUNG': 'x-Technik IT & Medien GesmbH',
            Bildungsguide: 'Tamedia Publikationen Deutschschweiz AG',
            'COOL! Mädchen': 'Gonzomedia GesmbH',
            DerGrazer: 'Media 21 GmbH',
            'Die Presse': '"Die Presse" Verlags-Gesellschaft m.b.H. & Co KG',
            Forschung: 'STANDARD Verlagsgesellschaft m.b.H.',
            'Jahresbericht Bundesrealgymnasium 8010 Graz, Petersgasse 110':
                'Bundesrealgymnasium 8010 Graz, Petersgasse 110',
            'Jahresbericht Höhere technische Bundeslehranstalt 5280 Braunau am Inn, Osternbergerstraße 55':
                'Höhere technische Bundeslehranstalt 5280 Braunau am Inn, Osternbergerstraße 55',
            'KLEINE ZEITUNG': 'Kleine Zeitung GmbH & Co KG',
            'Maturazeitung Bundes-Oberstufenrealgymnasium 8010 Graz, Monsbergergasse 16':
                'Bundes-Oberstufenrealgymnasium 8010 Graz, Monsbergergasse 16',
            'Maturazeitung Bundesgymnasium, Bundesrealgymnasium und Bundes-Oberstufenrealgymnasium (HIB) 8041 Graz-Liebenau, Kadettengasse 19-23':
                'Bundesgymnasium, Bundesrealgymnasium und Bundes-Oberstufenrealgymnasium (HIB) 8041 Graz-Liebenau, Kadettengasse 19-23',
            'Maturazeitung Höhere technische Bundeslehr- und Versuchsanstalt 7423 Pinkafeld, Meierhofplatz 1':
                'Höhere technische Bundeslehr- und Versuchsanstalt 7423 Pinkafeld, Meierhofplatz 1',
            'Maturazeitung Höhere technische Bundeslehranstalt 8051 Graz-Gösting, Ibererstraße 15-21':
                'Höhere technische Bundeslehranstalt 8051 Graz-Gösting, Ibererstraße 15-21',
            'Maturazeitung Höhere technische Bundeslehranstalt 8430 Leibnitz, Kaindorf, Grazer Straße 202':
                'Höhere technische Bundeslehranstalt 8430 Leibnitz, Kaindorf, Grazer Straße 202',
            MEGAPHON: 'Caritas der Diözese Graz-Seckau',
            MTZ: 'Springer Fachmedien Wiesbaden GmbH',
            'Rebell*innen Kalender':
                'AMAZONE, Verein zur Herstellung von Geschlechtergerechtigkeit',
            sheconomy: 'SHE Wirtschaftsmedien Beteiligungs GmbH',
            'Spirit OF STYRIA': 'SPIRIT Medienhaus GmbH',
            'Verkehrsmalbuch für Kinder': 'IPA Verlagsgesellschaft m.b.H.',
            'Weekend Magazin Steiermark': 'Weekend Magazin Steiermark GmbH',
            ZukunftsBranchen: 'Weber Ulrich, "WeberMedia"',
        },
    },
    'Out of Home': {
        // poster: {},
        Plakat: {
            Ankünder: 'Ankünder GmbH',
            'BS Vertriebsagentur e.U.': 'BS Vertriebsagentur e.U.',
            'City Light': 'City Light Ankünder GmbH',
            'GFW Gesellschaft für Wirtschaftsdokumentationen':
                'GFW Gesellschaft für Wirtschaftsdokumentationen Gesellschaft m.b.H. & Co. KG',
        },
        Verkehrsmittel: {
            'Ankünder GmbH': 'Ankünder GmbH',
        },
        'Digitaler Screen': {},
        outdoorAdvertising: {},
        Kino: {},
        Sonstiges: {
            'CompanyCode Werbe GmbH': 'CompanyCode Werbe GmbH',
            'Grazetta GmbH': 'Grazetta GmbH',
        },
    },
    Fernsehen: {
        _items: {
            'ORF 2': 'Österreichischer Rundfunk',
        },
    },
    Hörfunk: {
        _items: {},
    },
};
export default class extends BaseObject {
    getUrlSlug() {
        return 'media-transparency';
    }

    /**
     * Returns the form component class for the media transparency form.
     *
     * @returns {typeof BaseFormElement} The class of the form component.
     */
    getFormComponent() {
        return FormalizeFormElement;
    }

    getFormIdentifier() {
        return '019bdb56-6fc7-760d-938a-b128a89958a8';
    }
}

class FormalizeFormElement extends BaseFormElement {
    constructor() {
        super();

        // Advertisement category/media related
        this.selectedCategory = null;
        this.otherMediumNameEnabled = false;

        // Conditional fields
        this.conditionalFields = {
            category: false,
            advertisementSubcategory: false,
            mediaName: false,
        };

        // Event handlers
        this.handleFormSubmission = this.handleFormSubmission.bind(this);
        this.handleSaveDraft = this.handleSaveDraft.bind(this);
        this.handleFormSaveSubmission = this.handleFormSaveSubmission.bind(this);
    }

    static get properties() {
        return {
            ...super.properties,

            selectedCategory: {type: String, attribute: false},
            otherMediumNameEnabled: {type: Boolean, attribute: false},
        };
    }

    static get scopedElements() {
        return {
            ...super.scopedElements,
            'dbp-form-string-element': DbpStringElement,
            'dbp-form-date-element': DbpDateElement,
            'dbp-form-boolean-element': DbpBooleanElement,
            'dbp-form-enum-element': DbpEnumElement,
            'dbp-form-string-view': DbpStringView,
            'dbp-form-date-view': DbpDateView,
            'dbp-form-enum-view': DbpEnumView,
            'dbp-translated': Translated,
            'dbp-modal': Modal,
            'dbp-file-source': FileSource,
            'dbp-file-sink': FileSink,
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Event listener for form submission
            this.addEventListener('DbpFormalizeFormSubmission', this.handleFormSubmission);
            // Event listener for saving draft
            this.addEventListener('DbpFormalizeFormSaveDraft', this.handleSaveDraft);
            // Event listener for delete submission
            this.addEventListener(
                'DbpFormalizeFormDeleteSubmission',
                this.handleFormDeleteSubmission,
            );
            // Listen to the event from file source
            this.addEventListener('dbp-file-source-file-selected', this.handleFilesToSubmit);
            // Event listener for save/PATCH submission
            this.addEventListener('DbpFormalizeFormSaveSubmission', this.handleFormSaveSubmission);
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('DbpFormalizeFormSubmission', this.handleFormSubmission);
        this.removeEventListener('DbpFormalizeFormSaveDraft', this.handleSaveDraft);
        this.removeEventListener('DbpFormalizeFormSaveSubmission', this.handleFormSaveSubmission);
        this.removeEventListener(
            'DbpFormalizeFormDeleteSubmission',
            this.handleFormDeleteSubmission,
        );
        this.removeEventListener('dbp-file-source-file-selected', this.handleFilesToSubmit);
    }

    async update(changedProperties) {
        super.update(changedProperties);
        const i18n = this._i18n;

        // console.log('changedProperties', changedProperties);

        if (changedProperties.has('data')) {
            if (Object.keys(this.data).length > 0) {
                await this.processFormData();
            }
            // this.initializeFileGroups();
            this.setButtonStates();

            // @ts-ignore
            this.updateComplete.then(async () => {
                await this.processConditionalFields();
                // If query parameter 'validate' is set to true, validate required fields
                const urlParams = new URLSearchParams(window.location.search);
                if (this.readOnly === false && urlParams.get('validate') === 'true') {
                    const formElement = this.shadowRoot.querySelector('form');
                    this.isFormValid = await validateRequiredFields(formElement);

                    // Validate minimum file upload counts
                    const fileValidation = this.validateMinimumFileUploads();
                    if (!fileValidation.isValid) {
                        this.isFormValid = false;
                        const failed = fileValidation.failedGroups[0];
                        sendNotification({
                            summary: i18n.t('errors.error-title'),
                            body: i18n.t(
                                'render-form.forms.media-transparency-form.min-file-upload-error',
                                {currentCount: failed.currentCount, minCount: failed.minCount},
                            ),
                            type: 'warning',
                            timeout: 5,
                        });
                    }

                    if (!this.isFormValid) {
                        this.scrollToFirstInvalidField(formElement, true);
                        // Show notification
                        sendNotification({
                            summary: i18n.t('errors.warning-title'),
                            body: i18n.t('errors.form-validation-warning-notification-body'),
                            type: 'warning',
                            timeout: 5,
                        });
                    }
                }
            });
        }
    }

    async updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('data')) {
            // Reset observer so it can re-attach if needed
            this._formHeaderObserved = false;
            this.stickyHeaderObserver();
        }
    }

    static get styles() {
        return [
            super.styles,
            // language=css
            css`
                @layer theme, utility, formalize, print;
                @layer theme {
                    ${commonStyles.getGeneralCSS(false)}
                    ${commonStyles.getButtonCSS()}
                    ${commonStyles.getModalDialogCSS()}
                }
                @layer formalize {
                    ${getMediaTransparencyFormCSS()}
                }
            `,
        ];
    }

    async processFormData() {
        const i18n = this._i18n;
        try {
            this.currentSubmission = this.data;

            this.submissionId = this.data.identifier;
            this.lastModifiedCreatorId = this.data.lastModifiedById;
            this.formData = JSON.parse(this.data.dataFeedElement);
            this.submissionBinaryState = this.data.submissionState;
            this.submissionGrantedActions = this.data.grantedActions;
            this.selectedTags = this.data.tags;

            // Initialize subcategory items if category is already set
            if (this.formData?.category) {
                this.setSubcategoryItemsByCategoryValue(this.formData.category);
            }

            // Initialize media name items if subcategory is already set
            if (this.formData?.advertisementSubcategory) {
                this.setMediaNameItemsByValue(this.formData.advertisementSubcategory);
            }

            // Set conditional field for mediaName if 'Sonstiges' is selected
            if (this.formData?.mediaName === OTHER_MEDIA_VALUE) {
                this.conditionalFields.mediaName = true;
            }

            // Initialize file groups from schema
            this.initializeFileGroups();

            // Process submitted files by group
            const submittedFiles = {};
            for (const file of this.data.submittedFiles) {
                if (!submittedFiles[file.fileAttributeName]) {
                    submittedFiles[file.fileAttributeName] = [];
                }
                submittedFiles[file.fileAttributeName].push(file);
            }

            this.fileUploadCounts = {};
            for (const [fileGroup, files] of Object.entries(submittedFiles)) {
                this.fileUploadCounts[fileGroup] = files.length;
                // Get or create the file group structure (handles catch-all schemas)
                const groupData = this.getOrCreateFileGroup(fileGroup);
                groupData.submittedFiles = await this.transformApiResponseToFile(files);
            }

            switch (Number(this.submissionBinaryState)) {
                case 1:
                    this.currentState = SUBMISSION_STATES.DRAFT;
                    break;
                case 4:
                    this.currentState = SUBMISSION_STATES.SUBMITTED;
                    break;
                default:
                    this.currentState = null;
                    break;
            }

            if (this.formData) {
                try {
                    const lastModifierDetailsResponse = await this.apiGetUserDetails(
                        this.lastModifiedCreatorId,
                    );
                    if (!lastModifierDetailsResponse.ok) {
                        sendNotification({
                            summary: i18n.t('errors.error-title'),
                            body: i18n.t('errors.failed-to-get-last-modifier-details', {
                                status: lastModifierDetailsResponse.status,
                            }),
                            type: 'danger',
                            timeout: 0,
                        });
                    } else {
                        const lastModifierDetails = await lastModifierDetailsResponse.json();
                        this.lastModifiedCreatorName = `${lastModifierDetails?.givenName} ${lastModifierDetails?.familyName}`;
                    }
                } catch (e) {
                    console.log(e);
                    sendNotification({
                        summary: i18n.t('errors.error-title'),
                        body: i18n.t('errors.failed-to-get-last-modifier-details'),
                        type: 'danger',
                        timeout: 0,
                    });
                }
            }
        } catch (e) {
            console.error('Error parsing submission data:', e);
        }
    }

    /**
     * Handle saving submission.
     * @param {object} event - The event object containing the form data.
     */
    async handleFormSubmission(event) {
        const i18n = this._i18n;
        // Access the data from the event detail
        const data = event.detail;

        // Validate minimum file upload counts
        const fileValidation = this.validateMinimumFileUploads();
        if (!fileValidation.isValid) {
            const failed = fileValidation.failedGroups[0]; // Show first failure
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: `${i18n.t('render-form.forms.media-transparency-form.min-file-upload-error', {currentCount: failed.currentCount, minCount: failed.minCount})}`,
                type: 'danger',
                timeout: 5,
            });
            this.saveButtonEnabled = true;
            return;
        }

        // POST or PATCH
        let isExistingDraft = false;
        if (data.submissionId) {
            isExistingDraft = true;
        }

        // Include unique identifier for person who first submitted the form (creator)
        data.formData.identifier = isExistingDraft
            ? this.lastModifiedCreatorId
            : this.auth['user-id'];

        // Clean up empty date fields to avoid JSON Schema validation errors
        const dateFields = ['atFrom', 'to', 'reportingDeadline'];
        dateFields.forEach((field) => {
            if (
                data.formData[field] === '' ||
                data.formData[field] === null ||
                data.formData[field] === undefined
            ) {
                delete data.formData[field];
            }
        });

        const formData = new FormData();

        // Iterate over all file groups dynamically
        for (const [fileGroup, groupData] of Object.entries(this.filesByGroup)) {
            // Set files to upload for this group
            if (groupData.filesToSubmit.size > 0) {
                groupData.filesToSubmit.forEach((fileToAttach) => {
                    formData.append(`${fileGroup}[]`, fileToAttach, fileToAttach.name);
                });
            }

            // Set files to remove for this group
            if (groupData.filesToRemove.size > 0) {
                groupData.filesToRemove.forEach((fileObject, fileIdentifier) => {
                    formData.append(`submittedFiles[${fileIdentifier}]`, 'null');
                });
            }
        }

        formData.append('form', '/formalize/forms/' + this.formIdentifier);
        formData.append('dataFeedElement', JSON.stringify(data.formData));
        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.SUBMITTED));
        // Add tags
        const selectedTags = Object.values(this.selectedTags);
        formData.append('tags', JSON.stringify(selectedTags));

        const method = isExistingDraft ? 'PATCH' : 'POST';
        const options = this._buildRequestOptions(formData, method);
        const url = this._buildSubmissionUrl(isExistingDraft ? this.submissionId : null);

        // Backup all file groups in case of error
        const filesByGroupBackup = {};
        for (const [fileGroup, groupData] of Object.entries(this.filesByGroup)) {
            filesByGroupBackup[fileGroup] = {
                submittedFiles: new Map(groupData.submittedFiles),
                filesToSubmit: new Map(groupData.filesToSubmit),
                filesToRemove: new Map(groupData.filesToRemove),
            };
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                this.submissionError = true;
                await this.displayErrors(response);
            } else {
                this.submissionError = false;
                this.currentState = SUBMISSION_STATES.SUBMITTED;
                this.submitted = true;

                // Clear all file groups after successful submission
                for (const fileGroup of Object.keys(this.filesByGroup)) {
                    this.filesByGroup[fileGroup].filesToSubmit = new Map();
                    this.filesByGroup[fileGroup].filesToRemove = new Map();
                }

                // Hide form after successful submission
                this.hideForm = true;
                this.disableLeavePageWarning();

                sendNotification({
                    summary: i18n.t('success.success-title'),
                    body: i18n.t('success.form-submitted-successfully'),
                    type: 'success',
                    timeout: 5,
                });

                // formDataUpdated event to notify parent component
                this.dispatchEvent(
                    new CustomEvent('dbpFormDataUpdated', {
                        detail: {
                            needUpdate: true,
                        },
                        bubbles: true,
                        composed: true,
                    }),
                );
            }
        } catch (error) {
            console.error(error);
            // Restore all file groups if something went wrong
            for (const [fileGroup, backup] of Object.entries(filesByGroupBackup)) {
                this.filesByGroup[fileGroup] = backup;
            }

            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t('errors.unknown-error-on-form-submission'),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    /**
     * Handle save (PATCH) submission.
     * @param {object} event - The event object containing the form data.
     */
    async handleFormSaveSubmission(event) {
        const i18n = this._i18n;
        if (!event.detail.submissionId) return;

        const data = event.detail;
        // Include unique identifier for person who is submitting
        data.formData.identifier = this.lastModifiedCreatorId;
        // Clean up empty date fields to avoid JSON Schema validation errors
        const dateFields = ['atFrom', 'to', 'reportingDeadline'];
        dateFields.forEach((field) => {
            if (
                data.formData[field] === '' ||
                data.formData[field] === null ||
                data.formData[field] === undefined
            ) {
                delete data.formData[field];
            }
        });

        const formData = new FormData();

        // Iterate over all file groups dynamically
        for (const [fileGroup, groupData] of Object.entries(this.filesByGroup)) {
            // Set files to upload for this group
            if (groupData.filesToSubmit.size > 0) {
                groupData.filesToSubmit.forEach((fileToAttach) => {
                    formData.append(`${fileGroup}[]`, fileToAttach, fileToAttach.name);
                });
            }

            // Set files to remove for this group
            if (groupData.filesToRemove.size > 0) {
                groupData.filesToRemove.forEach((fileObject, fileIdentifier) => {
                    formData.append(`submittedFiles[${fileIdentifier}]`, 'null');
                });
            }
        }

        formData.append('dataFeedElement', JSON.stringify(data.formData));
        // Add tags
        const selectedTags = Object.values(this.selectedTags);
        formData.append('tags', JSON.stringify(selectedTags));

        const options = this._buildRequestOptions(formData, 'PATCH');
        const url = this._buildSubmissionUrl(event.detail.submissionId);

        // Backup all file groups in case of error
        const filesByGroupBackup = {};
        for (const [fileGroup, groupData] of Object.entries(this.filesByGroup)) {
            filesByGroupBackup[fileGroup] = {
                submittedFiles: new Map(groupData.submittedFiles),
                filesToSubmit: new Map(groupData.filesToSubmit),
                filesToRemove: new Map(groupData.filesToRemove),
            };
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                await this.displayErrors(response);
            } else {
                const responseBody = await response.json();
                // Process all submitted files by group
                const submittedFilesByGroup = {};
                for (const file of responseBody.submittedFiles) {
                    if (!submittedFilesByGroup[file.fileAttributeName]) {
                        submittedFilesByGroup[file.fileAttributeName] = [];
                    }
                    submittedFilesByGroup[file.fileAttributeName].push(file);
                }

                // Update each file group
                for (const [fileGroup, files] of Object.entries(submittedFilesByGroup)) {
                    const groupData = this.getOrCreateFileGroup(fileGroup);
                    groupData.submittedFiles = await this.transformApiResponseToFile(files);
                    groupData.filesToSubmit = new Map();
                    groupData.filesToRemove = new Map();
                }

                // formDataUpdated event to notify parent component
                this.dispatchEvent(
                    new CustomEvent('dbpFormDataUpdated', {
                        detail: {
                            needUpdate: true,
                        },
                        bubbles: true,
                        composed: true,
                    }),
                );

                sendNotification({
                    summary: i18n.t('success.success-title'),
                    body: i18n.t('success.form-saved-successfully'),
                    type: 'success',
                    timeout: 5,
                });
            }
        } catch (error) {
            // Restore all file groups if something went wrong
            for (const [fileGroup, backup] of Object.entries(filesByGroupBackup)) {
                this.filesByGroup[fileGroup] = backup;
            }

            this.requestUpdate();

            console.error(error);
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t('errors.unknown-error-on-save-submission'),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    /**
     * Handle saving draft submission.
     * @param {object} event - The event object containing the form data.
     */
    async handleSaveDraft(event) {
        const i18n = this._i18n;
        // Access the data from the event detail
        const data = event.detail;
        // const validationResult = data.validationResult;

        // POST or PATCH
        let isExistingDraft = false;
        if (data.submissionId) {
            isExistingDraft = true;
        }

        // Include unique identifier for person who last modified the form
        data.formData.identifier = isExistingDraft
            ? this.lastModifiedCreatorId
            : this.auth['user-id'];

        // Clean up empty date fields to avoid JSON Schema validation errors
        const dateFields = ['atFrom', 'to', 'reportingDeadline'];
        dateFields.forEach((field) => {
            if (
                data.formData[field] === '' ||
                data.formData[field] === null ||
                data.formData[field] === undefined
            ) {
                delete data.formData[field];
            }
        });

        const formData = new FormData();

        // Iterate over all file groups dynamically
        for (const [fileGroup, groupData] of Object.entries(this.filesByGroup)) {
            // Set files to upload for this group
            if (groupData.filesToSubmit.size > 0) {
                groupData.filesToSubmit.forEach((fileToAttach) => {
                    formData.append(`${fileGroup}[]`, fileToAttach, fileToAttach.name);
                });
            }

            // Set files to remove for this group
            if (groupData.filesToRemove.size > 0) {
                groupData.filesToRemove.forEach((fileObject, fileIdentifier) => {
                    formData.append(`submittedFiles[${fileIdentifier}]`, 'null');
                });
            }
        }

        formData.append('form', '/formalize/forms/' + this.formIdentifier);
        formData.append('dataFeedElement', JSON.stringify(data.formData));
        formData.append('submissionState', String(SUBMISSION_STATES_BINARY.DRAFT));
        // Add tags
        const selectedTags = Object.values(this.selectedTags);
        formData.append('tags', JSON.stringify(selectedTags));

        const method = isExistingDraft ? 'PATCH' : 'POST';
        const options = this._buildRequestOptions(formData, method);
        const url = this._buildSubmissionUrl(isExistingDraft ? this.submissionId : null);

        // Backup all file groups in case of error
        const filesByGroupBackup = {};
        for (const [fileGroup, groupData] of Object.entries(this.filesByGroup)) {
            filesByGroupBackup[fileGroup] = {
                submittedFiles: new Map(groupData.submittedFiles),
                filesToSubmit: new Map(groupData.filesToSubmit),
                filesToRemove: new Map(groupData.filesToRemove),
            };
        }

        try {
            const response = await fetch(url, options);
            let responseBody = await response.json();

            if (!response.ok) {
                sendNotification({
                    summary: i18n.t('errors.error-title'),
                    body: i18n.t('errors.failed-to-save-draft', {
                        status: response.status,
                        detail: responseBody.detail,
                    }),
                    type: 'danger',
                    timeout: 0,
                });
            } else {
                this.data = responseBody;
                this.newSubmissionId = responseBody.identifier;
                this.submissionBinaryState = responseBody.submissionState;

                // Process all submitted files by group
                const submittedFilesByGroup = {};
                for (const file of responseBody.submittedFiles) {
                    if (!submittedFilesByGroup[file.fileAttributeName]) {
                        submittedFilesByGroup[file.fileAttributeName] = [];
                    }
                    submittedFilesByGroup[file.fileAttributeName].push(file);
                }

                // Update each file group
                for (const [fileGroup, files] of Object.entries(submittedFilesByGroup)) {
                    const groupData = this.getOrCreateFileGroup(fileGroup);
                    groupData.submittedFiles = await this.transformApiResponseToFile(files);
                    groupData.filesToSubmit = new Map();
                    groupData.filesToRemove = new Map();
                }

                // Update URL with the submission ID
                const newSubmissionUrl =
                    getFormRenderUrl(this.formUrlSlug, this.lang) + `/${this.newSubmissionId}`;
                window.history.pushState({}, '', newSubmissionUrl.toString());

                this.disableLeavePageWarning();
                this.redirectToReadonlyForm();

                // formDataUpdated event to notify parent component
                this.dispatchEvent(
                    new CustomEvent('dbpFormDataUpdated', {
                        detail: {
                            needUpdate: true,
                        },
                        bubbles: true,
                        composed: true,
                    }),
                );
            }
        } catch (error) {
            // Restore all file groups if something went wrong
            for (const [fileGroup, backup] of Object.entries(filesByGroupBackup)) {
                this.filesByGroup[fileGroup] = backup;
            }
            this.requestUpdate();

            console.error(error);
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t('errors.unknown-error-on-save-draft'),
                type: 'danger',
                timeout: 0,
            });
        }
    }

    /**
     * Update formData if field value changes
     * @param {CustomEvent} event
     */
    async handleChangeEvents(event) {
        // First call parent to handle common cases
        super.handleChangeEvents(event);

        // Handle form-specific actions
        if (event.detail && event.detail.option && event.detail.value) {
            const option = event.detail.option;
            const value = event.detail.value;

            if (option.value === 'download' && value === 'download') {
                this.downloadAllFiles();
                return;
            }
        }

        // Silently update validation widget status (without showing field errors)
        // Only run if in edit mode (not readonly)
        if (!this.readOnly) {
            const formElement = this.shadowRoot.querySelector('form');
            if (formElement) {
                const requiredFieldsValidated = await validateRequiredFields(formElement, true);
                const fileValidation = this.validateMinimumFileUploads();

                // Update widget based on both required fields and file uploads
                this.isFormValid = requiredFieldsValidated && fileValidation.isValid;
            }
        }
    }

    /**
     * Download all attachments and pdf version of the form as a zip file.
     * @param {object} event
     */
    async downloadAllFiles(event) {
        const allFiles = this.getFileGroupsFromSchema().flatMap((groupName) => {
            const group = this.getOrCreateFileGroup(groupName);
            return Array.from(group.submittedFiles.values());
        });
        this._('#file-sink').files = allFiles;
    }

    /**
     * Handle deleting submission.
     * @param {object} event - The event object containing the submission id to delete.
     */
    async handleFormDeleteSubmission(event) {
        const i18n = this._i18n;
        const data = event.detail;
        const submissionId = data.submissionId;

        if (!submissionId) {
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t('errors.no-submission-id-provided'),
                type: 'danger',
                timeout: 0,
            });
            return;
        }

        const confirmed = await getDeletionConfirmation(this);
        if (!confirmed) return;

        try {
            const response = await fetch(
                this.entryPointUrl + `/formalize/submissions/${submissionId}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: 'Bearer ' + this.auth.token,
                    },
                },
            );

            if (!response.ok) {
                this.deleteSubmissionError = true;
                sendNotification({
                    summary: i18n.t('errors.error-title'),
                    body: i18n.t('errors.failed-to-delete-submission-status', {
                        status: response.status,
                    }),
                    type: 'danger',
                    timeout: 0,
                });
            } else {
                this.wasDeleteSubmissionSuccessful = true;
                this.deleteSubmissionError = false;
            }
        } catch (error) {
            console.error(error);
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t('errors.unknown-error-on-delete-submission'),
                type: 'danger',
                timeout: 0,
            });
        } finally {
            if (this.wasDeleteSubmissionSuccessful) {
                sendNotification({
                    summary: i18n.t('success.success-title'),
                    body: i18n.t('success.form-submission-deleted-successfully'),
                    type: 'success',
                    timeout: 5,
                });

                const emptyFormUrl = getFormRenderUrl(this.formUrlSlug, this.lang);
                window.history.pushState({}, '', emptyFormUrl.toString());

                this.resetForm(event);
                this.sendSetPropertyEvent('routing-url', `/${this.formUrlSlug}`);
            }
        }
    }

    /**
     * Validates minimum file upload counts for all file groups.
     * @returns {{isValid: boolean, failedGroups: Array<{fileGroup: string, currentCount: number, minCount: number}>}}
     */
    validateMinimumFileUploads() {
        const failedGroups = [];

        if (this.fileUploadLimits.minFileUploadCount) {
            for (const [fileGroup, minCount] of Object.entries(
                this.fileUploadLimits.minFileUploadCount,
            )) {
                const submittedCount = this.filesByGroup[fileGroup]?.submittedFiles.size || 0;
                const toSubmitCount = this.filesByGroup[fileGroup]?.filesToSubmit.size || 0;
                const currentCount = submittedCount + toSubmitCount;

                if (currentCount < minCount) {
                    failedGroups.push({fileGroup, currentCount, minCount});
                }
            }
        }

        return {
            isValid: failedGroups.length === 0,
            failedGroups,
        };
    }

    /**
     * Renders the editable file upload widget for one schema file group.
     * @param {string} groupName
     * @returns {import('lit').TemplateResult}
     */
    renderFileUploadGroup(groupName) {
        const i18n = this._i18n;
        return html`
            <div class="file-upload-container">
                <div class="file-upload-title-container">
                    <h4 class="attachments-title">
                        ${i18n.t('render-form.forms.media-transparency-form.attachments-title')}
                        ${this.fileUploadLimits?.minFileUploadCount?.[groupName] > 0
                            ? html`
                                  <span class="required-mark">*</span>
                              `
                            : ''}
                    </h4>

                    <span class="file-upload-limit-warning">
                        ${i18n.t('render-form.download-widget.file-upload-count-limit-warning', {
                            count: this.fileUploadLimits?.allowedFileUploadCount?.[groupName],
                        })}
                        ${i18n.t('render-form.download-widget.file-upload-size-limit-warning', {
                            size: this.fileUploadLimits?.fileSizeLimit?.[groupName],
                        })}
                    </span>

                    <dbp-translated subscribe="lang">
                        <div slot="de">
                            <p>
                                Sujetname (kurz!) - keine weiteren Ziffern im Sujetnamen außer der
                                Durchnummerierung. Siehe folgende Datei:
                                MT_2026_Sujets_Bezeichnungslogik-all.pdf
                            </p>
                        </div>
                        <div slot="en">
                            <p>
                                Subject name (short!) – no other numbers in the subject name except
                                for sequential numbering. See the following file:
                                MT_2026_Sujets_Bezeichnungslogik-all.pdf
                            </p>
                        </div>
                    </dbp-translated>
                </div>

                <div class="uploaded-files">${this.renderAttachedFilesHtml(groupName)}</div>

                <button
                    class="button is-secondary upload-button upload-button--attachment"
                    .disabled=${this.fileUploadCounts[groupName] >=
                    this.fileUploadLimits?.allowedFileUploadCount?.[groupName]}
                    @click="${(event) => {
                        this.currentUploadGroup = groupName;
                        this.openFilePicker(event);
                    }}">
                    <dbp-icon name="upload" aria-hidden="true"></dbp-icon>
                    ${!isNaN(this.fileUploadLimits?.allowedFileUploadCount?.[groupName])
                        ? i18n.t('render-form.download-widget.upload-file-button-label', {
                              count: this.fileUploadLimits?.allowedFileUploadCount?.[groupName],
                          })
                        : i18n.t('render-form.download-widget.upload-file-button-label-no-limit')}
                </button>
            </div>
        `;
    }

    /**
     * Renders the read-only file list for one schema file group.
     * @param {string} groupName
     * @returns {import('lit').TemplateResult}
     */
    renderFileViewGroup(groupName) {
        const i18n = this._i18n;
        return html`
            <div class="file-upload-container">
                <h4 class="attachments-title">
                    ${i18n.t('render-form.download-widget.attachments-title')}
                </h4>
                <div class="uploaded-files">${this.renderAttachedFilesHtml(groupName)}</div>
            </div>
        `;
    }

    /**
     * Check if a category has subcategories.
     * Categories with subcategories have named subcategory keys.
     * Categories without subcategories use the sentinel key `_items`.
     * @param {string} category
     * @returns {boolean}
     */
    categoryHasSubcategories(category) {
        const categoryData = MEDIA_NAME_OWNER_MAPPING[category];
        return !!categoryData && !('_items' in categoryData);
    }

    /**
     * Get all categories from MEDIA_NAME_OWNER_MAPPING with translations.
     * Single source of truth for categories.
     * @returns {object} Object with category keys and translated values
     */
    getCategoryItems() {
        const i18n = this._i18n;
        const categories = {};
        Object.keys(MEDIA_NAME_OWNER_MAPPING).forEach((categoryKey) => {
            const translationKey =
                CATEGORY_TRANSLATION_KEYS[categoryKey] ??
                `render-form.forms.media-transparency-form.categories-${this.camelToKebab(categoryKey)}`;
            categories[categoryKey] = i18n.t(translationKey);
        });
        return categories;
    }

    /**
     * Get list of categories that have subcategories.
     * Used for data-condition on category field.
     * @returns {Array<string>}
     */
    getCategoriesWithSubcategories() {
        return Object.keys(MEDIA_NAME_OWNER_MAPPING).filter((category) =>
            this.categoryHasSubcategories(category),
        );
    }

    /**
     * Convert camelCase to kebab-case for translation keys
     * @param {string} str
     * @returns {string}
     */
    camelToKebab(str) {
        return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    }

    /**
     * Get translated subcategory items for the currently selected category.
     * Called inline in the template so it is always fresh on language change.
     * @returns {object} Object with subcategory keys and translated labels
     */
    getSubcategoryItems() {
        const i18n = this._i18n;
        if (!this.selectedCategory || !this.categoryHasSubcategories(this.selectedCategory)) {
            return {};
        }
        const items = {};
        Object.keys(MEDIA_NAME_OWNER_MAPPING[this.selectedCategory]).forEach((subcategoryKey) => {
            const translationKey =
                SUBCATEGORY_TRANSLATION_KEYS[subcategoryKey] ??
                `render-form.forms.media-transparency-form.sub-categories-${this.camelToKebab(subcategoryKey)}`;
            items[subcategoryKey] = i18n.t(translationKey);
        });
        return items;
    }

    /**
     * Get translated media name items for the current category/subcategory.
     * Called inline in the template so it is always fresh on language change.
     * @returns {object} Object with media name keys and display values
     */
    getMediaNameItems() {
        const i18n = this._i18n;
        const subcategoryKey = this.categoryHasSubcategories(this.selectedCategory)
            ? this.formData?.advertisementSubcategory
            : '_items';
        const mapping = MEDIA_NAME_OWNER_MAPPING[this.selectedCategory]?.[subcategoryKey] || {};
        if (Object.keys(mapping).length === 0) {
            return {[OTHER_MEDIA_VALUE]: OTHER_MEDIA_VALUE};
        }
        const items = {
            '': i18n.t('render-form.forms.media-transparency-form.please-select-media'),
        };
        Object.keys(mapping).forEach((name) => {
            items[name] = name;
        });
        items[OTHER_MEDIA_VALUE] = OTHER_MEDIA_VALUE;
        return items;
    }

    /**
     * Set conditional field visibility and reset related fields based on selected category value.
     * @param {string} selectedValue
     */
    setSubcategoryItemsByCategoryValue(selectedValue) {
        this.selectedCategory = selectedValue;

        if (!this.categoryHasSubcategories(selectedValue)) {
            // Categories without subcategories (print, television, radio, radio).
            // Always show the mediaName dropdown; when _items is empty 'Sonstiges' will be
            // pre-selected by the caller so the required field remains satisfied.
            this.conditionalFields.advertisementSubcategory = true;
        }

        // reset media name conditional field
        this.conditionalFields.mediaName = false;
    }

    /**
     * Set conditional field visibility and reset related fields based on selected subcategory value.
     * @param {CustomEvent} e - change event from subcategory dropdown, used to get the selected subcategory value
     */
    setSubcategoryItems(e) {
        const selectedValue = e.currentTarget.value;
        this.setSubcategoryItemsByCategoryValue(selectedValue);

        // Get the data object from the form
        const data = this.formData;

        // Reset fields based on category type
        data.advertisementSubcategory = '';
        data.mediumOwnersName = '';
        data.otherMediumName = '';
        data.otherMediumOwnersName = '';

        if (this.categoryHasSubcategories(selectedValue)) {
            // Category with subcategories (online, outOfHome): wait for subcategory selection
            data.mediaName = '';
            this.conditionalFields.advertisementSubcategory = false;
        } else {
            // Category without subcategories (print, television, radio)
            // Check whether there are any known media names under _items
            const hasMediaNames =
                Object.keys(MEDIA_NAME_OWNER_MAPPING[selectedValue]._items).length > 0;

            if (hasMediaNames) {
                // Reset to 'Please select'
                data.mediaName = '';
                this.conditionalFields.mediaName = false;
            } else {
                // No known media names — only 'Other' available
                data.mediaName = OTHER_MEDIA_VALUE;
                this.conditionalFields.mediaName = true;
            }
        }

        this.requestUpdate();
    }

    /**
     * Update conditional field visibility for the media name dropdown.
     * Items are computed at render time by getMediaNameItems().
     * @param {string} subcategory
     */
    setMediaNameItemsByValue(subcategory) {
        // Always show the mediaName dropdown so its `required` attribute can be satisfied.
        // When the mapping is empty the only available option is 'Sonstiges', which is
        // pre-selected by the caller; hiding the field would break browser/schema validation.
        this.conditionalFields.advertisementSubcategory = true;
        this.requestUpdate();
    }

    /**
     * Get the owner name for a given media name based on the current category and subcategory selection.
     * @param {string} mediaName
     * @returns {string|null} The owner name for the given media name, or null if not found
     */
    getOwnerForMediaName(mediaName) {
        const categoryData = MEDIA_NAME_OWNER_MAPPING[this.selectedCategory];
        if (!categoryData) return null;
        const subcategoryKey = this.categoryHasSubcategories(this.selectedCategory)
            ? this.formData.advertisementSubcategory
            : '_items';
        return categoryData[subcategoryKey]?.[mediaName] ?? null;
    }

    render() {
        return html`
            ${this.readOnly
                ? html`
                      ${this.renderFormViews()}
                  `
                : html`
                      ${this.renderFormElements()}
                  `}
        `;
    }

    /**
     * Renders the form elements
     * @returns {import('lit').TemplateResult} The rendered form elements
     */
    renderFormElements() {
        const i18n = this._i18n;
        const data = this.formData || {};

        return html`
            <form
                id="media-transparency-form"
                aria-labelledby="form-title"
                class="${classMap({
                    hidden: this.hideForm,
                    'formalize-form': true,
                    'media-transparency-form': true,
                    'readonly-mode': this.readOnly,
                    'edit-mode': !this.readOnly,
                })}">
                <div class="form-header">${this.getButtonRowHtml()}</div>

                <h2 class="form-title">
                    ${i18n.t('render-form.forms.media-transparency-form.title')}
                </h2>

                <div class="form-description">
                    <dbp-translated subscribe="lang">
                        <div slot="de">
                            <p>
                                In diesem Formular können Sie Ihre Werbemaßnahmen eintragen, um die
                                Transparenz von Werbung an der TU Graz zu erhöhen. Bitte füllen Sie
                                alle Pflichtfelder aus (gekennzeichnet mit einem roten Stern) und
                                laden Sie die erforderlichen Dateien hoch, damit Ihre Einreichung
                                bearbeitet werden kann.
                            </p>
                        </div>
                        <div slot="en">
                            <p>
                                In this form, you can enter your advertising activities to increase
                                the transparency of advertising at TU Graz. Please fill in all
                                required fields (marked with a red asterisk) and upload the
                                necessary files to ensure that your submission can be processed.
                            </p>
                        </div>
                    </dbp-translated>
                </div>

                <p>
                    <span class="red-marked-asterisk">
                        ${i18n.t('render-form.required-files-asterisk')}
                    </span>
                    ${i18n.t('render-form.required-files-text')}
                </p>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="category"
                    data-condition="${JSON.stringify(this.getCategoriesWithSubcategories())}"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-category-label',
                    )}"
                    display-mode="list"
                    .items=${this.getCategoryItems()}
                    @change=${(e) => {
                        this.setSubcategoryItems(e);
                    }}
                    .value=${data.category || ''}
                    required></dbp-form-enum-element>

                ${this.conditionalFields.category
                    ? html`
                          ${Object.keys(this.getSubcategoryItems()).length > 0
                              ? html`
                                    <dbp-form-enum-element
                                        class="${classMap({
                                            'fade-in':
                                                Object.keys(this.getSubcategoryItems()).length > 0,
                                        })}"
                                        subscribe="lang"
                                        data-condition="!Sonstiges"
                                        name="advertisementSubcategory"
                                        label="${i18n.t(
                                            'render-form.forms.media-transparency-form.field-advertisement-subcategory-label',
                                        )}"
                                        display-mode="list"
                                        .items=${this.getSubcategoryItems()}
                                        .value=${data.advertisementSubcategory || ''}
                                        @change=${(e) => {
                                            this.setMediaNameItemsByValue(e.currentTarget.value); // populate mediaName list on subcategory change

                                            // Reset media name to empty or 'Sonstiges' depending on available options
                                            const mapping =
                                                MEDIA_NAME_OWNER_MAPPING[this.selectedCategory]?.[
                                                    e.currentTarget.value
                                                ] || {};
                                            if (Object.keys(mapping).length === 0) {
                                                // Only 'Sonstiges' is available
                                                data.mediaName = OTHER_MEDIA_VALUE;
                                                this.conditionalFields.mediaName = true;
                                            } else {
                                                // Reset to 'Please select'
                                                data.mediaName = '';
                                                this.conditionalFields.mediaName = false;
                                            }

                                            // Clear related fields
                                            data.mediumOwnersName = '';
                                            data.otherMediumName = '';
                                            data.otherMediumOwnersName = '';

                                            this.requestUpdate();
                                        }}
                                        required></dbp-form-enum-element>
                                `
                              : ''}
                      `
                    : ''}
                ${this.conditionalFields.advertisementSubcategory
                    ? html`
                          <dbp-form-enum-element
                              subscribe="lang"
                              name="mediaName"
                              data-condition="Sonstiges"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-media-name-label',
                              )}"
                              display-mode="dropdown"
                              .items=${this.getMediaNameItems()}
                              .customValidator=${(value) => {
                                  return value === 'Bitte wählen Sie einen Mediennamen aus.' ||
                                      value === 'Please select a media name.'
                                      ? [
                                            i18n.t(
                                                'render-form.forms.media-transparency-form.media-name-validation-error',
                                            ),
                                        ]
                                      : [];
                              }}
                              @change=${(e) => {
                                  const selectedValue = e.currentTarget.value;
                                  data.mediaName = selectedValue;

                                  // If 'Other' is selected, show other medium fields
                                  if (selectedValue === OTHER_MEDIA_VALUE) {
                                      this.conditionalFields.mediaName = true;
                                      data.mediumOwnersName = '';
                                  } else {
                                      this.conditionalFields.mediaName = false;
                                      // Auto-fill owner name from mapping
                                      const owner = this.getOwnerForMediaName(selectedValue);
                                      data.mediumOwnersName = owner ?? '';
                                  }
                                  this.requestUpdate();
                              }}
                              .value=${data.mediaName || ''}
                              required></dbp-form-enum-element>

                          ${!this.conditionalFields.mediaName
                              ? html`
                                    <dbp-form-string-element
                                        subscribe="lang"
                                        name="mediumOwnersName"
                                        maxlength="1000"
                                        label="${i18n.t(
                                            'render-form.forms.media-transparency-form.field-media-owners-name-label',
                                        )}"
                                        disabled
                                        .value=${data.mediumOwnersName ||
                                        ''}></dbp-form-string-element>
                                `
                              : ''}
                      `
                    : ''}
                ${this.conditionalFields.mediaName
                    ? html`
                          <dbp-form-string-element
                              subscribe="lang"
                              name="otherMediumName"
                              maxlength="1000"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-other-medium-name-label',
                              )}"
                              .value=${data.otherMediumName || ''}></dbp-form-string-element>

                          <dbp-translated subscribe="lang">
                              <div slot="de">
                                  <p class="field-note">
                                      Bitte zuerst schauen, ob der Name des Medieninhabers in der
                                      2024_TU Graz Medienliste (siehe eigenes Tabellenblatt [add
                                      link here?]) vorkommt.
                                  </p>
                              </div>
                              <div slot="en">
                                  <p class="field-note">
                                      First, please check whether the medium appears in 2024_TU Graz
                                      Medienliste (see separate spreadsheet [add link here?]) and
                                      adhere strictly to the spelling and combination of
                                      medium/media owner.
                                  </p>
                              </div>
                          </dbp-translated>

                          <dbp-form-string-element
                              subscribe="lang"
                              name="otherMediumOwnersName"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-other-medium-owners-name-label',
                              )}"
                              maxlength="1000"
                              .value=${data.otherMediumOwnersName || ''}></dbp-form-string-element>
                      `
                    : ''}

                <dbp-form-string-element
                    subscribe="lang"
                    name="amountInEuro"
                    maxlength="20"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-amount-in-euro-label',
                    )}"
                    .customValidator=${(value) => {
                        const re = /^\d+(?:,\d{1,2})?$/;
                        return re.test(value)
                            ? null
                            : i18n.t(
                                  'render-form.forms.media-transparency-form.validation-amount-in-euro-label',
                              );
                    }}
                    .value=${data.amountInEuro || ''}
                    required></dbp-form-string-element>

                <dbp-translated subscribe="lang">
                    <div slot="de">
                        <p class="field-note">
                            Betrag: in Euro – Nettoentgelt vor Werbeabgabe und Ust. Der Betrag darf
                            maximal 2 Nachkommastellen enthalten und kein Eurozeichen.
                        </p>
                    </div>
                    <div slot="en">
                        <p class="field-note">
                            Amount: in euros – net remuneration before advertising tax and VAT. The
                            amount may contain a maximum of two decimal places and no euro sign.
                        </p>
                    </div>
                </dbp-translated>

                <dbp-form-string-element
                    subscribe="lang"
                    name="campaignTitle"
                    maxlength="1000"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-campaign-title-label',
                    )}"
                    .value=${data.campaignTitle || ''}></dbp-form-string-element>

                ${this.selectedCategory === 'Online'
                    ? html`
                          <!-- Sujet notes -->
                          <dbp-form-string-element
                              subscribe="lang"
                              name="sujetNotes"
                              rows="5"
                              maxlength="1000"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-sujet-notes-label',
                              )}"
                              .value=${data.sujetNotes || ''}></dbp-form-string-element>
                      `
                    : ''}

                <!-- Notes -->
                <dbp-form-string-element
                    subscribe="lang"
                    name="notes"
                    rows="5"
                    maxlength="1000"
                    label="${i18n.t('render-form.forms.media-transparency-form.field-notes-label')}"
                    .value=${data.notes || ''}></dbp-form-string-element>

                ${this.selectedCategory === 'Online'
                    ? html`
                          <!-- at/from -->
                          <dbp-form-date-element
                              subscribe="lang"
                              name="atFrom"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-at-from-label',
                              )}"
                              .value=${data.atFrom || ''}></dbp-form-date-element>

                          <!-- to -->
                          <dbp-form-date-element
                              subscribe="lang"
                              name="to"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-to-label',
                              )}"
                              .value=${data.to || ''}></dbp-form-date-element>
                      `
                    : ''}

                <!-- SAP order number -->
                <dbp-form-string-element
                    subscribe="lang"
                    name="sapOrderNumber"
                    maxlength="100"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-sap-order-number-label',
                    )}"
                    .value=${data.sapOrderNumber || ''}></dbp-form-string-element>

                <!-- Reporting deadline -->
                <dbp-form-date-element
                    subscribe="lang"
                    name="reportingDeadline"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-reporting-deadline-label',
                    )}"
                    .value=${data.reportingDeadline || ''}></dbp-form-date-element>

                ${this.getFileGroupsFromSchema().map((groupName) =>
                    this.renderFileUploadGroup(groupName),
                )}
            </form>

            <dbp-file-source
                id="file-source"
                class="file-source"
                lang="${this.lang}"
                allowed-mime-types="application/pdf,image/jpeg,image/png,image/gif,video/mp4,video/mpeg,
                    video/webm,audio/mpeg,audio/ogg,audio/flac,audio/mp4"
                max-file-size="100000"
                number-of-files="1"
                enabled-targets="local,clipboard,nextcloud"
                subscribe="nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-source>

            <dbp-file-sink
                id="file-sink"
                class="file-sink"
                lang="${this.lang}"
                decompress-zip
                enabled-targets="local,clipboard,nextcloud"
                filename="media-transparency-form-${this.formData?.id || ''}-attachments.zip"
                subscribe="nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-sink>

            ${this.renderResult(this.submitted)}
        `;
    }

    /**
     * Renders the read-only form elements
     * @returns {import('lit').TemplateResult} The rendered form elements
     */
    renderFormViews() {
        const i18n = this._i18n;
        const data = this.formData || {};

        return html`
            <form
                id="media-transparency-form"
                aria-labelledby="form-title"
                class="${classMap({
                    hidden: this.hideForm,
                    'formalize-form': true,
                    'media-transparency-form': true,
                    'readonly-mode': this.readOnly,
                    'edit-mode': !this.readOnly,
                })}">
                <div class="form-header">${this.getButtonRowHtml()}</div>

                <h2 class="form-title">
                    ${i18n.t('render-form.forms.media-transparency-form.title')}
                </h2>

                <dbp-form-enum-view
                    subscribe="lang"
                    name="category"
                    data-condition="${JSON.stringify(this.getCategoriesWithSubcategories())}"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-category-label',
                    )}"
                    display-mode="list"
                    .value=${data.category || ''}></dbp-form-enum-view>

                ${this.conditionalFields.advertisementSubcategory &&
                Object.keys(this.getSubcategoryItems()).length > 0
                    ? html`
                          <dbp-form-enum-view
                              class="${classMap({
                                  'fade-in': Object.keys(this.getSubcategoryItems()).length > 0,
                              })}"
                              subscribe="lang"
                              name="advertisementSubcategory"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-advertisement-subcategory-label',
                              )}"
                              display-mode="list"
                              .items=${this.getSubcategoryItems()}
                              .value=${data.advertisementSubcategory || ''}></dbp-form-enum-view>
                      `
                    : ''}
                ${data.mediaName
                    ? html`
                          <dbp-form-enum-view
                              subscribe="lang"
                              name="mediaName"
                              data-condition="!Sonstiges"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-media-name-label',
                              )}"
                              display-mode="dropdown"
                              .value=${data.mediaName || ''}></dbp-form-enum-view>
                      `
                    : ''}
                ${data.mediumOwnersName
                    ? html`
                          <dbp-form-string-view
                              subscribe="lang"
                              name="mediumOwnersName"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-media-owners-name-label',
                              )}"
                              .value=${data.mediumOwnersName || ''}></dbp-form-string-view>
                      `
                    : ''}
                ${data.otherMediumName || data.otherMediumOwnersName
                    ? html`
                          <dbp-form-string-view
                              subscribe="lang"
                              name="otherMediumName"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-other-medium-name-label',
                              )}"
                              .value=${data.otherMediumName || ''}></dbp-form-string-view>

                          <dbp-form-string-view
                              subscribe="lang"
                              name="otherMediumOwnersName"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-other-medium-owners-name-label',
                              )}"
                              .value=${data.otherMediumOwnersName || ''}></dbp-form-string-view>
                      `
                    : ''}

                <dbp-form-string-view
                    subscribe="lang"
                    name="amountInEuro"
                    label="${i18n.t(
                        'render-form.forms.media-transparency-form.field-amount-in-euro-label',
                    )}"
                    .value=${data.amountInEuro || ''}></dbp-form-string-view>

                ${data.campaignTitle
                    ? html`
                          <dbp-form-string-view
                              subscribe="lang"
                              name="campaignTitle"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-campaign-title-label',
                              )}"
                              .value=${data.campaignTitle || ''}></dbp-form-string-view>
                      `
                    : ''}
                ${data.sujetNotes
                    ? html`
                          <!-- Sujet notes -->
                          <dbp-form-string-view
                              subscribe="lang"
                              name="sujetNotes"
                              rows="5"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-sujet-notes-label',
                              )}"
                              .value=${data.sujetNotes || ''}></dbp-form-string-view>
                      `
                    : ''}

                <!-- Notes -->
                ${data.notes
                    ? html`
                          <dbp-form-string-view
                              subscribe="lang"
                              name="notes"
                              rows="5"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-notes-label',
                              )}"
                              .value=${data.notes || ''}></dbp-form-string-view>
                      `
                    : ''}
                ${data.atFrom || data.to
                    ? html`
                          <!-- at/from -->
                          <dbp-form-date-view
                              subscribe="lang"
                              name="atFrom"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-at-from-label',
                              )}"
                              .value=${data.atFrom || ''}></dbp-form-date-view>

                          <!-- to -->
                          <dbp-form-date-view
                              subscribe="lang"
                              name="to"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-to-label',
                              )}"
                              .value=${data.to || ''}></dbp-form-date-view>
                      `
                    : ''}

                <!-- SAP order number -->
                ${data.sapOrderNumber
                    ? html`
                          <dbp-form-string-view
                              subscribe="lang"
                              name="sapOrderNumber"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-sap-order-number-label',
                              )}"
                              .value=${data.sapOrderNumber || ''}></dbp-form-string-view>
                      `
                    : ''}

                <!-- Reporting deadline -->
                ${data.sapOrderNumber
                    ? html`
                          <dbp-form-date-view
                              subscribe="lang"
                              name="reportingDeadline"
                              label="${i18n.t(
                                  'render-form.forms.media-transparency-form.field-reporting-deadline-label',
                              )}"
                              .value=${data.reportingDeadline || ''}></dbp-form-date-view>
                      `
                    : ''}
                ${this.getFileGroupsFromSchema().map((groupName) =>
                    this.renderFileViewGroup(groupName),
                )}
            </form>

            <dbp-file-sink
                id="file-sink"
                class="file-sink"
                lang="${this.lang}"
                decompress-zip
                enabled-targets="local,clipboard,nextcloud"
                filename="media-transparency-form-${this.formData?.id || ''}-attachments.zip"
                subscribe="nextcloud-auth-url,nextcloud-web-dav-url,nextcloud-name,nextcloud-file-url"></dbp-file-sink>

            <!-- Deletion Confirmation Modal -->
            <dbp-modal
                id="deletion-confirmation-modal--formalize"
                class="modal modal--confirmation"
                modal-id="deletion-confirmation-modal"
                title="${i18n.t('show-submissions.delete-confirmation-title')}"
                subscribe="lang">
                <div slot="content">
                    <p>${i18n.t('show-submissions.delete-confirmation-message')}</p>
                </div>
                <menu slot="footer" class="footer-menu">
                    <dbp-button
                        type="is-secondary"
                        no-spinner-on-click
                        @click="${() => handleDeletionCancel(this)}">
                        ${i18n.t('show-submissions.abort')}
                    </dbp-button>
                    <dbp-button
                        type="is-danger"
                        no-spinner-on-click
                        @click="${() => handleDeletionConfirm(this)}">
                        ${i18n.t('show-submissions.delete')}
                    </dbp-button>
                </menu>
            </dbp-modal>
        `;
    }
    /**
     * Render text after successfull submission.
     * @param {boolean} submitted
     * @returns {import('lit').TemplateResult} HTML for the result of the submission.
     */
    renderResult(submitted) {
        const i18n = this._i18n;

        if (submitted) {
            return html`
                <div class="container">
                    <h2>
                        ${i18n.t(
                            'render-form.forms.media-transparency-form.submission-result-thanks',
                        )}
                    </h2>
                    <p>
                        ${i18n.t(
                            'render-form.forms.media-transparency-form.submission-result-notification',
                        )}
                    </p>
                </div>
            `;
        }

        return html``;
    }

    /**
     * Opens the file picker dialog.
     * @param {object} event - Click event
     */
    openFilePicker(event) {
        event.preventDefault();
        const fileSource = this._('dbp-file-source');
        fileSource.setAttribute('dialog-open', '');
    }

    /**
     * Override deleteAttachment to update validation widget when files are removed
     * @param {string} fileIdentifier - uuid
     * @param {string} fileGroup - The group of files to handle
     */
    async deleteAttachment(fileIdentifier, fileGroup) {
        // Call parent method to handle deletion
        super.deleteAttachment(fileIdentifier, fileGroup);

        // Update validation widget if in edit mode
        if (!this.readOnly) {
            const formElement = this.shadowRoot.querySelector('form');
            if (formElement) {
                const requiredFieldsValidated = await validateRequiredFields(formElement, true);
                const fileValidation = this.validateMinimumFileUploads();

                this.isFormValid = requiredFieldsValidated && fileValidation.isValid;
            }
        }
    }

    /**
     * Handle files to submit event from file source component.
     * @param {CustomEvent} event - The event object containing the file data.
     */
    async handleFilesToSubmit(event) {
        const isValid = this.validateAttachmentFileName(event.detail.file);
        if (isValid) {
            // Call base class method to handle file addition
            super.handleFilesToSubmit(event);

            // Update validation widget status
            const formElement = this.shadowRoot.querySelector('form');
            const requiredFieldsValidated = await validateRequiredFields(formElement, true);
            const fileValidation = this.validateMinimumFileUploads();

            this.isFormValid = requiredFieldsValidated && fileValidation.isValid;
        }
    }

    validateAttachmentFileName(file, maxUpload) {
        const i18n = this._i18n;
        const fileNamePattern = /^\d{2}_[A-Za-z]+_[A-Za-z]+_[A-Za-z]+\.[A-Za-z0-9]+$/;

        if (!fileNamePattern.test(file.name)) {
            sendNotification({
                summary: i18n.t('errors.error-title'),
                body: i18n.t(
                    'render-form.forms.media-transparency-form.invalid-attachment-filename-error',
                    {
                        filename: file.name,
                    },
                ),
                type: 'danger',
                timeout: 0,
            });
            return false;
        }
        return true;
    }
}
