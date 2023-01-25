'use strict';

const get_app_server = require('./app.js');

const database = require('./database.js');
const database_init = database.database_init;

if(!process.env.SSL_CONTACT_EMAIL) {
    console.error(`[ERROR] The environment variable 'SSL_CONTACT_EMAIL' is not set, please set it.`);
    process.exit();
}

(async () => {
	// Ensure database is initialized.
	await database_init();

	const app = await get_app_server();

	const port = process.env.PORT;

	app.listen(port, () => {
		console.log(`XSS Hunter listening on port ${port}`)
	});
})();
