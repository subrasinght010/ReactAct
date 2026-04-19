from datetime import timedelta

from django.contrib.auth.models import Group, Permission, User
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone

from .models import (
    Company,
    Employee,
    Interview,
    Job,
    Location,
    MailTracking,
    MailTrackingEvent,
    ProfilePanel,
    Resume,
    SubjectTemplate,
    Template,
    Tracking,
    TrackingAction,
    UserProfile,
)


DUMMY_DATA_PERMISSION_CODENAME = "view_dummy_data"
DUMMY_DATA_PERMISSION = f"analyzer.{DUMMY_DATA_PERMISSION_CODENAME}"
DUMMY_DATA_PERMISSION_NAME = "Can view shared dummy data"
DEFAULT_DUMMY_USERNAME = "dummy_showcase"
DEFAULT_DUMMY_PASSWORD = "dummy12345"
DEFAULT_DUMMY_EMAIL = "dummy-showcase@example.com"


def ensure_dummy_data_permission():
    content_type = ContentType.objects.get_for_model(UserProfile)
    permission, _ = Permission.objects.get_or_create(
        content_type=content_type,
        codename=DUMMY_DATA_PERMISSION_CODENAME,
        defaults={"name": DUMMY_DATA_PERMISSION_NAME},
    )
    return permission


def grant_dummy_data_permission(user):
    if not getattr(user, "is_authenticated", False):
        return None
    permission = ensure_dummy_data_permission()
    user.user_permissions.add(permission)
    return permission


def ensure_profile_for_user(user):
    if not getattr(user, "is_authenticated", False):
        return None
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={
            "role": UserProfile.ROLE_ADMIN,
            "full_name": user.username,
            "email": user.email or "",
        },
    )
    update_fields = []
    if not profile.full_name:
        profile.full_name = user.username
        update_fields.append("full_name")
    if not profile.email:
        profile.email = user.email or ""
        update_fields.append("email")
    if update_fields:
        update_fields.append("updated_at")
        profile.save(update_fields=update_fields)
    return profile


def shared_dummy_owner_ids_for_user(user):
    if not getattr(user, "is_authenticated", False):
        return []
    profile = ensure_profile_for_user(user)
    if profile is None or bool(getattr(profile, "hide_dummy_data", False)):
        return []
    if not user.has_perm(DUMMY_DATA_PERMISSION):
        return []
    dummy_profile = (
        UserProfile.objects
        .filter(is_dummy_profile=True)
        .select_related("user")
        .order_by("id")
        .first()
    )
    if dummy_profile is None:
        return []
    if not bool(getattr(dummy_profile, "is_dummy_profile", False)):
        return []
    if bool(getattr(dummy_profile, "hide_shared_dummy_data", False)):
        return []
    if dummy_profile.user_id == user.id:
        return []
    return [dummy_profile.user_id]


