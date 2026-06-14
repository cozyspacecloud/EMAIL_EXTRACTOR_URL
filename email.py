import asyncio
import csv
import json
import logging
import os
import sys
import re
from urllib.parse import urlparse, urljoin
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
import traceback

# Configurations
MAX_TABS = 1
TIMEOUT = 30000
MAX_RETRIES = 2

# Blocked email domains - system, tracking, placeholder, and template emails
BLOCKED_DOMAINS = [
    'sentry.wixpress.com', 'wixpress.com', 'example.com',
    'sentry.io', 'test.com', 'domain.com', 'email.com', 'yoursite.com',
    'yourdomain.com', 'yourcompany.com', 'company.com', 'website.com',
    'placeholder.com', 'sample.com', 'temp.com', 'noreply.com',
]

# STRICT email pattern: requires a non-alphanumeric/non-dot/non-dash boundary before the email
# This prevents capturing garbage text that runs into the email (e.g. "31info@domain.com")
EMAIL_PATTERN = r'(?:(?<=\s)|(?<=^)|(?<=[<(,;:"\'\/\\|>\]\[{}!?]))([a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?=[\s>,;:)"\'\/\\|<\]\[{}!?]|$)'
# Fallback pattern for when email appears at start of line or standalone
EMAIL_PATTERN_FALLBACK = r'\b([a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b'

# Common contact page URLs
CONTACT_PATHS = [
    'contact', 'contact-us', 'contactus', 'contact.html', 'contact-us.html',
    'about/contact', 'support', 'help', 'customer-service',
    'contacto', 'contactenos', 'contactar', 'contactanos',
    'contactez-nous', 'contactez', 'nous-contacter',
    'kontakt', 'kontaktieren', 'impressum',
    'contatti', 'contattaci',
    'contato', 'fale-conosco',
    'contacteer-ons', 'contact-opnemen',
    'kontakty', 'contacts',
    'lianxi', 'otoiawase',
]

# Language detection keywords
LANGUAGE_KEYWORDS = {
    'en': ['the', 'and', 'for', 'you', 'are', 'your', 'with', 'have', 'this', 'from'],
    'es': ['el', 'la', 'los', 'las', 'y', 'en', 'de', 'por', 'para', 'con'],
    'fr': ['le', 'la', 'les', 'et', 'des', 'pour', 'dans', 'une', 'vous', 'nous'],
    'de': ['der', 'die', 'das', 'und', 'mit', 'von', 'für', 'auf', 'ist', 'nicht'],
    'it': ['il', 'la', 'i', 'gli', 'le', 'e', 'per', 'con', 'su', 'del'],
    'pt': ['o', 'a', 'os', 'as', 'e', 'de', 'para', 'com', 'em', 'por'],
    'nl': ['de', 'het', 'een', 'en', 'van', 'voor', 'met', 'op', 'te', 'zijn'],
}

logging.basicConfig(level=logging.INFO, format="%(message)s")

def is_valid_company_url(url):
    """Check if the URL is a valid company domain (not social media or cloud platform)"""
    try:
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.lower()
        
        if not domain and '/' not in url:
            domain = url.lower()
        else:
            if domain.startswith('www.'):
                domain = domain[4:]
        
        INVALID_DOMAINS = [
            'facebook.com', 'linkedin.com', 'amazonaws.com', 's3.amazonaws.com',
            'twitter.com', 'instagram.com', 'youtube.com', 'tiktok.com',
            'pinterest.com', 'snapchat.com', 'reddit.com', 'whatsapp.com',
            'telegram.org', 'discord.com', 'slack.com', 'medium.com',
            'wordpress.com', 'blogspot.com', 'wixsite.com', 'weebly.com',
            'squarespace.com'
        ]
        
        for invalid_domain in INVALID_DOMAINS:
            if invalid_domain in domain or domain.endswith(invalid_domain):
                return False
        
        if '.' not in domain:
            return False
            
        return True
    except:
        return False

