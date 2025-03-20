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

        .file-upload-container {
            margin-bottom: 3em;
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
    `;
}
