import time
import sqlite3
import sys
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException

# --- Config ---
DB_PATH = "action_products.sqlite"
MAX_PAGES = 5
SLEEP_BETWEEN_PAGES = 5

# Configuration des catégories Action (URLs de première page seulement)
CATEGORIES = {
    'food': {
        'name': 'Boissons & Alimentation',
        'subcategories': {
            'Biscuits et pâtisseries': 'https://www.action.com/fr-fr/c/boissons--alimentation/biscuits-et-patisseries/',
            'Friandises et bonbons': 'https://www.action.com/fr-fr/c/boissons--alimentation/friandises-et-bonbons/',
            'Chocolat': 'https://www.action.com/fr-fr/c/boissons--alimentation/chocolat/',
            'Chips': 'https://www.action.com/fr-fr/c/boissons--alimentation/chips/',
            'Noix et snacks': 'https://www.action.com/fr-fr/c/boissons--alimentation/noix-et-snacks/',
            'Boissons': 'https://www.action.com/fr-fr/c/boissons--alimentation/boissons/'
        }
    },
    'decorations': {
        'name': 'Décorations',
        'subcategories': {
            'Literie': 'https://www.action.com/fr-fr/c/habitat/literie/',
            'Décoration saisonnière': 'https://www.action.com/fr-fr/c/habitat/decoration-saisonniere/',
            'Plantes et fleurs artificielles': 'https://www.action.com/fr-fr/c/habitat/plantes-et-fleurs-artificielles/',
            'Plaids et couvertures': 'https://www.action.com/fr-fr/c/habitat/plaids-et-couvertures/',
            'Oreillers': 'https://www.action.com/fr-fr/c/habitat/oreillers/',
            'Chandeliers': 'https://www.action.com/fr-fr/c/habitat/chandeliers/',
            'Bougies': 'https://www.action.com/fr-fr/c/habitat/bougies/',
            'Lampes': 'https://www.action.com/fr-fr/c/habitat/lampes/',
            'Décoration fenêtres': 'https://www.action.com/fr-fr/c/habitat/decoration-fenetres/',
            'Cadres photo': 'https://www.action.com/fr-fr/c/habitat/cadres-photo/',
            'Décoration murale': 'https://www.action.com/fr-fr/c/habitat/decoration-murale/',
            'Accessoires pour la maison': 'https://www.action.com/fr-fr/c/habitat/accessoires-pour-la-maison/',
            'Salle de bain': 'https://www.action.com/fr-fr/c/habitat/salle-de-bain/',
            'Pots et vases': 'https://www.action.com/fr-fr/c/habitat/pots-et-vases/'
        }
    },
    'cuisine': {
        'name': 'Cuisine',
        'subcategories': {
            'Appareils de cuisine': 'https://www.action.com/fr-fr/c/cuisine/appareils-de-cuisine/',
            'Plats pour four et moules': 'https://www.action.com/fr-fr/c/cuisine/plats-pour-four-et-moules/',
            'Services': 'https://www.action.com/fr-fr/c/cuisine/services/',
            'Plateaux': 'https://www.action.com/fr-fr/c/cuisine/plateaux/',
            'Verres': 'https://www.action.com/fr-fr/c/cuisine/verres/',
            'Couverts': 'https://www.action.com/fr-fr/c/cuisine/couverts/',
            'Poêles': 'https://www.action.com/fr-fr/c/cuisine/poeles/',
            'Conserver et emporter': 'https://www.action.com/fr-fr/c/cuisine/conserver-et-emporter/',
            'Ustensiles de cuisine': 'https://www.action.com/fr-fr/c/cuisine/ustensiles-de-cuisine/',
            'Textiles de cuisine': 'https://www.action.com/fr-fr/c/cuisine/textiles-de-cuisine/',
            'Nappes': 'https://www.action.com/fr-fr/c/cuisine/nappes/',
            'Sets de table': 'https://www.action.com/fr-fr/c/cuisine/sets-de-table/'
        }
    },
    'menagers': {
        'name': 'Articles Ménagers',
        'subcategories': {
            'Produits de lessive et vaisselle': 'https://www.action.com/fr-fr/c/articles-menagers/produits-de-lessive-et-vaisselle/',
            'Produits d\'entretien': 'https://www.action.com/fr-fr/c/articles-menagers/produits-dentretien/',
            'Articles de nettoyage': 'https://www.action.com/fr-fr/c/articles-menagers/articles-de-nettoyage/',
            'Poubelles': 'https://www.action.com/fr-fr/c/articles-menagers/poubelles/',
            'Boîtes de rangement': 'https://www.action.com/fr-fr/c/articles-menagers/boites-de-rangement/',
            'Aspirateurs et sacs': 'https://www.action.com/fr-fr/c/articles-menagers/aspirateurs-et-sacs/',
            'Papier toilette et essuie-tout': 'https://www.action.com/fr-fr/c/articles-menagers/papier-toilette-et-essuie-tout/',
            'Ventilateurs': 'https://www.action.com/fr-fr/c/articles-menagers/ventilateurs/',
            'Accessoires pour salle de bains et toilettes': 'https://www.action.com/fr-fr/c/articles-menagers/accessoires-pour-salle-de-bains-et-toilettes/',
            'Laver et repasser': 'https://www.action.com/fr-fr/c/articles-menagers/laver-et-repasser/'
        }
    },
    'papeterie': {
        'name': 'Papeterie et Bureau',
        'subcategories': {
            'Calculatrices': 'https://www.action.com/fr-fr/c/papeterie--bureau/calculatrices/',
            'Agendas et calendriers': 'https://www.action.com/fr-fr/c/papeterie--bureau/agendas-et-calendriers/',
            'Cartouches d\'encre': 'https://www.action.com/fr-fr/c/papeterie--bureau/cartouches-dencre/',
            'Chemises': 'https://www.action.com/fr-fr/c/papeterie--bureau/chemises/',
            'Albums de photos': 'https://www.action.com/fr-fr/c/papeterie--bureau/albums-de-photos/',
            'Accessoires de bureau': 'https://www.action.com/fr-fr/c/papeterie--bureau/accessoires-de-bureau/',
            'Cahiers et blocs-notes': 'https://www.action.com/fr-fr/c/papeterie--bureau/cahiers-et-blocs-notes/',
            'Stylos et crayons': 'https://www.action.com/fr-fr/c/papeterie--bureau/stylos-et-crayons/',
            'Trousse et étuis': 'https://www.action.com/fr-fr/c/papeterie--bureau/trousse-et-etuis/',
            'Papeterie': 'https://www.action.com/fr-fr/c/papeterie--bureau/papeterie/',
            'Colle et ruban adhésif': 'https://www.action.com/fr-fr/c/papeterie--bureau/colle-et-ruban-adhesif/',
            'Organisation': 'https://www.action.com/fr-fr/c/papeterie--bureau/organisation/',
            'Pochettes et classeurs': 'https://www.action.com/fr-fr/c/papeterie--bureau/pochettes-et-classeurs/'
        }
    },
    'hobby': {
        'name': 'Hobby',
        'subcategories': {
            'Jeux de société': 'https://www.action.com/fr-fr/c/hobby/jeux-de-societe/',
            'Puzzles': 'https://www.action.com/fr-fr/c/hobby/puzzles/',
            'Jeux de cartes': 'https://www.action.com/fr-fr/c/hobby/jeux-de-cartes/',
            'Jeux d\'extérieur': 'https://www.action.com/fr-fr/c/hobby/jeux-dexterieur/',
            'Jeux de construction': 'https://www.action.com/fr-fr/c/hobby/jeux-de-construction/',
            'Jeux créatifs': 'https://www.action.com/fr-fr/c/hobby/jeux-creatifs/',
            'Modélisme': 'https://www.action.com/fr-fr/c/hobby/modelisme/',
            'Collection': 'https://www.action.com/fr-fr/c/hobby/collection/',
            'Sport et fitness': 'https://www.action.com/fr-fr/c/hobby/sport-et-fitness/',
            'Jardinage': 'https://www.action.com/fr-fr/c/hobby/jardinage/',
            'Bricolage': 'https://www.action.com/fr-fr/c/hobby/bricolage/',
            'Peinture et dessin': 'https://www.action.com/fr-fr/c/hobby/peinture-et-dessin/',
            'Loisirs créatifs': 'https://www.action.com/fr-fr/c/hobby/loisirs-creatifs/',
            'Musique': 'https://www.action.com/fr-fr/c/hobby/musique/'
        }
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
    # Ajout colonne is_new si besoin
    c.execute('''CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        price REAL,
        price_fcfa INTEGER,
        image_url TEXT,
        product_url TEXT,
        category TEXT,
        subcategory TEXT,
        scraped_at TEXT,
        first_scraped_at TEXT,
        is_new INTEGER DEFAULT 0
    )''')
    # Ajout colonne is_new si elle n'existe pas déjà (migration douce)
    try:
        c.execute('ALTER TABLE products ADD COLUMN is_new INTEGER DEFAULT 0')
    except Exception:
        pass
    conn.commit()
    return conn, c

# --- Conversion Euro vers FCFA ---
def euro_to_fcfa(euro):
    return int(euro * 655.957)

# --- Extraction helpers ---
def extract_price(card):
    # Prix principal
    price_whole = card.select_one('span[data-testid="product-card-price-whole"]')
    price_fractional = card.select_one('span[data-testid="product-card-price-fractional"]')
    if price_whole and price_fractional:
        try:
            return float(price_whole.get_text(strip=True) + '.' + price_fractional.get_text(strip=True))
        except Exception:
            return None
    elif price_whole:
        try:
            return float(price_whole.get_text(strip=True).replace(',', '.'))
        except Exception:
            return None
    return None

def extract_product_info(card, category_name, subcategory):
    try:
        # Image
        img = card.select_one('img[data-testid="product-card-image"]')
        image_url = img['src'] if img and img.has_attr('src') else None
        # Nom
        title = card.select_one('span[data-testid="product-card-title"]')
        name = title.get_text(strip=True) if title else "Nom inconnu"
        # Description
        description_elem = card.select_one('span[data-testid="product-card-description"]')
        description = description_elem.get_text(strip=True) if description_elem else ""
        # Prix
        price = extract_price(card)
        # Lien produit (plus robuste)
        product_url = None
        # 1. Cherche un <a> descendant direct (Action a parfois le lien sur toute la carte)
        a_tag = card.select_one('a[href]')
        if a_tag and a_tag.has_attr('href'):
            href = a_tag['href']
            product_url = f"https://www.action.com{href}" if href.startswith('/') else href
        else:
            # 2. Cherche un parent <a> (fallback)
            link = card.find_parent('a')
            if link and link.has_attr('href'):
                href = link['href']
                product_url = f"https://www.action.com{href}" if href.startswith('/') else href
        if not product_url:
            print(f"[WARN] Lien produit non trouvé pour '{name}' dans '{subcategory}'")
        return {
            "name": name,
            "description": description,
            "price": price,
            "image_url": image_url,
            "product_url": product_url,
            "category": category_name,
            "subcategory": subcategory
        }
    except Exception as e:
        print(f"Erreur extraction produit: {e}")
        return None

def insert_product(c, prod):
    # Dédoublonnage strict sur nom + sous-catégorie + prix
    c.execute('''SELECT id FROM products WHERE name=? AND subcategory=? AND price=?''', (prod['name'], prod['subcategory'], prod['price']))
    if c.fetchone():
        return False
    price_fcfa = euro_to_fcfa(prod['price']) if prod['price'] else 0
    c.execute('''INSERT INTO products (name, description, price, price_fcfa, image_url, product_url, category, subcategory, scraped_at, first_scraped_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))''',
              (prod['name'], prod['description'], prod['price'], price_fcfa, prod['image_url'], prod['product_url'], prod['category'], prod['subcategory']))
    return True

def scrape_subcategory(driver, url, category_name, subcategory, conn, c):
    print(f"\n--- Scraping {subcategory} ---")
    driver.get(url)
    time.sleep(3)
    
    total_inserted = 0
    scraped_keys = set()
    
    for page in range(1, MAX_PAGES + 1):
        print(f"Page {page}/{MAX_PAGES}")
        # Attendre chargement produits
        try:
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='product-card']")))
        except Exception:
            print("Aucun produit trouvé sur cette page")
            break
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        cards = soup.select("[data-testid='product-card']")
        print(f"Produits trouvés: {len(cards)}")
        inserted = 0
        for card in cards:
            prod = extract_product_info(card, category_name, subcategory)
            if prod:
                key = (prod['name'], prod['subcategory'], prod['price'])
                scraped_keys.add(key)
                if insert_product(c, prod):
                    inserted += 1
        conn.commit()
        total_inserted += inserted
        print(f"Produits insérés: {inserted}")
        # Pagination : cliquer sur "Suivant" si pas dernière page
        if page < MAX_PAGES:
            try:
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
                # Chercher la div desktop pagination
                desktop_pagination = driver.find_element(By.CSS_SELECTOR, "div[data-testid='grid-pagination-items-desktop']")
                next_buttons = desktop_pagination.find_elements(By.XPATH, ".//a[@data-testid='GridPaginationLink' and @aria-label='Suivant']")
                found = False
                for btn in next_buttons:
                    print(f"Bouton desktop trouvé, texte='{btn.text.strip()}'")
                    print("HTML complet du bouton :", btn.get_attribute('outerHTML'))
                    # On clique sur le premier bouton trouvé (il n'y a qu'un seul 'Suivant' dans la div desktop)
                    print("Bouton Suivant (desktop) cliqué.")
                    print(f"Attente {SLEEP_BETWEEN_PAGES}s avant page suivante...")
                    time.sleep(SLEEP_BETWEEN_PAGES)
                    driver.execute_script("arguments[0].click();", btn)
                    time.sleep(3)
                    found = True
                    break
                if not found:
                    print("Fin de pagination (plus de bouton Suivant visible dans la pagination desktop).")
                    break
            except TimeoutException:
                print("Fin de pagination (plus de bouton Suivant).")
                break
            except Exception as e:
                print(f"Erreur pagination : {e}")
                break
    # Suppression des produits disparus (en Python)
    print(f"Nettoyage : suppression des produits absents de la sous-catégorie '{subcategory}'...")
    c.execute("SELECT id, name, subcategory, price FROM products WHERE subcategory=? AND category=?", (subcategory, category_name))
    all_db = c.fetchall()
    to_delete = [row[0] for row in all_db if (row[1], row[2], row[3]) not in scraped_keys]
    if to_delete:
        c.executemany("DELETE FROM products WHERE id=?", [(i,) for i in to_delete])
        conn.commit()
        print(f"Produits supprimés : {len(to_delete)}")
    else:
        print("Aucun produit à supprimer.")
    print(f"Scraping {subcategory} terminé. Total produits insérés: {total_inserted}")
    return total_inserted

def scrape_nouveautes(driver, conn, c):
    print("\n=== Scraping Nouveautés ===", flush=True)
    url = 'https://www.action.com/fr-fr/nouveautes/'
    driver.get(url)
    time.sleep(3)
    nouveaute_keys = set()
    for page in range(1, 6):
        print(f"Page {page}/5", flush=True)
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        cards = soup.select("[data-testid='product-card']")
        print(f"Produits trouvés: {len(cards)}", flush=True)
        for card in cards:
            prod = extract_product_info(card, 'Nouveautés', 'Nouveautés')
            if prod:
                key = (prod['name'], prod['product_url'])
                nouveaute_keys.add(key)
                # Vérifie si le produit existe déjà
                c.execute('SELECT id FROM products WHERE name=? AND product_url=?', (prod['name'], prod['product_url']))
                row = c.fetchone()
                if row:
                    c.execute('UPDATE products SET is_new=1 WHERE id=?', (row[0],))
                else:
                    price_fcfa = euro_to_fcfa(prod['price']) if prod['price'] else 0
                    c.execute('''INSERT INTO products (name, description, price, price_fcfa, image_url, product_url, category, subcategory, scraped_at, first_scraped_at, is_new)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 1)''',
                              (prod['name'], prod['description'], prod['price'], price_fcfa, prod['image_url'], prod['product_url'], prod['category'], prod['subcategory']))
        conn.commit()
        # Pagination : cliquer sur "Suivant" si pas dernière page
        if page < 5:
            try:
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
                next_btn = driver.find_element(By.XPATH, "//a[@data-testid='GridPaginationLink' and @aria-label='Suivant']")
                if next_btn:
                    print("Bouton Suivant (nouveautés) cliqué.", flush=True)
                    driver.execute_script("arguments[0].click();", next_btn)
                    print("Attente 5s avant page suivante...", flush=True)
                    time.sleep(5)
                else:
                    print("Fin de pagination Nouveautés.", flush=True)
                    break
            except Exception as e:
                print(f"Fin de pagination Nouveautés ou erreur: {e}", flush=True)
                break
    # Met à jour tous les autres produits (plus dans nouveautés)
    c.execute('UPDATE products SET is_new=0 WHERE (name, product_url) NOT IN (%s)' % ','.join(['(?,?)']*len(nouveaute_keys)), [item for key in nouveaute_keys for item in key]) if nouveaute_keys else c.execute('UPDATE products SET is_new=0')
    conn.commit()
    print(f"Nouveautés trouvées : {len(nouveaute_keys)}", flush=True)

def scrape_category(category_key, category_config):
    print(f"\n=== Scraping {category_config['name']} ===")
    driver = setup_driver()
    conn, c = setup_database()
    
    total_inserted = 0
    
    for subcategory, url in category_config['subcategories'].items():
        try:
            inserted = scrape_subcategory(driver, url, category_config['name'], subcategory, conn, c)
            total_inserted += inserted
            time.sleep(5)  # Pause entre les sous-catégories
        except Exception as e:
            print(f"Erreur lors du scraping de {subcategory}: {e}")
            continue
    
    driver.quit()
    conn.close() 
    print(f"\nScraping {category_config['name']} terminé. Total produits insérés: {total_inserted}")
    return total_inserted

def scrape_action(category=None):
    driver = setup_driver()
    conn, c = setup_database()
    if not category:
        # Scraper les nouveautés d'abord
        scrape_nouveautes(driver, conn, c)
    if category:
        # Scraper une seule catégorie
        scrape_category(category, CATEGORIES[category])
    else:
        # Scraper toutes les catégories
        for cat_key, cat_config in CATEGORIES.items():
            scrape_category(cat_key, cat_config)
            time.sleep(10)  # Pause entre les catégories
    driver.quit()
    conn.close()

if __name__ == "__main__":
    category = sys.argv[1] if len(sys.argv) > 1 else None
    scrape_action(category) 