# Employee Learning Management Platform

A comprehensive platform for managing the complete employee lifecycle - from recruitment through performance management - designed for Stratefix.

## Features

### 🎯 Core Modules

1. **Pre-Recruitment Assessment**
   - Personality profiling assessments
   - Role-dependent knowledge assessments
   - Interview feedback management
   - Offer management

2. **Induction & Onboarding**
   - Skill positioning assessments (20 questions per skill)
   - Mandatory learning content
   - Role-specific learning paths
   - 1-on-1 session scheduling
   - 45-90 day induction journeys

3. **Learning Management**
   - Course catalog with multiple types
   - Learning paths and assignments
   - Progress tracking
   - Resource repository with access control

4. **Skills Management**
   - Comprehensive skill inventory
   - 20-question assessments per skill
   - Initial, 6-month, and annual assessments
   - Skill-to-role mapping

5. **Performance Management**
   - OKR (Objectives and Key Results) system
   - Quarterly and annual reviews
   - Performance ratings
   - Goal tracking

6. **Master Data Management**
   - Organizations
   - Departments
   - Designations/Roles
   - Employee hierarchy

### 👥 User Roles

- **Admin**: Full platform access
- **HR**: Recruitment and employee management
- **L&D Manager**: Learning and development management
- **Manager**: Team and performance management
- **Employee**: Personal learning and OKRs

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Row Level Security)
- **Icons**: Lucide React
- **Build Tool**: Vite

## Database Schema

The platform uses a comprehensive database with 32+ tables:
- Master data (organizations, departments, designations, employees)
- Recruitment (candidates, assessments, interviews, offers)
- Skills (skills, questions, assessments, results)
- Learning (courses, modules, paths, assignments, progress)
- Induction (templates, journeys, sessions)
- Performance (OKRs, key results, reviews, ratings)
- Repository (resources, access logs)

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**

   The `.env` file should already contain your Supabase credentials:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. **Database is already set up**

   The database schema and seed data have been automatically applied.

4. **Create your first admin user**

   The first user to sign up is automatically assigned the admin role and connected to the Stratefix organization. Simply:
   - Click "Sign Up" on the login screen
   - Enter your full name, email, and password
   - The system automatically makes you an admin

   Subsequent users will be assigned the employee role by default.

5. **Run the development server**
   ```bash
   npm run dev
   ```

## Design System

The application follows Stratefix's professional design aesthetic:
- **Primary Color**: Yellow (#FDB913 / stratefix-yellow)
- **Secondary Color**: Black (#000000 / stratefix-black)
- **Typography**: Clean, modern sans-serif fonts
- **Layout**: Card-based design with ample whitespace
- **Style**: Professional, minimalist approach with strong brand identity

## Builder Interfaces

The platform includes comprehensive builder tools for creating assessments, courses, and skills:

### Assessment Builder
- Create assessment templates (personality, knowledge, aptitude, technical)
- Add multiple-choice questions with 4 options
- Set correct answers and point values
- Manage question order
- Edit and delete questions

### Course Builder
- Create courses with metadata (title, description, category, type)
- Add learning modules with different content types:
  - Video
  - Document
  - Presentation
  - Quiz
  - Assignment
  - External Link
- Reorder modules with up/down arrows
- Set mandatory/optional flags
- Track module duration

### Skill Question Builder
- Create skills with categories
- Add exactly 20 questions per skill (as per requirements)
- Each question has 4 custom options + "Don't Know / Not Sure" (auto-added as option 5)
- Set difficulty levels (easy, medium, hard)
- Define correct answers
- Visual progress indicator showing completion (X/20 questions)

## Module Guide

### For HR Users

1. **Add Candidates**: Navigate to Candidates and add applicants
2. **Assign Assessments**: Create and assign personality and knowledge tests
3. **Record Interviews**: Add feedback from interview panels
4. **Manage Offers**: Extend and track job offers
5. **Transition to Employee**: Move accepted candidates to employee status

### For L&D Managers

1. **Create Skills**: Build skill inventory with categories
2. **Add Courses**: Create learning content (mandatory/optional)
3. **Build Learning Paths**: Structure courses into journeys
4. **Manage Induction**: Set up role-specific induction templates
5. **Upload Resources**: Add documents to the repository

### For Managers

1. **Create OKRs**: Set objectives and key results for team members
2. **Track Progress**: Monitor employee performance
3. **Conduct Reviews**: Complete quarterly and annual evaluations
4. **Schedule 1-on-1s**: Plan sessions with team members

### For Employees

1. **Complete Assessments**: Take skill positioning tests
2. **Follow Learning Paths**: Complete assigned courses
3. **Track Progress**: Monitor learning journey
4. **Manage OKRs**: Update and track personal goals
5. **Access Resources**: View approved documents and materials

## Sample Data

The platform includes seed data:
- 1 Organization (Stratefix)
- 6 Departments
- 8 Designations
- 8 Skills
- 6 Courses
- 3 Assessment Templates
- Role-skill mappings

## Security

- Row Level Security (RLS) enabled on all tables
- Role-based access control
- Organization-based data isolation
- Secure authentication via Supabase Auth

## Future Enhancements

Planned features include:
- Skill assessment question management UI
- Advanced reporting and analytics
- Email notifications
- Calendar integration for 1-on-1s
- Document upload to Supabase Storage
- Mobile responsive improvements
- Automated induction workflows
- Performance review templates

## Support

For issues or questions about the platform, contact your system administrator.

---

Built with ❤️ for Stratefix
