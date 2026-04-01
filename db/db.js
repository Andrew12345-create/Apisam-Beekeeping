const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PehmEZ1o8SCI@ep-quiet-pine-adc2ptmm-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
};