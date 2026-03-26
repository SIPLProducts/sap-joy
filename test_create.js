import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://10.10.4.178:8000';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM5ODk0MjMsImV4cCI6MTkzMTY2OTQyM30.mjeZP8eVX1rd-cV7s1Ox5Gtjcfc0pBW9ItmUqOIZ5WA';

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false }});

async function main() {
  console.log("Creating user via direct Admin API");
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'masteradmin@sharviinfotech.com',
    password: "123456",
    email_confirm: true,
    user_metadata: {
      full_name: "Master Admin",
      role: "admin",
      plant: "1300"
    }
  });
  if (error) console.error("Error:", error);
  else console.log("Created successfully! ID:", data.user.id);
}
main();
