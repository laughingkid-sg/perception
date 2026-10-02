"""Synthetic provider formats only. No captured SP responses are committed."""
from datetime import date, datetime
import importlib.util
import io
from pathlib import Path
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('refresh', Path(__file__).resolve().parents[1] / 'scripts' / 'refresh_tariffs.py')
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)


def page(before=20, after=21.80, year=2026, quarter=4):
    start = ['Jan', 'Apr', 'Jul', 'Oct'][quarter - 1]
    end = ['Mar', 'Jun', 'Sep', 'Dec'][quarter - 1]
    return f'<h2>Q{quarter} {year} Electricity Tariff (before GST)</h2><h4>{after:.2f} cents/kWh</h4><hr/><p>{before:.2f} cents/kWh (w/o GST)<br/>ELECTRICITY TARIFF<br/>(wef 1 {start} - 31 {end} {year % 100})</p><p>11.00 cents/kWh (w/o GST) GAS TARIFF</p>'


def workbook(quarters=(1, 2, 3, 4), rate=20, gst=9, domestic='LOW TENSION SUPPLIES, DOMESTIC'):
    strings = [f'excl {gst}% GST wef 1 Jan 24', 'Rates are not inclusive of GST', domestic, 'All units, ¢/kWh']
    shared = '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + ''.join(f'<si><t>{s}</t></si>' for s in strings) + '</sst>'
    headers = '<c r="B3" t="s"><v>1</v></c>'
    values = '<c r="B5" t="s"><v>3</v></c>'
    for index, q in enumerate(quarters):
        col = chr(ord('C') + index)
        serial = (datetime(2026, (q - 1) * 3 + 1, 1) - datetime(1899, 12, 30)).days
        headers += f'<c r="{col}3"><v>{serial}</v></c>'
        values += f'<c r="{col}5"><v>{rate}</v></c>'
    sheet = f'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c r="C1" t="s"><v>0</v></c></row><row>{headers}</row><row><c r="B4" t="s"><v>2</v></c></row><row>{values}</row></sheetData></worksheet>'
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as archive:
        archive.writestr('xl/sharedStrings.xml', shared)
        archive.writestr('xl/worksheets/sheet1.xml', sheet)
    return data.getvalue()


class RefreshTests(unittest.TestCase):
    def test_reads_domestic_history_and_reconciles_current(self):
        result = refresh.prepare_update(None, page(), workbook(), date(2026, 10, 2))
        self.assertEqual(len(result['tariffs']), 4)
        self.assertEqual(result['tariffs'][0]['startMonth'], '2026-01')
        self.assertEqual(result['tariffs'][-1]['endMonth'], '2026-12')

    def test_unchanged_data_does_not_churn_timestamps(self):
        old = refresh.prepare_update(None, page(), workbook(), date(2026, 10, 2))
        self.assertIs(refresh.prepare_update(old, page(), workbook(), date(2026, 10, 5)), old)

    def test_appends_a_new_quarter(self):
        old = refresh.prepare_update(None, page(quarter=3), workbook(quarters=(1, 2, 3)), date(2026, 7, 1))
        new = refresh.prepare_update(old, page(), workbook(), date(2026, 10, 1))
        self.assertEqual(len(new['tariffs']), 4)
        self.assertEqual(new['tariffs'][:3], old['tariffs'])

    def test_rejects_history_revisions(self):
        old = refresh.prepare_update(None, page(), workbook(), date(2026, 10, 2))
        with self.assertRaisesRegex(ValueError, 'Previously stored'):
            refresh.prepare_update(old, page(before=21, after=22.89), workbook(rate=21), date(2026, 10, 2))

    def test_rejects_incomplete_or_duplicate_history(self):
        for quarters in [(2, 3, 4), (1, 3, 4), (1, 2, 2, 3, 4)]:
            with self.assertRaises(ValueError):
                refresh.parse_history(workbook(quarters=quarters))

    def test_rejects_conflicting_sources_and_tax_changes(self):
        for html, data in [(page(before=21, after=22.89), workbook()), (page(after=22), workbook()), (page(), workbook(gst=10)), (page(), workbook(domestic='NON-DOMESTIC'))]:
            with self.assertRaises(ValueError):
                refresh.prepare_update(None, html, data, date(2026, 10, 2))

    def test_rejects_stale_source_and_changed_html(self):
        with self.assertRaisesRegex(ValueError, 'current quarter'):
            refresh.prepare_update(None, page(quarter=3), workbook(quarters=(1, 2, 3)), date(2026, 10, 2))
        with self.assertRaises(ValueError):
            refresh.parse_current('<p>20.00 cents/kWh GAS TARIFF</p>')


if __name__ == '__main__':
    unittest.main()
