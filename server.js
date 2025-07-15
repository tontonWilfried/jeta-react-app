import express from 'express';
import cors from 'cors';
import sqlite3pkg from 'sqlite3';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const sqlite3 = sqlite3pkg.verbose();
const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// __dirname en ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Init SQLite
const db = new sqlite3.Database(path.join(__dirname, 'scraping.sqlite'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS annonces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site TEXT,
    categorie TEXT,
    mot_cle TEXT,
    titre TEXT,
    prix TEXT,
    lieu TEXT,
    date TEXT,
    url TEXT UNIQUE,
    image TEXT,
    date_scraping DATETIME
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS vues (
    user_id TEXT,
    url TEXT,
    site TEXT,
    categorie TEXT,
    mot_cle TEXT,
    date_vue DATETIME,
    PRIMARY KEY(user_id, url, site, categorie, mot_cle)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS last_scrape (
    user_id TEXT,
    site TEXT,
    categorie TEXT,
    mot_cle TEXT,
    last_time DATETIME,
    PRIMARY KEY(user_id, site, categorie, mot_cle)
  )`);
});

// Helper pour obtenir l'IP
function getUserId(req) {
  return req.body.user_id || req.ip;
}

// Helper pour délai
function canScrape(user_id, site, categorie, mot_cle) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT last_time FROM last_scrape WHERE user_id=? AND site=? AND categorie=? AND mot_cle=?`,
      [user_id, site, categorie, mot_cle],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(true);
        const last = new Date(row.last_time).getTime();
        const now = Date.now();
        if (now - last >= 10000) return resolve(true);
        return resolve(10000 - (now - last));
      }
    );
  });
}

function updateLastScrape(user_id, site, categorie, mot_cle) {
  db.run(
    `INSERT OR REPLACE INTO last_scrape (user_id, site, categorie, mot_cle, last_time) VALUES (?, ?, ?, ?, ?)`,
    [user_id, site, categorie, mot_cle, new Date().toISOString()]
  );
}

// --- Fonction utilitaire pour scrapper une catégorie et retourner les produits à jour ---
function scrapeCategory(category) {
  return new Promise((resolve, reject) => {
    // Catégories autorisées
    const allowed = ['food', 'decorations', 'cuisine', 'menagers', 'papeterie', 'hobby'];
    if (!allowed.includes(category)) {
      return reject(new Error('Catégorie non supportée'));
    }
    // Lancer le script Python
    const py = spawn('./venv/bin/python3', ['-u', 'scrape_action.py', '--category', category]);
    let error = '';
    py.stderr.on('data', data => { error += data.toString(); });
    py.on('close', code => {
      if (code !== 0) return reject(new Error(error || 'Erreur scraping'));
      // Lire les produits de la base SQLite
      const db2 = new sqlite3.Database('action_products.sqlite');
      // On lit tous les produits de la catégorie (après scraping)
      let catName = '';
      switch (category) {
        case 'food': catName = 'Boissons & Alimentation'; break;
        case 'decorations': catName = 'Décorations'; break;
        case 'cuisine': catName = 'Cuisine'; break;
        case 'menagers': catName = 'Articles Ménagers'; break;
        case 'papeterie': catName = 'Papeterie et Bureau'; break;
        case 'hobby': catName = 'Hobby'; break;
        default: catName = '';
      }
      db2.all('SELECT * FROM products WHERE category = ? ORDER BY subcategory, name', [catName], (err, rows) => {
        db2.close();
        if (err) return reject(err);
        resolve(rows);
      });
    });
  });
}

// Route principale
app.post('/scrape', async (req, res) => {
  return res.status(400).json({ success: false, error: 'Aucun site de scraping n\'est supporté.' });
});

