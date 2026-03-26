import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://10.10.4.178:8000', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM5ODk0MjMsImV4cCI6MTkzMTY2OTQyM30.mjeZP8eVX1rd-cV7s1Ox5Gtjcfc0pBW9ItmUqOIZ5WA'
);

async function resetAdminDemo() {
  const email = 'admin.demo@hbl.com';
  console.log(`Resetting ${email} with password Admin@HBL2026...`);

  // 1. Force wipe auth user via email search
  const { data: authData } = await supabase.auth.admin.listUsers();
  const existing = authData.users?.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (existing) {
    console.log(`Deleting existing user ID from Auth: ${existing.id}`);
    await supabase.auth.admin.deleteUser(existing.id);
  }

  // 2. Wipe SQL side
  console.log("Wiping Profiles and User Roles references...");
  await supabase.from('profiles').delete().eq('email', email);
  // Also wipe by ID just in case
  if(existing) {
      await supabase.from('user_roles').delete().eq('user_id', existing.id);
      await supabase.from('profiles').delete().eq('user_id', existing.id);
  }

  // 3. Create fresh with user's desired password
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "Admin@HBL2026",
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
  console.log(`✅ User Created in Auth: ${userId}`);

  // 4. Force Profiles and Roles assignment
  await supabase.from('profiles').insert({ user_id: userId, email, full_name: "Admin Demo", department: "Management", plant: "1300" });
  await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
  console.log("✅ Profile/Role Fixed.");

  // 5. Build Default Permissions Matrix for entire 'admin' role
  console.log("Setting default permissions for 'admin' role matrix...");
  const defaultPerms = [
      'dashboard_kpi', 'mrb_worklist', 'material_booking', 
      'inward_materials', 'mrb_print', 'email_log', 'help_support',
      'analytics_dashboard', 'quality_dashboard', 'purchase_dashboard',
      'engineering_dashboard', 'executive_summary'
  ];
  
  // Wipe current admin matrix first
  await supabase.from('role_permissions').delete().eq('role', 'admin');
  
  // Insert fresh matrix
  const { error: permError } = await supabase.from('role_permissions').insert(
      defaultPerms.map(k => ({ role: 'admin', screen_key: k }))
  );

  if (permError) {
      console.error("Matrix error:", permError.message);
  } else {
      console.log("✅ Admin Matrix successfully repopulated!");
  }
}

resetAdminDemo();
