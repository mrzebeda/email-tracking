const fs = require('fs');
const path = require('path');
const config = require('./config');
const { printConfigStatus, canSendEmails, hasAI } = require('./config');
const { readPriceMatrix, lookupPricesForContact, formatPrice, formatPriceTable, summarizePriceMatrix } = require('./excel/productReader');
const { readContacts } = require('./excel/contactReader');
const { initTrackingLog, saveToExcel, printDashboard, getAllRecords } = require('./excel/trackingLog');
const { generateSalesEmail, generateFallbackEmail } = require('./email/templateGenerator');
const { sendTrackedEmail, testConnection } = require('./email/sender');
const { processReminders, showReminderCandidates } = require('./reminder/reminderService');
const { startServer } = require('./tracking/server');

const args = process.argv.slice(2);

// Cache voor geladen data
let cachedPriceMatrix = null;
let cachedContacts = null;

// ─────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────

async function main() {
  printBanner();
  await initTrackingLog();

  if (args.includes('--send'))      return await runSendCampaign();
  if (args.includes('--check'))     return await runDashboard();
  if (args.includes('--dashboard')) return await runDashboard();
  if (args.includes('--remind'))    return await runReminders();
  if (args.includes('--server'))    return await startServer();
  if (args.includes('--status'))    return printConfigStatus();

  await runInteractive();
}

function printBanner() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║        AI SALES EMAIL AGENT              ║');
  console.log(`  ║  ${config.company.name.substring(0, 40).padEnd(40)}║`);
  console.log('  ╚══════════════════════════════════════════╝');
}

// ─────────────────────────────────────────────────────────
//  INTERACTIVE MENU
// ─────────────────────────────────────────────────────────

async function runInteractive() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  const { allRequiredOk } = printConfigStatus();

  if (!allRequiredOk) {
    console.log('\n  Wil je eerst de configuratie doorlopen? (aanbevolen)');
    const answer = await ask('  [j/n]: ');
    if (answer.trim().toLowerCase() !== 'n') {
      await runConfigWizard(ask);
    }
  }

  let running = true;
  while (running) {
    const records = getAllRecords();
    const opened = records.filter((r) => r.opens > 0).length;

    console.log('');
    console.log('  ┌──────────────────────────────────────┐');
    console.log('  │           HOOFDMENU                   │');
    console.log('  ├──────────────────────────────────────┤');
    console.log('  │                                      │');
    console.log('  │  1.  Nieuwe campagne versturen       │');
    console.log('  │  2.  Tracking dashboard              │');
    console.log('  │  3.  Reminders versturen             │');
    console.log('  │  4.  Prijslijst bekijken / laden     │');
    console.log('  │  5.  Klanten bekijken / laden        │');
    console.log('  │  6.  SMTP verbinding testen          │');
    console.log('  │  7.  Tracking server starten         │');
    console.log('  │  8.  Configuratie bekijken           │');
    console.log('  │  9.  Afsluiten                       │');
    console.log('  │                                      │');
    console.log('  └──────────────────────────────────────┘');

    if (records.length > 0) {
      console.log(`  Emails: ${records.length} verzonden | ${opened} geopend | ${records.length - opened} wachten`);
    }

    const choice = await ask('\n  Keuze [1-9]: ');

    switch (choice.trim()) {
      case '1': await runSendCampaign(ask); break;
      case '2': await runDashboard(); break;
      case '3': await runReminders(ask); break;
      case '4': await runPriceManager(ask); break;
      case '5': await runContactManager(ask); break;
      case '6': await runSmtpTest(); break;
      case '7':
        console.log('\n  Tracking server starten... (Ctrl+C om te stoppen)');
        await startServer();
        running = false;
        break;
      case '8': printConfigStatus(); break;
      case '9':
        await saveToExcel();
        console.log('\n  Data opgeslagen. Tot ziens!\n');
        running = false;
        rl.close();
        break;
      default:
        console.log('  Ongeldige keuze, probeer opnieuw.');
    }
  }
}

