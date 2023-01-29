<template>
    <div>
        <div class="row">
            <div class="col-12">
                <card class="xss-card-container">
                    <div class="row pl-4 pr-4 p-2" style="display: block;">
                        <div>
                            <h1><i class="fas fa-fire"></i> XSS Payload Fire Reports ({{format_with_commas(report_count)}} total)</h1>
                            <hr />
                            <div v-if="report_count === 0" style="color: white;">No reports!</div>
                            <div v-else v-for="report in payload_fire_reports">
                                <card class="mb-0">
                                    <div class="screenshot-image-container mb-2">
                                        <a v-bind:href="base_api_path + '/screenshots/' + report.screenshot_id + '.png'" target="_blank">
                                            <img slot="image" class="card-img-top report-image" v-bind:src="base_api_path + '/screenshots/' + report.screenshot_id + '.png'" alt="XSS Screenshot" />
                                        </a>
                                    </div>
                                    <h4 v-if="report.origin.startsWith('http')" class="card-title">
                                        <code>{{report.url}}</code>
                                    </h4>
                                    <h4 v-else class="card-title">
                                        <code>{{report.url}}</code>
                                    </h4>
                                    <p class="card-text text-right">
                                        <i>Fired {{report.createdAt | moment("from", "now") }}</i>
                                    </p>
                                    <div class="mt-3 button-full">
                                        <base-button class="m-0 btn-fill" simple type="primary" v-on:click="expand_report(report.id)" v-if="!is_report_id_expanded(report.id)">
                                            <i class="fas fa-angle-double-down"></i> Expand Report
                                        </base-button>
                                        <base-button class="m-0 btn-fill" simple type="primary" v-on:click="collapse_report(report.id)" v-if="is_report_id_expanded(report.id)">
                                            <i class="fas fa-angle-double-up"></i> Collapse Report
                                        </base-button>
                                        <base-button class="m-0 w-25 delete-button" simple type="danger" v-on:click="delete_payload_fire(report.id)">
                                            <i class="fas fa-trash-alt"></i>
                                        </base-button>
                                    </div>
                                </card>
                                <!-- Expanded report -->
                                <card v-if="is_report_id_expanded(report.id)">
                                    <div>
                                        <div>
                                            <p class="report-section-label mr-2">URL</p>
                                            <small slot="helperText" class="form-text text-muted report-section-description">
                                                The URL of the page the payload fired on.
                                            </small>
                                        </div>
                                        <div class="m-2 mt-4">
                                            <pre v-if="report.url">{{report.url}}</pre>
                                            <pre v-else><i>None</i></pre>
                                        </div>
                                        <hr />
                                    </div>
                                    <div>
                                        <div>
                                            <p class="report-section-label mr-2">IP Address</p>
                                            <small slot="helperText" class="form-text text-muted report-section-description">
                                                Remote IP address of the victim.
                                            </small>
                                        </div>
                                        <div class="m-2 mt-4">
                                            <pre v-if="report.ip_address">{{report.ip_address}}</pre>
                                            <pre v-else><i>None</i></pre>
                                        </div>
                                        <hr />
                                    </div>
                                    <div>
                                        <div>
                                            <p class="report-section-label mr-2">Referer</p>
                                            <small slot="helperText" class="form-text text-muted report-section-description">
                                                Referring page for the vulnerable page.
                                            </small>
                                        </div>
                                        <div class="m-2 mt-4">
                                            <pre v-if="report.referer">{{report.referer}}</pre>
                                            <pre v-else><i>None</i></pre>
                                        </div>
                                        <hr />
                                    </div>
                                    <div>
                                        <div>
                                            <p class="report-section-label mr-2">User-Agent</p>
                                            <small slot="helperText" class="form-text text-muted report-section-description">
                                                Web browser of the victim.
                                            </small>
                                        </div>
                                        <div class="m-2 mt-4">
                                            <pre v-if="report.user_agent">{{report.user_agent}}</pre>
                                            <pre v-else><i>None</i></pre>
                                        </div>
                                        <hr />
                                    </div>
                                    <div>
                                        <div>
                                            <p class="report-section-label mr-2">Cookies</p>
                                            <small slot="helperText" class="form-text text-muted report-section-description">
                                                Non-HTTPOnly cookies of the victim.
                                            </small>
                                        </div>
                                        <div class="m-2 mt-4">
                                            <pre v-if="report.cookies">{{report.cookies}}</pre>
                                            <pre v-else><i>None</i></pre>
                                        </div>
                                        <hr />
                                    </div>
                                    <div>
                                        <div>
                                            <p class="report-section-label mr-2">Title</p>
                                            <small slot="helperText" class="form-text text-muted report-section-description">
                                                Vulnerable page's title.
                                            </small>
                                        </div>
                                        <div class="m-2 mt-4">
                                            <pre v-if="report.title">{{report.title}}</pre>
                                            <pre v-else><i>None</i></pre>
                                        </div>
                                        <hr />
                                    </div>
                                    <div>
                                        <div>
                                            <p class="report-section-label mr-2">Origin</p>
                                            <small slot="helperText" class="form-text text-muted report-section-description">
                                                HTTP origin of the vulnerable page.
                                            </small>
                                        </div>
                                        <div class="m-2 mt-4">
                                            <pre v-if="report.origin">{{report.origin}}</pre>
                                            <pre v-else><code>None</code></pre>
                                        </div>
                                        <hr />
                                    </div>
                                    <div>
                                        <div>
                                            <p class="report-section-label mr-2">Secrets</p>
                                            <small slot="helperText" class="form-text text-muted report-section-description">
                                                TruffleHog-lite, used to capture any secrets harvested from the HTML and Javascript.
                                            </small>
                                        </div>
                                        <div class="m-2 mt-4" v-if="report.secrets">
                                            <pre v-for="secret in report.secrets">Secret type: {{ secret.secret_type }}
