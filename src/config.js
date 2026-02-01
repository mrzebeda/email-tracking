const path = require('path');
const fs = require('fs');

// Laad .env als het bestaat
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const config = {
  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // SMTP
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromName: process.env.EMAIL_FROM_NAME || 'Sales Team',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER,
  },

  // Tracking
  tracking: {
    url: process.env.TRACKING_URL || 'http://localhost:3001/track',
  },

  // Azure (optioneel)
  azure: {
    tenantId: process.env.TENANT_ID,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  },

  // Bedrijfsinfo
  company: {
    name: process.env.COMPANY_NAME || 'Ons Bedrijf',
    description: process.env.COMPANY_DESCRIPTION || '',
    salesPerson: process.env.SALES_PERSON_NAME || 'Sales Team',
    salesTitle: process.env.SALES_PERSON_TITLE || 'Sales',
  },

  // IMAP (voor inbox monitoring / reply detectie)
  imap: {
    host: process.env.IMAP_HOST || 'outlook.office365.com',
    port: parseInt(process.env.IMAP_PORT || '993'),
    user: process.env.IMAP_USER || process.env.SMTP_USER,
    pass: process.env.IMAP_PASS || process.env.SMTP_PASS,
  },

  // Reminders
  reminders: {
    unopenedAfterHours: parseInt(process.env.REMINDER_UNOPENED_AFTER_HOURS || process.env.REMINDER_AFTER_HOURS || '48'),
    openedNoReplyAfterHours: parseInt(process.env.REMINDER_OPENED_NO_REPLY_AFTER_HOURS || '72'),
    maxReminders: parseInt(process.env.MAX_REMINDERS || '2'),
  },

  // Auto-reply
  autoReply: {
    enabled: process.env.AUTO_REPLY_ENABLED === 'true',
  },

  // Bestanden
  files: {
    products: process.env.PRODUCTS_FILE || './data/producten.xlsx',
    contacts: process.env.CONTACTS_FILE || './data/contacten.xlsx',
    tracking: process.env.TRACKING_FILE || './data/tracking-log.xlsx',
  },
};

/**
 * Valideer configuratie en geef status per onderdeel
 */
function validateConfig() {
  const checks = [];

  // .env bestand
  checks.push({
    name: '.env bestand',
    ok: fs.existsSync(envPath),
    required: true,
    help: 'Kopieer .env.example naar .env:\n   cp .env.example .env',
  });

  // SMTP
  checks.push({
    name: 'SMTP email (SMTP_USER + SMTP_PASS)',
    ok: !!(config.smtp.user && config.smtp.pass),
    required: true,
    help: 'Vul SMTP_USER en SMTP_PASS in je .env bestand.\n   Voor Outlook/Office365: gebruik smtp.office365.com poort 587.\n   Voor Gmail: maak een App Password aan via Google Account > Beveiliging.',
  });

  // OpenAI
  checks.push({
    name: 'OpenAI API key (OPENAI_API_KEY)',
    ok: !!(config.openai.apiKey),
    required: false,
    help: 'Vul OPENAI_API_KEY in je .env voor AI-gegenereerde emails.\n   Zonder key wordt een standaard template gebruikt.',
  });

  // Bedrijfsinfo
  checks.push({
    name: 'Bedrijfsnaam (COMPANY_NAME)',
    ok: config.company.name !== 'Ons Bedrijf',
    required: true,
    help: 'Vul COMPANY_NAME in je .env bestand.',
  });

  // Producten Excel
  const productsPath = path.resolve(config.files.products);
  checks.push({
    name: `Producten bestand (${path.basename(productsPath)})`,
    ok: fs.existsSync(productsPath),
    required: true,
    help: 'Voer "npm run setup" uit, of plaats je eigen .xlsx in data/',
    path: productsPath,
  });

  // Contacten Excel
  const contactsPath = path.resolve(config.files.contacts);
  checks.push({
    name: `Contacten bestand (${path.basename(contactsPath)})`,
    ok: fs.existsSync(contactsPath),
    required: true,
    help: 'Voer "npm run setup" uit, of plaats je eigen .xlsx in data/',
    path: contactsPath,
  });

  // Tracking URL
  checks.push({
    name: 'Tracking URL (TRACKING_URL)',
    ok: !!(config.tracking.url),
    required: false,
    help: 'Standaard: http://localhost:3001/track\n   Voor productie: stel je Netlify URL in.',
  });

  // IMAP
  checks.push({
    name: 'IMAP inbox (IMAP_HOST + IMAP_USER)',
    ok: !!(config.imap.user && config.imap.pass),
    required: false,
    help: 'Vul IMAP_HOST, IMAP_USER en IMAP_PASS in je .env voor reply detectie.\n   Outlook: outlook.office365.com poort 993.',
  });

  return checks;
}

/**
 * Print configuratie status overzicht
 */
function printConfigStatus() {
  const checks = validateConfig();
  const allRequiredOk = checks.filter((c) => c.required).every((c) => c.ok);

  console.log('\n  CONFIGURATIE STATUS');
  console.log('  ' + '-'.repeat(50));

  checks.forEach((c) => {
    const icon = c.ok ? '[OK]' : (c.required ? '[!!]' : '[--]');
    const label = c.required ? '' : ' (optioneel)';
    console.log(`  ${icon}  ${c.name}${label}`);
  });

  console.log('  ' + '-'.repeat(50));

  if (!allRequiredOk) {
    console.log('\n  Ontbrekende configuratie:');
    checks
      .filter((c) => !c.ok && c.required)
      .forEach((c) => {
        console.log(`\n  >> ${c.name}`);
        console.log(`     ${c.help}`);
      });
  }

  return { checks, allRequiredOk };
}

/**
 * Check of de minimale config voor verzenden aanwezig is
 */
function canSendEmails() {
  return !!(config.smtp.user && config.smtp.pass);
}

/**
 * Check of AI beschikbaar is
 */
function hasAI() {
  return !!(config.openai.apiKey);
}

/**
 * Check of inbox monitoring beschikbaar is
 */
function canMonitorInbox() {
  return !!(config.imap.user && config.imap.pass);
}

module.exports = config;
module.exports.validateConfig = validateConfig;
module.exports.printConfigStatus = printConfigStatus;
module.exports.canSendEmails = canSendEmails;
module.exports.hasAI = hasAI;
module.exports.canMonitorInbox = canMonitorInbox;
