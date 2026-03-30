"""
German VAT & ZM Tool - Streamlit Application
Processes sales and purchase invoices for German tax declarations
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from io import BytesIO
from vat_calculator import VATCalculator, format_vat_summary_table


# Page configuration
st.set_page_config(
    page_title="German VAT & ZM Tool",
    page_icon="🇩🇪",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for professional styling
st.markdown("""
<style>
    /* German color theme - Black, Red, Gold */
    :root {
        --german-black: #000000;
        --german-red: #DD0000;
        --german-gold: #FFCE00;
        --dark-gray: #1E1E1E;
        --light-gray: #F5F5F5;
    }

    /* Main container styling */
    .main {
        background-color: #FAFAFA;
    }

    /* Header styling */
    h1 {
        color: var(--german-black) !important;
        font-weight: 700 !important;
        padding: 1rem 0;
        border-bottom: 4px solid var(--german-gold);
        margin-bottom: 2rem;
    }

    h2 {
        color: var(--german-red) !important;
        font-weight: 600 !important;
        margin-top: 2rem;
    }

    h3 {
        color: var(--german-black) !important;
        font-weight: 500 !important;
    }

    /* Metric cards styling */
    [data-testid="stMetricValue"] {
        font-size: 2rem !important;
        font-weight: 700 !important;
        color: var(--german-black) !important;
    }

    [data-testid="stMetricLabel"] {
        font-size: 1rem !important;
        font-weight: 600 !important;
        color: var(--dark-gray) !important;
    }

    /* Button styling */
    .stButton > button {
        background-color: var(--german-red) !important;
        color: white !important;
        font-weight: 600 !important;
        border-radius: 8px !important;
        padding: 0.75rem 2rem !important;
        border: none !important;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
        transition: all 0.3s ease !important;
    }

    .stButton > button:hover {
        background-color: #BB0000 !important;
        box-shadow: 0 6px 12px rgba(0,0,0,0.15) !important;
        transform: translateY(-2px);
    }

    .stDownloadButton > button {
        background-color: var(--german-gold) !important;
        color: var(--german-black) !important;
        font-weight: 600 !important;
        border-radius: 8px !important;
        padding: 0.5rem 1.5rem !important;
        border: 2px solid var(--german-black) !important;
    }

    .stDownloadButton > button:hover {
        background-color: #E6B800 !important;
    }

    /* File uploader styling */
    [data-testid="stFileUploader"] {
        background-color: white;
        padding: 1.5rem;
        border-radius: 10px;
        border: 2px dashed var(--german-gold);
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    /* Dataframe styling */
    .dataframe {
        border-radius: 10px !important;
        overflow: hidden !important;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
    }

    /* Tab styling */
    .stTabs [data-baseweb="tab-list"] {
        gap: 2rem;
        background-color: white;
        padding: 1rem;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .stTabs [data-baseweb="tab"] {
        font-weight: 600;
        font-size: 1.1rem;
        padding: 1rem 2rem;
        border-radius: 8px;
        color: var(--dark-gray);
    }

    .stTabs [aria-selected="true"] {
        background-color: var(--german-red) !important;
        color: white !important;
    }

    /* Info box styling */
    .stAlert {
        border-radius: 10px !important;
        border-left: 5px solid var(--german-gold) !important;
    }

    /* Sidebar styling */
    [data-testid="stSidebar"] {
        background-color: var(--light-gray);
        padding: 2rem 1rem;
    }

    [data-testid="stSidebar"] h2 {
        color: var(--german-black) !important;
    }

    /* Success message styling */
    .success-box {
        background-color: #D4EDDA;
        border-left: 5px solid #28A745;
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
    }

    /* Card container */
    .card {
        background-color: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        margin: 1rem 0;
    }

    /* German flag accent */
    .german-flag-bar {
        height: 6px;
        background: linear-gradient(to right,
            var(--german-black) 0%,
            var(--german-black) 33%,
            var(--german-red) 33%,
            var(--german-red) 66%,
            var(--german-gold) 66%,
            var(--german-gold) 100%);
        margin: 1rem 0;
        border-radius: 3px;
    }
</style>
""", unsafe_allow_html=True)


def add_download_button(df: pd.DataFrame, filename: str, button_label: str):
    """Add Excel download button for dataframe"""
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Report')
    output.seek(0)

    st.download_button(
        label=button_label,
        data=output,
        file_name=filename,
        mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


def create_vat_chart(summary):
    """Create interactive pie chart for VAT breakdown"""
    labels = ['Omzet 19%', 'ICP Leveringen (EU)', 'Voorbelasting']
    values = [
        summary.omzet_19_percent,
        summary.icp_leveringen_eu,
        summary.voorbelasting
    ]
    colors = ['#DD0000', '#FFCE00', '#000000']

    fig = go.Figure(data=[go.Pie(
        labels=labels,
        values=values,
        hole=0.4,
        marker=dict(colors=colors),
        textinfo='label+percent',
        textfont_size=14,
        hovertemplate='<b>%{label}</b><br>€ %{value:,.2f}<br>%{percent}<extra></extra>'
    )])

    fig.update_layout(
        title={
            'text': 'BTW Verdeling',
            'x': 0.5,
            'xanchor': 'center',
            'font': {'size': 20, 'color': '#000000', 'family': 'Arial Black'}
        },
        showlegend=True,
        height=400,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(size=12)
    )

    return fig


def create_kennziffer_chart(summary):
    """Create bar chart for Kennziffern"""
    categories = ['K81<br>Omzet 19%', 'K41<br>ICP Leveringen', 'K66<br>Voorbelasting', 'K83<br>Te Betalen']
    values = [
        summary.omzet_19_percent,
        summary.icp_leveringen_eu,
        summary.voorbelasting,
        summary.te_betalen
    ]
    colors = ['#DD0000', '#FFCE00', '#000000', '#DD0000']

    fig = go.Figure(data=[go.Bar(
        x=categories,
        y=values,
        marker_color=colors,
        text=[f'€ {v:,.2f}' for v in values],
        textposition='outside',
        hovertemplate='<b>%{x}</b><br>€ %{y:,.2f}<extra></extra>'
    )])

    fig.update_layout(
        title={
            'text': 'Kennziffern Overzicht',
            'x': 0.5,
            'xanchor': 'center',
            'font': {'size': 20, 'color': '#000000', 'family': 'Arial Black'}
        },
        xaxis_title='Kennziffer',
        yaxis_title='Bedrag (EUR)',
        height=450,
        showlegend=False,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(size=12),
        yaxis=dict(gridcolor='#E5E5E5')
    )

    return fig


def create_annual_comparison_chart(annual_report):
    """Create comparison chart for annual report"""
    categories = ['Lieferungen<br>19%', 'Innergem.<br>Lieferungen', 'Innergem.<br>Erwerbe',
                  'Vorsteuer<br>Rechnungen', 'Vorsteuer<br>Erwerbe']
    values = [
        annual_report['Line 22 - Lieferungen zu 19%'],
        annual_report['Line 38 - Innergem. Lieferungen'],
        annual_report['Line 51 - Innergem. Erwerbe (19%)'],
        annual_report['Line 79 - Vorsteuer (Rechnungen)'],
        annual_report['Line 80 - Vorsteuer (Innergem. Erw.)']
    ]
    colors = ['#DD0000', '#FFCE00', '#000000', '#DD0000', '#FFCE00']

    fig = go.Figure(data=[go.Bar(
        x=categories,
        y=values,
        marker_color=colors,
        text=[f'€ {v:,.0f}' for v in values],
        textposition='outside',
        hovertemplate='<b>%{x}</b><br>€ %{y:,.2f}<extra></extra>'
    )])

    fig.update_layout(
        title={
            'text': 'Jaaroverzicht - Alle Posten',
            'x': 0.5,
            'xanchor': 'center',
            'font': {'size': 20, 'color': '#000000', 'family': 'Arial Black'}
        },
        xaxis_title='Categorie',
        yaxis_title='Bedrag (EUR)',
        height=500,
        showlegend=False,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(size=12),
        yaxis=dict(gridcolor='#E5E5E5')
    )

    return fig


def display_styled_header():
    """Display styled header with German flag"""
    st.markdown('<div class="german-flag-bar"></div>', unsafe_allow_html=True)
    st.title("🇩🇪 German VAT & ZM Tool")
    st.markdown("""
    <div style='background-color: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;'>
        <p style='margin: 0; font-size: 1.1rem; color: #1E1E1E;'>
            Dit programma verwerkt <b>SalesInvoice</b> en <b>PurchaseInvoice</b> Excel-bestanden om de cijfers
            voor de Duitse BTW-aangifte (<b>Umsatzsteuer-Voranmeldung</b>), de <b>Zusammenfassende Meldung (ZM)</b>,
            en de <b>Jaaraangifte (Umsatzsteuererklärung)</b> te genereren.
        </p>
    </div>
    """, unsafe_allow_html=True)
    st.markdown('<div class="german-flag-bar"></div>', unsafe_allow_html=True)


def main():
    # Display styled header
    display_styled_header()

    # Create tabs
    tab1, tab2 = st.tabs(["📊 Periodieke Aangifte (M/Q)", "📅 Jaaraangifte"])

    # ========== TAB 1: Periodic Declaration ==========
    with tab1:
        st.header("Periodieke Aangifte - Maand / Kwartaal")
        st.markdown("""
        Upload de **SalesInvoice** en **PurchaseInvoice** Excel-bestanden voor de gewenste periode.
        Voor een kwartaalaangifte (bijv. Q3) kunt u de bestanden van juli, augustus en september uploaden,
        of één samengevoegd bestand.
        """)

        # File uploaders
        col1, col2 = st.columns(2)

        with col1:
            st.subheader("📤 Sales Invoices (Verkopen)")
            sales_files = st.file_uploader(
                "Upload SalesInvoice bestanden",
                type=['xlsx', 'xls'],
                accept_multiple_files=True,
                key='sales_periodic'
            )

        with col2:
            st.subheader("📥 Purchase Invoices (Inkopen)")
            purchase_files = st.file_uploader(
                "Upload PurchaseInvoice bestanden",
                type=['xlsx', 'xls'],
                accept_multiple_files=True,
                key='purchase_periodic'
            )

        if st.button("🔄 Bereken Periodieke Aangifte", type="primary", key='calc_periodic'):
            if not sales_files and not purchase_files:
                st.error("⚠️ Upload minimaal één Sales- of Purchase-bestand!")
            else:
                try:
                    with st.spinner("Bezig met verwerken..."):
                        calculator = VATCalculator()

                        # Load sales files
                        if sales_files:
                            for sales_file in sales_files:
                                calculator.load_sales_file(sales_file)
                                st.success(f"✅ Geladen: {sales_file.name}")

                        # Load purchase files
                        if purchase_files:
                            for purchase_file in purchase_files:
                                calculator.load_purchase_file(purchase_file)
                                st.success(f"✅ Geladen: {purchase_file.name}")

                        # Calculate VAT
                        summary = calculator.calculate_periodic_vat()

                        # Display results
                        st.success("✅ Berekening voltooid!")

                        # Key metrics display (moved to top)
                        st.markdown('<div class="german-flag-bar"></div>', unsafe_allow_html=True)
                        st.subheader("📊 Samenvatting Kennziffern")

                        metric_col1, metric_col2, metric_col3, metric_col4 = st.columns(4)

                        with metric_col1:
                            st.metric(
                                "Omzet 19% (K81)",
                                f"€ {summary.omzet_19_percent:,.2f}"
                            )

                        with metric_col2:
                            st.metric(
                                "ICP Leveringen (K41)",
                                f"€ {summary.icp_leveringen_eu:,.2f}"
                            )

                        with metric_col3:
                            st.metric(
                                "Voorbelasting (K66)",
                                f"€ {summary.voorbelasting:,.2f}"
                            )

                        with metric_col4:
                            st.metric(
                                "Te Betalen (K83)",
                                f"€ {summary.te_betalen:,.2f}",
                                delta=None,
                                delta_color="inverse"
                            )

                        st.markdown('<div class="german-flag-bar"></div>', unsafe_allow_html=True)

                        # Visualizations
                        col_chart1, col_chart2 = st.columns(2)

                        with col_chart1:
                            st.plotly_chart(create_kennziffer_chart(summary), use_container_width=True)

                        with col_chart2:
                            st.plotly_chart(create_vat_chart(summary), use_container_width=True)

                        # Umsatzsteuer-Voranmeldung
                        st.subheader("📋 Umsatzsteuer-Voranmeldung")
                        vat_table = format_vat_summary_table(summary)
                        st.dataframe(vat_table, use_container_width=True, hide_index=True)

                        # Download button for VA
                        col_btn1, col_btn2, col_btn3 = st.columns([1, 1, 2])
                        with col_btn1:
                            add_download_button(
                                vat_table,
                                "Umsatzsteuer_Voranmeldung.xlsx",
                                "📥 Download VA Report"
                            )

                        # Zusammenfassende Meldung
                        st.markdown('<div class="german-flag-bar"></div>', unsafe_allow_html=True)
                        st.subheader("📋 Zusammenfassende Meldung (ZM)")
                        zm_report = calculator.generate_zm_report(summary)

                        if not zm_report.empty:
                            # Summary statistics at top
                            total_zm = zm_report['Bedrag (EUR)'].sum()
                            num_customers = len(zm_report)

                            col_zm1, col_zm2, col_zm3 = st.columns([1, 1, 2])
                            with col_zm1:
                                st.metric("Totaal EU Leveringen", f"€ {total_zm:,.2f}")
                            with col_zm2:
                                st.metric("Aantal EU Klanten", num_customers)

                            # ZM Table
                            st.dataframe(zm_report, use_container_width=True, hide_index=True)

                            # Download button for ZM
                            with col_btn2:
                                add_download_button(
                                    zm_report,
                                    "Zusammenfassende_Meldung.xlsx",
                                    "📥 Download ZM Report"
                                )
                        else:
                            st.info("ℹ️ Geen EU-leveringen gevonden in deze periode.")

                except Exception as e:
                    st.error(f"❌ Fout bij verwerken: {str(e)}")
                    st.exception(e)

    # ========== TAB 2: Annual Declaration ==========
    with tab2:
        st.header("Jaaraangifte - Umsatzsteuererklärung")
        st.markdown("""
        Upload **alle** SalesInvoice en PurchaseInvoice bestanden voor het hele jaar
        (bijv. 12 maanden) om de jaaraangifte te genereren.
        """)

        # File uploaders
        col1, col2 = st.columns(2)

        with col1:
            st.subheader("📤 Sales Invoices (Verkopen)")
            annual_sales_files = st.file_uploader(
                "Upload alle SalesInvoice bestanden voor het jaar",
                type=['xlsx', 'xls'],
                accept_multiple_files=True,
                key='sales_annual'
            )

        with col2:
            st.subheader("📥 Purchase Invoices (Inkopen)")
            annual_purchase_files = st.file_uploader(
                "Upload alle PurchaseInvoice bestanden voor het jaar",
                type=['xlsx', 'xls'],
                accept_multiple_files=True,
                key='purchase_annual'
            )

        if st.button("🔄 Bereken Jaaraangifte", type="primary", key='calc_annual'):
            if not annual_sales_files and not annual_purchase_files:
                st.error("⚠️ Upload minimaal één Sales- of Purchase-bestand!")
            else:
                try:
                    with st.spinner("Bezig met verwerken van jaargegevens..."):
                        calculator = VATCalculator()

                        # Load sales files
                        if annual_sales_files:
                            st.info(f"📂 Verwerken van {len(annual_sales_files)} sales bestand(en)...")
                            for sales_file in annual_sales_files:
                                calculator.load_sales_file(sales_file)
                                st.success(f"✅ Geladen: {sales_file.name}")

                        # Load purchase files
                        if annual_purchase_files:
                            st.info(f"📂 Verwerken van {len(annual_purchase_files)} purchase bestand(en)...")
                            for purchase_file in annual_purchase_files:
                                calculator.load_purchase_file(purchase_file)
                                st.success(f"✅ Geladen: {purchase_file.name}")

                        # Calculate annual VAT
                        annual_report = calculator.calculate_annual_vat()

                        # Display results
                        st.success("✅ Jaaraangifte berekening voltooid!")

                        # Key metrics for annual report at top
                        st.markdown('<div class="german-flag-bar"></div>', unsafe_allow_html=True)
                        st.subheader("📊 Jaar Samenvatting")

                        metric_col1, metric_col2, metric_col3 = st.columns(3)

                        with metric_col1:
                            st.metric(
                                "Binnenlandse Omzet",
                                f"€ {annual_report['Line 22 - Lieferungen zu 19%']:,.2f}"
                            )

                        with metric_col2:
                            st.metric(
                                "EU Leveringen",
                                f"€ {annual_report['Line 38 - Innergem. Lieferungen']:,.2f}"
                            )

                        with metric_col3:
                            st.metric(
                                "Totaal Saldo",
                                f"€ {annual_report['Line 108/110 - Totaal Saldo']:,.2f}",
                                delta_color="inverse"
                            )

                        st.markdown('<div class="german-flag-bar"></div>', unsafe_allow_html=True)

                        # Visualization
                        st.plotly_chart(create_annual_comparison_chart(annual_report), use_container_width=True)

                        # Detailed table
                        st.subheader("📋 Umsatzsteuererklärung - Jaaroverzicht")

                        # Convert to dataframe
                        annual_df = pd.DataFrame([
                            {"Regel": "Line 22", "Omschrijving": "Lieferungen zu 19%",
                             "Bedrag (EUR)": annual_report['Line 22 - Lieferungen zu 19%']},
                            {"Regel": "Line 38", "Omschrijving": "Innergem. Lieferungen",
                             "Bedrag (EUR)": annual_report['Line 38 - Innergem. Lieferungen']},
                            {"Regel": "Line 51", "Omschrijving": "Innergem. Erwerbe (19%)",
                             "Bedrag (EUR)": annual_report['Line 51 - Innergem. Erwerbe (19%)']},
                            {"Regel": "Line 79", "Omschrijving": "Vorsteuer (Rechnungen)",
                             "Bedrag (EUR)": annual_report['Line 79 - Vorsteuer (Rechnungen)']},
                            {"Regel": "Line 80", "Omschrijving": "Vorsteuer (Innergem. Erw.)",
                             "Bedrag (EUR)": annual_report['Line 80 - Vorsteuer (Innergem. Erw.)']},
                            {"Regel": "Line 108/110", "Omschrijving": "Totaal Saldo",
                             "Bedrag (EUR)": annual_report['Line 108/110 - Totaal Saldo']},
                        ])

                        st.dataframe(annual_df, use_container_width=True, hide_index=True)

                        # Download button
                        add_download_button(
                            annual_df,
                            "Umsatzsteuererklaerung_Jaar.xlsx",
                            "📥 Download Jaaraangifte Report"
                        )

                except Exception as e:
                    st.error(f"❌ Fout bij verwerken: {str(e)}")
                    st.exception(e)

    # Sidebar with information
    with st.sidebar:
        # German flag header
        st.markdown('<div class="german-flag-bar"></div>', unsafe_allow_html=True)
        st.header("ℹ️ Informatie")

        st.markdown("""
        <div style='background-color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;'>
            <h3 style='color: #DD0000; margin-top: 0;'>📄 Bestandsformaat</h3>
            <p style='font-size: 0.9rem;'><strong>SalesInvoice bestanden:</strong></p>
            <ul style='font-size: 0.85rem;'>
                <li>Handelsregio (Eigen land/EU)</li>
                <li>Fiscaal land (DE/NL/etc)</li>
                <li>Tot. vrk. ex. BTW</li>
                <li>BTW-laag / BTW-hoog</li>
                <li>BTW-nr.</li>
            </ul>
            <p style='font-size: 0.9rem;'><strong>PurchaseInvoice bestanden:</strong></p>
            <ul style='font-size: 0.85rem;'>
                <li>Land ISO-code (Origin)</li>
                <li>Tot. ink. ex. BTW</li>
                <li>Tot. BTW</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("""
        <div style='background-color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;'>
            <h3 style='color: #DD0000; margin-top: 0;'>🔍 Berekeningslogica</h3>
            <p style='font-size: 0.9rem;'><strong>Verkopen:</strong></p>
            <ul style='font-size: 0.85rem;'>
                <li><strong>Eigen land</strong> → Binnenlands (19%)</li>
                <li><strong>EU</strong> → ICP Leveringen</li>
            </ul>
            <p style='font-size: 0.9rem;'><strong>Inkopen:</strong></p>
            <ul style='font-size: 0.85rem;'>
                <li><strong>BTW > 0</strong> → Binnenlandse inkoop</li>
                <li><strong>BTW = 0 & EU</strong> → Intracommunautaire verwerving</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("""
        <div style='background-color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;'>
            <h3 style='color: #DD0000; margin-top: 0;'>📊 Kennziffern</h3>
            <ul style='font-size: 0.85rem;'>
                <li><strong>K81:</strong> Omzet 19%</li>
                <li><strong>K41:</strong> ICP Leveringen</li>
                <li><strong>K66:</strong> Voorbelasting</li>
                <li><strong>K83:</strong> Te Betalen</li>
            </ul>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("---")
        st.markdown('<div class="german-flag-bar"></div>', unsafe_allow_html=True)
        st.markdown("""
        <div style='text-align: center; padding: 1rem;'>
            <p style='font-size: 0.9rem; margin: 0;'><strong>German VAT & ZM Tool</strong></p>
            <p style='font-size: 0.8rem; color: #666; margin: 0.5rem 0 0 0;'>Versie 2.0.0</p>
            <p style='font-size: 0.75rem; color: #999; margin: 0.25rem 0 0 0;'>2026-01-02</p>
        </div>
        """, unsafe_allow_html=True)


if __name__ == "__main__":
    main()
