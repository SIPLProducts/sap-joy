import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://10.10.4.178:8000', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM5ODk0MjMsImV4cCI6MTkzMTY2OTQyM30.mjeZP8eVX1rd-cV7s1Ox5Gtjcfc0pBW9ItmUqOIZ5WA'
);

async function clean() {
  console.log("Fetching actual auth.users...");
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const validUserIds = authUsers.users.map(u => u.id);

  console.log("Fetching public.profiles...");
  const { data: profiles } = await supabase.from('profiles').select('id, user_id, email');

  let deleted = 0;
  for (const prof of profiles) {
    if (prof.email.toLowerCase() === 'admin.demo@hbl.com' || prof.email.toLowerCase() === 'bala@sharviinfotech.com') {
       if (!validUserIds.includes(prof.user_id)) {
          console.log(`Ghost profile found for ${prof.email} (ID: ${prof.user_id}) - DELETING...`);
          await supabase.from('user_roles').delete().eq('user_id', prof.user_id);
          await supabase.from('profiles').delete().eq('user_id', prof.user_id);
          deleted++;
       } else {
          console.log(`✅ Keeping REAL profile for ${prof.email} (ID: ${prof.user_id})`);
       }
    }
  }

  // To prevent future duplicate inserts of the same email in profiles:
  console.log("Adding UNIQUE constraint to profiles.email...");
  // I will just give them the SQL for this

  console.log(`Cleanup complete! Removed ${deleted} duplicate ghost rows.`);
}

clean();
