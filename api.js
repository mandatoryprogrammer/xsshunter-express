const bcrypt = require('bcrypt');
const express = require('express');
const cors = require('cors');
const path = require('path');
const uuid = require('uuid');
const asyncfs = require('fs').promises;
const sessions = require('@nvanexan/node-client-sessions');
const favicon = require('serve-favicon');
const database = require('./database.js');
const Users = database.Users;
const Secrets = database.Secrets;
const safeCompare = require('safe-compare');
const { Op } = require("sequelize");
const Settings = database.Settings;
const PayloadFireResults = database.PayloadFireResults;
const CollectedPages = database.CollectedPages;
const InjectionRequests = database.InjectionRequests;
const update_settings_value = database.update_settings_value;
const constants = require('./constants.js');
const validate = require('express-jsonschema').validate;
const get_hashed_password = require('./utils.js').get_hashed_password;
const get_secure_random_string = require('./utils.js').get_secure_random_string;
const {google} = require('googleapis');
const {OAuth2Client} = require('google-auth-library');


const SCREENSHOTS_DIR = path.resolve(process.env.SCREENSHOTS_DIR);
const client = new OAuth2Client(process.env.CLIENT_ID, process.env.CLIENT_SECRET, `https://${process.env.HOSTNAME}/oauth-login`);

var sessions_middleware = false;
var sessions_settings_object = {
    cookieName: 'session',
    duration: 7 * 24 * 60 * 60 * 1000, // Default session time is a week
    activeDuration: 1000 * 60 * 5, // Extend for five minutes if actively used
    cookie: {
        httpOnly: true,
        secure: true
    }
}

