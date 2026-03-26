import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'http://10.10.4.178:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzM5ODk0MjMsImV4cCI6MTkzMTY2OTQyM30.mjeZP8eVX1rd-cV7s1Ox5Gtjcfc0pBW9ItmUqOIZ5WA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDB() {
  const { data, error } = await supabase.from('plants').select('*');
  if (error) {
    console.error("DB REST API Error:", error.message);
  } else {
    console.log("DB REST API Success! Plants found:", data.length);
  }
}
testDB();
