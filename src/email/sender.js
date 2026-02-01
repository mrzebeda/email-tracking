const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { logEmailSent } = require('../excel/trackingLog');
const { updateContactStatus } = require('../excel/contactReader');

let transporter = null;

/**
 * Initialiseer de SMTP transporter
 */
function initTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  return transporter;
}

/**
 * Voeg tracking pixel toe aan HTML email
 */
function injectTrackingPixel(html, trackingId, contact, campaign) {
  const params = new URLSearchParams({
    id: trackingId,
    email: contact.email,
    campaign: campaign || 'default',
    customer: contact.name || '',
    company: contact.company || '',
    country: contact.country || '',
    pod: contact.pod || '',
  });

  const trackingUrl = `${config.tracking.url}?${params.toString()}`;

  const pixel = `<img src="${trackingUrl}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`);
  }
  return html + pixel;
}

/**
 * Verstuur een sales email met tracking
 */
async function sendTrackedEmail(contact, emailContent, options = {}) {
  const { campaign = 'default', trackingId = uuidv4() } = options;

  initTransporter();

  // Inject tracking pixel in HTML
  const trackedHtml = injectTrackingPixel(
    emailContent.bodyHtml,
    trackingId,
    contact,
    campaign
  );

  const mailOptions = {
    from: `"${config.smtp.fromName}" <${config.smtp.fromAddress}>`,
    to: contact.email,
    subject: emailContent.subject,
    text: emailContent.body,
    html: trackedHtml,
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    // Log in tracking systeem
    logEmailSent({
      trackingId,
      email: contact.email,
      contactName: contact.name,
      company: contact.company,
      campaign,
      subject: emailContent.subject,
    });

    // Update status in contacten Excel
    try {
      await updateContactStatus(contact, 'Sent');
    } catch {
      // niet fataal als dit mislukt
    }

    return { success: true, messageId: info.messageId, trackingId };
  } catch (error) {
    console.error(`  Fout bij verzenden naar ${contact.email}: ${error.message}`);
    return { success: false, error: error.message, trackingId };
  }
}

/**
 * Test de SMTP verbinding
 */
async function testConnection() {
  initTransporter();
  try {
    await transporter.verify();
    console.log('  SMTP verbinding succesvol!');
    return true;
  } catch (error) {
    console.error('  SMTP verbinding mislukt:', error.message);
    return false;
  }
}

module.exports = { sendTrackedEmail, testConnection, injectTrackingPixel };
