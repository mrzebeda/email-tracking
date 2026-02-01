const fs = require('fs');
const path = require('path');
const config = require('./config');
const { printConfigStatus, canSendEmails, hasAI } = require('./config');
const { readProducts, formatProductList, formatPrice } = require('./excel/productReader');
const { readContacts } = require('./excel/contactReader');
const { initTrackingLog, saveToExcel, printDashboard, getAllRecords } = require('./excel/trackingLog');
const { generateSalesEmail, generateFallbackEmail } = require('./email/templateGenerator');
const { sendTrackedEmail, testConnection } = require('./email/sender');
const { processReminders, showReminderCandidates } = require('./reminder/reminderService');
const { startServer } = require('./tracking/server');

const args = process.argv.slice(2);

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

  // Check configuratie bij eerste start
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
    // Laad live stats
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
    console.log('  │  4.  Producten bekijken / wijzigen   │');
    console.log('  │  5.  Contacten bekijken / wijzigen   │');
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
      case '4': await runProductManager(ask); break;
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

  // Stap 1: .env bestand
  const envPath = path.resolve(__dirname, '..', '.env');
  const envExamplePath = path.resolve(__dirname, '..', '.env.example');

  if (!fs.existsSync(envPath)) {
    console.log('  Stap 1/4: .env bestand aanmaken');
    console.log('  Er is nog geen .env bestand.');

    if (fs.existsSync(envExamplePath)) {
      const answer = await ask('  .env.example kopieren naar .env? [j/n]: ');
      if (answer.trim().toLowerCase() !== 'n') {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('  .env aangemaakt! Open dit bestand en vul je gegevens in.');
      }
    } else {
      console.log('  Maak handmatig een .env bestand aan (zie .env.example).');
    }
  } else {
    console.log('  Stap 1/4: .env bestand gevonden [OK]');
  }

  // Stap 2: Excel bestanden
  console.log('');
  console.log('  Stap 2/4: Excel bestanden');

  const productsPath = path.resolve(config.files.products);
  const contactsPath = path.resolve(config.files.contacts);

  if (!fs.existsSync(productsPath) || !fs.existsSync(contactsPath)) {
    console.log('  Excel templates ontbreken.');
    const answer = await ask('  Voorbeeldbestanden aanmaken? [j/n]: ');
    if (answer.trim().toLowerCase() !== 'n') {
      try {
        require('./setup');
        await sleep(1000); // wacht op async setup
      } catch {
        console.log('  Voer apart uit: npm run setup');
      }
    }
  } else {
    console.log(`  Producten:  ${productsPath} [OK]`);
    console.log(`  Contacten:  ${contactsPath} [OK]`);
  }

  // Stap 3: eigen Excel laden
  console.log('');
  console.log('  Stap 3/4: Eigen Excel bestanden laden');
  console.log('  Wil je een ander Excel bestand gebruiken voor producten of contacten?');
  console.log('  (Je kunt dit ook later doen vanuit het menu)');

  const customProducts = await ask('  Pad naar producten Excel (Enter = standaard): ');
  if (customProducts.trim()) {
    const resolved = path.resolve(customProducts.trim());
    if (fs.existsSync(resolved)) {
      config.files.products = resolved;
      console.log(`  Producten bestand: ${resolved}`);
    } else {
      console.log(`  Bestand niet gevonden: ${resolved}`);
    }
  }

  const customContacts = await ask('  Pad naar contacten Excel (Enter = standaard): ');
  if (customContacts.trim()) {
    const resolved = path.resolve(customContacts.trim());
    if (fs.existsSync(resolved)) {
      config.files.contacts = resolved;
      console.log(`  Contacten bestand: ${resolved}`);
    } else {
      console.log(`  Bestand niet gevonden: ${resolved}`);
    }
  }

  // Stap 4: samenvatting
  console.log('');
  console.log('  Stap 4/4: Samenvatting');
  console.log('  Open je .env bestand en vul minimaal in:');
  console.log('');
  console.log('    SMTP_USER=jouw-email@gmail.com');
  console.log('    SMTP_PASS=jouw-app-wachtwoord');
  console.log('    COMPANY_NAME=Jouw Bedrijf');
  console.log('    OPENAI_API_KEY=sk-...  (optioneel, voor AI emails)');
  console.log('');
  console.log('  Na het invullen, herstart de agent met: npm start');
  console.log('  ── WIZARD VOLTOOID ─────────────────────\n');
}

