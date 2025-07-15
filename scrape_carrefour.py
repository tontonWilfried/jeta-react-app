import time
import sqlite3
import sys
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

# --- Config ---
DB_PATH = "carrefour_products.sqlite"
MAX_PAGES = 5
SLEEP_BETWEEN_PAGES = 5

# Configuration des catégories
CATEGORIES = {
    'toys': {
        'name': 'Jeux et Jouets',
        'url': 'https://www.carrefour.fr/r/jeux-jouets?filters%5Bfacet_promotions%5D%5B0%5D=Toutes%20les%20promotions',
        'subcategory': ''  # Carrefour n'a pas de sous-catégories
    },
    'food': {
        'name': 'Boissons & Alimentation',
        'url': 'https://www.carrefour.fr/r/boissons?filters%5Bfacet_promotions%5D%5B0%5D=Toutes%20les%20promotions',
        'subcategory': ''  # Carrefour n'a pas de sous-catégories
    },
    'cuisine': {
        'name': 'Cuisine',
        'url': 'https://www.carrefour.fr/r/cuisine?filters%5Bfacet_promotions%5D%5B0%5D=Toutes%20les%20promotions',
        'subcategory': ''  # Carrefour n'a pas de sous-catégories
    },
    'entretien': {
        'name': 'Entretien Maison',
        'url': 'https://www.carrefour.fr/r/entretien-maison?filters%5Bfacet_promotions%5D%5B0%5D=Toutes%20les%20promotions',
        'subcategory': ''  # Carrefour n'a pas de sous-catégories
    },
    'maison': {
        'name': 'Maison et Décoration',
        'url': 'https://www.carrefour.fr/r/maison-decoration?filters%5Bfacet_promotions%5D%5B0%5D=Toutes+les+promotions&noRedirect=1',
        'subcategory': ''  # Carrefour n'a pas de sous-catégories
    },
    'papeterie': {
        'name': 'Papeterie et Bureau',
        'url': 'https://www.carrefour.fr/r/papeterie?filters%5Bfacet_promotions%5D%5B0%5D=Toutes%20les%20promotions',
        'subcategory': ''  # Carrefour n'a pas de sous-catégories
    },
    'loisirs': {
        'name': 'Jouets, Sports et Loisirs',
        'url': 'https://www.carrefour.fr/r/jouets-sports-loisirs?filters%5Bfacet_promotions%5D%5B0%5D=Toutes%20les%20promotions',
        'subcategory': ''  # Carrefour n'a pas de sous-catégories
    },
    'informatique': {
        'name': 'Informatique et Bureau',
        'url': 'https://www.carrefour.fr/r/informatique-bureau?filters%5Bfacet_promotions%5D%5B0%5D=Toutes%20les%20promotions',
        'subcategory': ''  # Carrefour n'a pas de sous-catégories
    },
    'image_son': {
        'name': 'Image et Son',
        'url': 'https://www.carrefour.fr/r/image-son?filters%5Bfacet_promotions%5D%5B0%5D=Toutes%20les%20promotions',
        'subcategory': ''  # Carrefour n'a pas de sous-catégories
    },
    'smartphones': {
        'name': 'Smartphones et Objets Connectés',
        'url': 'https://www.carrefour.fr/r/smartphones-objets-connectes?filters%5Bfacet_promotions%5D%5B0%5D=Toutes%20les%20promotions',
        'subcategory': ''  # Carrefour n'a pas de sous-catégories
    },
    'bagagerie': {
        'name': 'Bagagerie et Maroquinerie',
        'url': 'https://www.carrefour.fr/r/mode-bagagerie/bagagerie-maroquinerie/bagages?filters%5Bfacet_promotions%5D%5B0%5D=Toutes+les+promotions&noRedirect=1',
        'subcategory': ''  # Carrefour n'a pas de sous-catégories
    },
    'bebe': {
        'name': 'Bébé',
        'url': 'https://www.carrefour.fr/r/bebe?filters%5Bfacet_promotions%5D%5B0%5D=Toutes+les+promotions&filters%5Bproduct.categories.sub_node.name%5D%5B0%5D=Chambre&filters%5Bproduct.categories.sub_node.name%5D%5B1%5D=Eveil&filters%5Bproduct.categories.sub_node.name%5D%5B2%5D=Promenade&filters%5Bproduct.categories.sub_node.name%5D%5B3%5D=V%C3%AAtements&filters%5Bproduct.categories.sub_node.name%5D%5B4%5D=Voyage&noRedirect=1',
        'subcategory': ''  # Carrefour n'a pas de sous-catégories
    }
}

