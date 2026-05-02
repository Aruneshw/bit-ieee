const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: posts } = await supabase.from('posts').select('*').limit(1);
  console.log('Posts columns:', posts?.[0] ? Object.keys(posts[0]) : 'no data');
  
  const { data: users } = await supabase.from('users').select('*').limit(1);
  console.log('Users columns:', users?.[0] ? Object.keys(users[0]) : 'no data');

  const { data: societies } = await supabase.from('societies').select('*').limit(5);
  console.log('Societies data:', societies);
}

run();
