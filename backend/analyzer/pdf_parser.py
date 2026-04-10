from __future__ import annotations

import html
import re
from typing import Any

from pypdf import PdfReader

SECTION_HEADERS = {
    'SUMMARY': 'summary',
    'SKILLS': 'skills',
    'EXPERIENCE': 'experience',
    'EDUCATION': 'education',
    'PROJECTS': 'projects',
}

MONTH_RE = r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*'
DATE_TOKEN_RE = rf'(?:{MONTH_RE}\s+\d{{4}}|\d{{4}})'
DATE_RANGE_RE = re.compile(rf'(?P<dates>{DATE_TOKEN_RE}(?:\s*[–-]\s*(?:Present|{DATE_TOKEN_RE}))?)$', re.I)


def _norm(value: str) -> str:
    text = re.sub(r'\s+', ' ', str(value or '').replace('\u00a0', ' ')).strip()
    return re.sub(r'\b([A-Z]{2,})(for|the|to|of|in|and|with|on|at|from|as)\b', r'\1 \2', text)


def _clean_lines(text: str) -> list[str]:
    lines = []
    for raw in str(text or '').splitlines():
        line = _norm(raw)
        if line:
            lines.append(line)
    return lines


def _escape_paragraph(text: str) -> str:
    clean = _norm(text)
    if not clean:
        return ''
    return f'<p>{html.escape(clean)}</p>'


def _lines_to_list_html(lines: list[str]) -> str:
    items = [f'<li>{html.escape(_norm(line))}</li>' for line in lines if _norm(line)]
    if not items:
        return ''
    return '<ul>' + ''.join(items) + '</ul>'


def _group_bullets(lines: list[str]) -> list[str]:
    bullets: list[str] = []
    current: list[str] = []

    for raw in lines:
        line = _norm(raw)
        if not line or line.lower() == 'link':
            continue

        starts_new = bool(current) and (
            line[0].isupper() or line[0].isdigit() or line.startswith(('•', '-', '*'))
        )

        if starts_new:
            bullets.append(_norm(' '.join(current)))
            current = [line]
        else:
            current.append(line)

    if current:
        bullets.append(_norm(' '.join(current)))

    return [bullet for bullet in bullets if bullet]


def _extract_pdf_urls(reader: PdfReader) -> list[str]:
    found: list[dict[str, Any]] = []

    for page in reader.pages:
        annots = page.get('/Annots') or []
        for annot_ref in annots:
            try:
                annot = annot_ref.get_object()
            except Exception:
                continue

            action = annot.get('/A')
            if action is None:
                continue
            try:
                action = action.get_object()
            except Exception:
                pass

            uri = None
            if hasattr(action, 'get'):
                uri = action.get('/URI')
            if not uri:
                continue

            rect = annot.get('/Rect') or [0, 0, 0, 0]
            try:
                x0, y0, x1, y1 = [float(v) for v in rect[:4]]
            except Exception:
                x0 = y0 = x1 = y1 = 0.0
            found.append({'url': str(uri).strip(), 'rect': [x0, y0, x1, y1]})

    found.sort(key=lambda item: (-item['rect'][3], item['rect'][0]))
    return [item['url'] for item in found if item.get('url')]


def _split_contact(lines: list[str]) -> tuple[str, str, str]:
    location = ''
    phone = ''
    email = ''

    if not lines:
        return location, phone, email

    parts = [part.strip() for part in lines[0].split('|') if part.strip()]
    for part in parts:
        if '@' in part and not email:
            email = part
        elif re.search(r'\+?\d[\d\s().-]{7,}', part) and not phone:
            phone = part
        elif not location:
            location = part

    return location, phone, email


def _split_date_range(value: str) -> tuple[str, str, bool]:
    clean = _norm(value)
    if not clean:
        return '', '', False

    parts = [_norm(part) for part in re.split(r'\s*[–-]\s*', clean) if _norm(part)]
    if len(parts) >= 2:
        start = parts[0]
        end = parts[-1]
        return start, '' if end.lower() == 'present' else end, end.lower() == 'present'

    if clean.lower() == 'present':
        return '', '', True

    return clean, '', False


def _split_experience_header(line: str) -> tuple[str, str, str, str, bool] | None:
    clean = _norm(line)
    match = DATE_RANGE_RE.search(clean)
    if not match:
        return None

    dates = _norm(match.group('dates'))
    leading = _norm(clean[: match.start('dates')].rstrip(' -–'))
    parts = [part.strip() for part in re.split(r'\s+[–-]\s+', leading, maxsplit=1) if part.strip()]
    if len(parts) != 2:
        return None

    company, title = parts
    start, end, is_current = _split_date_range(dates)
    return company, title, start, end, is_current


