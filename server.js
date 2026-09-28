require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '7375';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL connection - CranL provides DATABASE_URL
let pool = null;
let useMemory = false;
let memoryProducts = [];

function getPool() {
  if (!process.env.DATABASE_URL) {
    useMemory = true;
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    pool.on('error', (err) => {
      console.error('PG Pool error', err);
      useMemory = true;
    });
  }
  return pool;
}

// Init DB
async function initDB() {
  const p = getPool();
  if (!p) {
    console.log('No DATABASE_URL - using memory mode (for local testing)');
    useMemory = true;
    // seed memory
    const fs = require('fs');
    try {
      const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));
      memoryProducts = seed;
    } catch(e) { memoryProducts = []; }
    return;
  }
  try {
    const client = await p.connect();
    const schema = require('fs').readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    // create only table if not exists (split to avoid duplicate inserts on each restart)
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name_ar VARCHAR(255) NOT NULL,
        brand VARCHAR(255) NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        old_price NUMERIC(10,2),
        category VARCHAR(100) NOT NULL,
        categories TEXT[] DEFAULT ARRAY['فاخر'],
        image_url TEXT,
        image_base64 TEXT,
        top_notes TEXT,
        heart_notes TEXT,
        base_notes TEXT,
        description TEXT,
        is_bestseller BOOLEAN DEFAULT false,
        is_new BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    const count = await client.query('SELECT COUNT(*) FROM products');
    if (parseInt(count.rows[0].count) === 0) {
      console.log('Seeding DB...');
      await client.query(`
        INSERT INTO products (name_ar, brand, price, old_price, category, categories, top_notes, heart_notes, base_notes, description, is_bestseller) VALUES
        ('ألاسكا', 'أوزاريج', 118, 140, 'رجالي', ARRAY['رجالي','شتوي','فاخر'], 'هيل، مندارين، برغموت', 'قرفة، خزامى، فلفل وردي', 'فانيليا، تونكا، جلد، باتشولي', 'عطر شرقي خشبي فاخر', true),
        ('توندرا', 'أوزاريج', 120, 140, 'رجالي', ARRAY['رجالي','صيفي','فاخر'], 'برغموت، تفاح أخضر، نعناع', 'خزامى، قرفة', 'خشب أرز، عنبر، مسك، جلد', 'عطر شرقي خشبي منعش', false),
        ('فيكتوريوسو ليجند', 'الهامبرا', 59, 75, 'رجالي', ARRAY['رجالي','فاخر'], 'جريب فروت، برغموت، تفاح', 'خزامى، قرفة، هيل', 'خشب صندل، عنبر، مسك، جلد', 'عطر خشبي فاخر', true),
        ('نفائس الشغف', 'الرصاصي', 110, 135, 'نسائي', ARRAY['نسائي','فاخر','عربي'], 'زعفران، ورد طائفي، ياسمين', 'عود، عنبر، خشب أرز', 'مسك، فانيليا، جلد', 'عطر شرقي فاخر', false),
        ('بوكيه ريد', 'زيمايا', 60, 90, 'نسائي', ARRAY['نسائي','فاخر'], 'زعفران، ياسمين', 'حلاوة غزل البنات، ورد', 'خشب أرز، عنبر، طحلب', 'بديل Baccarat Rouge 540', true),
        ('برستيج بلاك', 'الماجد للعود', 110, 145, 'للجنسين', ARRAY['للجنسين','فاخر','شتوي'], 'توت أحمر، برغموت', 'وردة، أوريس، ياسمين', 'خشب أرز، جلد، مسك، عنبر', 'عطر شرقي زهري فاخر', false),
        ('فيلوكي', 'ريفز RiiFFS', 110, 150, 'رجالي', ARRAY['رجالي','فاخر'], 'جريب فروت، ليمون إيطالي، برغموت', 'قرفة، كراميل، خزامى', 'خشب صندل، تونكا، المر الدخاني، مسك', 'خشبي حلو منعش', true);
      `);
    }
    client.release();
    console.log('DB ready');
  } catch (err) {
    console.error('DB init error', err.message);
    useMemory = true;
  }
}

