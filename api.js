const bcrypt = require('bcrypt');
const { Storage } = require('@google-cloud/storage');
const express = require('express');
const cors = require('cors');
const path = require('path');
const uuid = require('uuid');
const asyncfs = require('fs').promises;
const fs = require('fs');
const sessions = require('@truffledustin/node-client-sessions');
const favicon = require('serve-favicon');
const database = require('./database.js');
const Users = database.Users;
const Secrets = database.Secrets;
const safeCompare = require('safe-compare');
const { Op } = require("sequelize");
const PayloadFireResults = database.PayloadFireResults;
const CollectedPages = database.CollectedPages;
const InjectionRequests = database.InjectionRequests;
const constants = require('./constants.js');
const validate = require('express-jsonschema').validate;
const get_hashed_password = require('./utils.js').get_hashed_password;
const get_secure_random_string = require('./utils.js').get_secure_random_string;
const {google} = require('googleapis');
const {OAuth2Client} = require('google-auth-library');


const SCREENSHOTS_DIR = path.resolve(process.env.SCREENSHOTS_DIR);
const client = new OAuth2Client(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.NODE_ENV == 'production' ? `https://${process.env.HOSTNAME}/oauth-login` : `http://${process.env.HOSTNAME}/oauth-login`);
const SCREENSHOT_FILENAME_REGEX = new RegExp(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}\.png$/i);


