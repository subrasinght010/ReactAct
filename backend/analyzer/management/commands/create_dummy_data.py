from django.core.management.base import BaseCommand

from analyzer.dummy_data import DEFAULT_DUMMY_PASSWORD, DEFAULT_DUMMY_USERNAME, seed_shared_dummy_workspace
from analyzer.models import SubjectTemplate, Template


class Command(BaseCommand):
    help = "Create realistic dummy data for local UI/API testing."

    def add_arguments(self, parser):
        parser.add_argument("--username", default=DEFAULT_DUMMY_USERNAME, help="Username for the seeded user.")
        parser.add_argument("--password", default=DEFAULT_DUMMY_PASSWORD, help="Password for the seeded user.")
        parser.add_argument("--companies", type=int, default=3, help="Number of companies to create.")
        parser.add_argument("--employees-per-company", type=int, default=3, help="Employees to create for each company.")
        parser.add_argument("--jobs-per-company", type=int, default=3, help="Jobs to create for each company.")
        parser.add_argument("--reset", action="store_true", help="Delete the seeded user and recreate all their owned dummy data.")

    def handle(self, *args, **options):
        state = seed_shared_dummy_workspace(
            username=options["username"],
            password=options["password"],
            company_count=options["companies"],
            employees_per_company=options["employees_per_company"],
            jobs_per_company=options["jobs_per_company"],
            reset=bool(options.get("reset")),
            update_password=True,
        )

        profile = state["profile"]
        self.stdout.write(self.style.SUCCESS("Dummy data created successfully."))
        self.stdout.write(f"User: {state['user'].username}")
        self.stdout.write(f"Password: {options['password']}")
        self.stdout.write(
            f"Created {len(state['companies'])} companies, {len(state['employees'])} employees, {len(state['jobs'])} jobs, "
            f"{len(state['trackings'])} tracking rows, {len(state['interviews'])} interviews."
        )
        self.stdout.write(
            f"Templates available: {Template.objects.filter(profile=profile, template_scope=Template.TEMPLATE_SCOPE_USER_BASED).count()} personal, "
            f"{Template.objects.filter(template_scope=Template.TEMPLATE_SCOPE_SYSTEM).count()} system, "
            f"{SubjectTemplate.objects.filter(profile=profile).count()} subjects."
        )
