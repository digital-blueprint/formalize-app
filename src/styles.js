import {css} from 'lit';

export function getDragListCss() {
    // language=css
    return css`
        .draggable-list {
            border: var(--dbp-border);
            color: var(--dbp-content);
            padding: 0;
            list-style-type: none;
        }

        .draggable-list li {
            background-color: var(--dbp-background);
            color: var(--dbp-content);
            display: flex;
            flex: 1;
        }

        .draggable-list li:not(:last-of-type) {
            border-bottom: var(--dbp-border);
        }

        .draggable-list .number {
            background-color: var(--dbp-background);
            color: var(--dbp-content);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            height: 60px;
            width: 60px;
        }

        .draggable-list li.over .draggable {
            background-color: var(--dbp-muted-surface);
            color: var(--dbp-on-muted-surface);
        }

        .draggable-list .col-name {
            margin: 0 20px 0 0;
        }

        .draggable {
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 15px;
            flex: 1;
        }

        .draggable {
            cursor: move;
            user-select: none;
            border: 3px solid deeppink;
        }

        .check-btn {
            background-color: var(--dbp-background);
            border: none;
            color: var(--dbp-content);
            font-size: 16px;
            padding: 10px 20px;
            cursor: pointer;
        }

        .check-btn:active {
            transform: scale(0.98);
        }

        .check-btn:focus {
            outline: none;
        }
    `;
}

export function getFileHandlingCss() {
    // language=css
    return css`
        /**************************\\
          Modal Styles
        \\**************************/

        .modal-container {
            grid-template-columns: 150px 1fr;
            grid-template-rows: auto 1fr;
            gap: 1px 1px;
            grid-template-areas: 'sidebar header' 'sidebar main';
            position: relative;

            background-color: var(--dbp-override-background);
            color: var(--dbp-override-content);
            max-width: 600px;
            max-height: 100vh;
            min-width: 60%;
            min-height: 50%;
            overflow-y: auto;
            box-sizing: border-box;
            display: grid;
            height: 70%;
            width: 70%;
            position: relative;
        }

        .modal-nav {
            cursor: pointer;
            overflow: hidden;
            background-color: var(--dbp-background);
            border-right: var(--dbp-border);
            grid-area: sidebar;
        }

        .modal-nav > div {
            padding: 5px;
            text-align: center;
        }

        .modal-nav .nav-icon {
            width: 35px;
            height: 35px;
        }

        .modal-nav .active {
            background-color: var(--dbp-content-surface);
            color: var(--dbp-on-content-surface);
        }

        .modal-content {
            padding: 10px 20px 20px 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
        }

        .modal-content .source-main {
            height: 100%;
            width: 100%;
            display: flex;
            align-items: flex-end;
        }

        .modal-content .source-main.hidden {
            display: none;
        }

        .modal-header {
            grid-area: header;
            display: flex;
            padding: 10px 20px 0px 20px;
            flex-direction: row-reverse;
            justify-content: space-between;
            align-items: center;
        }

        .micromodal-slide .modal-container,
        .micromodal-slide .modal-overlay {
            will-change: auto;
        }

        /**************************\\
         Tablet Portrait Styles
       \\**************************/

        @media only screen and (orientation: portrait) and (max-width: 768px) {
            .modal-nav {
                display: flex;
                grid-area: nav;
                border: none;
                border-bottom: var(--dbp-border);
                border-top: var(--dbp-border);
                white-space: nowrap;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                -ms-overflow-style: -ms-autohiding-scrollbar;
            }

            .modal-nav::-webkit-scrollbar {
                display: none;
            }

            .modal-content {
                grid-area: main;
            }

            .modal-container {
                grid-template-rows: 40px 55px auto;
                grid-template-areas: 'header' 'nav' 'main';
                grid-template-columns: auto;
            }

            .modal-header {
                grid-area: header;
                padding: 5px;
            }

            .modal-nav > div {
                flex-grow: 1;
            }

            .modal-nav .nav-icon {
                height: 20px;
            }

            #custom-pagination {
                position: sticky;
                bottom: 0;
                z-index: 10;
            }
        }
    `;
}

