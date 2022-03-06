const nodemailer = require('nodemailer');
const mustache = require('mustache');
const fs = require('fs');
const axios = require('axios');

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

async function send_slack_notification(xss_payload_fire_data) {
	var slack_message = {
		"channel": process.env.SLACK_CHANNEL,
		"username": process.env.SLACK_USERNAME,
		"icon_emoji": `:${process.env.SLACK_EMOJI}:`,
		"blocks": [
			{
				"type": "section",
				"text": {
					"type": "plain_text",
					"text": `XSS Payload Fired On ${xss_payload_fire_data.url}`
				}
			},
		]
	};

	await axios.post(process.env.SLACK_WEBHOOK, JSON.stringify(slack_message));

	console.log("Message sent to slack");
}

async function send_discord_notification(xss_payload_fire_data) {
	var discord_message = {
		"content": `XSS Payload Fired On ${xss_payload_fire_data.url}`
	};

	await axios.post(process.env.DISCORD_WEBHOOK, discord_message);

	console.log("Message sent to discord");
}

module.exports.send_email_notification = send_email_notification;
module.exports.send_slack_notification = send_slack_notification;
module.exports.send_discord_notification = send_discord_notification;