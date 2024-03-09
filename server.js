'use strict';

const get_app_server = require('./app.js');

const database = require('./database.js');
const database_init = database.database_init;

if(process.env.GREENLOCK_SSL_ENABLED === 'true' && !process.env.SSL_CONTACT_EMAIL) {
    console.error(`[ERROR] The environment variable 'SSL_CONTACT_EMAIL' is not set, please set it.`);
    process.exit();
}

(async () => {
	// Ensure database is initialized.
	await database_init();

	const app = await get_app_server();
	if (process.env.GREENLOCK_SSL_ENABLED === 'true') {
		require('greenlock-express').init({
			packageRoot: __dirname,
			configDir: './greenlock.d',
			cluster: false,
			   maintainerEmail: process.env.SSL_CONTACT_EMAIL,
		}).serve(app);
	} else {
		app.listen(80);
	}
})();