// ─────────────────────────────────────────────────────────
//  CONFIGURATIE WIZARD
// ─────────────────────────────────────────────────────────

async function runConfigWizard(ask) {
  console.log('\n  ── CONFIGURATIE WIZARD ──────────────────');
  console.log('  We lopen alle stappen door.\n');

  const envPath = path.resolve(__dirname, '..', '.env');
  const envExamplePath = path.resolve(__dirname, '..', '.env.example');

  // Stap 1: .env
  if (!fs.existsSync(envPath)) {
    console.log('  Stap 1/4: .env bestand aanmaken');
    if (fs.existsSync(envExamplePath)) {
      const answer = await ask('  .env.example kopieren naar .env? [j/n]: ');
      if (answer.trim().toLowerCase() !== 'n') {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('  .env aangemaakt!');
      }
    }
  } else {
    console.log('  Stap 1/4: .env bestand gevonden [OK]');
  }

  // Stap 2: Excel bestanden
  console.log('\n  Stap 2/4: Excel bestanden');
  const productsPath = path.resolve(config.files.products);
  const contactsPath = path.resolve(config.files.contacts);

  if (!fs.existsSync(productsPath) || !fs.existsSync(contactsPath)) {
    const answer = await ask('  Voorbeeldbestanden aanmaken? [j/n]: ');
    if (answer.trim().toLowerCase() !== 'n') {
      try {
        require('./setup');
        await sleep(1000);
      } catch {
        console.log('  Voer apart uit: npm run setup');
      }
    }
  } else {
    console.log(`  Prijslijst:  ${productsPath} [OK]`);
    console.log(`  Klanten:     ${contactsPath} [OK]`);
  }

  // Stap 3: eigen Excel laden
  console.log('\n  Stap 3/4: Eigen Excel bestanden laden');
  console.log('  Je kunt je eigen prijslijst en klantenbestand laden.');

  const customProducts = await ask('  Pad naar prijslijst Excel (Enter = standaard): ');
  if (customProducts.trim()) {
    const resolved = path.resolve(customProducts.trim());
    if (fs.existsSync(resolved)) {
      config.files.products = resolved;
      console.log(`  Prijslijst: ${resolved}`);
    } else {
      console.log(`  Bestand niet gevonden: ${resolved}`);
    }
  }

  const customContacts = await ask('  Pad naar klanten Excel (Enter = standaard): ');
  if (customContacts.trim()) {
    const resolved = path.resolve(customContacts.trim());
    if (fs.existsSync(resolved)) {
      config.files.contacts = resolved;
      console.log(`  Klanten: ${resolved}`);
    } else {
      console.log(`  Bestand niet gevonden: ${resolved}`);
    }
  }

  // Stap 4: samenvatting
  console.log('\n  Stap 4/4: Samenvatting');
  console.log('  Open je .env bestand en vul minimaal in:\n');
  console.log('    SMTP_HOST=smtp.office365.com');
  console.log('    SMTP_PORT=587');
  console.log('    SMTP_USER=jouw-email@bedrijf.com');
  console.log('    SMTP_PASS=jouw-wachtwoord');
  console.log('    EMAIL_FROM_ADDRESS=jouw-email@bedrijf.com');
  console.log('    COMPANY_NAME=Richfield Distribution');
  console.log('    OPENAI_API_KEY=sk-...  (optioneel)\n');
  console.log('  Na het invullen, herstart met: npm start');
  console.log('  ── WIZARD VOLTOOID ─────────────────────\n');
}

// ─────────────────────────────────────────────────────────
//  SEND CAMPAIGN
// ─────────────────────────────────────────────────────────

