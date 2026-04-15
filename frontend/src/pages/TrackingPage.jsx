import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ResumeSheet from '../components/ResumeSheet'
import { MultiSelectDropdown, SingleSelectDropdown } from '../components/SearchableDropdown'
import { MailTestIcon } from './TrackingMailTestPage'

import {
  createTrackingRow,
  deleteTrackingRow,
  fetchTemplates,
  fetchCompanies,
  fetchEmployees,
  fetchJobs,
  fetchResumes,
  fetchTrackingRows,
  updateTrackingRow,
} from '../api'

const EMPTY_MILESTONE_DOTS = 10

function DetailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5c5.5 0 9.6 5.2 10.8 6.9c.3.4.3.9 0 1.3C21.6 14.8 17.5 20 12 20S2.4 14.8 1.2 13.1a1 1 0 0 1 0-1.3C2.4 10.2 6.5 5 12 5Zm0 3.5A4.5 4.5 0 1 0 12 17a4.5 4.5 0 0 0 0-9Zm0 2a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5Z"
      />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm18-11.5a1 1 0 0 0 0-1.41l-1.34-1.34a1 1 0 0 0-1.41 0l-1.13 1.13l2.75 2.75L21 5.75Z"
      />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Zm-1 12h12a1 1 0 0 0 1-1V8H5v12a1 1 0 0 0 1 1Z"
      />
    </svg>
  )
}

function PreviewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5c5.5 0 9.6 5.2 10.8 6.9c.3.4.3.9 0 1.3C21.6 14.8 17.5 20 12 20S2.4 14.8 1.2 13.1a1 1 0 0 1 0-1.3C2.4 10.2 6.5 5 12 5Zm0 3.5A4.5 4.5 0 1 0 12 17a4.5 4.5 0 0 0 0-9Zm0 2a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5Z"
      />
    </svg>
  )
}

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function nowDateTimeLocalValue() {
  const d = new Date(Date.now() - (new Date().getTimezoneOffset() * 60000))
  return d.toISOString().slice(0, 16)
}

function toDateTimeLocalInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const local = new Date(d.getTime() - (d.getTimezoneOffset() * 60000))
  return local.toISOString().slice(0, 16)
}

function isFollowUpTemplate(choice) {
  return ['follow_up_applied', 'follow_up_call', 'follow_up_interview', 'follow_up_referral'].includes(String(choice || '').trim())
}

