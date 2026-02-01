#!/usr/bin/env node

/**
 * Interactieve configuratie wizard.
 * Vraagt om je gegevens en maakt alles automatisch klaar.
 *
 * Gebruik: npm run configure
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const envPath = path.resolve(__dirname, '..', '.env');
const envExamplePath = path.resolve(__dirname, '..', '.env.example');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, defaultVal) => new Promise((resolve) => {
  const suffix = defaultVal ? ` (${defaultVal})` : '';
  rl.question(`  ${q}${suffix}: `, (answer) => {
    resolve(answer.trim() || defaultVal || '');
  });
});

async function configure() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   AI SALES EMAIL AGENT - CONFIGURATIE        ║');
  console.log('  ║   Vul je gegevens in en je bent klaar.       ║');
  console.log('  ╚══════════════════════════════════════════════╝');

  // Lees bestaande .env als die er is
  const existing = {};
  if (fs.existsSync(envPath)) {
    console.log('\n  Bestaand .env bestand gevonden. Huidige waarden worden als standaard gebruikt.');
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && match[2] && !match[2].startsWith('jouw-') && !match[2].startsWith('sk-...')) {
        existing[match[1]] = match[2];
      }
    });
  }

  // ── STAP 1: Outlook / Email ────────────────────────
  console.log('\n  ── STAP 1/4: Outlook Email ──────────────────');
  console.log('  Dit is je Outlook email waarmee je emails verstuurt.\n');

  const email = await ask('Je Outlook email adres', existing.SMTP_USER);
  const password = await ask('Je Outlook wachtwoord', existing.SMTP_PASS);
  const fromName = await ask('Je naam (verschijnt als afzender)', existing.EMAIL_FROM_NAME || existing.SALES_PERSON_NAME);

  // ── STAP 2: Bedrijfsinfo ──────────────────────────
  console.log('\n  ── STAP 2/4: Bedrijfsinformatie ────────────');
  console.log('  Dit verschijnt in de emails die verstuurd worden.\n');

  const companyName = await ask('Bedrijfsnaam', existing.COMPANY_NAME || 'Richfield Distribution');
  const companyDesc = await ask('Bedrijfsomschrijving', existing.COMPANY_DESCRIPTION || 'Global polyethylene resin distribution - LLDPE, LDPE, HDPE');
  const salesTitle = await ask('Je functietitel', existing.SALES_PERSON_TITLE || 'Sales Manager');

  // ── STAP 3: OpenAI (optioneel) ─────────────────────
  console.log('\n  ── STAP 3/4: OpenAI API Key (optioneel) ────');
  console.log('  Met een OpenAI key genereert de agent gepersonaliseerde emails.');
  console.log('  Zonder key wordt een standaard template gebruikt - ook prima.\n');

  const openaiKey = await ask('OpenAI API key (Enter = overslaan)', existing.OPENAI_API_KEY);

  // ── STAP 4: Reminder instellingen ──────────────────
  console.log('\n  ── STAP 4/4: Reminder Instellingen ─────────');
  console.log('  Na hoeveel uur moet een reminder verstuurd worden?\n');

  const unopenedHours = await ask('Uren wachten als email NIET geopend', existing.REMINDER_UNOPENED_AFTER_HOURS || '48');
  const noReplyHours = await ask('Uren wachten als WEL geopend maar NIET beantwoord', existing.REMINDER_OPENED_NO_REPLY_AFTER_HOURS || '72');
  const maxReminders = await ask('Max aantal reminders per klant', existing.MAX_REMINDERS || '2');
  const autoReply = await ask('Auto-reply bij klant antwoord? (true/false)', existing.AUTO_REPLY_ENABLED || 'false');

  // ── SCHRIJF .env ──────────────────────────────────
  const envContent = `# ===========================================
# AI Sales Email Tracker - Configuratie
# Gegenereerd op ${new Date().toISOString().split('T')[0]}
# ===========================================

# --- OpenAI (optioneel - voor AI-gegenereerde emails) ---
OPENAI_API_KEY=${openaiKey || 'sk-...'}

# --- SMTP Email Configuratie (Outlook) ---
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=${email}
SMTP_PASS=${password}
EMAIL_FROM_NAME=${fromName}
EMAIL_FROM_ADDRESS=${email}

# --- IMAP Inbox Monitoring (Outlook) ---
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
IMAP_USER=${email}
IMAP_PASS=${password}

# --- Tracking Server ---
TRACKING_URL=http://localhost:3001/track

# --- Bedrijfsinformatie ---
COMPANY_NAME=${companyName}
COMPANY_DESCRIPTION=${companyDesc}
SALES_PERSON_NAME=${fromName}
SALES_PERSON_TITLE=${salesTitle}

# --- Reminder Instellingen ---
REMINDER_UNOPENED_AFTER_HOURS=${unopenedHours}
REMINDER_OPENED_NO_REPLY_AFTER_HOURS=${noReplyHours}
MAX_REMINDERS=${maxReminders}

# --- Auto-Reply ---
AUTO_REPLY_ENABLED=${autoReply}
`;

  fs.writeFileSync(envPath, envContent);
  console.log('\n  .env bestand opgeslagen!');

  // ── MAAK DATA MAP AAN ──────────────────────────────
  const dataDir = path.resolve(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    console.log('  Excel templates aanmaken...');
    try {
      require('./setup');
      // Wacht even tot setup klaar is
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch {
      console.log('  Voer apart uit: npm run setup');
    }
  }

  // ── TEST VERBINDING ────────────────────────────────
  console.log('\n  ── VERBINDING TESTEN ──────────────────────');

  if (email && password && !email.includes('jouw-')) {
    console.log('  SMTP verbinding testen...');
    try {
      // Herlaad config met nieuwe .env
      delete require.cache[require.resolve('./config')];
      require('dotenv').config({ path: envPath, override: true });
      const nodemailer = require('nodemailer');

      const transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: { user: email, pass: password },
        tls: { ciphers: 'SSLv3', rejectUnauthorized: false },
      });

      await transporter.verify();
      console.log('  SMTP: Verbinding gelukt!\n');
    } catch (err) {
      console.log('  SMTP: Verbinding mislukt - ' + err.message);
      console.log('  Controleer je email en wachtwoord.');
      console.log('  Tip: Mogelijk moet je een App Password aanmaken in Outlook.\n');
    }
  } else {
    console.log('  Overgeslagen (geen credentials ingevuld).\n');
  }

  // ── SAMENVATTING ──────────────────────────────────
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   CONFIGURATIE VOLTOOID!                     ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log('  ║                                              ║');
  console.log('  ║   Wat nu?                                    ║');
  console.log('  ║                                              ║');
  console.log('  ║   1. Vervang data/producten.xlsx door je     ║');
  console.log('  ║      eigen prijsmatrix Excel                 ║');
  console.log('  ║                                              ║');
  console.log('  ║   2. Vervang data/contacten.xlsx door je     ║');
  console.log('  ║      eigen klanten Excel                     ║');
  console.log('  ║                                              ║');
  console.log('  ║   3. Start de agent:                         ║');
  console.log('  ║      npm start                               ║');
  console.log('  ║                                              ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  rl.close();
}

configure().catch((err) => {
  console.error('\n  Fout:', err.message);
  rl.close();
  process.exit(1);
});
