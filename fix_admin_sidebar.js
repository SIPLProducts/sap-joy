import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://10.10.4.178:8000', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM5ODk0MjMsImV4cCI6MTkzMTY2OTQyM30.mjeZP8eVX1rd-cV7s1Ox5Gtjcfc0pBW9ItmUqOIZ5WA'
);

async function checkAdminDemo() {
  const email = 'admin.demo@hbl.com';
  console.log(`Checking user: ${email}...`);

  // 1. Get user ID from Auth
  const { data: authData } = await supabase.auth.admin.listUsers();
  const user = authData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) {
    console.log(`❌ User not found in auth.users list of ${authData.users.length} users.`);
    return;
  }
  console.log(`✅ Found in Auth. ID: ${user.id} (Real Email: ${user.email})`);

  // 2. Check user_roles
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData) {
    console.log("❌ NO ROLE FOUND in public.user_roles table!");
    // Auto-fix if missing
    console.log("Attempting to grant 'admin' role...");
    await supabase.from('user_roles').insert({ user_id: user.id, role: 'admin' });
    console.log("✅ Admin role granted.");
  } else {
    console.log(`✅ User has role: ${roleData.role}`);
  }

  // 3. Check role_permissions for 'admin'
  const { data: perms } = await supabase
    .from('role_permissions')
    .select('screen_key')
    .eq('role', 'admin');

  if (!perms || perms.length === 0) {
    console.log("❌ NO PERMISSIONS found in role_permissions table for 'admin'!");
    console.log("Inserting default permissions for admin...");
    const defaultPerms = [
        'dashboard_kpi', 'mrb_worklist', 'material_booking', 
        'inward_materials', 'mrb_print', 'email_log', 'help_support',
        'analytics_dashboard', 'quality_dashboard', 'purchase_dashboard',
        'engineering_dashboard', 'executive_summary'
    ];
    await supabase.from('role_permissions').insert(
        defaultPerms.map(k => ({ role: 'admin', screen_key: k }))
    );
    console.log("✅ Default admin permissions restored.");
  } else {
    console.log(`✅ Found ${perms.length} screen permissions for Admin.`);
  }
}

checkAdminDemo();
