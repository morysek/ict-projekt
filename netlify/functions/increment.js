const { createClient } = require('@supabase/supabase-js');


// these environment variables will be set in Netlify's Site settings
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;


const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);


exports.handler = async function (event, context) {
// allow only POST (optional)
if (event.httpMethod !== 'POST') {
return {
statusCode: 405,
headers: { 'Allow': 'POST' },
body: 'Method Not Allowed'
};
}


try {
const { data, error } = await supabase.rpc('increment_clicks');
if (error) throw error;


// 'data' will be the new total (bigint)
return {
statusCode: 200,
headers: {
'Content-Type': 'application/json',
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
},
body: JSON.stringify({ total: data })
};
} catch (err) {
console.error(err);
return {
statusCode: 500,
body: JSON.stringify({ error: err.message || String(err) })
};
}
};
