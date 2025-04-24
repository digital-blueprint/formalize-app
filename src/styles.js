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
            z-index: 9;
            position: fixed;
            bottom: 0;
            right: 0;
            width: 0;
            height: 0;
            border-style: solid;
            border-width: 0 0 200px 200px;
            border-color: transparent transparent var(--dbp-warning-surface) transparent;
        }

        .draft-mode__text {
            position: absolute;
            top: 120px;
            left: -131px;
            transform: rotate(-45deg);
            font-weight: bold;
            font-size: 24px;
            color: white;
            white-space: nowrap;
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

        /* buttons */
        .button-row {
            display: flex;
            justify-content: space-between;
            gap: 1em;

            position: sticky;
            top: 0;
            z-index: 9;

            right: 0;
            left: 0;
            background: var(--dbp-background);
            padding: 1em;
            border: var(--dbp-border);

            .button-label {
                padding-left: 0.5em;
            }
        }

        .right-buttons,
        .left-buttons {
            display: flex;
            gap: 1em;
        }

        @container form (width < 820px) {
            /* Make icon buttons for small screens ? */
            .button-row {
                button,
                dbp-button {
                    .button-label {
                        display: none;
                    }
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
        }

        .scroller {
            width: 50px;
            height: 50px;
            font-size: 48px;
            border: var(--dbp-border);
            padding: 10px;
            color: var(--dbp-content);
            background-color: var(--dbp-background);
            transform: translateX(150%);
            pointer-events: all;
            cursor: pointer;
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

        /* PRINTING STYLES */
        .print {
            padding: 0;
            font-size: 14px;

            fieldset {
                background: red;
                border: none;
                padding: 0;
            }

            fieldset label {
                font-weight: bold;
            }

            article {
                page-break-before: auto;
                page-break-inside: avoid;
            }

            .section-title {
                page-break-before: always;
            }

            .textarea {
                page-break-inside: auto;
            }

            li,
            p,
            .textarea {
                page-break-inside: avoid;
            }

            textarea,
            input[type='text'] {
                border: none;
            }

            .button-row {
                display: none;
            }
        }
    `;
}
