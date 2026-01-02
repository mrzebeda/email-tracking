"""
German VAT & ZM Tool - Core Calculation Module
Processes sales and purchase invoices for German tax declarations
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple
from dataclasses import dataclass


@dataclass
class VATSummary:
    """Summary of VAT calculations"""
    omzet_19_percent: float = 0.0  # Kennziffer 81
    icp_leveringen_eu: float = 0.0  # Kennziffer 41
    voorbelasting: float = 0.0  # Kennziffer 66
    te_betalen: float = 0.0  # Kennziffer 83

    # Additional data for ZM
    eu_sales_by_vat_nr: Dict[str, float] = None

    # Annual declaration fields
    innergem_erwerbe_19: float = 0.0  # Line 51
    vorsteuer_erwerbe: float = 0.0  # Line 80

    def __post_init__(self):
        if self.eu_sales_by_vat_nr is None:
            self.eu_sales_by_vat_nr = {}


class VATCalculator:
    """Main calculator for German VAT declarations"""

    VAT_RATE_HIGH = 0.19  # 19%
    VAT_RATE_LOW = 0.07   # 7%

    def __init__(self):
        self.sales_data = []
        self.purchase_data = []

    def load_sales_file(self, file_path_or_buffer) -> pd.DataFrame:
        """
        Load sales invoice Excel file
        Expected columns: Handelsregio, Fiscaal land, Tot. vrk. ex. BTW,
                         BTW-laag, BTW-hoog, BTW-nr.
        """
        try:
            df = pd.read_excel(file_path_or_buffer, engine='openpyxl')

            # Normalize column names (strip whitespace, handle variations)
            df.columns = df.columns.str.strip()

            # Validate required columns
            required_cols = ['Handelsregio', 'Fiscaal land', 'Tot. vrk. ex. BTW']
            missing_cols = [col for col in required_cols if col not in df.columns]

            if missing_cols:
                # Try alternative column names
                col_mapping = {
                    'Handelsregio': ['Handelsregio', 'Trade Region', 'Region'],
                    'Fiscaal land': ['Fiscaal land', 'Fiscal Country', 'Country'],
                    'Tot. vrk. ex. BTW': ['Tot. vrk. ex. BTW', 'Total excl. VAT', 'Total Sales excl. VAT'],
                    'BTW-nr.': ['BTW-nr.', 'BTW-nr', 'VAT Number', 'VAT-nr'],
                    'BTW-hoog': ['BTW-hoog', 'VAT High', 'BTW hoog'],
                    'BTW-laag': ['BTW-laag', 'VAT Low', 'BTW laag']
                }

                # Attempt to map columns
                for std_col, alternatives in col_mapping.items():
                    for alt in alternatives:
                        if alt in df.columns and std_col not in df.columns:
                            df.rename(columns={alt: std_col}, inplace=True)
                            break

            # Fill NaN values
            if 'BTW-nr.' not in df.columns:
                df['BTW-nr.'] = ''
            df['BTW-nr.'] = df['BTW-nr.'].fillna('')

            if 'BTW-hoog' not in df.columns:
                df['BTW-hoog'] = 0.0
            df['BTW-hoog'] = df['BTW-hoog'].fillna(0.0)

            if 'BTW-laag' not in df.columns:
                df['BTW-laag'] = 0.0
            df['BTW-laag'] = df['BTW-laag'].fillna(0.0)

            df['Handelsregio'] = df['Handelsregio'].fillna('Eigen land')
            df['Fiscaal land'] = df['Fiscaal land'].fillna('DE')
            df['Tot. vrk. ex. BTW'] = df['Tot. vrk. ex. BTW'].fillna(0.0)

            self.sales_data.append(df)
            return df

        except Exception as e:
            raise ValueError(f"Error loading sales file: {str(e)}")

    def load_purchase_file(self, file_path_or_buffer) -> pd.DataFrame:
        """
        Load purchase invoice Excel file
        Expected columns: Land ISO-code (Origin), Tot. ink. ex. BTW, Tot. BTW
        """
        try:
            df = pd.read_excel(file_path_or_buffer, engine='openpyxl')

            # Normalize column names
            df.columns = df.columns.str.strip()

            # Column mapping for purchases
            col_mapping = {
                'Land ISO-code': ['Land ISO-code', 'Country ISO', 'ISO Code', 'Origin'],
                'Tot. ink. ex. BTW': ['Tot. ink. ex. BTW', 'Total excl. VAT', 'Total Purchase excl. VAT'],
                'Tot. BTW': ['Tot. BTW', 'Total VAT', 'VAT']
            }

            for std_col, alternatives in col_mapping.items():
                for alt in alternatives:
                    if alt in df.columns and std_col not in df.columns:
                        df.rename(columns={alt: std_col}, inplace=True)
                        break

            # Fill NaN values
            df['Land ISO-code'] = df['Land ISO-code'].fillna('DE')
            df['Tot. ink. ex. BTW'] = df['Tot. ink. ex. BTW'].fillna(0.0)
            df['Tot. BTW'] = df['Tot. BTW'].fillna(0.0)

            self.purchase_data.append(df)
            return df

        except Exception as e:
            raise ValueError(f"Error loading purchase file: {str(e)}")

    def calculate_periodic_vat(self) -> VATSummary:
        """
        Calculate Umsatzsteuer-Voranmeldung (monthly/quarterly)
        Returns VATSummary with Kennziffern 81, 41, 66, 83
        """
        summary = VATSummary()

        # Process Sales Data
        if self.sales_data:
            all_sales = pd.concat(self.sales_data, ignore_index=True)

            # Kennziffer 81: Omzet 19% (Domestic sales - Eigen land)
            domestic_sales = all_sales[all_sales['Handelsregio'] == 'Eigen land']
            summary.omzet_19_percent = domestic_sales['Tot. vrk. ex. BTW'].sum()

            # Kennziffer 41: ICP Leveringen (EU sales)
            eu_sales = all_sales[all_sales['Handelsregio'] == 'EU']
            summary.icp_leveringen_eu = eu_sales['Tot. vrk. ex. BTW'].sum()

            # Prepare ZM data: Group EU sales by BTW-nr.
            if not eu_sales.empty:
                eu_grouped = eu_sales.groupby('BTW-nr.')['Tot. vrk. ex. BTW'].sum()
                summary.eu_sales_by_vat_nr = eu_grouped.to_dict()

        # Process Purchase Data
        if self.purchase_data:
            all_purchases = pd.concat(self.purchase_data, ignore_index=True)

            # Kennziffer 66: Voorbelasting (Vorsteuer) - Domestic purchases with VAT
            summary.voorbelasting = all_purchases['Tot. BTW'].sum()

            # Calculate intracommunautaire verwervingen for annual report
            # EU purchases: BTW = 0 & country is EU (not DE)
            eu_countries = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI',
                          'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV',
                          'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']

            eu_purchases = all_purchases[
                (all_purchases['Tot. BTW'] == 0) &
                (all_purchases['Land ISO-code'].isin(eu_countries))
            ]

            if not eu_purchases.empty:
                eu_purchase_amount = eu_purchases['Tot. ink. ex. BTW'].sum()
                summary.innergem_erwerbe_19 = eu_purchase_amount * self.VAT_RATE_HIGH
                summary.vorsteuer_erwerbe = summary.innergem_erwerbe_19

        # Kennziffer 83: Te Betalen (Amount to pay)
        # Formula: (Omzet 19% * 0.19) - Voorbelasting
        vat_on_sales = summary.omzet_19_percent * self.VAT_RATE_HIGH
        summary.te_betalen = vat_on_sales - summary.voorbelasting

        return summary

    def generate_zm_report(self, summary: VATSummary) -> pd.DataFrame:
        """
        Generate Zusammenfassende Meldung (ZM) report
        EU sales grouped by VAT number
        """
        if not summary.eu_sales_by_vat_nr:
            return pd.DataFrame(columns=['BTW-nr.', 'Bedrag (EUR)', 'Code'])

        zm_data = []
        for vat_nr, amount in summary.eu_sales_by_vat_nr.items():
            if amount > 0:  # Only include non-zero amounts
                zm_data.append({
                    'BTW-nr.': vat_nr,
                    'Bedrag (EUR)': round(amount, 2),
                    'Code': '05'  # Standard code for goods
                })

        return pd.DataFrame(zm_data)

    def calculate_annual_vat(self) -> Dict[str, float]:
        """
        Calculate Umsatzsteuererklärung (Annual declaration)
        Returns dictionary with line numbers as keys
        """
        summary = self.calculate_periodic_vat()

        annual_report = {
            'Line 22 - Lieferungen zu 19%': round(summary.omzet_19_percent, 2),
            'Line 38 - Innergem. Lieferungen': round(summary.icp_leveringen_eu, 2),
            'Line 51 - Innergem. Erwerbe (19%)': round(summary.innergem_erwerbe_19, 2),
            'Line 79 - Vorsteuer (Rechnungen)': round(summary.voorbelasting, 2),
            'Line 80 - Vorsteuer (Innergem. Erw.)': round(summary.vorsteuer_erwerbe, 2),
        }

        # Calculate final balance (Line 108/110)
        total_vat_due = summary.omzet_19_percent * self.VAT_RATE_HIGH + summary.innergem_erwerbe_19
        total_vorsteuer = summary.voorbelasting + summary.vorsteuer_erwerbe
        final_balance = total_vat_due - total_vorsteuer

        annual_report['Line 108/110 - Totaal Saldo'] = round(final_balance, 2)

        return annual_report

    def reset_data(self):
        """Clear all loaded data"""
        self.sales_data = []
        self.purchase_data = []


def format_currency(value: float) -> str:
    """Format value as EUR currency"""
    return f"€ {value:,.2f}"


def format_vat_summary_table(summary: VATSummary) -> pd.DataFrame:
    """Format VAT summary as display table"""
    data = {
        'Categorie': [
            'Omzet 19%',
            'ICP Leveringen (EU)',
            'Voorbelasting (Vorsteuer)',
            'Te Betalen'
        ],
        'Kennziffer': [81, 41, 66, 83],
        'Bedrag (EUR)': [
            summary.omzet_19_percent,
            summary.icp_leveringen_eu,
            summary.voorbelasting,
            summary.te_betalen
        ]
    }

    df = pd.DataFrame(data)
    df['Bedrag (EUR)'] = df['Bedrag (EUR)'].apply(lambda x: round(x, 2))

    return df