@transaction.atomic
def seed_shared_dummy_workspace(
    *,
    username=DEFAULT_DUMMY_USERNAME,
    password=None,
    company_count=3,
    employees_per_company=3,
    jobs_per_company=3,
    reset=False,
    update_password=False,
):
    username = str(username or DEFAULT_DUMMY_USERNAME).strip() or DEFAULT_DUMMY_USERNAME
    company_count = max(3, int(company_count or 3))
    employees_per_company = max(3, int(employees_per_company or 3))
    jobs_per_company = max(3, int(jobs_per_company or 3))

    if reset:
        existing = User.objects.filter(username=username).first()
        if existing is not None:
            existing.delete()

    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            "email": DEFAULT_DUMMY_EMAIL,
            "first_name": "Dummy",
            "last_name": "Workspace",
        },
    )
    user_update_fields = []
    if user.email != DEFAULT_DUMMY_EMAIL:
        user.email = DEFAULT_DUMMY_EMAIL
        user_update_fields.append("email")
    if user.first_name != "Dummy":
        user.first_name = "Dummy"
        user_update_fields.append("first_name")
    if user.last_name != "Workspace":
        user.last_name = "Workspace"
        user_update_fields.append("last_name")
    if update_password and password:
        user.set_password(password)
        user_update_fields.append("password")
    elif created:
        if password:
            user.set_password(password)
            user_update_fields.append("password")
        else:
            user.set_unusable_password()
            user_update_fields.append("password")
    if created:
        user.save()
    elif user_update_fields:
        user.save(update_fields=user_update_fields)

    admin_group = Group.objects.filter(name__iexact="admin").first()
    if admin_group is not None:
        user.groups.add(admin_group)

    profile = ensure_profile_for_user(user)
    profile_updates = []
    profile_targets = {
        "is_dummy_profile": True,
        "role": UserProfile.ROLE_ADMIN,
        "full_name": "ReactAct Demo Workspace",
        "email": DEFAULT_DUMMY_EMAIL,
        "contact_number": "+91 9000000000",
        "linkedin_url": "https://www.linkedin.com/in/reactact-demo",
        "github_url": "https://github.com/reactact-demo",
        "portfolio_url": "https://reactact-demo.example.com",
        "resume_link": "https://reactact-demo.example.com/resume",
        "current_employer": "ReactAct Labs",
        "years_of_experience": "5",
        "address_line_1": "Demo Tower",
        "address_line_2": "Tech Park",
        "state": "Karnataka",
        "country": "India",
        "country_code": "+91",
        "location": "Bengaluru",
        "summary": "Shared demo workspace used to showcase companies, jobs, tracking rows, templates, and outreach flows.",
    }
    for field, value in profile_targets.items():
        if getattr(profile, field) != value:
            setattr(profile, field, value)
            profile_updates.append(field)
    if profile_updates:
        profile_updates.append("updated_at")
        profile.save(update_fields=profile_updates)

    grant_dummy_data_permission(user)

    locations = _ensure_locations()
    if profile.location_ref_id != locations["Bengaluru"].id:
        profile.location_ref = locations["Bengaluru"]
        profile.save(update_fields=["location_ref", "updated_at"])
    profile.preferred_locations.set(
        [
            locations["Bengaluru"],
            locations["Remote"],
            locations["Hyderabad"],
        ]
    )

    system_templates = _ensure_system_templates()
    user_templates = _ensure_user_templates(profile)
    subject_templates = _ensure_subject_templates(profile)
    profile_panels = _ensure_profile_panels(profile, locations)

    companies = _ensure_companies(profile, company_count)
    employees = _ensure_employees(profile, companies, locations, employees_per_company)
    jobs = _ensure_jobs(user, companies, jobs_per_company)
    resumes = _ensure_resumes(profile, jobs)
    trackings = _ensure_tracking_rows(profile, jobs, employees, user_templates, system_templates, resumes)
    interviews = _ensure_interviews(profile, jobs, locations)

    return {
        "user": user,
        "profile": profile,
        "companies": companies,
        "employees": employees,
        "jobs": jobs,
        "resumes": resumes,
        "templates": user_templates,
        "subject_templates": subject_templates,
        "profile_panels": profile_panels,
        "trackings": trackings,
        "interviews": interviews,
    }


def _ensure_locations():
    names = ["Bengaluru", "Hyderabad", "Pune", "Chennai", "Remote"]
    return {name: Location.objects.get_or_create(name=name)[0] for name in names}