// API pour récupérer les produits Action scrappés
app.get('/api/action-products', (req, res) => {
  const db = new sqlite3.Database(path.join(__dirname, 'action_products.sqlite'));
  db.all('SELECT * FROM products ORDER BY scraped_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
  db.close();
});

// API pour récupérer les produits Carrefour scrappés
app.get('/api/carrefour-products', (req, res) => {
  const db = new sqlite3.Database(path.join(__dirname, 'carrefour_products.sqlite'));
  db.all('SELECT * FROM products ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
  db.close();
});

// Endpoint pour rafraîchir une catégorie Action
app.post('/api/refresh-action', async (req, res) => {
  const { category } = req.body;
  let py;
  if (!category) {
    // Scraper toutes les catégories si aucune n'est précisée
    py = spawn('./venv/bin/python3', ['-u', 'scrape_action.py']);
  } else {
    // Catégories autorisées (pour sécurité)
    const allowed = ['food', 'decorations', 'cuisine', 'menagers', 'papeterie', 'hobby'];
    if (!allowed.includes(category)) {
      return res.status(400).json({ success: false, error: 'Catégorie non supportée.' });
    }
    py = spawn('./venv/bin/python3', ['-u', 'scrape_action.py', category]);
  }
  let output = '';
  let error = '';
  py.stdout.on('data', data => { output += data.toString(); });
  py.stderr.on('data', data => { error += data.toString(); });
  py.on('close', code => {
    if (code === 0) {
      res.json({ success: true, message: `Rafraîchissement Action terminé.`, output });
    } else {
      res.status(500).json({ success: false, error: error || 'Erreur lors du scraping.' });
    }
  });
});

// Endpoint pour rafraîchir une catégorie Carrefour
app.post('/api/refresh-carrefour', async (req, res) => {
  const { category } = req.body;
  if (!category) {
    return res.status(400).json({ success: false, error: 'Catégorie manquante.' });
  }
  // Catégories autorisées pour Carrefour
  const allowed = ['toys', 'food', 'cuisine', 'entretien', 'maison', 'papeterie', 'loisirs', 'informatique', 'image_son', 'smartphones', 'bagagerie', 'bebe'];
  if (!allowed.includes(category)) {
    return res.status(400).json({ success: false, error: 'Catégorie non supportée.' });
  }
  // Lancer le script Python
  const py = spawn('./venv/bin/python3', ['-u', 'scrape_carrefour.py', category]);
  let output = '';
  let error = '';
  py.stdout.on('data', data => { output += data.toString(); });
  py.stderr.on('data', data => { error += data.toString(); });
  py.on('close', code => {
    if (code === 0) {
      res.json({ success: true, message: `Rafraîchissement de la catégorie Carrefour '${category}' terminé.`, output });
    } else {
      res.status(500).json({ success: false, error: error || 'Erreur lors du scraping.' });
    }
  });
});

// Endpoint SSE pour la progression du scraping Action
app.get('/api/refresh-action-progress', (req, res) => {
  const category = req.query.category;
  let py;
  if (!category) {
    res.status(400).end('Catégorie manquante');
    return;
  }
  if (category === 'all') {
    py = spawn('./venv/bin/python3', ['-u', 'scrape_action.py']);
  } else {
    const allowed = ['food', 'decorations', 'cuisine', 'menagers', 'papeterie', 'hobby'];
    if (!allowed.includes(category)) {
      res.status(400).end('Catégorie non supportée');
      return;
    }
    py = spawn('./venv/bin/python3', ['-u', 'scrape_action.py', category]);
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  py.stdout.on('data', data => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.startsWith('PROGRESS:')) {
        const progress = line.replace('PROGRESS:', '').trim();
        res.write(`event: progress\ndata: ${progress}\n\n`);
      } else if (line.trim()) {
        res.write(`event: log\ndata: ${line}\n\n`);
      }
    });
  });
  py.stderr.on('data', data => {
    res.write(`event: error\ndata: ${data.toString()}\n\n`);
  });
  py.on('close', code => {
    res.write(`event: done\ndata: ${code}\n\n`);
    res.end();
  });
});