var sessions_middleware = false;
var sessions_settings_object = {
    cookieName: 'session',
    duration: 7 * 24 * 60 * 60 * 1000, // Default session time is a week
    activeDuration: 1000 * 60 * 5, // Extend for five minutes if actively used
    cookie: {
        httpOnly: true,
        secureProxy: process.env.NODE_ENV == 'production'
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

async function check_file_exists(file_path) {
	return asyncfs.access(file_path, fs.constants.F_OK).then(() => {
		return true;
	}).catch(() => {
		return false;
	});
}


async function set_up_api_server(app) {
    // Check for existing session secret value
    const session_secret_setting = process.env.SESSION_SECRET_KEY;

    if (!session_secret_setting) {
    	console.error(`No session secret is set, can't start API server (this really shouldn't happen...)!`);
    	throw new Error('NO_SESSION_SECRET_SET');
    	return
    }

    const updated_session_settings = {
        ...sessions_settings_object,
        ...{
            secret: session_secret_setting
        }
    };
    sessions_middleware = sessions(updated_session_settings);

    // Session management
    app.use(session_wrapper_function);

    /* lol make this be a thing later TODO
    // Limit how big uploads are
    app.use(fileUpload({
        limits: {
            fileSize: 2000000 //2mb
        },
        abortOnLimit: true
     }));
    */


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
            constants.API_BASE_PATH + 'xss-uri',
            constants.API_BASE_PATH + 'user-path',
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
            // const user = await Users.findOne({ where: { 'id': req.session.user_id } });
            // if (user == null) {
            //     req.session.destroy();
            //     res.redirect(302, '/').json({
            //         "success": false,
            //         "error": "You must be authenticated to use this endpoint.",
            //         "code": "NOT_AUTHENTICATED"
            //     }).end();
            //     return
            // }

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
        redirect_uri: process.env.NODE_ENV == 'production' ? `https://${process.env.HOSTNAME}/oauth-login` : `http://${process.env.HOSTNAME}/oauth-login`,
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
            user.path = makeRandomPath(10);
            user.injectionCorrelationAPIKey = makeRandomPath(20);
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

    app.get('/screenshots/:screenshotFilename', async (req, res) => {
        const screenshot_filename = req.params.screenshotFilename;

        // Come correct or don't come at all.
        if(!SCREENSHOT_FILENAME_REGEX.test(screenshot_filename)) {
            return res.sendStatus(404);
        }

        const gz_image_path = `${screenshot_filename}.gz`;

        if (process.env.USE_CLOUD_STORAGE == "true"){
            const storage = new Storage();

            const bucket = storage.bucket(process.env.BUCKET_NAME);

            const file = bucket.file(gz_image_path);
            try {
                // Download the gzipped image
                const [image] = await file.download();
                // Send the gzipped image in the response
                res.set('Content-Encoding', 'gzip');
                res.set('Content-Type', 'image/png');
                res.send(image);
              } catch (error) {
                console.error(error);
                res.status(404).send(`Error retrieving image from GCS`);
              }
        }else{
            const image_exists = await check_file_exists(gz_image_path);

            if(!image_exists) {
                return res.sendStatus(404);
            }

            // Return the gzipped image file with the appropriate
            // Content-Encoding header, should be widely supported.
            res.sendFile(gz_image_path, {
                // Why leak anything you don't have to?
                lastModified: false,
                acceptRanges: false,
                cacheControl: true,
                headers: {
                    "Content-Type": "image/png",
                    "Content-Encoding": "gzip"
                }
            })
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
            	"path": user.path
            }
        }).end();
    });

    /*
		Update the user's path.
    */
    app.put(constants.API_BASE_PATH + 'user-path', async (req, res) => {
        let collisionUser;
        let desiredPath;
        if(typeof req.body.user_path == 'string'){
            desiredPath = req.body.user_path;
            collisionUser = await Users.findOne({ where: { 'path': desiredPath } });
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
            	"path": user.path
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
        console.log("Deleting payload fires: " + req.body.ids)
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
            const fileName = `${payload.screenshot_id}.png.gz`;
    		return fileName;
    	});
        if ( process.env.USE_CLOUD_STORAGE == "true"){ 
            const storage = new Storage();
            await Promise.all(screenshots_to_delete.map(screenshot_path => {
                return storage.bucket(process.env.BUCKET_NAME).file(screenshot_path).delete();
            }));
        }else{
            await Promise.all(screenshots_to_delete.map(screenshot_path => {
                return asyncfs.unlink(screenshot_path);
            }));
        }
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
                type: "Integer",
                required: false,
                minimum: 1,
                default: 1,
            },
            limit: {
                type: "Integer",
                required: false,
                minimum: 1,
                default: 10,
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
            let payload_secrets = [];
            for(let secret of secrets.rows){
                payload_secrets.push(secret);
            }
            const new_payload = {
                "url": payload.url,
                "ip_address": payload.ip_address,
                "referer": payload.referer,
                "user_agent": payload.user_agent,
                "cookies": payload.cookies,
                "title": payload.title,
                "origin": payload.origin,
                "screenshot_id": payload.screenshot_id,
                "was_iframe": payload.was_iframe,
                "browser_timestamp": payload.browser_timestamp,
                "CORS": payload.CORS,
                "gitExposed": payload.gitExposed,
                "createdAt": payload.createdAt,
                "id": payload.id,
                "updatedAt": payload.updatedAt,
                "secrets": payload_secrets
            }
            return_payloads.push(new_payload);
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
		const user = await Users.findOne({
			where: {
				injectionCorrelationAPIKey: req.body.owner_correlation_key
			}
		});

        if (! user) {
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
        let returnObj = {}
        const user = await Users.findOne({ where: { 'id': req.session.user_id } });
        if(! user){
            return res.send("Invalid");
        }
        returnObj.correlation_api_key = user.injectionCorrelationAPIKey;
        returnObj.chainload_uri = user.additionalJS;
        returnObj.send_alert_emails = user.sendEmailAlerts;
       
        res.status(200).json({
            'success': true,
            'result': returnObj
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
        const user = await Users.findOne({ where: { 'id': req.session.user_id } });
        if(! user){
            return res.send("Invalid");
        }
        if(req.body.correlation_api_key === true) {
            user.injectionCorrelationAPIKey = req.body.correlation_api_key;
        }

        // Intentionally no URL validation incase people want to do
        // data: for inline extra JS.
        if(req.body.chainload_uri) {
            user.additionalJS = req.body.chainload_uri;
        }else if (req.body.chainload_uri === ""){
            user.additionalJS = null;
        }

        if(req.body.send_alert_emails !== undefined) {
            user.sendEmailAlerts = req.body.send_alert_emails;
        }

        await user.save();

        res.status(200).json({
            'success': true,
            'result': {}
        }).end();
    });
}

module.exports = {
    set_up_api_server
};
