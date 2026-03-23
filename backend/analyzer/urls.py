from django.urls import path

from .views import (
    CookieTokenLogoutView,
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    CsrfTokenView,
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
    path('csrf/', CsrfTokenView.as_view()),
    path('signup/', SignupView.as_view()),
    path('token/', CookieTokenObtainPairView.as_view()),
    path('token/refresh/', CookieTokenRefreshView.as_view()),
    path('token/logout/', CookieTokenLogoutView.as_view()),
    path('profile/', ProfileView.as_view()),
    path('job-roles/', JobRoleListCreateView.as_view()),
    path('resumes/', ResumeListCreateView.as_view()),
    path('resumes/<int:resume_id>/', ResumeDetailView.as_view()),
    path('analyses/', ResumeAnalysisListView.as_view()),
    path('run-analysis/', RunAnalysisView.as_view()),
]