// Endpoint SSE pour la progression du scraping Carrefour
app.get('/api/refresh-carrefour-progress', (req, res) => {
  const category = req.query.category;
  let py;
  if (!category) {
    res.status(400).end('Catégorie manquante');
    return;
  }
  if (category === 'all') {
    py = spawn('./venv/bin/python3', ['-u', 'scrape_carrefour.py']);
  } else {
    const allowed = ['toys', 'food', 'cuisine', 'entretien', 'maison', 'papeterie', 'loisirs', 'informatique', 'image_son', 'smartphones', 'bagagerie', 'bebe'];
    if (!allowed.includes(category)) {
      res.status(400).end('Catégorie non supportée');
      return;
    }
    py = spawn('./venv/bin/python3', ['-u', 'scrape_carrefour.py', category]);
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  py.stdout.on('data', data => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.startsWith('PROGRESS:')) {
        const progress = line.replace('PROGRESS:', '').trim();
        res.write(`event: progress\ndata: ${progress}\n\n`);
      } else if (line.trim()) {
        res.write(`event: log\ndata: ${line}\n\n`);
      }
    });
  });
  py.stderr.on('data', data => {
    res.write(`event: error\ndata: ${data.toString()}\n\n`);
  });
  py.on('close', code => {
    res.write(`event: done\ndata: ${code}\n\n`);
    res.end();
  });
});

// --- AJOUT: Création des tables snapshot au démarrage ---
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS action_products_snapshot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    products_json TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS carrefour_products_snapshot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    products_json TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// --- AJOUT: Endpoint scraping avec alertes Action ---
app.post('/api/scrape-category-with-alerts', async (req, res) => {
  const { category } = req.body;
  if (!category) return res.status(400).json({ error: 'Catégorie requise' });

  // 1. Scrapper la catégorie (réutilise la logique existante)
  let newProducts = [];
  try {
    // Supposons que tu as une fonction scrapeCategory qui retourne un tableau de produits
    newProducts = await scrapeCategory(category); // À adapter selon ta logique
  } catch (e) {
    return res.status(500).json({ error: 'Erreur scraping', details: e.message });
  }

  // 2. Récupérer le snapshot précédent
  db.get('SELECT * FROM action_products_snapshot WHERE category = ? ORDER BY updated_at DESC LIMIT 1', [category], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erreur DB', details: err.message });
    let oldProducts = [];
    if (row && row.products_json) {
      try { oldProducts = JSON.parse(row.products_json); } catch {}
    }

    // 3. Comparaison
    const oldMap = Object.fromEntries(oldProducts.map(p => [p.id || p.name, p]));
    const newMap = Object.fromEntries(newProducts.map(p => [p.id || p.name, p]));
    // Nouveaux produits
    const newItems = newProducts.filter(p => !(p.id || p.name in oldMap));
    // Baisses de prix
    const priceDrops = newProducts.filter(p => {
      const old = oldMap[p.id || p.name];
      return old && p.price < old.price;
    });
    // Autres changements (optionnel)
    // ...

    // 4. Réponse
    if (newItems.length === 0 && priceDrops.length === 0) {
      return res.json({ message: 'Aucun changement détecté', newItems: [], priceDrops: [] });
    }

    // 5. Mettre à jour le snapshot
    db.run(
      'INSERT INTO action_products_snapshot (category, products_json) VALUES (?, ?)',
      [category, JSON.stringify(newProducts)],
      err2 => {
        if (err2) return res.status(500).json({ error: 'Erreur DB (update)', details: err2.message });
        return res.json({
          message: 'Changements détectés',
          newItems,
          priceDrops
        });
      }
    );
  });
});

