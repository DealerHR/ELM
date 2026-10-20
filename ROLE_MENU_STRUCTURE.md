# Role-Based Menu Structure

This document outlines the menu visibility and access control for different user roles in the Employee Learning Management (ELM) Platform.

## User Roles Overview

The system supports 6 distinct user roles, each with specific access levels and responsibilities:

### 1. Platform Admin (`platform_admin`)
**Purpose:** Manages the entire platform across all organizations

**Menu Access:**
- Dashboard
- **Platform Admin Section:**
  - Organizations (create, view, edit all organizations)

**Key Characteristics:**
- Can view and manage all organizations
- Does NOT see organizational-specific functions
- Primary role: Platform oversight and organization management
- Example user: `info@learntechconsulting.in`

**RLS Permissions:**
- Full access to organizations table
- Can view all user profiles across organizations
- Cross-organization visibility

---

### 2. Organizational Admin (`admin`)
**Purpose:** Manages all aspects of their specific organization

**Menu Access:**
- Dashboard
- **Master Data:**
  - Departments
  - Designations
  - Employees
- **Recruitment:**
  - Candidates
  - Assessment Builder
- **Learning & Development:**
  - Skill Builder
  - My Skills
  - Course Builder
  - Courses
  - Induction
  - My Learning
- **Performance:**
  - OKRs
  - Reviews
- **Resources:**
  - Repository
- **Administration:**
  - User Management
  - Settings

**Key Characteristics:**
- Full control within their organization
- Cannot see other organizations
- Can manage users, departments, and all organizational functions
- Demo user: `demo_admin@stratefix.com` / `Demo@123`

**RLS Permissions:**
- Scoped to their organization only
- Can manage all data within organization
- Can create/manage users in their organization

---

### 3. HR Manager (`hr`)
**Purpose:** Manages recruitment, employees, and organizational structure

**Menu Access:**
- Dashboard
- **Master Data:**
  - Departments
  - Designations
  - Employees
- **Recruitment:**
  - Candidates
  - Assessment Builder
- **Learning & Development:**
  - My Skills
  - Courses
  - Induction
  - My Learning
- **Performance:**
  - OKRs
  - Reviews
- **Resources:**
  - Repository
- **Administration:**
  - Settings

**Key Characteristics:**
- Focuses on recruitment and people management
- Can manage employees, departments, and candidates
- Has visibility into learning and performance modules
- Demo user: `demo_hr@stratefix.com` / `Demo@123`

**RLS Permissions:**
- View/manage employees in organization
- Full access to recruitment data
- View learning and performance data

---

### 4. Learning & Development Manager (`l_d_manager`)
**Purpose:** Manages skills, courses, and learning programs

**Menu Access:**
- Dashboard
- **Recruitment:**
  - Assessment Builder
- **Learning & Development:**
  - Skill Builder
  - My Skills
  - Course Builder
  - Courses
  - Induction
  - My Learning
- **Performance:**
  - OKRs
- **Resources:**
  - Repository

**Key Characteristics:**
- Creates and manages skills, courses, and learning paths
- Can build assessments for recruitment
- Manages induction programs
- Demo user: `demo_ld@stratefix.com` / `Demo@123`

**RLS Permissions:**
- Create/manage skills and courses
- Assign learning to employees
- View employee learning progress
- Manage resource repository

---

### 5. Manager (`manager`)
**Purpose:** Manages team members and their performance

**Menu Access:**
- Dashboard
- **Master Data:**
  - Employees (view team)
- **Learning & Development:**
  - My Skills
  - Courses
  - Induction
  - My Learning
- **Performance:**
  - OKRs (own and team members)
  - Reviews (own and team members)
- **Resources:**
  - Repository

**Key Characteristics:**
- Views employees in their team
- Manages OKRs and reviews for direct reports
- Accesses learning content
- Demo user: `demo_manager@stratefix.com` / `Demo@123`

**RLS Permissions:**
- View employees in organization
- Manage OKRs for self and direct reports
- Conduct reviews for team members
- Access learning resources

---

### 6. Employee (`employee`)
**Purpose:** Regular employee accessing learning and performance tools

**Menu Access:**
- Dashboard
- **Learning & Development:**
  - My Skills
  - Courses
  - Induction
  - My Learning
- **Performance:**
  - OKRs (own)
  - Reviews (own)
- **Resources:**
  - Repository

**Key Characteristics:**
- Self-service access to learning
- Manages personal OKRs
- Views own performance reviews
- Demo user: `demo_employee@stratefix.com` / `Demo@123`

**RLS Permissions:**
- View own profile and data
- Access assigned learning
- View own OKRs and reviews
- Access shared resources

---

## Demo User Credentials

All demo users are under the **Stratefix** organization:

| Email | Password | Role |
|-------|----------|------|
| `demo_admin@stratefix.com` | `Demo@123` | Organizational Admin |
| `demo_hr@stratefix.com` | `Demo@123` | HR Manager |
| `demo_ld@stratefix.com` | `Demo@123` | L&D Manager |
| `demo_manager@stratefix.com` | `Demo@123` | Manager |
| `demo_employee@stratefix.com` | `Demo@123` | Employee |

**Platform Admin:**
| Email | Password | Role |
|-------|----------|------|
| `info@learntechconsulting.in` | *(existing)* | Platform Admin |

---

## Menu Sections Breakdown

### Dashboard
- **Available to:** All roles
- **Purpose:** Overview and quick access to key metrics

### Platform Admin
- **Organizations:** Only `platform_admin`
- **Purpose:** Create and manage multiple organizations

### Master Data
- **Departments:** `admin`, `hr`
- **Designations:** `admin`, `hr`
- **Employees:** `admin`, `hr`, `manager` (manager sees view-only for team)

### Recruitment
- **Candidates:** `admin`, `hr`
- **Assessment Builder:** `admin`, `hr`, `l_d_manager`

### Learning & Development
- **Skill Builder:** `admin`, `l_d_manager` (create/manage skills)
- **My Skills:** All roles (view own skills assessment)
- **Course Builder:** `admin`, `l_d_manager` (create/manage courses)
- **Courses:** All roles (browse/enroll in courses)
- **Induction:** All roles (view induction programs)
- **My Learning:** All roles (track personal learning progress)

### Performance
- **OKRs:** All roles (own OKRs; managers see team OKRs)
- **Reviews:** All roles except `l_d_manager` (own reviews; managers conduct reviews)

### Resources
- **Repository:** All roles except `platform_admin`

### Administration
- **User Management:** `admin` only
- **Settings:** `admin`, `hr`

---

## Multi-Tenancy

The application is fully multi-tenant:
- Each organization is completely isolated
- Data cannot be accessed across organizations
- RLS policies enforce strict organization boundaries
- Each organization has its own admin(s)
- Platform admin is the only role that can see multiple organizations

---

## Testing the Menu Structure

To verify menu visibility at each role level:

1. Log out of the current session
2. Log in with each demo user
3. Verify that only the appropriate menu items are visible
4. Test that restricted actions are properly blocked
5. Confirm RLS policies prevent cross-organization data access

---

## Implementation Notes

- Menu visibility is controlled in `src/components/layout/Sidebar.tsx`
- Role definitions are in `src/lib/supabase.ts`
- RLS policies are defined in database migrations
- Dashboard view adapts based on user role
- All role checks happen at both UI and database levels for security
