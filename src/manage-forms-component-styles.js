// @ts-nocheck
import {css} from 'lit';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {getSelectorFixCSS, getFileHandlingCss, getTagsCSS, getManageFormsCSS} from './styles.js';

export const MANAGE_FORMS_COMPONENT_STYLES = css`
    @layer theme, utility, formalize;
    @layer theme {
        ${commonStyles.getThemeCSS()}
        ${commonStyles.getModalDialogCSS()}
        ${commonStyles.getRadioAndCheckboxCss()}
        ${commonStyles.getGeneralCSS(false)}
        ${commonStyles.getNotificationCSS()}
        ${commonStyles.getActivityCSS()}
        ${commonStyles.getButtonCSS()}
        ${getSelectorFixCSS()}
        ${getFileHandlingCss()}
        ${getTagsCSS()}
    }

    @layer formalize {
        ${getManageFormsCSS()}

        .visually-hidden {
            clip: rect(0 0 0 0);
            clip-path: inset(50%);
            height: 1px;
            overflow: hidden;
            position: absolute;
            white-space: nowrap;
            width: 1px;
        }
    }
`;
