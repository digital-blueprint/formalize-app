import {css} from 'lit';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {getSelectorFixCSS, getFileHandlingCss, getTagsCSS, getManageFormsCSS} from './styles.js';

/**
 * Styles shared by the manage-forms and manage-submissions activities
 * and the form submissions component.
 */
export function getManageFormsActivityStyles() {
    // language=css
    return css`
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
}