# --- Setup Selenium ---
def setup_driver():
    from selenium.webdriver.chrome.service import Service
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    # Indique explicitement le chemin du binaire Chrome
    options.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    service = Service(executable_path='/usr/local/bin/chromedriver')
    return webdriver.Chrome(service=service, options=options)

# --- Setup SQLite ---
def setup_database():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        promo_price REAL,
        old_price REAL,
        image_url TEXT,
        product_url TEXT,
        reduction_percent INTEGER,
        promo_badge TEXT,
        soldes_badge TEXT,
        category TEXT,
        subcategory TEXT,
        scraped_at TEXT,
        first_scraped_at TEXT
    )
    ''')
    conn.commit()
    return conn, c

# --- Extraction helpers ---
def extract_price(price_element):
    if not price_element:
        return None
    txt = price_element.get_text(strip=True).replace(',', '.').replace('€', '').strip()
    try:
        return float(txt)
    except:
        return None

def extract_product_info(card, category_name, subcategory):
    try:
        # Image
        img = card.select_one('.product-list-card-plp-grid__image-img')
        image_url = img['src'] if img and img.has_attr('src') else None
        # Nom
        title = card.select_one('.product-list-card-plp-grid__title')
        name = title.get_text(strip=True) if title else "Nom inconnu"
        # Description
        packaging = card.select_one('.product-list-card-plp-grid__packaging')
        description = packaging.get_text(strip=True) if packaging else ""
        # Prix promo
        price_main = card.select_one('.product-price__amount--main')
        promo_price = extract_price(price_main)
        # Ancien prix
        price_old = card.select_one('.product-price__amount--old')
        old_price = extract_price(price_old)
        # Badge promo
        promo_badge = card.select_one('.promotion-label-refonte__label')
        promo_badge = promo_badge.get_text(strip=True) if promo_badge else None
        # Badge soldes
        soldes_badge = card.select_one('.ds-badge--highlight')
        soldes_badge = soldes_badge.get_text(strip=True) if soldes_badge else None
        # Lien produit
        link = card.select_one('a.product-card-click-wrapper')
        product_url = None
        if link and link.has_attr('href'):
            href = link['href']
            product_url = f"https://www.carrefour.fr{href}" if href.startswith('/') else href
        # Réduction
        reduction_percent = None
        if promo_price and old_price and old_price > promo_price:
            reduction_percent = round(((old_price - promo_price) / old_price) * 100)
        return {
            "name": name,
            "description": description,
            "promo_price": promo_price,
            "old_price": old_price,
            "image_url": image_url,
            "product_url": product_url,
            "reduction_percent": reduction_percent,
            "promo_badge": promo_badge,
            "soldes_badge": soldes_badge,
            "category": category_name,
            "subcategory": subcategory
        }
    except Exception as e:
        print(f"Erreur extraction produit: {e}")
        return None

def insert_product(c, prod):
    # Dédoublonnage sur nom + prix promo + url
    c.execute('''SELECT id, first_scraped_at FROM products WHERE name=? AND promo_price=? AND product_url=?''', (prod['name'], prod['promo_price'], prod['product_url']))
    row = c.fetchone()
    if row:
        # Produit déjà existant, on met juste à jour scraped_at
        c.execute('''UPDATE products SET scraped_at=datetime('now') WHERE id=?''', (row[0],))
        return False
    # Nouveau produit : on insère avec first_scraped_at = now
    c.execute('''INSERT INTO products (name, description, promo_price, old_price, image_url, product_url, reduction_percent, promo_badge, soldes_badge, category, subcategory, scraped_at, first_scraped_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))''',
              (prod['name'], prod['description'], prod['promo_price'], prod['old_price'], prod['image_url'], prod['product_url'], prod['reduction_percent'], prod['promo_badge'], prod['soldes_badge'], prod['category'], prod['subcategory']))
    return True

def scrape_category(category_key, category_config):
    print(f"\n=== Scraping {category_config['name']} ===")
    driver = setup_driver()
    driver.get(category_config['url'])
    time.sleep(3)
    
    conn, c = setup_database()
    total_inserted = 0
    scraped_keys = set()
    
    for page in range(1, MAX_PAGES + 1):
        print(f"\n--- Page {page}/{MAX_PAGES} ---")
        # Attendre chargement produits
        try:
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, ".product-list-card-plp-grid")))
        except:
            print("Aucun produit trouvé sur cette page")
            break
                
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        cards = soup.select('.product-list-card-plp-grid')
        print(f"Produits trouvés: {len(cards)}")
        
        inserted = 0
        for card in cards:
            prod = extract_product_info(card, category_config['name'], category_config['subcategory'])
            if prod:
                key = (prod['name'], prod['promo_price'], prod['product_url'])
                scraped_keys.add(key)
                if insert_product(c, prod):
                    inserted += 1
                    conn.commit()
        
        total_inserted += inserted
        print(f"Produits insérés: {inserted}")
        
        # Pagination : cliquer sur "Produits suivants" si pas dernière page
        if page < MAX_PAGES:
            try:
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
                btn = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[span[contains(text(), 'Produits suivants')]]"))
                )
                print(f"Attente {SLEEP_BETWEEN_PAGES}s avant page suivante...")
                time.sleep(SLEEP_BETWEEN_PAGES)
                driver.execute_script("arguments[0].click();", btn)
                time.sleep(3)
            except Exception as e:
                print(f"Impossible de charger plus de produits: {e}")
                break
    # Suppression des produits disparus (en Python)
    print(f"Nettoyage : suppression des produits absents de la catégorie '{category_config['name']}'...")
    c.execute("SELECT id, name, promo_price, product_url FROM products WHERE category=?", (category_config['name'],))
    all_db = c.fetchall()
    to_delete = [row[0] for row in all_db if (row[1], row[2], row[3]) not in scraped_keys]
    if to_delete:
        c.executemany("DELETE FROM products WHERE id=?", [(i,) for i in to_delete])
        conn.commit()
        print(f"Produits supprimés : {len(to_delete)}")
    else:
        print("Aucun produit à supprimer.")
    driver.quit()
    conn.close()
    print(f"\nScraping {category_config['name']} terminé. Total produits insérés: {total_inserted}")
    return total_inserted

def scrape_carrefour(category=None):
    if category and category not in CATEGORIES:
        print(f"Catégorie '{category}' non trouvée. Catégories disponibles: {list(CATEGORIES.keys())}")
        return
    
    if category:
        # Scraper une seule catégorie
        scrape_category(category, CATEGORIES[category])
    else:
        # Scraper toutes les catégories sauf 'toys' (Jeux et Jouets)
        for cat_key, cat_config in CATEGORIES.items():
            if cat_key != 'toys':  # Éviter de rescraper Jeux et Jouets
                scrape_category(cat_key, cat_config)
                time.sleep(10)  # Pause entre les catégories

if __name__ == "__main__":
    category = sys.argv[1] if len(sys.argv) > 1 else None
    scrape_carrefour(category) 