def _ensure_system_templates():
    rows = {}
    specs = {
        "opening": (
            "System Demo Opening",
            "opening",
            "I am reaching out with strong interest in this role and a practical record of shipping production work.",
        ),
        "experience": (
            "System Demo Experience",
            "experience",
            "My recent work has focused on Django, React, APIs, and reliable delivery across product-facing workflows.",
        ),
        "closing": (
            "System Demo Closing",
            "closing",
            "Thank you for reviewing my profile. I would value the chance to continue the conversation.",
        ),
        "follow_up": (
            "System Demo Follow Up",
            "follow_up",
            "Following up on my earlier outreach and sharing continued interest in the opportunity.",
        ),
        "personalized": (
            "System Demo Personalized",
            "personalized",
            "Your team’s mix of execution, ownership, and practical delivery aligns strongly with how I like to work.",
        ),
    }
    for key, (name, category, paragraph) in specs.items():
        row, _ = Template.objects.get_or_create(
            profile=None,
            name=name,
            defaults={
                "template_scope": Template.TEMPLATE_SCOPE_SYSTEM,
                "category": category,
                "achievement": paragraph,
            },
        )
        update_fields = []
        if row.template_scope != Template.TEMPLATE_SCOPE_SYSTEM:
            row.template_scope = Template.TEMPLATE_SCOPE_SYSTEM
            update_fields.append("template_scope")
        if row.category != category:
            row.category = category
            update_fields.append("category")
        if row.achievement != paragraph:
            row.achievement = paragraph
            update_fields.append("achievement")
        if update_fields:
            update_fields.append("updated_at")
            row.save(update_fields=update_fields)
        rows[key] = row
    return rows


def _ensure_user_templates(profile):
    rows = {}
    specs = {
        "opening": (
            "Demo Fresh Opening",
            "opening",
            "I am applying for the {role} role at {company_name} and wanted to share a concise introduction tied to the work you are hiring for.",
        ),
        "experience": (
            "Demo Experience Highlight",
            "experience",
            "My work at {current_employer} and {years_of_experience} years of hands-on delivery map well to product engineering and outreach-heavy workflows.",
        ),
        "closing": (
            "Demo Respectful Closing",
            "closing",
            "I would appreciate the chance to connect further if the role is still open and relevant.",
        ),
        "follow_up": (
            "Demo Follow Up Paragraph",
            "follow_up",
            "Following up on my earlier note regarding the {role} opportunity at {company_name} and sharing my continued interest.",
        ),
        "personalized": (
            "Demo Personalized Intro",
            "personalized",
            "The mix of recruiter outreach, delivery ownership, and product execution in your team’s work stood out to me.",
        ),
    }
    for key, (name, category, paragraph) in specs.items():
        row, _ = Template.objects.get_or_create(
            profile=profile,
            name=name,
            defaults={
                "template_scope": Template.TEMPLATE_SCOPE_USER_BASED,
                "category": category,
                "achievement": paragraph,
            },
        )
        update_fields = []
        if row.template_scope != Template.TEMPLATE_SCOPE_USER_BASED:
            row.template_scope = Template.TEMPLATE_SCOPE_USER_BASED
            update_fields.append("template_scope")
        if row.category != category:
            row.category = category
            update_fields.append("category")
        if row.achievement != paragraph:
            row.achievement = paragraph
            update_fields.append("achievement")
        if update_fields:
            update_fields.append("updated_at")
            row.save(update_fields=update_fields)
        rows[key] = row
    return rows


def _ensure_subject_templates(profile):
    rows = []
    specs = [
        ("Demo Fresh Subject", "fresh", "Application for {role} at {company_name}"),
        ("Demo Follow Up Subject", "follow_up", "Following up on {role} at {company_name}"),
        ("Demo Referral Subject", "fresh", "Exploring the {role} opening at {company_name}"),
    ]
    for name, category, subject in specs:
        row, _ = SubjectTemplate.objects.get_or_create(
            profile=profile,
            name=name,
            defaults={"category": category, "subject": subject},
        )
        update_fields = []
        if row.category != category:
            row.category = category
            update_fields.append("category")
        if row.subject != subject:
            row.subject = subject
            update_fields.append("subject")
        if update_fields:
            update_fields.append("updated_at")
            row.save(update_fields=update_fields)
        rows.append(row)
    return rows


