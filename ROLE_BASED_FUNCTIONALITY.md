# ELM Platform - Role-Based Functionality Guide

## Platform Overview

The ELM Platform is a comprehensive Employee Learning Management system designed to streamline HR, learning & development, performance management, and skill assessments across organizations.

---

## Role Definitions

### 1. Admin
**Description:** Full system access with ability to configure organization-wide settings and manage all aspects of the platform.

**Access Level:** Complete platform access

### 2. HR
**Description:** Human Resources personnel managing recruitment, employees, and organizational structure.

**Access Level:** Master data management, recruitment, employee management

### 3. L&D Manager (Learning & Development Manager)
**Description:** Responsible for creating and managing learning content, skill assessments, and training programs.

**Access Level:** Learning content creation, skill management, assessment building

### 4. Manager
**Description:** People managers responsible for team performance, OKRs, and employee development.

**Access Level:** Team OKRs, performance reviews, employee dashboards

### 5. Employee
**Description:** Regular employees accessing their learning paths, skills, and performance goals.

**Access Level:** Personal dashboard, learning, skills, and OKRs

---

## Detailed Role-Based Functionality

### ADMIN ROLE

#### Master Data Management
- **Organizations**
  - Create and manage organizations
  - Update organization details (name, website, industry, size)
  - View all organizations

- **Departments**
  - Create and manage departments
  - Assign department heads
  - Configure department hierarchy

- **Designations**
  - Create and manage job titles/positions
  - Define designation levels
  - Link designations to departments

- **Employees**
  - Add new employees
  - Assign departments and designations
  - Set reporting managers
  - Manage employee status (active, on leave, notice period, etc.)

#### Recruitment Management
- **Candidates**
  - View all candidates
  - Track candidate pipeline
  - Update candidate status

- **Assessment Builder**
  - Create assessment templates
  - Build question banks
  - Configure assessment settings

#### Learning & Development
- **Skill Builder**
  - Create and manage skills
  - Categorize skills
  - Define skill assessments

- **Course Builder**
  - Create learning courses
  - Build course modules
  - Define course types (mandatory, optional, role-specific)

- **Courses**
  - View all courses
  - Manage course content
  - Track course completion

- **Induction**
  - Create induction templates
  - Assign learning paths
  - Track induction progress

#### Performance Management
- **OKRs**
  - View company, team, and individual OKRs
  - Create and manage objectives
  - Track key results

- **Reviews**
  - Conduct performance reviews
  - View all employee reviews
  - Manage review cycles

#### Resources
- **Repository**
  - Upload resources
  - Manage access permissions
  - Organize by categories

#### Settings
- **Platform Configuration**
  - System settings
  - User permissions
  - Integration settings

---

### HR ROLE

#### Master Data Management
- **Departments**
  - Create and manage departments
  - View department structure

- **Designations**
  - Create and manage job titles
  - Link to departments

- **Employees**
  - Add and manage employees
  - Update employee records
  - Manage employee status

#### Recruitment
- **Candidates**
  - Add new candidates
  - Track recruitment pipeline
  - Update candidate status
  - Schedule interviews

- **Assessment Builder**
  - Create assessment templates
  - Build question banks
  - Assign assessments to candidates

#### Learning
- Access to all learning dashboards for reporting

---

### L&D MANAGER ROLE

#### Learning & Development
- **Skill Builder**
  - Create skills
  - Build skill question banks
  - Define skill categories
  - Set minimum passing scores

- **Course Builder**
  - Design learning courses
  - Create course modules
  - Upload learning materials
  - Set course prerequisites

- **Courses**
  - Manage learning content
  - Track course enrollments
  - Monitor completion rates

- **Induction**
  - Build induction templates
  - Design onboarding journeys
  - Track new hire progress

#### Resources
- **Repository**
  - Upload learning resources
  - Categorize materials
  - Set access permissions

#### Assessments
- **Assessment Builder**
  - Create skill assessments
  - Build question banks
  - Configure assessment rules

---

### MANAGER ROLE

#### Dashboard
- Team overview
- Team performance metrics
- Upcoming reviews and OKRs

#### Employee Management
- **Employees**
  - View team members
  - Access team profiles
  - View team skills and development plans

#### Performance Management
- **OKRs**
  - Create team OKRs
  - Align team goals with company objectives
  - Track team progress
  - Update key results

- **Reviews**
  - Conduct employee reviews
  - Submit performance feedback
  - Track review cycles

#### Learning
- View team learning progress
- Track team skill development

---

### EMPLOYEE ROLE

#### Dashboard
- Personal performance overview
- Learning progress
- Upcoming deadlines
- Recent activities

#### Learning & Development
- **My Skills**
  - View assigned skills
  - Take skill assessments
  - Track skill scores

- **Courses**
  - Browse available courses
  - Enroll in courses
  - Complete learning modules
  - Track progress

- **Induction** (for new employees)
  - Follow onboarding journey
  - Complete induction tasks
  - Track progress

- **My Learning**
  - View assigned courses
  - Track learning progress
  - Access learning materials

#### Performance
- **OKRs**
  - View personal OKRs
  - Update key results
  - Track progress
  - Align with team objectives

