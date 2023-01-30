<template>
    <div>
        <div class="row">
            <div class="col-12">
                <card class="xss-card-container">
                    <div class="row pl-4 pr-4 p-2" style="display: block;">
                        <div>
                            <h1><i class="fas fa-cogs"></i>&nbsp;User Settings</h1>
                        </div>
                        <card>
                            <h4 class="card-title">XSSHunter Path</h4>
                            <h6 class="card-subtitle mb-2 text-muted">Unique path linked to your account that ties injection payloads back to you. Shorter is better. WARNING: changing this will make existing payloads not linked to your account. (defaults to 20 chars)</h6>
                            <p class="card-text">
                                <base-input v-model:value="user_path" type="text" placeholder="..."></base-input>
                            </p>
                            <base-button type="primary" v-on:click="update_path">
                                <span style="display: inline-block; margin-right: 6px;"><i class="fas fa-lock"></i></span>
                                Update Path
                            </base-button>
                        </card>
                        <card>
                            <h4 class="card-title">Additional JavaScript to Chainload (URL)</h4>
                            <h6 class="card-subtitle mb-2 text-muted">Remote JavaScript to retrieve and evaluate after the original payload completes.</h6>
                            <p class="card-text">
                                <base-input v-model="chainload_uri" type="text" placeholder="https://example.com/remote.js"></base-input>
                            </p>
                            <base-button type="primary" v-on:click="update_chainload_uri">
                                <span style="display: inline-block; margin-right: 6px;"><i class="far fa-save"></i></span>
                                Save JavaScript URL
                            </base-button>
                        </card>
                        <card>
                            <h4 class="card-title">Miscellaneous Options</h4>
                            <div v-if="send_alert_emails">
                                <base-button type="primary" v-on:click="set_email_reporting">
                                    <span style="display: inline-block; margin-right: 6px;"><i class="far fa-bell-slash"></i></span>
                                    Disable Email Reporting
                                </base-button>
                                <h6 class="mt-2 text-muted">
                                    Disable sending XSS payload fire reports to the specified email address.
                                </h6>
                            </div>
                            <div v-if="!send_alert_emails">
                                <base-button type="primary" v-on:click="set_email_reporting">
                                    <span style="display: inline-block; margin-right: 6px;"><i class="far fa-bell"></i></span>
                                    Enable Email Reporting
                                </base-button>
                                <h6 class="mt-2 text-muted">
                                    Enable sending XSS payload fire reports to the specified email address.
                                </h6>
                            </div>
                            
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
import BaseAlert from '@/components/BaseAlert.vue';

export default {
    data() {
        return {
            base_api_path: '',
            rate_limit_options: [
                {
                    'text': 'No rate limiting',
                    'seconds': -1,
                },
                {
                    'text': 'One payload fire a minute',
                    'seconds': 60,
                },
                {
                    'text': 'Two payload fires a minute',
                    'seconds': 30,
                },
                {
                    'text': 'Five payload fires a minute',
                    'seconds': 12,
                },
                {
                    'text': 'One payload fire every five minutes',
                    'seconds': 300,
                },
                {
                    'text': 'One payload fire every ten minutes',
                    'seconds': 600,
                },
                {
                    'text': 'One payload fire every half-hour',
                    'seconds': 1800,
                },
                {
                    'text': 'One payload fire every hour',
                    'seconds': 3600,
                },
                {
                    'text': 'One payload fire every two hours',
                    'seconds': 7200,
                },
                {
                    'text': 'One payload fire every five hours',
                    'seconds': 18000,
                },
                {
                    'text': 'One payload fire every ten hours',
                    'seconds': 36000,
                },
                {
                    'text': 'One payload fire every day',
                    'seconds': 86400,
                },
            ],
            chainload_uri: '',
            correlation_api_key: '',
            user_path: '',
            pages_to_collect: [],
            selected_page_to_collect: [],
            new_page_to_collect: '',
            rate_limit: -1,
            password: '',
            send_alert_emails: true,
        }
    },
    watch: {},
    methods: {
        update_path: async function() {
            const desiredPath = this.user_path;
            if(desiredPath === '') {
                alert('Path is empty, please provide a valid path to continue.');
                return
            }
            const res = await api_request.update_user_path(desiredPath);
            const user_path = await api_request.get_user_path();
            this.user_path = user_path.result.path;
            if(res.success){
                toastr.success('Your user path has been updated.', 'Path Updated');
            }else{
                toastr.error(res.error, 'Path Update Error');
            }
        },
        generate_new_correlation_api_key: async function() {
            await api_request.generate_new_correlation_api_key();
            await this.pull_latest_settings();
            toastr.success('Your correlated injection API key has been rotated.', 'Correlated Injection API Key Rotated')
        },
        pull_latest_settings: async function() {
            const settings_keys = [
                'chainload_uri',
                'correlation_api_key',
                'pages_to_collect',
                'rate_limit',
                'send_alert_emails'
            ];
            const user_path = await api_request.get_user_path();
            this.user_path = user_path.result.path;
            // Pull settings
            const settings_result = await api_request.get_settings();
            const settings = settings_result.result;
            settings_keys.map(settings_key => {
                this[settings_key] = settings[settings_key];
            });

        },
        update_chainload_uri: async function() {
            await api_request.set_chainload_uri(this.chainload_uri);
            await this.pull_latest_settings();
            toastr.success('Your chainload URI has been updated.', 'Chainload URI Updated')
        },
        set_email_reporting: async function() {
            await api_request.set_email_alerts(!this.send_alert_emails);
            await this.pull_latest_settings();
            toastr.success('Your email reporting settings have been updated.', 'Email Reporting Updated')
        },
        revoke_all_sessions: async function() {
            await api_request.revoke_all_sessions();
            toastr.success('All active sessions have been revoked.', 'All Active Sessions Revoked')
            window.location.reload();
        },
        add_new_page_to_collect: async function() {
            var new_page = this.new_page_to_collect;
            if(!new_page.startsWith('/')) {
                new_page = '/' + new_page;
            }
            this.pages_to_collect.push(new_page);
            this.new_page_to_collect = '';
        },
        delete_selected_pages_to_collect: async function() {
            this.pages_to_collect = this.pages_to_collect.filter(page_to_collect => {
                return !this.selected_page_to_collect.includes(page_to_collect);
            });
        },
        update_pages_to_collect: async function() {
            await api_request.update_pages_to_collect(this.pages_to_collect);
            await this.pull_latest_settings();
            toastr.success('Your pages to collect have been updated.', 'Pages to Collect Updated')
        }
    },
    computed: {
        rate_limit_text: function() {
            const matching_options = this.rate_limit_options.filter(option_data => {
                return option_data.seconds === this.rate_limit;
            });
            if(matching_options.length === 0) {
                return 'No rate limiting';
            }
            return matching_options[0].text;
        }
    },
    components: {
        BaseAlert,
    },
    async mounted() {
        // For debugging
        window.app = this;

        // For rendering
        this.base_api_path = api_request.BASE_API_PATH;

        await this.pull_latest_settings();
    },
    beforeDestroy() {}
};
</script>
<style>
.dropdown-item {
    font-size: 16px !important;
}
</style>
