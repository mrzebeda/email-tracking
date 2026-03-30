# German VAT & ZM Tool - Quick Start Guide

## 🚀 Snelstart in 5 minuten

### 1. Installeer Dependencies
```bash
pip install -r requirements.txt
```

### 2. Genereer Testdata (Optioneel)
```bash
python generate_sample_data.py
```

Dit maakt testbestanden aan in de `sample_data/` directory.

### 3. Start de Applicatie
```bash
streamlit run streamlit_app.py
```

De applicatie opent automatisch in je browser op `http://localhost:8501`

### 4. Test met Sample Data

#### Voor Periodieke Aangifte (Tab 1):
1. Ga naar tab "Periodieke Aangifte (M/Q)"
2. Upload bestanden:
   - Sales: `sample_data/SalesInvoice_DE_November_2025.xlsx`
   - Purchase: `sample_data/PurchaseInvoice_DE_November_2025.xlsx`
3. Klik op "Bereken Periodieke Aangifte"
4. Bekijk de resultaten voor VA en ZM

#### Voor Kwartaalaangifte (Q3):
1. Upload meerdere sales bestanden:
   - `sample_data/SalesInvoice_DE_Juli_2025.xlsx`
   - `sample_data/SalesInvoice_DE_Augustus_2025.xlsx`
   - `sample_data/SalesInvoice_DE_September_2025.xlsx`
2. Upload purchase bestanden van Q3
3. De tool sommeert automatisch alle data

#### Voor Jaaraangifte (Tab 2):
1. Ga naar tab "Jaaraangifte"
2. Upload **alle** sales en purchase bestanden van het jaar
3. Klik op "Bereken Jaaraangifte"
4. Download het jaarrapport

## 📊 Verwachte Output

### Umsatzsteuer-Voranmeldung (VA)
| Categorie | Kennziffer | Bedrag (EUR) |
|-----------|------------|--------------|
| Omzet 19% | 81 | 123,456.78 |
| ICP Leveringen (EU) | 41 | 45,678.90 |
| Voorbelasting (Vorsteuer) | 66 | 12,345.67 |
| Te Betalen | 83 | 11,111.11 |

### Zusammenfassende Meldung (ZM)
| BTW-nr. | Bedrag (EUR) | Code |
|---------|--------------|------|
| NL123456789B01 | 25,000.00 | 05 |
| FR12345678901 | 20,678.90 | 05 |

### Jaaraangifte
| Regel | Omschrijving | Bedrag (EUR) |
|-------|--------------|--------------|
| Line 22 | Lieferungen zu 19% | 1,234,567.89 |
| Line 38 | Innergem. Lieferungen | 456,789.01 |
| Line 51 | Innergem. Erwerbe (19%) | 12,345.67 |
| Line 79 | Vorsteuer (Rechnungen) | 123,456.78 |
| Line 80 | Vorsteuer (Innergem. Erw.) | 12,345.67 |
| Line 108/110 | Totaal Saldo | 98,765.43 |

## 🔧 Je Eigen Data Gebruiken

### Sales Invoice Format
Zorg dat je Excel bestand deze kolommen heeft:
```
Handelsregio | Fiscaal land | Tot. vrk. ex. BTW | BTW-laag | BTW-hoog | BTW-nr.
```

**Voorbeeld rij:**
```
Eigen land | DE | 10000.00 | 0 | 1900.00 |
EU | NL | 5000.00 | 0 | 0 | NL123456789B01
```

### Purchase Invoice Format
```
Land ISO-code | Tot. ink. ex. BTW | Tot. BTW
```

**Voorbeeld rij:**
```
DE | 8000.00 | 1520.00
NL | 3000.00 | 0
```

## ⚡ Tips & Tricks

1. **Meerdere bestanden**: Upload gerust 10+ bestanden tegelijk - de tool sommeert alles
2. **Kolom namen**: De tool herkent variaties zoals "Total excl. VAT" of "Tot. vrk. ex. BTW"
3. **Download rapporten**: Gebruik de download knoppen voor Excel export
4. **Controleer je data**: Bekijk de metriek kaarten voor een snelle check

## ❗ Veelvoorkomende Problemen

**Probleem**: Geen resultaten zichtbaar
- **Oplossing**: Controleer of je op de "Bereken" knop hebt geklikt

**Probleem**: "Error loading file"
- **Oplossing**: Controleer of kolommen correct zijn benoemd

**Probleem**: Verkeerde bedragen
- **Oplossing**: Verifieer dat `Handelsregio` exact "Eigen land" of "EU" is (hoofdlettergevoelig)

## 📞 Meer Informatie

Zie `VAT_TOOL_README.md` voor:
- Uitgebreide documentatie
- Berekeningsformules
- Troubleshooting guide
- Technische details

---

**Veel succes met je BTW-aangifte! 🇩🇪**
