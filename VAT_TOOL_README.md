# German VAT & ZM Tool - Gebruikershandleiding

## 📋 Overzicht

Dit programma verwerkt **SalesInvoice** en **PurchaseInvoice** Excel-bestanden om de cijfers voor de Duitse BTW-aangifte (Umsatzsteuer-Voranmeldung), de Zusammenfassende Meldung (ZM), en de Jaaraangifte (Umsatzsteuererklärung) te genereren.

## 🚀 Installatie

### Vereisten
- Python 3.8 of hoger
- pip (Python package manager)

### Stappen

1. **Clone de repository of download de bestanden:**
   ```bash
   cd email-tracking
   ```

2. **Installeer de vereiste packages:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start de applicatie:**
   ```bash
   streamlit run streamlit_app.py
   ```

4. **Open de applicatie in je browser:**
   De applicatie opent automatisch op `http://localhost:8501`

## 📊 Functies

### Tab 1: Periodieke Aangifte (Maand / Kwartaal)

Deze tab genereert:
- **Umsatzsteuer-Voranmeldung** (maandelijks of per kwartaal)
- **Zusammenfassende Meldung (ZM)** - EU verkopen per BTW-nummer

#### Gebruik:
1. Upload één of meerdere **SalesInvoice** bestanden
2. Upload één of meerdere **PurchaseInvoice** bestanden
3. Klik op **"Bereken Periodieke Aangifte"**
4. Bekijk de resultaten en download de rapporten

**Voorbeeld voor Q3:**
- Upload: `SalesInvoice_DE_Juli.xlsx`, `SalesInvoice_DE_Augustus.xlsx`, `SalesInvoice_DE_September.xlsx`
- Of upload één samengevoegd bestand: `SalesInvoice_DE_Q3.xlsx`

### Tab 2: Jaaraangifte

Deze tab genereert:
- **Umsatzsteuererklärung** (jaarlijkse BTW-aangifte)

#### Gebruik:
1. Upload **alle** SalesInvoice bestanden voor het hele jaar (12 maanden)
2. Upload **alle** PurchaseInvoice bestanden voor het hele jaar
3. Klik op **"Bereken Jaaraangifte"**
4. Bekijk de resultaten en download het rapport

## 📁 Bestandsformaat

### SalesInvoice (Verkoopfacturen)

Verwachte kolommen:
- **Handelsregio**: `Eigen land` of `EU`
- **Fiscaal land**: Landcode (bijv. `DE`, `NL`, `FR`)
- **Tot. vrk. ex. BTW**: Totaal bedrag exclusief BTW
- **BTW-laag**: BTW laag tarief bedrag (7%)
- **BTW-hoog**: BTW hoog tarief bedrag (19%)
- **BTW-nr.**: BTW-nummer van de klant (voor EU verkopen)

**Voorbeeld:**

| Handelsregio | Fiscaal land | Tot. vrk. ex. BTW | BTW-laag | BTW-hoog | BTW-nr. |
|--------------|--------------|-------------------|----------|----------|---------|
| Eigen land   | DE           | 10000.00          | 0        | 1900.00  |         |
| EU           | NL           | 5000.00           | 0        | 0        | NL123456789B01 |

### PurchaseInvoice (Inkoopfacturen)

Verwachte kolommen:
- **Land ISO-code**: Landcode van oorsprong (bijv. `DE`, `NL`, `FR`)
- **Tot. ink. ex. BTW**: Totaal bedrag exclusief BTW
- **Tot. BTW**: Totaal BTW bedrag

**Voorbeeld:**

| Land ISO-code | Tot. ink. ex. BTW | Tot. BTW |
|---------------|-------------------|----------|
| DE            | 8000.00           | 1520.00  |
| NL            | 3000.00           | 0        |

## 🧮 Berekeningslogica

### Verkopen (Sales)
- **Handelsregio = 'Eigen land'** → Binnenlandse verkopen (19% BTW)
  - Kennziffer 81: Omzet 19%
- **Handelsregio = 'EU'** → Intracommunautaire leveringen (0% BTW)
  - Kennziffer 41: ICP Leveringen

### Inkopen (Purchases)
- **BTW > 0** → Binnenlandse inkopen
  - Kennziffer 66: Voorbelasting (Vorsteuer)
- **BTW = 0 & Land = EU** → Intracommunautaire verwervingen
  - Berekend voor jaaraangifte (Line 51, 80)

### Formules

#### Periodieke Aangifte:
```
Kennziffer 81 (Omzet 19%) = Sum(Sales waar Handelsregio='Eigen land')
Kennziffer 41 (ICP Leveringen) = Sum(Sales waar Handelsregio='EU')
Kennziffer 66 (Voorbelasting) = Sum(Purchase Tot. BTW)
Kennziffer 83 (Te Betalen) = (K81 × 0.19) - K66
```