def _ensure_profile_panels(profile, locations):
    rows = []
    specs = [
        {
            "title": "Backend Outreach Profile",
            "full_name": "Riya Demo",
            "email": "riya.demo@example.com",
            "contact_number": "+91 9876500001",
            "location": "Bengaluru",
            "location_ref": locations["Bengaluru"],
            "current_employer": "ReactAct Labs",
            "years_of_experience": "4",
            "summary": "Backend-focused profile panel used for demo outreach and tracking flows.",
        },
        {
            "title": "Full Stack Profile",
            "full_name": "Arjun Demo",
            "email": "arjun.demo@example.com",
            "contact_number": "+91 9876500002",
            "location": "Hyderabad",
            "location_ref": locations["Hyderabad"],
            "current_employer": "ReactAct Labs",
            "years_of_experience": "5",
            "summary": "Full-stack profile panel used for personalized recruiter outreach demos.",
        },
        {
            "title": "Follow Up Profile",
            "full_name": "Neha Demo",
            "email": "neha.demo@example.com",
            "contact_number": "+91 9876500003",
            "location": "Remote",
            "location_ref": locations["Remote"],
            "current_employer": "ReactAct Labs",
            "years_of_experience": "6",
            "summary": "Follow-up focused profile panel for demo scheduling and interview workflows.",
        },
    ]
    for spec in specs:
        row, _ = ProfilePanel.objects.get_or_create(
            profile=profile,
            title=spec["title"],
            defaults=spec,
        )
        update_fields = []
        for field, value in spec.items():
            if getattr(row, field) != value:
                setattr(row, field, value)
                update_fields.append(field)
        if update_fields:
            update_fields.append("updated_at")
            row.save(update_fields=update_fields)
        row.preferred_locations.set(
            [
                locations["Bengaluru"],
                locations["Remote"],
                locations["Hyderabad"],
            ]
        )
        rows.append(row)
    return rows


def _ensure_companies(profile, company_count):
    names = [
        "Acme Labs",
        "Northstar Systems",
        "Pixel Orbit",
        "Brightpath Tech",
        "Delta Stack",
        "Nimbus Works",
    ]
    rows = []
    for index in range(company_count):
        display_name = f"{names[index % len(names)]} {index + 1}"
        normalized_name = display_name.lower()
        row, _ = Company.objects.get_or_create(
            profile=profile,
            name=normalized_name,
            defaults={
                "mail_format": "{first}.{last}@example.com",
                "career_url": f"https://careers.example.com/{index + 1}",
                "linkedin_url": f"https://linkedin.com/company/example-{index + 1}",
                "workday_domain_url": f"https://workday.example.com/{index + 1}",
            },
        )
        update_fields = []
        if row.mail_format != "{first}.{last}@example.com":
            row.mail_format = "{first}.{last}@example.com"
            update_fields.append("mail_format")
        career_url = f"https://careers.example.com/{index + 1}"
        linkedin_url = f"https://linkedin.com/company/example-{index + 1}"
        workday_url = f"https://workday.example.com/{index + 1}"
        if row.career_url != career_url:
            row.career_url = career_url
            update_fields.append("career_url")
        if row.linkedin_url != linkedin_url:
            row.linkedin_url = linkedin_url
            update_fields.append("linkedin_url")
        if row.workday_domain_url != workday_url:
            row.workday_domain_url = workday_url
            update_fields.append("workday_domain_url")
        if update_fields:
            update_fields.append("updated_at")
            row.save(update_fields=update_fields)
        rows.append(row)
    return rows


