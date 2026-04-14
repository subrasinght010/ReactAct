import re
import sys
import json
from urllib.parse import parse_qs, urlparse

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from analyzer.company_utils import get_or_create_company_normalized, normalize_company_name
from analyzer.models import Job


URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
JOB_ID_RE = re.compile(
    r"\b(JR[-_][A-Z0-9-]+|R[-_]?\d{4,}|J\d{4,}|REQ[-_]\d+|VN\d+|NX[-_]\d+|\d{5,})\b",
    re.IGNORECASE,
)


def clean(value: str) -> str:
    return str(value or "").strip()


def infer_company_from_url(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if not host:
        return ""
    parts = host.split(".")

    # SmartRecruiters: jobs.smartrecruiters.com/<Company>/...
    if "smartrecruiters.com" in host:
        segs = [s for s in parsed.path.split("/") if s]
        if len(segs) >= 1 and segs[0].lower() not in {"jobs"}:
            return normalize_company_name(segs[0])

    # Greenhouse: job-boards.greenhouse.io/<company>/...
    if "greenhouse.io" in host:
        segs = [s for s in parsed.path.split("/") if s]
        if len(segs) >= 1 and segs[0].lower() not in {"embed", "job_app", "jobs"}:
            return normalize_company_name(segs[0])
        q = parse_qs(parsed.query)
        gh_for = clean((q.get("for") or [""])[0])
        if gh_for:
            return normalize_company_name(gh_for)

    # Workday subdomain often carries company
    blocked = {
        "www",
        "jobs",
        "careers",
        "career",
        "myworkdayjobs",
        "myworkdaysite",
        "wd1",
        "wd2",
        "wd3",
        "wd4",
        "wd5",
        "wd108",
    }
    for p in parts:
        if p not in blocked and p.isalpha() and len(p) > 2:
            return normalize_company_name(p)

    # Fallback first host token
    return normalize_company_name(parts[0] if parts else "")


def infer_workday_domain_url(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if "myworkdayjobs.com" not in host:
        return ""
    return f"{parsed.scheme or 'https'}://{host}"


def infer_job_id(url: str, line: str) -> str:
    text = f"{clean(line)} {clean(url)}"
    m = JOB_ID_RE.search(text)
    return clean(m.group(1)).upper() if m else ""


def infer_role_from_url(url: str, default_role: str) -> str:
    parsed = urlparse(url)
    segs = [s for s in parsed.path.split("/") if s]
    segs = [s for s in segs if s.lower() not in {"job", "jobs", "careers", "career", "en-us", "en", "us", "apply", "application"}]
    if not segs:
        return default_role
    candidate = segs[-1]
    candidate = re.sub(r"[_\-]+", " ", candidate)
    candidate = re.sub(r"\b(JR[-_][A-Z0-9-]+|R[-_]?\d+|J\d+|REQ[-_]\d+)\b", " ", candidate, flags=re.IGNORECASE)
    candidate = re.sub(r"\s+", " ", candidate).strip()
    if len(candidate) < 3:
        return default_role
    return candidate.title()


def status_from_line(line: str) -> tuple[bool, bool]:
    t = clean(line).lower()
    is_applied = any(k in t for k in [" yes", "\tyes", "applied", "got ?\tyes", "got ? yes"])
    is_closed = "closed" in t
    return is_applied, is_closed


class Command(BaseCommand):
    help = "Import jobs from pasted link dump (URL + optional status/job_id columns)."

    def add_arguments(self, parser):
        parser.add_argument("--user", help="Target user email or username (required unless --json-only).")
        parser.add_argument("--input", help="Path to text file. If omitted, reads from stdin.")
        parser.add_argument("--default-role", default="Software Engineer", help="Fallback role when role cannot be inferred.")
        parser.add_argument("--dry-run", action="store_true", help="Parse and preview only.")
        parser.add_argument("--json-out", help="Write extracted jobs JSON to this file.")
        parser.add_argument("--json-only", action="store_true", help="Only extract and output JSON; skip DB write.")

    def _resolve_user(self, key: str) -> User:
        q = clean(key)
        user = User.objects.filter(email__iexact=q).first() or User.objects.filter(username__iexact=q).first()
        if not user:
            raise CommandError(f"User not found for '{q}'")
        return user

    def _load_text(self, path: str | None) -> str:
        if path:
            with open(path, "r", encoding="utf-8") as fh:
                return fh.read()
        data = sys.stdin.read()
        if not clean(data):
            raise CommandError("No input provided. Use --input <file> or pipe text via stdin.")
        return data

    @transaction.atomic
    def handle(self, *args, **options):
        json_only = bool(options.get("json_only"))
        user_key = clean(options.get("user"))
        if not json_only and not user_key:
            raise CommandError("--user is required unless --json-only is used.")
        user = self._resolve_user(user_key) if user_key else None
        raw = self._load_text(options.get("input"))
        default_role = clean(options.get("default_role")) or "Software Engineer"
        dry_run = bool(options.get("dry_run"))
        json_out = clean(options.get("json_out"))

        lines = [clean(x) for x in raw.splitlines()]
        lines = [x for x in lines if x and not re.match(r"^\d{1,2}/\d{1,2}/\d{4}$", x)]

        created = 0
        updated = 0
        skipped = 0
        companies_created = 0
        extracted_rows = []

        for line in lines:
            urls = URL_RE.findall(line)
            if not urls:
                continue
            for url in urls:
                company_name = infer_company_from_url(url)
                if not company_name:
                    skipped += 1
                    continue

                job_id = infer_job_id(url, line)
                role = infer_role_from_url(url, default_role)
                is_applied, is_closed = status_from_line(line)
                applied_at = timezone.localdate() if is_applied else None
                workday_domain_url = infer_workday_domain_url(url)

                extracted_rows.append(
                    {
                        "job_link": url,
                        "company_name": company_name,
                        "workday_domain_url": workday_domain_url or None,
                        "job_id": job_id or None,
                        "role": role,
                        "applied": bool(is_applied),
                        "closed": bool(is_closed),
                    }
                )

                if json_only:
                    continue

                company, comp_created = get_or_create_company_normalized(user, company_name)
                if comp_created:
                    companies_created += 1

                row = None
                if job_id:
                    row = Job.objects.filter(user=user, company=company, job_id__iexact=job_id, is_removed=False).first()
                if not row:
                    row = Job.objects.filter(user=user, company=company, job_link=url, is_removed=False).first()

                if row:
                    dirty = False
                    if clean(row.role) != role:
                        row.role = role
                        dirty = True
                    if clean(row.job_link) != url:
                        row.job_link = url
                        dirty = True
                    if job_id and clean(row.job_id).upper() != job_id:
                        row.job_id = job_id
                        dirty = True
                    if bool(row.is_closed) != bool(is_closed):
                        row.is_closed = is_closed
                        dirty = True
                    if applied_at and row.applied_at is None:
                        row.applied_at = applied_at
                        dirty = True
                    if dirty:
                        updated += 1
                        if not dry_run:
                            row.save()
                    continue

                if not job_id:
                    # Generate stable fallback ID from URL tail if missing
                    tail = [s for s in urlparse(url).path.split("/") if s]
                    fallback = clean(tail[-1] if tail else "link")
                    fallback = re.sub(r"[^A-Za-z0-9]+", "-", fallback).strip("-")
                    job_id = (fallback[:100] or "LINK-JOB").upper()

                created += 1
                if not dry_run:
                    Job.objects.create(
                        user=user,
                        company=company,
                        job_id=job_id,
                        role=role,
                        job_link=url,
                        applied_at=applied_at,
                        is_closed=is_closed,
                    )

        if json_out:
            with open(json_out, "w", encoding="utf-8") as fh:
                json.dump(
                    {
                        "jobs": extracted_rows,
                        "count": len(extracted_rows),
                    },
                    fh,
                    indent=2,
                    ensure_ascii=False,
                )
            self.stdout.write(self.style.SUCCESS(f"JSON written: {json_out}"))

        if json_only:
            self.stdout.write(json.dumps({"jobs": extracted_rows, "count": len(extracted_rows)}, indent=2, ensure_ascii=False))
            return

        if dry_run:
            transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS("Job import finished"))
        self.stdout.write(f"Companies created: {companies_created}")
        self.stdout.write(f"Jobs created: {created}")
        self.stdout.write(f"Jobs updated: {updated}")
        self.stdout.write(f"Skipped: {skipped}")
