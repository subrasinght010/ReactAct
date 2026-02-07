from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    HealthView,
    JobRoleListCreateView,
    ProfileView,
    ResumeAnalysisListView,
    ResumeDetailView,
    ResumeListCreateView,
    RunAnalysisView,
    SignupView,
)

urlpatterns = [
    path('health/', HealthView.as_view()),
    path('signup/', SignupView.as_view()),
    path('token/', TokenObtainPairView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
    path('profile/', ProfileView.as_view()),
    path('job-roles/', JobRoleListCreateView.as_view()),
    path('resumes/', ResumeListCreateView.as_view()),
    path('resumes/<int:resume_id>/', ResumeDetailView.as_view()),
    path('analyses/', ResumeAnalysisListView.as_view()),
    path('run-analysis/', RunAnalysisView.as_view()),
]
