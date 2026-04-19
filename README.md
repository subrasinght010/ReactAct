# ReactAct

ReactAct is a job-application workflow platform. It helps a user organize job search work in one place instead of juggling resumes, companies, jobs, recruiter details, follow-ups, and notes across multiple tools.

## What Problem It Solves

Most job seekers lose time and momentum because their process is scattered:

- resumes are saved in random files
- job descriptions are copied manually
- recruiter and company details are not tracked properly
- follow-ups get missed
- tailored resumes are created inconsistently
- application progress becomes hard to review

ReactAct solves that by centralizing the full workflow:

- build and manage resume data
- tailor resumes to job descriptions
- track jobs, companies, employees, and applications
- keep templates and reusable content organized
- speed up data capture with a browser extension

## Main Features

### Authentication

- user signup
- user login with JWT
- protected app routes

### Resume Management

- create and edit resume/profile data
- parse resume input
- tailor resume content for a job description
- optimize resume quality
- export ATS-friendly PDF
- preview saved resumes

### Job Search Tracking

- manage application tracking records
- test follow-up mail flows
- view tracking schedule data

### Reusable Content

- templates
- subject templates
- achievements
- interview items
- profile panels

### Bulk Operations

- bulk upload jobs
- bulk upload employees

### Chrome Extension

- save jobs from supported pages
- save employee details from supported pages
- connect directly to the backend API
- log in separately with backend username/password

## Setup

Use the root setup script to install dependencies and start the app:

```bash
chmod +x setup.sh
./setup.sh
```

What it does:

- creates a backend virtual environment
- installs backend requirements
- installs frontend dependencies
- runs migrations
- starts backend and frontend servers

If `backend/venv` already exists, the script asks for another name or falls back to a new one automatically.

## Main App Pages

Public pages:

- Login
- Register

Protected pages:

- Home
- Profile
- Templates
- Companies
- Tracking
- Tracking Schedule
- Tracking Detail
- Tracking Test Mail
- Jobs
- Bulk Upload
- Builder
- Preview

## Page-Wise Features

### Login

- sign in with username and password
- redirects back to the last protected page after successful login

### Register

- create a new account
- basic validation for password confirmation and required fields

### Home

- dashboard-style home page
- quick visibility into profile, companies, jobs, tracking rows, and interviews

### Profile

- edit personal profile information
- manage contact details, links, location, and summary
- manage SMTP, IMAP, and AI-related settings
- manage templates, subject templates, interview records, and resume-related supporting data

### Templates

- view saved template library
- filter templates by category
- browse paginated template records

### Companies

- manage company records
- create and edit employee/contact records linked to companies
- search, filter, and sort company and employee data

### Tracking

- create and manage application tracking rows
- connect tracking to companies, jobs, employees, resumes, and templates
- handle fresh mail and follow-up flow configuration
- view list state, filters, ordering, preview, and action controls

### Tracking Schedule

- view current and upcoming scheduled tracking rows
- review what is expected to be sent next

### Tracking Detail

- detailed tracking summary for one row
- employee-wise delivery view
- sent and received mail history
- timeline/action history for the tracking item

### Tracking Test Mail

- generate preview mail content before sending
- review employee-specific mail output
- approve and save final mail test data

### Jobs

- manage job records
- connect jobs to companies
- filter, sort, edit, delete, and preview job-related data

### Bulk Upload

- bulk upload employee data
- bulk upload job data
- submit either JSON input or file-based data
- review success and error summaries after upload

### Builder

- main resume workspace
- build and edit resume content
- import/parse resume input
- attach job description text
- tailor resume using AI modes
- optimize resume quality
- save resume versions
- export ATS PDF

### Preview

- preview a saved resume
- open PDF/export action for the selected resume

## Chrome Extension

The extension helps capture job and employee details faster from hiring pages and LinkedIn.

1. Open `chrome://extensions/`
2. turn on `Developer mode`
3. click `Load unpacked`
4. select the `chrome-extension` folder from this repo
5. open the side panel
6. enter API base, username, and password
7. click `Login`

Main features:

- Job Create: fetch current page details and save job data
- Employee Create: fetch recruiter or employee details and save them

Notes:

- login is separate from web app or admin login
- use your app API base, not the admin URL
