"""Isolated saved-byte reader qualification. Run from the repository root."""
import ctypes
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
READERS = Path(os.environ.get('PDF_QUALIFICATION_READERS', HERE)).resolve()
sys.path.insert(0, str(READERS / 'python'))
import pypdf
import pypdfium2 as pdfium
import pypdfium2.raw as raw

PINS = {'pypdf': '6.21.1', 'pypdfium2': '5.14.0', 'pdfjs': '6.4.299',
        'nativePdfium': '156.0.8076.0', 'nativePdfiumBuild': 8076}
QUERIES = ['[SQL]', 'عن بعد', 'السَّلَامُ', '٢٥']
# Unicode White_Space only. No normalization, bidi stripping or replacement.
WHITESPACE = re.compile('[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]')


def compact(text):
    return WHITESPACE.sub('', text)


def compare(text, expected):
    actual, source = compact(text), compact(expected)
    first = next((i for i, pair in enumerate(zip(actual, source)) if pair[0] != pair[1]), None)
    if first is None and len(actual) != len(source):
        first = min(len(actual), len(source))
    return {
        'exact': actual == source,
        'nfcDiagnostic': unicodedata.normalize('NFC', actual) == unicodedata.normalize('NFC', source),
        'noInvalidScalars': not any(char in text for char in ['\0', '\ufffd'])
        and not any(0xd800 <= ord(char) <= 0xdfff for char in text),
        'firstMismatch': None if first is None else {
            'compactIndex': first, 'actual': actual[max(0, first - 12):first + 24],
            'expected': source[max(0, first - 12):first + 24],
        },
    }


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def brave_version():
    file = r'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe'
    command = "(Get-Item -LiteralPath '" + file + "').VersionInfo.ProductVersion"
    try:
        result = subprocess.run(['powershell', '-NoProfile', '-Command', command], capture_output=True, text=True)
    except FileNotFoundError as error:
        # GUI inventory is optional evidence; missing PowerShell must not discard
        # the saved-byte failures or promote an untested browser to qualified.
        return {'file': file, 'productVersion': None, 'error': str(error), 'uiQualified': False}
    return {'file': file, 'productVersion': result.stdout.strip() or None,
            'error': result.stderr.strip() or None, 'uiQualified': False}


