const config = require('./config');
const { readProducts, formatProductList } = require('./excel/productReader');
const { readContacts } = require('./excel/contactReader');
const { initTrackingLog, saveToExcel, printDashboard, getAllRecords } = require('./excel/trackingLog');
const { generateSalesEmail } = require('./email/templateGenerator');
const { sendTrackedEmail, testConnection } = require('./email/sender');
const { processReminders, showReminderCandidates } = require('./reminder/reminderService');
const { startServer } = require('./tracking/server');

/**
 * AI Sales Email Agent - Hoofdprogramma
 *
 * Commando's:
 *   npm start          - Interactief menu
 *   npm run send       - Stuur emails naar alle contacten
 *   npm run check      - Bekijk tracking status
 *   npm run remind     - Stuur reminders voor ongeopende emails
 *   npm run dashboard  - Toon dashboard
 *   npm run server     - Start tracking server
 *   npm run setup      - Maak template Excel bestanden
 */

const args = process.argv.slice(2);

async function main() {
  console.log('\n========================================');
  console.log('   AI SALES EMAIL AGENT');
  console.log(`   ${config.company.name}`);
  console.log('========================================\n');

  // Initialiseer tracking log
  await initTrackingLog();

  // Parse command line argumenten
  if (args.includes('--send')) {
    await runSendCampaign();
  } else if (args.includes('--check') || args.includes('--dashboard')) {
    await runDashboard();
  } else if (args.includes('--remind')) {
    await runReminders();
  } else if (args.includes('--server')) {
    await startServer();
  } else {
    await runInteractive();
  }
}

/**
 * Interactief menu
 */
async function runInteractive() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (q) => new Promise((resolve) => rl.question(q, resolve));

  let running = true;

  while (running) {
    console.log('\n--- MENU ---');
    console.log('1. Email campagne versturen');
    console.log('2. Tracking dashboard bekijken');
    console.log('3. Reminders versturen');
    console.log('4. Tracking server starten');
    console.log('5. SMTP verbinding testen');
    console.log('6. Producten bekijken');
    console.log('7. Contacten bekijken');
    console.log('8. Opslaan naar Excel');
    console.log('9. Afsluiten');
    console.log('');

    const choice = await question('Keuze (1-9): ');

    switch (choice.trim()) {
      case '1':
        await runSendCampaign(question);
        break;
      case '2':
        await runDashboard();
        break;
      case '3':
        await runReminders();
        break;
      case '4':
        console.log('\nTracking server starten...');
        console.log('(Druk Ctrl+C om te stoppen)\n');
        await startServer();
        running = false;
        break;
      case '5':
        await testConnection();
        break;
      case '6':
        await showProducts();
        break;
      case '7':
        await showContacts();
        break;
      case '8':
        await saveToExcel();
        console.log('Tracking data opgeslagen naar Excel.');
        break;
      case '9':
        await saveToExcel();
        console.log('Data opgeslagen. Tot ziens!');
        running = false;
        rl.close();
        break;
      default:
        console.log('Ongeldige keuze.');
    }
  }
}

/**
 * Stuur email campagne naar alle contacten
 */
async function runSendCampaign(questionFn) {
  console.log('\n--- EMAIL CAMPAGNE VERSTUREN ---\n');

  // Laad data
  let products, contacts;
  try {
    products = await readProducts();
    contacts = await readContacts();
  } catch (err) {
    console.error('Fout bij laden data:', err.message);
    console.log('Tip: Voer "npm run setup" uit om template bestanden aan te maken.');
    return;
  }

  if (products.length === 0) {
    console.error('Geen producten gevonden. Vul eerst data/producten.xlsx in.');
    return;
  }
  if (contacts.length === 0) {
    console.error('Geen contacten gevonden. Vul eerst data/contacten.xlsx in.');
    return;
  }

  console.log(`Producten geladen: ${products.length}`);
  console.log(`Contacten geladen: ${contacts.length}`);

  // Campagne naam
  let campaign = 'introductie';
  if (questionFn) {
    const input = await questionFn(`\nCampagne naam (Enter voor "${campaign}"): `);
    if (input.trim()) campaign = input.trim();
  }

  // Bevestiging
  if (questionFn) {
    const confirm = await questionFn(
      `\nVerstuur emails naar ${contacts.length} contacten? (ja/nee): `
    );
    if (confirm.toLowerCase() !== 'ja' && confirm.toLowerCase() !== 'j') {
      console.log('Campagne geannuleerd.');
      return;
    }
  }

  console.log(`\nStart campagne "${campaign}" naar ${contacts.length} contacten...\n`);

  const results = { sent: 0, failed: 0 };

  for (const contact of contacts) {
    console.log(`\nVoorbereiden email voor ${contact.name} (${contact.email})...`);

    try {
      // Genereer gepersonaliseerde email met AI
      const emailContent = await generateSalesEmail(contact, products, {
        campaign,
      });

      console.log(`  Onderwerp: ${emailContent.subject}`);

      // Verstuur met tracking
      const result = await sendTrackedEmail(contact, emailContent, { campaign });

      if (result.success) {
        results.sent++;
        console.log(`  Verstuurd! (Tracking ID: ${result.trackingId})`);
      } else {
        results.failed++;
        console.log(`  MISLUKT: ${result.error}`);
      }
    } catch (error) {
      results.failed++;
      console.error(`  FOUT: ${error.message}`);
    }

    // Pauze tussen emails (rate limiting / deliverability)
    await sleep(3000);
  }

  // Opslaan
  await saveToExcel();

  console.log('\n--- CAMPAGNE RESULTATEN ---');
  console.log(`Verstuurd: ${results.sent}`);
  console.log(`Mislukt:   ${results.failed}`);
  console.log(`Totaal:    ${contacts.length}`);
  console.log('Tracking data opgeslagen naar Excel.\n');
}

/**
 * Toon tracking dashboard
 */
async function runDashboard() {
  printDashboard();
}

/**
 * Stuur reminders
 */
async function runReminders() {
  console.log('\n--- REMINDERS VERWERKEN ---\n');

  const candidates = showReminderCandidates();
  if (candidates.length === 0) return;

  let products, contacts;
  try {
    products = await readProducts();
    contacts = await readContacts();
  } catch (err) {
    console.error('Fout bij laden data:', err.message);
    return;
  }

  const results = await processReminders(contacts, products);
  await saveToExcel();

  console.log('\nTracking data opgeslagen.');
}

/**
 * Toon producten
 */
async function showProducts() {
  try {
    const products = await readProducts();
    console.log('\n--- PRODUCTEN ---');
    console.log(formatProductList(products));
  } catch (err) {
    console.error('Fout:', err.message);
  }
}

/**
 * Toon contacten
 */
async function showContacts() {
  try {
    const contacts = await readContacts();
    console.log('\n--- CONTACTEN ---');
    contacts.forEach((c) => {
      console.log(`  ${c.name.padEnd(20)} | ${c.email.padEnd(30)} | ${c.company.padEnd(20)} | ${c.title}`);
    });
  } catch (err) {
    console.error('Fout:', err.message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start
main().catch((err) => {
  console.error('Fatale fout:', err);
  process.exit(1);
});
