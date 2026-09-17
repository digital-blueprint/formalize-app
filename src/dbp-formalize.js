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

    _updateVisibleRoutes() {
        const originalDisabledStates = new Map();

        for (const routingName of this.routes) {
            const activity = this.metadata[routingName];
            if (activity.feature_flag !== AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG) continue;

            originalDisabledStates.set(activity, activity.disabled);
            activity.disabled = !isAvailableFormsOverviewEnabled();
        }

        try {
            super._updateVisibleRoutes();
        } finally {
            for (const [activity, disabled] of originalDisabledStates) {
                activity.disabled = disabled;
            }
        }
    }
}

commonUtils.defineCustomElement('dbp-formalize', FormalizeAppShell);
commonUtils.defineCustomElement('dbp-translated', Translated);