#### Jaaraangifte:
```
Line 22 (Lieferungen zu 19%) = Sum(Sales Eigen land)
Line 38 (Innergem. Lieferungen) = Sum(Sales EU)
Line 51 (Innergem. Erwerbe 19%) = Sum(Purchase EU zonder BTW) × 0.19
Line 79 (Vorsteuer Rechnungen) = Sum(Purchase Tot. BTW)
Line 80 (Vorsteuer Innergem. Erw.) = Line 51
Line 108/110 (Totaal Saldo) = (Line 22 × 0.19 + Line 51) - (Line 79 + Line 80)
```

## 📥 Output Rapporten

### 1. Umsatzsteuer-Voranmeldung (VA)
Excel bestand met:
- Categorie
- Kennziffer (81, 41, 66, 83)
- Bedrag in EUR

### 2. Zusammenfassende Meldung (ZM)
Excel bestand met:
- BTW-nr. van EU klanten
- Bedrag (EUR)
- Code (05 = goederen)

### 3. Umsatzsteuererklärung (Jaaraangifte)
Excel bestand met:
- Regel nummer (Line 22, 38, 51, 79, 80, 108/110)
- Omschrijving
- Bedrag (EUR)

## 🔍 Validatie

De tool bevat automatische validatie:
- Controleert of vereiste kolommen aanwezig zijn
- Probeert alternatieve kolomnamen te herkennen
- Vult ontbrekende waarden in met standaardwaarden
- Toont foutmeldingen bij problemen

## 🛠️ Technische Details

### Architectuur
```
streamlit_app.py        # Hoofdapplicatie (UI)
vat_calculator.py       # Berekeningslogica
requirements.txt        # Python dependencies
```

### Dependencies
- **Streamlit**: Web interface
- **Pandas**: Data verwerking
- **OpenPyXL**: Excel I/O
- **NumPy**: Numerieke berekeningen

### Kolom Mapping
De tool herkent automatisch verschillende kolomnamen:
- `Handelsregio` / `Trade Region` / `Region`
- `Fiscaal land` / `Fiscal Country` / `Country`
- `Tot. vrk. ex. BTW` / `Total excl. VAT` / `Total Sales excl. VAT`
- `BTW-nr.` / `VAT Number` / `VAT-nr`
- En meer...

## 📝 Voorbeeld Workflow

### Scenario: Q3 2025 Aangifte

1. **Verzamel bestanden:**
   - `SalesInvoice_DE_Juli_2025.xlsx`
   - `SalesInvoice_DE_Augustus_2025.xlsx`
   - `SalesInvoice_DE_September_2025.xlsx`
   - `PurchaseInvoice_DE_Q3_2025.xlsx`

2. **Upload in Tab 1:**
   - Upload alle 3 sales bestanden
   - Upload het purchase bestand

3. **Bereken:**
   - Klik op "Bereken Periodieke Aangifte"
   - Bekijk resultaten voor VA en ZM

4. **Download:**
   - Download `Umsatzsteuer_Voranmeldung.xlsx`
   - Download `Zusammenfassende_Meldung.xlsx`

5. **Gebruik voor aangifte:**
   - Open de Excel bestanden
   - Voer de bedragen in op ELSTER of vergelijkbaar systeem

## ⚠️ Belangrijke Opmerkingen

1. **Controleer altijd de resultaten** voordat je de aangifte indient
2. **Backup je gegevens** regelmatig
3. **Test met kleine datasets** voordat je grote bestanden verwerkt
4. **EU landen lijst**: De tool gebruikt de standaard EU-27 landen
5. **BTW-tarieven**: Standaard 19% (hoog) en 7% (laag)

## 🐛 Troubleshooting

### Probleem: "Error loading sales file"
**Oplossing**: Controleer of het bestand de vereiste kolommen bevat

### Probleem: Geen resultaten zichtbaar
**Oplossing**: Zorg dat er data in de bestanden staat en klik op de bereken knop

### Probleem: Verkeerde bedragen
**Oplossing**:
- Controleer of kolommen correct zijn benoemd
- Verifieer dat Handelsregio juist is ingevuld (`Eigen land` of `EU`)
- Controleer of BTW bedragen correct zijn

### Probleem: Kan bestand niet uploaden
**Oplossing**:
- Controleer of het bestand .xlsx of .xls formaat heeft
- Zorg dat het bestand niet geopend is in Excel
- Probeer het bestand opnieuw op te slaan

## 📞 Support

Voor vragen of problemen:
1. Controleer deze handleiding
2. Bekijk de voorbeeldbestanden
3. Test met kleine datasets eerst

## 📜 Licentie

Dit programma is ontwikkeld voor intern gebruik bij fiscale administratie.

## 🔄 Versie Historie

### Version 1.0.0 (2026-01-02)
- Initiële release
- Ondersteuning voor maand/kwartaal aangiftes
- Ondersteuning voor jaaraangiftes
- Automatische kolom herkenning
- Excel export functionaliteit
- ZM rapport generatie

---

**Laatste update:** 2026-01-02
**Versie:** 1.0.0
