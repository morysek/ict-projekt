import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import './styles.css';


// these will be baked at build time by React (set them in Netlify env as REACT_APP_...)
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;


const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


export default function App() {
const [count, setCount] = useState(0);
const [spinning, setSpinning] = useState(false);


useEffect(() => {
// fetch initial value
let mounted = true;
(async () => {
const { data, error } = await supabase.from('clicks').select('total').eq('id', 1).single();
if (error) {
console.error('fetch initial:', error);
return;
}
if (mounted) setCount(Number(data.total ?? 0));
})();


// subscribe to updates on the clicks table
const channel = supabase
.channel('public:clicks')
.on('postgres_changes', { event: '*', schema: 'public', table: 'clicks', filter: 'id=eq.1' }, (payload) => {
// payload.eventType can be INSERT/UPDATE
const newTotal = payload.new?.total ?? payload.record?.total;
if (newTotal !== undefined) setCount(Number(newTotal));
})
.subscribe();


return () => {
mounted = false;
supabase.removeChannel(channel);
};
}, []);


const handleClick = async () => {
setSpinning(true);
try {
const res = await fetch('/.netlify/functions/increment', { method: 'POST' });
if (!res.ok) throw new Error(await res.text());
const body = await res.json();
// the realtime subscription will update the count for all clients — but we'll optimistically set it too
if (body.total !== undefined) setCount(Number(body.total));
} catch (err) {
console.error('increment failed', err);
} finally {
setSpinning(false);
}
};


return (
<div style={{height: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#0f172a,#1e293b)'}}>
<div style={{textAlign: 'center', color: 'white'}}>
<div style={{fontSize: 14, marginBottom: 8, opacity: 0.8}}>Total clicks</div>
<div style={{fontSize: 64, fontWeight: 700, marginBottom: 16}}>{count.toLocaleString()}</div>
<button onClick={handleClick} disabled={spinning} style={{padding: '18px 36px', fontSize: 18, borderRadius: 12, cursor: 'pointer'}}>
{spinning ? 'Clicking…' : 'Click me'}
</button>
</div>
</div>
);
}
