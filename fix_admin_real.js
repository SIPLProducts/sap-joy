import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://10.10.4.178:8000', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM5ODk0MjMsImV4cCI6MTkzMTY2OTQyM30.mjeZP8eVX1rd-cV7s1Ox5Gtjcfc0pBW9ItmUqOIZ5WA'
);

async function forceRecreateAdmin() {
  const email = 'admin.demo@hbl.com';
  console.log(`Force deleting and recreating ${email} to fix sidebar...`);

  // 1. Force wipe auth user via email search
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const existing = users?.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (existing) {
    console.log(`Deleting existing user ID: ${existing.id}`);
    await supabase.auth.admin.deleteUser(existing.id);
  }

  // 2. Create fresh
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "123456",
    email_confirm: true,
    user_metadata: {
      full_name: "Admin Demo",
      role: "admin",
      department: "Management",
      plant: "1300"
    }
  });

  if (error) {
    console.error("❌ Auth Creation Error:", error.message);
    return;
  }

  const userId = data.user.id;
  console.log(`✅ User Recreated in Auth: ${userId}`);

  // 3. Profiles and Roles
  await supabase.from('profiles').upsert({ user_id: userId, email, full_name: "Admin Demo", department: "Management", plant: "1300" });
  await supabase.from('user_roles').upsert({ user_id: userId, role: 'admin' });
  console.log("✅ Profile and Roles Repaired.");

  // 4. Default Permissions Matrix for ADMIN
  const { data: perms } = await supabase.from('role_permissions').select('*').eq('role', 'admin');
  if (!perms || perms.length === 0) {
    console.log("Restoring Admin Permissions Matrix...");
    const defaultPerms = [
      'dashboard_kpi', 'mrb_worklist', 'material_booking', 
      'inward_materials', 'mrb_print', 'email_log', 'help_support',
      'analytics_dashboard', 'quality_dashboard', 'purchase_dashboard',
      'engineering_dashboard', 'executive_summary'
    ];
    await supabase.from('role_permissions').insert(
      defaultPerms.map(k => ({ role: 'admin', screen_key: k }))
    );
    console.log("✅ Matrix Restored.");
  }
}

forceRecreateAdmin();