def audit(manifest):
    cases = json.loads(manifest.read_text(encoding='utf-8-sig'))
    if not isinstance(cases, list) or not cases:
        raise ValueError('Manifest must be a nonempty array of {id,file,expected,renderProbe?}.')
    ids = [case['id'] for case in cases]
    if len(set(ids)) != len(ids) or any(not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', id) for id in ids):
        raise ValueError('Case IDs must be unique, filename-safe strings.')
    for case in cases:
        if not isinstance(case['expected'], str) or not compact(case['expected']):
            raise ValueError('Every case needs nonempty source expected text.')
        if not isinstance(case['file'], str) or not Path(case['file']).is_file():
            raise ValueError('Every case needs an existing saved PDF file.')
    output = manifest.with_name(manifest.stem + '-qualification.json')
    pdfjs_output = manifest.with_name(manifest.stem + '-pdfjs.json')
    # Remove only this run's previous extraction, so failed Node cannot reuse stale green evidence.
    pdfjs_output.unlink(missing_ok=True)
    node = subprocess.run(['node', str(HERE / 'probe-pdfjs.mjs'), str(manifest), str(pdfjs_output)],
                          capture_output=True, text=True, encoding='utf-8', errors='replace')
    javascript = json.loads(pdfjs_output.read_text(encoding='utf-8')) if pdfjs_output.exists() else {'results': []}
    js_results = {result['id']: result for result in javascript['results']}
    versions = {'pypdf': pypdf.__version__, 'pypdfium2': pdfium.PYPDFIUM_INFO.tag,
                'pdfjs': javascript.get('version'), 'nativePdfium': str(pdfium.PDFIUM_INFO),
                'nativePdfiumBuild': pdfium.PDFIUM_INFO.build, 'nativePdfiumOrigin': pdfium.PDFIUM_INFO.origin,
                'nativePdfiumFlags': pdfium.PDFIUM_INFO.flags, 'python': sys.version,
                'node': subprocess.check_output(['node', '--version'], text=True).strip()}
    results = []
    for case in cases:
        path = Path(case['file']).resolve()
        data = path.read_bytes()
        result = {'id': case['id'], 'file': str(path), 'expected': case['expected'],
                  'sha256': hashlib.sha256(data).hexdigest(), 'byteLength': len(data)}
        try:
            reader = pypdf.PdfReader(io.BytesIO(data))
            pages = []
            for index, page in enumerate(reader.pages):
                annotations = []
                for ref in page.get('/Annots', []):
                    annotation = ref.get_object()
                    action = annotation.get('/A', {})
                    action = action.get_object() if hasattr(action, 'get_object') else action
                    annotations.append({'subtype': str(annotation.get('/Subtype', '')),
                                        'rect': [float(x) for x in annotation.get('/Rect', [])],
                                        'uri': str(action.get('/URI', ''))})
                pages.append({'page': index + 1, 'text': page.extract_text() or '', 'annotations': annotations})
            pypdf_text = '\n'.join(page['text'] for page in pages)
            result['pypdf'] = {'text': pypdf_text, 'pages': pages, **compare(pypdf_text, case['expected'])}
            searches = {query: [] for query in QUERIES if query in case['expected']}
            native_pages, bad_boxes = [], []
            with pdfium.PdfDocument(data) as document:
                for index, page in enumerate(document):
                    textpage = page.get_textpage()
                    width, height = page.get_size()
                    chars = []
                    for char_index in range(textpage.count_chars()):
                        box = list(textpage.get_charbox(char_index))
                        scalar = raw.FPDFText_GetUnicode(textpage, char_index)
                        chars.append({'index': char_index, 'unicode': scalar, 'box': box})
                        left, bottom, right, top = box
                        if right > left and top > bottom and (left < -.1 or bottom < -.1 or right > width + .1 or top > height + .1):
                            bad_boxes.append({'page': index + 1, **chars[-1]})
                    for query, matches in searches.items():
                        search = textpage.search(query, match_case=True)
                        try:
                            while (match := search.get_next()) is not None:
                                start, count = match
                                matches.append({'page': index + 1, 'index': start, 'count': count,
                                                'text': textpage.get_text_range(start, count, errors='strict'),
                                                'boxes': [chars[i]['box'] for i in range(start, start + count)]})
                        finally:
                            search.close()
                    annotations = []
                    for annotation_index in range(raw.FPDFPage_GetAnnotCount(page)):
                        handle = raw.FPDFPage_GetAnnot(page, annotation_index)
                        if not handle:
                            raise RuntimeError('PDFium failed to load annotation')
                        try:
                            rect = raw.FS_RECTF()
                            has_rect = bool(raw.FPDFAnnot_GetRect(handle, ctypes.byref(rect)))
                            annotations.append({'subtype': raw.FPDFAnnot_GetSubtype(handle),
                                                'rect': [rect.left, rect.bottom, rect.right, rect.top] if has_rect else None})
                        finally:
                            raw.FPDFPage_CloseAnnot(handle)
                    native_page = {'page': index + 1, 'size': [width, height],
                                   'text': textpage.get_text_range(errors='strict'),
                                   'boundedTextDiagnostic': textpage.get_text_bounded(errors='strict'),
                                   'characters': chars, 'annotations': annotations}
                    native_pages.append(native_page)
                    textpage.close()
                    if case.get('renderProbe'):
                        render_path = manifest.with_name(case['id'] + f'-page-{index + 1}-native.png')
                        bitmap = page.render(scale=1.5)
                        try:
                            bitmap.to_pil().save(render_path)
                        finally:
                            bitmap.close()
                        native_page['renderProbe'] = str(render_path)
                    page.close()
            native_text = '\n'.join(page['text'] for page in native_pages)
            result['pdfium'] = {'text': native_text, 'pages': native_pages,
                                **compare(native_text, case['expected'])}
            js = js_results.get(case['id'], {})
            result['pdfjs'] = {'extraction': str(pdfjs_output), 'error': js.get('error'),
                               **compare(js.get('text', ''), case['expected'])}
            result['nativeSearch'] = {'applicableQueries': list(searches), 'matches': searches,
                                      'options': {'matchCase': True, 'matchWholeWord': False, 'flags': raw.FPDF_MATCHCASE},
                                      'literalMatches': {query: [match for match in matches if match['text'] == query] for query, matches in searches.items()}}
            result['extractedLiteralQueries'] = {
                name: {query: query in text for query in searches}
                for name, text in [('pypdf', pypdf_text), ('pdfjs', js.get('text', ''))]
            }
            result['geometryDiagnostic'] = {'outOfPageBoxes': bad_boxes, 'boundedBoxes': not bad_boxes,
                                           'uiSelectionQualified': False}
            expected_links = case.get('links', [])
            pypdf_links = [a['uri'] for p in pages for a in p['annotations'] if a['uri']]
            pdfjs_links = [a.get('unsafeUrl', a.get('url')) for p in js.get('pages', []) for a in p['annotations']]
            result['checks'] = {
                'pypdfExact': result['pypdf']['exact'], 'pdfiumExact': result['pdfium']['exact'],
                'pdfjsExact': result['pdfjs']['exact'],
                'noInvalidScalars': all(result[name]['noInvalidScalars'] for name in ['pypdf', 'pdfium', 'pdfjs']),
                'nativeLiteralSearch': all(any(match['text'] == query for match in matches) for query, matches in searches.items()) if searches else None,
                'expectedLinks': all(link in pypdf_links and link in pdfjs_links for link in expected_links),
                'sameSavedBytes': js.get('sha256') == result['sha256'],
                'expectedSavedBytes': result['sha256'] == case['sha256'] if 'sha256' in case else None,
                'pdfjsExtraction': not js.get('error') and bool(js),
            }
            result['passed'] = all(value for value in result['checks'].values() if value is not None)
        except Exception as error:
            result['error'] = f'{type(error).__name__}: {error}'
            result['passed'] = False
        results.append(result)
        print(case['id'], 'PASS' if result['passed'] else 'FAIL', result.get('checks', result.get('error')), flush=True)
    passed = all(result['passed'] for result in results) and all(versions[key] == value for key, value in PINS.items()) and node.returncode == 0
    dump(output, {'createdAt': datetime.now(timezone.utc).isoformat(), 'manifest': str(manifest),
                  'manifestSha256': hashlib.sha256(manifest.read_bytes()).hexdigest(),
                  'expectedVersions': PINS, 'versions': versions, 'brave': brave_version(),
                  'pdfjsProcess': {'exitCode': node.returncode, 'stdout': node.stdout, 'stderr': node.stderr},
                  'passed': passed, 'results': results})
    print(f'Qualification {"PASS" if passed else "FAIL"}: {output}', flush=True)
    return 0 if passed else 1


def selfcheck():
    assert compare(' A\tB\n', 'AB')['exact']
    assert not compare('ﺳ', 'س')['exact']  # No compatibility/presentation-form folding.
    canonical = compare('ا\u0654', 'أ')
    assert not canonical['exact'] and canonical['nfcDiagnostic']
    assert not compare('السَّلام', 'السَّلَامُ')['exact']
    folder = HERE / 'selfcheck'
    folder.mkdir(exist_ok=True)
    writer = pypdf.PdfWriter()
    page = writer.add_blank_page(width=200, height=200)
    from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
    font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
    stream = DecodedStreamObject()
    stream.set_data(b'BT /F1 12 Tf 30 100 Td ([SQL]) Tj ET')
    page[NameObject('/Contents')] = writer._add_object(stream)
    pdf = folder / 'literal.pdf'
    writer.write(pdf)
    for name, expected, sha256, exit_code in [
        ('positive', '[SQL]', hashlib.sha256(pdf.read_bytes()).hexdigest(), 0),
        ('negative', '[WRONG]', None, 1),
        ('wrong-bytes', '[SQL]', '0' * 64, 1),
    ]:
        manifest = folder / f'{name}.json'
        case = {'id': name, 'file': str(pdf), 'expected': expected}
        if sha256 is not None:
            case['sha256'] = sha256
        dump(manifest, [case])
        result = subprocess.run([sys.executable, '-X', 'utf8', str(HERE / 'audit.py'), str(manifest)])
        evidence = json.loads(manifest.with_name(name + '-qualification.json').read_text(encoding='utf-8'))
        assert result.returncode == exit_code and evidence['passed'] is (exit_code == 0), name
    print('Selfcheck PASS: literal positive exits 0; wrong source/bytes exit 1; NFC never promotes exact failure.')
    return 0


if __name__ == '__main__':
    sys.exit(selfcheck() if sys.argv[1:] == ['--selfcheck'] else audit(Path(sys.argv[1]).resolve()))
