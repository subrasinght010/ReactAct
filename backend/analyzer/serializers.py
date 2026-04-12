from django.contrib.auth.models import User
from rest_framework import serializers

from .models import (
    JobRole,
    Resume,
    ResumeAnalysis,
    TailoredJobRun,
    MailTracking,
    Company,
    Employee,
    Job,
)


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )


class JobRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobRole
        fields = [
            'id',
            'title',
            'company',
            'description',
            'required_keywords',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ResumeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resume
        fields = [
            'id',
            'title',
            'original_text',
            'optimized_text',
            'builder_data',
            'is_default',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'optimized_text', 'status', 'created_at', 'updated_at']


class ResumeAnalysisSerializer(serializers.ModelSerializer):
    resume_title = serializers.SerializerMethodField()
    job_role_title = serializers.SerializerMethodField()

    def get_resume_title(self, obj):
        if getattr(obj, 'resume', None) and getattr(obj.resume, 'title', None):
            return obj.resume.title
        return getattr(obj, 'resume_title', '') or ''

    def get_job_role_title(self, obj):
        return obj.job_role.title if obj.job_role else ''

    class Meta:
        model = ResumeAnalysis
        fields = [
            'id',
            'resume',
            'resume_title',
            'job_role',
            'job_role_title',
            'ats_score',
            'keyword_score',
            'matched_keywords',
            'missing_keywords',
            'ai_feedback',
            'created_at',
        ]
        read_only_fields = fields


class TailoredJobRunSerializer(serializers.ModelSerializer):
    resume_title = serializers.SerializerMethodField()

    def get_resume_title(self, obj):
        if getattr(obj, 'resume', None) and getattr(obj.resume, 'title', None):
            return obj.resume.title
        return ''

    class Meta:
        model = TailoredJobRun
        fields = [
            'id',
            'resume',
            'resume_title',
            'company_name',
            'job_title',
            'job_id',
            'job_url',
            'jd_text',
            'match_score',
            'keywords',
            'created_at',
        ]
        read_only_fields = fields


class MailTrackingSerializer(serializers.ModelSerializer):
    company_name = serializers.SerializerMethodField()
    job_id = serializers.SerializerMethodField()
    applied_date = serializers.SerializerMethodField()
    posting_date = serializers.SerializerMethodField()
    is_open = serializers.SerializerMethodField()
    available_hrs = serializers.SerializerMethodField()
    selected_hrs = serializers.SerializerMethodField()

    def _compat_payload(self, obj):
        payload = obj.mail_history
        if isinstance(payload, dict):
            return payload
        return {}

    def get_company_name(self, obj):
        compat = self._compat_payload(obj)
        if compat.get('company_name'):
            return compat.get('company_name')
        if getattr(obj, 'company', None):
            return obj.company.name
        return ''

    def get_job_id(self, obj):
        compat = self._compat_payload(obj)
        if compat.get('job_id'):
            return compat.get('job_id')
        if getattr(obj, 'job', None):
            return obj.job.job_id
        return ''

    def get_applied_date(self, obj):
        compat = self._compat_payload(obj)
        if compat.get('applied_date'):
            return compat.get('applied_date')
        if getattr(obj, 'job', None) and obj.job.applied_at:
            return obj.job.applied_at.isoformat()
        return None

    def get_posting_date(self, obj):
        compat = self._compat_payload(obj)
        if compat.get('posting_date'):
            return compat.get('posting_date')
        if getattr(obj, 'job', None) and obj.job.date_of_posting:
            return obj.job.date_of_posting.isoformat()
        return None

    def get_is_open(self, obj):
        compat = self._compat_payload(obj)
        if 'is_open' in compat:
            return bool(compat.get('is_open'))
        if getattr(obj, 'job', None):
            return not bool(obj.job.is_closed)
        return True

    def get_available_hrs(self, obj):
        compat = self._compat_payload(obj)
        value = compat.get('available_hrs')
        return value if isinstance(value, list) else []

    def get_selected_hrs(self, obj):
        compat = self._compat_payload(obj)
        value = compat.get('selected_hrs')
        return value if isinstance(value, list) else []

    class Meta:
        model = MailTracking
        fields = [
            'id',
            'company',
            'employee',
            'job',
            'company_name',
            'job_id',
            'mailed',
            'applied_date',
            'posting_date',
            'is_open',
            'available_hrs',
            'selected_hrs',
            'got_replied',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def _extract_compat_fields(self, validated_data):
        compat_keys = ['company_name', 'job_id', 'applied_date', 'posting_date', 'is_open', 'available_hrs', 'selected_hrs']
        compat = {}
        for key in compat_keys:
            if key in self.initial_data:
                compat[key] = self.initial_data.get(key)
        return compat

    def create(self, validated_data):
        compat = self._extract_compat_fields(validated_data)
        created = super().create(validated_data)
        if compat:
            created.mail_history = compat
            created.save(update_fields=['mail_history', 'updated_at'])
        return created

    def update(self, instance, validated_data):
        compat = self._extract_compat_fields(validated_data)
        updated = super().update(instance, validated_data)
        if compat:
            existing = updated.mail_history if isinstance(updated.mail_history, dict) else {}
            existing.update(compat)
            updated.mail_history = existing
            updated.save(update_fields=['mail_history', 'updated_at'])
        return updated


class EmployeeSerializer(serializers.ModelSerializer):
    company_name = serializers.SerializerMethodField()
    # Backward-compatible API keys for existing frontend payload/response shape.
    role = serializers.CharField(source='JobRole', required=False, allow_blank=True)
    personalized_template_helpful = serializers.CharField(source='helpful', required=False, allow_blank=True)

    def get_company_name(self, obj):
        return obj.company.name if getattr(obj, 'company', None) else ''

    class Meta:
        model = Employee
        fields = [
            'id',
            'name',
            'company',
            'company_name',
            'role',
            'department',
            'email',
            'contact_number',
            'about',
            'personalized_template_helpful',
            'personalized_template',
            'profile',
            'location',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'company_name', 'created_at', 'updated_at']


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            'id',
            'name',
            'mail_format',
            'career_url',
            'workday_domain_url',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class JobSerializer(serializers.ModelSerializer):
    company_name = serializers.SerializerMethodField()

    def get_company_name(self, obj):
        return obj.company.name if getattr(obj, 'company', None) else ''

    class Meta:
        model = Job
        fields = [
            'id',
            'job_id',
            'role',
            'job_link',
            'tailored_resume_file',
            'company',
            'company_name',
            'date_of_posting',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'company_name', 'created_at', 'updated_at']


# Backward-compatible alias used by existing views/endpoints.
ApplicationTrackingSerializer = MailTrackingSerializer
