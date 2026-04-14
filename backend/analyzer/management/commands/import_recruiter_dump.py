import re
import sys
import unicodedata
import json

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from analyzer.company_utils import get_or_create_company_normalized
from analyzer.models import Employee


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", re.IGNORECASE)
PHONE_RE = re.compile(r"(?:\+?\d[\d\s\-]{7,}\d)")
EMAIL_PATTERN_RE = re.compile(r"(?:email\s*pattern\s*:)?\s*([^\s]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})", re.IGNORECASE)


def normalize_text(value: str) -> str:
    return unicodedata.normalize("NFKC", str(value or "")).strip()


def company_from_domain(email: str) -> str:
    domain = str(email.split("@", 1)[-1] or "").strip().lower()
    if not domain:
        return ""
    host = domain.split(".")
    if len(host) >= 3 and host[0] in {"in", "us", "eu", "uk", "ca", "au"}:
        return host[1]
    return host[0]


def pretty_name_from_email(email: str) -> str:
    local = str(email.split("@", 1)[0] or "").strip().lower()
    local = re.sub(r"[^a-z0-9._\-]+", "", local)
    parts = [p for p in re.split(r"[._\-]+", local) if p]
    if not parts:
        return local
    return " ".join(p.capitalize() for p in parts)


class Command(BaseCommand):
    help = "Import recruiter/contact dump (emails, phones, company hints, email patterns) into Company + Employee."

    def add_arguments(self, parser):
        parser.add_argument("--user", help="Target user email or username (required unless --json-only).")
        parser.add_argument("--input", help="Path to text file. If omitted, reads from stdin.")
        parser.add_argument("--dry-run", action="store_true", help="Parse and report only; do not write DB.")
        parser.add_argument("--json-out", help="Write parsed payload JSON to this file path.")
        parser.add_argument("--json-only", action="store_true", help="Only parse and output JSON; skip DB writes.")

    def _resolve_user(self, key: str) -> User:
        q = normalize_text(key)
        if not q:
            raise CommandError("--user is required")
        user = User.objects.filter(email__iexact=q).first() or User.objects.filter(username__iexact=q).first()
        if not user:
            raise CommandError(f"User not found for '{q}'")
        return user

    def _load_text(self, input_path: str | None) -> str:
        if input_path:
            with open(input_path, "r", encoding="utf-8") as fh:
                return fh.read()
        data = sys.stdin.read()
        if not str(data or "").strip():
            raise CommandError("No input provided. Use --input <file> or pipe text via stdin.")
        return data

    def handle(self, *args, **options):
        json_only = bool(options.get("json_only"))
        user_key = options.get("user")
        if not json_only and not normalize_text(user_key):
            raise CommandError("--user is required unless --json-only is used.")
        user = self._resolve_user(user_key) if normalize_text(user_key) else None
        raw_text = self._load_text(options.get("input"))
        dry_run = bool(options.get("dry_run"))
        json_out = normalize_text(options.get("json_out"))

        lines = [normalize_text(line) for line in raw_text.splitlines()]
        lines = [line for line in lines if line]

        mail_patterns: dict[str, str] = {}
        contact_rows: list[dict] = []
        subject_lines: list[str] = []
        job_ids: list[str] = []

        for line in lines:
            if re.match(r"^[Rr]\d{5,}$", line):
                job_ids.append(line.upper())
                continue

            if line.startswith("*"):
                bullet = normalize_text(line.lstrip("*").strip())
                if bullet:
                    subject_lines.append(bullet)
                continue

            pattern_match = EMAIL_PATTERN_RE.search(line)
            if pattern_match and "@" in line and "email pattern" in line.lower():
                pattern_raw = normalize_text(pattern_match.group(1))
                domain = pattern_raw.split("@", 1)[-1].strip().lower()
                if domain:
                    mail_patterns[domain] = pattern_raw
                continue

            emails = [normalize_text(x).lower() for x in EMAIL_RE.findall(line)]
            if not emails:
                continue

            phone_match = PHONE_RE.search(line)
            phone = normalize_text(phone_match.group(0)) if phone_match else ""

            line_wo_emails = line
            for e in emails:
                line_wo_emails = re.sub(re.escape(e), " ", line_wo_emails, flags=re.IGNORECASE)
            if phone:
                line_wo_emails = line_wo_emails.replace(phone, " ")
            line_wo_emails = re.sub(r"\b(company|mo\.?\s*no\.?)\b", " ", line_wo_emails, flags=re.IGNORECASE)
            explicit_company = re.sub(r"[,|\t]+", " ", line_wo_emails).strip()
            explicit_company = re.sub(r"\s+", " ", explicit_company)

            for email in emails:
                company_hint = explicit_company or company_from_domain(email)
                contact_rows.append(
                    {
                        "email": email,
                        "phone": phone,
                        "company_hint": company_hint,
                    }
                )

        payload = {
            "contacts": contact_rows,
            "email_patterns": [
                {"domain": domain, "pattern": pattern}
                for domain, pattern in sorted(mail_patterns.items(), key=lambda x: x[0])
            ],
            "subject_lines": subject_lines,
            "job_ids": job_ids,
            "counts": {
                "contacts": len(contact_rows),
                "email_patterns": len(mail_patterns),
                "subject_lines": len(subject_lines),
                "job_ids": len(job_ids),
            },
        }

        if json_out:
            with open(json_out, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, indent=2, ensure_ascii=False)
            self.stdout.write(self.style.SUCCESS(f"JSON written: {json_out}"))

        if json_only:
            self.stdout.write(json.dumps(payload, indent=2, ensure_ascii=False))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: no DB writes"))
            self.stdout.write(f"Parsed contacts: {len(contact_rows)}")
            self.stdout.write(f"Parsed email patterns: {len(mail_patterns)}")
            return

        company_created = 0
        company_updated_pattern = 0
        employee_created = 0
        employee_updated = 0

        with transaction.atomic():
            for domain, pattern in mail_patterns.items():
                cname = company_from_domain(f"x@{domain}")
                if not cname:
                    continue
                company, created = get_or_create_company_normalized(user, cname)
                if created:
                    company_created += 1
                if str(company.mail_format or "").strip() != pattern:
                    company.mail_format = pattern
                    company.save(update_fields=["mail_format", "updated_at"])
                    company_updated_pattern += 1

            for row in contact_rows:
                company, created = get_or_create_company_normalized(user, row["company_hint"])
                if created:
                    company_created += 1

                email = str(row["email"] or "").strip().lower()
                if not email:
                    continue

                existing = Employee.objects.filter(user=user, company=company, email__iexact=email).first()
                if existing:
                    dirty = False
                    if row["phone"] and str(existing.contact_number or "").strip() != row["phone"]:
                        existing.contact_number = row["phone"]
                        dirty = True
                    if not str(existing.name or "").strip():
                        existing.name = pretty_name_from_email(email)
                        dirty = True
                    if dirty:
                        existing.save(update_fields=["name", "contact_number", "updated_at"])
                        employee_updated += 1
                    continue

                Employee.objects.create(
                    user=user,
                    company=company,
                    name=pretty_name_from_email(email),
                    email=email,
                    contact_number=row["phone"],
                    department="HR",
                    JobRole="HR Recruiter",
                    working_mail=True,
                )
                employee_created += 1

        self.stdout.write(self.style.SUCCESS("Import completed"))
        self.stdout.write(f"Companies created: {company_created}")
        self.stdout.write(f"Company mail patterns updated: {company_updated_pattern}")
        self.stdout.write(f"Employees created: {employee_created}")
        self.stdout.write(f"Employees updated: {employee_updated}")
