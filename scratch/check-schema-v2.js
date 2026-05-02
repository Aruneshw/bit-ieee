const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: posts } = await supabase.from('posts').select('*, author:users(name, role)').limit(1);
  console.log('Post data sample:', posts?.[0]);
  
  const { data: societies } = await supabase.from('societies').select('*').limit(5);
  console.log('Societies data:', societies);
}

run();
