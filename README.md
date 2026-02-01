# AI Sales Email Agent

Geautomatiseerde AI sales agent die gepersonaliseerde emails stuurt naar potentiele klanten, met ingebouwde email tracking om te meten of emails geopend zijn.

## Wat doet het?

1. **Producten uit Excel** - Leest je producten en prijzen uit een Excel bestand
2. **Contacten uit Excel** - Leest potentiele klanten uit een Excel bestand
3. **AI Email Generatie** - Genereert gepersonaliseerde sales emails met OpenAI
4. **Email Tracking** - Onzichtbare tracking pixel in elke email om opens te detecteren
5. **Open Tracking** - Registreert of, wanneer en hoe vaak een email geopend is
6. **Reminders** - Stuurt automatisch follow-up emails als iemand niet opent
7. **Dashboard** - Overzicht van alle campagne statistieken in Excel + console

## Architectuur

```
data/
  producten.xlsx       <- Jouw producten + prijzen
  contacten.xlsx       <- Jouw leads/contacten
  tracking-log.xlsx    <- Automatisch gegenereerd tracking logboek

src/
  agent.js             <- Hoofd orchestrator (start hier)
  config.js            <- Configuratie management
  setup.js             <- Maakt template Excel bestanden

  excel/
    productReader.js   <- Leest producten uit Excel
    contactReader.js   <- Leest contacten uit Excel
    trackingLog.js     <- Tracking data opslag (geheugen + Excel)

  email/
    templateGenerator.js <- AI email generatie (OpenAI)
    sender.js            <- Email verzending (SMTP) + tracking pixel injectie

  tracking/
    server.js          <- Lokale tracking server (Express)

  reminder/
    reminderService.js <- Reminder logica voor ongeopende emails

netlify/functions/
  track.js             <- Netlify serverless tracking pixel endpoint
```

## Installatie

```bash
# 1. Installeer dependencies
npm install

# 2. Maak template Excel bestanden
npm run setup

# 3. Configureer environment variables
cp .env.example .env
# Vul de .env in met jouw gegevens
```

## Configuratie (.env)

| Variable | Beschrijving |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key voor AI email generatie |
| `SMTP_HOST` | SMTP server (bijv. smtp.gmail.com) |
| `SMTP_PORT` | SMTP poort (587 voor TLS) |
| `SMTP_USER` | SMTP gebruikersnaam |
| `SMTP_PASS` | SMTP wachtwoord / app password |
| `EMAIL_FROM_NAME` | Afzender naam |
| `EMAIL_FROM_ADDRESS` | Afzender email |
| `TRACKING_URL` | URL van de tracking pixel server |
| `COMPANY_NAME` | Jouw bedrijfsnaam |
| `COMPANY_DESCRIPTION` | Korte beschrijving van je bedrijf |
| `SALES_PERSON_NAME` | Naam van de verkoper |
| `REMINDER_AFTER_HOURS` | Uren wachten voor reminder (standaard: 48) |
| `MAX_REMINDERS` | Max aantal reminders per contact (standaard: 2) |

## Gebruik

### Interactief menu
```bash
npm start
```

### Email campagne versturen
```bash
npm run send
```

### Tracking dashboard bekijken
```bash
npm run dashboard
```

### Reminders versturen voor ongeopende emails
```bash
npm run remind
```

### Lokale tracking server starten
```bash
npm run server
```
De tracking server draait op `http://localhost:3001` en biedt:
- `GET /track?id=...&email=...` - Tracking pixel endpoint
- `GET /dashboard` - JSON API met tracking data
- `GET /health` - Health check

## Hoe werkt de tracking?

1. Bij het versturen wordt een unieke tracking ID gegenereerd per email
2. Een onzichtbare 1x1 pixel wordt in de HTML email geplaatst
3. Wanneer de ontvanger de email opent, laadt de pixel van de tracking server
4. De server registreert: wie, wanneer, hoe vaak
5. Data wordt opgeslagen in geheugen EN in `tracking-log.xlsx`

### Tracking backends

De tracking pixel kan data opslaan via:
- **Lokale Express server** - Draait op je eigen machine
- **Netlify Function** - Serverless, deploy naar Netlify
- **Microsoft Graph API** - Direct naar Excel Online (Azure)
- **Webhook** - Naar n8n, Zapier, Make, of andere automation tools

## Excel Bestanden

### producten.xlsx
| Product | Beschrijving | Prijs | Categorie | Kenmerken |
|---|---|---|---|---|
| Website Basic | Professionele website | 1499 | Websites | SEO, CMS |

### contacten.xlsx
| Naam | Email | Bedrijf | Functie | Branche | Notities | Land | Taal |
|---|---|---|---|---|---|---|---|
| Jan Bakker | jan@bedrijf.nl | Bedrijf BV | Manager | Retail | Info | NL | nl |

### tracking-log.xlsx (automatisch)
Wordt automatisch bijgewerkt met:
- Tracking ID, email, contact, bedrijf
- Campagne, onderwerp
- Verzonden tijdstip
- Aantal opens, eerste/laatste open
- Aantal reminders, status

## Netlify Deployment

Voor de tracking pixel op Netlify:

1. Push naar GitHub
2. Verbind repository met Netlify
3. Stel environment variables in via Netlify dashboard
4. De tracking pixel URL wordt: `https://jouw-site.netlify.app/.netlify/functions/track`

## Gmail Setup

Voor Gmail als SMTP:
1. Schakel 2-factor authenticatie in
2. Maak een App Password aan (Google Account > Security > App passwords)
3. Gebruik het app password als `SMTP_PASS`
