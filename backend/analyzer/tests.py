from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from analyzer.management.commands.send_tracking_mails import Command
from analyzer.models import Company, Employee, Job, MailTrackingEvent, Resume, Template, Tracking, TrackingAction
from analyzer.tracking_mail_utils import ensure_mail_tracking
from analyzer.views import ApplicationTrackingDetailView


class DummySMTP:
    last_message = None
    last_from_email = None
    last_to_emails = None

    def __init__(self, host, port, timeout=30):
        self.host = host
        self.port = port
        self.timeout = timeout

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def starttls(self):
        return None

    def login(self, username, password):
        return None

    def sendmail(self, from_email, to_emails, message):
        type(self).last_from_email = from_email
        type(self).last_to_emails = to_emails
        type(self).last_message = message


class SendTrackingMailsThreadingTests(TestCase):
    def setUp(self):
        self.command = Command()
        self.user = User.objects.create_user(username="mailer", email="sender@example.com", password="x")
        self.company = Company.objects.create(user=self.user, name="acme")
        self.employee = Employee.objects.create(
            user=self.user,
            company=self.company,
            name="Recruiter",
            email="hr@acme.com",
        )
        self.job = Job.objects.create(user=self.user, company=self.company, job_id="J-1", role="Engineer")
        self.resume = Resume.objects.create(user=self.user, title="Base Resume")
        self.tracking = Tracking.objects.create(
            user=self.user,
            job=self.job,
            resume=self.resume,
            mail_type="followed_up",
        )
        self.mail_tracking = ensure_mail_tracking(self.tracking)

    def test_resolve_thread_context_uses_latest_sent_message_for_followup(self):
        MailTrackingEvent.objects.create(
            mail_tracking=self.mail_tracking,
            tracking=self.tracking,
            employee=self.employee,
            mail_type="fresh",
            send_mode="sent",
            status="sent",
            action_at=self.tracking.created_at,
            notes="sent",
            source_message_id="<first@example.com>",
            raw_payload={
                "to_email": "hr@acme.com",
                "subject": "Application for Engineer at acme",
                "message_id": "<first@example.com>",
            },
        )
        MailTrackingEvent.objects.create(
            mail_tracking=self.mail_tracking,
            tracking=self.tracking,
            employee=self.employee,
            mail_type="followup",
            send_mode="sent",
            status="sent",
            action_at=self.tracking.updated_at,
            notes="followup",
            source_message_id="<second@example.com>",
            raw_payload={
                "to_email": "hr@acme.com",
                "subject": "Re: Application for Engineer at acme",
                "message_id": "<second@example.com>",
                "references": ["<first@example.com>"],
            },
        )

        context = self.command._resolve_thread_context(self.mail_tracking, self.tracking, "hr@acme.com")

        self.assertEqual(context["in_reply_to"], "<second@example.com>")
        self.assertEqual(context["references"], ["<first@example.com>", "<second@example.com>"])
        self.assertEqual(context["subject"], "Re: Application for Engineer at acme")

    @patch("analyzer.management.commands.send_tracking_mails.smtplib.SMTP", DummySMTP)
    @patch.dict(
        "os.environ",
        {
            "SMTP_HOST": "smtp.example.com",
            "SMTP_PORT": "587",
            "SMTP_FROM_EMAIL": "sender@example.com",
            "SMTP_USE_TLS": "false",
        },
        clear=False,
    )
    def test_send_email_sets_thread_headers(self):
        message_id = self.command._send_email(
            self.user,
            "hr@acme.com",
            "Re: Application for Engineer at acme",
            "Follow up body",
            in_reply_to="<parent@example.com>",
            references=["<root@example.com>", "<parent@example.com>"],
        )

        self.assertTrue(message_id.startswith("<"))
        self.assertIn("Message-ID:", DummySMTP.last_message)
        self.assertIn("In-Reply-To: <parent@example.com>", DummySMTP.last_message)
        self.assertIn("References: <root@example.com> <parent@example.com>", DummySMTP.last_message)

    def test_log_success_persists_message_metadata(self):
        self.command._log_success(
            self.mail_tracking,
            self.tracking,
            self.employee,
            "Re: Application for Engineer at acme",
            "Follow up body",
            "hr@acme.com",
            message_id="<child@example.com>",
            in_reply_to="<parent@example.com>",
            references=["<root@example.com>", "<parent@example.com>"],
        )

        event = MailTrackingEvent.objects.get(mail_tracking=self.mail_tracking)
        self.assertEqual(event.source_message_id, "<child@example.com>")
        self.assertEqual(event.raw_payload["message_id"], "<child@example.com>")
        self.assertEqual(event.raw_payload["in_reply_to"], "<parent@example.com>")
        self.assertEqual(
            event.raw_payload["references"],
            ["<root@example.com>", "<parent@example.com>"],
        )


class TrackingFreshRuleApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = ApplicationTrackingDetailView.as_view()
        self.user = User.objects.create_user(username="tracker", email="tracker@example.com", password="x")
        self.company = Company.objects.create(user=self.user, name="beta", mail_format="{first}@beta.com")
        self.employee_one = Employee.objects.create(
            user=self.user,
            company=self.company,
            name="Alice",
            department="Engineering",
            email="alice@beta.com",
        )
        self.employee_two = Employee.objects.create(
            user=self.user,
            company=self.company,
            name="Bob",
            department="Engineering",
            email="bob@beta.com",
        )
        self.job = Job.objects.create(user=self.user, company=self.company, job_id="J-2", role="Backend")
        self.resume = Resume.objects.create(user=self.user, title="Resume")
        self.template_opening = Template.objects.create(user=self.user, name="Opening", category="opening", achievement="Open")
        self.template_experience = Template.objects.create(user=self.user, name="Experience", category="experience", achievement="Exp")
        self.template_closing = Template.objects.create(user=self.user, name="Closing", category="closing", achievement="Close")
        self.tracking = Tracking.objects.create(
            user=self.user,
            job=self.job,
            resume=self.resume,
            mail_type="fresh",
            template=self.template_opening,
            template_ids_ordered=[self.template_opening.id, self.template_experience.id, self.template_closing.id],
        )
        self.tracking.selected_hrs.set([self.employee_one])
        TrackingAction.objects.create(
            tracking=self.tracking,
            action_type="fresh",
            send_mode="sent",
            action_at=timezone.now(),
            notes='{"employee_ids":[%d]}' % self.employee_one.id,
        )

    def test_update_blocks_same_day_same_employee_fresh(self):
        request = self.factory.put(
            f"/api/tracking/{self.tracking.id}/",
            {
                "company": self.company.id,
                "job": self.job.id,
                "mail_type": "fresh",
                "template_ids_ordered": [
                    str(self.template_opening.id),
                    str(self.template_experience.id),
                    str(self.template_closing.id),
                ],
                "selected_hr_ids": [str(self.employee_one.id)],
            },
            format="json",
        )
        force_authenticate(request, user=self.user)

        response = self.view(request, tracking_id=self.tracking.id)

        self.assertEqual(response.status_code, 400)
        self.assertIn("Fresh mail already used these employees earlier today in this tracking", str(response.data.get("detail", "")))

    def test_update_allows_same_day_fresh_for_fully_different_employee(self):
        request = self.factory.put(
            f"/api/tracking/{self.tracking.id}/",
            {
                "company": self.company.id,
                "job": self.job.id,
                "mail_type": "fresh",
                "template_ids_ordered": [
                    str(self.template_opening.id),
                    str(self.template_experience.id),
                    str(self.template_closing.id),
                ],
                "selected_hr_ids": [str(self.employee_two.id)],
            },
            format="json",
        )
        force_authenticate(request, user=self.user)

        response = self.view(request, tracking_id=self.tracking.id)

        self.assertEqual(response.status_code, 200)
