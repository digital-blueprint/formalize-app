import {BaseFormElement, BaseObject} from '../form/base-object.js';
import {html, css} from 'lit';
import {classMap} from 'lit-html/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles.js';
import {getEthicsCommissionFormCSS} from '../styles.js';
import {
    DbpStringElement,
    DbpDateElement,
    DbpCheckboxElement,
    DbpEnumElement,
} from '@dbp-toolkit/form-elements';

export default class extends BaseObject {
    getUrlSlug() {
        return 'ethics-commission';
    }

    /**
     * Returns the form component class for the ethics commission form.
     *
     * @returns {typeof BaseFormElement} The class of the form component.
     */
    getFormComponent() {
        return FormalizeFormElement;
    }

    getFormIdentifier() {
        return '32297d33-1352-4cf2-ba06-1577911c3537';
    }
}

class FormalizeFormElement extends BaseFormElement {
    constructor() {
        super();
        this.submitted = false;
        this.submissionError = false;
        this.humanTestSubjectsQuestionsEnabled = false;
        this.humanStemCellsQuestionsEnabled = false;
        this.stemCellFromHumanEmbryosQuestionsEnabled = false;
        this.cellsObtainedInResearchQuestionsEnabled = true;
        this.harmfulSubstancesOnSubjects = false;
        this.animalQuestionsEnabled = false;
        this.nonEuCountriesQuestionsEnabled = false;
        this.questionResearchFoundsQuestionsEnabled = false;
        this.ethicalIssuesListQuestion = false;
        this.hasConflictOfInterestSubQuestion = false;
        this.hasConfidentialPartSubQuestion = false;
        this.hasConflictInContentControlSubQuestion = false;
        this.stakeholderParticipationPlannedSubQuestion = false;
    }