def _parse_experiences(lines: list[str]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    for line in lines:
        header = _split_experience_header(line)
        if header:
            if current:
                entries.append(current)
            company, title, start, end, is_current = header
            current = {
                'company': company,
                'title': title,
                'startDate': start,
                'endDate': end,
                'isCurrent': is_current,
                'bullets': [],
            }
            continue

        if current is not None:
            current['bullets'].append(line)

    if current:
        entries.append(current)

    parsed: list[dict[str, Any]] = []
    for entry in entries:
        parsed.append(
            {
                'company': entry['company'],
                'title': entry['title'],
                'startDate': entry['startDate'],
                'endDate': entry['endDate'],
                'isCurrent': bool(entry['isCurrent']),
                'highlights': _lines_to_list_html(_group_bullets(entry['bullets'])),
            }
        )

    return parsed


def _parse_skills(lines: list[str]) -> str:
    return _lines_to_list_html(lines)


def _parse_summary(lines: list[str]) -> str:
    summary = _norm(' '.join(lines))
    return _escape_paragraph(summary)


def _parse_education(lines: list[str]) -> list[dict[str, Any]]:
    if not lines:
        return []

    groups: list[list[str]] = []
    current: list[str] = []

    for line in lines:
        current.append(line)
        if DATE_RANGE_RE.search(_norm(line)) or re.fullmatch(r'\d{4}', _norm(line)):
            groups.append(current)
            current = []

    if current:
        groups.append(current)

    parsed: list[dict[str, Any]] = []
    for group in groups:
        if not group:
            continue

        institution = _norm(group[0])
        program_line = _norm(group[1]) if len(group) > 1 else ''
        date_line = _norm(group[-1]) if len(group) > 1 else ''

        program = program_line
        score_enabled = False
        score_type = 'cgpa'
        score_value = ''
        score_label = ''

        if '|' in program_line:
            program_part, score_part = [part.strip() for part in program_line.split('|', 1)]
            program = program_part
            score_match = re.match(r'(?P<label>[^:]+?)\s*:\s*(?P<value>.+)$', score_part)
            if score_match:
                score_label = _norm(score_match.group('label'))
                score_value = _norm(score_match.group('value'))
                score_enabled = True
                lowered = score_label.lower()
                if lowered.startswith('cgpa'):
                    score_type = 'cgpa'
                elif lowered.startswith('percentage'):
                    score_type = 'percentage'
                else:
                    score_type = 'custom'

        start_date, end_date, is_current = _split_date_range(date_line)

        parsed.append(
            {
                'institution': institution,
                'program': program,
                'scoreEnabled': score_enabled,
                'scoreType': score_type,
                'scoreValue': score_value,
                'scoreLabel': score_label,
                'startDate': start_date,
                'endDate': end_date,
                'isCurrent': is_current,
            }
        )

    return parsed


def _parse_projects(lines: list[str], project_urls: list[str]) -> list[dict[str, Any]]:
    clean_lines = [line for line in lines if _norm(line) and _norm(line).lower() != 'link']
    if not clean_lines:
        return []

    title = _norm(clean_lines[0])
    highlights = _lines_to_list_html(_group_bullets(clean_lines[1:]))
    return [
        {
            'name': title,
            'url': project_urls[0] if project_urls else '',
            'highlights': highlights,
        }
    ]


def parse_resume_pdf(file_obj) -> dict[str, Any]:
    if hasattr(file_obj, 'seek'):
        file_obj.seek(0)

    reader = PdfReader(file_obj)
    text = '\n'.join((page.extract_text() or '') for page in reader.pages)
    lines = _clean_lines(text)
    urls = _extract_pdf_urls(reader)

    sections: dict[str, list[str]] = {value: [] for value in SECTION_HEADERS.values()}
    preamble: list[str] = []
    current_section = 'preamble'

    for line in lines:
        key = SECTION_HEADERS.get(line.upper())
        if key:
            current_section = key
            continue

        if current_section == 'preamble':
            preamble.append(line)
        else:
            sections[current_section].append(line)

    full_name = _norm(preamble[0]).title() if preamble else ''
    location, phone, email = _split_contact(preamble[1:2])

    link_labels = [part.strip() for part in preamble[2].split('|') if part.strip()] if len(preamble) > 2 else []
    top_urls = urls[: len(link_labels)]
    project_urls = urls[len(link_labels) :]

    links = [
        {'label': label, 'url': top_urls[index] if index < len(top_urls) else ''}
        for index, label in enumerate(link_labels)
    ]

    experiences = _parse_experiences(sections['experience'])
    educations = _parse_education(sections['education'])
    projects = _parse_projects(sections['projects'], project_urls)

    role = experiences[0]['title'] if experiences else ''

    summary_html = _parse_summary(sections['summary'])
    skills_html = _parse_skills(sections['skills'])

    return {
        'fullName': full_name,
        'role': role,
        'email': email,
        'phone': phone,
        'location': location,
        'links': links,
        'summaryEnabled': bool(summary_html),
        'summaryHeading': 'Summary',
        'summaryStyle': 'auto',
        'summary': summary_html,
        'skills': skills_html,
        'experiences': experiences,
        'projects': projects,
        'educations': educations,
        'bodyFontSizePt': 10,
        'bodyLineHeight': 1,
        'sectionOrder': ['summary', 'skills', 'experience', 'projects', 'education'],
        'sectionUnderline': False,
        'customSections': [],
    }