async function runSendCampaign(ask) {
  console.log('\n  ── NIEUWE CAMPAGNE ─────────────────────\n');

  if (!canSendEmails()) {
    console.log('  SMTP is nog niet geconfigureerd.');
    console.log('  Vul SMTP_USER en SMTP_PASS in je .env bestand.\n');
    return;
  }

  // Laad prijsmatrix
  let priceMatrix;
  try {
    priceMatrix = cachedPriceMatrix || await readPriceMatrix();
    cachedPriceMatrix = priceMatrix;
  } catch {
    console.log('  Prijslijst niet gevonden of onleesbaar.');
    if (ask) {
      const p = await ask('  Pad naar prijslijst Excel (of Enter om te annuleren): ');
      if (!p.trim()) return;
      try { priceMatrix = await readPriceMatrix(p.trim()); cachedPriceMatrix = priceMatrix; } catch (e) { console.log(`  ${e.message}`); return; }
    } else return;
  }

  // Laad contacten
  let contacts;
  try {
    contacts = cachedContacts || await readContacts();
    cachedContacts = contacts;
  } catch {
    console.log('  Klantenbestand niet gevonden of onleesbaar.');
    if (ask) {
      const p = await ask('  Pad naar klanten Excel (of Enter om te annuleren): ');
      if (!p.trim()) return;
      try { contacts = await readContacts(p.trim()); cachedContacts = contacts; } catch (e) { console.log(`  ${e.message}`); return; }
    } else return;
  }

  if (contacts.length === 0) {
    console.log('  Geen klanten gevonden.\n');
    return;
  }

  const summary = summarizePriceMatrix(priceMatrix);
  console.log(`  Prijslijst:  ${summary.products} producten, ${summary.pods} PODs, ${summary.countries} landen`);
  console.log(`  Klanten:     ${contacts.length} geladen\n`);

  // Toon klanten met hun POD prijzen
  contacts.forEach((c) => {
    const pricing = lookupPricesForContact(priceMatrix, c);
    const status = c.emailSent ? ` [al verstuurd: ${c.emailSentDate}]` : '';
    const priceStatus = pricing ? 'prijzen gevonden' : 'GEEN PRIJZEN';
    console.log(`    ${String(c.no).padEnd(3)} ${c.company.padEnd(18)} ${c.name.padEnd(16)} ${c.pod.padEnd(14)} ${priceStatus}${status}`);
  });

  if (!ask) {
    await executeCampaign(contacts, priceMatrix, 'price-offer');
    return;
  }

  // Campagne naam
  let campaign = 'price-offer';
  const ci = await ask(`\n  Campagne naam (Enter = "${campaign}"): `);
  if (ci.trim()) campaign = ci.trim();

  // Selecteer klanten
  console.log('\n  Wie wil je mailen?');
  console.log('  a = Alle klanten');
  console.log('  n = Alleen klanten die nog niet gemaild zijn');
  console.log('  s = Selecteer individueel');
  const mode = await ask('  [a/n/s]: ');

  let selected = contacts;
  if (mode.trim().toLowerCase() === 'n') {
    selected = contacts.filter((c) => !c.emailSent || c.emailSent.toLowerCase() !== 'yes');
    console.log(`  ${selected.length} klant(en) nog niet gemaild.`);
  } else if (mode.trim().toLowerCase() === 's') {
    selected = [];
    for (const c of contacts) {
      const include = await ask(`  ${c.name} @ ${c.company} (${c.pod})? [j/n]: `);
      if (include.trim().toLowerCase() !== 'n') selected.push(c);
    }
  }

  if (selected.length === 0) {
    console.log('  Geen klanten geselecteerd.\n');
    return;
  }

  // Preview eerste email
  console.log('\n  Email preview genereren...');
  const previewContact = selected[0];
  const previewPricing = lookupPricesForContact(priceMatrix, previewContact);

  let previewEmail;
  try {
    if (hasAI()) {
      previewEmail = await generateSalesEmail(previewContact, previewPricing, { campaign });
    } else {
      console.log('  (Geen OpenAI key - standaard template wordt gebruikt)');
      previewEmail = generateFallbackEmail(previewContact, previewPricing);
    }

    console.log('\n  ┌── PREVIEW ──────────────────────────────────┐');
    console.log(`  │ Aan:       ${previewContact.email}`);
    console.log(`  │ Bedrijf:   ${previewContact.company} (${previewContact.pod})`);
    console.log(`  │ Onderwerp: ${previewEmail.subject}`);
    console.log('  ├─────────────────────────────────────────────┤');
    previewEmail.body.split('\n').forEach((line) => {
      while (line.length > 60) {
        console.log(`  │ ${line.substring(0, 60)}`);
        line = line.substring(60);
      }
      console.log(`  │ ${line}`);
    });
    console.log('  └─────────────────────────────────────────────┘');
  } catch (err) {
    console.log(`  Preview niet beschikbaar: ${err.message}`);
  }

  // Bevestiging
  console.log(`\n  Klaar om ${selected.length} email(s) te versturen.`);
  console.log(`  Campagne:  "${campaign}"`);
  console.log(`  Afzender:  ${config.smtp.fromName} <${config.smtp.fromAddress}>`);
  console.log(`  Tracking:  ${config.tracking.url}`);

  const confirm = await ask('\n  Doorgaan? [j/n]: ');
  if (confirm.trim().toLowerCase() !== 'j' && confirm.trim().toLowerCase() !== 'ja') {
    console.log('  Campagne geannuleerd.\n');
    return;
  }

  await executeCampaign(selected, priceMatrix, campaign);
}