- **Reviews**
  - Access performance reviews
  - Acknowledge review feedback
  - View historical reviews

#### Resources
- **Repository**
  - Access learning materials
  - Download resources
  - View relevant documents

---

## Feature Matrix

| Feature | Admin | HR | L&D Manager | Manager | Employee |
|---------|-------|-----|-------------|---------|----------|
| **Master Data** |
| Organizations | Full | - | - | - | - |
| Departments | Full | Full | - | View | - |
| Designations | Full | Full | - | View | - |
| Employees | Full | Full | - | Team View | - |
| **Recruitment** |
| Candidates | View | Full | - | - | - |
| Assessment Builder | Full | Full | Full | - | - |
| **Learning** |
| Skill Builder | Full | - | Full | - | - |
| My Skills | - | - | - | - | Full |
| Course Builder | Full | - | Full | - | - |
| Courses | Full | View | Full | View | Access |
| Induction | Full | View | Full | View | Personal |
| My Learning | - | - | - | - | Full |
| **Performance** |
| OKRs | Full | View | View | Team Manage | Personal |
| Reviews | Full | View | View | Team Manage | Personal |
| **Resources** |
| Repository | Full | View | Full | View | Access |
| **Settings** |
| Platform Config | Full | - | - | - | - |

---

## Workflow Status

### Fully Implemented ✅
✅ Dashboard - Overview with role-based statistics and quick actions
✅ Organizations - Organization management with full CRUD
✅ Departments - Department management and hierarchy
✅ Designations - Job titles and position management
✅ Employees - Full employee lifecycle management with auth integration
✅ Candidates - Candidate tracking with assessment workflow
✅ Skills (Employee View) - Skill inventory and categorization
✅ Courses - Learning course management
✅ Assessments (Builder) - Assessment template creation
✅ OKRs - Objectives and Key Results tracking
✅ Repository - Resource library with access control
✅ Skill Builder - Skill question bank creation
✅ Course Builder - Course module authoring
✅ Induction - Onboarding journey tracking
✅ My Learning - Personal learning dashboard
✅ Reviews - Performance review management
✅ Settings - Platform configuration interface

### Assessment Invitation System ✅
✅ Database schema with token-based access
✅ Public assessment interface (token-based, no login)
✅ Invitation workflow documented
✅ Email integration ready (manual or automated)
✅ Secure RLS policies for anonymous access
✅ 7-day token expiry
✅ Status tracking (assigned → in_progress → completed)

### Database Complete
- All 32 database tables created and configured
- Row Level Security (RLS) enabled on all tables
- Foreign key relationships established
- Complete data model for all features
- Public access policies for candidate assessments

---

## Candidate Assessment Workflow

The platform includes a complete candidate assessment system:

### How Recruiters Send Assessments

1. **Navigate to Candidates** page
2. **Select a candidate** from the list
3. **Click "Send Assessment"** button
4. **Choose an assessment template** from dropdown
5. **System generates** unique invitation link with token
6. **Copy the link** and send via email to candidate

### How Candidates Take Assessments

1. **Candidate receives email** with assessment link
2. **Clicks link** → Opens `/assessment/[unique-token]`
3. **No login required** - token authenticates them
4. **Views assessment details** (title, duration, questions count)
5. **Clicks "Start Assessment"** - status changes to 'in_progress'
6. **Answers questions** - answers saved automatically
7. **Clicks "Submit"** - assessment is scored
8. **Views results** - sees score and completion message

### Security Features

- **Token-based access**: 32-byte random tokens (256-bit security)
- **Time-limited**: Tokens expire after 7 days
- **One-time use**: Cannot retake after completion
- **Anonymous RLS**: Supabase RLS allows public access only with valid, non-expired tokens
- **Auto-scoring**: Correct answers calculated automatically

### Email Integration

Currently, the system generates invitation links. To automate email sending:

**Option 1: Manual** - Copy link and send via your email client
**Option 2: Supabase Edge Function** - Deploy function to send emails automatically
**Option 3: External Service** - Integrate SendGrid, AWS SES, or similar

See `ASSESSMENT_WORKFLOW.md` for detailed integration guides.

## Recommended Next Steps

1. **Email Integration** - Automate assessment invitation emails
2. **Enhanced Analytics** - Add dashboards for assessment performance
3. **Question Randomization** - Shuffle questions for each candidate
4. **Bulk Operations** - Send assessments to multiple candidates at once
5. **Advanced Security** - Add webcam proctoring or browser lockdown
6. **Mobile Optimization** - Enhance mobile assessment experience
7. **Reporting** - Generate PDF reports for assessment results
8. **API Documentation** - Document REST APIs for integrations

---

## Technical Notes

- **Authentication:** Supabase Auth with email/password
- **Database:** PostgreSQL via Supabase
- **RLS:** Enabled on all tables with appropriate policies
- **Frontend:** React + TypeScript + Tailwind CSS
- **State:** React hooks with Supabase real-time subscriptions

---

**Document Version:** 1.0
**Last Updated:** February 17, 2026
**Platform:** ELM Platform by Stratefix
