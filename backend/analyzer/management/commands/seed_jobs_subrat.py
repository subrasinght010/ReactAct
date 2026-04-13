from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from analyzer.models import Company, Job


# Marker companies — safe to delete with --reset
SEED_COMPANIES = [
    'Jobs Demo Alpha',
    'Jobs Demo Beta',
    'Jobs Demo Gamma',
]


class Command(BaseCommand):
    help = 'Seed companies and jobs for testing (default username: subrat).'

    def add_arguments(self, parser):
        parser.add_argument('--username', type=str, default='subrat', help='Target user username.')
        parser.add_argument('--reset', action='store_true', help='Remove seeded companies (and their jobs) for this user first.')

    def handle(self, *args, **options):
        username = (options.get('username') or 'subrat').strip()
        reset = bool(options.get('reset'))

        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if not user:
            self.stdout.write(self.style.ERROR(f'User "{username}" not found. Create the user first.'))
            return

        if reset:
            Job.objects.filter(user=user, company__name__in=SEED_COMPANIES).delete()
            Company.objects.filter(user=user, name__in=SEED_COMPANIES).delete()
            self.stdout.write('Removed previous Jobs Demo companies and jobs.')

        now = timezone.now().date()
        companies = []
        for name in SEED_COMPANIES:
            company, created = Company.objects.get_or_create(
                user=user,
                name=name,
                defaults={
                    'mail_format': f'firstname.lastname@{name.lower().replace(" ", "")}.example.com',
                    'career_url': f'https://careers.example.com/{name.lower().replace(" ", "-")}',
                },
            )
            companies.append(company)
            if created:
                self.stdout.write(f'  Company created: {name}')

        job_specs = [
            (0, 'DEMO-1001', 'Backend', 1, True, False, True, 'We are hiring a backend engineer.'),
            (0, 'DEMO-1002', 'Software', 3, False, False, False, 'Software developer role.'),
            (1, 'DEMO-2001', 'Fullstack', 5, False, True, False, 'Full stack product team.'),
            (1, 'DEMO-2002', 'Backend', 2, True, False, True, ''),
            (2, 'DEMO-3001', 'Software', 0, False, False, True, 'Junior software role.'),
            (2, 'DEMO-3002', 'Fullstack', 7, False, False, False, 'Remote fullstack.'),
        ]

        for comp_idx, job_id, role, days_ago, is_closed, is_removed, applied, jd in job_specs:
            company = companies[comp_idx]
            posting = now - timedelta(days=days_ago)
            applied_at = now - timedelta(days=1) if applied else None
            job, created = Job.objects.update_or_create(
                user=user,
                job_id=job_id,
                defaults={
                    'company': company,
                    'role': role,
                    'job_link': f'https://jobs.example.com/{job_id.lower()}',
                    'jd_text': jd,
                    'date_of_posting': posting,
                    'applied_at': applied_at,
                    'is_closed': is_closed,
                    'is_removed': is_removed,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  Job created: {job_id} @ {company.name}'))
            else:
                self.stdout.write(f'  Job updated: {job_id} @ {company.name}')

        self.stdout.write(self.style.SUCCESS(f'Done. Seeded jobs for user "{username}".'))