// ─────────────────────────────────────────────────────────
//  SEND CAMPAIGN
// ─────────────────────────────────────────────────────────

async function runSendCampaign(ask) {
  console.log('\n  ── NIEUWE CAMPAGNE ─────────────────────\n');

  // Check configuratie
  if (!canSendEmails()) {
    console.log('  SMTP is nog niet geconfigureerd.');
    console.log('  Vul SMTP_USER en SMTP_PASS in je .env bestand.');
    console.log('  Kies optie 8 in het menu om de configuratie te bekijken.\n');
    return;
  }

  // Laad producten
  let products;
  try {
    products = await readProducts();
  } catch {
    console.log('  Producten bestand niet gevonden of onleesbaar.');
    if (ask) {
      const customPath = await ask('  Pad naar producten Excel (of Enter om te annuleren): ');
      if (!customPath.trim()) return;
      try {
        products = await readProducts(customPath.trim());
      } catch (e) {
        console.log(`  Kan bestand niet laden: ${e.message}`);
        return;
      }
    } else {
      return;
    }
  }

  if (products.length === 0) {
    console.log('  Geen producten gevonden in het bestand.');
    console.log('  Voeg producten toe aan data/producten.xlsx\n');
    return;
  }

  // Laad contacten
  let contacts;
  try {
    contacts = await readContacts();
  } catch {
    console.log('  Contacten bestand niet gevonden of onleesbaar.');
    if (ask) {
      const customPath = await ask('  Pad naar contacten Excel (of Enter om te annuleren): ');
      if (!customPath.trim()) return;
      try {
        contacts = await readContacts(customPath.trim());
      } catch (e) {
        console.log(`  Kan bestand niet laden: ${e.message}`);
        return;
      }
    } else {
      return;
    }
  }

  if (contacts.length === 0) {
    console.log('  Geen contacten gevonden in het bestand.');
    console.log('  Voeg contacten toe aan data/contacten.xlsx\n');
    return;
  }

  // Toon overzicht
  console.log(`  Producten:  ${products.length} geladen`);
  products.forEach((p) => {
    console.log(`    - ${p.name} (${formatPrice(p.price)})`);
  });

  console.log(`\n  Contacten:  ${contacts.length} geladen`);
  contacts.forEach((c) => {
    console.log(`    - ${c.name} <${c.email}> @ ${c.company}`);
  });

  if (!ask) {
    // Non-interactive mode
    await executeCampaign(contacts, products, 'introductie');
    return;
  }

  // Campagne naam
  let campaign = 'introductie';
  const campaignInput = await ask(`\n  Campagne naam (Enter = "${campaign}"): `);
  if (campaignInput.trim()) campaign = campaignInput.trim();

  // Selecteer contacten
  console.log('\n  Wie wil je mailen?');
  console.log('  a = Alle contacten');
  console.log('  s = Selecteer individueel');
  const selectMode = await ask('  [a/s]: ');

  let selectedContacts = contacts;
  if (selectMode.trim().toLowerCase() === 's') {
    selectedContacts = [];
    for (const c of contacts) {
      const include = await ask(`  ${c.name} (${c.email})? [j/n]: `);
      if (include.trim().toLowerCase() !== 'n') {
        selectedContacts.push(c);
      }
    }
  }

  if (selectedContacts.length === 0) {
    console.log('  Geen contacten geselecteerd. Campagne geannuleerd.\n');
    return;
  }

  // Preview eerste email
  console.log('\n  Email preview genereren...');
  const previewContact = selectedContacts[0];
  let previewEmail;
  try {
    if (hasAI()) {
      previewEmail = await generateSalesEmail(previewContact, products, { campaign });
    } else {
      console.log('  (Geen OpenAI key - standaard template wordt gebruikt)');
      previewEmail = generateFallbackEmail(previewContact, products, previewContact.language || 'nl');
    }

    console.log('\n  ┌── PREVIEW ──────────────────────────┐');
    console.log(`  │ Aan:      ${previewContact.email}`);
    console.log(`  │ Onderwerp: ${previewEmail.subject}`);
    console.log('  ├───────────────────────────────────────┤');
    // Toon body in blokken van ~60 tekens
    const lines = previewEmail.body.split('\n');
    lines.forEach((line) => {
      // Wrap lange regels
      while (line.length > 55) {
        console.log(`  │ ${line.substring(0, 55)}`);
        line = line.substring(55);
      }
      console.log(`  │ ${line}`);
    });
    console.log('  └───────────────────────────────────────┘');
  } catch (err) {
    console.log(`  Preview niet beschikbaar: ${err.message}`);
  }

  // Bevestiging
  console.log(`\n  Klaar om ${selectedContacts.length} email(s) te versturen.`);
  console.log(`  Campagne: "${campaign}"`);
  console.log(`  Afzender: ${config.smtp.fromName} <${config.smtp.fromAddress}>`);
  console.log(`  Tracking: ${config.tracking.url}`);

  const confirm = await ask('\n  Doorgaan? [j/n]: ');
  if (confirm.trim().toLowerCase() !== 'j' && confirm.trim().toLowerCase() !== 'ja') {
    console.log('  Campagne geannuleerd.\n');
    return;
  }

  await executeCampaign(selectedContacts, products, campaign);
}

