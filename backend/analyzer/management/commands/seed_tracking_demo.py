from datetime import timedelta
import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from analyzer.models import Company, Employee, Job, Tracking, TrackingAction, MailTracking


class Command(BaseCommand):
    help = "Seed compact demo data for companies + tracking with HR dropdown and milestones."

    def add_arguments(self, parser):
        parser.add_argument("--username", type=str, default="", help="Seed for one username only.")
        parser.add_argument("--reset", action="store_true", help="Delete existing seeded demo data first.")

    def handle(self, *args, **options):
        username = (options.get("username") or "").strip()
        reset = bool(options.get("reset"))

        User = get_user_model()
        users_qs = User.objects.all()
        if username:
            users_qs = users_qs.filter(username=username)
        users = list(users_qs)
        if not users:
            self.stdout.write(self.style.WARNING("No users found for seeding."))
            return

        seeded = 0
        for user in users:
            seeded += self._seed_for_user(user, reset=reset)

        self.stdout.write(self.style.SUCCESS(f"Seed complete. Tracking rows created: {seeded}"))

    def _seed_for_user(self, user, reset=False):
        company_names = [
            "Acme Labs",
            "BlueOrbit",
            "VertexPay",
            "NovaRetail",
            "DataPulse",
            "CloudSprint",
        ]
        roles = ["Software Engineer", "Backend Engineer", "Full Stack Engineer", "Platform Engineer"]
        locations = ["Gurugram", "Bengaluru", "Noida", "Remote"]

        if reset:
            TrackingAction.objects.filter(tracking__user=user, tracking__Job__company__name__in=company_names).delete()
            Tracking.objects.filter(user=user, Job__company__name__in=company_names).delete()
            MailTracking.objects.filter(user=user, company__name__in=company_names).delete()
            Job.objects.filter(user=user, company__name__in=company_names).delete()
            Employee.objects.filter(user=user, company__name__in=company_names).delete()
            Company.objects.filter(user=user, name__in=company_names).delete()

        companies = []
        for idx, name in enumerate(company_names, start=1):
            company, _ = Company.objects.get_or_create(
                user=user,
                name=name,
                defaults={
                    "mail_format": f"firstname.lastname@{name.lower().replace(' ', '')}.com",
                    "career_url": f"https://careers.{name.lower().replace(' ', '')}.com",
                    "workday_domain_url": f"https://{name.lower().replace(' ', '')}.myworkdayjobs.com",
                },
            )
            companies.append(company)

            for hr_idx in range(1, 5):
                Employee.objects.get_or_create(
                    user=user,
                    company=company,
                    name=f"{name.split()[0]} HR {hr_idx}",
                    defaults={
                        "department": "HR",
                        "email": f"hr{hr_idx}@{name.lower().replace(' ', '')}.com",
                        "location": random.choice(locations),
                        "profile": f"https://linkedin.com/in/{name.lower().replace(' ', '-')}-hr-{hr_idx}",
                        "about": "Handles hiring and referrals.",
                        "helpful": random.choice(["good", "partial_somewhat", "never"]),
                    },
                )

        created_tracking = 0
        now = timezone.now().date()
        for company_idx, company in enumerate(companies, start=1):
            hrs = list(Employee.objects.filter(user=user, company=company).order_by("name"))
            for job_idx in range(1, 4):
                job, _ = Job.objects.get_or_create(
                    user=user,
                    company=company,
                    job_id=f"{company_idx:02d}-{job_idx:03d}",
                    defaults={
                        "role": random.choice(roles),
                        "job_link": f"https://jobs.example.com/{company.name.lower().replace(' ', '-')}/{job_idx}",
                        "tailored_resume_file": f"/Users/subrat/Desktop/Ats/{user.username}_{company_idx}_{job_idx}.pdf",
                        "date_of_posting": now - timedelta(days=job_idx * 2),
                        "applied_at": now - timedelta(days=job_idx),
                        "is_closed": False,
                        "is_removed": False,
                    },
                )

                tracking, created = Tracking.objects.get_or_create(
                    user=user,
                    Job=job,
                    defaults={
                        "mailed": True,
                        "got_replied": job_idx % 2 == 0,
                        "is_open": True,
                        "action": "fresh",
                        "is_freezed": False,
                    },
                )
                if created:
                    created_tracking += 1

                # Select 1-3 HRs to test single + multi select behavior.
                selected = hrs[: max(1, min(3, (job_idx % 3) + 1))]
                tracking.selected_hrs.set(selected)

                # Add action timeline for milestone wave test.
                if not tracking.actions.exists():
                    base_time = timezone.now() - timedelta(days=job_idx + 2)
                    TrackingAction.objects.create(
                        tracking=tracking,
                        action_type="fresh",
                        send_mode="sent",
                        action_at=base_time,
                    )
                    TrackingAction.objects.create(
                        tracking=tracking,
                        action_type="followup",
                        send_mode="scheduled",
                        action_at=base_time + timedelta(days=2, hours=4),
                    )
                    tracking.action = "followed_up"
                    tracking.save(update_fields=["action", "updated_at"])

                if not tracking.mail_tracking_id:
                    mail = MailTracking.objects.create(
                        user=user,
                        company=company,
                        employee=selected[0] if selected else None,
                        job=job,
                        mailed=True,
                        got_replied=tracking.got_replied,
                        maild_at=timezone.now() - timedelta(days=job_idx),
                        replied_at=(timezone.now() - timedelta(days=job_idx - 1)) if tracking.got_replied else None,
                    )
                    tracking.mail_tracking = mail
                    tracking.save(update_fields=["mail_tracking", "updated_at"])

        self.stdout.write(self.style.SUCCESS(f"[{user.username}] tracking rows seeded/ensured: {created_tracking}"))
        return created_tracking
