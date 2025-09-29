import React, { useEffect, useState } from 'react';
supabase.removeChannel(channel);

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