export function getSelectorFixCSS() {
    // language=css
    return css`
        /* For some reasons the selector chevron was very large */
        select:not(.select),
        .dropdown-menu {
            background-size: 1em;
        }
    `;
}

export function getEthicsCommissionFormCSS() {
    // language=css
    return css`
        #ethics-commission-form {
            position: relative;

            container-type: inline-size;
            container-name: form;
        }

        .notification {
            margin-bottom: 2em;
        }

        .draft-mode {
            z-index: 5;
            position: fixed;
            bottom: 0;
            left: 0;
            width: 0;
            height: 0;
            border-style: solid;
            border-width: 0 0 200px 200px;
            /*border-width: 0 0 min(20vw, 200px) min(20vw, 200px);*/
            border-color: transparent transparent var(--dbp-warning-surface) transparent;
            transform: rotate(90deg);
        }

        .draft-mode__text {
            position: absolute;
            top: 120px;
            /*top: min(17vw, 120px);*/
            left: -131px;
            /*left: min(-20vw, -131px);*/
            transform: rotate(-45deg);
            font-weight: bold;
            font-size: 24px;
            /*font-size: min(4vw, 24px);*/
            color: white;
            white-space: nowrap;
        }

        .form-details {
            border: 1px solid var(--dbp-content);
            border-top: none;
            margin-top: 0;
            padding: 1em;
            display: flex;
            flex-direction: column;
            gap: 2em;
            min-width: 250px;
        }

        .submission-dates {
            display: flex;
            justify-content: flex-start;
            flex-direction: column;
            gap: 0;

            .label {
                margin: 0.5em 0 0 0;
                display: inline-block;
            }
        }

        .submission-permissions {
            width: 100%;
            container: permissions / inline-size;

            &.open {
                .users-permissions {
                    display: flex;
                    opacity: 1;

                    @starting-style {
                        opacity: 0;
                    }
                }

                .user-permissions-title dbp-icon {
                    transform: rotate(-180deg);
                }
            }

            .users-permissions {
                flex-direction: column;
                gap: 0.5em;
                display: none;
                opacity: 0;
                margin-top: 1em;
                transition:
                    opacity 0.3s cubic-bezier(0.9, 0, 0.1, 1),
                    display 0.3s cubic-bezier(0.9, 0, 0.1, 1) allow-discrete;
            }

            .user-permissions-title {
                /* button style reset */
                background: none;
                color: inherit;
                border: none;
                font: inherit;
                cursor: pointer;
                outline: inherit;
                appearance: none;

                font-weight: bold;
                border-radius: 4px;
                display: block;
                font-size: 16px;
                padding: 1em;
                margin-left: -1em;

                &:hover {
                    background-color: light-dark(#f7f7f7, #333333);
                }

                &[disabled] {
                    cursor: not-allowed;
                }

                dbp-icon {
                    margin-right: 0.5em;
                    transition: transform 0.15s ease;
                    transition-delay: 250ms;
                    color: var(--dbp-accent);
                }
            }

            .permissions-header {
                display: flex;
                gap: 1em;
                justify-content: space-between;
                align-items: center;
                padding-left: 0.5em;
            }

            .user-entry {
                display: flex;
                align-items: center;
                gap: 0.5em;
            }

            .person-name {
                width: 200px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .person-permissions {
                display: flex;
                gap: 0.5em;
                flex-wrap: nowrap;
            }

            .person-permission {
                display: inline-block;
                padding: 0 6px;
                line-height: 20px;
                background-color: light-dark(#f2f2f2, #333333);
            }
        }

        @container permissions (width < 380px) {
            .permissions-header {
                flex-direction: column;
            }
        }

        .form-title {
            text-align: center;
            font-size: 2em;
            line-height: 1.2;
        }

        .form-sub-title {
            text-align: center;
            font-size: 1.6em;
            line-height: 1.2;
        }

        .type-container {
            display: flex;
            justify-content: center;
            gap: 3em;
        }

        .section-title {
            font-size: 2.4em;
            font-weight: bold;
            line-height: 1.2;
            margin: 1.8em 0 1em;
        }

        .section-sub-title {
            font-size: 2em;
            font-weight: bold;
            line-height: 1.2;
            margin: 1.5em 0 0.8em;
        }

        .question-group-title {
            font-size: 1.6em;
            font-weight: bold;
            line-height: 1.2;
            margin: 1.2em 0 0.6em;
        }

        [slot='label'] a {
            text-decoration: underline;
            text-underline-offset: 2px;
        }

        .info-box {
            background-color: #c9e4c6;
            padding: 1em;
            p:first-child {
                margin-top: 0;
            }
            p:last-child {
                margin-bottom: 0;
            }
        }

        /* buttons */
        .button-row {
            display: flex;
            justify-content: space-between;
            flex-direction: column;
            gap: 1em;

            position: sticky;
            top: -100px;
            z-index: 9;

            right: 0;
            left: 0;
            background: var(--dbp-background);
            padding: 1em;
            border: 1px solid var(--dbp-content);
            min-width: 250px;
            min-height: 130px;

            .button-label {
                padding-left: 0.5em;
            }
        }

        .buttons-wrapper,
        .dates-wrapper {
            display: flex;
            gap: 1em;
            flex-wrap: wrap;
        }

        .buttons-wrapper {
            align-items: flex-end;
            justify-content: flex-end;
        }

        .form-delete-submission-button {
            color: var(--dbp-danger);
            border-color: var(--dbp-danger);

            .button-label,
            dbp-icon {
                color: var(--dbp-danger);
            }
        }

        .edit-permissions {
            .button-text {
                padding-left: 5px;
            }
        }

        @container form (width < 750px) {
            /* Make icon buttons for small screens ? */
            .button-row {
                button,
                dbp-button {
                    .button-label {
                        display: none;
                    }
                }
            }

            .submission-details {
                flex-direction: column;
            }
        }

        @container form (width < 420px) {
            .submission-details {
                .user-entry {
                    flex-direction: column;
                    align-items: flex-start;
                }
                .person-permissions {
                    width: 100%;
                    justify-content: flex-end;
                }
            }
        }

        .file-upload-container {
            margin-bottom: 3em;
            border: var(--dbp-border);
            padding: 1em 1em 1.5em 1em;
            display: flex;
            flex-direction: column;
            gap: 1em;
        }

        .attachments-title {
            margin: 0;
            font-size: 24px;
        }

        .uploaded-files {
            display: flex;
            flex-direction: column;
        }

        .attachment-upload-button {
            width: fit-content;
        }

        .file-block {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid #dadada;
            padding: 0.5em;
        }

        .file-block:nth-child(2n + 1) {
            background-color: #dadada;
            color: light-dark(var(--dbp-content), var(--dbp-background));
        }

        .file-info {
            display: flex;
            gap: 1em;
            width: calc(100% - 2em);
            justify-content: space-between;
            padding-right: 2em;
            max-width: 56%;
        }

        .file-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .file-size {
            font-weight: bolder;
        }

        .file-action-buttons {
            display: flex;
            gap: 1em;
            flex-wrap: nowrap;
        }

        .additional-data {
            display: flex;
            flex-wrap: nowrap;
            flex-shrink: 0;
            gap: 0.5em;
        }

        @container form (width < 820px) {
            .additional-data {
                display: none;
            }
            .file-info {
                max-width: 42%;
            }
        }

        @container form (width < 540px) {
            .file-block {
                align-items: flex-start;
                flex-direction: column;
                gap: 1em;
            }

            .file-action-buttons {
                width: 100%;
                justify-content: flex-end;
            }
        }

        /* Add some space to the scroller under the form */
        form > article:last-child {
            margin-bottom: 8em;
        }

        .scroller-container {
            position: sticky;
            top: 90vh;
            text-align: right;
            pointer-events: none;
            z-index: 9;
            height: 0;
        }

        .scroller {
            width: 50px;
            height: 50px;
            font-size: 38px;
            border: var(--dbp-border);
            color: var(--dbp-content);
            background-color: var(--dbp-background);
            transform: translateX(150%);
            pointer-events: all;
            cursor: pointer;
        }

        .lettered-list {
            list-style-type: lower-alpha;
        }

        @media only screen and (max-width: 1600px) {
            .scroller {
                opacity: 0.7;
                transform: translateX(0);
            }
            .scroller:hover {
                opacity: 1;
            }
        }

        @media only screen and (max-width: 768px) {
            .button-row {
                top: -60px;
            }
        }

        @media only screen and (max-width: 450px) {
            .draft-mode {
                border-width: 0px 0px 100px 100px;
            }
            .draft-mode__text {
                top: 53px;
                left: -72px;
                font-size: 15px;
            }

            .lettered-list {
                padding-left: 1em;

                ol {
                    padding-left: 1em;
                }
            }
        }

        /* modal */
        .pdf-view-modal {
            --dbp-modal-width: 80vw;
            --dbp-modal-min-width: 320px;
            --dbp-modal-max-width: 1000px;
            --dbp-modal-min-height: 35vh;
            --dbp-modal-max-height: 95vh;
        }

        .modal--permissions {
            --dbp-modal-width: 80vw;
        }

        /* utils */
        .visually-hidden {
            position: absolute !important;
            clip: rect(1px, 1px, 1px, 1px);
            overflow: hidden;
            height: 1px;
            width: 1px;
            word-wrap: normal;
        }

        /* animations */

        .button,
        dbp-button {
            dbp-icon {
                transition: transform 0.1s ease-in;
            }

            &:hover dbp-icon {
                transform: scale(1.25);
            }
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }

        .fade-in {
            animation: fadeIn 0.5s ease-in-out forwards;
        }
    `;
}