def _ensure_employees(profile, companies, locations, employees_per_company):
    rows = []
    engineering_names = [
        "Rahul Mehta",
        "Neha Verma",
        "Arjun Patel",
        "Priya Nair",
        "Sahil Gupta",
        "Ritika Rao",
        "Karan Malhotra",
        "Aditi Sharma",
    ]
    hr_names = [
        "Maya Joshi",
        "Nisha Kapoor",
        "Ishita Roy",
        "Tanvi Singh",
        "Aman Khanna",
        "Riya Das",
    ]
    role_names = [
        "Recruiter",
        "Backend Engineer",
        "Frontend Engineer",
        "Full Stack Engineer",
        "Platform Engineer",
        "Python Developer",
    ]
    location_cycle = ["Bengaluru", "Hyderabad", "Remote", "Pune"]
    for company_index, company in enumerate(companies):
        for employee_index in range(employees_per_company):
            is_hr = employee_index % 3 == 0
            source_names = hr_names if is_hr else engineering_names
            full_name = source_names[(company_index + employee_index) % len(source_names)]
            first_name, last_name = full_name.split(" ", 1)
            email = f"{first_name.lower()}.{last_name.lower().replace(' ', '')}@{company.name.replace(' ', '')}.com"
            row, _ = Employee.objects.get_or_create(
                owner_profile=profile,
                company=company,
                email=email,
                defaults={
                    "name": full_name,
                    "first_name": first_name,
                    "last_name": last_name,
                    "JobRole": "Recruiter" if is_hr else role_names[(company_index + employee_index) % len(role_names)],
                    "department": "HR" if is_hr else "Engineering",
                    "working_mail": True,
                    "about": "Shared demo employee contact used for outreach previews and tracking tables.",
                    "personalized_template": "Happy to connect if there is a relevant fit.",
                    "location": location_cycle[(company_index + employee_index) % len(location_cycle)],
                    "location_ref": locations[location_cycle[(company_index + employee_index) % len(location_cycle)]],
                },
            )
            update_fields = []
            target_values = {
                "name": full_name,
                "first_name": first_name,
                "last_name": last_name,
                "JobRole": "Recruiter" if is_hr else role_names[(company_index + employee_index) % len(role_names)],
                "department": "HR" if is_hr else "Engineering",
                "working_mail": True,
                "about": "Shared demo employee contact used for outreach previews and tracking tables.",
                "personalized_template": "Happy to connect if there is a relevant fit.",
                "location": location_cycle[(company_index + employee_index) % len(location_cycle)],
                "location_ref": locations[location_cycle[(company_index + employee_index) % len(location_cycle)]],
            }
            for field, value in target_values.items():
                current_value = getattr(row, field)
                if current_value != value:
                    setattr(row, field, value)
                    update_fields.append(field)
            if update_fields:
                update_fields.append("updated_at")
                row.save(update_fields=update_fields)
            rows.append(row)
    return rows


def _ensure_jobs(user, companies, jobs_per_company):
    rows = []
    role_names = [
        "Backend Engineer",
        "Frontend Engineer",
        "Full Stack Engineer",
        "Platform Engineer",
        "Python Developer",
        "Django Developer",
    ]
    for company_index, company in enumerate(companies):
        for job_index in range(jobs_per_company):
            job_code = f"{company_index + 1:02d}-{job_index + 1:02d}"
            role = role_names[(company_index + job_index) % len(role_names)]
            row, _ = Job.objects.get_or_create(
                company=company,
                job_id=job_code,
                defaults={
                    "role": role,
                    "created_by": user,
                    "job_link": f"https://jobs.example.com/{company_index + 1}/{job_index + 1}",
                    "jd_text": f"We are hiring a {role} with strong Django, React, mail workflow, and recruiter outreach experience.",
                    "date_of_posting": timezone.localdate() - timedelta(days=job_index + company_index),
                    "applied_at": timezone.localdate() - timedelta(days=max(0, job_index + company_index - 1)),
                    "is_closed": False,
                    "is_removed": False,
                },
            )
            update_fields = []
            target_values = {
                "role": role,
                "created_by": user,
                "job_link": f"https://jobs.example.com/{company_index + 1}/{job_index + 1}",
                "jd_text": f"We are hiring a {role} with strong Django, React, mail workflow, and recruiter outreach experience.",
                "date_of_posting": timezone.localdate() - timedelta(days=job_index + company_index),
                "applied_at": timezone.localdate() - timedelta(days=max(0, job_index + company_index - 1)),
                "is_closed": False,
                "is_removed": False,
            }
            for field, value in target_values.items():
                current_value = getattr(row, field)
                if current_value != value:
                    setattr(row, field, value)
                    update_fields.append(field)
            if update_fields:
                update_fields.append("updated_at")
                row.save(update_fields=update_fields)
            row.assigned_to.add(user)
            rows.append(row)
    return rows