    static get properties() {
        return {
            ...super.properties,
            submitted: {type: Boolean},
            submissionError: {type: Boolean},
            humanTestSubjectsQuestionsEnabled: {type: Boolean},
            humanStemCellsQuestionsEnabled: {type: Boolean},
            stemCellFromHumanEmbryosQuestionsEnabled: {type: Boolean},
            cellsObtainedInResearchQuestionsEnabled: {type: Boolean},
            harmfulSubstancesOnSubjects: {type: Boolean},
            animalQuestionsEnabled: {type: Boolean},
            nonEuCountriesQuestionsEnabled: {type: Boolean},
            questionResearchFoundsQuestionsEnabled: {type: Boolean},
            ethicalIssuesListQuestion: {type: Boolean},
            hasConflictOfInterestSubQuestion: {type: Boolean},
            hasConfidentialPartSubQuestion: {type: Boolean},
            hasConflictInContentControlSubQuestion: {type: Boolean},
            stakeholderParticipationPlannedSubQuestion: {type: Boolean},
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this.updateComplete.then(() => {
            // Event listener for form submission
            // Event listener for form submission
            this.addEventListener('DbpFormalizeFormSubmission', async (event) => {
                // Access the data from the event detail
                const data = event.detail;
                // Include unique identifier for person who is submitting
                data.formData.identifier = this.formData.identifier;
                // Create UUID for each submission
                this.createUUID();
                data.formData.uuid = this.formData.uuid;

                // Handle the event
                console.log('Form submission data:', data);

                try {
                    this.isPostingSubmission = true;

                    let body = {
                        form: '/formalize/forms/' + '32297d33-1352-4cf2-ba06-1577911c3537',
                        dataFeedElement: JSON.stringify(data.formData),
                    };

                    const response = await fetch(this.entryPointUrl + '/formalize/submissions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/ld+json',
                            Authorization: 'Bearer ' + this.auth.token,
                        },
                        body: JSON.stringify(body),
                    });

                    if (!response.ok) {
                        this.submissionError = true;
                        this.saveButtonEnabled = true;
                        throw new Error(`Response status: ${response.status}`);
                    } else {
                        this.wasSubmissionSuccessful = true;
                        this.submissionError = false;
                        // Hide form after successful submission
                        this._('#ethics-commission-form').style.display = 'none';
                    }

                    this.submitted = this.wasSubmissionSuccessful;
                    console.log(this.wasSubmissionSuccessful, response);
                    return response;
                } catch (error) {
                    console.error(error.message);
                } finally {
                    this.isPostingSubmission = false;
                }
            });
        });
    }

    static get scopedElements() {
        return {
            'dbp-form-string-element': DbpStringElement,
            'dbp-form-date-element': DbpDateElement,
            'dbp-form-checkbox-element': DbpCheckboxElement,
            'dbp-form-enum-element': DbpEnumElement,
        };
    }

    createUUID() {
        let uuid = self.crypto.randomUUID();
        console.log('Created UUID: ' + uuid);
        this.formData.uuid = uuid;
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getButtonCSS()}
            ${getEthicsCommissionFormCSS()}
        `;
    }

    render() {
        const i18n = this._i18n;
        console.log('-- Render FormalizeFormElement --');

        console.log('this.formData', this.formData);
        const data = this.formData || {};

        return html`
            <form id="ethics-commission-form">
                <h2 class="form-title">${i18n.t('render-form.forms.ethics-commission-form.title')}</h2>

                <div class="type-container">
                    <dbp-form-enum-element
                        subscribe="lang"
                        name="type"
                        display-mode="list"
                        .items=${{
                            studie: i18n.t('render-form.forms.ethics-commission-form.studie'),
                            publication: i18n.t(
                                'render-form.forms.ethics-commission-form.publication',
                            ),
                        }}
                        .value=${data.type || ''}
                        required>
                    </dbp-form-enum-element>
                </div>

                <p class="form-sub-title">${i18n.t('render-form.forms.ethics-commission-form.sub-title')}</p>

                <dbp-form-string-element
                    subscribe="lang"
                    name="applicant"
                    placeholder="${i18n.t('render-form.forms.ethics-commission-form.applicant-placeholder')}"
                    label="${i18n.t('render-form.forms.ethics-commission-form.applicant-label')}"
                    required
                    value=${data.applicant || ''}>
                </dbp-form-string-element>
                <sup>1. Bei Abschlussarbeiten im Rahmen des Bachelor- oder Masterstudiums ist der Ethikantrag von der betreuenden Person einzubringen; Doktorand*innen können auch Antragssteller*innen sein.</sup>

                <dbp-form-string-element
                    subscribe="lang"
                    name="contact-details"
                    placeholder="${i18n.t('render-form.forms.ethics-commission-form.contact-details-placeholder')}"
                    label="${i18n.t('render-form.forms.ethics-commission-form.contact-details-label')}"
                    required
                    value=${data.contactDetails || ''}>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="job-position"
                    required
                    placeholder="${i18n.t('render-form.forms.ethics-commission-form.job-position-placeholder')}"
                    label="${i18n.t('render-form.forms.ethics-commission-form.job-position-label')}"
                    value=${data.jobPosition || ''}>
                </dbp-form-string-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="fields-of-expertise"
                    display-mode="list"
                    multiple
                    label="${i18n.t('render-form.forms.ethics-commission-form.fields-of-expertise-label')}"
                    .items=${{
                        'advanced-material-sciences': i18n.t(
                            'render-form.forms.ethics-commission-form.advanced-material-sciences',
                        ),
                        'human-and-biotechnology': i18n.t(
                            'render-form.forms.ethics-commission-form.human-and-biotechnology',
                        ),
                        'information-communication-computing': i18n.t(
                            'render-form.forms.ethics-commission-form.information-communication-computing',
                        ),
                        'mobility-production': i18n.t(
                            'render-form.forms.ethics-commission-form.mobility-production',
                        ),
                        'sustainable-systems': i18n.t(
                            'render-form.forms.ethics-commission-form.sustainable-systems',
                        ),
                        keinem: i18n.t('render-form.forms.ethics-commission-form.keinem'),
                    }}
                    .value=${data.fieldsOfExpertise || ''}>
                </dbp-form-enum-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="qualification-work"
                    display-mode="list"
                    required
                    label="${i18n.t('render-form.forms.ethics-commission-form.qualification-work-label')}"
                    .items=${{
                        no: i18n.t('render-form.forms.ethics-commission-form.no-label'),
                        bachelor: i18n.t('render-form.forms.ethics-commission-form.bachelor-label'),
                        master: i18n.t('render-form.forms.ethics-commission-form.master-label'),
                        doctorat: i18n.t('render-form.forms.ethics-commission-form.doctorat-label'),
                        'no-publication': i18n.t(
                            'render-form.forms.ethics-commission-form.no-publikation-label',
                        ),
                        'one-publication': i18n.t(
                            'render-form.forms.ethics-commission-form.one-publikation-label',
                        ),
                    }}
                    .value=${data.qualificationWork || ''}>
                </dbp-form-enum-element>

                <span>Studienbeschreibung, Kriterienkatalog, Informed Consent</span>

                <dbp-form-date-element
                    subscribe="lang"
                    name="date-of-transmission"
                    label="${i18n.t('render-form.forms.ethics-commission-form.date-of-transmission-label')}"
                    value=${data.dateOfTransmission || ''}
                    required>
                </dbp-form-date-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="specification-office"
                    label="${i18n.t('render-form.forms.ethics-commission-form.specification-office-label')}"
                    value=${data.specificationOffice || ''}
                    required>
                </dbp-form-string-element>

                <span>Datenschutzrechtlich geprüft</span>

                <dbp-form-date-element
                    subscribe="lang"
                    name="data-protection-date"
                    label="${i18n.t('render-form.forms.ethics-commission-form.data-protection-date-label')}"
                    value=${data.dataProtectionDate || ''}
                    required>
                </dbp-form-date-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="data-protection-specification-office"
                    label="${i18n.t('render-form.forms.ethics-commission-form.specification-office-label')}"
                    value=${data.dataProtectionSpecificationOffice || ''}
                    required>
                </dbp-form-string-element>

                <span>Datenschutzrechtliche Besonderheiten von ethischer Relevanz</span>

                <dbp-form-string-element
                    subscribe="lang"
                    name="data-protection-ethics-relevance"
                    label="${i18n.t('render-form.forms.ethics-commission-form.specification-office-label')}"
                    placeholder="Angabe durch Geschäftsstelle"
                    value=${data.dataProtectionEthicsRelevance || ''}
                    required>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="short-description"
                    label="Kurzbeschreibung/Zusammenfassung"
                    placeholder="Bitte beschreiben Sie Ziel und Ablauf Ihrer Studie/Publikation kurz und in ganzen Sätzen (max. 300 Wörter)."
                    value=${data.shortDescription || ''}
                    rows="5"
                    required>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="data-source"
                    label="Datenquelle"
                    placeholder="Bitte beschreiben Sie kurz, woher die Daten stammen (z.B.: werden selbst erhoben, Open Data Sources, von Forschungspartner*innen, …):"
                    value=${data.dataSource || ''}
                    rows="5"
                    required>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="number-of-test-persons"
                    label="Wenn Menschen als Proband*innen mitwirken: (Geplante) Anzahl der Proband*innen"
                    placeholder="Anzahl der geplanten Proband*innen"
                    value=${data.numberOfTestPersons || ''}
                    required>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="acquisition-of-test-subjects"
                    label="Akquise der Proband*innen"
                    placeholder="Bitte beschreiben Sie, wie Sie Proband*innen für Ihre Studie akquirieren und fügen Sie etwaiges Informationsmaterial, Aushänge, Rekrutierungstexte für Mails etc. an."
                    value=${data.acquisitionOfTestSubjects || ''}
                    rows="5"
                    required>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="volunteers-compensation"
                    label="Welche Aufwandsentschädigung erhalten die Proband*innen?"
                    placeholder="Angabe über die Art und Höhe der Aufwandsentschädigung für Proband*innen für deren Teilnahme an der Studie."
                    value=${data.volunteersCompensation || ''}
                    rows="5"
                    required>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="volunteers-compensation-early-end"
                    label="Erhalten die Proband*innen auch bei vorzeitigem Abbruch der Teilnahme eine angemessene Entschädigung?"
                    placeholder="Angabe über die Art und Höhe der Aufwandsentschädigung für Proband*innen, die die Teilnahme an der Studie vorzeitig abbrechen."
                    value=${data.volunteersCompensationEarlyEnd || ''}
                    rows="5"
                    required>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="participation-criteria"
                    label="Gibt es Ein- und Ausschlusskriterien für eine Teilnahme als Proband*in in Ihrer Studie? Wenn ja, welche sind dies? "
                    placeholder="Angabe der Ein- und Ausschlusskriterien. z.B.: Alter, (Vor-)Erkrankung, Schwangerschaft, …"
                    value=${data.participationCriteria || ''}
                    rows="5"
                    required>
                </dbp-form-string-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="subjects-dependencies"
                    label="Liegen Befangenheiten oder Abhängigkeiten im Rahmen Ihrer Studie vor (siehe auch 1.1.5. des Kriterienkatalogs)?