// --- AJOUT: Endpoint scraping avec alertes Carrefour ---
app.post('/api/scrape-carrefour-with-alerts', async (req, res) => {
  const { category } = req.body;
  if (!category) return res.status(400).json({ error: 'Catégorie requise' });

  // Catégories autorisées pour Carrefour
  const allowed = ['toys', 'food', 'cuisine', 'entretien', 'maison', 'papeterie', 'loisirs', 'informatique', 'image_son', 'smartphones', 'bagagerie', 'bebe'];
  if (!allowed.includes(category)) {
    return res.status(400).json({ error: 'Catégorie non supportée.' });
  }

  // 1. Scrapper la catégorie Carrefour
  let newProducts = [];
  try {
    const py = spawn('./venv/bin/python3', ['-u', 'scrape_carrefour.py', category]);
    await new Promise((resolve, reject) => {
      py.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`Scraping failed with code ${code}`));
      });
    });
    
    // Lire les produits de la base SQLite Carrefour
    const db2 = new sqlite3.Database('carrefour_products.sqlite');
    const catName = getCarrefourCategoryName(category);
    newProducts = await new Promise((resolve, reject) => {
      db2.all('SELECT * FROM products WHERE category = ? ORDER BY id DESC', [catName], (err, rows) => {
        db2.close();
        if (err) reject(err);
        else resolve(rows);
      });
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur scraping', details: e.message });
  }

  // 2. Récupérer le snapshot précédent
  db.get('SELECT * FROM carrefour_products_snapshot WHERE category = ? ORDER BY updated_at DESC LIMIT 1', [category], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erreur DB', details: err.message });
    let oldProducts = [];
    if (row && row.products_json) {
      try { oldProducts = JSON.parse(row.products_json); } catch {}
    }

    // 3. Comparaison
    const oldMap = Object.fromEntries(oldProducts.map(p => [p.id || p.name, p]));
    const newMap = Object.fromEntries(newProducts.map(p => [p.id || p.name, p]));
    // Nouveaux produits
    const newItems = newProducts.filter(p => !(p.id || p.name in oldMap));
    // Baisses de prix
    const priceDrops = newProducts.filter(p => {
      const old = oldMap[p.id || p.name];
      return old && p.promo_price < old.promo_price;
    });

    // 4. Réponse
    if (newItems.length === 0 && priceDrops.length === 0) {
      return res.json({ message: 'Aucun changement détecté', newItems: [], priceDrops: [] });
    }

    // 5. Mettre à jour le snapshot
    db.run(
      'INSERT INTO carrefour_products_snapshot (category, products_json) VALUES (?, ?)',
      [category, JSON.stringify(newProducts)],
      err2 => {
        if (err2) return res.status(500).json({ error: 'Erreur DB (update)', details: err2.message });
        return res.json({
          message: 'Changements détectés',
          newItems,
          priceDrops
        });
      }
    );
  });
});

// Endpoint pour les produits Lidl (TOUS les produits, sans pagination)
app.get('/api/lidl-products', (req, res) => {
    const db = new sqlite3.Database('lidl_products.sqlite');
    db.all(
        `SELECT * FROM products ORDER BY scraped_at DESC`,
        [],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                db.get('SELECT COUNT(*) as count FROM products', (err2, countRow) => {
                    db.close();
                    if (err2) {
                        res.status(500).json({ error: err2.message });
                    } else {
                        res.json({
                            products: rows,
                            total: countRow.count,
                            page: 1,
                            pageSize: rows.length
                        });
                    }
                });
            }
        }
    );
});

// Endpoint SSE pour la progression du scraping Lidl
app.get('/api/refresh-lidl-progress', (req, res) => {
  const category = req.query.category; // Pour compatibilité future
  // Pour l'instant, on ignore category car il n'y a qu'une catégorie
  const py = spawn('./venv/bin/python3', ['-u', 'scrape_lidl.py']);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  py.stdout.on('data', data => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.startsWith('PROGRESS:')) {
        const progress = line.replace('PROGRESS:', '').trim();
        res.write(`event: progress\ndata: ${progress}\n\n`);
      } else if (line.trim()) {
        res.write(`event: log\ndata: ${line}\n\n`);
      }
    });
  });
  py.stderr.on('data', data => {
    res.write(`event: error\ndata: ${data.toString()}\n\n`);
  });
  py.on('close', code => {
    res.write(`event: done\ndata: ${code}\n\n`);
    res.end();
  });
});

// Fonction utilitaire pour convertir la clé de catégorie en nom Carrefour
function getCarrefourCategoryName(category) {
  const categoryMap = {
    'food': 'Boissons & Alimentation',
    'cuisine': 'Cuisine',
    'entretien': 'Entretien Maison',
    'maison': 'Maison et Décoration',
    'papeterie': 'Papeterie et Bureau',
    'loisirs': 'Jouets, Sports et Loisirs',
    'informatique': 'Informatique et Bureau',
    'image_son': 'Image et Son',
    'smartphones': 'Smartphones et Objets Connectés',
    'bagagerie': 'Bagagerie et Maroquinerie',
    'bebe': 'Bébé'
  };
  return categoryMap[category] || category;
}

app.listen(PORT, () => {
  console.log(`Serveur scraping lancé sur http://localhost:${PORT}`);
}); 