/*
  # Seed Initial Data for Testing

  ## Description
  This migration populates the database with initial test data for development and testing:
  - Sample organization (Stratefix)
  - Departments (HR, Engineering, Sales, Marketing, Operations)
  - Designations (various roles)
  - Skills (technical and soft skills)
  - Sample courses

  ## Notes
  - User profiles and employees must be created through the application after signup
  - This data is for testing purposes only
*/

-- Insert sample organization
INSERT INTO organizations (id, name, website, industry, size)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Stratefix', 'https://stratefix.com', 'Consulting', '51-200')
ON CONFLICT (id) DO NOTHING;

-- Insert departments
INSERT INTO departments (id, organization_id, name, description)
VALUES 
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'Human Resources', 'Manages recruitment, employee relations, and organizational development'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'Engineering', 'Product development and technical operations'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', 'Sales', 'Business development and client acquisition'),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', 'Marketing', 'Brand management and market strategy'),
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000001', 'Operations', 'Business operations and process management'),
  ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0000-000000000001', 'Consulting', 'Client consulting and advisory services')
ON CONFLICT (id) DO NOTHING;

-- Insert designations
INSERT INTO designations (id, organization_id, title, level, department_id)
VALUES 
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000001', 'Junior Consultant', 'Entry', '00000000-0000-0000-0001-000000000006'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0000-000000000001', 'Consultant', 'Mid', '00000000-0000-0000-0001-000000000006'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0000-000000000001', 'Senior Consultant', 'Senior', '00000000-0000-0000-0001-000000000006'),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0000-000000000001', 'HR Manager', 'Manager', '00000000-0000-0000-0001-000000000001'),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0000-000000000001', 'Software Engineer', 'Mid', '00000000-0000-0000-0001-000000000002'),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0000-000000000001', 'Senior Software Engineer', 'Senior', '00000000-0000-0000-0001-000000000002'),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0000-000000000001', 'Sales Executive', 'Entry', '00000000-0000-0000-0001-000000000003'),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0000-000000000001', 'Marketing Manager', 'Manager', '00000000-0000-0000-0001-000000000004')
ON CONFLICT (id) DO NOTHING;

-- Insert skills
INSERT INTO skills (id, organization_id, name, description, category)
VALUES 
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000001', 'Excel', 'Microsoft Excel proficiency for data analysis', 'Technical'),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0000-000000000001', 'Consulting Skills', 'Client engagement and problem-solving abilities', 'Soft Skills'),
  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0000-000000000001', 'AI in Work', 'Using AI tools to enhance productivity', 'Technical'),
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0000-000000000001', 'Communication', 'Effective written and verbal communication', 'Soft Skills'),
  ('00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0000-000000000001', 'Project Management', 'Planning and executing projects effectively', 'Professional'),
  ('00000000-0000-0000-0003-000000000006', '00000000-0000-0000-0000-000000000001', 'Data Analysis', 'Analyzing and interpreting complex data sets', 'Technical'),
  ('00000000-0000-0000-0003-000000000007', '00000000-0000-0000-0000-000000000001', 'Leadership', 'Team leadership and people management', 'Soft Skills'),
  ('00000000-0000-0000-0003-000000000008', '00000000-0000-0000-0000-000000000001', 'Python Programming', 'Python development and scripting', 'Technical')
ON CONFLICT (id) DO NOTHING;

-- Insert sample courses
INSERT INTO learning_courses (id, organization_id, title, description, category, type, duration_hours)
VALUES 
  ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0000-000000000001', 
   'Company Orientation', 
   'Introduction to company culture, values, and work practices', 
   'Onboarding', 'mandatory_company', 2),
  ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0000-000000000001', 
   'Excel Fundamentals', 
   'Master the basics of Microsoft Excel for business analysis', 
   'Technical Skills', 'mandatory_skill', 8),
  ('00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0000-000000000001', 
   'Effective Consulting', 
   'Learn proven consulting frameworks and methodologies', 
   'Professional Development', 'role_specific', 12),
  ('00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0000-000000000001', 
   'AI-Powered Productivity', 
   'Leverage AI tools to enhance your work efficiency', 
   'Technology', 'mandatory_skill', 4),
  ('00000000-0000-0000-0004-000000000005', '00000000-0000-0000-0000-000000000001', 
   'Business Communication', 
   'Master professional communication skills', 
   'Soft Skills', 'mandatory_company', 6),
  ('00000000-0000-0000-0004-000000000006', '00000000-0000-0000-0000-000000000001', 
   'Advanced Data Analysis', 
   'Deep dive into data analysis techniques and tools', 
   'Technical Skills', 'optional', 16)
ON CONFLICT (id) DO NOTHING;

-- Insert sample assessment templates
INSERT INTO assessment_templates (id, organization_id, title, description, type, duration_minutes, passing_score, is_library_template)
VALUES 
  ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0000-000000000001', 
   'Personality Assessment', 
   'Comprehensive personality profiling assessment', 
   'personality', 30, 0, true),
  ('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0000-000000000001', 
   'Consulting Aptitude Test', 
   'Evaluate consulting and problem-solving skills', 
   'aptitude', 45, 70, false),
  ('00000000-0000-0000-0005-000000000003', '00000000-0000-0000-0000-000000000001', 
   'Technical Skills Assessment', 
   'Basic technical knowledge evaluation', 
   'technical', 60, 60, false)
ON CONFLICT (id) DO NOTHING;

-- Map skills to roles (4-6 skills per role)
INSERT INTO role_skills (designation_id, skill_id, is_mandatory, minimum_score)
VALUES 
  -- Junior Consultant
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0003-000000000001', true, 60),
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0003-000000000002', true, 60),
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0003-000000000004', true, 70),
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0003-000000000003', true, 50),
  -- Consultant
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0003-000000000001', true, 70),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0003-000000000002', true, 75),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0003-000000000004', true, 75),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0003-000000000005', true, 70),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0003-000000000006', true, 65),
  -- Senior Consultant
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0003-000000000002', true, 85),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0003-000000000004', true, 80),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0003-000000000005', true, 85),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0003-000000000006', true, 80),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0003-000000000007', true, 75),
  -- Software Engineer
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0003-000000000008', true, 75),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0003-000000000006', true, 70),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0003-000000000003', true, 65),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0003-000000000005', true, 60)
ON CONFLICT (designation_id, skill_id) DO NOTHING;