Secret value: {{ secret.secret_value }}</pre>
                                        </div>
                                        <div>
                                            <pre v-else>No secrets detected</pre>
                                        </div>
                                        <hr />
                                    </div>
                                    <div>
                                        <div>
                                            <p class="report-section-label mr-2">CORS</p>
                                            <small slot="helperText" class="form-text text-muted report-section-description">
                                                What is the CORS policy for the website the XSS rendered on?
                                            </small>
                                        </div>
                                        <div class="m-2 mt-4">
                                            <pre v-if="report.CORS">Access-Control-Allow-Origin: {{report.CORS}}</pre>
                                            <pre v-else><i>No CORS headers detected</i></pre>
                                        </div>
                                        <hr />
                                    </div>
                                    <div>
                                        <div>
                                            <p class="report-section-label mr-2">Leaked Source Code</p>
                                            <small slot="helperText" class="form-text text-muted report-section-description">
                                                Was the source code exposed via /.git ? (Shows contents of /.git/config)
                                            </small>
                                        </div>
                                        <div class="m-2 mt-4">
                                            <pre v-if="report.gitExposed">{{report.gitExposed}}</pre>
                                            <pre v-else><i>No .git directory detected</i></pre>
                                        </div>
                                        <hr />
                                    </div>
                                    <div>
                                        <div>
                                            <p class="report-section-label mr-2">Browser Time</p>
                                            <small slot="helperText" class="form-text text-muted report-section-description">
                                                Reported time according to the victim's browser.
                                            </small>
                                        </div>
                                        <div class="m-2 mt-4">
                                            <pre v-if="report.browser_timestamp">{{ new Date(parseInt(report.browser_timestamp)) | moment("dddd, MMMM Do YYYY, h:mm:ss a")}} (<i>{{report.browser_timestamp}}</i>)</pre>
                                            <pre v-else><i>None</i></pre>
                                        </div>
                                        <hr />
                                    </div>
                                    <div>
                                        <div>
                                            <p class="report-section-label mr-2">Other</p>
                                            <small slot="helperText" class="form-text text-muted report-section-description">
                                                Other miscellaneous information.
                                            </small>
                                        </div>
                                        <div class="m-2 mt-4">
                                            <pre>Fired in iFrame?: {{report.was_iframe}}