def _ensure_resumes(profile, jobs):
    rows = {}
    base_specs = [
        (
            "Demo Base Resume",
            {
                "resumeTitle": "Demo Base Resume",
                "fullName": "ReactAct Demo",
                "summary": "Python and Django engineer focused on practical product delivery, recruiter outreach, and mail workflows.",
            },
            "Demo base resume for shared workspace previews.",
            False,
            None,
            None,
        ),
        (
            "Demo Outreach Resume",
            {
                "resumeTitle": "Demo Outreach Resume",
                "fullName": "ReactAct Demo",
                "summary": "Full-stack builder with experience in job tracking, personalized mail generation, and recruiter engagement flows.",
            },
            "Demo outreach resume focused on recruiter and job workflow automation.",
            False,
            None,
            None,
        ),
    ]
    for title, builder_data, original_text, is_tailored, job, source_resume in base_specs:
        row, _ = Resume.objects.get_or_create(
            profile=profile,
            title=title,
            defaults={
                "builder_data": builder_data,
                "original_text": original_text,
                "optimized_text": "",
                "is_default": title == "Demo Base Resume",
                "is_tailored": is_tailored,
                "job": job,
                "source_resume": source_resume,
                "status": "draft",
            },
        )
        update_fields = []
        target_values = {
            "builder_data": builder_data,
            "original_text": original_text,
            "optimized_text": "",
            "is_default": title == "Demo Base Resume",
            "is_tailored": is_tailored,
            "job": job,
            "source_resume": source_resume,
            "status": "draft",
        }
        for field, value in target_values.items():
            current_value = getattr(row, field)
            if current_value != value:
                setattr(row, field, value)
                update_fields.append(field)
        if update_fields:
            update_fields.append("updated_at")
            row.save(update_fields=update_fields)
        rows[title] = row

    reference_job = jobs[0] if jobs else None
    tailored_title = "Demo Tailored Resume"
    tailored_builder = {
        "resumeTitle": tailored_title,
        "fullName": "ReactAct Demo",
        "summary": "Tailored resume variant aligned to recruiter outreach, bulk mail, and tracking workflows.",
    }
    tailored_row, _ = Resume.objects.get_or_create(
        profile=profile,
        title=tailored_title,
        defaults={
            "builder_data": tailored_builder,
            "original_text": "Tailored demo resume for shared tracking and preview flows.",
            "optimized_text": "",
            "is_default": False,
            "is_tailored": True,
            "job": reference_job,
            "source_resume": rows["Demo Base Resume"],
            "status": "optimized",
        },
    )
    tailored_updates = []
    tailored_targets = {
        "builder_data": tailored_builder,
        "original_text": "Tailored demo resume for shared tracking and preview flows.",
        "optimized_text": "",
        "is_default": False,
        "is_tailored": True,
        "job": reference_job,
        "source_resume": rows["Demo Base Resume"],
        "status": "optimized",
    }
    for field, value in tailored_targets.items():
        if getattr(tailored_row, field) != value:
            setattr(tailored_row, field, value)
            tailored_updates.append(field)
    if tailored_updates:
        tailored_updates.append("updated_at")
        tailored_row.save(update_fields=tailored_updates)
    rows[tailored_title] = tailored_row
    return rows