async function executeCampaign(contacts, priceMatrix, campaign) {
  console.log(`\n  Campagne "${campaign}" gestart...\n`);

  const results = { sent: 0, failed: 0, noPrice: 0 };
  const total = contacts.length;

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const progress = `[${i + 1}/${total}]`;

    process.stdout.write(`  ${progress} ${contact.company.padEnd(18)} ${contact.pod.padEnd(14)} `);

    // Zoek prijzen voor deze klant
    const pricing = lookupPricesForContact(priceMatrix, contact);
    if (!pricing) {
      console.log('-> OVERGESLAGEN (geen prijzen voor POD)');
      results.noPrice++;
      continue;
    }

    try {
      let emailContent;
      if (hasAI()) {
        emailContent = await generateSalesEmail(contact, pricing, { campaign });
      } else {
        emailContent = generateFallbackEmail(contact, pricing);
      }

      const result = await sendTrackedEmail(contact, emailContent, { campaign });

      if (result.success) {
        results.sent++;
        console.log('-> Verstuurd');
      } else {
        results.failed++;
        console.log(`-> MISLUKT: ${result.error}`);
      }
    } catch (error) {
      results.failed++;
      console.log(`-> FOUT: ${error.message}`);
    }

    if (i < contacts.length - 1) await sleep(3000);
  }

  await saveToExcel();

  console.log('\n  ── RESULTATEN ──────────────────────────');
  console.log(`  Verstuurd:     ${results.sent} / ${total}`);
  if (results.failed > 0)  console.log(`  Mislukt:       ${results.failed}`);
  if (results.noPrice > 0) console.log(`  Geen prijzen:  ${results.noPrice}`);
  console.log('  Tracking data opgeslagen naar Excel.');
  console.log('  Email_Sent status bijgewerkt in klantenbestand.\n');
}

// ─────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────

async function runDashboard() {
  printDashboard();
  console.log('  Tip: Open data/tracking-log.xlsx voor het volledige overzicht.\n');
}

// ─────────────────────────────────────────────────────────
//  REMINDERS
// ─────────────────────────────────────────────────────────

async function runReminders(ask) {
  console.log('\n  ── REMINDERS ───────────────────────────\n');

  const candidates = showReminderCandidates();
  if (candidates.length === 0) return;

  if (ask) {
    const confirm = await ask(`\n  Reminders versturen naar ${candidates.length} contact(en)? [j/n]: `);
    if (confirm.trim().toLowerCase() !== 'j' && confirm.trim().toLowerCase() !== 'ja') {
      console.log('  Geannuleerd.\n');
      return;
    }
  }

  let priceMatrix, contacts;
  try {
    priceMatrix = cachedPriceMatrix || await readPriceMatrix();
    contacts = cachedContacts || await readContacts();
  } catch (err) {
    console.log(`  Fout bij laden data: ${err.message}`);
    return;
  }

  await processReminders(contacts, priceMatrix);
  await saveToExcel();
  console.log('  Tracking data opgeslagen.\n');
}

