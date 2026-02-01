const ExcelJS = require('exceljs');
const path = require('path');
const config = require('../config');

/**
 * Leest producten en prijzen uit de Excel sheet.
 * Verwacht kolommen: Product | Beschrijving | Prijs | Categorie
 */
async function readProducts(filePath) {
  const resolvedPath = path.resolve(filePath || config.files.products);
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(resolvedPath);
  } catch (err) {
    console.error(`Kan producten bestand niet lezen: ${resolvedPath}`);
    console.error('Tip: Voer eerst "npm run setup" uit om template bestanden aan te maken.');
    throw err;
  }

  const worksheet = workbook.getWorksheet('Producten') || workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Geen worksheet gevonden in producten bestand.');
  }

  const products = [];
  const headerRow = worksheet.getRow(1);
  const headers = {};

  // Map kolom headers (flexibel - zoekt op naam)
  headerRow.eachCell((cell, colNumber) => {
    const val = (cell.value || '').toString().toLowerCase().trim();
    if (val.includes('product') || val.includes('naam')) headers.name = colNumber;
    if (val.includes('beschrijving') || val.includes('description')) headers.description = colNumber;
    if (val.includes('prijs') || val.includes('price') || val.includes('bedrag')) headers.price = colNumber;
    if (val.includes('categorie') || val.includes('category')) headers.category = colNumber;
    if (val.includes('kenmerken') || val.includes('features')) headers.features = colNumber;
  });

  // Fallback als headers niet gevonden
  if (!headers.name) headers.name = 1;
  if (!headers.description) headers.description = 2;
  if (!headers.price) headers.price = 3;
  if (!headers.category) headers.category = 4;

  // Lees data rijen (skip header)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const name = row.getCell(headers.name).value;
    if (!name) return; // skip lege rijen

    products.push({
      name: String(name).trim(),
      description: String(row.getCell(headers.description).value || '').trim(),
      price: parsePrice(row.getCell(headers.price).value),
      category: String(row.getCell(headers.category).value || 'Algemeen').trim(),
      features: String(row.getCell(headers.features || 5).value || '').trim(),
    });
  });

  console.log(`${products.length} producten geladen uit ${resolvedPath}`);
  return products;
}

/**
 * Parse prijs uit verschillende formaten
 */
function parsePrice(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).replace(/[€$\s]/g, '').replace(',', '.');
  return parseFloat(str) || 0;
}

/**
 * Formatteer prijs als EUR string
 */
function formatPrice(price) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

/**
 * Maak een leesbare productenlijst voor in emails
 */
function formatProductList(products) {
  return products
    .map((p) => `• ${p.name} - ${formatPrice(p.price)}${p.description ? ': ' + p.description : ''}`)
    .join('\n');
}

module.exports = { readProducts, formatPrice, formatProductList };
