import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://10.10.4.178:8000', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM5ODk0MjMsImV4cCI6MTkzMTY2OTQyM30.mjeZP8eVX1rd-cV7s1Ox5Gtjcfc0pBW9ItmUqOIZ5WA'
);

async function recreate() {
  const email = 'admin.demo@hbl.com';
  console.log(`Creating fresh ${email} via API...`);
  
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
     if (error.message.includes('already been registered')) {
         console.log("Wait, it exists in auth.users! Refreshing profile...");
         const { data: users } = await supabase.auth.admin.listUsers();
         const realUser = users.users.find(u => u.email === email);
         if (realUser) {
             await supabase.from('profiles').upsert({ user_id: realUser.id, email, full_name: "Admin Demo", department: "Management", plant: "1300" });
             await supabase.from('user_roles').upsert({ user_id: realUser.id, role: 'admin' });
             console.log("Profile repaired for existing auth.users record!");
         }
     } else {
         console.error("Failed:", error.message);
     }
  } else {
    console.log("Successfully created fresh!", data.user.id);
    await supabase.from('user_roles').upsert({ user_id: data.user.id, role: 'admin' });
  }
}

recreate();
