// netlify/functions/get-stats.js
const { createClient } = require('@supabase/supabase-js');

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  'Access-Control-Allow-Origin': '*',
};

exports.handler = async (event, context) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' }),
      };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // metrics tablosundan key ve value'ları çekiyoruz
    const { data, error } = await supabase
      .from('metrics')
      .select('key, value');

    if (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message }),
      };
    }

    // Verileri { key: value } formatına çevir
    const payload = {};
    for (const row of data || []) {
      const n = (row?.value === null || row?.value === undefined) ? 0 : Number(row.value);
      payload[row.key] = Number.isNaN(n) ? 0 : n;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(payload),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
