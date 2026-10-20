import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const demoUsers = [
  {
    email: 'demo_admin@stratefix.com',
    password: 'Demo@123',
    full_name: 'Demo Admin',
    role: 'admin',
    employee_code: 'EMP-ADM-001'
  },
  {
    email: 'demo_hr@stratefix.com',
    password: 'Demo@123',
    full_name: 'Demo HR Manager',
    role: 'hr',
    employee_code: 'EMP-HR-001'
  },
  {
    email: 'demo_ld@stratefix.com',
    password: 'Demo@123',
    full_name: 'Demo L&D Manager',
    role: 'l_d_manager',
    employee_code: 'EMP-LD-001'
  },
  {
    email: 'demo_manager@stratefix.com',
    password: 'Demo@123',
    full_name: 'Demo Manager',
    role: 'manager',
    employee_code: 'EMP-MGR-001'
  },
  {
    email: 'demo_employee@stratefix.com',
    password: 'Demo@123',
    full_name: 'Demo Employee',
    role: 'employee',
    employee_code: 'EMP-EMP-001'
  }
];

async function createDemoUsers() {
  try {
    // Get Stratefix organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', 'Stratefix')
      .maybeSingle();

    if (orgError) {
      console.error('Error fetching organization:', orgError);
      return;
    }

    let orgId = org?.id;

    if (!orgId) {
      const { data: newOrg, error: createOrgError } = await supabase
        .from('organizations')
        .insert({
          name: 'Stratefix',
          industry: 'Consulting',
          size: 'Medium'
        })
        .select()
        .single();

      if (createOrgError) {
        console.error('Error creating organization:', createOrgError);
        return;
      }

      orgId = newOrg.id;
      console.log('Created Stratefix organization:', orgId);
    }

    // Get or create department
    const { data: dept, error: deptError } = await supabase
      .from('departments')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)
      .maybeSingle();

    let deptId = dept?.id;

    if (!deptId) {
      const { data: newDept, error: createDeptError } = await supabase
        .from('departments')
        .insert({
          organization_id: orgId,
          name: 'General',
          description: 'General department for demo users'
        })
        .select()
        .single();

      if (createDeptError) {
        console.error('Error creating department:', createDeptError);
        return;
      }

      deptId = newDept.id;
      console.log('Created department:', deptId);
    }

    // Get or create designation
    const { data: designation, error: designationError } = await supabase
      .from('designations')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)
      .maybeSingle();

    let designationId = designation?.id;

    if (!designationId) {
      const { data: newDesignation, error: createDesignationError } = await supabase
        .from('designations')
        .insert({
          organization_id: orgId,
          title: 'Staff',
          level: 'L1',
          department_id: deptId
        })
        .select()
        .single();

      if (createDesignationError) {
        console.error('Error creating designation:', createDesignationError);
        return;
      }

      designationId = newDesignation.id;
      console.log('Created designation:', designationId);
    }

    // Create each demo user
    for (const user of demoUsers) {
      console.log(`\nCreating user: ${user.email}`);

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.full_name
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log(`User ${user.email} already exists, updating profile...`);

          // Get existing user
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users.find(u => u.email === user.email);

          if (existingUser) {
            // Update user profile
            const { error: profileError } = await supabase
              .from('user_profiles')
              .upsert({
                id: existingUser.id,
                organization_id: orgId,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                is_active: true
              });

            if (profileError) {
              console.error(`Error updating profile for ${user.email}:`, profileError);
            } else {
              console.log(`Updated profile for ${user.email}`);
            }

            // Update or create employee record
            const { error: empError } = await supabase
              .from('employees')
              .upsert({
                user_id: existingUser.id,
                organization_id: orgId,
                employee_code: user.employee_code,
                department_id: deptId,
                designation_id: designationId,
                date_of_joining: '2024-01-01',
                employment_type: 'full_time',
                status: 'active'
              }, {
                onConflict: 'employee_code'
              });

            if (empError) {
              console.error(`Error updating employee for ${user.email}:`, empError);
            } else {
              console.log(`Updated employee record for ${user.email}`);
            }
          }
        } else {
          console.error(`Error creating auth user ${user.email}:`, authError);
        }
        continue;
      }

      console.log(`Created auth user: ${authData.user.id}`);

      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          organization_id: orgId,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          is_active: true
        });

      if (profileError) {
        console.error(`Error creating profile for ${user.email}:`, profileError);
        continue;
      }

      console.log(`Created user profile for ${user.email}`);

      // Create employee record
      const { error: empError } = await supabase
        .from('employees')
        .insert({
          user_id: authData.user.id,
          organization_id: orgId,
          employee_code: user.employee_code,
          department_id: deptId,
          designation_id: designationId,
          date_of_joining: '2024-01-01',
          employment_type: 'full_time',
          status: 'active'
        });

      if (empError) {
        console.error(`Error creating employee for ${user.email}:`, empError);
        continue;
      }

      console.log(`Created employee record for ${user.email}`);
    }

    console.log('\n✅ Demo users creation completed!');
    console.log('\nYou can now log in with:');
    demoUsers.forEach(user => {
      console.log(`- ${user.email} / Demo@123 (${user.role})`);
    });

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createDemoUsers();