// ─────────────────────────────────────────────────────────
//  PRICE MANAGER
// ─────────────────────────────────────────────────────────

async function runPriceManager(ask) {
  console.log('\n  ── PRIJSLIJST ─────────────────────────\n');

  const currentPath = path.resolve(config.files.products);
  console.log(`  Huidig bestand: ${currentPath}`);

  try {
    const priceMatrix = await readPriceMatrix();
    cachedPriceMatrix = priceMatrix;
    const s = summarizePriceMatrix(priceMatrix);

    console.log(`  ${s.products} producten | ${s.pods} PODs | ${s.countries} landen | ${s.rows} prijsregels\n`);

    // Toon productnamen
    console.log('  Producten:');
    priceMatrix.productNames.forEach((name) => {
      console.log(`    - ${name}`);
    });

    // Toon eerste paar regels als preview
    console.log('\n  Preview (eerste 5 regels):');
    console.log('  ' + 'POD'.padEnd(18) + 'Country'.padEnd(16) + priceMatrix.productNames.map((n) => n.substring(0, 12).padEnd(13)).join(''));
    console.log('  ' + '-'.repeat(18 + 16 + priceMatrix.productNames.length * 13));

    priceMatrix.rows.slice(0, 5).forEach((r) => {
      let line = '  ' + r.pod.padEnd(18) + r.country.padEnd(16);
      priceMatrix.productNames.forEach((name) => {
        line += formatPrice(r.prices[name]).padEnd(13);
      });
      console.log(line);
    });
    if (priceMatrix.rows.length > 5) {
      console.log(`  ... en ${priceMatrix.rows.length - 5} meer regels`);
    }
  } catch {
    console.log('  Geen prijslijst gevonden.');
  }

  if (!ask) return;

  console.log('\n  Opties:');
  console.log('  1. Ander Excel bestand laden');
  console.log('  2. Info over verwacht formaat');
  console.log('  3. Terug naar menu');

  const choice = await ask('\n  [1/2/3]: ');

  if (choice.trim() === '1') {
    const newPath = await ask('  Pad naar prijslijst Excel (.xlsx): ');
    if (newPath.trim()) {
      const resolved = path.resolve(newPath.trim());
      if (fs.existsSync(resolved)) {
        config.files.products = resolved;
        try {
          const pm = await readPriceMatrix(resolved);
          cachedPriceMatrix = pm;
          const s = summarizePriceMatrix(pm);
          console.log(`\n  Geladen: ${s.products} producten, ${s.pods} PODs, ${s.countries} landen`);
        } catch (e) {
          console.log(`  Fout: ${e.message}`);
        }
      } else {
        console.log(`  Bestand niet gevonden: ${resolved}`);
      }
    }
  } else if (choice.trim() === '2') {
    console.log('\n  Verwacht Excel formaat (prijsmatrix):');
    console.log('  ┌───────────┬──────────┬──────────┬───────────┬───────────┬─────┐');
    console.log('  │ CONTINENT │ COUNTRY  │ POD      │ Product 1 │ Product 2 │ ... │');
    console.log('  ├───────────┼──────────┼──────────┼───────────┼───────────┼─────┤');
    console.log('  │ Europe    │ NL       │ Rotterdam│ $957      │ $979      │ ... │');
    console.log('  │ Asia      │ UAE      │ Jebel Ali│ $1,043    │ $1,066    │ ... │');
    console.log('  └───────────┴──────────┴──────────┴───────────┴───────────┴─────┘');
    console.log('  Kolom 1-3: locatie | Kolom 4+: productprijzen per POD');
  }
}

// ─────────────────────────────────────────────────────────
//  CONTACT MANAGER
// ─────────────────────────────────────────────────────────