async function executeCampaign(contacts, products, campaign) {
  console.log(`\n  Campagne "${campaign}" gestart...\n`);

  const results = { sent: 0, failed: 0 };
  const total = contacts.length;

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const progress = `[${i + 1}/${total}]`;

    process.stdout.write(`  ${progress} ${contact.name.padEnd(20)} `);

    try {
      let emailContent;
      if (hasAI()) {
        emailContent = await generateSalesEmail(contact, products, { campaign });
      } else {
        emailContent = generateFallbackEmail(contact, products, contact.language || 'nl');
      }

      const result = await sendTrackedEmail(contact, emailContent, { campaign });

      if (result.success) {
        results.sent++;
        console.log(`-> Verstuurd`);
      } else {
        results.failed++;
        console.log(`-> MISLUKT: ${result.error}`);
      }
    } catch (error) {
      results.failed++;
      console.log(`-> FOUT: ${error.message}`);
    }

    // Pauze tussen emails
    if (i < contacts.length - 1) await sleep(3000);
  }

  await saveToExcel();

  console.log('\n  ── RESULTATEN ──────────────────────────');
  console.log(`  Verstuurd:  ${results.sent} / ${total}`);
  if (results.failed > 0) {
    console.log(`  Mislukt:    ${results.failed}`);
  }
  console.log('  Tracking data opgeslagen naar Excel.');
  console.log('  Start de tracking server (optie 7) om opens te registreren.\n');
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

  let products, contacts;
  try {
    products = await readProducts();
    contacts = await readContacts();
  } catch (err) {
    console.log(`  Fout bij laden data: ${err.message}`);
    return;
  }

  await processReminders(contacts, products);
  await saveToExcel();
  console.log('  Tracking data opgeslagen.\n');
}

// ─────────────────────────────────────────────────────────
//  PRODUCT MANAGER
// ─────────────────────────────────────────────────────────

async function runProductManager(ask) {
  console.log('\n  ── PRODUCTEN ───────────────────────────\n');

  const currentPath = path.resolve(config.files.products);
  console.log(`  Huidig bestand: ${currentPath}`);

  let products;
  try {
    products = await readProducts();
    console.log(`  ${products.length} product(en) geladen:\n`);

    // Tabel weergave
    console.log('  ' + 'Product'.padEnd(25) + 'Prijs'.padEnd(14) + 'Categorie'.padEnd(16) + 'Beschrijving');
    console.log('  ' + '-'.repeat(80));
    products.forEach((p) => {
      console.log(
        '  ' +
        p.name.substring(0, 24).padEnd(25) +
        formatPrice(p.price).padEnd(14) +
        p.category.substring(0, 15).padEnd(16) +
        p.description.substring(0, 30)
      );
    });
  } catch {
    console.log('  Geen producten bestand gevonden.');
  }

  if (!ask) return;

  console.log('\n  Opties:');
  console.log('  1. Ander Excel bestand laden');
  console.log('  2. Huidig bestand openen (in bestandsbeheer)');
  console.log('  3. Terug naar menu');

  const choice = await ask('\n  [1/2/3]: ');

  if (choice.trim() === '1') {
    const newPath = await ask('  Pad naar producten Excel (.xlsx): ');
    if (newPath.trim()) {
      const resolved = path.resolve(newPath.trim());
      if (fs.existsSync(resolved)) {
        config.files.products = resolved;
        try {
          const newProducts = await readProducts(resolved);
          console.log(`\n  ${newProducts.length} product(en) geladen uit ${resolved}`);
          newProducts.forEach((p) => {
            console.log(`    - ${p.name} (${formatPrice(p.price)})`);
          });
        } catch (e) {
          console.log(`  Fout bij lezen: ${e.message}`);
        }
      } else {
        console.log(`  Bestand niet gevonden: ${resolved}`);
      }
    }
  } else if (choice.trim() === '2') {
    console.log(`\n  Open dit bestand in Excel:`);
    console.log(`  ${currentPath}\n`);
    console.log('  Kolommen: Product | Beschrijving | Prijs | Categorie | Kenmerken');
    console.log('  Sla op en kies daarna opnieuw optie 4 om te herladen.');
  }
}

