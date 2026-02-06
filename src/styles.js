import {css, unsafeCSS} from 'lit';
import {getIconSVGURL} from '@dbp-toolkit/common';

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
            padding: 30px 20px 20px 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
        }

        .modal-header-tag {
            margin-bottom: 10px;
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

export function getTagsCSS() {
    // language=css
    return css`
        .tag {
            padding: 1px 4px;
            border-radius: 2px;
            text-transform: uppercase;
        }

        .tag.tag--mode {
            background-color: #f2f2f2;
            color: #121212;
            white-space: nowrap;
        }

        .tag.tag--state {
            background-color: var(--dbp-warning-surface);
            color: var(--dbp-on-warning-surface);
        }
    `;
}

export function getShowSubmissionCSS() {
    // language=css
    return css`
        .table-wrapper.submissions {
            padding-top: 0.5rem;
        }

        .table-header.submissions {
            margin-top: 0.5rem;
        }

        .btn-row-left {
            display: flex;
            justify-content: space-between;
            gap: 4px;
        }

        .btn-row-left > * {
            display: flex;
            align-items: center;
        }

        .next-btn dbp-icon,
        .back-btn dbp-icon {
            height: 15px;
            top: 3px;
        }

        .next-btn dbp-icon {
            margin-left: 0.2em;
            margin-right: -0.4em;
        }

        .back-btn dbp-icon {
            margin-left: -0.4em;
            margin-right: 0.2em;
        }

        .detailed-submission-modal-title {
            margin-bottom: 10px;
        }

        .detailed-submission-modal-content {
            padding: 0 20px 0 20px;
        }

        .detailed-submission-modal-box {
            height: auto;
            width: auto;
            overflow-y: hidden;
            min-height: 0;
            max-width: 768px;
            min-width: 768px;
        }

        .open-modal-icon {
            font-size: 1.3em;
        }

        .content-wrapper {
            display: grid;
            grid-template-columns: min-content auto;
            grid-template-rows: auto;
            max-height: calc(100vh - 149px);
            overflow-y: auto;
            width: 100%;
        }

        .element-left {
            background-color: var(--dbp-primary-surface);
            color: var(--dbp-on-primary-surface);
            padding: 0 20px 12px 40px;
            text-align: right;
            white-space: nowrap;
        }

        .element-right {
            text-align: left;
            margin-left: 12px;
            padding: 0 0 12px 0;
        }

        .element-left.first,
        .element-right.first {
            padding-top: 12px;
        }

        .hideWithoutDisplay {
            opacity: 0;
            height: 0;
            overflow: hidden;
        }

        .scrollable-table-wrapper {
            width: 100%;
        }

        .tabulator-table {
            white-space: nowrap;
        }

        .tabulator-footer {
            text-align: center;
        }

        .back-navigation {
            padding-top: 1rem;
        }

        .table-wrapper {
            container-type: inline-size;
            container-name: table-wrapper;
        }

        .container.submissions-table {
            container: table-container / inline-size;
        }

        .table-wrapper h3 {
            margin-top: 0.5em;
            margin-bottom: 1em;
        }

        .back-navigation dbp-icon {
            font-size: 0.8em;
            padding-right: 7px;
            padding-bottom: 2px;
        }

        .back-navigation:hover {
            color: var(--dbp-hover-color, var(--dbp-content));
            background-color: var(--dbp-hover-background-color);
        }

        .back-navigation:hover::before {
            background-color: var(--dbp-hover-color, var(--dbp-content));
        }

        .dropdown-menu {
            color: var(--dbp-on-secondary-surface);
            border-color: var(--dbp-secondary-surface-border-color);
            cursor: pointer;
            box-sizing: content-box;
        }

        .table-title {
            border-left: 3px solid var(--dbp-primary);
            padding-left: 0.5em;
        }

        /* TABLE HEADER - action buttons and search bar */

        .table-action-header {
            display: grid;
            grid-template-areas: 'actions search search search button export';
            grid-template-columns: 200px 1fr 1fr 1fr 160px 160px;
            /*grid-template-columns: 1fr;*/
            gap: 0 1em;
            position: relative;
        }

        .table-action-header.open {
            grid-template-areas: 'actions search filter-col filter-op button export';
            grid-template-columns: 200px auto auto auto 160px 160px;
            gap: 0 1em;
            position: relative;
        }

        .table-action-header select {
            box-sizing: border-box;
            height: 32px;
            width: 100%;
            text-align: left;
            padding-left: 1em;
            padding-block: 0;
            color: var(--dbp-content);
            background-color: var(--dbp-background);
        }

        .table-action-header .export-container select {
            background-image: none;
        }

        .table-action-header .action-button {
            border: 0 none;
            height: 2.625em;
            background-color: transparent;
            width: 100%;
            text-align: left;
        }

        /* actions */

        .actions-container {
            grid-area: actions;
            position: relative;
            width: 175px;
        }

        .open-actions-button {
            width: 100%;
            position: relative;
            text-align: left;
        }

        .actions-container.open .actions-dropdown {
            opacity: 1;
        }
        .actions-container.open .icon-chevron {
            transform: rotate(180deg);
        }

        .icon-chevron {
            transition: transform 250ms ease-in;
            position: absolute;
            right: 0.5em;
            top: 0.5em;
        }

        .actions-dropdown {
            opacity: 0;
            position: absolute;
            top: 37px;
            left: 0;
            transition: opacity 250ms ease-in;
            z-index: 15;
            width: 250px;
            padding: 0.5em;
            background-color: var(--dbp-background);
            border: 1px solid var(--dbp-content);
        }

        .actions-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 0;
        }

        .action:hover {
            /* @TODO we need a lighter grey than muted */
            background-color: light-dark(#f7f7f7, #333333);
            /* background-color: #f7f7f7; */
            color: var(--dbp-on-muted-surface);
        }

        .action:hover dbp-icon {
            transform: scale(1.25);
        }

        .action dbp-icon {
            margin-right: 5px;
            transition: transform 150ms ease-in;
        }

        @starting-style {
            .actions-wrapper.open .actions-dropdown {
                opacity: 0;
            }
        }

        /* search bar */

        .search-input {
            grid-area: search;
            display: flex;
            flex-basis: 100%;
            position: relative;
        }

        .search-filter-columns {
            grid-area: filter-col;
        }

        .search-filter-operator {
            grid-area: filter-op;
        }

        .search-toggle-filters-button {
            grid-area: button;
        }

        .search-input .search-toggle-filters-button {
            display: none;
        }

        .searchbar,
        .search-button,
        .search-toggle-filters-button {
            height: 32px;
            box-sizing: border-box;
        }

        .search-toggle-filters-button {
            width: 160px;
            text-align: left;
        }

        .search-toggle-filters-button .button-text {
            padding-left: 4px;
        }

        .searchbar dbp-icon,
        .search-toggle-filters-button dbp-icon {
            transition: transform 250ms ease-in;
        }

        .search-button dbp-icon {
            transition: transform 100ms ease-in;
        }

        .search-toggle-filters-button dbp-icon {
            transform: rotate(90deg);
        }

        .open .search-toggle-filters-button dbp-icon {
            transform: rotate(-90deg);
            transform-origin: center;
        }

        .searchbar {
            flex-grow: 1;
            padding: 0 0.5em;
            border: 1px solid var(--dbp-content);
        }

        .search-filter-columns dbp-icon,
        .search-filter-operator dbp-icon {
            position: absolute;
            right: 9px;
            top: 9px;
            pointer-events: none;
        }

        .search-button {
            border: 0 none;
            position: absolute;
            right: 0;
            top: 0;
            background-color: transparent;
        }

        .search-button:hover dbp-icon {
            transform: scale(1.25);
        }

        .search-filter-columns,
        .search-filter-operator {
            display: none;
        }

        .search-filter-operator.open,
        .search-filter-columns.open {
            display: inline-block;
        }

        .table-action-header label {
            clip: rect(0 0 0 0);
            clip-path: inset(50%);
            height: 1px;
            overflow: hidden;
            position: absolute;
            white-space: nowrap;
            width: 1px;
        }

        .table-action-header > :focus-visible {
            background-color: light-dark(#f7f7f7, #333333);
        }

        .statusbar {
            display: flex;
            justify-content: space-between;
            padding-top: 0.5em;
        }

        .selection-info {
            padding-top: 5px;
        }

        .reset-search {
            cursor: pointer;
            background: none;
            border: 0 none;
            padding: 5px;
            transform: translateX(5px);
        }

        .reset-search:disabled {
            cursor: not-allowed;
        }

        .reset-search dbp-icon {
            transition: transform 250ms ease-in;
        }

        .reset-search:hover:not(:disabled) dbp-icon {
            transform: rotate(360deg);
        }

        @container table-container (width < 1040px) {
            .table-action-header:not(.open) {
                grid-template-areas:
                    'actions . . export export'
                    'search search search search button'
                    'filter-col filter-col . filter-op filter-op';
                grid-template-columns: 115px 1fr 1fr 118px 160px;
                gap: 1em 0;
            }

            .table-action-header.open {
                grid-template-areas:
                    'actions . . export export'
                    'search search search search button'
                    'filter-col filter-col filter-op filter-op filter-op';
                grid-template-columns: 115px 1fr 1fr 118px 160px;
                gap: 1em 0;
            }

            .search-input {
                grid-area: search;
            }

            .searchbar {
                border-right: 0 none;
            }

            .search-toggle-filters-button dbp-icon {
                transform: rotate(0);
            }

            .open .search-toggle-filters-button dbp-icon {
                transform: rotate(180deg);
                transform-origin: center;
            }

            .search-toggle-filters-button {
                grid-area: button;
            }

            .search-filter-columns {
                grid-area: filter-col;
            }

            .search-filter-operator {
                grid-area: filter-op;
                margin-left: 1em;
            }

            .statusbar {
                padding-top: 0;
            }

            .open .statusbar {
                transform: translateY(35px);
            }

            .export-container .dropdown-menu {
                position: relative;
                z-index: 10;
            }
        }

        @container table-container (width < 530px) {
            .table-action-header:not(.open) {
                grid-template-areas:
                    'actions actions . export export'
                    'search search search search button'
                    'filter-col filter-col . filter-op filter-op';
                grid-template-columns: 115px 1fr 1fr 68px 42px;
                gap: 1em 0;
            }

            .table-action-header.open {
                grid-template-areas:
                    'actions actions . export export'
                    'search search search search button'
                    'filter-col filter-col filter-op filter-op filter-op';
                grid-template-columns: 115px 1fr 1fr 68px 42px;
                gap: 1em 0;
            }

            .search-toggle-filters-button {
                width: 42px;
                text-align: center;
            }

            .search-toggle-filters-button .button-text {
                padding-left: 0;
                position: absolute !important;
                clip: rect(1px, 1px, 1px, 1px);
                overflow: hidden;
                height: 1px;
                width: 1px;
                word-wrap: normal;
            }

            .actions-container {
                width: 100px;
            }
        }

        .create-submission-button {
            background-color: var(--dbp-primary-surface);
            border-color: var(--dbp-primary-surface-border-color);
            color: var(--dbp-on-primary-surface);
            height: 2em;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            padding: 0 1em;
            margin-bottom: 3em;
        }

        /* export button */

        .export-container {
            grid-area: export;
            position: relative;
        }

        .export-container .dropdown-menu {
            padding: 0rem 2rem 0rem 0.5rem;
            background-image: none !important;
        }

        .export-container dbp-icon[name='chevron-down'] {
            transition: transform 250ms ease-in;
        }

        .export-container select:open + dbp-icon[name='chevron-down'] {
            transform: rotate(180deg);
        }

        .export-select-icon {
            position: absolute;
            right: 0.5em;
            top: 0.5em;
            z-index: 11;
            pointer-events: none;
        }

        /* TABLE BUTTON HEADER END */

        .modal-container {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: center;
        }

        .submission-modal-content {
            overflow: auto;
            align-items: baseline;
            height: 100%;
        }

        .modal-footer-btn {
            padding-right: 20px;
            padding-left: 20px;
            padding-bottom: 20px;
            padding-top: 10px;
        }

        .modal--confirmation {
            --dbp-modal-max-width: 360px;
            --dbp-modal-min-height: auto;
        }

        .footer-menu {
            padding: 0;
            justify-content: flex-end;
            display: flex;
            gap: 1em;
            margin-block: 2em 0;
        }

        span.first {
            margin-left: -6px;
        }

        select[disabled] {
            opacity: 0.4;
            cursor: not-allowed;
        }

        .scrollable-table-wrapper {
            position: relative;
        }

        .frozen-table-divider {
            position: absolute;
            height: calc(
                100% - 118px
            ); /* table-header + pagination heights + scrollbar: 60px + 51px */
            top: 60px; /* table-header height */
            right: 36px;

            -webkit-box-shadow: -4px 3px 16px -6px var(--dbp-muted);
            box-shadow: -2px 0 2px 0 var(--dbp-muted);
            background-color: #fff0; /* transparent */
        }

        .modal-close {
            font-size: 1.5em;
        }

        .headers {
            max-width: 100%;
            margin: 0;
            list-style-type: none;
            padding: 0;
            display: grid;
            width: 100%;
        }

        .header-field {
            align-items: center;
            height: 50px;
            border: 1px solid var(--dbp-muted);
            display: flex;
            margin-bottom: 5px;
            color: var(--dbp-content);
        }

        .header-button.hidden {
            display: none !important;
        }

        .header-title {
            font-weight: 400;
            flex-grow: 2;
            text-overflow: ellipsis;
            overflow: hidden;
            padding-left: 5px;
            text-align: left;
        }

        .header-order {
            justify-content: center;
            display: flex;
            align-items: center;
            height: 50px;
            width: 50px;
            min-width: 50px;
            flex-grow: 0;
            background-color: var(--dbp-muted-surface);
            color: var(--dbp-on-muted-surface);
            font-weight: bold;
        }

        .move-up .header-field {
            animation: added 0.4s ease;
        }

        .header-move {
            display: flex;
        }

        .header-fields:first-child .arrow-up,
        .header-fields:last-child .arrow-down {
            opacity: 0.4;
            cursor: default;
            pointer-events: none;
        }

        .first-arrow-up,
        .last-arrow-down {
            opacity: 0.4;
            cursor: default;
            pointer-events: none;
        }

        @keyframes added {
            0% {
                background-color: var(--dbp-background);
                color: var(--dbp-content);
            }
            50% {
                background-color: var(--dbp-success-surface);
                color: var(--dbp-on-success-surface);
            }
            100% {
                background-color: var(--dbp-background);
                color: var(--dbp-content);
            }
        }

        .button-wrapper {
            display: flex;
            height: 100%;
            justify-content: end;
            align-items: center;
            padding-right: 2px;
        }

        .open-menu {
            height: 45px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
        }

        .additional-menu {
            display: none;
        }

        #filter-modal-box {
            min-width: 300px;
            min-height: unset;
        }

        .modal-footer-btn {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .modal-footer-btn .top-button-row {
            display: grid;
            padding-top: 10px;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 10px;
        }

        .modal-footer-btn .bottom-button-row {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
        }

        .button-container {
            text-align: left;
            margin-bottom: 10px;
            padding-left: 30px;
        }

        .checkmark {
            left: 0;
            height: 20px;
            width: 20px;
        }

        .button-container .checkmark::after {
            left: 8px;
            top: 2px;
        }

        .button.courses-btn {
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            top: 0;
        }

        @media only screen and (orientation: portrait) and (max-width: 768px) {
            .mobile-hidden {
                display: none;
            }

            button[data-page='prev'],
            button[data-page='next'],
            button[data-page='first'],
            button[data-page='last'] {
                display: block;
                white-space: nowrap !important;
                overflow: hidden;
                line-height: 0;
            }

            button[data-page='prev']:after,
            button[data-page='next']:after,
            button[data-page='first']:after,
            button[data-page='last']:after {
                content: '\\00a0\\00a0\\00a0\\00a0';
                background-color: var(--dbp-content);
                -webkit-mask-repeat: no-repeat;
                mask-repeat: no-repeat;
                -webkit-mask-position: center center;
                mask-position: center center;
                padding: 0 0 0.25% 0;
                -webkit-mask-size: 1.5rem !important;
                mask-size: 1.4rem !important;
            }

            button[data-page='prev']:after {
                -webkit-mask-image: url('${unsafeCSS(getIconSVGURL('chevron-left'))}');
                mask-image: url('${unsafeCSS(getIconSVGURL('chevron-left'))}');
            }

            button[data-page='next']:after {
                -webkit-mask-image: url('${unsafeCSS(getIconSVGURL('chevron-right'))}');
                mask-image: url('${unsafeCSS(getIconSVGURL('chevron-right'))}');
            }

            button[data-page='first']:after {
                content: '\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0';
                -webkit-mask-image: url('${unsafeCSS(getIconSVGURL('angle-double-left'))}');
                mask-image: url('${unsafeCSS(getIconSVGURL('angle-double-left'))}');
            }

            button[data-page='last']:after {
                content: '\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0\\00a0';
                -webkit-mask-image: url('${unsafeCSS(getIconSVGURL('angle-double-right'))}');
                mask-image: url('${unsafeCSS(getIconSVGURL('angle-double-right'))}');
            }

            .element-right {
                margin-left: 12px;
                padding: 0 0 12px 0;
            }

            .element-right.first {
                padding-top: 0;
            }

            .element-left {
                text-align: left;
                padding: 10px 5px 10px 5px;
                background-color: inherit;
                color: inherit;
                font-weight: 400;
                border-top: 1px solid var(--dbp-muted);
            }

            .element-left.first {
                margin-top: 10px;
                border-top: 0;
            }

            .btn-row-left {
                display: flex;
                justify-content: space-between;
                flex-direction: row;
                gap: 4px;
                height: 40px;
            }

            .detailed-submission-modal-box {
                min-width: 320px;
            }

            .detailed-submission-modal-box .modal-footer .modal-footer-btn {
                padding: 6px 12px 6px 12px;
                flex-direction: column;
                gap: 10px;
            }

            .detailed-submission-modal-box .modal-content {
                align-items: flex-start;
            }

            .export-buttons {
                gap: 0;
            }

            .select-all-icon {
                height: 32px;
            }

            .additional-menu {
                display: block;
                white-space: nowrap;
                height: 33px;
                position: relative;
            }

            .additional-menu button {
                float: right;
            }

            .options-nav {
                display: flex;
                flex-direction: row;
                justify-content: space-between;
            }

            .back-navigation {
                padding-top: 0;
            }

            /*.table-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }*/

            .table-wrapper h3,
            .table-action-header {
                margin-bottom: 0.5em;
            }

            .courses-btn {
                min-height: 40px;
                padding-top: 8px;
                min-width: 40px;
            }

            .search-wrapper {
                min-width: unset;
            }

            .headers {
                display: initial;
                width: 100%;
            }

            #filter-modal-box,
            .detailed-submission-modal-box {
                width: 100%;
                height: 100%;
                max-width: 100%;
            }

            .submission-modal-content,
            .detailed-submission-modal-content {
                height: 100%;
            }

            .content-wrapper {
                grid-template-columns: auto;
            }

            .modal-title {
                padding-left: 15px;
            }

            .button-container .checkmark::after {
                left: 8px;
                top: 2px;
                width: 5px;
                height: 11px;
            }

            .button-container .checkmark {
                top: 0;
            }

            .button-container {
                padding-left: 30px;
            }

            .modal-footer-btn > :first-child {
                grid-template-columns: repeat(2, 1fr);
            }
            .item-1 {
                order: 3;
                grid-column: 1 / -1;
            }
            .item-2 {
                order: 2;
            }
            .item-3 {
                order: 1;
            }
        }
    `;
}

export function getFormHeaderCSS() {
    // language=css
    return css`
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

        .submission-info {
            display: flex;
            justify-content: flex-start;
            flex-direction: column;
            gap: 0;
        }

        .submission-info .label {
            margin: 0 0 0.5em 0;
            display: inline-block;
        }

        .action-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 0.5em;
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

        @container permissions (width < 380px) {
            .permissions-header {
                flex-direction: column-reverse;
            }
        }

        .form-header {
            display: flex;
            justify-content: space-between;
            flex-direction: column;
            gap: 1em;
            position: sticky;
            z-index: 9;
            right: 0;
            left: 0;
            background: var(--dbp-background);
            padding: 1em;
            border: 1px solid var(--dbp-content);
            min-width: 250px;
            min-height: 130px;
        }

        .form-header.is-pinned {
            transform: translateY(calc(-100% + 64px));
            top: 0;
            box-shadow: 0px 4px 8px 2px rgba(0, 0, 0, 0.2);
        }

        .form-header .button-label {
            padding-left: 0.5em;
        }

        .form-header.is-pinned .buttons-wrapper {
            align-items: center;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
        }

        .tag-management {
            min-width: 200px;
            /*max-width: 500px;*/
            width: 50%;
            display: flex;
            justify-content: flex-end;
        }

        .tag-management dbp-form-enum-element {
            max-width: 100%;
            display: block;
            flex-grow: 1;
        }

        .buttons-wrapper,
        .dates-wrapper {
            display: flex;
            gap: 1em;
            flex-wrap: wrap;
        }

        .buttons-wrapper {
            align-items: flex-end;
            justify-content: space-between;
        }

        .tag-container {
            display: flex;
            gap: 0.3em;
        }

        .status-tags-wrapper {
            display: flex;
            gap: 1em;
            align-items: center;
        }

        .form-validity-indicator {
            display: flex;
            align-items: center;
            gap: 0.25em;
            --dbp-tooltip-box-font-weight: bold;
            --dbp-tooltip-button-background-color: transparent;
            --dbp-tooltip-button-border: 0 none;
        }

        .form-validity-indicator.valid {
            --dbp-tooltip-arrow-color: var(--dbp-success-surface);
            --dbp-tooltip-box-bg-color: var(--dbp-success-surface);
            --dbp-tooltip-box-font-color: var(--dbp-background);
        }

        .form-validity-indicator.invalid {
            --dbp-tooltip-arrow-color: var(--dbp-danger-surface);
            --dbp-tooltip-box-bg-color: var(--dbp-danger-surface);
            --dbp-tooltip-box-font-color: var(--dbp-background);
        }

        .form-validity-indicator dbp-icon {
            font-size: 16px;
            top: inherit;
        }

        .form-validity-indicator.valid dbp-icon {
            color: var(--dbp-success);
        }

        .form-validity-indicator.invalid dbp-icon {
            color: var(--dbp-warning);
        }

        .validity-indicator {
            display: inline-block;
            height: 1em;
            width: 1em;
            border-radius: 50%;
        }

        .validity-indicator.valid {
            background-color: var(--dbp-success-surface);
        }

        .validity-indicator.invalid {
            background-color: var(--dbp-danger-surface);
        }

        .form-delete-submission-button {
            --dbp-secondary-surface-border-color: var(--dbp-danger);
            --dbp-hover-background-color: var(--dbp-danger);
            color: var(--dbp-danger);
        }

        .form-delete-submission-button .button-label,
        .form-delete-submission-button dbp-icon {
            color: var(--dbp-danger);
        }

        .form-delete-submission-button:hover .button-label,
        .form-delete-submission-button:hover dbp-icon {
            color: black;
        }

        .edit-permissions .button-text {
            padding-left: 5px;
        }

        @container form (width < 750px) {
            /* Make icon buttons for small screens ? */
            .form-header :is(button, dbp-button) .button-label {
                display: none;
            }

            .submission-details {
                flex-direction: column;
            }
        }

        @container form (width < 640px) {
            .header-top {
                flex-direction: column;
                gap: 1em;
            }
            .tag-management {
                max-width: 100%;
                width: 100%;
                justify-content: flex-start;
            }
        }

        @container form (width < 420px) {
            .submission-details .user-entry {
                flex-direction: column;
                align-items: flex-start;
            }

            .submission-details .person-permissions {
                width: 100%;
                justify-content: flex-end;
            }
        }
    `;
}

export function getGeneralFormCSS() {
    // language=css
    return css`
        .formalize-form {
            position: relative;
            min-width: 270px;

            container-type: inline-size;
            container-name: form;
        }
    `;
}

export function getEthicsCommissionFormCSS() {
    // language=css
    return css`
        .notification {
            margin-bottom: 2em;
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

        .admin-fields {
            background: light-dark(#f1f1f1, #2a2a2a);
            padding: 1em 2em;
        }

        .info-box {
            /*background-color: #c9e4c6;*/
            background-color: var(--dbp-success-surface);
            color: var(--dbp-on-success-surface);
            padding: 1.5em;
        }

        .info-box p:last-child,
        .info-box p:first-child {
            margin-top: 0;
        }

        .field-note {
            font-size: 0.8em;
            font-style: italic;
            margin: -0.5em 0 2em;
            line-height: var(--dbp-form-line-height);
        }

        /* boolean field view */
        .dbp-form-boolean-view fieldset {
            border: 0 none;
            padding: 0;
            margin: 15px 0;
        }

        .dbp-form-boolean-view label {
            font-weight: bold;
            display: block;
        }

        .red-marked-asterisk {
            font-weight: bold;
            color: var(--dbp-danger);
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

        .lettered-list a {
            text-decoration: underline;
            text-underline-offset: 2px;
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

        @media only screen and (max-width: 683px) {
            .edit-mode .form-header.is-pinned:has(.tag-management > dbp-form-enum-element) {
                transform: translateY(calc(-100% + 63px));
            }
        }

        @media only screen and (max-width: 450px) {
            .lettered-list {
                padding-left: 1em;

                ol {
                    padding-left: 1em;
                }
            }
        }

        @media only screen and (max-width: 350px) {
            .edit-mode .header-top {
                gap: 0;
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

        .modal--confirmation {
            --dbp-modal-width: 320px;
            --dbp-modal-max-width: 360px;
            --dbp-modal-min-height: auto;
        }

        .modal--confirmation .footer-menu {
            padding: 0;
            justify-content: flex-end;
            display: flex;
            gap: 1em;
            margin-block: 2em 0;
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
        :is(.button, dbp-button):not([disabled]) dbp-icon {
            transition: transform 0.1s ease-in;
        }

        :is(.button, dbp-button):not([disabled]):hover dbp-icon {
            transform: scale(1.25);
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

            /* Line height debug background
            background-image: linear-gradient(
                to bottom,
                rgba(0, 120, 255, 0.1) 0,
                rgba(0, 120, 255, 0.1) 1px,
                transparent 1px,
                transparent var(--dbp-form-line-height)
            );
            background-size: 100% var(--dbp-form-line-height);
            background-position: 0 0;*/
        }

        /* PAGE BREAKS */
        .print :is(.form-sub-title, .section-title) {
            page-break-before: always;
            break-before: page;
        }

        .print fieldset {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        /* Title styles */
        .print
            :is(
                .form-title,
                .form-sub-title,
                .section-title,
                .section-sub-title,
                .question-group-title
            ) {
            line-height: var(--dbp-form-line-height) !important;
            font-size: var(--dbp-form-line-height);
            margin: 0;
            padding: 0 0 var(--dbp-form-line-height) 0;
            text-align: center;
        }

        .print .section-title--top-margin {
            padding-top: 50px;
            padding-bottom: 50px;
        }

        .print .section-sub-title {
            font-size: 20px; /* custom size. Need to be less than line-height */
            padding: 0 0 var(--dbp-form-line-height) 0;
            margin: 0;
            text-align: center;
        }

        .print .question-group-title {
            font-size: 18px; /* custom size. Need to be less than line-height */
        }

        /* Hidden elements in print */
        .print
            :is(
                .form-details,
                .form-header .buttons-wrapper,
                button,
                dbp-button,
                #file-sink,
                dbp-file-sink,
                .submission-permissions,
                .scroller-container,
                .tag-management
            ) {
            display: none !important;
            height: 0;
            overflow: hidden;
        }

        .print .form-header {
            padding: 0;
            min-height: initial;
            border: 0 none;
        }

        .print .submission-info .label {
            margin: 0;
        }

        .print .submission-info-wrapper {
            margin-bottom: var(--dbp-form-line-height);
        }

        .print .info-box {
            /*padding: calc(var(--dbp-form-line-height) / 2) var(--dbp-form-line-height);*/
            padding: 0;
            background-color: initial;
        }

        .print .field-note {
            margin-top: calc(-1 * var(--dbp-form-line-height));
            font-style: italic;
            font-size: smaller;
        }

        .print p {
            position: relative;
        }

        .print p sup {
            vertical-align: baseline;
            padding-left: 3px;
            /* Required to not change the line-height of paragraphs */
            position: absolute;
            bottom: 5px;
            display: inline-block;
        }

        .print fieldset {
            border: none;
            margin: 0;
            padding: 0 0 var(--dbp-form-line-height) 0;
        }

        .print :is(p, ul, ol) {
            margin: var(--dbp-form-line-height) 0;
        }

        .print ul li {
            height: var(--dbp-form-line-height);
        }

        .print fieldset label {
            font-weight: bold;
            display: block;
        }
    `;
}

export function getFileUploadWidgetCSS() {
    // language=css
    return css`
        .file-upload-container {
            /*margin-bottom: 3em;*/
            border: var(--dbp-border);
            padding: 1em 1em 1.5em 1em;
            display: flex;
            flex-direction: column;
            gap: 1em;
        }

        .file-upload-title-container {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 1em;
        }

        .attachments-title {
            margin: 0;
            font-size: 24px;
            display: inline;
            white-space: nowrap;
        }

        .file-upload-limit-warning {
            color: var(--dbp-muted);
            font-size: 0.9em;
            white-space: nowrap;
        }

        .uploaded-files {
            display: flex;
            flex-direction: column;
        }

        .fileblock-container {
            border: var(--dbp-border);
            margin-bottom: 1em;
        }

        .fileblock-container.submitted-files {
            margin-bottom: 0.75em; /*12px*/
        }

        .upload-button {
            width: fit-content;
        }

        .upload-button dbp-icon {
            margin-right: 0.25em;
        }

        .attachment-header {
            display: flex;
            justify-content: flex-start;
            align-items: center;
            gap: 1em;
            padding-left: 1em;
        }

        .attachment-warning {
            color: var(--dbp-warning);
            font-weight: normal;
            font-size: 0.8em;
            padding-left: 0.5em;
        }

        .attachment-header dbp-icon {
            font-size: 1.25em;
        }

        .attachment-header h5 {
            /* align with the dbp-icon*/
            margin: 1em 0;
        }

        .file-block {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid #dadada;
            padding: calc(0.75em - 1px); /* compensation for the border */
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

        @container form (width < 840px) {
            .additional-data {
                display: none;
            }

            .file-info {
                max-width: 42%;
            }
        }

        @container form (width < 690px) {
            .file-block {
                align-items: flex-start;
                flex-direction: column;
                gap: 1em;
            }

            .file-info {
                max-width: initial;
            }

            .file-action-buttons {
                width: 100%;
                justify-content: flex-end;
            }
        }

        @container form (width < 430px) {
            .file-block:not(:last-child) {
                margin-bottom: 1em;
            }
            .file-action-buttons {
                flex-direction: column;
                align-items: initial;
                gap: 0.5em;
            }
        }
    `;
}

export function getMediaTransparencyFormCSS() {
    // language=css
    return css`
        .media-transparency-form {
            --dbp-form-font-size: 16px;
            --dbp-form-line-height: 24px;
        }

        .field-note {
            font-size: 0.8em;
            font-style: italic;
            margin: -0.5em 0 2em;
            line-height: var(--dbp-form-line-height);
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

        .modal--confirmation {
            --dbp-modal-width: 320px;
            --dbp-modal-max-width: 360px;
            --dbp-modal-min-height: auto;
        }

        .modal--confirmation .footer-menu {
            padding: 0;
            justify-content: flex-end;
            display: flex;
            gap: 1em;
            margin-block: 2em 0;
        }
    `;
}
