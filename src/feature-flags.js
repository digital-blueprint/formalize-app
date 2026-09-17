import {getFeatureFlag, registerFeatureFlag} from '@dbp-toolkit/common';

export const AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG = 'available-forms-overview';

registerFeatureFlag(AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG);

export function isAvailableFormsOverviewEnabled() {
    return getFeatureFlag(AVAILABLE_FORMS_OVERVIEW_FEATURE_FLAG);
}
