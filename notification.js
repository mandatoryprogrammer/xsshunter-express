const sendgrid = require('@sendgrid/mail')
sendgrid.setApiKey(process.env.SENDGRID_API_KEY)
const mustache = require('mustache');
const fs = require('fs');

const XSS_PAYLOAD_FIRE_EMAIL_TEMPLATE = fs.readFileSync(
	'./templates/xss_email_template.htm',
	'utf8'
);

async function send_email_notification(xss_payload_fire_data, email) {
	const notification_html_email_body = mustache.render(
		XSS_PAYLOAD_FIRE_EMAIL_TEMPLATE, 
		xss_payload_fire_data
	);

	const msg = {
		from: process.env.EMAIL_FROM,
		to: email,
		subject: `[XSS Hunter Express] XSS Payload Fired On ${xss_payload_fire_data.url}`,
		text: "Only HTML reports are available, please use an email client which supports this.",
		html: notification_html_email_body,
		asm: {
			groupId: parseInt(process.env.SENDGRID_UNSUBSRIBE_GROUP_ID),
			groupsToDisplay: [
				parseInt(process.env.SENDGRID_UNSUBSRIBE_GROUP_ID)
			]
		},		
	}
	response = await sendgrid
	.send(msg)
	.catch((error) => {
		console.error(error);
	})

	console.log("Message emailed with status %d", response[0].statusCode);
	return true;
}

module.exports.send_email_notification = send_email_notification;
