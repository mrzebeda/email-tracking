"""
German VAT & ZM Tool - Streamlit Application
Processes sales and purchase invoices for German tax declarations
"""

import streamlit as st
import pandas as pd
from io import BytesIO
from vat_calculator import VATCalculator, format_vat_summary_table


# Page configuration
st.set_page_config(
    page_title="German VAT & ZM Tool",
    page_icon="🇩🇪",
    layout="wide"
)


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


def main():
    st.title("🇩🇪 German VAT & ZM Tool")
    st.markdown("""
    Dit programma verwerkt **SalesInvoice** en **PurchaseInvoice** Excel-bestanden om de cijfers
    voor de Duitse BTW-aangifte (Umsatzsteuer-Voranmeldung), de Zusammenfassende Meldung (ZM),
    en de Jaaraangifte (Umsatzsteuererklärung) te genereren.
    """)

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

                        # Umsatzsteuer-Voranmeldung
                        st.subheader("📋 Umsatzsteuer-Voranmeldung")
                        vat_table = format_vat_summary_table(summary)
                        st.dataframe(vat_table, use_container_width=True, hide_index=True)

                        # Download button for VA
                        add_download_button(
                            vat_table,
                            "Umsatzsteuer_Voranmeldung.xlsx",
                            "📥 Download VA Report"
                        )

                        # Zusammenfassende Meldung
                        st.subheader("📋 Zusammenfassende Meldung (ZM)")
                        zm_report = calculator.generate_zm_report(summary)

                        if not zm_report.empty:
                            st.dataframe(zm_report, use_container_width=True, hide_index=True)

                            # Summary statistics
                            total_zm = zm_report['Bedrag (EUR)'].sum()
                            st.metric("Totaal EU Leveringen", f"€ {total_zm:,.2f}")

                            # Download button for ZM
                            add_download_button(
                                zm_report,
                                "Zusammenfassende_Meldung.xlsx",
                                "📥 Download ZM Report"
                            )
                        else:
                            st.info("ℹ️ Geen EU-leveringen gevonden in deze periode.")

                        # Key metrics display
                        st.subheader("📊 Samenvatting")
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

                        # Key metrics for annual report
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

                except Exception as e:
                    st.error(f"❌ Fout bij verwerken: {str(e)}")
                    st.exception(e)

    # Sidebar with information
    with st.sidebar:
        st.header("ℹ️ Informatie")
        st.markdown("""
        ### Verwachte Bestandsformaat

        **SalesInvoice bestanden:**
        - Handelsregio (Eigen land/EU)
        - Fiscaal land (DE/NL/etc)
        - Tot. vrk. ex. BTW
        - BTW-laag
        - BTW-hoog
        - BTW-nr.

        **PurchaseInvoice bestanden:**
        - Land ISO-code (Origin)
        - Tot. ink. ex. BTW
        - Tot. BTW

        ### Logica
        **Verkopen:**
        - Handelsregio = 'Eigen land' → Binnenlands (19%)
        - Handelsregio = 'EU' → ICP Leveringen

        **Inkopen:**
        - BTW > 0 → Binnenlandse inkoop (Vorsteuer)
        - BTW = 0 & EU land → Intracommunautaire verwerving
        """)

        st.markdown("---")
        st.markdown("**Versie:** 1.0.0")
        st.markdown("**Datum:** 2026-01-02")


if __name__ == "__main__":
    main()
