from django.contrib import admin

from .models import JobRole, Resume, ResumeAnalysis

admin.site.register(JobRole)
admin.site.register(Resume)
admin.site.register(ResumeAnalysis)
