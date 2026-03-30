# German VAT & ZM Tool - Styling Guide

## 🎨 Design Overzicht

Het German VAT & ZM Tool heeft een professionele, moderne interface met een Duitse thema-kleuren: **Zwart**, **Rood**, en **Goud**.

## 🇩🇪 Kleurenschema

### Primaire Kleuren
- **German Black**: `#000000` - Gebruikt voor tekst en primaire elementen
- **German Red**: `#DD0000` - Accent kleur voor headers en primaire acties
- **German Gold**: `#FFCE00` - Accent kleur voor highlights en secundaire elementen

### Secundaire Kleuren
- **Dark Gray**: `#1E1E1E` - Tekst en labels
- **Light Gray**: `#F5F5F5` - Achtergrond voor sidebar
- **Background**: `#FAFAFA` - Main container achtergrond

## 🎯 Design Elementen

### 1. Header Styling
- **Titel (H1)**:
  - Kleur: Zwart
  - Font-weight: 700 (Bold)
  - Border-bottom: 4px gouden lijn
  - Duitse vlag accent boven en onder

- **Subheaders (H2)**:
  - Kleur: Rood
  - Font-weight: 600
  - Gebruikt voor sectie titels

### 2. Duitse Vlag Accent Bar
```css
.german-flag-bar {
    height: 6px;
    background: linear-gradient(to right,
        black 0-33%,
        red 33-66%,
        gold 66-100%);
}
```

Gebruikt tussen secties voor visuele scheiding met Duitse branding.

### 3. Buttons

#### Primaire Actie Buttons (Bereken)
- **Achtergrond**: German Red (`#DD0000`)
- **Tekst**: Wit
- **Hover effect**: Donkerder rood + lift animatie
- **Border-radius**: 8px
- **Box-shadow**: 0 4px 6px rgba(0,0,0,0.1)

#### Download Buttons
- **Achtergrond**: German Gold (`#FFCE00`)
- **Tekst**: Zwart
- **Border**: 2px solid zwart
- **Border-radius**: 8px

### 4. File Uploaders
- **Achtergrond**: Wit
- **Border**: 2px dashed gouden kleur
- **Border-radius**: 10px
- **Box-shadow**: Subtiele schaduw
- **Padding**: 1.5rem

### 5. Metric Cards
- **Value font-size**: 2rem
- **Value font-weight**: 700 (Bold)
- **Value color**: Zwart
- **Label font-size**: 1rem
- **Label font-weight**: 600
- **Label color**: Dark gray

### 6. Tabs
- **Background**: Wit container met schaduw
- **Active tab**: Rode achtergrond met witte tekst
- **Inactive tab**: Grijze tekst
- **Border-radius**: 8-10px
- **Gap**: 2rem tussen tabs

### 7. Tables (Dataframes)
- **Border-radius**: 10px
- **Box-shadow**: 0 4px 6px rgba(0,0,0,0.1)
- **Overflow**: Hidden voor afgeronde hoeken

### 8. Sidebar
- **Achtergrond**: Light gray (`#F5F5F5`)
- **Info cards**:
  - Witte achtergrond
  - Border-radius: 8px
  - Padding: 1rem
  - Rode headers

## 📊 Visualisaties (Plotly Charts)

### 1. Kennziffer Bar Chart
- **Kleuren**: Afwisselend rood, goud, zwart
- **Height**: 450px
- **Text position**: Buiten de bars
- **Grid color**: `#E5E5E5`
- **Background**: Transparant

### 2. VAT Pie Chart (Donut)
- **Hole size**: 0.4 (donut effect)
- **Kleuren**: Rood, goud, zwart
- **Text info**: Label + percentage
- **Height**: 400px
- **Legend**: Aan

### 3. Annual Comparison Chart
- **Type**: Bar chart
- **Kleuren**: Afwisselend rood, goud, zwart
- **Height**: 500px
- **Text format**: Currency met komma's

### Chart Configuratie
```python
fig.update_layout(
    title={
        'text': 'Chart Titel',
        'x': 0.5,
        'xanchor': 'center',
        'font': {'size': 20, 'color': '#000000', 'family': 'Arial Black'}
    },
    paper_bgcolor='rgba(0,0,0,0)',  # Transparant
    plot_bgcolor='rgba(0,0,0,0)',   # Transparant
    font=dict(size=12),
    yaxis=dict(gridcolor='#E5E5E5')
)
```

## 🎭 Interactieve Elementen

### Hover Effects
- **Buttons**: Lift animatie (translateY -2px) + donkerdere kleur
- **Charts**: Custom tooltips met currency formatting

### Animations
```css
transition: all 0.3s ease;
```
Gebruikt voor smooth hover effects op buttons.

## 📱 Responsive Design

### Layout
- **Main layout**: Wide mode (`layout="wide"`)
- **Columns**: Dynamische kolommen voor verschillende schermgroottes
  - Metrics: 4 kolommen
  - Charts: 2 kolommen (side-by-side)
  - Forms: 2 kolommen (sales/purchase uploaders)