function formatMilestoneLabel(item) {
  if (!item) return '--'
  const type = item.type === 'followup' ? 'Follow Up' : 'Fresh'
  const date = item.at ? new Date(item.at) : null
  const timeText = date && !Number.isNaN(date.getTime())
    ? `${toDateInput(item.at)} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '--'
  return `${type} | ${timeText}`
}

function rowHasFreshMilestone(row) {
  return (row?.milestones || []).some((item) => item.type === 'fresh')
}

function mailTypeToActionType(mailType) {
  return String(mailType || '').trim().toLowerCase() === 'followed_up' ? 'followup' : 'fresh'
}

function rowLastActionType(row) {
  const items = row?.milestones || []
  if (items.length) return String(items[items.length - 1]?.type || '')
  const mailType = String(row?.mail_type || '').trim().toLowerCase()
  if (mailType === 'followed_up') return 'followup'
  if (mailType === 'fresh') return 'fresh'
  return ''
}

function rowLastSendMode(row) {
  const items = row?.milestones || []
  if (items.length) {
    const mode = String(items[items.length - 1]?.mode || '').trim().toLowerCase()
    return mode === 'sent' ? 'On Time' : (mode || '')
  }
  return row?.schedule_time ? 'scheduled' : 'On Time'
}

function uniqueArray(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((x) => String(x || '').trim()).filter(Boolean)))
}

function humanizeLabel(value, fallback = '-') {
  const text = String(value || '').trim()
  if (!text) return fallback
  return text.replaceAll('_', ' ')
}

function formatMailTypeLabel(value) {
  return String(value || '').trim().toLowerCase() === 'followup' ? 'Follow Up' : 'Fresh'
}

function formatSendModeLabel(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return '-'
  if (text === 'sent' || text === 'on time') return 'On Time'
  if (text === 'scheduled') return 'Scheduled'
  return humanizeLabel(text)
}

function formatStatusLabel(value) {
  const text = String(value || 'pending').trim().toLowerCase()
  if (text === 'complete_sent') return 'Complete Sent'
  if (text === 'partial_sent') return 'Partial Sent'
  if (text === 'failed') return 'Failed'
  return 'Pending'
}

function formatDeliveryEntryLabel(item) {
  const name = String(item?.employee_name || '').trim()
  const email = String(item?.email || '').trim()
  if (name && email) return `${name} (${email})`
  if (email) return email
  if (name) return name
  return '-'
}

function formatDeliveryEntryReason(item) {
  const reason = String(item?.reason || '').trim()
  if (!reason) return ''
  return String(item?.failure_type || '').trim().toLowerCase() === 'bounced' ? `Bounce: ${reason}` : reason
}

const TEMPLATE_CHOICES = [
  { value: 'cold_applied', label: 'Cold Applied' },
  { value: 'referral', label: 'Referral' },
  { value: 'job_inquire', label: 'Job Inquire' },
  { value: 'follow_up_applied', label: 'Follow Up (Applied)' },
  { value: 'follow_up_referral', label: 'Follow Up (Referral)' },
  { value: 'follow_up_call', label: 'Follow Up (After Call)' },
  { value: 'follow_up_interview', label: 'Follow Up (After Interview)' },
  { value: 'custom', label: 'Custom' },
]

const MAIL_TYPE_OPTIONS = [
  { value: 'fresh', label: 'Fresh' },
  { value: 'followed_up', label: 'Folloup' },
]

const SEND_MODE_OPTIONS = [
  { value: 'sent', label: 'Sent' },
  { value: 'scheduled', label: 'Schedule' },
]

const COLD_MAIL_COMPOSER_OPTIONS = [
  { value: 'hardcoded', label: 'Hardcoded' },
  { value: 'partial_ai', label: 'Partial AI' },
]

const STANDARD_MAIL_COMPOSER_OPTIONS = [
  { value: 'hardcoded', label: 'Hardcoded' },
]

function resolveComposeModeForTemplate(templateChoice, currentMode = 'hardcoded') {
  const choice = String(templateChoice || '').trim()
  const mode = String(currentMode || 'hardcoded').trim() || 'hardcoded'
  if (choice === 'custom') return 'complete_ai'
  if (choice === 'cold_applied') return mode === 'partial_ai' ? 'partial_ai' : 'hardcoded'
  return 'hardcoded'
}

function composerOptionsForTemplate(templateChoice) {
  return String(templateChoice || '').trim() === 'cold_applied' ? COLD_MAIL_COMPOSER_OPTIONS : STANDARD_MAIL_COMPOSER_OPTIONS
}

const TEMPLATE_DEPARTMENT_RULES = {
  cold_applied: ['hr'],
  follow_up_applied: ['hr'],
  follow_up_referral: ['engineering'],
  follow_up_call: ['hr'],
  follow_up_interview: ['hr'],
  referral: ['engineering'],
  job_inquire: ['hr', 'engineering'],
}

function departmentBucket(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return 'other'
  if (text.includes('hr') || text.includes('talent') || text.includes('recruit') || text.includes('human resource')) return 'hr'
  if (text.includes('engineer') || text.includes('developer') || text.includes('sde') || text.includes('software') || text.includes('devops') || text.includes('qa') || text.includes('data')) return 'engineering'
  return 'other'
}

function departmentBucketForEmployee(employee) {
  const dept = String(employee?.department || '').trim()
  const role = String(employee?.JobRole || '').trim()
  return departmentBucket(`${dept} ${role}`.trim())
}

function resolveDepartmentBuckets({ department, selectedIds, employees }) {
  const selectedSet = new Set((Array.isArray(selectedIds) ? selectedIds : []).map((id) => String(id)))
  const selectedEmployees = (Array.isArray(employees) ? employees : []).filter((emp) => selectedSet.has(String(emp.id)))
  if (selectedEmployees.length) {
    return Array.from(new Set(selectedEmployees.map((emp) => departmentBucketForEmployee(emp))))
  }
  const fromDepartment = departmentBucket(department)
  return fromDepartment === 'other' && !String(department || '').trim() ? [] : [fromDepartment]
}

function isTemplateAllowedForBuckets(templateChoice, buckets) {
  const normalizedChoice = String(templateChoice || '').trim()
  const allowed = TEMPLATE_DEPARTMENT_RULES[normalizedChoice]
  if (!allowed || !Array.isArray(buckets) || !buckets.length) return true
  return buckets.every((bucket) => allowed.includes(bucket))
}

function isTemplateAllowedForMailType(templateChoice, mailType) {
  const normalizedChoice = String(templateChoice || '').trim()
  const normalizedMailType = String(mailType || 'fresh').trim().toLowerCase()
  if (!normalizedChoice) return true
  if (normalizedMailType === 'followed_up') return isFollowUpTemplate(normalizedChoice)
  return !isFollowUpTemplate(normalizedChoice)
}

function mailTypeOptionsForRow(hasFreshMilestone) {
  if (hasFreshMilestone) return MAIL_TYPE_OPTIONS
  return MAIL_TYPE_OPTIONS.filter((item) => item.value === 'fresh')
}

function isTemplateAllowed(templateChoice, buckets, mailType) {
  return isTemplateAllowedForBuckets(templateChoice, buckets) && isTemplateAllowedForMailType(templateChoice, mailType)
}

function getTemplateOptionsForBuckets(buckets, mailType) {
  return TEMPLATE_CHOICES.filter((item) => isTemplateAllowed(item.value, buckets, mailType))
}

function getTemplateRestrictionError(templateChoice, buckets, mailType) {
  const normalizedChoice = String(templateChoice || '').trim()
  if (!normalizedChoice) return ''
  if (!isTemplateAllowedForMailType(normalizedChoice, mailType)) {
    return String(mailType || 'fresh').trim().toLowerCase() === 'followed_up'
      ? 'For Folloup mail type, only follow-up templates are allowed.'
      : 'For Fresh mail type, only Cold Applied, Referral, Job Inquire, and Custom templates are allowed.'
  }
  if (isTemplateAllowedForBuckets(normalizedChoice, buckets)) return ''
  const allowed = TEMPLATE_DEPARTMENT_RULES[normalizedChoice] || []
  const allowedText = allowed.map((item) => (item === 'hr' ? 'HR' : 'Engineering')).join(', ')
  return `Template "${normalizedChoice}" is only allowed for ${allowedText} department contacts.`
}

function mergeAchievementOptions(baseOptions, selectedMeta) {
  const rows = Array.isArray(baseOptions) ? [...baseOptions] : []
  const selectedId = String(selectedMeta?.id || '').trim()
  if (!selectedId) return rows
  if (rows.some((item) => String(item?.id || '') === selectedId)) return rows
  return [
    {
      id: selectedId,
      name: String(selectedMeta?.name || 'Template').trim() || 'Template',
      paragraph: String(selectedMeta?.text || '').trim(),
      category: String(selectedMeta?.category || 'general').trim() || 'general',
    },
    ...rows,
  ]
}

function filterAchievementOptionsForMode(options) {
  return Array.isArray(options) ? options : []
}

function templateSelectionError(templateChoice, values, options) {
  const ids = orderedAchievementIds(values)
  if (String(templateChoice || '').trim() === 'custom') return ''
  if (!ids.length) return 'Select templates in order.'
  if (ids.length > 5) return 'Select at most 5 templates.'
  const rows = ids
    .map((id) => (Array.isArray(options) ? options.find((item) => String(item?.id || '') === String(id)) : null))
    .filter(Boolean)
  if (rows.length !== ids.length) return 'One or more selected templates were not found.'
  const isFollowUp = isFollowUpTemplate(templateChoice)
  const firstCategory = String(rows[0]?.category || 'general').trim().toLowerCase()
  const lastCategory = String(rows[rows.length - 1]?.category || 'general').trim().toLowerCase()
  if (isFollowUp) {
    if (rows.length < 2) return 'For follow-up mail, select at least 2 templates: one paragraph and one closing.'
    if (lastCategory !== 'closing') return 'For follow-up mail, the last selected template must be Closing.'
    if (!rows.slice(0, -1).some((item) => String(item?.category || 'general').trim().toLowerCase() !== 'closing')) {
      return 'For follow-up mail, add at least one template before the closing.'
    }
    return ''
  }
  if (rows.length < 3) return 'For non-follow-up mail, select at least 3 templates: opening, body, and closing.'
  if (firstCategory !== 'opening') return 'For non-follow-up mail, the first selected template must be Opening.'
  if (lastCategory !== 'closing') return 'For non-follow-up mail, the last selected template must be Closing.'
  if (!rows.slice(1, -1).some((item) => ['experience', 'general'].includes(String(item?.category || 'general').trim().toLowerCase()))) {
    return 'For non-follow-up mail, add at least one Experience or General template between opening and closing.'
  }
  return ''
}

function orderedAchievementIds(values) {
  const out = []
  const seen = new Set()
  ;(Array.isArray(values) ? values : []).forEach((value) => {
    const text = String(value || '').trim()
    if (!text || seen.has(text)) return
    seen.add(text)
    out.push(text)
  })
  return out.slice(0, 5)
}

function syncLegacyAchievementFields(form, options) {
  const ids = orderedAchievementIds(form?.achievement_ids_ordered)
  const first = (Array.isArray(options) ? options : []).find((item) => String(item?.id || '') === String(ids[0] || ''))
  return {
    ...form,
    achievement_ids_ordered: ids,
    template_ids_ordered: ids,
    achievement_id: first ? String(first.id) : '',
    achievement_name: first ? String(first.name || '') : '',
    achievement_text: first ? String(first.paragraph || '') : '',
  }
}

function hardcodedAchievementOptionsForIndex(options, values, index) {
  const ids = Array.isArray(values) ? values.map((value) => String(value || '').trim()) : []
  const selectedByOthers = new Set(
    ids
      .map((value, currentIndex) => (currentIndex === index ? '' : value))
      .filter(Boolean),
  )
  return (Array.isArray(options) ? options : []).filter((item) => !selectedByOthers.has(String(item?.id || '')))
}

function hardcodedAchievementSlotDisabled(values, index) {
  if (index === 0) return false
  const ids = Array.isArray(values) ? values : []
  return !String(ids[index - 1] || '').trim()
}

function updateHardcodedAchievementIds(values, index, nextValue) {
  const nextIds = Array.from({ length: 5 }, (_, currentIndex) => String((Array.isArray(values) ? values[currentIndex] : '') || '').trim())
  nextIds[index] = String(nextValue || '').trim()
  for (let currentIndex = index + 1; currentIndex < nextIds.length; currentIndex += 1) {
    if (!nextIds[currentIndex - 1]) nextIds[currentIndex] = ''
  }
  return nextIds
}

function TrackingPage() {
  const access = localStorage.getItem('access') || ''
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(8)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [createForm, setCreateForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [createFormError, setCreateFormError] = useState('')
  const [editFormError, setEditFormError] = useState('')
  const [filters, setFilters] = useState({
    companyName: '',
    jobId: '',
    appliedDate: '',
    mailed: 'all',
    gotReplied: 'all',
    lastAction: 'all',
  })
  const [ordering, setOrdering] = useState('-applied_at')
  const [selectedIds, setSelectedIds] = useState([])
  const [editForm, setEditForm] = useState(null)
  const [companyOptions, setCompanyOptions] = useState([])
  const [jobOptions, setJobOptions] = useState([])
  const [employeeOptions, setEmployeeOptions] = useState([])
  const [resumeOptions, setResumeOptions] = useState([])
  const [achievementOptions, setAchievementOptions] = useState([])
  const [previewResume, setPreviewResume] = useState(null)

  const tailoredOptionsForJob = (jobId) => {
    const job = jobOptions.find((item) => String(item.id) === String(jobId || ''))
    if (!job) return []
    const options = Array.isArray(job.tailored_resumes) ? [...job.tailored_resumes] : []
    options.sort((a, b) => {
      const aTime = new Date(a?.created_at || 0).getTime()
      const bTime = new Date(b?.created_at || 0).getTime()
      if (aTime !== bTime) return aTime - bTime
      return Number(a?.id || 0) - Number(b?.id || 0)
    })
    return options
  }
  const load = async () => {
    if (!access) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchTrackingRows(access, { page, page_size: pageSize })
      const list = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : [])
      setRows(list)
      setTotalCount(Number(data?.count || list.length || 0))
      setTotalPages(Number(data?.total_pages || 1))
      if (data?.page && Number(data.page) !== page) {
        setPage(Number(data.page))
      }
    } catch (err) {
      console.error(err.message || 'Failed to load tracking rows.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [access, page, pageSize])

  useEffect(() => {
    if (!access) return
    ;(async () => {
      try {
        const [companiesData, resumesData, achievementsData, employeesData] = await Promise.all([
          fetchCompanies(access, { page: 1, page_size: 300 }),
          fetchResumes(access).catch(() => []),
          fetchTemplates(access).catch(() => []),
          fetchEmployees(access).catch(() => []),
        ])
        const companyRows = Array.isArray(companiesData?.results) ? companiesData.results : []
        const employees = Array.isArray(employeesData) ? employeesData : []
        const employeeCompanyIds = new Set(
          employees
            .filter((emp) => emp?.working_mail !== false && emp?.company != null)
            .map((emp) => String(emp.company)),
        )

        const openJobCompanyIds = new Set()
        let page = 1
        let totalPages = 1
        do {
          const jobsData = await fetchJobs(access, { page, page_size: 100 })
          const jobs = Array.isArray(jobsData?.results) ? jobsData.results : []
          jobs.forEach((job) => {
            if (!job) return
            if (Boolean(job.is_closed)) return
            if (Boolean(job.is_removed)) return
            const companyId = job.company != null ? String(job.company) : ''
            if (companyId) openJobCompanyIds.add(companyId)
          })
          totalPages = Number(jobsData?.total_pages || 1)
          page += 1
        } while (page <= totalPages)

        const eligibleCompanies = companyRows.filter((company) => {
          const id = String(company?.id || '')
          return id && employeeCompanyIds.has(id) && openJobCompanyIds.has(id)
        })

        setCompanyOptions(eligibleCompanies)
        setResumeOptions(Array.isArray(resumesData) ? resumesData : [])
        setAchievementOptions(Array.isArray(achievementsData) ? achievementsData : [])
      } catch {
        setCompanyOptions([])
        setResumeOptions([])
        setAchievementOptions([])
      }
    })()
  }, [access])

  const hydrateCompanyDependent = async (companyId) => {
    if (!companyId) {
      setJobOptions([])
      setEmployeeOptions([])
      return
    }
    try {
      const [jobsData, employeesData] = await Promise.all([
        fetchJobs(access, { page: 1, page_size: 300, company_id: companyId }),
        fetchEmployees(access, companyId),
      ])
      const jobs = Array.isArray(jobsData?.results) ? jobsData.results : []
      const emps = Array.isArray(employeesData) ? employeesData : []
      setJobOptions(jobs)
      setEmployeeOptions(emps)
    } catch {
      setJobOptions([])
      setEmployeeOptions([])
    }
  }

  const openCreateForm = () => {
    setCreateFormError('')
    setCreateForm({
      company: '',
      job: '',
      department: '',
      template_name: '',
      template_subject: '',
      template_choice: '',
      mail_type: 'fresh',
      send_mode: 'sent',
      compose_mode: 'hardcoded',
      hardcoded_follow_up: true,
      schedule_time: '',
      has_attachment: false,
      achievement_id: '',
      achievement_ids_ordered: [],
      template_ids_ordered: [],
      achievement_name: '',
      achievement_text: '',
      resume_id: '',
      tailored_resume_id: '',
      is_freezed: false,
      mailed: false,
      got_replied: false,
      applied_date: toDateInput(new Date().toISOString()),
      posting_date: toDateInput(new Date().toISOString()),
      is_open: true,
      selected_hr_ids: [],
    })
  }

  const createRow = async () => {
    if (!createForm) return
    if (!createForm.company) {
      setCreateFormError('Select company from dropdown.')
      return
    }
    if (!createForm.department) {
      setCreateFormError('Department is mandatory.')
      return
    }
    if (!Array.isArray(createForm.selected_hr_ids) || !createForm.selected_hr_ids.length) {
      setCreateFormError('Select at least one employee.')
      return
    }
    if (!createForm.job) {
      setCreateFormError('Job is mandatory.')
      return
    }
    const createAchievementIds = orderedAchievementIds(createForm.achievement_ids_ordered)
    if (!createForm.mail_type) {
      setCreateFormError('Mail Type is mandatory.')
      return
    }
    if (createForm.send_mode === 'scheduled' && !createForm.schedule_time) {
      setCreateFormError('Date & Time is mandatory for scheduled mail.')
      return
    }
    const selectedCompany = companyOptions.find((c) => String(c.id) === String(createForm.company))
    const selectedJob = jobOptions.find((j) => String(j.id) === String(createForm.job))
    const companyName = String(selectedCompany?.name || '').trim()
    const jobId = String(selectedJob?.job_id || '').trim()
    const role = String(selectedJob?.role || '').trim()
    const jobUrl = String(selectedJob?.job_link || '').trim()
    const resolvedTemplate = createForm.template_choice === 'custom'
      ? String(createForm.template_name || '').trim()
      : String(createForm.template_choice || '').trim()
    const resolvedTemplateSubject = createForm.template_choice === 'custom'
      ? String(createForm.template_subject || '').trim()
      : ''
    const resolvedTemplateChoice = String(createForm.template_choice || '').trim() || 'cold_applied'
    const resolvedTemplateMessage = resolvedTemplateChoice === 'custom' ? resolvedTemplate : ''
    const resolvedComposeMode = resolvedTemplateChoice === 'custom'
      ? 'complete_ai'
      : resolveComposeModeForTemplate(resolvedTemplateChoice, createForm.compose_mode)
    const createTemplateError = templateSelectionError(resolvedTemplateChoice, createAchievementIds, createAchievementOptionsForMode)
    if (createTemplateError) {
      setCreateFormError(createTemplateError)
      return
    }
    const templateRestrictionError = getTemplateRestrictionError(
      resolvedTemplateChoice,
      createDepartmentBuckets,
      createForm.mail_type,
    )
    if (templateRestrictionError) {
      setCreateFormError(templateRestrictionError)
      return
    }
    if (resolvedTemplateChoice === 'custom' && (!resolvedTemplateSubject || !resolvedTemplateMessage)) {
      setCreateFormError('Custom mail requires both subject and body.')
      return
    }
    if (!createForm.has_attachment) {
      setCreateFormError('Attachment is mandatory. Check Attachment and select one resume or tailored resume.')
      return
    }
    if (!createForm.resume_id && !createForm.tailored_resume_id) {
      setCreateFormError('Attachment is mandatory. Select one resume or tailored resume.')
      return
    }
    if (createForm.mail_type === 'followed_up') {
      setCreateFormError('First time mail must be Fresh before any Folloup mail.')
      return
    }
    const resolvedHardcodedFollowUp = resolvedComposeMode !== 'complete_ai'
    const resolvedScheduleTime = createForm.send_mode === 'scheduled'
      ? (createForm.schedule_time || nowDateTimeLocalValue())
      : null
    try {
      setCreateFormError('')
      const payload = {
        company: createForm.company || null,
        job: createForm.job || null,
        template: createAchievementIds[0] || null,
        template_id: createAchievementIds[0] || null,
        template_ids_ordered: createAchievementIds,
        achievement: createAchievementIds[0] || null,
        achievement_ids_ordered: createAchievementIds,
        company_name: companyName,
        job_id: jobId,
        role,
        job_url: jobUrl,
        template_choice: resolvedTemplateChoice,
        template_subject: resolvedTemplateSubject,
        template_message: resolvedTemplateMessage,
        compose_mode: resolvedComposeMode,
        hardcoded_follow_up: resolvedHardcodedFollowUp,
        schedule_time: resolvedScheduleTime,
        template_name: resolvedTemplate,
        mail_type: createForm.mail_type || 'fresh',
        resume: createForm.has_attachment ? (createForm.resume_id || null) : null,
        tailored_resume: createForm.has_attachment ? (createForm.tailored_resume_id || null) : null,
        is_freezed: Boolean(createForm.is_freezed),
        mailed: createForm.send_mode === 'sent' ? true : Boolean(createForm.mailed),
        got_replied: Boolean(createForm.got_replied),
        applied_date: createForm.applied_date || null,
        posting_date: createForm.posting_date || null,
        is_open: Boolean(createForm.is_open),
        selected_hr_ids: Array.isArray(createForm.selected_hr_ids) ? createForm.selected_hr_ids : [],
      }
      if (createForm.send_mode === 'sent') {
        payload.append_action = {
          type: mailTypeToActionType(createForm.mail_type),
          send_mode: 'now',
          action_at: new Date().toISOString(),
        }
      }
      const created = await createTrackingRow(access, payload)
      setRows((prev) => [created, ...prev])
      setCreateForm(null)
      await load()
    } catch (err) {
      setCreateFormError(err.message || 'Could not create tracking row.')
    }
  }

  const openEditForm = (row) => {
    setEditFormError('')
    const incomingTemplateChoice = String(row.template_choice || '').trim()
    const computedChoice = ['cold_applied', 'referral', 'job_inquire', 'follow_up_applied', 'follow_up_referral', 'follow_up_call', 'follow_up_interview', 'custom'].includes(incomingTemplateChoice)
      ? incomingTemplateChoice
      : (
        ['cold_applied', 'referral', 'job_inquire', 'follow_up_applied', 'follow_up_referral', 'follow_up_call', 'follow_up_interview'].includes(String(row.template_name || '').trim())
          ? String(row.template_name || '').trim()
          : 'custom'
      )
    const customTemplateText = computedChoice === 'custom'
      ? String(row.template_message || row.template_name || '')
      : ''
    const customTemplateSubject = computedChoice === 'custom'
      ? String(row.template_subject || '')
      : ''
    setEditForm({
      id: row.id,
      company: row.company || '',
      job: row.job || '',
      department: '',
      company_name: row.company_name || '',
      job_id: row.job_id || '',
      role: row.role || '',
      job_url: row.job_url || '',
      template_name: customTemplateText,
      template_subject: customTemplateSubject,
      template_choice: computedChoice,
      mail_type: String(row.mail_type || 'fresh').trim() || 'fresh',
      send_mode: row.schedule_time ? 'scheduled' : 'sent',
      initial_action_type: rowLastActionType(row) || '',
      initial_send_mode: row.schedule_time ? 'scheduled' : 'sent',
      initial_milestone_count: Array.isArray(row.milestones) ? row.milestones.length : 0,
      has_fresh_milestone: rowHasFreshMilestone(row),
      compose_mode: String(
        row.compose_mode
        || (computedChoice === 'custom'
          ? 'complete_ai'
          : resolveComposeModeForTemplate(computedChoice, row.compose_mode || (Boolean(row.hardcoded_follow_up ?? true) ? 'hardcoded' : 'complete_ai')))
      ).trim() || 'hardcoded',
      hardcoded_follow_up: resolveComposeModeForTemplate(computedChoice, row.compose_mode || (Boolean(row.hardcoded_follow_up ?? true) ? 'hardcoded' : 'complete_ai')) !== 'complete_ai',
      schedule_time: toDateTimeLocalInput(row.schedule_time),
      has_attachment: Boolean(row.resume_preview || row.tailored_resume),
      achievement_id: row.achievement_id ? String(row.achievement_id) : '',
      achievement_ids_ordered: Array.isArray(row.achievement_ids_ordered)
        ? row.achievement_ids_ordered.map((id) => String(id))
        : (row.achievement_id ? [String(row.achievement_id)] : []),
      template_ids_ordered: Array.isArray(row.template_ids_ordered)
        ? row.template_ids_ordered.map((id) => String(id))
        : (Array.isArray(row.achievement_ids_ordered)
          ? row.achievement_ids_ordered.map((id) => String(id))
          : (row.achievement_id ? [String(row.achievement_id)] : [])),
      achievement_name: row.achievement_name || '',
      achievement_text: row.achievement_text || '',
      resume_id: row.resume_preview?.id ? String(row.resume_preview.id) : '',
      tailored_resume_id: row.tailored_resume ? String(row.tailored_resume) : '',
      is_freezed: Boolean(row.is_freezed),
      mailed: Boolean(row.mailed),
      applied_date: toDateInput(row.applied_date),
      posting_date: toDateInput(row.posting_date),
      is_open: Boolean(row.is_open),
      selected_hr_ids: Array.isArray(row.selected_hr_ids) ? row.selected_hr_ids.map((id) => String(id)) : [],
      got_replied: Boolean(row.got_replied),
    })
    hydrateCompanyDependent(row.company || '')
  }

  const saveEditForm = async () => {
    if (!editForm) return
    if (!editForm.company) {
      setEditFormError('Select company from dropdown.')
      return
    }
    if (!editForm.department) {
      setEditFormError('Department is mandatory.')
      return
    }
    if (!Array.isArray(editForm.selected_hr_ids) || !editForm.selected_hr_ids.length) {
      setEditFormError('Select at least one employee.')
      return
    }
    if (!editForm.job) {
      setEditFormError('Job is mandatory.')
      return
    }
    const editAchievementIds = orderedAchievementIds(editForm.achievement_ids_ordered)
    if (!editForm.mail_type) {
      setEditFormError('Mail Type is mandatory.')
      return
    }
    if (editForm.send_mode === 'scheduled' && !editForm.schedule_time) {
      setEditFormError('Date & Time is mandatory for scheduled mail.')
      return
    }
    const selectedCompany = companyOptions.find((c) => String(c.id) === String(editForm.company))
    const selectedJob = jobOptions.find((j) => String(j.id) === String(editForm.job))
    const companyName = String(selectedCompany?.name || editForm.company_name || '').trim()
    const jobId = String(selectedJob?.job_id || editForm.job_id || '').trim()
    const role = String(selectedJob?.role || editForm.role || '').trim()
    const jobUrl = String(selectedJob?.job_link || editForm.job_url || '').trim()
    const resolvedTemplate = editForm.template_choice === 'custom'
      ? String(editForm.template_name || '').trim()
      : String(editForm.template_choice || '').trim()
    const resolvedTemplateSubject = editForm.template_choice === 'custom'
      ? String(editForm.template_subject || '').trim()
      : ''
    const resolvedTemplateChoice = String(editForm.template_choice || '').trim() || 'cold_applied'
    const resolvedTemplateMessage = resolvedTemplateChoice === 'custom' ? resolvedTemplate : ''
    const resolvedComposeMode = resolvedTemplateChoice === 'custom'
      ? 'complete_ai'
      : resolveComposeModeForTemplate(resolvedTemplateChoice, editForm.compose_mode)
    const editTemplateError = templateSelectionError(resolvedTemplateChoice, editAchievementIds, editAchievementOptionsForMode)
    if (editTemplateError) {
      setEditFormError(editTemplateError)
      return
    }
    const templateRestrictionError = getTemplateRestrictionError(
      resolvedTemplateChoice,
      editDepartmentBuckets,
      editForm.mail_type,
    )
    if (templateRestrictionError) {
      setEditFormError(templateRestrictionError)
      return
    }
    if (resolvedTemplateChoice === 'custom' && (!resolvedTemplateSubject || !resolvedTemplateMessage)) {
      setEditFormError('Custom mail requires both subject and body.')
      return
    }
    if (!editForm.has_attachment) {
      setEditFormError('Attachment is mandatory. Check Attachment and select one resume or tailored resume.')
      return
    }
    if (!editForm.resume_id && !editForm.tailored_resume_id) {
      setEditFormError('Attachment is mandatory. Select one resume or tailored resume.')
      return
    }
    if (editForm.mail_type === 'followed_up' && !editHasFreshMilestone) {
      setEditFormError('First time mail must be Fresh before any Folloup mail.')
      return
    }
    const resolvedHardcodedFollowUp = resolvedComposeMode !== 'complete_ai'
    const resolvedScheduleTime = editForm.send_mode === 'scheduled'
      ? (editForm.schedule_time || nowDateTimeLocalValue())
      : null
    const selectedHrIds = Array.isArray(editForm.selected_hr_ids) ? editForm.selected_hr_ids : []
    const basePayload = {
      company: editForm.company || null,
      job: editForm.job || null,
      template: editAchievementIds[0] || null,
      template_id: editAchievementIds[0] || null,
      template_ids_ordered: editAchievementIds,
      achievement: editAchievementIds[0] || null,
      achievement_ids_ordered: editAchievementIds,
      company_name: companyName,
      job_id: jobId,
      role,
      job_url: jobUrl,
      template_choice: resolvedTemplateChoice,
      template_subject: resolvedTemplateSubject,
      template_message: resolvedTemplateMessage,
      compose_mode: resolvedComposeMode,
      hardcoded_follow_up: resolvedHardcodedFollowUp,
      schedule_time: resolvedScheduleTime,
      template_name: resolvedTemplate,
      mail_type: editForm.mail_type || 'fresh',
      resume: editForm.resume_id || null,
      tailored_resume: editForm.tailored_resume_id || null,
      is_freezed: Boolean(editForm.is_freezed),
      mailed: editForm.send_mode === 'sent' ? true : editForm.mailed,
      applied_date: editForm.applied_date || null,
      posting_date: editForm.posting_date || null,
      is_open: editForm.is_open,
      selected_hr_ids: selectedHrIds,
      got_replied: editForm.got_replied,
    }
    try {
      setEditFormError('')
      const payload = {
        ...basePayload,
        resume: editForm.has_attachment ? (editForm.resume_id || null) : null,
        tailored_resume: editForm.has_attachment ? (editForm.tailored_resume_id || null) : null,
      }
      const nextActionType = mailTypeToActionType(editForm.mail_type)
      const shouldAppendOnTimeAction = editForm.send_mode === 'sent' && (
        Number(editForm.initial_milestone_count || 0) === 0
        || String(editForm.initial_send_mode || '') !== 'sent'
        || String(editForm.initial_action_type || '') !== nextActionType
      )
      if (shouldAppendOnTimeAction) {
        payload.append_action = {
          type: nextActionType,
          send_mode: 'now',
          action_at: new Date().toISOString(),
        }
      }
      const updated = await updateTrackingRow(access, editForm.id, payload)
      setRows((prev) => prev.map((row) => (row.id === editForm.id ? updated : row)))
      setEditForm(null)
    } catch (err) {
      setEditFormError(err.message || 'Could not save tracking row.')
    }
  }

  const removeRow = async (rowId) => {
    try {
      await deleteTrackingRow(access, rowId)
      await load()
    } catch (err) {
      console.error(err.message || 'Could not delete row.')
    }
  }

  const bulkDeleteSelected = async () => {
    if (!selectedIds.length) return
    try {
      await Promise.allSettled(selectedIds.map((id) => deleteTrackingRow(access, id)))
      setSelectedIds([])
      await load()
    } catch (err) {
      console.error(err.message || 'Could not delete selected tracking rows.')
    }
  }

  const bulkFreezeSelected = async () => {
    if (!selectedIds.length) return
    try {
      const targetRows = filteredRows.filter((row) => selectedIds.includes(row.id))
      await Promise.allSettled(
        targetRows.map((row) => updateTrackingRow(access, row.id, { is_freezed: true })),
      )
      setSelectedIds([])
      await load()
    } catch (err) {
      console.error(err.message || 'Could not freeze selected tracking rows.')
    }
  }

  const filteredRows = useMemo(() => {
    const out = rows.filter((row) => {
      if (filters.companyName && !String(row.company_name || '').toLowerCase().includes(filters.companyName.toLowerCase())) return false
      if (filters.jobId && !String(row.job_id || '').toLowerCase().includes(filters.jobId.toLowerCase())) return false
      if (filters.appliedDate && toDateInput(row.applied_date) !== filters.appliedDate) return false
      if (filters.mailed === 'yes' && !row.mailed) return false
      if (filters.mailed === 'no' && row.mailed) return false
      if (filters.gotReplied === 'yes' && !row.got_replied) return false
      if (filters.gotReplied === 'no' && row.got_replied) return false
      const actionType = rowLastActionType(row)
      if (filters.lastAction !== 'all' && actionType !== filters.lastAction) return false
      return true
    })
    out.sort((a, b) => {
      const aApplied = new Date(a.applied_date || 0).getTime()
      const bApplied = new Date(b.applied_date || 0).getTime()
      const aCreated = new Date(a.created_at || 0).getTime()
      const bCreated = new Date(b.created_at || 0).getTime()
      const aCompany = String(a.company_name || '').toLowerCase()
      const bCompany = String(b.company_name || '').toLowerCase()
      const aJob = String(a.job_id || '').toLowerCase()
      const bJob = String(b.job_id || '').toLowerCase()
      const aRole = String(a.role || '').toLowerCase()
      const bRole = String(b.role || '').toLowerCase()

      switch (ordering) {
      case 'applied_at':
        return aApplied - bApplied
      case '-created_at':
        return bCreated - aCreated
      case 'created_at':
        return aCreated - bCreated
      case 'company_name':
        return aCompany.localeCompare(bCompany)
      case '-company_name':
        return bCompany.localeCompare(aCompany)
      case 'job_id':
        return aJob.localeCompare(bJob)
      case '-job_id':
        return bJob.localeCompare(aJob)
      case 'role':
        return aRole.localeCompare(bRole)
      case '-role':
        return bRole.localeCompare(aRole)
      case '-applied_at':
      default:
        return bApplied - aApplied
      }
    })
    return out
  }, [rows, filters, ordering])
  const trackingStats = useMemo(() => {
    const visibleRows = filteredRows.length
    const mailedCount = filteredRows.filter((row) => row?.mailed).length
    const scheduledCount = filteredRows.filter((row) => String(rowLastSendMode(row)).toLowerCase() === 'scheduled').length
    const freezedCount = filteredRows.filter((row) => row?.is_freezed).length
    return [
      `${visibleRows} visible`,
      `${mailedCount} mailed`,
      `${scheduledCount} scheduled`,
      `${freezedCount} freezed`,
      `${selectedIds.length} selected`,
    ]
  }, [filteredRows, selectedIds])

  const createTailoredOptions = useMemo(
    () => (createForm?.job ? tailoredOptionsForJob(createForm.job) : []),
    [createForm?.job, jobOptions],
  )
  const editTailoredOptions = useMemo(
    () => (editForm?.job ? tailoredOptionsForJob(editForm.job) : []),
    [editForm?.job, jobOptions],
  )
  const orderedResumeOptions = useMemo(() => {
    const options = [...(Array.isArray(resumeOptions) ? resumeOptions : [])]
    options.sort((a, b) => {
      const aTime = new Date(a?.created_at || 0).getTime()
      const bTime = new Date(b?.created_at || 0).getTime()
      if (aTime !== bTime) return aTime - bTime
      return Number(a?.id || 0) - Number(b?.id || 0)
    })
    return options
  }, [resumeOptions])
  const activeEmployeeOptions = useMemo(
    () => (Array.isArray(employeeOptions) ? employeeOptions.filter((emp) => emp?.working_mail !== false) : []),
    [employeeOptions],
  )

  const createDepartmentBuckets = useMemo(
    () => resolveDepartmentBuckets({
      department: createForm?.department || '',
      selectedIds: createForm?.selected_hr_ids || [],
      employees: activeEmployeeOptions,
    }),
    [createForm?.department, createForm?.selected_hr_ids, activeEmployeeOptions],
  )
  const editDepartmentBuckets = useMemo(
    () => resolveDepartmentBuckets({
      department: editForm?.department || '',
      selectedIds: editForm?.selected_hr_ids || [],
      employees: activeEmployeeOptions,
    }),
    [editForm?.department, editForm?.selected_hr_ids, activeEmployeeOptions],
  )
  const createTemplateOptions = useMemo(
    () => getTemplateOptionsForBuckets(createDepartmentBuckets, createForm?.mail_type || 'fresh'),
    [createDepartmentBuckets, createForm?.mail_type],
  )
  const editTemplateOptions = useMemo(
    () => getTemplateOptionsForBuckets(editDepartmentBuckets, editForm?.mail_type || 'fresh'),
    [editDepartmentBuckets, editForm?.mail_type],
  )
  const createMailTypeOptions = useMemo(() => mailTypeOptionsForRow(false), [])
  const editHasFreshMilestone = useMemo(
    () => (editForm ? Boolean(editForm.has_fresh_milestone) : false),
    [editForm],
  )
  const editMailTypeOptions = useMemo(
    () => mailTypeOptionsForRow(editHasFreshMilestone),
    [editHasFreshMilestone],
  )
  const createAchievementDropdownOptions = useMemo(
    () => mergeAchievementOptions(achievementOptions, { id: createForm?.achievement_id }),
    [achievementOptions, createForm?.achievement_id],
  )
  const editAchievementDropdownOptions = useMemo(
    () => mergeAchievementOptions(achievementOptions, {
      id: editForm?.achievement_id,
      name: editForm?.achievement_name,
      text: editForm?.achievement_text,
    }),
    [achievementOptions, editForm?.achievement_id, editForm?.achievement_name, editForm?.achievement_text],
  )
  const createAchievementOptionsForMode = useMemo(
    () => filterAchievementOptionsForMode(createAchievementDropdownOptions),
    [createAchievementDropdownOptions],
  )
  const editAchievementOptionsForMode = useMemo(
    () => filterAchievementOptionsForMode(editAchievementDropdownOptions),
    [editAchievementDropdownOptions],
  )
  const allSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id))
  useEffect(() => {
    if (!createForm) return
    const currentChoice = String(createForm.template_choice || '').trim()
    if (!currentChoice) return
    if (isTemplateAllowed(currentChoice, createDepartmentBuckets, createForm.mail_type)) return
    setCreateForm((prev) => ({
      ...prev,
      template_choice: '',
      template_subject: '',
      template_name: '',
      schedule_time: '',
      compose_mode: 'hardcoded',
      hardcoded_follow_up: true,
    }))
  }, [createForm, createDepartmentBuckets])

  useEffect(() => {
    if (!editForm) return
    const currentChoice = String(editForm.template_choice || '').trim()
    if (!currentChoice) return
    if (isTemplateAllowed(currentChoice, editDepartmentBuckets, editForm.mail_type)) return
    setEditForm((prev) => ({
      ...prev,
      template_choice: '',
      template_subject: '',
      template_name: '',
      schedule_time: '',
      compose_mode: 'hardcoded',
      hardcoded_follow_up: true,
    }))
  }, [editForm, editDepartmentBuckets])

  const toggleSelect = (rowId, checked) => {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, rowId]))
      return prev.filter((id) => id !== rowId)
    })
  }
  const toggleSelectAll = (checked) => {
    setSelectedIds(checked ? filteredRows.map((row) => row.id) : [])
  }

  return (
    <main className="page page-wide page-plain mx-auto w-full">
      <div className="tracking-head">
        <div>
          <h1>Tracking</h1>
          <p className="subtitle">Manage fresh mails, follow-ups, schedules, and milestones from one clean panel.</p>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={bulkFreezeSelected} disabled={!selectedIds.length || loading}>Mark Freezed</button>
          <button type="button" className="secondary" onClick={bulkDeleteSelected} disabled={!selectedIds.length || loading}>Delete Selected</button>
          <button type="button" className="secondary" onClick={openCreateForm}>Add Tracking</button>
        </div>
      </div>

      <div className="tracking-summary-bar">
        {trackingStats.map((item) => (
          <span key={item} className="tracking-summary-chip">{item}</span>
        ))}
      </div>

      <section className="tracking-filters filters-one-row">
        <label>Company Name<input value={filters.companyName} placeholder="Search company" onChange={(event) => setFilters((prev) => ({ ...prev, companyName: event.target.value }))} /></label>
        <label>Job ID<input value={filters.jobId} placeholder="Search job ID" onChange={(event) => setFilters((prev) => ({ ...prev, jobId: event.target.value }))} /></label>
        <label>Applied Date<input type="date" value={filters.appliedDate} onChange={(event) => setFilters((prev) => ({ ...prev, appliedDate: event.target.value }))} /></label>
        <label>Mailed<select value={filters.mailed} onChange={(event) => setFilters((prev) => ({ ...prev, mailed: event.target.value }))}><option value="all">All</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        <label>Replied (got_replied)<select value={filters.gotReplied} onChange={(event) => setFilters((prev) => ({ ...prev, gotReplied: event.target.value }))}><option value="all">All</option><option value="yes">Yes</option><option value="no">No</option></select></label>
        <label>Last Action<select value={filters.lastAction} onChange={(event) => setFilters((prev) => ({ ...prev, lastAction: event.target.value }))}><option value="all">All</option><option value="fresh">Fresh</option><option value="followup">Follow Up</option></select></label>
        <label>
          Sort
          <select value={ordering} onChange={(event) => setOrdering(event.target.value)}>
            <option value="-applied_at">Applied ↓</option>
            <option value="applied_at">Applied ↑</option>
            <option value="-created_at">Created ↓</option>
            <option value="created_at">Created ↑</option>
            <option value="company_name">Company A-Z</option>
            <option value="-company_name">Company Z-A</option>
            <option value="job_id">Job ID A-Z</option>
            <option value="-job_id">Job ID Z-A</option>
            <option value="role">Role A-Z</option>
            <option value="-role">Role Z-A</option>
          </select>
        </label>
      </section>

      {loading ? <p className="hint">Loading tracking rows...</p> : null}

      <div className="tracking-table-wrap tracking-table-wrap-compact">
        <table className="tracking-table tracking-table-compact">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allSelected} onChange={(event) => toggleSelectAll(event.target.checked)} />
              </th>
              <th>Company</th>
              <th>Job ID</th>
              <th>Employee</th>
              <th>Status</th>
              <th>Mailed</th>
              <th>Replied</th>
              <th>Mail Type</th>
              <th>Send</th>
              <th>Freeze</th>
              <th>Template Type</th>
              <th>Resume</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const milestones = Array.isArray(row.milestones) ? row.milestones : []
              const selectedHrValues = uniqueArray(row.selected_hrs)
              const linkedPreviewResume = row.resume_preview || row.tailored_resume_preview || null
              const failedEmployees = Array.isArray(row?.delivery_summary?.failed) ? row.delivery_summary.failed : []

              return (
                <Fragment key={`row-wrap-${row.id}`}>
                  <tr key={`data-${row.id}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={(event) => toggleSelect(row.id, event.target.checked)}
                      />
                    </td>
                    <td className="tracking-primary-cell">{row.company_name || '-'}</td>
                    <td className="tracking-mono-cell">{row.job_id || '-'}</td>
                    <td className="tracking-employee-cell">
                      <div>{selectedHrValues.length ? selectedHrValues.join(', ') : '-'}</div>
                      {failedEmployees.length ? (
                        <div className="tracking-employee-issue-list">
                          {failedEmployees.slice(0, 2).map((item, index) => (
                            <div className="tracking-employee-issue" key={`issue-${row.id}-${item.employee_id || item.email || index}`}>
                              <span className="tracking-employee-issue-title">{formatDeliveryEntryLabel(item)}</span>
                              {formatDeliveryEntryReason(item) ? <span className="tracking-employee-issue-meta">{formatDeliveryEntryReason(item)}</span> : null}
                            </div>
                          ))}
                          {failedEmployees.length > 2 ? <div className="tracking-employee-more">+{failedEmployees.length - 2} more failed/bounced</div> : null}
                        </div>
                      ) : null}
                    </td>
                    <td><span className="tracking-badge tracking-badge-status">{formatStatusLabel(row.mail_delivery_status)}</span></td>
                    <td><span className={`tracking-badge ${row.mailed ? 'is-positive' : 'is-muted'}`}>{row.mailed ? 'Yes' : 'No'}</span></td>
                    <td><span className={`tracking-badge ${row.got_replied ? 'is-positive' : 'is-muted'}`}>{row.got_replied ? 'Yes' : 'No'}</span></td>
                    <td><span className="tracking-badge tracking-badge-type">{formatMailTypeLabel(rowLastActionType(row) || row.mail_type)}</span></td>
                    <td><span className="tracking-badge tracking-badge-send">{formatSendModeLabel(rowLastSendMode(row))}</span></td>
                    <td><span className={`tracking-badge ${row.is_freezed ? 'is-warning' : 'is-muted'}`}>{row.is_freezed ? 'Yes' : 'No'}</span></td>
                    <td><span className="tracking-badge tracking-badge-template">{humanizeLabel(row.template_choice)}</span></td>
                    <td>
                      {linkedPreviewResume ? (
                        <div className="tracking-actions-compact">
                          <button
                            type="button"
                            className="secondary tracking-icon-btn"
                            title="Review resume"
                            onClick={() => setPreviewResume(linkedPreviewResume)}
                          >
                            <PreviewIcon />
                          </button>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="tracking-action-cell">
                      <div className="tracking-actions-compact">
                        <button type="button" className="secondary tracking-icon-btn" title="Detail" onClick={() => navigate(`/tracking/${row.id}`)}><DetailIcon /></button>
                        <button type="button" className="secondary tracking-icon-btn" title="Test Mail" onClick={() => navigate(`/tracking/${row.id}/test-mail`)}><MailTestIcon /></button>
                        <button type="button" className="secondary tracking-icon-btn" title="Edit" onClick={() => openEditForm(row)} disabled={row.is_freezed}><EditIcon /></button>
                        <button type="button" className="tracking-remove-inline tracking-icon-btn" title="Delete" onClick={() => removeRow(row.id)}><DeleteIcon /></button>
                      </div>
                    </td>
                  </tr>
                  <tr className="tracking-milestone-row">
                    <td colSpan={13}>
                      <div className="tracking-wave-wrap">
                        <svg className="tracking-wave-svg" viewBox="0 0 1000 44" preserveAspectRatio="none" aria-hidden="true">
                          <path
                            d="M0 22 Q25 4 50 22 T100 22 T150 22 T200 22 T250 22 T300 22 T350 22 T400 22 T450 22 T500 22 T550 22 T600 22 T650 22 T700 22 T750 22 T800 22 T850 22 T900 22 T950 22 T1000 22"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                        </svg>
                        <div className="tracking-wave-points">
                          {Array.from({ length: EMPTY_MILESTONE_DOTS }).map((_, index) => {
                            const milestone = milestones[index]
                            return (
                              <div
                                key={`${row.id}-wave-${index}`}
                                className="tracking-wave-point"
                                style={{ left: `${(index / (EMPTY_MILESTONE_DOTS - 1)) * 100}%` }}
                                title={milestone ? `${milestone.type} | ${milestone.mode} | ${milestone.at}` : `Step ${index + 1}`}
                              >
                                <span className={`tracking-wave-circle ${milestone ? 'is-on' : ''}`} />
                                <span className="tracking-wave-label">{formatMilestoneLabel(milestone)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {!loading && !filteredRows.length ? <p className="hint">No rows found.</p> : null}
      <div className="table-pagination">
        <button type="button" className="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</button>
        <span>Page {page} / {Math.max(1, totalPages)} ({totalCount})</span>
        <button type="button" className="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
      </div>

      {createForm ? (
        <div className="modal-overlay">
          <div className="modal-panel tracking-modal-panel">
            <div className="tracking-modal-head">
              <h2>Add Tracking</h2>
              <p className="subtitle">Set the company, contacts, mail flow, and attachments in one pass.</p>
            </div>
            <div className="tracking-form-grid">
            <div className="tracking-form-section-title tracking-form-span-2">Core Details</div>
            <label>
              Company (dropdown)
              <SingleSelectDropdown
                value={createForm.company || ''}
                placeholder="Select company"
                options={companyOptions.map((company) => ({ value: String(company.id), label: String(company.name || '') }))}
                onChange={async (nextValue) => {
                  setCreateForm((prev) => ({ ...prev, company: nextValue, job: '', selected_hr_ids: [], tailored_resume_id: '' }))
                  await hydrateCompanyDependent(nextValue)
                }}
              />
            </label>
            <label>
              Department
              <SingleSelectDropdown
                value={createForm.department || ''}
                placeholder="Select department"
                options={Array.from(new Set(activeEmployeeOptions.map((emp) => String(emp.department || '').trim()).filter(Boolean))).map((dept) => ({ value: dept, label: dept }))}
                onChange={(nextValue) => setCreateForm((prev) => ({ ...prev, department: nextValue, selected_hr_ids: [] }))}
              />
            </label>
            <label>
              Employee (multi-select)
              <MultiSelectDropdown
                values={Array.isArray(createForm.selected_hr_ids) ? createForm.selected_hr_ids : []}
                placeholder="Select employee(s)"
                options={activeEmployeeOptions
                  .filter((emp) => !createForm.department || String(emp.department || '') === String(createForm.department || ''))
                  .map((emp) => ({ value: String(emp.id), label: String(emp.name || '') }))}
                onChange={(nextValues) => setCreateForm((prev) => ({ ...prev, selected_hr_ids: Array.isArray(nextValues) ? nextValues : [] }))}
              />
            </label>
            <div className="tracking-form-section-title tracking-form-span-2">Job & Mail Setup</div>
            <label>
              Job (dropdown)
              <SingleSelectDropdown
                value={createForm.job || ''}
                placeholder="Select job"
                options={jobOptions.map((job) => ({ value: String(job.id), label: `${job.job_id || ''} - ${job.role || ''}` }))}
                onChange={(nextValue) => setCreateForm((prev) => ({ ...prev, job: nextValue, tailored_resume_id: '' }))}
              />
            </label>
            <label>
              Mail Type
              <SingleSelectDropdown
                value={createForm.mail_type || 'fresh'}
                placeholder="Select mail type"
                options={createMailTypeOptions}
                onChange={(nextValue) => setCreateForm((prev) => ({ ...prev, mail_type: nextValue || 'fresh' }))}
              />
            </label>
            <label>
              Send
              <SingleSelectDropdown
                value={createForm.send_mode || 'sent'}
                placeholder="Select send mode"
                options={SEND_MODE_OPTIONS}
                onChange={(nextValue) => setCreateForm((prev) => ({
                  ...prev,
                  send_mode: nextValue || 'sent',
                  schedule_time: (nextValue || 'sent') === 'scheduled' ? (prev.schedule_time || nowDateTimeLocalValue()) : '',
                }))}
              />
            </label>
            {createForm.send_mode === 'scheduled' ? (
              <label>
                Date & Time
                <input
                  type="datetime-local"
                  value={createForm.schedule_time || ''}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, schedule_time: event.target.value }))}
                />
              </label>
            ) : null}
            <label>
              Template
              <SingleSelectDropdown
                value={createForm.template_choice || ''}
                placeholder="Select template"
                options={createTemplateOptions}
                onChange={(nextValue) => setCreateForm((prev) => ({
                  ...prev,
                  template_choice: nextValue || '',
                  compose_mode: resolveComposeModeForTemplate(nextValue || '', prev.compose_mode || 'hardcoded'),
                  hardcoded_follow_up: resolveComposeModeForTemplate(nextValue || '', prev.compose_mode || 'hardcoded') !== 'complete_ai',
                  achievement_ids_ordered: [],
                  template_ids_ordered: [],
                  achievement_id: '',
                  achievement_name: '',
                  achievement_text: '',
                  template_subject: nextValue === 'custom' ? prev.template_subject : '',
                  template_name: nextValue === 'custom' ? prev.template_name : '',
                }))}
              />
            </label>
            {!createTemplateOptions.length ? (
              <p className="hint tracking-form-span-2">No template available for selected department/employee.</p>
            ) : null}
            {createForm.template_choice ? (
              <label className="tracking-form-span-2">
                Mail Compose Mode
                <SingleSelectDropdown
                  value={resolveComposeModeForTemplate(createForm.template_choice, createForm.compose_mode || 'hardcoded')}
                  placeholder="Select compose mode"
                  options={composerOptionsForTemplate(createForm.template_choice)}
                  disabled={createForm.template_choice === 'custom'}
                  onChange={(nextValue) => setCreateForm((prev) => ({
                    ...prev,
                    compose_mode: resolveComposeModeForTemplate(prev.template_choice, nextValue || 'hardcoded'),
                    hardcoded_follow_up: resolveComposeModeForTemplate(prev.template_choice, nextValue || 'hardcoded') !== 'complete_ai',
                    achievement_ids_ordered: [],
                    template_ids_ordered: [],
                    achievement_id: '',
                    achievement_name: '',
                    achievement_text: '',
                  }))}
                />
              </label>
            ) : null}
            {createForm.template_choice ? (
              <div className="tracking-form-span-2">
                <div className="tracking-form-section-title">Templates</div>
                <p className="hint">Choose up to 5 templates in order. Non-follow-up: Opening first, Closing last. Follow-up: one body template plus Closing last.</p>
                <div className="tracking-form-grid">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <label key={`create-template-${index}`}>
                      {`Template ${index + 1}`}
                      <SingleSelectDropdown
                        value={Array.isArray(createForm.achievement_ids_ordered) ? (createForm.achievement_ids_ordered[index] || '') : ''}
                        placeholder="Select template"
                        options={hardcodedAchievementOptionsForIndex(
                          createAchievementOptionsForMode,
                          createForm.achievement_ids_ordered,
                          index,
                        ).map((item) => ({
                          value: String(item.id),
                          label: `${String(item.name || 'Template')} | ${String(item.category || 'general')}`,
                        }))}
                        disabled={hardcodedAchievementSlotDisabled(createForm.achievement_ids_ordered, index)}
                        onChange={(nextValue) => {
                          setCreateForm((prev) => {
                            const nextIds = updateHardcodedAchievementIds(prev.achievement_ids_ordered, index, nextValue)
                            return syncLegacyAchievementFields({
                              ...prev,
                              achievement_ids_ordered: nextIds,
                              template_ids_ordered: nextIds,
                            }, createAchievementOptionsForMode)
                          })
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {createForm.template_choice === 'custom' ? (
              <>
                <label className="tracking-form-span-2">
                  Subject line
                  <textarea
                    value={createForm.template_subject || ''}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, template_subject: event.target.value }))}
                    placeholder="Paste custom subject line"
                    rows={2}
                  />
                </label>
                <label className="tracking-form-span-2">
                  Custom Template
                  <textarea
                    value={createForm.template_name || ''}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, template_name: event.target.value }))}
                    placeholder="Paste custom mail template"
                    rows={8}
                  />
                </label>
              </>
            ) : null}
            <div className="tracking-form-section-title tracking-form-span-2">Attachments & Flags</div>
            <label className="tracking-check-row tracking-form-span-2">
              <input
                type="checkbox"
                checked={Boolean(createForm.has_attachment)}
                onChange={(event) => setCreateForm((prev) => {
                  const checked = event.target.checked
                  if (checked) return { ...prev, has_attachment: true }
                  return {
                    ...prev,
                    has_attachment: false,
                    resume_id: '',
                    tailored_resume_id: '',
                  }
                })}
              />
              {' '}
              Attachment
            </label>
            {createForm.has_attachment ? (
              <>
                <label>
                  Resume
                  <SingleSelectDropdown
                    value={createForm.resume_id || ''}
                    placeholder="Select resume"
                    disabled={Boolean(createForm.tailored_resume_id)}
                    options={orderedResumeOptions.map((resume) => ({ value: String(resume.id), label: String(resume.title || `Resume #${resume.id}`) }))}
                    onChange={(value) => {
                      setCreateForm((prev) => ({
                        ...prev,
                        resume_id: value,
                        tailored_resume_id: value ? '' : prev.tailored_resume_id,
                      }))
                    }}
                  />
                </label>
                {createTailoredOptions.length ? (
                  <label>
                    Tailored Resume
                    <SingleSelectDropdown
                      value={createForm.tailored_resume_id || ''}
                      placeholder="Select tailored resume"
                      disabled={Boolean(createForm.resume_id)}
                      options={createTailoredOptions.map((item) => ({ value: String(item.id), label: String(item.name || `Tailored Resume #${item.id}`) }))}
                      onChange={(value) => {
                        setCreateForm((prev) => ({
                          ...prev,
                          tailored_resume_id: value,
                          resume_id: value ? '' : prev.resume_id,
                        }))
                      }}
                    />
                  </label>
                ) : null}
              </>
            ) : null}
            <label className="tracking-check-row tracking-form-span-2">
              <input
                type="checkbox"
                checked={Boolean(createForm.is_freezed)}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, is_freezed: event.target.checked }))}
              />
              {' '}
              Freeze
            </label>
            </div>
            {createFormError ? <p className="error">{createFormError}</p> : null}
            <div className="actions">
              <button type="button" onClick={createRow}>Create</button>
              <button type="button" className="secondary" onClick={() => { setCreateForm(null); setCreateFormError('') }}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {editForm ? (
        <div className="modal-overlay">
          <div className="modal-panel tracking-modal-panel">
            <div className="tracking-modal-head">
              <h2>Edit Tracking Row</h2>
              <p className="subtitle">Update linked contacts, sending setup, templates, and freeze state.</p>
            </div>
            <div className="tracking-form-grid">
            <div className="tracking-form-section-title tracking-form-span-2">Core Details</div>
            <label>
              Company (dropdown)
              <SingleSelectDropdown
                value={editForm.company || ''}
                placeholder="Select company"
                options={companyOptions.map((company) => ({ value: String(company.id), label: String(company.name || '') }))}
                onChange={async (value) => {
                  setEditForm((prev) => ({ ...prev, company: value, job: '', selected_hr_ids: [] }))
                  await hydrateCompanyDependent(value)
                }}
              />
            </label>
            <label>
              Department
              <SingleSelectDropdown
                value={editForm.department || ''}
                placeholder="Select department"
                options={Array.from(new Set(activeEmployeeOptions.map((emp) => String(emp.department || '').trim()).filter(Boolean))).map((dept) => ({ value: dept, label: dept }))}
                onChange={(value) => setEditForm((prev) => ({ ...prev, department: value, selected_hr_ids: [] }))}
              />
            </label>
            <label>
              Employee (multi-select)
              <MultiSelectDropdown
                values={Array.isArray(editForm.selected_hr_ids) ? editForm.selected_hr_ids : []}
                placeholder="Select employee(s)"
                options={activeEmployeeOptions
                  .filter((emp) => !editForm.department || String(emp.department || '') === String(editForm.department || ''))
                  .map((emp) => ({ value: String(emp.id), label: String(emp.name || '') }))}
                onChange={(nextValues) => {
                  setEditForm((prev) => ({ ...prev, selected_hr_ids: Array.isArray(nextValues) ? nextValues : [] }))
                }}
              />
            </label>
            <div className="tracking-form-section-title tracking-form-span-2">Job & Mail Setup</div>
            <label>
              Job (dropdown)
              <SingleSelectDropdown
                value={editForm.job || ''}
                placeholder="Select job"
                options={jobOptions.map((job) => ({ value: String(job.id), label: `${job.job_id || ''} - ${job.role || ''}` }))}
                onChange={(value) => {
                  setEditForm((prev) => ({
                    ...prev,
                    job: value,
                    tailored_resume_id: '',
                  }))
                }}
              />
            </label>
            <label>
              Mail Type
              <SingleSelectDropdown
                value={editForm.mail_type || 'fresh'}
                placeholder="Select mail type"
                options={editMailTypeOptions}
                onChange={(value) => setEditForm((prev) => ({ ...prev, mail_type: value || 'fresh' }))}
              />
            </label>
            <label>
              Send
              <SingleSelectDropdown
                value={editForm.send_mode || 'sent'}
                placeholder="Select send mode"
                options={SEND_MODE_OPTIONS}
                onChange={(value) => setEditForm((prev) => ({
                  ...prev,
                  send_mode: value || 'sent',
                  schedule_time: (value || 'sent') === 'scheduled' ? (prev.schedule_time || nowDateTimeLocalValue()) : '',
                }))}
              />
            </label>
            {editForm.send_mode === 'scheduled' ? (
              <label>
                Date & Time
                <input
                  type="datetime-local"
                  value={editForm.schedule_time || ''}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, schedule_time: event.target.value }))}
                />
              </label>
            ) : null}
            <label>
              Template
              <SingleSelectDropdown
                value={editForm.template_choice || 'cold_applied'}
                placeholder="Select template"
                options={editTemplateOptions}
                onChange={(value) => setEditForm((prev) => ({
                  ...prev,
                  template_choice: value || 'cold_applied',
                  compose_mode: resolveComposeModeForTemplate(value || '', prev.compose_mode || 'hardcoded'),
                  hardcoded_follow_up: resolveComposeModeForTemplate(value || '', prev.compose_mode || 'hardcoded') !== 'complete_ai',
                  achievement_ids_ordered: [],
                  template_ids_ordered: [],
                  achievement_id: '',
                  achievement_name: '',
                  achievement_text: '',
                  template_subject: value === 'custom' ? prev.template_subject : '',
                  template_name: value === 'custom' ? prev.template_name : '',
                }))}
              />
            </label>
            {!editTemplateOptions.length ? (
              <p className="hint tracking-form-span-2">No template available for selected department/employee.</p>
            ) : null}
            {editForm.template_choice ? (
              <label className="tracking-form-span-2">
                Mail Compose Mode
                <SingleSelectDropdown
                  value={resolveComposeModeForTemplate(editForm.template_choice, editForm.compose_mode || 'hardcoded')}
                  placeholder="Select compose mode"
                  options={composerOptionsForTemplate(editForm.template_choice)}
                  disabled={editForm.template_choice === 'custom'}
                  onChange={(nextValue) => setEditForm((prev) => ({
                    ...prev,
                    compose_mode: resolveComposeModeForTemplate(prev.template_choice, nextValue || 'hardcoded'),
                    hardcoded_follow_up: resolveComposeModeForTemplate(prev.template_choice, nextValue || 'hardcoded') !== 'complete_ai',
                    achievement_ids_ordered: [],
                    template_ids_ordered: [],
                    achievement_id: '',
                    achievement_name: '',
                    achievement_text: '',
                  }))}
                />
              </label>
            ) : null}
            {editForm.template_choice ? (
              <div className="tracking-form-span-2">
                <div className="tracking-form-section-title">Templates</div>
                <p className="hint">Choose up to 5 templates in order. Non-follow-up: Opening first, Closing last. Follow-up: one body template plus Closing last.</p>
                <div className="tracking-form-grid">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <label key={`edit-template-${index}`}>
                      {`Template ${index + 1}`}
                      <SingleSelectDropdown
                        value={Array.isArray(editForm.achievement_ids_ordered) ? (editForm.achievement_ids_ordered[index] || '') : ''}
                        placeholder="Select template"
                        options={hardcodedAchievementOptionsForIndex(
                          editAchievementOptionsForMode,
                          editForm.achievement_ids_ordered,
                          index,
                        ).map((item) => ({
                          value: String(item.id),
                          label: `${String(item.name || 'Template')} | ${String(item.category || 'general')}`,
                        }))}
                        disabled={hardcodedAchievementSlotDisabled(editForm.achievement_ids_ordered, index)}
                        onChange={(nextValue) => {
                          setEditForm((prev) => {
                            const nextIds = updateHardcodedAchievementIds(prev.achievement_ids_ordered, index, nextValue)
                            return syncLegacyAchievementFields({
                              ...prev,
                              achievement_ids_ordered: nextIds,
                              template_ids_ordered: nextIds,
                            }, editAchievementOptionsForMode)
                          })
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {editForm.template_choice === 'custom' ? (
              <>
                <label className="tracking-form-span-2">
                  Subject line
                  <textarea
                    value={editForm.template_subject || ''}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, template_subject: event.target.value }))}
                    placeholder="Paste custom subject line"
                    rows={2}
                  />
                </label>
                <label className="tracking-form-span-2">
                  Custom Template
                  <textarea
                    value={editForm.template_name || ''}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, template_name: event.target.value }))}
                    placeholder="Paste custom mail template"
                    rows={8}
                  />
                </label>
              </>
            ) : null}
            <div className="tracking-form-section-title tracking-form-span-2">Attachments & Flags</div>
            <label className="tracking-check-row tracking-form-span-2">
              <input
                type="checkbox"
                checked={Boolean(editForm.has_attachment)}
                onChange={(event) => setEditForm((prev) => {
                  const checked = event.target.checked
                  if (checked) return { ...prev, has_attachment: true }
                  return {
                    ...prev,
                    has_attachment: false,
                    resume_id: '',
                    tailored_resume_id: '',
                  }
                })}
              />
              {' '}
              Attachment
            </label>
            {editForm.has_attachment ? (
              <>
                <label>
                  Resume
                  <SingleSelectDropdown
                    value={editForm.resume_id || ''}
                    placeholder="Select resume"
                    disabled={Boolean(editForm.tailored_resume_id)}
                    options={orderedResumeOptions.map((resume) => ({ value: String(resume.id), label: String(resume.title || `Resume #${resume.id}`) }))}
                    onChange={(value) => {
                      setEditForm((prev) => ({
                        ...prev,
                        resume_id: value,
                        tailored_resume_id: value ? '' : prev.tailored_resume_id,
                      }))
                    }}
                  />
                </label>
                {editTailoredOptions.length ? (
                  <label>
                    Tailored Resume
                    <SingleSelectDropdown
                      value={editForm.tailored_resume_id || ''}
                      placeholder="Select tailored resume"
                      disabled={Boolean(editForm.resume_id)}
                      options={editTailoredOptions.map((item) => ({ value: String(item.id), label: String(item.name || `Tailored Resume #${item.id}`) }))}
                      onChange={(value) => {
                        setEditForm((prev) => ({
                          ...prev,
                          tailored_resume_id: value,
                          resume_id: value ? '' : prev.resume_id,
                        }))
                      }}
                    />
                  </label>
                ) : null}
              </>
            ) : null}
            <label className="tracking-check-row tracking-form-span-2">
              <input
                type="checkbox"
                checked={Boolean(editForm.is_freezed)}
                onChange={(event) => setEditForm((prev) => ({ ...prev, is_freezed: event.target.checked }))}
              />
              {' '}
              Freeze
            </label>
            </div>
            {editFormError ? <p className="error">{editFormError}</p> : null}
            <div className="actions">
              <button type="button" onClick={saveEditForm}>Save</button>
              <button type="button" className="secondary" onClick={() => { setEditForm(null); setEditFormError('') }}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {previewResume ? (
        <div className="modal-overlay" onClick={() => setPreviewResume(null)}>
          <div className="modal-panel" style={{ width: 'min(920px, 96vw)' }} onClick={(event) => event.stopPropagation()}>
            <h2>Resume Preview</h2>
            <p className="subtitle">{previewResume.title || 'Resume'}</p>
            {previewResume.builder_data && Object.keys(previewResume.builder_data).length ? (
              <section className="preview-only" style={{ maxHeight: '80vh', overflow: 'auto' }}>
                <ResumeSheet form={previewResume.builder_data} />
              </section>
            ) : (
              <p className="hint">No builder data available for preview.</p>
            )}
            <div className="actions">
              <button type="button" className="secondary" onClick={() => setPreviewResume(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default TrackingPage