def _ensure_tracking_rows(profile, jobs, employees, user_templates, system_templates, resumes):
    rows = []
    employee_map = {}
    for employee in employees:
        employee_map.setdefault(employee.company_id, []).append(employee)
    base_resume = resumes["Demo Base Resume"]
    tailored_resume = resumes["Demo Tailored Resume"]
    for index, job in enumerate(jobs[: max(3, len(jobs))]):
        selected_employees = employee_map.get(job.company_id, [])[:2]
        mail_type = "fresh" if index % 2 == 0 else "followed_up"
        template = user_templates["opening"] if mail_type == "fresh" else user_templates["follow_up"]
        template_ids = (
            [user_templates["opening"].id, user_templates["experience"].id, user_templates["closing"].id]
            if mail_type == "fresh"
            else [user_templates["follow_up"].id]
        )
        row, _ = Tracking.objects.get_or_create(
            profile=profile,
            job=job,
            defaults={
                "template": template,
                "template_ids_ordered": template_ids,
                "personalized_template": user_templates["personalized"] if index % 2 == 0 else system_templates["personalized"],
                "resume": tailored_resume if index % 2 == 0 else base_resume,
                "mail_type": mail_type,
                "mailed": index % 2 == 0,
                "mail_delivery_status": "successful_sent" if index % 2 == 0 else "pending",
                "mail_subject": (
                    f"Application for {job.role} at {job.company.name}"
                    if mail_type == "fresh"
                    else f"Following up for {job.role} at {job.company.name}"
                ),
                "use_hardcoded_personalized_intro": index % 2 == 0,
            },
        )
        update_fields = []
        target_values = {
            "template": template,
            "template_ids_ordered": template_ids,
            "personalized_template": user_templates["personalized"] if index % 2 == 0 else system_templates["personalized"],
            "resume": tailored_resume if index % 2 == 0 else base_resume,
            "mail_type": mail_type,
            "mailed": index % 2 == 0,
            "mail_delivery_status": "successful_sent" if index % 2 == 0 else "pending",
            "mail_subject": (
                f"Application for {job.role} at {job.company.name}"
                if mail_type == "fresh"
                else f"Following up for {job.role} at {job.company.name}"
            ),
            "use_hardcoded_personalized_intro": index % 2 == 0,
        }
        for field, value in target_values.items():
            if getattr(row, field) != value:
                setattr(row, field, value)
                update_fields.append(field)
        if update_fields:
            update_fields.append("updated_at")
            row.save(update_fields=update_fields)
        row.selected_hrs.set(selected_employees)
        _ensure_tracking_actions(row, selected_employees, index=index, mail_type=mail_type)
        _ensure_tracking_delivery_events(row, selected_employees, index=index, mail_type=mail_type)
        rows.append(row)
    return rows


def _ensure_tracking_actions(row, selected_employees, *, index=0, mail_type="fresh"):
    selected_employee_ids = [item.id for item in selected_employees if getattr(item, "id", None)]
    now = timezone.now()
    fresh_action_at = now - timedelta(days=index + 2)
    followup_action_at = now - timedelta(days=index + 1)

    fresh_action = row.actions.filter(action_type="fresh").order_by("created_at", "id").first()
    if fresh_action is None:
        TrackingAction.objects.create(
            tracking=row,
            action_type="fresh",
            send_mode="sent",
            action_at=fresh_action_at,
            notes='{"employee_ids":[' + ",".join(str(item_id) for item_id in selected_employee_ids) + ']}'
            if selected_employee_ids else "Seeded shared demo fresh action.",
        )

    if str(mail_type or "fresh").strip().lower() == "followed_up":
        followup_action = row.actions.filter(action_type="followup").order_by("created_at", "id").first()
        if followup_action is None:
            TrackingAction.objects.create(
                tracking=row,
                action_type="followup",
                send_mode="sent",
                action_at=followup_action_at,
                notes='{"employee_ids":[' + ",".join(str(item_id) for item_id in selected_employee_ids) + ']}'
                if selected_employee_ids else "Seeded shared demo follow-up action.",
            )


