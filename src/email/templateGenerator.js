const OpenAI = require('openai');
const config = require('../config');
const { formatPriceTable, formatPriceTableHtml, formatPrice } = require('../excel/productReader');

let openaiClient = null;

function getClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

/**
 * Genereer een gepersonaliseerde sales email met AI.
 * Bevat POD-specifieke prijzen voor het contact.
 */
async function generateSalesEmail(contact, pricing, options = {}) {
  const { campaign = 'price-offer' } = options;

  const priceLines = [];
  if (pricing) {
    for (const name of pricing.productNames) {
      const price = pricing.prices[name];
      if (price > 0) priceLines.push(`- ${name}: ${formatPrice(price)} /MT`);
    }
  }

  const prompt = `You are a sales professional for ${config.company.name}, a polyethylene resin distribution company.
${config.company.description}

Write a personalized B2B sales email to:
- Name: ${contact.name}
- Company: ${contact.company}
- Country: ${contact.country}
- Delivery port (POD): ${contact.pod}
- Continent: ${contact.continent}
- Payment terms: ${contact.incoterms}

The email must include these product prices C&F ${contact.pod}:
${priceLines.length > 0 ? priceLines.join('\n') : 'Prices on request.'}

Requirements:
- Write in English (professional B2B tone)
- Campaign type: ${campaign}
- Sender: ${config.company.salesPerson}, ${config.company.salesTitle} at ${config.company.name}
- Keep it concise (max 200 words)
- Mention the delivery terms (${contact.incoterms}) and port (${contact.pod})
- Present the prices clearly
- End with a clear call-to-action (request for order, meeting, or quote)
- Do NOT use excessive marketing language

Return ONLY valid JSON in this exact format, no other text:
{
  "subject": "the email subject line",
  "body": "full email in plain text",
  "bodyHtml": "email in HTML with clean formatting"
}`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1200,
  });

  const content = response.choices[0].message.content.trim();
  let jsonStr = content;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    console.error('  Kon AI response niet parsen, gebruik fallback template.');
    return generateFallbackEmail(contact, pricing);
  }
}

/**
 * Genereer een reminder email met AI
 */
async function generateReminderEmail(contact, pricing, originalSubject, reminderNumber, options = {}) {
  const prompt = `You are a sales professional for ${config.company.name}, a polyethylene resin distribution company.

Write a short follow-up email. This is reminder #${reminderNumber}.
Original subject was: "${originalSubject}"

Recipient:
- Name: ${contact.name}
- Company: ${contact.company}
- Country: ${contact.country}
- Port: ${contact.pod}

Requirements:
- Write in English
- Keep it short (max 100 words)
- Reference the previous price offer
- ${reminderNumber === 1 ? 'Be friendly, acknowledge they may be busy' : 'Final follow-up, offer to help or stop emailing'}
- Sender: ${config.company.salesPerson}, ${config.company.salesTitle}

Return ONLY valid JSON:
{
  "subject": "Re: subject",
  "body": "plain text email",
  "bodyHtml": "HTML email"
}`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 500,
  });

  const content = response.choices[0].message.content.trim();
  let jsonStr = content;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    return {
      subject: `Re: ${originalSubject}`,
      body: `Dear ${contact.name},\n\nI wanted to follow up on my previous email regarding our polyethylene resin pricing for ${contact.pod}.\n\nWould you be interested in discussing this further?\n\nBest regards,\n${config.company.salesPerson}\n${config.company.salesTitle}\n${config.company.name}`,
      bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:600px;"><p>Dear ${contact.name},</p><p>I wanted to follow up on my previous email regarding our polyethylene resin pricing for ${contact.pod}.</p><p>Would you be interested in discussing this further?</p><p>Best regards,<br><strong>${config.company.salesPerson}</strong><br>${config.company.salesTitle}<br>${config.company.name}</p></div>`,
    };
  }
}

/**
 * Fallback template wanneer OpenAI niet beschikbaar is.
 * Genereert een professionele email met prijstabel.
 */
function generateFallbackEmail(contact, pricing) {
  const name = contact.name || 'Sir/Madam';
  const pod = contact.pod || '';
  const country = contact.country || '';
  const incoterms = contact.incoterms || '';

  const priceTableText = formatPriceTable(pricing);
  const priceTableHtml = formatPriceTableHtml(pricing);

  const subject = `${config.company.name} - PE Resin Price Offer C&F ${pod}`;

  const body = `Dear ${name},

I hope this message finds you well.

On behalf of ${config.company.name}, I would like to present our current polyethylene resin pricing for delivery to ${pod}, ${country}.

${priceTableText}

Terms: ${incoterms}
Delivery: C&F ${pod}
Validity: Subject to confirmation at time of order.

We can offer competitive volumes and flexible delivery schedules. Please let me know if you would like to discuss further or if you need pricing for additional grades.

Looking forward to hearing from you.

Best regards,
${config.company.salesPerson}
${config.company.salesTitle}
${config.company.name}`;

  const bodyHtml = `
<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;color:#333;">
  <p>Dear ${name},</p>

  <p>I hope this message finds you well.</p>

  <p>On behalf of <strong>${config.company.name}</strong>, I would like to present our current polyethylene resin pricing for delivery to <strong>${pod}, ${country}</strong>.</p>

  <h3 style="color:#2E75B6;margin-bottom:8px;">Current Pricing C&F ${pod}</h3>
  ${priceTableHtml}

  <p style="margin-top:16px;">
    <strong>Terms:</strong> ${incoterms}<br>
    <strong>Delivery:</strong> C&F ${pod}<br>
    <strong>Validity:</strong> Subject to confirmation at time of order.
  </p>

  <p>We can offer competitive volumes and flexible delivery schedules. Please let me know if you would like to discuss further or if you need pricing for additional grades.</p>

  <p>Looking forward to hearing from you.</p>

  <p>Best regards,<br>
  <strong>${config.company.salesPerson}</strong><br>
  ${config.company.salesTitle}<br>
  ${config.company.name}</p>
</div>`;

  return { subject, body, bodyHtml };
}

module.exports = { generateSalesEmail, generateReminderEmail, generateFallbackEmail };
