const nodemailer = require('nodemailer');
const mustache = require('mustache');
const fs = require('fs');
const fetch = require("node-fetch");

const XSS_PAYLOAD_FIRE_EMAIL_TEMPLATE = fs.readFileSync(
	'./templates/xss_email_template.htm',
	'utf8'
);

async function send_email_notification(xss_payload_fire_data) {
	const transporter = nodemailer.createTransport({
		host: process.env.SMTP_HOST,
		port: parseInt(process.env.SMTP_PORT),
		secure: (process.env.SMTP_USE_TLS === "true"),
		auth: {
			user: process.env.SMTP_USERNAME,
			pass: process.env.SMTP_PASSWORD,
		},
	});

	const notification_html_email_body = mustache.render(
		XSS_PAYLOAD_FIRE_EMAIL_TEMPLATE,
		xss_payload_fire_data
	);

	const info = await transporter.sendMail({
		from: process.env.SMTP_FROM_EMAIL,
		to: process.env.SMTP_RECEIVER_EMAIL,
		subject: `[XSS Hunter Express] XSS Payload Fired On ${xss_payload_fire_data.url}`,
		text: "Only HTML reports are available, please use an email client which supports this.",
		html: notification_html_email_body,
	});

	console.log("Message sent: %s", info.messageId);
}

async function send_rocket_notification(xss_payload_fire_data) {

	console.log('xss_payload_fire', xss_payload_fire_data.url)
	const slack_message = {
		text: `[XSS Hunter Express] XSS Payload Fired On ${xss_payload_fire_data.url}. See ${process.env.HOSTNAME}/admin`,
	};

	options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(slack_message)
	}

	fetch(process.env.ROCKETCHAT_WEBHOOK, options)
		.then(response => response.json())
		.then(data => {
			console.log("Message sent to slack. Response data:", data); // Handle the response data here
		})
		.catch(error => {
			console.error('Error:', error);
		});
}
module.exports.send_email_notification = send_email_notification;
module.exports.send_rocket_notification = send_rocket_notification;