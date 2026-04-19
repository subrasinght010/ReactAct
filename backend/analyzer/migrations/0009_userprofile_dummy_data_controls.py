from django.db import migrations, models


def grant_dummy_data_permission_to_existing_users(apps, schema_editor):
    ContentType = apps.get_model("contenttypes", "ContentType")
    Permission = apps.get_model("auth", "Permission")
    User = apps.get_model("auth", "User")
    content_type, _ = ContentType.objects.get_or_create(app_label="analyzer", model="userprofile")
    permission, _ = Permission.objects.get_or_create(
        content_type=content_type,
        codename="view_dummy_data",
        defaults={"name": "Can view shared dummy data"},
    )
    for user in User.objects.all():
        user.user_permissions.add(permission)


class Migration(migrations.Migration):

    dependencies = [
        ("analyzer", "0008_alter_subjecttemplate_category"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="hide_dummy_data",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="hide_shared_dummy_data",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="is_dummy_profile",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterModelOptions(
            name="userprofile",
            options={
                "ordering": ["-updated_at", "-created_at"],
                "permissions": [("view_dummy_data", "Can view shared dummy data")],
            },
        ),
        migrations.RunPython(grant_dummy_data_permission_to_existing_users, migrations.RunPython.noop),
    ]
