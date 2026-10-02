"""Refresh the public SP domestic tariff history. No third-party dependencies."""
import argparse
from datetime import date, datetime, timedelta
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import tempfile
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET
import zipfile

PAGE_URL = 'https://www.spgroup.com.sg/our-services/utilities/tariff-information'
HISTORY_URL = 'https://www.spgroup.com.sg/dam/spgroup/pdf/resources/billing/Historical-Electricity-Tariff.xlsx'
DATA_PATH = Path(__file__).resolve().parents[1] / 'data' / 'sp-tariffs.json'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


class PageText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data.strip())


def parse_current(html):
    parser = PageText()
    parser.feed(html)
    text = ' '.join(parser.parts)
    quarter = re.search(r'Q([1-4])\s+(20\d{2})\s+Electricity Tariff\s*\(before GST\)', text)
    rate = re.search(r'(\d+\.\d+)\s+cents/kWh\s+(\d+\.\d+)\s+cents/kWh\s*\(w/o GST\)\s+ELECTRICITY TARIFF\s*\(wef\s+1\s+(Jan|Apr|Jul|Oct)\s*-\s*(?:30|31)\s+(Mar|Jun|Sep|Dec)\s+(\d{2})\)', text)
    if not quarter or not rate:
        raise ValueError('SP electricity figure or quarter format changed; refusing to update.')
    q, year = int(quarter[1]), int(quarter[2])
    if rate[3] != ['Jan', 'Apr', 'Jul', 'Oct'][q - 1] or int(rate[5]) != year % 100 or rate[4] != ['Mar', 'Jun', 'Sep', 'Dec'][q - 1]:
        raise ValueError('SP electricity figure and quarter disagree.')
    before, after = float(rate[2]), float(rate[1])
    # The workbook explicitly identifies the current GST rate.
    return year, q, before, after


def parse_history(content):
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        strings = [''.join(element.itertext()) for element in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        rows = []
        for row in ET.fromstring(archive.read('xl/worksheets/sheet1.xml')).findall('.//s:row', NS):
            cells = {}
            for cell in row.findall('s:c', NS):
                value = cell.find('s:v', NS)
                if value is not None:
                    column = re.sub(r'\d+', '', cell.attrib['r'])
                    cells[column] = strings[int(value.text)] if cell.attrib.get('t') == 's' else value.text
            rows.append(cells)
    headers = next((r for r in rows if 'not inclusive of GST' in r.get('B', '')), None)
    domestic = next((i for i, r in enumerate(rows) if r.get('B', '').strip() == 'LOW TENSION SUPPLIES, DOMESTIC'), None)
    gst_notes = [r for r in rows if 'excl' in r.get('C', '') and 'GST' in r.get('C', '')]
    if headers is None or domestic is None or not gst_notes:
        raise ValueError('SP workbook domestic headings or GST declaration changed.')
    gst = re.search(r'excl\s+(\d+)% GST', gst_notes[0]['C'])
    if not gst or int(gst[1]) != 9:
        raise ValueError('GST declaration changed; review the tax treatment before updating.')
    values = rows[domestic + 1]
    if not values.get('B', '').strip().startswith('All units, ¢/kWh'):
        raise ValueError('SP domestic rate units changed.')
    tariffs = []
    for column, value in headers.items():
        if column == 'B' or not re.fullmatch(r'\d+(?:\.0+)?', value):
            continue
        start = (datetime(1899, 12, 30) + timedelta(days=float(value))).date()
        if start.year < 2026:
            continue
        if start.day != 1 or start.month not in (1, 4, 7, 10):
            raise ValueError('Unexpected quarter boundary.')
        rate = float(values[column])
        if not 0 < rate < 100:
            raise ValueError('SP domestic tariff outside expected bounds; review required.')
        end_month = start.month + 2
        tariffs.append({
            'quarter': f'{start.year}-Q{(start.month - 1) // 3 + 1}',
            'startMonth': start.strftime('%Y-%m'),
            'endMonth': f'{start.year}-{end_month:02}',
            'centsPerKwhBeforeGst': round(rate, 2),
            'gstRate': 0.09,
            'sourceUrl': HISTORY_URL,
        })
    tariffs.sort(key=lambda t: t['startMonth'])
    if not tariffs or tariffs[0]['startMonth'] != '2026-01':
        raise ValueError('History must start in January 2026.')
    for previous, current in zip(tariffs, tariffs[1:]):
        year, month = map(int, previous['startMonth'].split('-'))
        expected = f'{year + (month == 10)}-{1 if month == 10 else month + 3:02}'
        if current['startMonth'] != expected:
            raise ValueError('Missing or duplicate historical quarter.')
    return tariffs


def prepare_update(existing, html, workbook, today=None):
    today = today or date.today()
    year, quarter, before, after = parse_current(html)
    tariffs = parse_history(workbook)
    latest = tariffs[-1]
    if latest['quarter'] != f'{year}-Q{quarter}' or latest['centsPerKwhBeforeGst'] != before:
        raise ValueError('Latest SP page and workbook disagree; refusing to update.')
    if abs(round(before * (1 + latest['gstRate']), 2) - after) > 0.001:
        raise ValueError('Published GST-inclusive tariff does not reconcile.')
    current_quarter = f'{today.year}-Q{(today.month - 1) // 3 + 1}'
    if latest['quarter'] < current_quarter:
        raise ValueError('SP has not published the current quarter yet; retry later.')
    if existing:
        new_by_quarter = {t['quarter']: t for t in tariffs}
        for old in existing['tariffs']:
            if new_by_quarter.get(old['quarter']) != old:
                raise ValueError('Previously stored tariff changed or disappeared; manual review required.')
        if existing['tariffs'] == tariffs:
            return existing
    return {'version': 1, 'updatedOn': today.isoformat(), 'sourceUrl': PAGE_URL, 'tariffs': tariffs}


def download(url):
    request = Request(url, headers={'User-Agent': 'Perception-Tariff-Refresh/1.0'})
    with urlopen(request, timeout=45) as response:
        content = response.read(5_000_001)
    if len(content) > 5_000_000:
        raise ValueError('SP response exceeds expected size.')
    return content


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--page-file', type=Path)
    parser.add_argument('--history-file', type=Path)
    parser.add_argument('--output', type=Path, default=DATA_PATH)
    args = parser.parse_args()
    html = args.page_file.read_text() if args.page_file else download(PAGE_URL).decode('utf-8')
    workbook = args.history_file.read_bytes() if args.history_file else download(HISTORY_URL)
    existing = json.loads(args.output.read_text()) if args.output.exists() else None
    result = prepare_update(existing, html, workbook)
    if result == existing:
        print('SP tariffs unchanged; no commit or deployment needed.')
        return
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Validate the whole response before atomically replacing the saved history.
    with tempfile.NamedTemporaryFile(mode='w', dir=args.output.parent, delete=False) as file:
        json.dump(result, file, indent=2, ensure_ascii=False)
        file.write('\n')
        temporary = Path(file.name)
    temporary.replace(args.output)
    print(f'Validated and stored {len(result["tariffs"])} quarterly tariffs.')


if __name__ == '__main__':
    main()