// ─────────────────────────────────────────────────────────
//  CONTACT MANAGER
// ─────────────────────────────────────────────────────────

async function runContactManager(ask) {
  console.log('\n  ── CONTACTEN ──────────────────────────\n');

  const currentPath = path.resolve(config.files.contacts);
  console.log(`  Huidig bestand: ${currentPath}`);

  let contacts;
  try {
    contacts = await readContacts();
    console.log(`  ${contacts.length} contact(en) geladen:\n`);

    console.log('  ' + 'Naam'.padEnd(20) + 'Email'.padEnd(30) + 'Bedrijf'.padEnd(20) + 'Functie');
    console.log('  ' + '-'.repeat(85));
    contacts.forEach((c) => {
      console.log(
        '  ' +
        c.name.substring(0, 19).padEnd(20) +
        c.email.substring(0, 29).padEnd(30) +
        c.company.substring(0, 19).padEnd(20) +
        c.title.substring(0, 20)
      );
    });
  } catch {
    console.log('  Geen contacten bestand gevonden.');
  }

  if (!ask) return;

  console.log('\n  Opties:');
  console.log('  1. Ander Excel bestand laden');
  console.log('  2. Huidig bestand openen (in bestandsbeheer)');
  console.log('  3. Terug naar menu');

  const choice = await ask('\n  [1/2/3]: ');

  if (choice.trim() === '1') {
    const newPath = await ask('  Pad naar contacten Excel (.xlsx): ');
    if (newPath.trim()) {
      const resolved = path.resolve(newPath.trim());
      if (fs.existsSync(resolved)) {
        config.files.contacts = resolved;
        try {
          const newContacts = await readContacts(resolved);
          console.log(`\n  ${newContacts.length} contact(en) geladen uit ${resolved}`);
          newContacts.forEach((c) => {
            console.log(`    - ${c.name} <${c.email}> @ ${c.company}`);
          });
        } catch (e) {
          console.log(`  Fout bij lezen: ${e.message}`);
        }
      } else {
        console.log(`  Bestand niet gevonden: ${resolved}`);
      }
    }
  } else if (choice.trim() === '2') {
    console.log(`\n  Open dit bestand in Excel:`);
    console.log(`  ${currentPath}\n`);
    console.log('  Kolommen: Naam | Email | Bedrijf | Functie | Branche | Notities | Land | Taal');
    console.log('  Sla op en kies daarna opnieuw optie 5 om te herladen.');
  }
}

// ─────────────────────────────────────────────────────────
//  SMTP TEST
// ─────────────────────────────────────────────────────────

async function runSmtpTest() {
  console.log('\n  ── SMTP VERBINDING TESTEN ──────────────\n');

  if (!canSendEmails()) {
    console.log('  SMTP is niet geconfigureerd.');
    console.log('  Vul in je .env bestand:');
    console.log('    SMTP_HOST=smtp.gmail.com');
    console.log('    SMTP_PORT=587');
    console.log('    SMTP_USER=jouw-email@gmail.com');
    console.log('    SMTP_PASS=jouw-app-wachtwoord\n');
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
    console.log('  - Is SMTP_HOST correct? (Gmail: smtp.gmail.com)');
    console.log('  - Is SMTP_PORT correct? (Gmail: 587)');
    console.log('  - Is SMTP_PASS een App Password? (niet je gewone wachtwoord)');
    console.log('  - Staat 2FA aan op je Google account?\n');
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