Personen können nicht als Proband*innen in Ihrer Studie mitwirken, wenn sie in einer studienrechtlichen oder arbeitsrechtlichen Abhängigkeit zu Ihnen als Studienleitung stehen (z.B.: Mitarbeitende des gleichen Instituts als Proband*innen)."
                    placeholder="Offenlegung von Befangenheiten oder Abhängigkeiten bzw. Bestätigung, dass keine Personen als Proband*innen mitwirken, die in studienrechtlicher oder arbeitsrechtlicher Abhängigkeit zur Studienleitung stehen."
                    value=${data.subjectsDependencies || ''}
                    rows="5"
                    required>
                </dbp-form-string-element>

                <!-- PAGE 3 STARTS HERE -->

                <dbp-form-string-element
                    subscribe="lang"
                    name="founding"
                    label="Finanzierung"
                    placeholder="1) Angaben zur Art der Finanzierung (z.B.: Drittmittel, …)&amp;#10;
2) Angaben zum Fördergeber, der Ihr Projekt finanziert (bzw. der Fördergeber)&amp;#10;
3) Angaben zum Projektvolumen bzw. zur Höhe der Finanzierung"
                    value=${data.founding || ''}
                    rows="5"
                    required>
                </dbp-form-string-element>

                <dbp-form-date-element
                    subscribe="lang"
                    name="project-start-date"
                    label="Geplanter Start und Zeitraum des Forschungsvorhabens"
                    value=${data.projectStartDate || ''}
                    required>
                </dbp-form-date-element>

                <dbp-form-string-element
                    subscribe="lang"
                    name="project-time-period"
                    label="Des Zeitraums zur Durchführung Ihrer Studie"
                    value=${data.projectTimePeriod || ''}
                    required>
                </dbp-form-string-element>

                <h2 class="section-title">1. Beschreibung des Forschungsvorhabens (max. 2 Seiten)</h2>

                <div class="description">
                    <p>Beschreibung der Zielsetzung und des wissenschaftlichen Hintergrundes Ihres Forschungsvorhabens (mit Angabe der relevanten Literatur).</p>
                    <p>Darlegung des Studienablaufs und Erläuterung der eingesetzten Methoden und Rolle bzw. Aufgaben der involvierten Proband*innen.</p>
                    <p>Beschreibung der eingesetzten Geräte/Apparaturen samt Marke und Hersteller.</p>
                    <p>Nutzen-Risiko-Erwägungen: Welche Risiken (Unannehmlichkeiten, Gefahren, Belastungen) bestehen für die Proband*innen im Verhältnis zum Nutzen der Ergebnisse des Forschungsvorhabens?</p>
                </div>

                <dbp-form-string-element
                    subscribe="lang"
                    name="research-project-description"
                    label="Beschreibung des Forschungsvorhabens"
                    value=${data.researchProjectDescription || ''}
                    rows="10"
                    required>
                </dbp-form-string-element>

                <h2 class="section-title">2. Informed Consent / Informierte Einwilligung</h2>

                <div class="description">
                    <p>Die Proband*innen sollen von der Studienleitung über folgende Punkte informiert werden (beispielsweise durch eine Proband*innen-Information und Einwilligungserklärung zur Teilnahme am Forschungsvorhaben):</p>
                    <ol>
                        <li>Genaue Angabe von Titel, Zweck und Dauer Ihres Forschungsvorhabens sowie Erklärung des Ablaufs für die Proband*innen in einfacher und klarer Sprache (bitte vermeiden Sie nach Möglichkeit Fremdwörter)</li>
                        <li>Angaben zur durchführenden Forschungseinrichtung und zu einer verantwortlichen Kontaktperson (Vor- und Nachname, E-Mail-Adresse und evtl. Telefonnummer) für weitere Fragen, Anregungen oder Beschwerden</li>
                        <li>Angabe möglicher Risiken für die Proband*innen (Unannehmlichkeiten, Gefahren, Belastungen) und etwaiger Folgen</li>
                        <li>Angaben über die Höhe der Aufwandsentschädigung (auch im Falle eines vorzeitigen Abbruchs) sowie eines sonstigen Nutzens für die Proband*innen</li>
                        <li>Hinweis auf die Freiwilligkeit der Teilnahme inklusive des Rechts, die Einwilligung jederzeit ohne Angabe von Gründen widerrufen und die Teilnahme vorzeitig abbrechen zu können, ohne dass den Proband*innen dadurch ein Nachteil entsteht</li>
                        <li>Hinweis auf die erfolgte Behandlung durch die Ethikkommission</li>
                        <li>Hinweis auf die Richtlinie für Hinweisgeber und den elektronischen Briefkasten für anonyme Hinweise an der TU Graz (Whistleblowing)<sup>2</sup></li>
                        <li>Einwilligungserklärung der Proband*innen (bzw. von deren gesetzlichen Vertreter*innen) zur Teilnahme an der Studie</li>
                    </ol>
                    <p>[2] Elektronischer Briefkasten für anonyme Hinweise (Whistleblowing), <a href="https://www.tugraz.at/ueber-diese-seite/elektronischer-briefkasten-fuer-anonyme-hinweise-whistleblowing">whistleblowing</a> (abgerufen 15.07.2024).</p>
                </div>

                <h2 class="section-title">3. Kriterienkatalog / Self-Assessment</h2>

                <div class="description">
                    <p>Bitte füllen Sie den folgenden Kriterienkatalog gewissenhaft aus. Geben Sie an, welche Kriterien auf Ihr Forschungsvorhaben zutreffen und welche nicht. <sup>3</sup> </p>
                    [3] Angelehnt an den Kriterienkatalog der Europäischen Kommission im Zusammenhang von EU-Grants/Horizon Europe aus dem Jahr 2021.
                </div>

                <h3 class="section-sub-title">1. Menschen</h3>

                <dbp-form-enum-element
                    @change="${(e) => {
                        if (e.detail.value) {
                            this.humanTestSubjectsQuestionsEnabled =
                                e.detail.value === 'yes' ? true : false;
                        }
                    }}"
                    subscribe="lang"
                    name="test-subjects"
                    display-mode="list"
                    required
                    label="Nehmen Menschen am Forschungsvorhaben als Proband*innen teil?"
                    description="(z.B.: durch Interviews; über per Ton und/oder Video aufgezeichnete Beobachtungen; bei Technologie-/Prototypentestungen)"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.testSubjects || ''}>
                </dbp-form-enum-element>

                ${
                    this.humanTestSubjectsQuestionsEnabled
                        ? html`
                              <div
                                  class="question-group ${classMap({
                                      'fade-in': this.humanTestSubjectsQuestionsEnabled,
                                  })}">
                                  <h4 class="question-group-title">
                                      1.1. Menschen als Proband*innen im Forschungsvorhaben
                                  </h4>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="test-subjects-voluntary"
                                      display-mode="list"
                                      required
                                      label="1.1.1. Nehmen die Proband*innen freiwillig an der Studie teil?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.testSubjects || ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="test-subjects-informed-consent"
                                      display-mode="list"
                                      required
                                      label="1.1.2. Wurden die Proband*innen über die an ihnen durchgeführte Studie im Vorfeld umfassend, in einfacher und verständlicher Sprache informiert (informed consent)?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.testSubjectsInformedConsent ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="test-subjects-consent-signed"
                                      display-mode="list"
                                      required
                                      label="1.1.3. Wird sichergestellt, dass die Teilnahme ausschließlich nach Unterfertigung der informierten Einwilligung durch die Proband*innen und/oder ihrer gesetzlichen Vertreter*innen erfolgt?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.testSubjectsConsentSigned ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="test-subjects-withdraw-possible"
                                      display-mode="list"
                                      required
                                      label="1.1.4. Besteht die Möglichkeit, von der Teilnahme ohne persönliche negative Auswirkungen zurückzutreten?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.testSubjectsWithdrawPossible ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="test-subjects-dependent"
                                      display-mode="list"
                                      required
                                      label="1.1.5. Nehmen Personen, die in studienrechtlicher und/oder arbeitsrechtlicher Abhängigkeit zur Studienleitung stehen (z.B.: Mitarbeitende des gleichen Instituts) als Proband*innen an der Studie teil?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.testSubjectsDependent ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="test-subjects-vulnerable"
                                      display-mode="list"
                                      required
                                      label="1.1.6. Sind andere potentiell vulnerable Personen involviert (Kinder, nicht einwilligungsfähige Personen, Opfer von Missbrauch oder Gewalt etc.)?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.testSubjectsVulnerable ||
                                      ''}></dbp-form-enum-element>
                              </div>

                              <div class="question-group">
                                  <h4 class="question-group-title">
                                      1.2. Physische oder psychische Eingriffe an Proband*innen
                                  </h4>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="invasive-techniques-used"
                                      display-mode="list"
                                      required
                                      label="1.2.1. Werden invasive Techniken angewandt (z.B.: zur Sammlung von menschlichem Gewebe, Biopsien, Einwirkungen auf das Gehirn, etc.)?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.invasiveTechniquesUsed ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="test-subjects-tortured"
                                      display-mode="list"
                                      required
                                      label="1.2.2. Führt die Teilnahme an der Studie bei den Proband*innen zu mindestens einer der folgenden Konsequenzen wie z.B. dem Erleben von Erniedrigung, Scham, Folter, Schmerzen, psychischem Druck, oder überdurchschnittlichem Stress?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.testSubjectsTortured ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="test-subjects-harmed"
                                      display-mode="list"
                                      required
                                      label="1.2.3. Könnten Proband*innen zu Schaden kommen bzw. gibt es mögliche Risiken oder etwaige Folgeerscheinungen?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.testSubjectsHarmed ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="test-subjects-risk-minimized"
                                      display-mode="list"
                                      required
                                      label="1.2.4. Wurden alle Schritte unternommen, um die Risiken zu minimieren?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.testSubjectsRiskMinimized ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="test-subjects-risks-justified"
                                      display-mode="list"
                                      required
                                      label="1.2.5. Rechtfertigt der Nutzen der Studie die Risiken für die Proband*innen?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.testSubjectsRisksJustified ||
                                      ''}></dbp-form-enum-element>
                              </div>

                              <div class="question-group">
                                  <h4 class="question-group-title">
                                      1.3. Zumutbarkeit des Forschungsvorhabens
                                  </h4>
                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="reasonable-to-participate"
                                      display-mode="list"
                                      required
                                      label="1.3.1 Ist den Proband*innen die Teilnahme an der Studie im Gesamten zumutbar?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.testSubjectsReasonableToParticipate ||
                                      ''}></dbp-form-enum-element>
                              </div>
                          `
                        : ''
                }

                <dbp-form-enum-element
                    subscribe="lang"
                    name="dead-bodies"
                    display-mode="list"
                    required
                    label="1.4. Werden im Zuge des Forschungsvorhabens tote Körper/Leichen eingesetzt?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.deadBodies || ''}>
                </dbp-form-enum-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="legal-documents-available"
                    display-mode="list"
                    required
                    label="1.4.1. Liegen entsprechende Rechtsgrundlagen/Dokumente vor?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.legalDocumentsAvailable || ''}>
                </dbp-form-enum-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="disturbance-of-peace-of-dead"
                    display-mode="list"
                    required
                    label="1.4.2. Kann eine Störung der Totenruhe ausgeschlossen werden?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.disturbanceOfPeaceOfDead || ''}>
                </dbp-form-enum-element>

                <h3 class="section-sub-title">2. Menschliche Stammzellen, Embryos bzw. Föten</h3>

                <dbp-form-enum-element
                    @change="${(e) => {
                        if (e.detail.value) {
                            this.humanStemCellsQuestionsEnabled =
                                e.detail.value === 'yes' ? true : false;
                        }
                    }}"
                    subscribe="lang"
                    name="human-stem-cells"
                    display-mode="list"
                    required
                    label="Bezieht sich das Forschungsvorhaben auf die Verwendung von menschlichen Stammzellen oder menschlichem Gewebe?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.humanStemCells || ''}>
                </dbp-form-enum-element>

                ${
                    this.humanStemCellsQuestionsEnabled
                        ? html`
                              <div
                                  class="question-group ${classMap({
                                      'fade-in': this.humanStemCellsQuestionsEnabled,
                                  })}">
                                  <h4 class="question-group-title">
                                      2.1. Art des Forschungsmaterials
                                  </h4>
                                  <!-- ITT TARTOK-->
                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="human-tissue-used"
                                      display-mode="list"
                                      required
                                      label="2.1.1. Beinhaltet das Forschungsvorhaben die Verwendung von menschlichem Gewebe?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.humanTissueUsed || ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      @change="${(e) => {
                                          if (e.detail.value) {
                                              this.stemCellFromEmbryosQuestionsEnabled =
                                                  e.detail.value === 'yes' ? true : false;
                                          }
                                      }}"
                                      subscribe="lang"
                                      name="human-stem-cells-used"
                                      display-mode="list"
                                      required
                                      label="2.1.2. Beinhaltet das Forschungsvorhaben die Verwendung von menschlichen Stammzellen?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.humanStemCellsUsed ||
                                      ''}></dbp-form-enum-element>

                                  ${this.stemCellFromEmbryosQuestionsEnabled
                                      ? html`
                                            <dbp-form-enum-element
                                                class="${classMap({
                                                    'fade-in':
                                                        this.stemCellFromEmbryosQuestionsEnabled,
                                                })}"
                                                subscribe="lang"
                                                name="stem-cells-from-embryos"
                                                display-mode="list"
                                                required
                                                label="2.1.2.1.	Werden die Stammzellen direkt aus Embryos gewonnen?"
                                                .items=${{
                                                    yes: 'Ja',
                                                    no: 'Nein',
                                                }}
                                                .value=${data.stemCellsFromEmbryos ||
                                                ''}></dbp-form-enum-element>
                                        `
                                      : ''}

                                  <dbp-form-enum-element
                                      @change="${(e) => {
                                          if (e.detail.value) {
                                              this.stemCellFromHumanEmbryosQuestionsEnabled =
                                                  e.detail.value === 'yes' ? true : false;
                                          }
                                      }}"
                                      subscribe="lang"
                                      name="use-of-human-embryos"
                                      display-mode="list"
                                      required
                                      label="2.1.3. Beinhaltet das Forschungsvorhaben die Verwendung von menschlichen Embryos oder Föten?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.useOfHumanEmbryos ||
                                      ''}></dbp-form-enum-element>

                                  ${this.stemCellFromHumanEmbryosQuestionsEnabled
                                      ? html`
                                            <dbp-form-enum-element
                                                class="${classMap({
                                                    'fade-in':
                                                        this
                                                            .stemCellFromHumanEmbryosQuestionsEnabled,
                                                })}"
                                                subscribe="lang"
                                                name="stem-cells-from-embryos"
                                                display-mode="list"
                                                required
                                                label="2.1.2.1.	Werden die Stammzellen direkt aus Embryos gewonnen?"
                                                .items=${{
                                                    yes: 'Ja',
                                                    no: 'Nein',
                                                }}
                                                .value=${data.stemCellsFromEmbryos ||
                                                ''}></dbp-form-enum-element>
                                        `
                                      : ''}
                              </div>

                              <div class="question-group">
                                  <h4 class="question-group-title">
                                      2.2. Herkunft des Forschungsmaterials
                                  </h4>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="commercially-available-cells"
                                      display-mode="list"
                                      required
                                      label="2.2.1. Sind die im Forschungsvorhaben verwendeten Zellen (bzw. ist das menschliche Gewebe) kommerziell verfügbar?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.commerciallyAvailableCells ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      @change="${(e) => {
                                          if (e.detail.value) {
                                              this.cellsObtainedInResearchQuestionsEnabled =
                                                  e.detail.value === 'yes' ? true : false;
                                          }
                                      }}"
                                      subscribe="lang"
                                      name="cells-obtained-in-research"
                                      display-mode="list"
                                      required
                                      label="2.2.2. Werden die im Forschungsvorhaben verwendeten Zellen (bzw. das menschliche Gewebe) im Zuge des Forschungsvorhabens gewonnen?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.cellsObtainedInResearch ||
                                      ''}></dbp-form-enum-element>

                                  ${!this.cellsObtainedInResearchQuestionsEnabled
                                      ? html`
                                            <dbp-form-string-element
                                                class="${classMap({
                                                    'fade-in':
                                                        this
                                                            .cellsObtainedInResearchQuestionsEnabled,
                                                })}"
                                                subscribe="lang"
                                                name="tissue-or-cells-source"
                                                label="2.2.2.1.	Woher stammt das im Forschungsvorhaben verwendete Gewebe bzw. die Stammzellen?"
                                                value=${data.tissueOrCellsSource || ''}
                                                required></dbp-form-string-element>
                                        `
                                      : ''}
                              </div>
                          `
                        : ''
                }


                <h3 class="section-sub-title">3. Tiere</h3>
                <dbp-form-enum-element
                    @change="${(e) => {
                        if (e.detail.value) {
                            this.animalQuestionsEnabled = e.detail.value === 'yes' ? true : false;
                        }
                    }}"
                    subscribe="lang"
                    name="animals-involved"
                    display-mode="list"
                    required
                    label="Werden im Zuge des Forschungsvorhabens Tiere herangezogen?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.testSubjects || ''}>
                </dbp-form-enum-element>

                ${
                    this.animalQuestionsEnabled
                        ? html`
                              <div
                                  class="question-group ${classMap({
                                      'fade-in': this.animalQuestionsEnabled,
                                  })}">
                                  <h4 class="question-group-title">
                                      3.1. Tiere im Forschungsvorhaben
                                  </h4>
                                  vertebrates
                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="is-animal-vertebrate"
                                      display-mode="list"
                                      required
                                      label="3.1.1.	Handelt es sich dabei um Wirbeltiere?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.isAnimalVertebrate ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="non-human-primates"
                                      display-mode="list"
                                      required
                                      label="3.1.2.	Handelt es sich dabei um nicht-menschliche Primaten (Affen, Schimpansen, Gorillas etc.)?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.nonHumanPrimates || ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="genetically-modified-animals"
                                      display-mode="list"
                                      required
                                      label="3.1.3. Sind diese Tiere genetisch verändert?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.geneticallyModifiedAnimals ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="endangered-species"
                                      display-mode="list"
                                      required
                                      label="3.1.4. Gehören diese Tiere einer bedrohten Tierart an?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.endangeredSpecies ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="alternatives-to-use-laboratory-animals"
                                      display-mode="list"
                                      required
                                      label="3.1.5. Gibt es Alternativen zur Verwendung von Versuchstieren?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.alternativesToUseLaboratoryAnimals ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="laboratory-animals-harmed"
                                      display-mode="list"
                                      required
                                      label="3.1.6. Könnten Versuchstiere im Zuge des Forschungsvorhabens zu Schaden kommen?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.laboratoryAnimalsHarmed ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="is-risk-justified"
                                      display-mode="list"
                                      required
                                      label="3.1.7. Rechtfertigt der Nutzen der Studie die Risiken für die Versuchstiere?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.isRiskJustified || ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="relevant-legal-document-available"
                                      display-mode="list"
                                      required
                                      label="3.1.8. Liegen entsprechende Rechtsgrundlagen/Dokumente vor?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.relevantLegalDocumentAvailable ||
                                      ''}></dbp-form-enum-element>
                              </div>
                          `
                        : ''
                }

                <h3 class="section-sub-title">4. Nicht-EU-Staaten / Drittstaaten</h3>
                <dbp-form-enum-element
                    @change="${(e) => {
                        if (e.detail.value) {
                            this.nonEuCountriesQuestionsEnabled =
                                e.detail.value === 'yes' ? true : false;
                        }
                    }}"
                    subscribe="lang"
                    name="non-eu-countries"
                    display-mode="list"
                    required
                    label="Wird ein Teil des Forschungsvorhabens außerhalb der EU/in Drittstaaten durchgeführt?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.testSubjects || ''}>
                </dbp-form-enum-element>

                ${
                    this.nonEuCountriesQuestionsEnabled
                        ? html`
                              <div
                                  class="question-group ${classMap({
                                      'fade-in': this.nonEuCountriesQuestionsEnabled,
                                  })}">
                                  <h4 class="question-group-title">
                                      4.1. Forschungsvorhaben außerhalb der EU bzw. in Drittstaaten
                                  </h4>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="ethical-issues"
                                      display-mode="list"
                                      required
                                      label="4.1.1. Berühren die in Drittstaaten ausgeführten Aktivitäten potentiell ethische Themen entweder aus EU-Sicht oder aus Sicht des Drittstaats?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.ethicalIssues || ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      @change="${(e) => {
                                          if (e.detail.value) {
                                              this.questionResearchFoundsQuestionsEnabled =
                                                  e.detail.value === 'yes' ? true : false;
                                          }
                                      }}"
                                      subscribe="lang"
                                      name="third-countries-local-resources"
                                      display-mode="list"
                                      required
                                      label="4.1.2. Ist die Nutzung von lokalen Ressourcen in Drittstaaten geplant?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.thirdCountriesLocalResources ||
                                      ''}></dbp-form-enum-element>

                                  ${this.questionResearchFoundsQuestionsEnabled
                                      ? html`
                                            <dbp-form-enum-element
                                                class="${classMap({
                                                    'fade-in':
                                                        this.questionResearchFoundsQuestionsEnabled,
                                                })}"
                                                subscribe="lang"
                                                name="question-research-funds"
                                                display-mode="list"
                                                required
                                                label="4.1.2.1.	Ergeben sich dadurch Fragestellungen in Zusammenhang mit der Verteilung von Forschungsmitteln?"
                                                .items=${{
                                                    yes: 'Ja',
                                                    no: 'Nein',
                                                }}
                                                .value=${data.questionResearchFounds ||
                                                ''}></dbp-form-enum-element>
                                        `
                                      : ''}

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="import-material-from-third-countries"
                                      display-mode="list"
                                      required
                                      label="4.1.3. Ist der Import von Material (außer Daten) aus Drittstaaten in die EU oder in andere Drittstaaten geplant? "
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.importMaterialFromThirdCountries ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="low-income-countries"
                                      display-mode="list"
                                      required
                                      label="4.1.4. Beinhaltet das Forschungsvorhaben Staaten mit niedrigerem und/oder unterem mittlerem Einkommen?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.lowIncomeCountries ||
                                      ''}></dbp-form-enum-element>

                                  <dbp-form-enum-element
                                      subscribe="lang"
                                      name="expose-participants-to-risk"
                                      display-mode="list"
                                      required
                                      label="4.1.5. Könnte die Teilnahme am Forschungsvorhaben die Beteiligten aufgrund der Situation in dem entsprechenden Drittstaat bzw. in dem Land außerhalb der EU einem Risiko aussetzen?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.exposeParticipantsToRisk ||
                                      ''}></dbp-form-enum-element>
                              </div>
                          `
                        : ''
                }

                <h3 class="section-sub-title">5. Nachhaltigkeit, Gesundheit und Sicherheit</h3>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="harmful-substances"
                        display-mode="list"
                        required
                        label="5.1. Kommt es zum Einsatz von Stoffen, die für Umwelt, Tiere und/oder Pflanzen schädliche Konsequenzen haben können?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.harmfulSubstances || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="negative-impacts-on-nature"
                        display-mode="list"
                        required
                        label="5.2. Sind konkrete negative Auswirkungen auf bedrohte Pflanzenarten oder Naturschutzgebiete bzw. der Verlust von Biodiversität zu befürchten?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.negativeImpactsOnNature || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        @change="${(e) => {
                            if (e.detail.value) {
                                this.harmfulSubstancesOnSubjects =
                                    e.detail.value === 'yes' ? true : false;
                            }
                        }}"
                        subscribe="lang"
                        name="harmful-substances-on-subjects"
                        display-mode="list"
                        required
                        label="5.3. Kommt es zum Einsatz von Stoffen, die für Proband*innen und/oder Forscher*innen potentiell schädliche Konsequenzen haben können?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.harmfulSubstancesOnSubjects || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.harmfulSubstancesOnSubjects
                            ? html`
                                  <dbp-form-enum-element
                                      class="${classMap({
                                          'fade-in': this.harmfulSubstancesOnSubjects,
                                      })}"
                                      subscribe="lang"
                                      name="adequate-safety-measures"
                                      display-mode="list"
                                      required
                                      label="5.3.1. Wurden adäquate Sicherheitsmaßnahmen zur Reduktion des Risikos für Proband*innen und Forscher*innen getroffen?"
                                      .items=${{
                                          yes: 'Ja',
                                          no: 'Nein',
                                      }}
                                      .value=${data.adequateSafetyMeasures ||
                                      ''}></dbp-form-enum-element>
                              `
                            : ''
                    }

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="comply-with-sustainability-strategy"
                        display-mode="list"
                        required
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.complyWithSustainabilityStrategy || ''}>
                            <span slot="label">
                                5.4. Entspricht Ihr Forschungsvorhaben der <a href='https://www.tugraz.at/tu-graz/universitaet/klimaneutrale-tu-graz/roadmap' target='_blank'>Nachhaltigkeitsstrategie</a> der TU Graz?
                            </span>
                    </dbp-form-enum-element>

                    <dbp-form-string-element
                        subscribe="lang"
                        name="appropriate-use-of-resources"
                        label="5.5.	Wodurch wird für den angemessenen Umgang mit Ressourcen Sorge getragen?"
                        placeholder="Bitte führen Sie hier zwei Beispiele an."
                        value=${data.appropriateUseOfResources || ''}
                        rows="4"
                        required>
                    </dbp-form-string-element>

                </div>

                <h3 class="section-sub-title">6. Informationsverarbeitende Systeme (insb. Artificial Intelligence)</h3>

                <div class="question-group ${classMap({'fade-in': this.nonEuCountriesQuestionsEnabled})}">
                    <h4 class="question-group-title">Im Forschungsprozess werden in aller Regel informationsverarbeitende Systeme verwendet. Bitte beantworten Sie daher die nachfolgenden Fragen.</h4>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="replace-human-decision-making"
                        display-mode="list"
                        required
                        label="6.1.	Können die im Forschungsvorhaben eingesetzten informationsverarbeitenden Systeme menschliche Entscheidungsfindungsprozesse beeinflussen, ersetzen oder umgehen?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.replaceHumanDecisionMaking || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="potentially-stigmatize-people"
                        display-mode="list"
                        required
                        label="6.2.	Können die im Forschungsvorhaben eingesetzten informationsverarbeitenden Systeme Menschen potentiell stigmatisieren oder diskriminieren?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.potentiallyStigmatizePeople || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="negative-social-consequences"
                        display-mode="list"
                        required
                        label="6.3.	Können die im Forschungsvorhaben eingesetzten informationsverarbeitenden Systeme potenziell zu negativen sozialen Konsequenzen zu führen?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.negativeSocialConsequences || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        subscribe="lang"
                        name="weapon-system"
                        display-mode="list"
                        required
                        label="6.4.	Beinhaltet das Forschungsvorhaben den Einsatz von informationsverarbeitenden Systemen in einem Waffensystem? "
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.weaponSystem || ''}>
                    </dbp-form-enum-element>

                    <dbp-form-enum-element
                        @change="${(e) => {
                            if (e.detail.value) {
                                this.ethicalIssuesListQuestion =
                                    e.detail.value === 'yes' ? true : false;
                            }
                        }}"
                        subscribe="lang"
                        name="has-ethical-issues"
                        display-mode="list"
                        required
                        label="6.5.	Wirft die Entwicklung und/oder Anwendung dieser informationsverarbeitenden Systeme noch weitere ethische Fragen auf, die nicht von der Liste abgedeckt sind?"
                        .items=${{
                            yes: 'Ja',
                            no: 'Nein',
                        }}
                        .value=${data.hasEthicalIssues || ''}>
                    </dbp-form-enum-element>

                    ${
                        this.ethicalIssuesListQuestion
                            ? html`
                                  <dbp-form-string-element
                                      class="${classMap({
                                          'fade-in': this.ethicalIssuesListQuestion,
                                      })}"
                                      subscribe="lang"
                                      name="ethical-issues-list"
                                      label="Welche"
                                      placeholder="Liste der ethischen Fragen hier"
                                      value=${data.ethicalIssuesList || ''}
                                      rows="5"
                                      required></dbp-form-string-element>
                              `
                            : ''
                    }

                    <dbp-form-string-element
                        subscribe="lang"
                        name="other-comments-on-information-processing"
                        label="Sonstige Anmerkungen zu 6."
                        placeholder=""
                        value=${data.otherCommentsOnInformationProcessing || ''}
                        rows="5"
                        required>
                    </dbp-form-string-element>
                </div>


                <h3 class="section-sub-title">7. Interessenskonflikte</h3>

                <dbp-form-enum-element
                    @change="${(e) => {
                        if (e.detail.value) {
                            this.hasConflictOfInterestSubQuestion =
                                e.detail.value === 'yes' ? true : false;
                        }
                    }}"
                    subscribe="lang"
                    name="has-conflicts-of-interest"
                    display-mode="list"
                    required
                    label="7.1. Bestehen mögliche Interessenskonflikte mit dem Auftraggeber und/oder mit Projektpartner*innen?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.hasConflictOfInterest || ''}>
                </dbp-form-enum-element>

                ${
                    this.hasConflictOfInterestSubQuestion
                        ? html`
                              <dbp-form-string-element
                                  class="${classMap({
                                      'fade-in': this.hasConflictOfInterestSubQuestion,
                                  })}"
                                  subscribe="lang"
                                  name="conflicts-of-interest-list"
                                  label="Welche"
                                  placeholder="Liste der Interessenskonflikten hier"
                                  value=${data.conflictOfInterestList || ''}
                                  rows="5"
                                  required></dbp-form-string-element>
                          `
                        : ''
                }

                <dbp-form-enum-element
                    @change="${(e) => {
                        if (e.detail.value) {
                            this.hasConfidentialPartSubQuestion =
                                e.detail.value === 'yes' ? true : false;
                        }
                    }}"
                    subscribe="lang"
                    name="has-confidential-part"
                    display-mode="list"
                    required
                    label="7.2.	Unterliegen die Ergebnisse Ihres Forschungsvorhabens oder Teile davon der Geheimhaltung bzw. ist die Veröffentlichung und/oder weitere Nutzung untersagt?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.hasConfidentalPart || ''}>
                </dbp-form-enum-element>

                ${
                    this.hasConfidentialPartSubQuestion
                        ? html`
                              <dbp-form-string-element
                                  class="${classMap({
                                      'fade-in': this.hasConfidentialPartSubQuestion,
                                  })}"
                                  subscribe="lang"
                                  name="nature-of-blocking"
                                  label="7.2.1. Von welcher Art ist diese Sperrung?"
                                  placeholder=""
                                  value=${data.natureOfBlocking || ''}
                                  rows="3"
                                  required></dbp-form-string-element>

                              <dbp-form-string-element
                                  class="${classMap({
                                      'fade-in': this.hasConfidentialPartSubQuestion,
                                  })}"
                                  subscribe="lang"
                                  name="reason-of-blocking"
                                  label="7.2.2. Welche Begründung gibt es für die Sperrung?"
                                  placeholder=""
                                  value=${data.reasonOfBlocking || ''}
                                  rows="3"
                                  required></dbp-form-string-element>

                              <dbp-form-string-element
                                  class="${classMap({
                                      'fade-in': this.hasConfidentialPartSubQuestion,
                                  })}"
                                  subscribe="lang"
                                  name="consequences-of-blocking"
                                  label="7.2.3. Welche Konsequenzen sind für die Forschenden durch eine Sperrung zu erwarten (insbesondere in Bezug auf Qualifikationsarbeiten)?"
                                  placeholder=""
                                  value=${data.consequencesOfBlocking || ''}
                                  rows="3"
                                  required></dbp-form-string-element>
                          `
                        : ''
                }

                <dbp-form-enum-element
                    @change="${(e) => {
                        if (e.detail.value) {
                            this.hasConflictInContentControlSubQuestion =
                                e.detail.value === 'yes' ? true : false;
                        }
                    }}"
                    subscribe="lang"
                    name="has-conflicts-in-content-control"
                    display-mode="list"
                    required
                    label="7.3.	Kann es Interessenskonflikte über die Inhaltskontrolle der Veröffentlichung geben?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.hasConflictInContentControl || ''}>
                </dbp-form-enum-element>

                ${
                    this.hasConflictInContentControlSubQuestion
                        ? html`
                              <dbp-form-string-element
                                  class="${classMap({
                                      'fade-in': this.hasConflictInContentControlSubQuestion,
                                  })}"
                                  subscribe="lang"
                                  name="conflicts-in-content-control-list"
                                  label="Welche"
                                  placeholder="Liste der Interessenskonflikten hier"
                                  value=${data.conflictInContentControlList || ''}
                                  rows="5"
                                  required></dbp-form-string-element>
                          `
                        : ''
                }

                <dbp-form-enum-element
                    @change="${(e) => {
                        if (e.detail.value) {
                            this.stakeholderParticipationPlannedSubQuestion =
                                e.detail.value === 'yes' ? true : false;
                        }
                    }}"
                    subscribe="lang"
                    name="stakeholder-participation-planned"
                    display-mode="list"
                    required
                    label="7.4.	Ist die Beteiligung von Stakeholdern geplant?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.stakeholderParticipationPlanned || ''}>
                </dbp-form-enum-element>

                ${
                    this.stakeholderParticipationPlannedSubQuestion
                        ? html`
                              <dbp-form-enum-element
                                  class="${classMap({
                                      'fade-in': this.stakeholderParticipationPlannedSubQuestion,
                                  })}"
                                  subscribe="lang"
                                  name="has-provision-for-appropriate-recognition"
                                  display-mode="list"
                                  required
                                  label="7.4.1. Ist eine angemessene Anerkennung von deren Aufwand vorgesehen?"
                                  .items=${{
                                      yes: 'Ja',
                                      no: 'Nein',
                                  }}
                                  .value=${data.hasProvisionForAppropriateRecognition ||
                                  ''}></dbp-form-enum-element>
                          `
                        : ''
                }

                <h3 class="section-sub-title">8. Technikfolgen</h3>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="has-negative-effects"
                    display-mode="list"
                    required
                    label="8.1.	Sind negative Auswirkungen auf Individuen und/oder die Gesellschaft zu erwarten (z.B.: Einschränkung der persönlichen Autonomie, möglicher Kompetenzverlust durch zunehmende Automatisierung – „deskilling“, mögliche Auswirkungen auf den Arbeitsmarkt, Diskriminierung)"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.hasNegativeEffects || ''}>
                </dbp-form-enum-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="has-risk-of-reputational-damage"
                    display-mode="list"
                    required
                    label="8.2.	Besteht das Risiko eines Reputationsschadens für die TU Graz?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.hasRiskOfReputationDamage || ''}>
                </dbp-form-enum-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="related-to-development-of-weapons"
                    display-mode="list"
                    required
                    label="8.3.	Hat Ihr Projekt mit der Entwicklung von Waffensystemen zu tun?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.relatedToDevelopmentOfWeapons || ''}>
                </dbp-form-enum-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="has-dual-use"
                    display-mode="list"
                    required
                    label="8.4.	Könnten Ihre Forschungsergebnisse oder Teile davon eine (Weiter)Verwendung finden (Dual Use, z.B.: im Rahmen der Militärforschung, Überwachung)?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.hasDualUse || ''}>
                </dbp-form-enum-element>

                <dbp-form-enum-element
                    @change="${(e) => {
                        if (e.detail.value) {
                            this.riskSubQuestion = e.detail.value === 'yes' ? true : false;
                        }
                    }}"
                    subscribe="lang"
                    name="has-any-risks"
                    display-mode="list"
                    required
                    label="8.5.	Ergeben sich unter Berücksichtigung aller Antworten aus Ihrer Sicht Risiken oder Folgeerscheinungen?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.hasAnyRisks || ''}>
                </dbp-form-enum-element>

                ${
                    this.riskSubQuestion
                        ? html`
                              <dbp-form-string-element
                                  class="${classMap({'fade-in': this.riskSubQuestion})}"
                                  subscribe="lang"
                                  name="risks-reasons"
                                  label="Begründung"
                                  required
                                  value=${data.risksReasons || ''}></dbp-form-string-element>
                          `
                        : ''
                }

                <h3 class="section-sub-title">9. Arbeitsbedingungen im Forschungsvorhaben (soweit sie durch die Projektleitung beeinflusst werden können)</h3>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="employment-contract"
                    display-mode="list"
                    required
                    label="9.1.	Sind in Ihrem Forschungsvorhaben Arbeitsverträge kurzer Dauer (bis zu einem Jahr) geplant?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.employmentContract || ''}>
                </dbp-form-enum-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="work-life-balance"
                    display-mode="list"
                    required
                    label="9.2.	Werden Aspekte der Work-Life-Balance (auch bereits in der Projektplanung) angemessen berücksichtigt?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.workLifeBalance || ''}>
                </dbp-form-enum-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="fair-compensation"
                    display-mode="list"
                    required
                    label="9.3.	Gibt es eine angemessene und faire Entlohnung für unterschiedliche Tätigkeiten im Projekt (z.B.: auch für die Annotierung und Bearbeitung von Datensätzen)?"
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.fairCompensation || ''}>
                </dbp-form-enum-element>

                <dbp-form-enum-element
                    subscribe="lang"
                    name="diversity-aspects"
                    display-mode="list"
                    required
                    label=""
                    .items=${{
                        yes: 'Ja',
                        no: 'Nein',
                    }}
                    .value=${data.diversityAspects || ''}>
                    <span slot="label">
                        9.4. Werden im Projekt diversitäts- und gendersensible Aspekte berücksichtigt (<a href='https://tu4u.tugraz.at/fileadmin/public/Studierende_und_Bedienstete/Anleitungen/Diversity-Gender_in_Forschungsprojekten_Checkliste_Deutsch.pdf?sword_list%5B0%5D=gender&sword_list%5B1%5D=forschung&no_cache=1' target='_blank'>siehe Leitfaden der TU Graz</a>)?
                    </span>
                </dbp-form-enum-element>

                <h2 class="section-title">4. Weitere Unterlagen</h2>
                <div class="description">
                    <p>Falls zutreffend: Bitte legen Sie an Proband*innen gerichtete Fragebögen, Erhebungsbögen oder Aufgabenstellungen Ihrem Antrag bei.</p>
                    <p>Allenfalls können Sie weitere Dokumente beilegen, die aus Ihrer Sicht von Relevanz für die Beurteilung Ihres Forschungsvorhabens im Gesamten sind.</p>
                </div>

                <!--
                <div class="file-upload-container">
                    <input type="file" name="attachments" multiple>
                </div>
                -->

                ${this.getButtonRowHtml()}
            </form>
            ${this.renderResult(this.submitted)}
            ${this.renderErrorMessage(this.submissionError)}
        `;
    }

    renderResult(submitted) {
        const i18n = this._i18n;

        if (submitted) {
            return html`
                <div class="container">
                    <h2>
                        ${i18n.t(
                            'render-form.forms.ethics-commission-form.submission-result-thanks',
                        )}
                    </h2>
                    <p>
                        ${i18n.t(
                            'render-form.forms.ethics-commission-form.submission-result-notification',
                        )}
                    </p>
                </div>
            `;
        }

        return html``;
    }

    renderErrorMessage(submissionError) {
        const i18n = this._i18n;

        if (submissionError) {
            return html`
                <div class="container">
                    <h2>${i18n.t('render-form.forms.ethics-commission-form.submission-error')}</h2>
                    <p>
                        ${i18n.t(
                            'render-form.forms.ethics-commission-form.submission-error-notification',
                        )}
                    </p>
                </div>
            `;
        }

        return html``;
    }
}