export function getEthicsCommissionFormPrintCSS() {
    // language=css
    return css`
        /* PRINTING STYLES */
        .print {
            --dbp-form-font-size: 16px;
            --dbp-form-line-height: 24px;

            padding: 0 !important;
            font-size: var(--dbp-form-font-size) !important;
            line-height: var(--dbp-form-line-height) !important;

            /* PAGE BREAKS */
            .form-sub-title,
            .section-title {
                page-break-before: always;
                break-before: page;
            }

            fieldset {
                page-break-inside: avoid;
                break-inside: avoid;
            }

            /* Title styles */
            .form-title,
            .form-sub-title,
            .section-title,
            .section-sub-title,
            .question-group-title {
                line-height: var(--dbp-form-line-height) !important;
                font-size: var(--dbp-form-line-height);
                margin: 0;
                padding: 0 0 var(--dbp-form-line-height) 0;
                text-align: center;
            }

            .section-sub-title {
                font-size: 20px; /* custom size. Need to be less than line-height */
                padding: 0 0 var(--dbp-form-line-height) 0;
                margin: 0;
                text-align: center;
            }

            .question-group-title {
                font-size: 18px; /* custom size. Need to be less than line-height */
                padding: 0 0 var(--dbp-form-line-height) 0;
                margin: 0;
                text-align: center;
            }

            .button-row .buttons-wrapper,
            button,
            dbp-button,
            .submission-permissions,
            .scroller-container {
                display: none !important;
                height: 0;
                overflow: hidden;
            }

            .submission-dates-wrapper {
                margin-bottom: var(--dbp-form-line-height);
            }

            sup {
                vertical-align: baseline;
                padding-left: 3px;
            }

            fieldset {
                border: none;
                margin: 0;
                padding: 0 0 var(--dbp-form-line-height) 0;
            }

            p,
            ul,
            ol {
                margin: var(--dbp-form-line-height);
            }

            fieldset label {
                font-weight: bold;
                display: block;
            }

            .draft-mode {
                display: none;
            }

            /* Line height debug background */
            background-image: linear-gradient(
                to bottom,
                rgba(0, 120, 255, 0.1) 0,
                rgba(0, 120, 255, 0.1) 1px,
                transparent 1px,
                transparent var(--dbp-form-line-height)
            );
            background-size: 100% var(--dbp-form-line-height);
            background-position: 0 0;
        }
    `;
}
