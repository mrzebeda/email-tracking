"""
Sample Data Generator for German VAT & ZM Tool
Generates example Excel files for testing
"""

import pandas as pd
import random
from datetime import datetime


def generate_sample_sales_invoices(filename: str, num_rows: int = 20):
    """Generate sample SalesInvoice Excel file"""

    regions = ['Eigen land', 'EU', 'Eigen land', 'Eigen land']  # More domestic sales
    countries = {
        'Eigen land': 'DE',
        'EU': random.choice(['NL', 'FR', 'BE', 'AT', 'IT'])
    }

    vat_numbers = {
        'NL': 'NL123456789B01',
        'FR': 'FR12345678901',
        'BE': 'BE0123456789',
        'AT': 'ATU12345678',
        'IT': 'IT12345678901'
    }

    data = []
    for i in range(num_rows):
        region = random.choice(regions)
        country = countries[region] if region == 'Eigen land' else random.choice(['NL', 'FR', 'BE', 'AT', 'IT'])

        # Base amount
        base_amount = round(random.uniform(500, 15000), 2)

        if region == 'Eigen land':
            # Domestic sale with 19% VAT
            vat_high = round(base_amount * 0.19, 2)
            vat_low = 0
            vat_nr = ''
        else:
            # EU sale - no VAT, but need VAT number
            vat_high = 0
            vat_low = 0
            vat_nr = vat_numbers.get(country, 'EU000000000')

        data.append({
            'Handelsregio': region,
            'Fiscaal land': country,
            'Tot. vrk. ex. BTW': base_amount,
            'BTW-laag': vat_low,
            'BTW-hoog': vat_high,
            'BTW-nr.': vat_nr
        })

    df = pd.DataFrame(data)
    df.to_excel(filename, index=False, engine='openpyxl')
    print(f"✅ Created: {filename} with {num_rows} rows")
    print(f"   - Domestic sales: {len(df[df['Handelsregio']=='Eigen land'])}")
    print(f"   - EU sales: {len(df[df['Handelsregio']=='EU'])}")
    print(f"   - Total sales (excl. VAT): € {df['Tot. vrk. ex. BTW'].sum():,.2f}")


def generate_sample_purchase_invoices(filename: str, num_rows: int = 15):
    """Generate sample PurchaseInvoice Excel file"""

    countries = ['DE', 'DE', 'DE', 'NL', 'FR']  # More domestic purchases
    eu_countries = ['NL', 'FR', 'BE', 'AT', 'IT']

    data = []
    for i in range(num_rows):
        country = random.choice(countries)
        base_amount = round(random.uniform(300, 10000), 2)

        if country == 'DE':
            # Domestic purchase with 19% VAT
            vat_amount = round(base_amount * 0.19, 2)
        elif country in eu_countries:
            # EU purchase - no VAT (reverse charge)
            vat_amount = 0
        else:
            vat_amount = 0

        data.append({
            'Land ISO-code': country,
            'Tot. ink. ex. BTW': base_amount,
            'Tot. BTW': vat_amount
        })

    df = pd.DataFrame(data)
    df.to_excel(filename, index=False, engine='openpyxl')
    print(f"✅ Created: {filename} with {num_rows} rows")
    print(f"   - Domestic purchases: {len(df[df['Land ISO-code']=='DE'])}")
    print(f"   - EU purchases: {len(df[df['Land ISO-code']!='DE'])}")
    print(f"   - Total purchases (excl. VAT): € {df['Tot. ink. ex. BTW'].sum():,.2f}")
    print(f"   - Total VAT: € {df['Tot. BTW'].sum():,.2f}")


def main():
    """Generate all sample files"""
    print("🔧 Generating sample data files for German VAT & ZM Tool...\n")

    # Create sample_data directory
    import os
    os.makedirs('sample_data', exist_ok=True)

    # Generate Q3 sample files (3 months)
    print("📅 Generating Q3 2025 sample data (Juli, Augustus, September)...\n")

    generate_sample_sales_invoices('sample_data/SalesInvoice_DE_Juli_2025.xlsx', 25)
    generate_sample_purchase_invoices('sample_data/PurchaseInvoice_DE_Juli_2025.xlsx', 18)
    print()

    generate_sample_sales_invoices('sample_data/SalesInvoice_DE_Augustus_2025.xlsx', 22)
    generate_sample_purchase_invoices('sample_data/PurchaseInvoice_DE_Augustus_2025.xlsx', 15)
    print()

    generate_sample_sales_invoices('sample_data/SalesInvoice_DE_September_2025.xlsx', 28)
    generate_sample_purchase_invoices('sample_data/PurchaseInvoice_DE_September_2025.xlsx', 20)
    print()

    # Generate November sample file
    print("📅 Generating November 2025 sample data...\n")
    generate_sample_sales_invoices('sample_data/SalesInvoice_DE_November_2025.xlsx', 24)
    generate_sample_purchase_invoices('sample_data/PurchaseInvoice_DE_November_2025.xlsx', 17)
    print()

    print("✅ All sample data files generated successfully!")
    print("\n📂 Files created in 'sample_data/' directory:")
    print("   - SalesInvoice_DE_Juli_2025.xlsx")
    print("   - PurchaseInvoice_DE_Juli_2025.xlsx")
    print("   - SalesInvoice_DE_Augustus_2025.xlsx")
    print("   - PurchaseInvoice_DE_Augustus_2025.xlsx")
    print("   - SalesInvoice_DE_September_2025.xlsx")
    print("   - PurchaseInvoice_DE_September_2025.xlsx")
    print("   - SalesInvoice_DE_November_2025.xlsx")
    print("   - PurchaseInvoice_DE_November_2025.xlsx")
    print("\n💡 You can now upload these files in the Streamlit app for testing!")


if __name__ == "__main__":
    main()
