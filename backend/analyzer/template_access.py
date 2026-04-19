from django.db.models import Q

from .dummy_data import ensure_profile_for_user, shared_dummy_owner_ids_for_user
from .models import SubjectTemplate, Template, UserProfile


def ensure_template_profile_for_user(user):
    return ensure_profile_for_user(user)


def _shared_template_profile_ids_for_user(user):
    extra_owner_ids = shared_dummy_owner_ids_for_user(user)
    if not extra_owner_ids:
        return []
    return list(UserProfile.objects.filter(user_id__in=extra_owner_ids).values_list("id", flat=True))


def template_queryset_for_user(user):
    if not getattr(user, "is_authenticated", False):
        return Template.objects.none()
    profile = ensure_template_profile_for_user(user)
    scope = Q(template_scope=Template.TEMPLATE_SCOPE_SYSTEM)
    if profile is not None:
        scope = scope | Q(profile=profile, template_scope=Template.TEMPLATE_SCOPE_USER_BASED)
    shared_profile_ids = _shared_template_profile_ids_for_user(user)
    if shared_profile_ids:
        scope = scope | Q(profile_id__in=shared_profile_ids, template_scope=Template.TEMPLATE_SCOPE_USER_BASED)
    return Template.objects.filter(scope).select_related("profile__user")


def owned_template_queryset_for_user(user):
    profile = ensure_template_profile_for_user(user)
    if profile is None:
        return Template.objects.none()
    return Template.objects.filter(profile=profile, template_scope=Template.TEMPLATE_SCOPE_USER_BASED).select_related("profile__user")


def resolve_template_ids_for_user(user, template_ids):
    if not template_ids:
        return []
    rows = list(template_queryset_for_user(user).filter(id__in=template_ids))
    row_map = {str(item.id): item for item in rows}
    return [row_map[item_id] for item_id in template_ids if item_id in row_map]


def resolve_intro_template_for_user(user, template_id, category):
    template_id_text = str(template_id or "").strip()
    category_text = str(category or "general").strip().lower() or "general"
    if not template_id_text:
        return None
    return template_queryset_for_user(user).filter(id=template_id_text, category=category_text).first()


def subject_template_queryset_for_user(user):
    profile = ensure_template_profile_for_user(user)
    if profile is None:
        return SubjectTemplate.objects.none()
    profile_ids = [profile.id]
    profile_ids.extend(_shared_template_profile_ids_for_user(user))
    return SubjectTemplate.objects.filter(profile_id__in=profile_ids).select_related("profile__user")


def owned_subject_template_queryset_for_user(user):
    profile = ensure_template_profile_for_user(user)
    if profile is None:
        return SubjectTemplate.objects.none()
    return SubjectTemplate.objects.filter(profile=profile).select_related("profile__user")