// API: list with search filter price sort pagination
app.get('/api/products', async (req, res) => {
  const { search, category, minPrice, maxPrice, sort, page=1, limit=9 } = req.query;
  const p = getPool();
  try {
    if (useMemory || !p) {
      let data = [...memoryProducts];
      if (search) data = data.filter(x => x.name_ar.includes(search) || x.brand.includes(search));
      if (category && category !== 'الكل') data = data.filter(x => (x.categories||[]).includes(category) || x.category===category);
      if (minPrice) data = data.filter(x => parseFloat(x.price) >= parseFloat(minPrice));
      if (maxPrice) data = data.filter(x => parseFloat(x.price) <= parseFloat(maxPrice));
      if (sort === 'price_asc') data.sort((a,b)=>a.price-b.price);
      if (sort === 'price_desc') data.sort((a,b)=>b.price-a.price);
      if (sort === 'newest') data.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      const total = data.length;
      const start = (parseInt(page)-1)*parseInt(limit);
      const paged = data.slice(start, start+parseInt(limit));
      return res.json({ products: paged, total, page: parseInt(page), pages: Math.ceil(total/limit) });
    }
    let where = [];
    let params = [];
    let idx=1;
    if (search) { where.push(`(name_ar ILIKE $${idx} OR brand ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
    if (category && category !== 'الكل') { where.push(`(category = $${idx} OR $${idx} = ANY(categories))`); params.push(category); idx++; }
    if (minPrice) { where.push(`price >= $${idx}`); params.push(minPrice); idx++; }
    if (maxPrice) { where.push(`price <= $${idx}`); params.push(maxPrice); idx++; }
    let whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';
    let order = 'ORDER BY created_at DESC';
    if (sort === 'price_asc') order = 'ORDER BY price ASC';
    if (sort === 'price_desc') order = 'ORDER BY price DESC';
    if (sort === 'name') order = 'ORDER BY name_ar ASC';
    const countRes = await p.query(`SELECT COUNT(*) FROM products ${whereSQL}`, params);
    const total = parseInt(countRes.rows[0].count);
    const limitNum = parseInt(limit);
    const offset = (parseInt(page)-1)*limitNum;
    params.push(limitNum, offset);
    const dataRes = await p.query(`SELECT * FROM products ${whereSQL} ${order} LIMIT $${idx} OFFSET $${idx+1}`, params);
    res.json({ products: dataRes.rows, total, page: parseInt(page), pages: Math.ceil(total/limitNum) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get one
app.get('/api/products/:id', async (req,res)=>{
  const p=getPool();
  try{
    if(useMemory||!p){ const prod=memoryProducts.find(x=>x.id==req.params.id); return res.json(prod||null); }
    const r=await p.query('SELECT * FROM products WHERE id=$1',[req.params.id]);
    res.json(r.rows[0]||null);
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Create
app.post('/api/products', async (req,res)=>{
  const { pin, name_ar, brand, price, old_price, category, categories, image_base64, top_notes, heart_notes, base_notes, description, is_bestseller } = req.body;
  if(pin !== ADMIN_PIN) return res.status(403).json({error:'PIN خاطئ'});
  const p=getPool();
  try{
    if(useMemory||!p){
      const newProd={ id: Date.now(), name_ar, brand, price: parseFloat(price), old_price: old_price?parseFloat(old_price):null, category, categories: categories||[category], image_base64, top_notes, heart_notes, base_notes, description, is_bestseller: !!is_bestseller, created_at: new Date().toISOString() };
      memoryProducts.unshift(newProd);
      return res.json(newProd);
    }
    const r=await p.query(`INSERT INTO products (name_ar, brand, price, old_price, category, categories, image_base64, top_notes, heart_notes, base_notes, description, is_bestseller) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [name_ar, brand, price, old_price||null, category, categories||[category], image_base64, top_notes, heart_notes, base_notes, description, !!is_bestseller]);
    res.json(r.rows[0]);
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Update
app.put('/api/products/:id', async (req,res)=>{
  const { pin, ...fields } = req.body;
  if(pin !== ADMIN_PIN) return res.status(403).json({error:'PIN خاطئ'});
  const p=getPool();
  try{
    if(useMemory||!p){
      const idx=memoryProducts.findIndex(x=>x.id==req.params.id);
      if(idx>=0){ memoryProducts[idx]={...memoryProducts[idx], ...fields, price: fields.price?parseFloat(fields.price):memoryProducts[idx].price}; return res.json(memoryProducts[idx]); }
      return res.status(404).json({error:'not found'});
    }
    const r=await p.query(`UPDATE products SET name_ar=$1, brand=$2, price=$3, old_price=$4, category=$5, categories=$6, image_base64=$7, top_notes=$8, heart_notes=$9, base_notes=$10, description=$11, is_bestseller=$12 WHERE id=$13 RETURNING *`, [fields.name_ar, fields.brand, fields.price, fields.old_price||null, fields.category, fields.categories||[fields.category], fields.image_base64, fields.top_notes, fields.heart_notes, fields.base_notes, fields.description, !!fields.is_bestseller, req.params.id]);
    res.json(r.rows[0]);
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Delete
app.delete('/api/products/:id', async (req,res)=>{
  const { pin } = req.body;
  if(pin !== ADMIN_PIN) return res.status(403).json({error:'PIN خاطئ'});
  const p=getPool();
  try{
    if(useMemory||!p){ memoryProducts=memoryProducts.filter(x=>x.id!=req.params.id); return res.json({ok:true}); }
    await p.query('DELETE FROM products WHERE id=$1',[req.params.id]);
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Health
app.get('/api/health', (req,res)=> res.json({ status:'ok', db: useMemory?'memory':'postgres', brand:'AXELIAPERFUMES' }));

app.get('*', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));

initDB().then(()=> app.listen(PORT, ()=> console.log(`AXELIAPERFUMES running on ${PORT}`)));
