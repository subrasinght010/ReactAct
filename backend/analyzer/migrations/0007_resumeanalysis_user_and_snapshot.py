from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_resumeanalysis_user_and_title(apps, schema_editor):
    ResumeAnalysis = apps.get_model('analyzer', 'ResumeAnalysis')
    Resume = apps.get_model('analyzer', 'Resume')

    # Backfill from existing resume relation.
    for a in ResumeAnalysis.objects.select_related('resume').all():
        if a.resume_id:
            try:
                r = Resume.objects.get(id=a.resume_id)
            except Resume.DoesNotExist:
                r = None
            if r:
                a.user_id = r.user_id
                a.resume_title = r.title or ''
                a.save(update_fields=['user', 'resume_title'])


class Migration(migrations.Migration):
    dependencies = [
        ('analyzer', '0006_remove_resumeanalysis_grammar'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='resumeanalysis',
            name='user',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='analyses',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='resumeanalysis',
            name='resume_title',
            field=models.CharField(blank=True, max_length=140),
        ),
        migrations.AlterField(
            model_name='resumeanalysis',
            name='resume',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='analyses',
                to='analyzer.resume',
            ),
        ),
        migrations.RunPython(
            backfill_resumeanalysis_user_and_title,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name='resumeanalysis',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='analyses',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]

