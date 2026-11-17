import '@webcomponents/scoped-custom-element-registry';
import {AppShell} from '@dbp-toolkit/app-shell';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Translated} from '@dbp-toolkit/common/src/translated';
import {
    AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG,
    isAvailableFormsOverviewEnabled,
} from './feature-flags.js';

export class FormalizeAppShell extends AppShell {
    constructor() {
        super();
        this._handleFeatureFlagChange = this._handleFeatureFlagChange.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('change', this._handleFeatureFlagChange);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('change', this._handleFeatureFlagChange);
    }

    _handleFeatureFlagChange(event) {
        const changedFeatureFlag = event
            .composedPath()
            .find((element) => element?.dataset?.key === AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG)
            ?.dataset?.key;
        if (!changedFeatureFlag) return;

        this._updateVisibleRoutes();
        const activeActivity =
            /** @type {import('lit').LitElement & {loadAvailableForms?: () => Promise<void>}} */ (
                this._lastElm
            );
        activeActivity?.requestUpdate();
        if (isAvailableFormsOverviewEnabled()) {
            void activeActivity?.loadAvailableForms?.();
        }
    }

    /**
     * Applies the feature flag state to the activity metadata.
     *
     * The metadata is the single source of truth for the disabled state of a menu item, it is
     * also read by the app-shell when switching away from an activity to restore the default.
     * So the flag has to be written through instead of only patching the visible routes,
     * otherwise leaving the activity would re-apply the stale metadata default.
     */
    _applyFeatureFlagToMetadata() {
        for (const routingName of this.routes) {
            const activity = this.metadata[routingName];
            if (activity?.feature_flag !== AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG) continue;

            activity.disabled = !isAvailableFormsOverviewEnabled();
        }
    }

    _updateVisibleRoutes() {
        this._applyFeatureFlagToMetadata();
        super._updateVisibleRoutes();
    }
}

commonUtils.defineCustomElement('dbp-formalize', FormalizeAppShell);
commonUtils.defineCustomElement('dbp-translated', Translated);