Vulnerability enumerated {{ report.createdAt | moment("dddd, MMMM Do YYYY, h:mm:ss a") }}
Report ID: {{report.id}}</pre>
                                        <hr />
                                    </div>
                                    <base-button simple block type="primary" class="mt-4" v-on:click="collapse_report(report.id)" v-if="is_report_id_expanded(report.id)">
                                        <i class="fas fa-angle-double-up"></i> Collapse Report
                                    </base-button>
                                </card>
                                <hr />
                            </div>
                            <!-- Pagination -->
                            <div v-if="report_count !== 0" class="text-center pagination-div">
                                <base-pagination v-bind:page-count="total_pages" v-model="page"></base-pagination>
                            </div>
                        </div>
                    </div>
                </card>
            </div>
        </div>
        <div class="loading-bar" v-if="loading">
            <div class="progress">
                <div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" class="progress-bar bg-purp progress-bar-striped progress-bar-animated" style="width: 100%;"></div>
            </div>
        </div>
    </div>
</template>
<script>
import BasePagination from '@/components/BasePagination';
import config from '@/config';
import Vue from "vue";
import api_request from '@/libs/api.js';
import router from "@/router/index";
import utils from '@/libs/utils';
const copy = utils.copy;

export default {
    data() {
        return {
            loading: false,
            base_api_path: '',
            page: 1,
            // Number of reports to return at once from
            // the backend.
            limit: 5,
            // ID(s) of payload fire reports to be shown
            // as expanded in the UI
            expanded_report_ids: [],
            // Array of the payload fire report data
            // returned from the backend
            payload_fire_reports: [],
            // Total report count from backend
            report_count: 0,
        }
    },
    watch: {
        page: function(old_val, new_val) {
            this.pull_payload_fire_reports();

            if (old_val !== new_val) {
                window.scroll({
                    top: 0,
                    left: 0,
                    behavior: 'smooth'
                });
            }
        },
    },
    methods: {
        async delete_payload_fire(payload_id) {
            const result = await api_request.delete_payload_fires([payload_id]);
            this.pull_payload_fire_reports();
        },
        async pull_payload_fire_reports() {
            const reports = await api_request.get_payload_fires(
                this.page,
                this.limit
            );
            this.payload_fire_reports = reports.result.payload_fires;
            this.report_count = reports.result.total;
        },
        expand_report(report_id) {
            this.expanded_report_ids.push(report_id);
        },
        collapse_report(report_id) {
            this.expanded_report_ids = this.expanded_report_ids.filter(expanded_report_id => {
                return expanded_report_id != report_id;
            });
        },
        is_report_id_expanded(report_id) {
            return this.expanded_report_ids.includes(report_id);
        },
        view_html_in_new_tab(input_html) {
            const new_window = window.open('about:blank', '_blank');
            new_window.document.body.innerText = input_html;
        },
        download_html(input_html) {
            const link = document.createElement('a');
            link.href = `data:text/html,${input_html}`;
            link.download = 'xss-page-contents.html';
            link.click();
        },
        format_with_commas(input_number) {
            return input_number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
    },
    computed: {
        total_pages() {
            return Math.ceil(this.report_count / this.limit);
        },
    },
    components: {
        BasePagination
    },
    async mounted() {
        // For debugging
        window.app = this;

        // For rendering
        this.base_api_path = api_request.BASE_API_PATH;

        // Pull XSS payload fires
        await this.pull_payload_fire_reports();
    },
    beforeDestroy() {}
};
</script>
<style>
.button-full {
    display: flex;
}

.button-full.all > button {
    width: 100%;
    margin: 0 2px;
}
.btn-fill {
    width: 100%;
    margin: 0 5px;
}

.delete-button {
    max-width: 100px !important;
    width: 20%;
}

.expand-button {
    width: 80%;
}

.pagination-div {
    width: 100%;
    display: flex;
    justify-content: center;
}

.pagination .page-item .page-link {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    border: 0;
    border-radius: 30px !important;
    -webkit-transition: all .3s;
    transition: all .3s;
    margin: 0 3px;
    min-width: 30px;
    text-align: center;
    height: 30px;
    line-height: 30px;
    cursor: pointer;
    text-transform: uppercase;
    outline: none
}

.pagination .page-item .page-link:focus,
.pagination .page-item .page-link:hover {
    background-color: hsla(0, 0%, 100%, .1);
    color: #fff;
    border: none;
    -webkit-box-shadow: none;
    box-shadow: none
}

.pagination .arrow-margin-left,
.pagination .arrow-margin-right {
    position: absolute
}

.pagination .arrow-margin-right {
    right: 0
}

.pagination .arrow-margin-left {
    left: 0
}

.pagination .page-item.active>.page-link {
    color: #fff;
    -webkit-box-shadow: 0 1px 20px 0 rgba(0, 0, 0, .1);
    box-shadow: 0 1px 20px 0 rgba(0, 0, 0, .1)
}

.pagination .page-item.active>.page-link,
.pagination .page-item.active>.page-link:focus,
.pagination .page-item.active>.page-link:hover {
    background: #5BB381;
    background-image: -webkit-gradient(linear, right top, left bottom, from(#5BB381), color-stop(#AE8C57), to(#38645A));
    background-image: linear-gradient(to bottom left, #5BB381, #AE8C57, #38645A);
    background-size: 210% 210%;
    background-position: 100% 0;
    color: #fff
}

pre {
    background-color: rgba(255, 255, 255, 0.8);
    color: #38645a;
}

.pagination .page-item.disabled>.page-link {
    opacity: .5
}

.pagination.pagination-info .page-item.active>.page-link,
.pagination.pagination-info .page-item.active>.page-link:focus,
.pagination.pagination-info .page-item.active>.page-link:hover {
    background: #1d8cf8;
    background-image: -webkit-gradient(linear, right top, left bottom, from(#1d8cf8), color-stop(#3358f4), to(#1d8cf8));
    background-image: linear-gradient(to bottom left, #1d8cf8, #3358f4, #1d8cf8);
    background-size: 210% 210%;
    background-position: 100% 0
}

.pagination.pagination-success .page-item.active>.page-link,
.pagination.pagination-success .page-item.active>.page-link:focus,
.pagination.pagination-success .page-item.active>.page-link:hover {
    background: #00f2c3;
    background-image: -webkit-gradient(linear, right top, left bottom, from(#00f2c3), color-stop(#0098f0), to(#00f2c3));
    background-image: linear-gradient(to bottom left, #00f2c3, #0098f0, #00f2c3);
    background-size: 210% 210%;
    background-position: 100% 0
}

.pagination.pagination-primary .page-item.active>.page-link,
.pagination.pagination-primary .page-item.active>.page-link:focus,
.pagination.pagination-primary .page-item.active>.page-link:hover {
    background: #38645A;
    background-image: -webkit-gradient(linear, right top, left bottom, from(#38645A), color-stop(#ba54f5), to(#38645A));
    background-image: linear-gradient(to bottom left, #38645A, #ba54f5, #38645A);
    background-size: 210% 210%;
    background-position: 100% 0
}

.pagination.pagination-warning .page-item.active>.page-link,
.pagination.pagination-warning .page-item.active>.page-link:focus,
.pagination.pagination-warning .page-item.active>.page-link:hover {
    background: #ff8d72;
    background-image: -webkit-gradient(linear, right top, left bottom, from(#ff8d72), color-stop(#ff6491), to(#ff8d72));
    background-image: linear-gradient(to bottom left, #ff8d72, #ff6491, #ff8d72);
    background-size: 210% 210%;
    background-position: 100% 0
}

.pagination.pagination-danger .page-item.active>.page-link,
.pagination.pagination-danger .page-item.active>.page-link:focus,
.pagination.pagination-danger .page-item.active>.page-link:hover {
    background: #fd5d93;
    background-image: -webkit-gradient(linear, right top, left bottom, from(#fd5d93), color-stop(#ec250d), to(#fd5d93));
    background-image: linear-gradient(to bottom left, #fd5d93, #ec250d, #fd5d93);
    background-size: 210% 210%;
    background-position: 100% 0
}

.pagination.pagination-neutral .page-item>.page-link {
    color: #fff
}

.pagination.pagination-neutral .page-item>.page-link:focus,
.pagination.pagination-neutral .page-item>.page-link:hover {
    background-color: hsla(0, 0%, 100%, .2);
    color: #fff
}

.pagination.pagination-neutral .page-item.active>.page-link,
.pagination.pagination-neutral .page-item.active>.page-link:focus,
.pagination.pagination-neutral .page-item.active>.page-link:hover {
    background-color: #fff;
    border-color: #fff;
    color: #38645A
}


.report-section-label {
    background: #5BB381;
    font-size: 18px;
    display: inline;
}

.report-section-input {
    width: 100%;
}

.report-section-input input {
    width: 100% !important;
    border-color: #bb54f4 !important;
}

.report-section-description {
    color: #5bb381 !important;
    font-style: italic;
    display: inline;
    float: right;
}

.xss-card-container {
    width: 100%;
}

.screenshot-image-container {
    background-color: #FFFFFF;
}

.report-image {
    width: 100%;
    height: 50vh;
}

.badge-pill {
    padding-right: .6em;
    padding-left: .6em;
    border-radius: 10rem;
}

.badge {
    display: inline-block;
    padding: .25em .4em;
    font-size: 75%;
    font-weight: 700;
    line-height: 1;
    text-align: center;
    white-space: nowrap;
    vertical-align: baseline;
    border-radius: .25rem;
    transition: color .15s ease-in-out, background-color .15s ease-in-out, border-color .15s ease-in-out, box-shadow .15s ease-in-out;
}

.badge-primary {
    color: #fff;
    background-color: #007bff
}

a.badge-primary:focus,
a.badge-primary:hover {
    color: #fff;
    background-color: #0062cc
}

a.badge-primary.focus,
a.badge-primary:focus {
    outline: 0;
    box-shadow: 0 0 0 .2rem rgba(0, 123, 255, .5)
}

.badge-secondary {
    color: #fff;
    background-color: #6c757d
}

a.badge-secondary:focus,
a.badge-secondary:hover {
    color: #fff;
    background-color: #545b62
}

a.badge-secondary.focus,
a.badge-secondary:focus {
    outline: 0;
    box-shadow: 0 0 0 .2rem rgba(108, 117, 125, .5)
}

.badge-success {
    color: #fff;
    background-color: #28a745
}

a.badge-success:focus,
a.badge-success:hover {
    color: #fff;
    background-color: #1e7e34
}

a.badge-success.focus,
a.badge-success:focus {
    outline: 0;
    box-shadow: 0 0 0 .2rem rgba(40, 167, 69, .5)
}

.badge-info {
    color: #fff;
    background-color: #17a2b8
}

a.badge-info:focus,
a.badge-info:hover {
    color: #fff;
    background-color: #117a8b
}

a.badge-info.focus,
a.badge-info:focus {
    outline: 0;
    box-shadow: 0 0 0 .2rem rgba(23, 162, 184, .5)
}

.badge-warning {
    color: #212529;
    background-color: #ffc107
}

a.badge-warning:focus,
a.badge-warning:hover {
    color: #212529;
    background-color: #d39e00
}

a.badge-warning.focus,
a.badge-warning:focus {
    outline: 0;
    box-shadow: 0 0 0 .2rem rgba(255, 193, 7, .5)
}

.badge-danger {
    color: #fff;
    background-color: #dc3545
}

a.badge-danger:focus,
a.badge-danger:hover {
    color: #fff;
    background-color: #bd2130
}

a.badge-danger.focus,
a.badge-danger:focus {
    outline: 0;
    box-shadow: 0 0 0 .2rem rgba(220, 53, 69, .5)
}

.badge-light {
    color: #212529;
    background-color: #f8f9fa
}

a.badge-light:focus,
a.badge-light:hover {
    color: #212529;
    background-color: #dae0e5
}

a.badge-light.focus,
a.badge-light:focus {
    outline: 0;
    box-shadow: 0 0 0 .2rem rgba(248, 249, 250, .5)
}

.badge-dark {
    color: #fff;
    background-color: #343a40
}

a.badge-dark:focus,
a.badge-dark:hover {
    color: #fff;
    background-color: #1d2124
}

a.badge-dark.focus,
a.badge-dark:focus {
    outline: 0;
    box-shadow: 0 0 0 .2rem rgba(52, 58, 64, .5)
}

.gegga {
    width: 0;
}

.snurra {
    filter: url(#gegga);
}

.stopp1 {
    stop-color: #38645A;
}

.stopp2 {
    stop-color: #8965e0;
}

.halvan {
    animation: Snurra1 5s infinite linear;
    stroke-dasharray: 180 800;
    fill: none;
    stroke: url(#gradient);
    stroke-width: 23;
    stroke-linecap: round;
}

.strecken {
    animation: Snurra1 3s infinite linear;
    stroke-dasharray: 26 54;
    fill: none;
    stroke: url(#gradient);
    stroke-width: 23;
    stroke-linecap: round;
}

.skugga {
    filter: blur(5px);
    opacity: 0.3;
    position: absolute;
    transform: translate(3px, 3px);
}

@keyframes Snurra1 {
    0% {
        stroke-dashoffset: 0;
    }

    100% {
        stroke-dashoffset: -403px;
    }
}

.loading-icon {
    position: fixed;
    bottom: 0;
    width: 10vw;
    right: 0;
}

.loading-text {
    height: 200px;
    line-height: 200px;
    text-align: center;
}

.gradient-text {
    background-color: #f3ec78;
    background-image: linear-gradient(45deg, #38645A, #38645A);
    background-size: 100%;
    -webkit-background-clip: text;
    -moz-background-clip: text;
    -webkit-text-fill-color: transparent;
    -moz-text-fill-color: transparent;
}

.emulate-link {
    cursor: pointer;
}

.CodeMirror {
    font-family: monospace;
    font-size: 14px;
    /*height: 150px;*/
    height: auto;
}

.progress-bar-animated {
    -webkit-animation: progress-bar-stripes 1s linear infinite;
    animation: progress-bar-stripes 1s linear infinite;
}

.progress-bar-striped {
    background-image: linear-gradient(45deg, hsla(0, 0%, 100%, .15) 25%, transparent 0, transparent 50%, hsla(0, 0%, 100%, .15) 0, hsla(0, 0%, 100%, .15) 75%, transparent 0, transparent);
    background-size: 1rem 1rem;
}

.progress-bar {
    flex-direction: column;
    justify-content: center;
    color: #fff;
    text-align: center;
    white-space: nowrap;
    background-color: #007bff;
    transition: width .6s ease;
}

.progress,
.progress-bar {
    display: flex;
    overflow: hidden;
}

.progress {
    height: 1rem;
    line-height: 0;
    font-size: .75rem;
    background-color: #1b0036;
    border-radius: .25rem;
}

.loading-bar {
    position: fixed;
    bottom: 0;
    width: 100%;
    height: 16px;
    right: 0;
    z-index: 10;
}

.bg-purp {
    background-color: #8965e0 !important;
}

hr {
    background-color: #ae8c57;
}

.corner-loader {}
</style>
