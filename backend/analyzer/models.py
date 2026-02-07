from django.db import models
from django.contrib.auth.models import User


class JobRole(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='job_roles')
    title = models.CharField(max_length=120)
    company = models.CharField(max_length=120, blank=True)
    description = models.TextField()
    required_keywords = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} ({self.user.username})'


class Resume(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('uploaded', 'Uploaded'),
        ('optimized', 'Optimized'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='resumes')
    title = models.CharField(max_length=140)
    original_text = models.TextField(blank=True)
    optimized_text = models.TextField(blank=True)
    builder_data = models.JSONField(default=dict, blank=True)
    file = models.FileField(upload_to='resumes/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} ({self.user.username})'


class ResumeAnalysis(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analyses')
    resume = models.ForeignKey(
        Resume,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='analyses',
    )
    # Snapshot so analyses remain understandable even if the resume is later deleted.
    resume_title = models.CharField(max_length=140, blank=True)
    job_role = models.ForeignKey(
        JobRole,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='analyses',
    )
    ats_score = models.PositiveSmallIntegerField(default=0)
    keyword_score = models.PositiveSmallIntegerField(default=0)
    matched_keywords = models.JSONField(default=list, blank=True)
    missing_keywords = models.JSONField(default=list, blank=True)
    ai_feedback = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Analysis #{self.id} - {self.ats_score}'
