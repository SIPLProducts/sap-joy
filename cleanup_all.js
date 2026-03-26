import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://10.10.4.178:8000', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM5ODk0MjMsImV4cCI6MTkzMTY2OTQyM30.mjeZP8eVX1rd-cV7s1Ox5Gtjcfc0pBW9ItmUqOIZ5WA'
);

async function cleanAll() {
  console.log("Fetching actual auth.users...");
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const validUsers = authUsers.users;

  console.log("Fetching ALL public.profiles...");
  const { data: profiles } = await supabase.from('profiles').select('id, user_id, email, created_at');

  let deleted = 0;
  
  // Group by email to find duplicates
  const groupedProfiles = {};
  profiles.forEach(p => {
      const e = p.email.toLowerCase();
      if(!groupedProfiles[e]) groupedProfiles[e] = [];
      groupedProfiles[e].push(p);
  });

  for (const [email, userProfiles] of Object.entries(groupedProfiles)) {
      if (userProfiles.length > 1) {
          console.log(`\nDuplicate found! ${email} has ${userProfiles.length} rows.`);
          
          // Identify the 'real' one if it exists in auth.users
          const realAuthUser = validUsers.find(u => u.email.toLowerCase() === email);
          
          for (const prof of userProfiles) {
              // Rule: If it doesn't match the valid auth user ID, NUKE IT.
              // If there's no auth user at all, only keep the newest one and nuke the rest.
              const isReal = realAuthUser ? prof.user_id === realAuthUser.id : userProfiles.indexOf(prof) === 0;
              
              if (!isReal) {
                  console.log(`DELETING Ghost -> ID: ${prof.user_id} (${prof.created_at})`);
                  await supabase.from('user_roles').delete().eq('user_id', prof.user_id);
                  await supabase.from('profiles').delete().eq('user_id', prof.user_id);
                  deleted++;
              } else {
                  console.log(`✅ KEEPING Real -> ID: ${prof.user_id} (${prof.created_at})`);
              }
          }
      }
  }

  console.log(`\nCleanup complete! Removed ${deleted} duplicate ghost rows from ALL emails.`);
}

cleanAll();
