import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://10.10.4.178:8000';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM5ODk0MjMsImV4cCI6MTkzMTY2OTQyM30.mjeZP8eVX1rd-cV7s1Ox5Gtjcfc0pBW9ItmUqOIZ5WA';

console.log("Connecting to:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const email = "bala@sharviinfotech.com";
  
  console.log(`🧹 Attempting to delete existing user ${email}...`);
  try {
      const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) throw listErr;
      
      const target = users.users.find(u => u.email === email);
      if (target) {
          console.log(`Found target user ID: ${target.id}. Deleting via Admin API...`);
          await supabase.auth.admin.deleteUser(target.id);
          console.log("Deleted.");
      } else {
          console.log("User not found in API list.");
      }
  } catch(e) { console.error("Error during deletion:", e.message); }

  console.log(`🧼 Cleaning up ghost profiles via Database...`);
  await supabase.from('profiles').delete().eq('email', email);

  console.log(`✨ Creating pure ${email} with password '123456'...`);
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "123456",
    email_confirm: true,
    user_metadata: {
      full_name: "Bala System Admin",
      role: "admin",
      plant: "1300"
    }
  });

  if (error) {
    console.error("❌ Error creating via GoTrue API:", error);
  } else {
    console.log(`✅ SUCCESS! ${email} PERFECTLY created via official API! User ID:`, data.user.id);
    
    // Assign role
    console.log(`Assigning Admin role...`);
    const { error: roleErr } = await supabase.from('user_roles').insert({
        user_id: data.user.id,
        role: 'admin'
    });
    
    if (roleErr) {
        console.error("Role assignment error:", roleErr);
    } else {
        console.log("Role correctly assigned!");
    }
  }
}

main();
