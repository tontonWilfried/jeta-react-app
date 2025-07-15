import time
import sqlite3
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import json
import ast
import urllib.parse

def clean_price(price_str):
    import re
    price_str = price_str.replace('\xa0', ' ').replace(',', '.').replace('€', '').strip()
    match = re.search(r"(\d+(\.\d+)?)", price_str)
    return float(match.group(1)) if match else None

DB_PATH = "lidl_products.sqlite"
MAX_PAGES = 5
SLEEP_BETWEEN_PAGES = 5

START_URL = "https://www.lidl.fr/c/accueil/s10008381"  # À adapter si besoin

# --- Setup Selenium ---
def setup_driver():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
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
        brand TEXT,
        description TEXT,
        price REAL,
        price_fcfa REAL,
        image_url TEXT,
        product_url TEXT,
        rating REAL,
        rating_count INTEGER,
        rendered_date TEXT,
        product_id TEXT,
        category TEXT,
        subcategory TEXT,
        category_from_data TEXT,
        scraped_at TEXT,
        first_scraped_at TEXT
    )
    ''')
    conn.commit()
    return conn, c

def insert_product(c, prod):
    c.execute('''SELECT id, first_scraped_at FROM products WHERE name=? AND subcategory=? AND price=?''', (prod['name'], prod['subcategory'], prod['price']))
    row = c.fetchone()
    if row:
        c.execute('''UPDATE products SET scraped_at=datetime('now') WHERE id=?''', (row[0],))
        return False
    c.execute('''INSERT INTO products (name, brand, description, price, price_fcfa, image_url, product_url, rating, rating_count, rendered_date, product_id, category, subcategory, category_from_data, scraped_at, first_scraped_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))''',
              (prod['name'], prod['brand'], prod['description'], prod['price'], prod['price_fcfa'], prod['image_url'], prod['product_url'], prod['rating'], prod['rating_count'], prod['rendered_date'], prod['product_id'], prod['category'], prod['subcategory'], prod['category_from_data']))
    return True

def extract_price_from_json(data):
    if not isinstance(data, dict):
        return None
    p = data.get('price') or data.get('promoPrice')
    if isinstance(p, (int, float, str)):
        try:
            return float(str(p).replace(',', '.'))
        except:
            return None
    elif isinstance(p, dict):
        # Format ancien : {"price": 19.99, "currency": "EUR"}
        if 'price' in p:
            try:
                return float(str(p['price']).replace(',', '.'))
            except:
                return None
        elif 'value' in p:
            try:
                return float(str(p['value']).replace(',', '.'))
            except:
                return None
    return None

def extract_product_info(card, chemin):
    try:
        # Récupère le parent <div class="product-grid-box"> si possible
        parent_html = None
        try:
            parent = card.find_element(By.XPATH, './ancestor::div[contains(@class, "product-grid-box")]')
            parent_html = parent.get_attribute('outerHTML')
        except:
            parent_html = card.get_attribute('outerHTML')
        soup = BeautifulSoup(parent_html, 'html.parser')
        box = soup.select_one('div.product-grid-box')
        if not box:
            box = soup.select_one('li.tile-without-padding')
        # PATCH : si box est un <div>, cherche le <li> enfant
        if box and box.name == 'div':
            li = box.select_one('li.tile-without-padding')
            if li:
                box = li
        if not box:
            print("LOG: Pas de box produit trouvée")
            return None
        # Initialisation des variables
        name = "Nom inconnu"
        brand_name = ""
        description = ""
        price = None
        price_fcfa = None
        image_url = None
        product_url = None
        rating_value = None
        rating_count = None
        # 1. Extraction du prix depuis le JSON structuré (data-gridbox-impression puis data-grid-data)
        price = None
        # a) data-gridbox-impression (décodage URL)
        if box.has_attr('data-gridbox-impression'):
            import json
            try:
                json_str = urllib.parse.unquote(str(box['data-gridbox-impression']))
                data = json.loads(json_str)
                if not isinstance(data, dict):
                    data = None
                if data is not None:
                    name = data.get('name') or data.get('title') or name
                    brand_name = data.get('brand', {}).get('name', "") if isinstance(data.get('brand'), dict) else data.get('brand', "")
                    description = data.get('description', "") or data.get('shortDescription', "")
                    image_url = data.get('image') or data.get('imageUrl')
                    canonical = data.get('canonicalPath') or data.get('url')
                    product_url = f"https://www.lidl.fr{canonical}" if canonical and str(canonical).startswith('/') else canonical
                    rating_value = data.get('ratingAverage')
                    rating_count = data.get('ratingCount')
                    price = extract_price_from_json(data)
            except Exception as e:
                print(f"[DEBUG] Erreur parsing data-gridbox-impression: {e}")
        # b) data-grid-data
        if price is None and box.has_attr('data-grid-data'):
            try:
                data_raw = str(box['data-grid-data'])
                data = parse_possible_json(data_raw)
                if not isinstance(data, dict):
                    data = None
                if data is not None:
                    name = data.get('name') or data.get('title') or name
                    brand_name = data.get('brand', {}).get('name', "") if isinstance(data.get('brand'), dict) else data.get('brand', "")
                    description = data.get('description', "") or data.get('shortDescription', "")
                    image_url = data.get('image') or data.get('imageUrl')
                    canonical = data.get('canonicalPath') or data.get('url')
                    product_url = f"https://www.lidl.fr{canonical}" if canonical and str(canonical).startswith('/') else canonical
                    rating_value = data.get('ratingAverage')
                    rating_count = data.get('ratingCount')
                    price = extract_price_from_json(data)
            except Exception as e:
                print(f"[DEBUG] Erreur parsing data-grid-data: {e}")
        # 2. Fallback HTML (BeautifulSoup) — version ultra-robuste
        if price is None:
            # Recherche large sur toutes les divs
            price_tags = [div for div in soup.find_all('div') if div.get('class') and any('ods-price__value' in c for c in div.get('class'))]
            for price_tag in price_tags:
                txt = price_tag.get_text(strip=True)
                if txt is None:
                    txt = ''
                txt = str(txt).replace(',', '.').replace('€', '').strip()
                if not txt:
                    aria = price_tag.get('aria-label', '')
                    if aria is None:
                        aria = ''
                    txt = str(aria).replace(',', '.').replace('€', '').strip()
                try:
                    price = float(txt)
                    if price:
                        break
                except:
                    continue
        # 3. Log si prix manquant
        if price is None:
            print(f"[WARN] Prix non trouvé pour '{name}' dans '{chemin[1] if len(chemin) > 1 else ''}'")
            try:
                print(f"[DEBUG] HTML carte sans prix: {parent_html[:500]}...")
            except:
                pass
        # 3. Image fallback
        if not image_url:
            img = box.select_one('.odsc-image-gallery__image')
            image_url = img['src'] if img and img.has_attr('src') else None
        # 4. Nom fallback
        if name == "Nom inconnu":
            title = box.select_one('.product-grid-box__title')
            name = title.get_text(strip=True) if title else name
        # 5. Marque fallback
        if not brand_name:
            brand = box.select_one('.product-grid-box__brand')
            brand_name = brand.get_text(strip=True) if brand else ""
        # 6. Description fallback
        if not description:
            desc = box.select_one('.product-grid-box__meta')
            description = desc.get_text(strip=True) if desc else ""
        # 7. Lien produit fallback
        if not product_url:
            link = box.select_one('a.odsc-tile__link')
            if link and link.has_attr('href'):
                href = link['href']
                product_url = f"https://www.lidl.fr{href}" if str(href).startswith('/') else href
        # 8. Rating fallback
        if rating_value is None or rating_count is None:
            rating = box.select_one('.ods-rating__info')
            rating_text = rating.get_text(strip=True) if rating else ""
            if rating_text:
                import re
                match = re.search(r'(\d+\.?\d*)/5\s*\((\d+)\)', rating_text)
                if match:
                    rating_value = float(match.group(1))
                    rating_count = int(match.group(2))
        # 9. Calcul FCFA
        price_fcfa = price * 655.957 if price else None
        return {
            "name": name,
            "brand": brand_name,
            "description": description,
            "price": price,
            "price_fcfa": price_fcfa,
            "image_url": image_url,
            "product_url": product_url,
            "rating": rating_value,
            "rating_count": rating_count,
            "rendered_date": None,
            "product_id": None,
            "category": chemin[0] if chemin else "",
            "subcategory": chemin[1] if len(chemin) > 1 else "",
            "category_from_data": None
        }
    except Exception as e:
        print(f"LOG: Erreur extraction: {e}")
        return None

def parse_possible_json(s):
    try:
        return json.loads(s)
    except Exception:
        pass
    try:
        s2 = s.replace("'", '"')
        return json.loads(s2)
    except Exception:
        pass
    try:
        return ast.literal_eval(s)
    except Exception:
        pass
    return None

def scrape_products_on_page(driver, chemin, cards=None):
    if not chemin or len(chemin) == 0:
        print("Aucune catégorie détectée, on saute le nettoyage.")
        return
    scraped_keys = set()
    conn, c = setup_database()
    if cards is None:
        try:
            ol = driver.find_element(By.CSS_SELECTOR, 'ol.s-product-grid')
            cards = ol.find_elements(By.CSS_SELECTOR, "div[id^='product_']")
        except:
            cards = []
    print(f"LOG: Produits trouvés: {len(cards)}")
    if len(cards) == 0:
        print("LOG: Aucun produit trouvé")
        return
    inserted = 0
    for card in cards:
        prod = extract_product_info(card, chemin)
        if prod and prod['name'] != "Nom inconnu":
            key = (prod['name'], prod['subcategory'], prod['price'])
            scraped_keys.add(key)
            if insert_product(c, prod):
                inserted += 1
                conn.commit()
    print(f"LOG: Produits insérés: {inserted}")
    # Nettoyage : on supprime les produits à la fin de chaque sous-catégorie
    print(f"LOG: Nettoyage produits...")
    c.execute("SELECT id, name, subcategory, price FROM products WHERE subcategory=? AND category=?", (chemin[1] if len(chemin) > 1 else "", chemin[0]))
    all_db = c.fetchall()
    to_delete = [row[0] for row in all_db if (row[1], row[2], row[3]) not in scraped_keys]
    if to_delete:
        c.executemany("DELETE FROM products WHERE id=?", [(i,) for i in to_delete])
        conn.commit()
        print(f"LOG: Produits supprimés: {len(to_delete)}")
    else:
        print("LOG: Aucun produit à supprimer")
    conn.close()

def open_main_menu(driver):
    menu_btn = driver.find_element(By.CSS_SELECTOR, 'a.n-navigation__menu-nav--link[role="button"]')
    menu_btn.click()
    time.sleep(1)

def click_main_category(driver, category_name):
    cats = driver.find_elements(By.CSS_SELECTOR, 'a.n-header__main-navigation-link')
    for cat in cats:
        if cat.text.strip().lower() == category_name.lower():
            cat.click()
            time.sleep(1)
            return True
    return False

def scrape_category(driver, category_name, chemin):
    driver.get('https://www.lidl.fr/')
    time.sleep(2)
    open_main_menu(driver)
    if not click_main_category(driver, category_name):
        print(f"Catégorie {category_name} non trouvée dans le menu principal.")
        return
    try:
        WebDriverWait(driver, 5).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'div.n-header__subnav ol.n-header__main-navigation--sub'))
        )
        ol = driver.find_element(By.CSS_SELECTOR, 'div.n-header__subnav ol.n-header__main-navigation--sub')
        lis = ol.find_elements(By.TAG_NAME, 'li')
        count = 0
        for li in lis[1:]:
            try:
                a = li.find_element(By.CSS_SELECTOR, 'a.n-header__main-navigation-link--sub')
                nom = a.find_element(By.CSS_SELECTOR, '.n-header__main-navigation-link-text').text.strip()
                lien = a.get_attribute('href')
                if lien and lien.startswith('/h/'):
                    count += 1
                    print(f"  → Scraping sous-catégorie: {nom}")
                    scrape_products_from_subcategory(driver, lien, chemin + [nom])
            except Exception:
                continue
        print(f"Sous-catégories réelles dans {chemin[-1]}: {count}")
    except Exception as e:
        print(f"Erreur lors de la récupération des sous-catégories visibles: {e}")

def charger_tous_les_produits(driver):
    while True:
        try:
            bouton = WebDriverWait(driver, 3).until(
                EC.element_to_be_clickable((By.XPATH, "//button[span[contains(text(), 'Charger d’autres produits')]]"))
            )
            produits_avant = len(driver.find_elements(By.CSS_SELECTOR, "div[id^='product_']"))
            bouton.click()
            for _ in range(10):
                time.sleep(1)
                produits_apres = len(driver.find_elements(By.CSS_SELECTOR, "div[id^='product_']"))
                if produits_apres > produits_avant:
                    break
        except Exception:
            break
    # Attendre que les skeletons disparaissent et que le contenu réel soit chargé
    print("LOG: Attente chargement...")
    max_wait = 30  # 30 secondes max
    wait_time = 0
    while wait_time < max_wait:
        try:
            skeletons = driver.find_elements(By.CSS_SELECTOR, ".s-grid-box-skeleton")
            if len(skeletons) == 0:
                real_content = driver.find_elements(By.CSS_SELECTOR, ".product-grid-box__title")
                if len(real_content) > 0:
                    print("LOG: Produits chargés")
                    break
            time.sleep(1)
            wait_time += 1
        except Exception:
            time.sleep(1)
            wait_time += 1
    if wait_time >= max_wait:
        print("LOG: Timeout chargement")
    try:
        ol = driver.find_element(By.CSS_SELECTOR, 'ol.s-product-grid')
        cards = ol.find_elements(By.CSS_SELECTOR, "div[id^='product_']")
        print(f"LOG: Total produits dans <ol>: {len(cards)}")
        return cards
    except Exception as e:
        print(f"LOG: Pas de <ol> trouvé: {e}")
        return []

def scrape_subsubcategories(driver, url, chemin):
    """Scrape les sous-sous-catégories d'une sous-catégorie"""
    driver.get(url)
    time.sleep(3)
    
    try:
        # Cherche les sous-sous-catégories
        subsubcats = driver.find_elements(By.CSS_SELECTOR, '.n-header__main-navigation-link--sub')
        print(f"  Sous-sous-catégories trouvées dans {chemin[-1]}: {len(subsubcats)}")
        
        for subsubcat in subsubcats:
            try:
                nom = subsubcat.find_element(By.CSS_SELECTOR, '.n-header__main-navigation-link-text').text.strip()
                lien = subsubcat.get_attribute('href')
                
                if nom and lien and lien.startswith('/h/'):
                    print(f"    → Scraping sous-sous-catégorie: {nom}")
                    scrape_products_from_subcategory(driver, lien, chemin + [nom])
            except Exception as e:
                print(f"Erreur avec sous-sous-catégorie: {e}")
                continue
    except Exception as e:
        print(f"Erreur recherche sous-sous-catégories: {e}")

def scrape_products_from_subcategory(driver, url, chemin):
    driver.get(url)
    time.sleep(3)
    print(f"Scraping produits pour {' > '.join(chemin)}")
    cards = charger_tous_les_produits(driver)
    scrape_products_on_page(driver, chemin, cards)

def scrape_lidl_subcategory(driver, url, chemin):
    driver.get(url)
    time.sleep(2)
    print(f"LOG: URL: {url}")
    cards = charger_tous_les_produits(driver)
    scrape_products_on_page(driver, chemin, cards)

def main():
    driver = setup_driver()
    try:
        consent_btn = driver.find_element(By.CSS_SELECTOR, 'button#onetrust-accept-btn-handler')
        consent_btn.click()
        print("LOG: Cookies acceptés")
        time.sleep(1)
    except Exception:
        print("LOG: Pas de bannière cookies")

    # Liste des liens de sous-catégories à scraper pour Cuisine & Ménage
    subcategory_links = [
        ("Monsieur Cuisine", "https://www.lidl.fr/h/monsieur-cuisine/h10067521"),
        ("Appareils de cuisine", "https://www.lidl.fr/h/appareils-de-cuisine/h10067522"),
        ("Cuisine & pâtisserie", "https://www.lidl.fr/h/cuisine-patisserie/h10067523"),
        ("L'art de la table & la vaisselle", "https://www.lidl.fr/h/l-art-de-la-table-la-vaisselle/h10067524"),
        ("Barbecue & accessoires", "https://www.lidl.fr/h/barbecue-accessoires/h10067525"),
        ("Rangement et organisation", "https://www.lidl.fr/h/rangement-et-organisation/h10067526"),
        ("Appareils de nettoyage", "https://www.lidl.fr/h/nettoyage-de-la-maison/h10067527"),
        ("Lavage & repassage", "https://www.lidl.fr/h/lavage-sechage/h10067528"),
        ("Réfrigérer & congeler", "https://www.lidl.fr/h/refrigerer-congeler/h10067529"),
        ("Machine à coudre & accessoires", "https://www.lidl.fr/h/machine-a-coudre-accessoires/h10067530"),
    ]

    for nom, lien in subcategory_links:
        print(f"LOG: Scraping {nom}")
        scrape_lidl_subcategory(driver, lien, ["Cuisine & Ménage", nom])

    driver.quit()

if __name__ == "__main__":
    main() 