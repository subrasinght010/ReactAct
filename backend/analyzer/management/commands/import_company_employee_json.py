import json
from typing import Any

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from analyzer.company_utils import get_or_create_company_normalized, normalize_company_name
from analyzer.models import Company, Employee


def split_name(full_name: str) -> tuple[str, str, str]:
    parts = [p for p in str(full_name or "").strip().split() if p]
    if not parts:
        return "", "", ""
    if len(parts) == 1:
        return parts[0], "", ""
    if len(parts) == 2:
        return parts[0], "", parts[1]
    return parts[0], " ".join(parts[1:-1]), parts[-1]


def clean(v: Any) -> str:
    return str(v or "").strip()


class Command(BaseCommand):
    help = "Import companies + employees from JSON and populate name parts (first/middle/last)."

    def add_arguments(self, parser):
        parser.add_argument("--user", required=True, help="Target user email or username.")
        parser.add_argument("--input", required=True, help="JSON file path.")
        parser.add_argument("--dry-run", action="store_true", help="Validate and preview only; no DB writes.")

    def _resolve_user(self, key: str) -> User:
        q = clean(key)
        user = User.objects.filter(email__iexact=q).first() or User.objects.filter(username__iexact=q).first()
        if not user:
            raise CommandError(f"User not found for '{q}'")
        return user

    def _load_json(self, path: str) -> dict[str, Any]:
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except FileNotFoundError:
            raise CommandError(f"Input file not found: {path}") from None
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON: {exc}") from None
        if not isinstance(data, dict):
            raise CommandError("Top-level JSON must be an object.")
        return data

    @transaction.atomic
    def handle(self, *args, **options):
        user = self._resolve_user(options["user"])
        payload = self._load_json(options["input"])
        dry_run = bool(options.get("dry_run"))

        companies = payload.get("companies") or []
        employees = payload.get("employees") or []
        if not isinstance(companies, list) or not isinstance(employees, list):
            raise CommandError("JSON must include arrays: companies and employees.")

        company_created = 0
        company_updated = 0
        employee_created = 0
        employee_updated = 0

        company_cache: dict[str, Company] = {}

        for row in companies:
            if not isinstance(row, dict):
                continue
            cname = normalize_company_name(clean(row.get("name")))
            if not cname:
                continue
            if cname in company_cache:
                company = company_cache[cname]
            else:
                company, created = get_or_create_company_normalized(user, cname)
                company_cache[cname] = company
                if created:
                    company_created += 1
            mail_pattern = clean(row.get("mail_pattern"))
            if mail_pattern and clean(company.mail_format) != mail_pattern:
                company.mail_format = mail_pattern
                if not dry_run:
                    company.save(update_fields=["mail_format", "updated_at"])
                company_updated += 1

        for row in employees:
            if not isinstance(row, dict):
                continue
            cname = normalize_company_name(clean(row.get("company_name")))
            if not cname:
                continue

            company = company_cache.get(cname)
            if not company:
                company, created = get_or_create_company_normalized(user, cname)
                company_cache[cname] = company
                if created:
                    company_created += 1

            full_name = clean(row.get("name"))
            first_name = clean(row.get("first_name"))
            middle_name = clean(row.get("middle_name"))
            last_name = clean(row.get("last_name"))
            if not (first_name or last_name):
                f, m, l = split_name(full_name)
                first_name = first_name or f
                middle_name = middle_name or m
                last_name = last_name or l
            merged_name = " ".join([p for p in [first_name, middle_name, last_name] if p]).strip() or full_name

            email = clean(row.get("email")).lower()
            contact_number = clean(row.get("contact_number"))
            department = clean(row.get("department")) or "HR"
            role = clean(row.get("role")) or "HR Recruiter"
            about = clean(row.get("about"))
            profile = clean(row.get("linkedin_url") or row.get("profile"))
            location = clean(row.get("location"))

            existing = None
            if email:
                existing = Employee.objects.filter(user=user, company=company, email__iexact=email).first()
            if not existing and merged_name:
                existing = Employee.objects.filter(user=user, company=company, name__iexact=merged_name).first()

            if existing:
                dirty_fields = []
                updates = {
                    "name": merged_name or existing.name,
                    "first_name": first_name or existing.first_name,
                    "middle_name": middle_name or existing.middle_name,
                    "last_name": last_name or existing.last_name,
                    "department": department or existing.department,
                    "JobRole": role or existing.JobRole,
                    "contact_number": contact_number or existing.contact_number,
                    "email": email or existing.email,
                    "about": about or existing.about,
                    "profile": profile or existing.profile,
                    "location": location or existing.location,
                }
                for field, value in updates.items():
                    if getattr(existing, field) != value:
                        setattr(existing, field, value)
                        dirty_fields.append(field)
                if dirty_fields:
                    dirty_fields.append("updated_at")
                    if not dry_run:
                        existing.save(update_fields=dirty_fields)
                    employee_updated += 1
                continue

            if not merged_name:
                continue
            if not dry_run:
                Employee.objects.create(
                    user=user,
                    company=company,
                    name=merged_name,
                    first_name=first_name,
                    middle_name=middle_name,
                    last_name=last_name,
                    department=department,
                    JobRole=role,
                    contact_number=contact_number,
                    email=email,
                    about=about,
                    profile=profile,
                    location=location,
                    working_mail=True,
                )
            employee_created += 1

        if dry_run:
            # Roll back atomic transaction in dry-run
            transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS("Import finished"))
        self.stdout.write(f"Companies created: {company_created}")
        self.stdout.write(f"Companies updated (mail_pattern): {company_updated}")
        self.stdout.write(f"Employees created: {employee_created}")
        self.stdout.write(f"Employees updated: {employee_updated}")
