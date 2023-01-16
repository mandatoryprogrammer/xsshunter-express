const BASE_API_PATH = location.origin.toString();
const api_url_object = new URL(BASE_API_PATH);
const BASE_DOMAIN = api_url_object.host;

async function api_request(method, path, body) {
    var request_options = {
        method: method,
        credentials: 'include',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Buster': 'true'
        },
        redirect: 'follow'
    };
    if (body) {
        request_options.body = JSON.stringify(body);
    }
    window.app.loading = true;
    try {
      var response = await fetch(
          `${BASE_API_PATH}${path}`,
          request_options
      );
    } catch ( e ) {
      window.app.loading = false;
      throw e;
    }
    window.app.loading = false;
    const response_body = await response.json();
    return response_body;
}

async function is_authenticated() {
    return api_request(
        'GET',
        `/api/v1/auth-check`,
        false
    );
}

async function get_xss_uri() {
    return api_request(
        'GET',
        `/api/v1/xss-uri`,
        false
    );
}

async function authenticate(password) {
    return api_request(
        'POST',
        `/api/v1/login`,
        {
            'password': password
        }
    );
}

async function get_payload_fires(page, limit) {
    return api_request(
        'GET',
        `/api/v1/payloadfires?page=${page}&limit=${limit}`,
        false
    );
}

async function delete_payload_fires(payload_id_array) {
    return api_request(
        'DELETE',
        `/api/v1/payloadfires`,
        {
            'ids': payload_id_array
        }
    );
}

async function get_collect_pages(page, limit) {
    return api_request(
        'GET',
        `/api/v1/collected_pages?page=${page}&limit=${limit}`,
        false
    );
}

async function delete_collect_pages(collected_pages_id_array) {
    return api_request(
        'DELETE',
        `/api/v1/collected_pages`,
        {
            'ids': collected_pages_id_array
        }
    );
}

async function get_settings() {
    return api_request(
        'GET',
        `/api/v1/settings`,
        false
    );
}

async function update_password(new_password) {
    return api_request(
        'PUT',
        `/api/v1/settings`,
        {
            "password": new_password,
        }
    );
}

async function generate_new_correlation_api_key() {
    return api_request(
        'PUT',
        `/api/v1/settings`,
        {
            "correlation_api_key": true,
        }
    );
}

async function get_user_path() {
    return api_request(
        'GET',
        `/api/v1/user-path`,
        false
    );
}

async function update_user_path(path) {
    return api_request(
        'PUT',
        `/api/v1/user-path`,
        {
            "user_path": path,
        }
    );
}


async function set_chainload_uri(chainload_uri) {
    return api_request(
        'PUT',
        `/api/v1/settings`,
        {
            "chainload_uri": chainload_uri,
        }
    );
}

async function set_email_alerts(send_alerts_bool) {
    return api_request(
        'PUT',
        `/api/v1/settings`,
        {
            "send_alert_emails": send_alerts_bool,
        }
    );
}

async function revoke_all_sessions() {
    return api_request(
        'PUT',
        `/api/v1/settings`,
        {
            "revoke_all_sessions": true,
        }
    );
}

async function update_pages_to_collect(pages_to_collect) {
    return api_request(
        'PUT',
        `/api/v1/settings`,
        {
            "pages_to_collect": pages_to_collect,
        }
    );
}

module.exports = {
    BASE_API_PATH,
    BASE_DOMAIN,
    api_request,
    is_authenticated,
    authenticate,
    get_user_path,
    update_user_path,
    get_payload_fires,
    delete_payload_fires,
    get_collect_pages,
    delete_collect_pages,
    get_settings,
    update_password,
    generate_new_correlation_api_key,
    set_chainload_uri,
    set_email_alerts,
    get_xss_uri,
    revoke_all_sessions,
    update_pages_to_collect
}