def _ensure_tracking_delivery_events(row, selected_employees, *, index=0, mail_type="fresh"):
    if not selected_employees:
        return
    mail_tracking, _ = MailTracking.objects.get_or_create(
        profile=row.profile,
        tracking=row,
        defaults={"resume": row.resume},
    )
    if row.resume_id and mail_tracking.resume_id != row.resume_id:
        mail_tracking.resume = row.resume
        mail_tracking.save(update_fields=["resume", "updated_at"])

    base_action_at = timezone.now() - timedelta(days=index + 2)
    company_name = str(getattr(getattr(row.job, "company", None), "name", "") or "").strip()
    role_name = str(getattr(row.job, "role", "") or "").strip()

    for employee in selected_employees:
        if not getattr(employee, "id", None):
            continue
        fresh_subject = f"Application for {role_name} at {company_name}".strip()
        fresh_payload = {
            "status": "sent",
            "subject": fresh_subject,
            "to_email": str(getattr(employee, "email", "") or "").strip(),
        }
        fresh_event = (
            MailTrackingEvent.objects
            .filter(tracking=row, employee=employee, mail_type="fresh", status="sent")
            .order_by("created_at", "id")
            .first()
        )
        if fresh_event is None:
            MailTrackingEvent.objects.create(
                mail_tracking=mail_tracking,
                tracking=row,
                employee=employee,
                mail_type="fresh",
                send_mode="sent",
                status="sent",
                action_at=base_action_at,
                notes="Seeded shared demo fresh delivery.",
                raw_payload=fresh_payload,
            )

        if str(mail_type or "fresh").strip().lower() == "followed_up":
            followup_subject = f"Following up for {role_name} at {company_name}".strip()
            followup_payload = {
                "status": "sent",
                "subject": followup_subject,
                "to_email": str(getattr(employee, "email", "") or "").strip(),
            }
            followup_event = (
                MailTrackingEvent.objects
                .filter(tracking=row, employee=employee, mail_type="followup", status="sent")
                .order_by("created_at", "id")
                .first()
            )
            if followup_event is None:
                MailTrackingEvent.objects.create(
                    mail_tracking=mail_tracking,
                    tracking=row,
                    employee=employee,
                    mail_type="followup",
                    send_mode="sent",
                    status="sent",
                    action_at=base_action_at + timedelta(days=1),
                    notes="Seeded shared demo follow-up delivery.",
                    raw_payload=followup_payload,
                )


def _ensure_interviews(profile, jobs, locations):
    rows = []
    location_cycle = [locations["Bengaluru"], locations["Hyderabad"], locations["Remote"]]
    for index, job in enumerate(jobs[: max(3, len(jobs))]):
        stage = "round_1" if index % 2 == 0 else "assignment"
        row, _ = Interview.objects.get_or_create(
            profile=profile,
            company_name=job.company.name,
            job_role=job.role,
            defaults={
                "job": job,
                "job_code": job.job_id,
                "location_ref": location_cycle[index % len(location_cycle)],
                "stage": stage,
                "action": "active",
                "max_round_reached": 1 if stage == "round_1" else 0,
                "notes": "Shared demo interview entry used for dashboard and profile testing.",
            },
        )
        update_fields = []
        target_values = {
            "job": job,
            "job_code": job.job_id,
            "location_ref": location_cycle[index % len(location_cycle)],
            "stage": stage,
            "action": "active",
            "max_round_reached": 1 if stage == "round_1" else 0,
            "notes": "Shared demo interview entry used for dashboard and profile testing.",
        }
        for field, value in target_values.items():
            if getattr(row, field) != value:
                setattr(row, field, value)
                update_fields.append(field)
        if update_fields:
            update_fields.append("updated_at")
            row.save(update_fields=update_fields)
        rows.append(row)
    return rows