async function runContactManager(ask) {
  console.log('\n  ── KLANTEN ────────────────────────────\n');

  const currentPath = path.resolve(config.files.contacts);
  console.log(`  Huidig bestand: ${currentPath}`);

  try {
    const contacts = await readContacts();
    cachedContacts = contacts;

    console.log(`  ${contacts.length} klant(en) geladen:\n`);
    console.log('  ' + 'No'.padEnd(4) + 'Company'.padEnd(18) + 'Name'.padEnd(16) + 'Country'.padEnd(14) + 'POD'.padEnd(14) + 'Incoterms'.padEnd(10) + 'Sent');
    console.log('  ' + '-'.repeat(86));
    contacts.forEach((c) => {
      const sent = c.emailSent && c.emailSent.toLowerCase() === 'yes' ? `Yes (${c.emailSentDate})` : '-';
      console.log(
        '  ' +
        String(c.no).padEnd(4) +
        c.company.substring(0, 17).padEnd(18) +
        c.name.substring(0, 15).padEnd(16) +
        c.country.substring(0, 13).padEnd(14) +
        c.pod.substring(0, 13).padEnd(14) +
        c.incoterms.padEnd(10) +
        sent
      );
    });
  } catch {
    console.log('  Geen klantenbestand gevonden.');
  }

  if (!ask) return;

  console.log('\n  Opties:');
  console.log('  1. Ander Excel bestand laden');
  console.log('  2. Info over verwacht formaat');
  console.log('  3. Terug naar menu');

  const choice = await ask('\n  [1/2/3]: ');

  if (choice.trim() === '1') {
    const newPath = await ask('  Pad naar klanten Excel (.xlsx): ');
    if (newPath.trim()) {
      const resolved = path.resolve(newPath.trim());
      if (fs.existsSync(resolved)) {
        config.files.contacts = resolved;
        try {
          const c = await readContacts(resolved);
          cachedContacts = c;
          console.log(`\n  ${c.length} klant(en) geladen uit ${resolved}`);
          c.forEach((ct) => console.log(`    - ${ct.name} @ ${ct.company} (${ct.pod})`));
        } catch (e) {
          console.log(`  Fout: ${e.message}`);
        }
      } else {
        console.log(`  Bestand niet gevonden: ${resolved}`);
      }
    }
  } else if (choice.trim() === '2') {
    console.log('\n  Verwacht Excel formaat (klanten):');
    console.log('  No | Company | Name | Country | POD | Continent | Incoterms | E-mail adress | Email_Sent | Email_Sent_Date | Email_Status');
  }
}

// ─────────────────────────────────────────────────────────
//  SMTP TEST
// ─────────────────────────────────────────────────────────

async function runSmtpTest() {
  console.log('\n  ── SMTP VERBINDING TESTEN ──────────────\n');

  if (!canSendEmails()) {
    console.log('  SMTP is niet geconfigureerd.');
    console.log('  Vul in je .env bestand:\n');
    console.log('    SMTP_HOST=smtp.office365.com');
    console.log('    SMTP_PORT=587');
    console.log('    SMTP_USER=jouw-email@bedrijf.com');
    console.log('    SMTP_PASS=jouw-wachtwoord\n');
    return;
  }

  console.log(`  Server: ${config.smtp.host}:${config.smtp.port}`);
  console.log(`  User:   ${config.smtp.user}`);
  console.log('  Verbinden...');

  const ok = await testConnection();
  if (ok) {
    console.log('\n  Verbinding geslaagd! Je kunt emails versturen.\n');
  } else {
    console.log('\n  Verbinding mislukt. Controleer:');
    console.log('  - Is SMTP_HOST correct? (Outlook: smtp.office365.com)');
    console.log('  - Is SMTP_PORT correct? (587)');
    console.log('  - Is het wachtwoord juist?');
    console.log('  - Is SMTP/POP ingeschakeld in je Outlook instellingen?');
    console.log('  - Staat MFA aan? Dan heb je mogelijk een App Password nodig.\n');
  }
}

// ─────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('\n  Fatale fout:', err.message || err);
  process.exit(1);
});