function makeRandomPath(length) {
    var result           = '';
    var characters       = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function session_wrapper_function(req, res, next) {
    return sessions_middleware(req, res, next);
}

async function set_up_api_server(app) {
    // Check for existing session secret value
    const session_secret_setting = await Settings.findOne({
    	where: {
    		key: constants.session_secret_key
    	}
    });

    if (!session_secret_setting) {
    	console.error(`No session secret is set, can't start API server (this really shouldn't happen...)!`);
    	throw new Error('NO_SESSION_SECRET_SET');
    	return
    }

    const updated_session_settings = {
        ...sessions_settings_object,
        ...{
            secret: session_secret_setting.value
        }
    };
    sessions_middleware = sessions(updated_session_settings);

    // Session management
    app.use(session_wrapper_function);

    // If that's not present, the request should be rejected.
    app.use(async function(req, res, next) {
    	// Must be an API route else CSRF protection doesn't matter
    	if(!req.path.startsWith(constants.API_BASE_PATH)) {
    		next();
    		return
    	}

    	// Check to see if the required CSRF header is set
    	// If it's not set, reject the request.
    	const csrf_header_value = req.header(constants.csrf_header_name);
    	if(!csrf_header_value) {
            res.status(401).json({
                "success": false,
                "error": "No CSRF header specified, request rejected.",
                "code": "CSRF_VIOLATION"
            }).end();
    		return
    	}

    	// Otherwise we're fine to continue
    	next();
    });

    // Restrict all API routes unless the user is authenticated.
    app.use(async function(req, res, next) {
        const AUTHENTICATION_REQUIRED_ROUTES = [
            constants.API_BASE_PATH + 'payloadfires',
            constants.API_BASE_PATH + 'collected_pages',
            constants.API_BASE_PATH + 'settings',
        ];

        // Check if the path being accessed required authentication
        var requires_authentication = false;
        AUTHENTICATION_REQUIRED_ROUTES.map(authenticated_route => {
            if(req.path.toLowerCase().startsWith(authenticated_route)) {
                requires_authentication = true;
            }
        });

        // If the route is not one of the authentication required routes
        // then we can allow it through.
        if(!requires_authentication) {
            next();
            return;
        }

    	// If the user is authenticated, let them pass
    	if(req.session.authenticated === true) {
    		next();
    		return;
    	}

    	// Otherwise, fall to blocking them by default.
	    res.status(401).json({
	        "success": false,
	        "error": "You must be authenticated to use this endpoint.",
	        "code": "NOT_AUTHENTICATED"
	    }).end();
		return
    });

    app.get('/login', (req, res) => {
      const authUrl = client.generateAuthUrl({
        redirect_uri: `https://${process.env.HOSTNAME}/oauth-login`,
        access_type: 'offline',
        scope: ['email', 'profile'],
        prompt: 'select_account'
      });
      res.redirect(authUrl);
    });

    app.get('/oauth-login', async (req, res) => {
      try{
          const code = req.query.code;
          const {tokens} = await client.getToken(code);
          client.setCredentials(tokens);
          const oauth2 = google.oauth2({version: 'v2', auth: client});
          const googleUserProfile = await oauth2.userinfo.v2.me.get();
          const email = googleUserProfile.data.email
          const [user, created] = await Users.findOrCreate({ where: { 'email': email } });
          if(created){
            user.path = makeRandomPath(20);
            user.save();
          }
          req.session.email = user.email;
          req.session.user_id = user.id;
          req.session.authenticated = true;
          res.redirect("/app/");
      } catch (error) {
        console.log(`Error Occured: ${error}`);
        res.status(500).send("Error Occured");
      }
    });


    // Serve the front-end
    app.use('/app/', express.static(
    	'./front-end/dist/',
    	{
    		setHeaders: function (res, path, stat) {
    			res.set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; prefetch-src 'self'; manifest-src 'self'");
    		},
    	},
    ));
    app.use(favicon('./front-end/dist/favicon.ico'));

    /*
		Endpoint which returns if the user is logged in or not.
    */
    app.get(constants.API_BASE_PATH + 'auth-check', async (req, res) => {
        res.status(200).json({
            "success": true,
            "result": {
            	"is_authenticated": (req.session.authenticated == true)
            }
        }).end();
    });

    /*
		Just returns the user's XSS URI if logged in.
    */
    app.get(constants.API_BASE_PATH + 'xss-uri', async (req, res) => {
        const user = await Users.findOne({ where: { 'id': req.session.user_id } });
        const uri = process.env.XSS_HOSTNAME + "/" + user.path;
        res.status(200).json({
            "success": true,
            "result": {
            	"uri": uri
            }
        }).end();
    });

    /*
		Get the user's path.
    */
    app.get(constants.API_BASE_PATH + 'user-path', async (req, res) => {
        const user = await Users.findOne({ where: { 'id': req.session.user_id } });
        res.status(200).json({
            "success": true,
            "result": {
            	"uri": user.path
            }
        }).end();
    });

    /*
		Update the user's path.
    */
    app.put(constants.API_BASE_PATH + 'user-path', async (req, res) => {
        if(req.body.path instanceof String){
            const desiredPath = req.body.path;
            const collisionUser = await Users.findOne({ where: { 'path': desiredPath } });
        }else{
            return res.status(200).json({
                "success": false,
                "error": "invalid path"
            }).end();
        }
        if( collisionUser ){
            return res.status(200).json({
                "success": false,
                "error": "Path taken by another user"
            }).end();
        }

        const user = await Users.findOne({ where: { 'id': req.session.user_id } });
        user.path = desiredPath;
        user.save();
        res.status(200).json({
            "success": true,
            "result": {
            	"uri": user.path
            }
        }).end();
    });






    /*
    	Attempt to log into the administrator account
    */
    const LoginSchema = {
        type: 'object',
        properties: {
            password: {
                type: 'string',
				minLength: 1,
				maxLength: 72,
                required: true,
            },
        }
    }

    /*
		Deletes a given XSS payload(s)
    */
    const DeletePayloadFiresSchema = {
        type: 'object',
        properties: {
            ids: {
                type: 'array',
                required: true,
                items: {
                	type: 'string'
                }
            }
        }
    }
    app.delete(constants.API_BASE_PATH + 'payloadfires', validate({ body: DeletePayloadFiresSchema }), async (req, res) => {
    	const ids_to_delete = req.body.ids;

    	// Pull the corresponding screenshot_ids from the DB so
    	// we can delete all the payload fire images as well as
    	// the payload records themselves.
    	const screenshot_id_records = await PayloadFireResults.findAll({
    		where: {
    			id: {
    				[Op.in]: ids_to_delete
    			},
                user_id: req.session.user_id
    		},
    		attributes: ['id', 'screenshot_id']
    	});
    	const screenshots_to_delete = screenshot_id_records.map(payload => {
    		return `${SCREENSHOTS_DIR}/${payload.screenshot_id}.png.gz`;
    	});
    	await Promise.all(screenshots_to_delete.map(screenshot_path => {
    		return asyncfs.unlink(screenshot_path);
    	}));
    	const payload_fires = await PayloadFireResults.destroy({
    		where: {
    			id: {
    				[Op.in]: ids_to_delete
    			}
    		}
    	});

        res.status(200).json({
            'success': true,
            'result': {}
        }).end();
    });

    /*
		Returns the list of XSS payload fire results.
    */
    const ListPayloadFiresSchema = {
        type: 'object',
        properties: {
            page: {
                type: 'string',
                required: false,
                default: '0',
                pattern: '[0-9]+',
            },
            limit: {
                type: 'string',
                required: false,
                default: '10',
                pattern: '[0-9]+',
            },
        }
    }
    app.get(constants.API_BASE_PATH + 'payloadfires', validate({ query: ListPayloadFiresSchema }), async (req, res) => {
    	const page = (parseInt(req.query.page) - 1);
    	const limit = parseInt(req.query.limit);
    	const offset = (page * limit);
    	const payload_fires = await PayloadFireResults.findAndCountAll({
    		where: {
                user_id: req.session.user_id
            },
            limit: limit,
    		offset: (page * limit),
    		order: [['createdAt', 'DESC']],
    	});

        let return_payloads = [];
        for(let payload of payload_fires.rows){
            let secrets = await Secrets.findAndCountAll({
                where: {
                    payload_id: payload.id
                }
            });
            payload.secrets = secrets.rows;
            return_payloads.push(payload);
        }

        res.status(200).json({
            'success': true,
            'result': {
            	'payload_fires': return_payloads,
            	'total': payload_fires.count
            }
        }).end();
    });

    /*
		Returns the list of collected pages
    */
    const ListCollectedPagesSchema = {
        type: 'object',
        properties: {
            page: {
                type: 'string',
                required: false,
                default: '0',
                pattern: '[0-9]+',
            },
            limit: {
                type: 'string',
                required: false,
                default: '10',
                pattern: '[0-9]+',
            },
        }
    }
    app.get(constants.API_BASE_PATH + 'collected_pages', validate({ query: ListCollectedPagesSchema }), async (req, res) => {
    	const page = (parseInt(req.query.page) - 1);
    	const limit = parseInt(req.query.limit);
    	const offset = (page * limit);
    	const collected_pages = await CollectedPages.findAndCountAll({
            where: {
                user_id: req.session.user_id
            },
    		limit: limit,
    		offset: (page * limit),
    		order: [['createdAt', 'DESC']],
    	});

        res.status(200).json({
            'success': true,
            'result': {
            	'collected_pages': collected_pages.rows,
            	'total': collected_pages.count
            }
        }).end();
    });

    /*
		Deletes a given collected page(s)
    */
    const DeleteCollectedPagesSchema = {
        type: 'object',
        properties: {
            ids: {
                type: 'array',
                required: true,
                items: {
                	type: 'string'
                }
            }
        }
    }
    app.delete(constants.API_BASE_PATH + 'collected_pages', validate({ body: DeleteCollectedPagesSchema }), async (req, res) => {
    	const ids_to_delete = req.body.ids;
    	const payload_fires = await CollectedPages.destroy({
    		where: {
    			id: {
    				[Op.in]: ids_to_delete
    			}
    		}
    	});

        res.status(200).json({
            'success': true,
            'result': {}
        }).end();
    });

    /*
    	Correlated injections API endpoint.
    	Authentication is custom for this endpoint
    	(Uses the correlation API key)
    */
    const RecordCorrelatedRequestSchema = {
        type: 'object',
        properties: {
            request: {
                type: 'string',
                required: true,
            },
            owner_correlation_key: {
                type: 'string',
                required: true,
            },
            injection_key: {
                type: 'string',
                required: true,
            },
        }
    }
    app.post(constants.API_BASE_PATH + 'record_injection', validate({ body: RecordCorrelatedRequestSchema }), async (req, res) => {
		const correlation_key_record = await Settings.findOne({
			where: {
				key: constants.CORRELATION_API_SECRET_SETTINGS_KEY
			}
		});

        if (!safeCompare(correlation_key_record.value, req.body.owner_correlation_key)) {
            res.status(200).json({
                "success": false,
                "error": "Invalid authentication provided. Please provide a proper correlation API key.",
                "code": "INVALID_CREDENTIALS"
            }).end();
            return
        }

        try {
			// Create injection correlation record
			await InjectionRequests.create({
				id: uuid.v4(),
				request: req.body.request,
				injection_key: req.body.injection_key,
			});
        } catch (e) {
        	if(e.name === 'SequelizeUniqueConstraintError') {
	            res.status(200).json({
	                "success": false,
	                "error": "That injection key has already been used previously.",
	                "code": "EXISTING_INJECTION_KEY"
	            }).end();
	            return
        	}
            res.status(200).json({
                "success": false,
                "error": "An unexpected error occurred.",
                "code": e.name.toString(),
            }).end();
            return
        }

        res.status(200).json({
            "success": true,
            "message": "Injection request successfully recorded!"
        }).end();
    });

    /*
		Returns current settings values for the UI
    */
    app.get(constants.API_BASE_PATH + 'settings', async (req, res) => {
    	const settings_to_retrieve = [
    		{
    			key: constants.CORRELATION_API_SECRET_SETTINGS_KEY,
    			return_key: 'correlation_api_key',
    			default: '',
    			formatter: false,
    		},
    		{
    			key: constants.CHAINLOAD_URI_SETTINGS_KEY,
    			return_key: 'chainload_uri',
    			default: '',
    			formatter: false,
    		},
    		{
    			key: constants.PAGES_TO_COLLECT_SETTINGS_KEY,
    			return_key: 'pages_to_collect',
    			default: [],
    			formatter: ((value) => {
    				return JSON.parse(value);
    			}),
    		},
            {
                key: constants.SEND_ALERT_EMAILS_KEY,
                return_key: 'send_alert_emails',
                default: true,
                formatter: ((value) => {
                    return JSON.parse(value);
                }),
            },
    	];

    	let result = {};
    	let database_promises = settings_to_retrieve.map(async settings_value_metadata => {
			const db_record = await Settings.findOne({
				where: {
					key: settings_value_metadata.key
				}
			});

			const formatter_function = settings_value_metadata.formatter ? settings_value_metadata.formatter : (value) => value;
			result[settings_value_metadata.return_key] = db_record ? formatter_function(db_record.value) : settings_value_metadata.default;
    	});
    	await Promise.all(database_promises);

        res.status(200).json({
            'success': true,
            result
        }).end();
    });

    /*
		Updates a specific config for the service
    */
    const UpdateConfigSchema = {
        type: 'object',
        properties: {
            password: {
                type: 'string',
                required: false,
            },
            correlation_api_key: {
                type: 'boolean',
                required: false,
            },
            chainload_uri: {
                type: 'string',
                required: false,
            },
            send_alert_emails: {
                type: 'boolean',
                required: false,
            },
            revoke_all_sessions: {
                type: 'boolean',
                required: false,
            },
            pages_to_collect: {
                type: 'array',
                required: false,
                items: {
                    type: 'string'
                }
            }
        }
    }
    app.put(constants.API_BASE_PATH + 'settings', validate({ body: UpdateConfigSchema }), async (req, res) => {

        if(req.body.correlation_api_key === true) {
            const correlation_api_key = get_secure_random_string(64);
            await update_settings_value(
                constants.CORRELATION_API_SECRET_SETTINGS_KEY,
                correlation_api_key
            );
        }

        // Intentionally no URL validation incase people want to do
        // data: for inline extra JS.
        if(req.body.chainload_uri) {
            await update_settings_value(
                constants.CHAINLOAD_URI_SETTINGS_KEY,
                req.body.chainload_uri
            );
        }

        if(req.body.send_alert_emails !== undefined) {
            await update_settings_value(
                constants.SEND_ALERT_EMAILS_KEY,
                req.body.send_alert_emails.toString()
            );
        }

        // Immediately rotate session secret and revoke all sessions.
        if(req.body.revoke_all_sessions !== undefined) {
            const new_session_secret = get_secure_random_string(64);
            // Update session secret in database
            const session_secret_setting = await Settings.findOne({
                where: {
                    key: constants.session_secret_key
                }
            });
            session_secret_setting.value = new_session_secret;
            await session_secret_setting.save();

            // We do this by patching the sessions middleware at runtime
            // to utilize a new HMAC secret so all previous sessions are revoked.
            const updated_session_settings = {
                ...sessions_settings_object,
                ...{
                    secret: session_secret_setting.value
                }
            };
            sessions_middleware = sessions(updated_session_settings);
        }

        if(req.body.pages_to_collect) {
            await update_settings_value(
                constants.PAGES_TO_COLLECT_SETTINGS_KEY,
                JSON.stringify(req.body.pages_to_collect)
            );
        }

        res.status(200).json({
            'success': true,
            'result': {}
        }).end();
    });
}

module.exports = {
    set_up_api_server
};