### Spacing
- **Section spacing**: 2rem margin top voor headers
- **Card padding**: 1.5-2rem
- **Grid gap**: Automatisch door Streamlit columns

## 🎨 UI/UX Best Practices

### 1. Visual Hierarchy
1. **Duitse vlag bar** (branding)
2. **Titel met gouden onderstreep** (duidelijk)
3. **Intro box** (context)
4. **Tabs** (navigatie)
5. **Content secties** met vlag bars als scheidingen

### 2. Feedback & Status
- **Success messages**: Groen met check mark
- **Error messages**: Rood met warning icon
- **Info messages**: Blauw met info icon
- **Loading**: Spinner met duidelijke tekst

### 3. Data Presentatie
**Volgorde (Top → Bottom):**
1. **Metric Cards** - Snelle overview
2. **Grafieken** - Visuele representatie
3. **Tabellen** - Gedetailleerde data
4. **Download buttons** - Acties

### 4. Color Psychology
- **Rood**: Acties, belangrijke cijfers, waarschuwingen
- **Goud**: Highlights, secundaire acties (downloads)
- **Zwart**: Professionaliteit, stabiliteit, data
- **Wit**: Ruimte, leesbaarheid, schone interface

## 📦 Component Styling

### Info Boxes in Sidebar
```html
<div style='background-color: white;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;'>
    <h3 style='color: #DD0000; margin-top: 0;'>Titel</h3>
    <p>Content</p>
</div>
```

### Alert Styling
- **Border-left**: 5px solid goud
- **Border-radius**: 10px
- **Padding**: Standaard Streamlit

## 🚀 Performance

### CSS Loading
- Alle CSS in één `<style>` block
- Geladen bij page setup
- CSS variables voor herbruikbaarheid

### Chart Rendering
- Plotly gebruikt WebGL voor snelle rendering
- Transparante backgrounds voor performance
- Responsive containers

## 📝 Branding Elementen

### 1. Duitse Vlag Bar
Gebruikt op:
- Voor en na hoofdtitel
- Tussen grote secties
- In sidebar boven en onder
- Als visuele scheiding

### 2. Icons
- 🇩🇪 - German flag (hoofdtitel)
- 📊 - Metrics en charts
- 📋 - Rapporten en tabellen
- 📤/📥 - Upload/Download acties
- ✅ - Success feedback
- ⚠️ - Warnings
- ℹ️ - Informatie

### 3. Consistente Terminologie
- **Kennziffer** (niet "code")
- **Umsatzsteuer-Voranmeldung** (officiële term)
- **Zusammenfassende Meldung (ZM)** (acroniem uitgelegd)
- Euro symbool: € (niet EUR in UI, wel in data)

## 🎯 Toegankelijkheid

### Contrast
- Zwarte tekst op wit: 21:1 (WCAG AAA)
- Rode headers op wit: 5.5:1 (WCAG AA)
- Goud gebruikt alleen voor accenten, niet primaire tekst

### Font Sizes
- **Main text**: 1rem (16px)
- **Metrics**: 2rem (32px)
- **Headers H1**: Default + 700 weight
- **Headers H2**: Default + 600 weight
- **Sidebar**: 0.85-0.9rem (kleiner maar leesbaar)

### Interactive Elements
- Alle buttons hebben duidelijke hover states
- Focus states behouden (browser defaults)
- Voldoende klik-gebied (padding 0.75rem+)

## 🔧 Customization Tips

### Kleuren Aanpassen
Wijzig CSS variables in `streamlit_app.py`:
```css
:root {
    --german-black: #000000;
    --german-red: #DD0000;
    --german-gold: #FFCE00;
}
```

### Chart Kleuren Aanpassen
Wijzig `colors` arrays in chart functies:
```python
colors = ['#DD0000', '#FFCE00', '#000000']
```

### Spacing Aanpassen
Wijzig padding/margin in CSS of gebruik Streamlit spacing:
```python
st.markdown('<div style="margin: 2rem 0;"></div>', unsafe_allow_html=True)
```

## 📚 Dependencies voor Styling

### Python Packages
- `streamlit` - Main framework
- `plotly` - Interactieve grafieken
- `pandas` - Data tables

### CSS Features Gebruikt
- CSS Variables
- Flexbox (via Streamlit columns)
- Transitions & Transforms
- Box-shadow
- Linear-gradient
- Border-radius

## 🎨 Design Inspiratie

Het design combineert:
- **Minimalisme**: Clean, wit, veel ruimte
- **Professionaliteit**: Deutsche branding, zakelijke kleuren
- **Moderniteit**: Afgeronde hoeken, schaduwen, animaties
- **Functionaliteit**: Data-first, duidelijke hiërarchie

---

**Versie**: 2.0.0
**Laatst bijgewerkt**: 2026-01-02
**Designer**: Claude Code
