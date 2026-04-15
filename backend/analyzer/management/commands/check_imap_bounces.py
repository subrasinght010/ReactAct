import email
import imaplib
import re
from datetime import timedelta
from email.header import decode_header
from email.utils import parseaddr, parsedate_to_datetime

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from analyzer.models import Employee, MailTracking, MailTrackingEvent, Tracking
from analyzer.tracking_mail_utils import log_mail_event, recompute_tracking_delivery_status


class Command(BaseCommand):
    help = "Scan IMAP inbox for bounce emails and update tracking delivery status."

    def add_arguments(self, parser):
        parser.add_argument("--user-id", type=int, default=None, help="Process bounce mapping only for this user id")
        parser.add_argument("--limit", type=int, default=100, help="Max IMAP messages to process")
        parser.add_argument("--since-days", type=int, default=14, help="Search recent emails in last N days")
        parser.add_argument("--scheduled-today-only", action="store_true", help="Only update rows scheduled for today (local timezone) with mailed=true")
        parser.add_argument("--dry-run", action="store_true", help="Do not write DB changes")

    def handle(self, *args, **options):
        import os

        user_id = options.get("user_id")
        limit = int(options.get("limit") or 100)
        since_days = int(options.get("since_days") or 14)
        scheduled_today_only = bool(options.get("scheduled_today_only"))
        dry_run = bool(options.get("dry_run"))

        host = str(os.getenv("IMAP_HOST", "")).strip()
        port = int(str(os.getenv("IMAP_PORT", "993")).strip() or 993)
        username = str(os.getenv("IMAP_USER", "")).strip()
        password = str(os.getenv("IMAP_PASSWORD", "")).strip()
        folder = str(os.getenv("IMAP_FOLDER", "INBOX")).strip() or "INBOX"

        if not host or not username or not password:
            self.stdout.write(self.style.ERROR("Missing IMAP config. Set IMAP_HOST, IMAP_USER, IMAP_PASSWORD."))
            return

        since_date = (timezone.now() - timedelta(days=since_days)).strftime("%d-%b-%Y")
        processed = 0
        matched = 0
        updated = 0

        with imaplib.IMAP4_SSL(host, port) as mail:
            mail.login(username, password)
            mail.select(folder)

            typ, data = mail.search(None, "UNSEEN", "SINCE", since_date)
            if typ != "OK":
                self.stdout.write(self.style.ERROR("Could not search IMAP inbox."))
                return
            ids = data[0].split()
            if not ids:
                self.stdout.write("No unseen recent IMAP messages found.")
                return
            ids = ids[-limit:]

            for msg_id in ids:
                imap_uid = self._fetch_uid(mail, msg_id)
                typ, msg_data = mail.fetch(msg_id, "(RFC822)")
                if typ != "OK" or not msg_data:
                    continue
                processed += 1

                raw = msg_data[0][1] if isinstance(msg_data[0], tuple) and len(msg_data[0]) > 1 else b""
                if not raw:
                    continue
                msg = email.message_from_bytes(raw)
                subject = self._decode_header_value(msg.get("Subject"))
                from_addr = str(msg.get("From") or "")
                body_text = self._extract_text(msg)
                message_id = str(msg.get("Message-ID") or "").strip()
                message_at = self._message_datetime(msg)

                if not self._looks_like_bounce(subject, from_addr, body_text):
                    if not dry_run:
                        self._record_reply_if_applicable(
                            subject=subject,
                            from_addr=from_addr,
                            body_text=body_text,
                            source_uid=imap_uid,
                            source_message_id=message_id,
                            action_at=message_at,
                            user_id=user_id,
                            scheduled_today_only=scheduled_today_only,
                        )
                    mail.store(msg_id, "+FLAGS", "\\Seen")
                    continue

                recipients = self._extract_bounced_recipients(subject, body_text)
                if not recipients:
                    mail.store(msg_id, "+FLAGS", "\\Seen")
                    continue

                for recipient in recipients:
                    rows = self._match_tracking_rows_for_recipient(
                        recipient,
                        user_id=user_id,
                        scheduled_today_only=scheduled_today_only,
                    )
                    if not dry_run:
                        self._mark_employee_mail_failed(recipient, user_id=user_id)
                    if not rows:
                        continue
                    matched += 1
                    for row in rows:
                        if not dry_run:
                            inserted = self._record_bounce(
                                row,
                                recipient,
                                subject,
                                body_text,
                                source_uid=imap_uid,
                                source_message_id=message_id,
                                action_at=message_at,
                            )
                            if inserted:
                                self._recompute_delivery_status(row)
                        updated += 1

                mail.store(msg_id, "+FLAGS", "\\Seen")

        # Recompute statuses for eligible rows (today + mailed=true when requested).
        eligible_rows = self._eligible_rows(user_id=user_id, scheduled_today_only=scheduled_today_only)
        recomputed = 0
        if not dry_run:
            for row in eligible_rows:
                self._recompute_delivery_status(row)
                recomputed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. processed={processed} matched={matched} updated={updated} recomputed={recomputed} dry_run={dry_run}"
            )
        )

    def _decode_header_value(self, value):
        raw = str(value or "")
        parts = decode_header(raw)
        out = []
        for item, enc in parts:
            if isinstance(item, bytes):
                out.append(item.decode(enc or "utf-8", errors="ignore"))
            else:
                out.append(str(item))
        return "".join(out).strip()

    def _fetch_uid(self, mail, msg_id):
        try:
            typ, data = mail.fetch(msg_id, "(UID)")
        except Exception:
            return ""
        if typ != "OK" or not data:
            return ""
        for item in data:
            if isinstance(item, tuple):
                text = item[0].decode(errors="ignore")
            else:
                text = str(item or "")
            match = re.search(r"UID\s+(\d+)", text, flags=re.I)
            if match:
                return str(match.group(1) or "").strip()
        return ""

    def _message_datetime(self, msg):
        raw = str(msg.get("Date") or "").strip()
        if not raw:
            return timezone.now()
        try:
            dt = parsedate_to_datetime(raw)
            if dt is None:
                return timezone.now()
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            return dt
        except Exception:
            return timezone.now()

    def _already_processed_message(self, mail_tracking, *, source_uid="", source_message_id=""):
        if not mail_tracking:
            return False
        uid = str(source_uid or "").strip()
        message_id = str(source_message_id or "").strip()
        if uid and MailTrackingEvent.objects.filter(mail_tracking=mail_tracking, source_uid=uid).exists():
            return True
        if message_id and MailTrackingEvent.objects.filter(mail_tracking=mail_tracking, source_message_id=message_id).exists():
            return True
        return False

    def _extract_text(self, msg):
        chunks = []
        if msg.is_multipart():
            for part in msg.walk():
                ctype = str(part.get_content_type() or "").lower()
                if ctype not in {"text/plain", "message/delivery-status"}:
                    continue
                payload = part.get_payload(decode=True)
                if not payload:
                    continue
                charset = part.get_content_charset() or "utf-8"
                chunks.append(payload.decode(charset, errors="ignore"))
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                chunks.append(payload.decode(charset, errors="ignore"))
        return "\n".join(chunks)

    def _looks_like_bounce(self, subject, from_addr, body_text):
        src = f"{subject}\n{from_addr}\n{body_text}".lower()
        bounce_markers = [
            "delivery status notification",
            "mail delivery failed",
            "delivery has failed",
            "undeliverable",
            "failure notice",
            "returned mail",
            "couldn't be delivered",
            "address not found",
            "mailer-daemon",
            "postmaster",
            "final-recipient:",
            "status: 5.",
        ]
        return any(marker in src for marker in bounce_markers)

    def _extract_bounced_recipients(self, subject, body_text):
        text = f"{subject}\n{body_text}"
        recipients = set()

        for match in re.finditer(r"Final-Recipient:\s*rfc822;\s*([^\s;]+)", text, flags=re.I):
            recipients.add(str(match.group(1) or "").strip().lower())
        for match in re.finditer(r"Original-Recipient:\s*rfc822;\s*([^\s;]+)", text, flags=re.I):
            recipients.add(str(match.group(1) or "").strip().lower())

        if not recipients:
            for match in re.finditer(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b", text):
                recipients.add(str(match.group(0) or "").strip().lower())

        # Ignore obvious sender system addresses.
        blocked = {"mailer-daemon", "postmaster"}
        cleaned = {
            r for r in recipients
            if r and not any(key in r for key in blocked)
        }
        return sorted(cleaned)

    def _extract_sender_email(self, from_addr):
        _, addr = parseaddr(str(from_addr or "").strip())
        return str(addr or "").strip().lower()

    def _today_tracking_ids(self, user_id=None, scheduled_today_only=False):
        today_local = timezone.localdate()
        qs = MailTracking.objects.filter(
            tracking_id__isnull=False,
            created_at__date=today_local,
            tracking__is_freezed=False,
        )
        if user_id:
            qs = qs.filter(tracking__user_id=int(user_id))
        if scheduled_today_only:
            qs = qs.filter(tracking__schedule_time__date=today_local)
        return set(qs.values_list("tracking_id", flat=True))

    def _match_tracking_rows_for_recipient(self, recipient, user_id=None, scheduled_today_only=False):
        today_tracking_ids = self._today_tracking_ids(user_id=user_id, scheduled_today_only=scheduled_today_only)
        if not today_tracking_ids:
            return []
        candidate_events = (
            MailTrackingEvent.objects
            .select_related("tracking", "mail_tracking")
            .filter(Q(tracking_id__in=today_tracking_ids) | Q(mail_tracking__tracking_id__in=today_tracking_ids))
            .order_by("-created_at")[:3000]
        )
        rows = []
        seen_ids = set()
        today_local = timezone.localdate()
        for event in candidate_events:
            payload = event.raw_payload if isinstance(event.raw_payload, dict) else {}
            to_email = str(payload.get("to_email") or "").strip().lower()
            if to_email != recipient:
                continue
            tracking = event.tracking
            if tracking is None and event.mail_tracking and getattr(event.mail_tracking, "tracking_id", None):
                tracking = event.mail_tracking.tracking
            if tracking is None:
                continue
            if user_id and tracking.user_id != int(user_id):
                continue
            if bool(getattr(tracking, "is_freezed", False)):
                continue
            if scheduled_today_only:
                st = getattr(tracking, "schedule_time", None)
                if not st:
                    continue
                try:
                    if timezone.localtime(st).date() != today_local:
                        continue
                except Exception:  # noqa: BLE001
                    continue
            if tracking.id not in seen_ids:
                seen_ids.add(tracking.id)
                rows.append(tracking)
        return rows

    def _record_reply_if_applicable(self, subject, from_addr, body_text, source_uid="", source_message_id="", action_at=None, user_id=None, scheduled_today_only=False):
        sender_email = self._extract_sender_email(from_addr)
        if not sender_email:
            return 0
        rows = self._match_tracking_rows_for_recipient(
            sender_email,
            user_id=user_id,
            scheduled_today_only=scheduled_today_only,
        )
        inserted = 0
        for tracking in rows:
            if self._record_reply(
                tracking,
                sender_email,
                subject,
                body_text,
                source_uid=source_uid,
                source_message_id=source_message_id,
                action_at=action_at,
            ):
                self._recompute_delivery_status(tracking)
                inserted += 1
        return inserted

    def _extract_bounce_reason(self, subject, body_text):
        text = str(body_text or "").strip()
        subject_text = str(subject or "").strip()
        patterns = [
            r"Diagnostic-Code:\s*[^;]+;\s*(.+)",
            r"Status:\s*([45]\.\d+\.\d+.*)",
            r"Reason:\s*(.+)",
            r"Action:\s*(failed.*)",
            r"This is .*?:\s*(.+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.I)
            if match:
                value = re.sub(r"\s+", " ", str(match.group(1) or "").strip(" .;:-"))
                if value:
                    return value[:240]

        for line in text.splitlines():
            normalized = re.sub(r"\s+", " ", str(line or "").strip())
            lower = normalized.lower()
            if not normalized:
                continue
            if any(marker in lower for marker in ["user unknown", "address not found", "mailbox unavailable", "recipient address rejected", "undeliverable", "no such user", "delivery has failed"]):
                return normalized[:240]

        if subject_text:
            return subject_text[:240]
        return "Bounce detected from IMAP inbox."

    def _record_bounce(self, tracking, recipient, subject, body_text, source_uid="", source_message_id="", action_at=None):
        mail_tracking = getattr(tracking, "mail_tracking_record", None)
        if not mail_tracking:
            return False
        if self._already_processed_message(mail_tracking, source_uid=source_uid, source_message_id=source_message_id):
            return False

        # De-duplicate bounce event for same recipient+subject.
        recent = (
            MailTrackingEvent.objects
            .filter(mail_tracking=mail_tracking, status="bounced")
            .order_by("-created_at")[:80]
        )
        for item in recent:
            payload = item.raw_payload if isinstance(item.raw_payload, dict) else {}
            p_to = str(payload.get("to_email") or "").strip().lower()
            p_subject = str(payload.get("subject") or "").strip()
            p_status = str(payload.get("status") or "").strip().lower()
            if p_to == str(recipient or "").strip().lower() and p_subject == str(subject or "").strip() and p_status == "bounced":
                return False

        latest_event = (
            MailTrackingEvent.objects
            .filter(mail_tracking=mail_tracking)
            .order_by('-action_at', '-created_at')
            .only('id', 'employee_id', 'mail_type', 'send_mode', 'status', 'raw_payload')
        )
        matched_event = None
        normalized_recipient = str(recipient or "").strip().lower()
        for item in latest_event[:120]:
            payload = item.raw_payload if isinstance(item.raw_payload, dict) else {}
            item_to = str(payload.get("to_email") or "").strip().lower()
            item_status = str(item.status or payload.get("status") or "").strip().lower()
            if item_to == normalized_recipient and item_status in {"sent", "failed"}:
                matched_event = item
                break

        employee = matched_event.employee if matched_event and matched_event.employee_id else None
        mail_type = str(matched_event.mail_type or "").strip() if matched_event else ""
        send_mode = str(matched_event.send_mode or "").strip() if matched_event else ""
        bounce_reason = self._extract_bounce_reason(subject, body_text)

        event, _ = log_mail_event(
            mail_tracking=mail_tracking,
            tracking=tracking,
            employee=employee,
            status="bounced",
            notes=f"Bounce detected: {bounce_reason}",
            subject=subject,
            body="",
            to_email=recipient,
            action_at=action_at,
            source_uid=source_uid,
            source_message_id=source_message_id,
            raw_payload={
                "to_email": recipient,
                "subject": subject,
                "body": "",
                "status": "bounced",
                "reason": bounce_reason,
            },
            mail_type=mail_type or ("followup" if str(tracking.mail_type or "").strip().lower() == "followed_up" else "fresh"),
            send_mode=send_mode or "sent",
        )
        return True

    def _record_reply(self, tracking, sender_email, subject, body_text, source_uid="", source_message_id="", action_at=None):
        mail_tracking = getattr(tracking, "mail_tracking_record", None)
        if not mail_tracking:
            return False
        if self._already_processed_message(mail_tracking, source_uid=source_uid, source_message_id=source_message_id):
            return False

        normalized_email = str(sender_email or "").strip().lower()
        normalized_subject = str(subject or "").strip()

        latest_event = (
            MailTrackingEvent.objects
            .filter(mail_tracking=mail_tracking)
            .select_related("employee")
            .order_by("-action_at", "-created_at")
        )
        matched_event = None
        for item in latest_event[:120]:
            payload = item.raw_payload if isinstance(item.raw_payload, dict) else {}
            item_to = str(payload.get("to_email") or "").strip().lower()
            if item_to == normalized_email:
                matched_event = item
                break

        employee = matched_event.employee if matched_event and matched_event.employee_id else getattr(mail_tracking, "employee", None)
        status_value = str(matched_event.status or "sent").strip() if matched_event else "sent"
        if status_value not in {"pending", "sent", "failed", "bounced"}:
            status_value = "sent"
        log_mail_event(
            mail_tracking=mail_tracking,
            tracking=tracking,
            employee=employee,
            status=status_value,
            notes="Reply detected from IMAP inbox.",
            subject=normalized_subject,
            body=str(body_text or "").strip(),
            to_email=normalized_email,
            from_email=normalized_email,
            got_replied=True,
            action_at=action_at,
            source_uid=source_uid,
            source_message_id=source_message_id,
            raw_payload={
                "from_email": normalized_email,
                "subject": normalized_subject,
                "body": str(body_text or "").strip(),
                "status": "replied",
            },
            mail_type=str(matched_event.mail_type or "").strip() if matched_event else ("followup" if str(tracking.mail_type or "").strip().lower() == "followed_up" else "fresh"),
            send_mode=str(matched_event.send_mode or "").strip() if matched_event else ("scheduled" if tracking and tracking.schedule_time else "sent"),
        )
        return True

    def _eligible_rows(self, user_id=None, scheduled_today_only=False):
        today_local = timezone.localdate()
        qs = (
            Tracking.objects
            .filter(
                is_freezed=False,
                mail_tracking_record__created_at__date=today_local,
            )
            .select_related("mail_tracking_record", "resume", "job__company")
        )
        if user_id:
            qs = qs.filter(user_id=int(user_id))
        if scheduled_today_only:
            qs = qs.filter(schedule_time__date=timezone.localdate())
        return list(qs[:5000])

    def _mark_employee_mail_failed(self, recipient, user_id=None):
        qs = Employee.objects.filter(email__iexact=str(recipient or "").strip())
        if user_id:
            qs = qs.filter(user_id=int(user_id))
        qs = qs.exclude(working_mail=False)
        if qs.exists():
            qs.update(working_mail=False)

    def _recompute_delivery_status(self, tracking):
        recompute_tracking_delivery_status(tracking)
