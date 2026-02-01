const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/**
 * Setup script - maakt template Excel bestanden aan
 * Voer uit: npm run setup
 */
async function setup() {
  console.log('\n=== AI Sales Email Tracker - Setup ===\n');

  const dataDir = path.resolve(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Map "data/" aangemaakt.');
  }

  await createProductTemplate(dataDir);
  await createContactTemplate(dataDir);
  await createTrackingTemplate(dataDir);

  console.log('\n=== Setup voltooid! ===');
  console.log('\nVolgende stappen:');
  console.log('1. Vul data/producten.xlsx met je producten en prijzen');
  console.log('2. Vul data/contacten.xlsx met je contacten/leads');
  console.log('3. Kopieer .env.example naar .env en vul je gegevens in');
  console.log('4. Start de agent met: npm start\n');
}

async function createProductTemplate(dataDir) {
  const filePath = path.join(dataDir, 'producten.xlsx');

  if (fs.existsSync(filePath)) {
    console.log('producten.xlsx bestaat al, overslaan.');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Producten');

  ws.columns = [
    { header: 'Product', key: 'name', width: 25 },
    { header: 'Beschrijving', key: 'description', width: 40 },
    { header: 'Prijs', key: 'price', width: 12 },
    { header: 'Categorie', key: 'category', width: 18 },
    { header: 'Kenmerken', key: 'features', width: 40 },
  ];

  // Style header
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2E75B6' },
  };

  // Voorbeeld data
  ws.addRow({
    name: 'Website Pakket Basic',
    description: 'Professionele website met 5 paginas, responsive design',
    price: 1499,
    category: 'Websites',
    features: 'SEO-geoptimaliseerd, CMS, Contact formulier',
  });
  ws.addRow({
    name: 'Website Pakket Pro',
    description: 'Uitgebreide website met webshop integratie',
    price: 3499,
    category: 'Websites',
    features: 'Alles van Basic + Webshop, Betaalintegratie, Analytics',
  });
  ws.addRow({
    name: 'SEO Maandpakket',
    description: 'Maandelijkse SEO optimalisatie en rapportage',
    price: 499,
    category: 'Marketing',
    features: 'Keyword research, Content optimalisatie, Maandrapport',
  });
  ws.addRow({
    name: 'Social Media Beheer',
    description: 'Volledig beheer van social media kanalen',
    price: 799,
    category: 'Marketing',
    features: '3 platformen, 12 posts/maand, Community management',
  });
  ws.addRow({
    name: 'Email Marketing Setup',
    description: 'Email marketing systeem opzetten en eerste campagne',
    price: 999,
    category: 'Marketing',
    features: 'Template design, Lijst import, A/B testing, Automatisering',
  });

  await workbook.xlsx.writeFile(filePath);
  console.log('producten.xlsx aangemaakt met voorbeelddata.');
}

async function createContactTemplate(dataDir) {
  const filePath = path.join(dataDir, 'contacten.xlsx');

  if (fs.existsSync(filePath)) {
    console.log('contacten.xlsx bestaat al, overslaan.');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Contacten');

  ws.columns = [
    { header: 'Naam', key: 'name', width: 22 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Bedrijf', key: 'company', width: 22 },
    { header: 'Functie', key: 'title', width: 22 },
    { header: 'Branche', key: 'industry', width: 18 },
    { header: 'Notities', key: 'notes', width: 35 },
    { header: 'Land', key: 'country', width: 8 },
    { header: 'Taal', key: 'language', width: 8 },
  ];

  // Style header
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF548235' },
  };

  // Voorbeeld data
  ws.addRow({
    name: 'Jan Bakker',
    email: 'jan@voorbeeldbedrijf.nl',
    company: 'Voorbeeld BV',
    title: 'Marketing Manager',
    industry: 'Retail',
    notes: 'Geinteresseerd in online marketing',
    country: 'NL',
    language: 'nl',
  });
  ws.addRow({
    name: 'Lisa de Vries',
    email: 'lisa@techstartup.nl',
    company: 'TechStartup BV',
    title: 'CEO',
    industry: 'Technologie',
    notes: 'Heeft nog geen website',
    country: 'NL',
    language: 'nl',
  });
  ws.addRow({
    name: 'Peter Jansen',
    email: 'peter@groothandel.nl',
    company: 'Groothandel Plus',
    title: 'Directeur',
    industry: 'Groothandel',
    notes: 'Zoekt webshop oplossing',
    country: 'NL',
    language: 'nl',
  });

  await workbook.xlsx.writeFile(filePath);
  console.log('contacten.xlsx aangemaakt met voorbeelddata.');
}

async function createTrackingTemplate(dataDir) {
  const filePath = path.join(dataDir, 'tracking-log.xlsx');

  if (fs.existsSync(filePath)) {
    console.log('tracking-log.xlsx bestaat al, overslaan.');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Tracking');

  ws.columns = [
    { header: 'Tracking ID', key: 'trackingId', width: 40 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Contact', key: 'contactName', width: 20 },
    { header: 'Bedrijf', key: 'company', width: 20 },
    { header: 'Campagne', key: 'campaign', width: 20 },
    { header: 'Onderwerp', key: 'subject', width: 35 },
    { header: 'Verzonden', key: 'sentAt', width: 22 },
    { header: 'Opens', key: 'opens', width: 8 },
    { header: 'Eerste Open', key: 'firstOpenAt', width: 22 },
    { header: 'Laatste Open', key: 'lastOpenAt', width: 22 },
    { header: 'Reminders', key: 'remindersSent', width: 10 },
    { header: 'Laatste Reminder', key: 'lastReminderAt', width: 22 },
    { header: 'Status', key: 'status', width: 15 },
  ];

  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };

  await workbook.xlsx.writeFile(filePath);
  console.log('tracking-log.xlsx aangemaakt.');
}

// Start setup
setup().catch(console.error);
