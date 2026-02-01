require('dotenv').config();

const config = {
  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // SMTP
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
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

  // Reminders
  reminders: {
    afterHours: parseInt(process.env.REMINDER_AFTER_HOURS || '48'),
    maxReminders: parseInt(process.env.MAX_REMINDERS || '2'),
  },

  // Bestanden
  files: {
    products: process.env.PRODUCTS_FILE || './data/producten.xlsx',
    contacts: process.env.CONTACTS_FILE || './data/contacten.xlsx',
    tracking: process.env.TRACKING_FILE || './data/tracking-log.xlsx',
  },
};

module.exports = config;