def read_urls_from_file(file_path):
    """Read URLs from a text or CSV file"""
    urls = []
    
    print(f"\n📂 Reading file: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"❌ Error: File '{file_path}' does not exist.")
        return []
    
    if file_path.endswith(".csv"):
        try:
            with open(file_path, newline='', encoding='utf-8') as f:
                reader = csv.reader(f)
                for row in reader:
                    for item in row:
                        item = item.strip().strip('"').strip("'")
                        if item and item != '""' and item != "''":
                            urls.append(item)
        except Exception as e:
            logging.error(f"Error reading CSV {file_path}: {e}")
            
    elif file_path.endswith(".txt"):
        try:
            with open(file_path, "r", encoding='utf-8') as f:
                for line in f:
                    line = line.strip().strip('"').strip("'")
                    if line and not line.startswith(('#', '//')):
                        urls.append(line)
        except Exception as e:
            logging.error(f"Error reading TXT {file_path}: {e}")
    else:
        print(f"❌ Error: Unsupported file type. Please use .txt or .csv files.")
        return []
    
    return urls

def detect_language(text):
    """Detect the language of the webpage"""
    if not text:
        return 'en'
    
    text_lower = text.lower()
    scores = {}
    
    for lang, keywords in LANGUAGE_KEYWORDS.items():
        score = sum(text_lower.count(keyword) for keyword in keywords)
        if score > 0:
            scores[lang] = score
    
    if scores:
        return max(scores, key=scores.get)
    return 'en'

def extract_clean_emails(text):
    """
    Extract ONLY clean, exact email addresses from text.
    Uses strict boundary matching + post-processing to ensure no garbage
    characters are attached (e.g. prevents "31info@domain.com" → yields "info@domain.com")
    """
    if not text:
        return []
    
    raw_emails = set()
    
    # Try primary strict pattern first
    for match in re.finditer(EMAIL_PATTERN, text):
        email = match.group(1) if match.lastindex else match.group()
        raw_emails.add(email.strip())
    
    # Also try fallback pattern to catch emails the strict pattern might miss
    for match in re.finditer(EMAIL_PATTERN_FALLBACK, text):
        email = match.group(1) if match.lastindex else match.group()
        raw_emails.add(email.strip())
    
    # Also extract from mailto: references embedded in text
    for match in re.finditer(r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', text):
        raw_emails.add(match.group(1).strip())
    
    cleaned_emails = []
    for email in raw_emails:
        email = email.lower().strip()
        
        # Skip non-email file extensions
        if any(ext in email for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js', '.pdf', '.doc', '.docx']):
            continue
        
        # Basic validation
        if len(email) < 5 or '@' not in email:
            continue
        
        local_part, _, domain_part = email.partition('@')
        if not domain_part or '.' not in domain_part:
            continue
        
        # BLOCK system/tracking/placeholder domains
        if any(domain_part == blocked or domain_part.endswith('.' + blocked) for blocked in BLOCKED_DOMAINS):
            continue
        
        # BLOCK hash-like local parts (e.g. ed436f5053144538958ad06a5005e99a)
        # These are tracking/system IDs, not real email addresses
        if len(local_part) > 16 and re.match(r'^[a-f0-9]+$', local_part):
            continue
        
        # CRITICAL FIX: Strip leading digits from local part
        # Page text often concatenates numbers into emails like "31info@domain.com"
        # Real email local parts almost always start with a letter
        original_local = local_part
        stripped_local = local_part.lstrip('0123456789')
        if stripped_local and stripped_local != local_part:
            # Only strip if what remains looks like a valid local part (starts with letter)
            if re.match(r'^[a-zA-Z]', stripped_local):
                local_part = stripped_local
                logging.debug(f"Cleaned local part: {original_local} → {local_part}")
        
        # Local part must start with a letter
        if not re.match(r'^[a-zA-Z]', local_part):
            continue
        
        # Validate the full email format strictly
        email = f"{local_part}@{domain_part}"
        if not re.match(r'^[a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
            continue
        
        # Validate TLD - must be between 2-10 chars (prevents "comcall", "orgclick" etc)
        tld = domain_part.split('.')[-1]
        if len(tld) < 2 or len(tld) > 10 or not tld.isalpha():
            continue
        
        cleaned_emails.append(email)
    
    # Deduplicate
    return list(set(cleaned_emails))

async def extract_from_mailto_links(page):
    """Extract emails from mailto: links"""
    emails = []
    try:
        mailto_links = await page.locator('a[href^="mailto:"]').all()
        for link in mailto_links[:10]:
            try:
                href = await link.get_attribute('href')
                if href and href.startswith('mailto:'):
                    # Extract email from mailto: link
                    email_part = href.replace('mailto:', '').split('?')[0].strip()
                    # Clean the email part
                    found_emails = extract_clean_emails(email_part)
                    emails.extend(found_emails)
            except:
                continue
    except Exception as e:
        logging.debug(f"Error extracting mailto links: {e}")
    return emails

async def extract_via_lite14(playwright, browser_context, text_to_extract):
    """
    Automates https://www.lite14.us/ to extract emails from text/HTML.
    As requested by the user for "no mistake" extraction.
    """
    if not text_to_extract or len(text_to_extract.strip()) < 5:
        return []
        
    lite_page = None
    try:
        lite_page = await browser_context.new_page()
        await lite_page.goto("https://www.lite14.us/", wait_until="domcontentloaded", timeout=20000)
        
        # 1. Add everything you copy in the website (HTML/Text)
        # Find the main textarea - often the first one on Lite 1.4
        textarea = lite_page.locator('textarea').first
        await textarea.fill(text_to_extract)
        
        # 2. SEPERATOR IN THE LITE1.4 YOU CHANGE IT FROM COMMA TO NEW LINE
        # The separator select is usually 'sep'
        try:
            # Try to find the separator selector. Lite 1.4 usually uses 'sep' name
            sep_selector = lite_page.locator('select[name="sep"]')
            if await sep_selector.count() > 0:
                # Value for New Line is usually "\n" or "\r\n"
                # We'll try to find the option with "New Line" text
                await sep_selector.select_option(label="New Line")
        except:
            pass
            
        # 3. CLICK ON EXTRACT
        # Find extract button. Common value is "Extract"
        extract_btn = lite_page.locator('input[type="button"][value*="Extract"], button:has-text("Extract"), input[value*="Extract"]')
        await extract_btn.first.click()
        
        # 4. COPY THE EMAILS THAT IT WILL SHOW
        # After extraction, the same or another textarea contains the results
        # Usually it's the same textarea or one nearby
        await asyncio.sleep(1) # Wait a moment for JS to run
        results_text = await textarea.get_attribute('value') or await textarea.input_value()
        
        # Clean up the output using our internal cleaning logic for consistency
        emails = extract_clean_emails(results_text)
        
        await lite_page.close()
        return emails
        
    except Exception as e:
        logging.debug(f"Lite14 extraction failed: {e}")
        if lite_page:
            try: await lite_page.close()
            except: pass
        return []

async def extract_from_page_text(page):
    """Extract emails from page HTML source (not text_content which merges text without spaces)"""
    emails = []
    try:
        # CRITICAL FIX: Use page.content() (raw HTML) instead of text_content()
        # text_content() strips HTML tags WITHOUT adding spaces, so:
        #   <p>info@site.com</p><p>Call us</p> becomes "info@site.comCall us"
        #   which the regex matches as "info@site.comcall"
        # With raw HTML, tags act as natural separators between text
        html_source = await page.content()
        
        if html_source:
            # Remove <script> and <style> blocks to avoid picking up tracking/system emails
            html_cleaned = re.sub(r'<script[^>]*>.*?</script>', ' ', html_source, flags=re.DOTALL | re.IGNORECASE)
            html_cleaned = re.sub(r'<style[^>]*>.*?</style>', ' ', html_cleaned, flags=re.DOTALL | re.IGNORECASE)
            html_cleaned = re.sub(r'<noscript[^>]*>.*?</noscript>', ' ', html_cleaned, flags=re.DOTALL | re.IGNORECASE)
            # Remove HTML comments
            html_cleaned = re.sub(r'<!--.*?-->', ' ', html_cleaned, flags=re.DOTALL)
            
            # Replace all HTML tags with spaces so text doesn't merge
            text_with_spaces = re.sub(r'<[^>]+>', ' ', html_cleaned)
            
            # Now extract emails from the clean text
            lines = text_with_spaces.split('\n')
            for line in lines[:500]:
                found_emails = extract_clean_emails(line)
                emails.extend(found_emails)
                
    except Exception as e:
        logging.debug(f"Error extracting from page text: {e}")
    
    return list(set(emails))

async def find_contact_link(page, base_url):
    """Find contact page link"""
    try:
        contact_selectors = [
            'a[href*="contact"]',
            'a[href*="kontakt"]',
            'a:has-text("Contact")',
            'a:has-text("Kontakt")',
            'footer a[href*="contact"]',
            'nav a[href*="contact"]'
        ]
        
        for selector in contact_selectors:
            try:
                links = await page.locator(selector).all()
                for link in links[:3]:
                    href = await link.get_attribute('href')
                    if href and not href.startswith('#') and not href.startswith('javascript:'):
                        full_url = urljoin(base_url, href)
                        if urlparse(full_url).netloc == urlparse(base_url).netloc:
                            return full_url
            except:
                continue
        
        # Try common paths
        for path in CONTACT_PATHS[:5]:
            contact_url = urljoin(base_url, path)
            try:
                response = await page.goto(contact_url, wait_until="domcontentloaded", timeout=3000)
                if response and response.status == 200:
                    return contact_url
            except:
                continue
        
        return None
    except Exception as e:
        logging.debug(f"Error finding contact link: {e}")
        return None

async def process_website(url, index, total, playwright):
    """Process a single website to extract emails"""
    print(f"\n{'='*60}")
    print(f"🔍 Processing [{index}/{total}]: {url}")
    print(f"{'='*60}")
    
    browser = None
    result = {
        'url': url,
        'status': 'pending',
        'emails': [],
        'contact_page': None,
        'language': 'unknown',
        'error': None
    }
    
    try:
        browser = await playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-setuid-sandbox']
        )
        
        context = await browser.new_context(
            ignore_https_errors=True,
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        
        # COLLECT ALL CONTENT IN STAGES
        collected_content = []
        
        page = await context.new_page()
        
        # ENSURE URL HAS PROTOCOL
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        result['url'] = url
        
        # --- HOMEPAGE LOADING ---
        print(f"   🌐 Loading homepage...")
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=TIMEOUT)
            
            # Stage 1: Text Content
            print(f"   copy all content in homepage")
            hp_text = await page.evaluate("document.body.innerText")
            collected_content.append(hp_text)
            print(f"   paste in lite 1.4")
            
            # Stage 2: HTML Content (Inspect phase)
            # Find contact link while on homepage
            contact_url = await find_contact_link(page, url)
            
            # --- CONTACT PAGE LOADING ---
            if contact_url and contact_url != url:
                print(f"   loading contact ...")
                try:
                    await page.goto(contact_url, wait_until="domcontentloaded", timeout=15000)
                    print(f"   copy all content in contact")
                    cp_text = await page.evaluate("document.body.innerText")
                    collected_content.append(cp_text)
                    print(f"   paste in lite 1.4")
                except:
                    print(f"   ⚠️ Could not load contact page")
            else:
                # Still print looking logs if needed or just skip
                pass

            # Stage 3: Inspect Homepage HTML
            print(f"   inspecting the home page")
            print(f"   copy all html element in homepage")
            # Navigate back to homepage to get fresh HTML or use stored?
            # User wants "inspect the homepage" which implies the HTML
            # We already have hp_text, now we need HTML.
            # Re-visiting is safest to follow user's "loading... loading..." flow
            await page.goto(url, wait_until="domcontentloaded", timeout=10000)
            hp_html = await page.content()
            collected_content.append(hp_html)
            print(f"   paste in in lite 1.4")
            
            # Stage 4: Inspect Contact Page HTML
            if contact_url and contact_url != url:
                print(f"   copy all html element in contact")
                try:
                    await page.goto(contact_url, wait_until="domcontentloaded", timeout=10000)
                    cp_html = await page.content()
                    collected_content.append(cp_html)
                    print(f"   paste in lite 1.4")
                except:
                    pass
            
            print(f"\n   then extract the emails")
            
        except PlaywrightTimeoutError:
            print(f"   ❌ Timeout loading website")
            result['status'] = 'failed'
            result['error'] = 'Timeout'
            await page.close()
            await context.close()
            await browser.close()
            return result
        
        # 2. PERFORM EXTRACTION VIA LITE14.US (FINAL STEP)
        all_text_blob = "\n\n".join(collected_content)
        lite14_emails = await extract_via_lite14(playwright, context, all_text_blob)
        
        if lite14_emails:
            result['emails'].extend(lite14_emails)
        
        # FINAL DEDUPLICATION AND FILTERING
        result['emails'] = sorted(list(set(result['emails'])))
        
        # Display results
        if result['emails']:
            result['status'] = 'success'
            print(f"   ✨ FOUND {len(result['emails'])} EMAIL(S):")
            for i, email in enumerate(result['emails'], 1):
                print(f"      {i}. {email}")
        else:
            result['status'] = 'no_emails'
            print(f"   ⚠️  No emails found on this website")
        
        await page.close()
        await context.close()
        await browser.close()
        
    except Exception as e:
        result['status'] = 'failed'
        result['error'] = str(e)[:100]
        print(f"   ❌ Error: {str(e)[:100]}")
    finally:
        if browser:
            try:
                await browser.close()
            except:
                pass
    
    return result

def flatten_result(result):
    """Transform internal result dict to the simplified format requested by the user"""
    return {
        "URL": result.get('url'),
        "EMAILS": ", ".join(result.get('emails', [])) if result.get('emails') else None,
        "STATUS": result.get('status')
    }

async def main(urls):
    results = []
    successful = 0
    failed = 0
    no_emails = 0
    
    print(f"\n{'='*60}")
    print(f"🚀 STARTING EMAIL EXTRACTION")
    print(f"{'='*60}")
    print(f"📊 Total websites to process: {len(urls)}")
    print(f"{'='*60}\n")
    
    async with async_playwright() as playwright:
        for i, url in enumerate(urls, 1):
            try:
                result = await process_website(url, i, len(urls), playwright)
                results.append(result)
                
                # Update counters
                if result['status'] == 'success':
                    successful += 1
                elif result['status'] == 'no_emails':
                    no_emails += 1
                else:
                    failed += 1
                
                # Print result as JSON string on stdout for frontend to consume
                print(f"RESULT: {json.dumps(flatten_result(result))}")
                
                progress = (i / len(urls)) * 100
                print(f"\n📈 Progress: {i}/{len(urls)} ({progress:.1f}%)")
                print(f"   ✅ Success: {successful} | ⚠️ No emails: {no_emails} | ❌ Failed: {failed}")
                
                if i < len(urls):
                    print(f"\n⏳ Waiting 2 seconds before next website...")
                    await asyncio.sleep(2)
                    
            except Exception as e:
                print(f"\n❌ Critical error processing {url}: {e}")
                failed += 1
                continue
    
    return results, successful, failed, no_emails

def print_usage():
    print("\n" + "="*70)
    print("EMAIL EXTRACTOR - Find emails on company websites")
    print("="*70)
    print("\nUsage:")
    print("   python email_extractor.py <file_path>")
    print("\nExamples:")
    print("   python email_extractor.py urls.txt")
    print("   python email_extractor.py C:\\Users\\Name\\Desktop\\urls.csv")
    print("\nFeatures:")
    print("   - Extracts ONLY clean emails (no extra text attached)")
    print("   - Uses word boundaries to isolate exact email addresses")
    print("   - Processes websites one by one with detailed progress")
    print("="*70 + "\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print_usage()
        file_path = input("📂 Please enter the path to your .txt or .csv file: ").strip().strip('"').strip("'")
        
        if not file_path:
            print("❌ No file path provided. Exiting.")
            exit(1)
    else:
        file_path = sys.argv[1].strip().strip('"').strip("'")
    
    urls = read_urls_from_file(file_path)
    
    if not urls:
        print("❌ No URLs found in the file.")
        exit(1)
    
    company_urls = [url for url in urls if is_valid_company_url(url)]
    skipped_urls = len(urls) - len(company_urls)
    
    print(f"\n📨 Loaded {len(urls)} URLs")
    print(f"   - Company websites to process: {len(company_urls)}")
    print(f"   - Skipped (social media/cloud): {skipped_urls}")
    
    try:
        results, successful, failed, no_emails = asyncio.run(main(company_urls))
        
        print("\n" + "="*60)
        print("✅ EXTRACTION COMPLETE")
        print("="*60)
        print(f"📊 Final Summary:")
        print(f"   - Total processed: {len(results)}")
        print(f"   - Found emails: {successful}")
        print(f"   - No emails found: {no_emails}")
        print(f"   - Failed: {failed}")
        
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        traceback.print_exc()
        exit(1)