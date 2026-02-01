const ExcelJS = require('exceljs');
const path = require('path');
const config = require('../config');

/**
 * Leest de prijsmatrix uit de Excel sheet.
 *
 * Verwacht formaat:
 *   CONTINENT | COUNTRY | POD | Product1 | Product2 | ...
 *   Africa    | Kenya   | Mombasa | $1,035 | $1,057 | ...
 *
 * Retourneert:
 *   {
 *     productNames: ['LLDPE BUTENE (Q118N, Q118A)', ...],
 *     rows: [ { continent, country, pod, prices: { 'LLDPE BUTENE (Q118N, Q118A)': 1035, ... } } ],
 *   }
 */
async function readPriceMatrix(filePath) {
  const resolvedPath = path.resolve(filePath || config.files.products);
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(resolvedPath);
  } catch (err) {
    console.error(`  Kan prijslijst bestand niet lezen: ${resolvedPath}`);
    throw err;
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Geen worksheet gevonden in prijslijst bestand.');
  }

  // Lees header rij om product kolommen te vinden
  const headerRow = worksheet.getRow(1);
  const locationCols = {}; // continent, country, pod kolommen
  const productCols = [];  // [ { colNumber, name } ]

  headerRow.eachCell((cell, colNumber) => {
    const val = (cell.value || '').toString().trim();
    const lower = val.toLowerCase();

    if (lower.includes('continent')) {
      locationCols.continent = colNumber;
    } else if (lower.includes('country') || lower.includes('land')) {
      locationCols.country = colNumber;
    } else if (lower === 'pod') {
      locationCols.pod = colNumber;
    } else if (val && !lower.includes('no') && !lower.includes('#')) {
      // Alles wat geen locatie-kolom is = product kolom
      // Verwijder eventuele newlines uit de header naam
      const cleanName = val.replace(/\r?\n/g, ' ').trim();
      productCols.push({ colNumber, name: cleanName });
    }
  });

  // Fallbacks
  if (!locationCols.continent) locationCols.continent = 1;
  if (!locationCols.country) locationCols.country = 2;
  if (!locationCols.pod) locationCols.pod = 3;

  const productNames = productCols.map((p) => p.name);
  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const pod = String(row.getCell(locationCols.pod).value || '').trim();
    if (!pod) return;

    const prices = {};
    for (const pc of productCols) {
      prices[pc.name] = parsePrice(row.getCell(pc.colNumber).value);
    }

    rows.push({
      continent: String(row.getCell(locationCols.continent).value || '').trim(),
      country: String(row.getCell(locationCols.country).value || '').trim(),
      pod,
      prices,
    });
  });

  console.log(`  ${rows.length} prijsregels geladen, ${productNames.length} producten: ${resolvedPath}`);
  return { productNames, rows };
}

/**
 * Zoek prijzen voor een specifiek contact op basis van POD/Country/Continent.
 * Lookup volgorde: exacte POD match > country match > continent match
 */
function lookupPricesForContact(priceMatrix, contact) {
  const { rows, productNames } = priceMatrix;

  const podNorm = normalize(contact.pod);
  const countryNorm = normalize(contact.country);
  const continentNorm = normalize(contact.continent);

  // 1. Exacte POD match
  let match = rows.find((r) => normalize(r.pod) === podNorm);

  // 2. Country match (eerste POD in dat land)
  if (!match && countryNorm) {
    match = rows.find((r) => normalize(r.country) === countryNorm);
  }

  // 3. Continent match (eerste POD in dat continent)
  if (!match && continentNorm) {
    match = rows.find((r) => normalize(r.continent) === continentNorm);
  }

  if (!match) return null;

  return {
    continent: match.continent,
    country: match.country,
    pod: match.pod,
    productNames,
    prices: match.prices,
  };
}

/**
 * Formatteer prijzen als tabel voor in email (plain text)
 */
function formatPriceTable(pricing) {
  if (!pricing) return '  Prijzen op aanvraag.';

  let table = `  Prijzen C&F ${pricing.pod}, ${pricing.country}:\n\n`;
  for (const name of pricing.productNames) {
    const price = pricing.prices[name];
    if (price > 0) {
      table += `  ${name.padEnd(40)} ${formatPrice(price)}\n`;
    }
  }
  return table;
}

/**
 * Formatteer prijzen als HTML tabel
 */
function formatPriceTableHtml(pricing) {
  if (!pricing) return '<p><em>Prices on request.</em></p>';

  let html = '<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">';
  html += '<thead><tr style="background-color:#2E75B6;color:white;">';
  html += '<th style="padding:8px 12px;text-align:left;border:1px solid #ddd;">Product</th>';
  html += '<th style="padding:8px 12px;text-align:right;border:1px solid #ddd;">Price (USD/MT)</th>';
  html += '</tr></thead><tbody>';

  let odd = true;
  for (const name of pricing.productNames) {
    const price = pricing.prices[name];
    if (price > 0) {
      const bg = odd ? '#f2f7fc' : '#ffffff';
      html += `<tr style="background-color:${bg};">`;
      html += `<td style="padding:8px 12px;border:1px solid #ddd;">${name}</td>`;
      html += `<td style="padding:8px 12px;text-align:right;border:1px solid #ddd;">${formatPrice(price)}</td>`;
      html += '</tr>';
      odd = !odd;
    }
  }

  html += '</tbody></table>';
  return html;
}

/**
 * Geeft een samenvatting van het aantal producten en unieke PODs
 */
function summarizePriceMatrix(priceMatrix) {
  const pods = new Set(priceMatrix.rows.map((r) => r.pod));
  const countries = new Set(priceMatrix.rows.map((r) => r.country));
  return {
    products: priceMatrix.productNames.length,
    pods: pods.size,
    countries: countries.size,
    rows: priceMatrix.rows.length,
  };
}

function parsePrice(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  // Verwijder $, spaties, komma's als duizendtal scheidingsteken
  const str = String(value).replace(/[$€\s]/g, '').replace(/,/g, '');
  return parseFloat(str) || 0;
}

function formatPrice(price) {
  if (!price || price === 0) return '-';
  return '$' + Number(price).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function normalize(str) {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

module.exports = {
  readPriceMatrix,
  lookupPricesForContact,
  formatPriceTable,
  formatPriceTableHtml,
  formatPrice,
  summarizePriceMatrix,
};
