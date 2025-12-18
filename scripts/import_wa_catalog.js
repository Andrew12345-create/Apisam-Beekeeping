const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function scrapeCatalog(url) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (compatible; CatalogScraper/1.0)');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});

  // Save a copy of the HTML for debugging
  const html = await page.content();
  const outDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(path.join(outDir, 'whatsapp_catalog.html'), html, 'utf8');

  // Try to extract product-like blocks using several heuristics
  const items = await page.evaluate(() => {
    const results = [];

    // Candidate selectors commonly used in catalog UIs
    const selectors = [
      '[data-testid^="catalog_item"]',
      '[data-testid^="catalog_item"]',
      '.catalog-item',
      'div[role="listitem"]',
      '.product',
      '.item'
    ];

    let nodes = [];
    for (const s of selectors) {
      const found = Array.from(document.querySelectorAll(s));
      if (found.length) { nodes = found; break; }
    }

    // Fallback: find images that look like products
    if (!nodes.length) {
      const imgs = Array.from(document.querySelectorAll('img')).filter(i => i.src && i.src.length > 20);
      nodes = imgs.slice(0, 20).map(i => i.closest('div') || i.parentElement);
    }

    nodes.forEach(n => {
      try {
        const titleEl = n.querySelector('h1,h2,h3') || n.querySelector('.title') || n.querySelector('img[alt]');
        const title = titleEl ? (titleEl.innerText || titleEl.alt || '').trim() : '';
        const priceEl = n.querySelector('[data-testid*="price"], .price, span[aria-label*="price"], ._2tW5A') || n.querySelector('span');
        const price = priceEl ? (priceEl.innerText || '').trim() : '';
        const descEl = n.querySelector('p') || n.querySelector('.description') || n.querySelector('.desc');
        const description = descEl ? (descEl.innerText || '').trim() : '';
        const img = n.querySelector('img') ? (n.querySelector('img').src || '') : '';

        // Heuristic: require at least a title or an image
        if (title || img) results.push({ title: title || 'Imported item', price: price || '', description: description || '', image: img || '' });
      } catch (e) {}
    });

    // Deduplicate by title
    const uniq = [];
    const seen = new Set();
    for (const it of results) {
      const key = (it.title || it.image).slice(0, 80);
      if (!seen.has(key)) { seen.add(key); uniq.push(it); }
    }
    return uniq.slice(0, 40);
  });

  await browser.close();
  return items;
}

function buildProductHtml(items, startId = 1000) {
  return items.map((it, i) => {
    const id = startId + i;
    const safeTitle = it.title ? it.title.replace(/</g, '&lt;') : 'Imported item';
    const safeDesc = it.description ? it.description.replace(/</g, '&lt;') : '';
    const priceNum = it.price ? it.price.replace(/[^0-9.]/g, '') : '';
    const displayPrice = it.price || (priceNum ? `$${priceNum}` : 'Price on WhatsApp');
    const imgTag = it.image ? `<img src="${it.image}" alt="${safeTitle}" style="max-width:100%;border-radius:8px;margin-bottom:.5rem;">` : '';

    return `
      <div class="product" data-id="${id}" data-name="${safeTitle}" data-price="${priceNum || ''}">
        ${imgTag}
        <h2>${safeTitle}</h2>
        <p>${safeDesc}</p>
        <p class="price">${displayPrice}</p>
        <button class="add-to-cart">Add to Cart</button>
      </div>
    `;
  }).join('\n');
}

async function insertIntoShop(htmlPath, productHtml) {
  const full = fs.readFileSync(htmlPath, 'utf8');
  const startTag = '<div id="wa-catalog" class="products"';
  const idx = full.indexOf(startTag);
  if (idx === -1) {
    console.error('Placeholder `#wa-catalog` not found in', htmlPath);
    return false;
  }

  // find the start of the opening tag end '>' and the closing </div>
  const openStart = full.indexOf('>', idx);
  const closeIdx = full.indexOf('</div>', openStart);
  if (openStart === -1 || closeIdx === -1) {
    console.error('Could not locate exact placeholder boundaries. Aborting.');
    return false;
  }

  const before = full.slice(0, openStart + 1);
  const after = full.slice(closeIdx);

  const newInner = '\n' + productHtml + '\n';
  // ensure the placeholder is shown
  const newBefore = before.replace(/style="[^"]*display:\s*none;?[^"]*"/, match => match.replace(/display:\s*none;?/, 'display: block;'));

  const updated = newBefore + newInner + after;
  fs.writeFileSync(htmlPath, updated, 'utf8');
  return true;
}

async function main() {
  const url = 'https://web.whatsapp.com/catalog/254734463442';
  console.log('Scraping', url);
  const items = await scrapeCatalog(url);
  console.log('Found', items.length, 'items');
  if (!items.length) {
    console.error('No items extracted; see tmp/whatsapp_catalog.html for debugging.');
    process.exit(1);
  }

  const productHtml = buildProductHtml(items, 900);
  const shopPath = path.join(__dirname, '..', 'shop.html');
  const ok = await insertIntoShop(shopPath, productHtml);
  if (ok) console.log('shop.html updated with imported items.');
  else console.error('Failed to update shop.html');
}

main().catch(err => { console.error('Import failed:', err); process.exit(1); });
