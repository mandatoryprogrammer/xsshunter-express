<template>
    <div>
        <notifications></notifications>
        <router-view :key="$route.fullPath" v-if="!show_login_prompt"></router-view>
        <!-- Login modal if not authenticated -->
        <modal class="show d-block" body-classes="p-0" modal-classes="modal-dialog-centered modal-sm ]" v-if="show_login_prompt">
            <card type="secondary" header-classes="bg-white pb-5" body-classes="px-lg-5 py-lg-5" class="border-0 mb-0" style="text-align: center">
                <h3 style="margin-bottom: 0; color: #2e5543;">XSS Hunter<br />
                    <i>Please login to continue.</i></h3>
                    <base-button simple type="primary" class="mt-3 ml-1 mr-1" v-on:click="googleLogin()">Google Login</base-button>
            </card>
        </modal>
        <div class="loading-bar" v-if="loading">
            <div class="progress">
                <div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" class="progress-bar bg-purp progress-bar-striped progress-bar-animated" style="width: 100%;"></div>
            </div>
        </div>
    </div>
</template>
<script>
import Modal from "./components/Modal";
import BaseAlert from "./components/BaseAlert";
import api_request from '@/libs/api.js';

export default {
    components: {
        Modal,
        BaseAlert
    },
    data() {
        return {
            loading: false,
            is_authed: false,
            invalid_password_used: false,
            password: '',
        }
    },
    computed: {
        show_login_prompt() {
            return !this.is_authed;
        }
    },
    methods: {
        async is_authenticated() {
            const auth_result = await api_request.is_authenticated();
            return auth_result.result.is_authenticated;
        },
        async attempt_login() {
            const login_result = await api_request.authenticate(
                this.password
            );

            if(login_result.success) {
                this.is_authed = true;
                return
            }

            if(login_result.code === "INVALID_CREDENTIALS") {
                this.invalid_password_used = true;
            }
        },
        disableRTL() {
            if (!this.$rtl.isRTL) {
                this.$rtl.disableRTL();
            }
        },
        toggleNavOpen() {
            let root = document.getElementsByTagName('html')[0];
            root.classList.toggle('nav-open');
        },
        googleLogin(){
            window.location = "/login";
        }
    },
    async mounted() {
        this.loading = true;
        window.app = this;
        this.$watch('$route', this.disableRTL, { immediate: true });
        this.$watch('$sidebar.showSidebar', this.toggleNavOpen);

        this.is_authed = await this.is_authenticated();

        this.loading = false;
    }

};

function get_random_number_in_range(min, max) {  
  return Math.floor(Math.random() * (max - min) + min); 
}  
</script>
<style>
.eye-white {
    color: #FFFFFF;
}

.eye-pink {
    color: #5BB381;
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
    background-color: #6B5B9A;
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
    background-color: #6B5B9A !important;
}
</style>
