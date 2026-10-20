#!/usr/bin/env node

/**
 * Ollama Multi-File Apps Stress Test - 20 Tasks (C6-C8)
 *
 * Graduates from single-function tasks to multi-file mini-projects.
 * Each task creates 2-3 coordinated files in a subdirectory under tasks/.
 * Tests the coder agent's ability to write multiple files per execution.
 *
 * Categories (20 tasks):
 *   - Python Packages:  6 tasks (C6-C8) — __init__.py + module files
 *   - Python CLI Tools: 4 tasks (C6-C8) — importable functions
 *   - Landing Pages:    4 tasks (C6-C8) — HTML + CSS (+ JS)
 *   - Node.js Utilities: 4 tasks (C6-C8) — CommonJS modules
 *   - Bonus Python:     2 tasks (C6-C7) — model/conversion packages
 *
 * Distribution: C6: 5, C7: 9, C8: 6
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || '';
const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per task
const REST_DELAY_MS = 3000; // 3 seconds rest between tasks
const RESET_EVERY_N_TASKS = 3; // Aggressive reset every 3 tasks
const MAX_ITERATIONS = 10; // Multi-file needs more tool calls

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK DEFINITIONS — 20 multi-file tasks across 5 categories
// ═══════════════════════════════════════════════════════════════════════════════

const TASKS = [
  // ─────────────────────────────────────────────────────────────────────────────
  // CATEGORY 1: Python Packages (6 tasks, C6-C8)
  // Each creates __init__.py + module files in tasks/<pkg>/
  // ─────────────────────────────────────────────────────────────────────────────
  {
    complexity: 6,
    name: 'calc_pkg',
    category: 'python_pkg',
    files: 3,
    description: `MULTI-FILE PROJECT: Create 3 files in tasks/calc_pkg/

Step 1: Use file_write to create tasks/calc_pkg/__init__.py with:
from .calc import add, subtract, multiply, divide
from .formatter import format_result

Step 2: Use file_write to create tasks/calc_pkg/calc.py with:
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

def multiply(a, b):
    return a * b

def divide(a, b):
    if b == 0:
        return None
    return a / b

Step 3: Use file_write to create tasks/calc_pkg/formatter.py with:
def format_result(label, value):
    return f"{label}: {value}"

Step 4: Verify by running: python -c "from tasks.calc_pkg import add, format_result; print(add(2,3)); print(format_result('sum', 5))"

You MUST call file_write 3 times to create all 3 files.`,
    validation: `from tasks.calc_pkg import add, subtract, multiply, divide, format_result; assert add(2,3)==5; assert subtract(10,4)==6; assert multiply(3,4)==12; assert divide(10,2)==5.0; assert divide(1,0) is None; assert format_result('sum',5)=='sum: 5'; print('PASS')`,
  },
  {
    complexity: 7,
    name: 'str_utils',
    category: 'python_pkg',
    files: 3,
    description: `MULTI-FILE PROJECT: Create 3 files in tasks/str_utils/

Step 1: Use file_write to create tasks/str_utils/__init__.py with:
from .converters import to_snake_case, to_camel_case, to_slug

Step 2: Use file_write to create tasks/str_utils/converters.py with:
import re

def to_snake_case(s):
    s = re.sub(r'([A-Z])', r'_\\1', s).lower().strip('_')
    s = re.sub(r'[\\s-]+', '_', s)
    return re.sub(r'_+', '_', s)

def to_camel_case(s):
    parts = re.split(r'[_\\s-]+', s)
    return parts[0].lower() + ''.join(p.capitalize() for p in parts[1:])

def to_slug(s):
    s = s.lower().strip()
    s = re.sub(r'[^a-z0-9\\s-]', '', s)
    return re.sub(r'[\\s-]+', '-', s).strip('-')

Step 3: Verify by running: python -c "from tasks.str_utils import to_snake_case; print(to_snake_case('helloWorld'))"

You MUST call file_write at least 2 times.`,
    validation: `from tasks.str_utils import to_snake_case, to_camel_case, to_slug; assert to_snake_case('helloWorld')=='hello_world'; assert to_camel_case('hello_world')=='helloWorld'; assert to_slug('Hello World!')=='hello-world'; print('PASS')`,
  },
  {
    complexity: 7,
    name: 'validators',
    category: 'python_pkg',
    files: 3,
    description: `MULTI-FILE PROJECT: Create 3 files in tasks/validators/

Step 1: Use file_write to create tasks/validators/__init__.py with:
from .checks import is_valid_email, is_valid_url

Step 2: Use file_write to create tasks/validators/checks.py with:
import re

def is_valid_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def is_valid_url(url):
    pattern = r'^https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/.*)?$'
    return bool(re.match(pattern, url))

Step 3: Verify by running: python -c "from tasks.validators import is_valid_email; print(is_valid_email('test@example.com'))"

You MUST call file_write at least 2 times.`,
    validation: `from tasks.validators import is_valid_email, is_valid_url; assert is_valid_email('test@example.com')==True; assert is_valid_email('bad-email')==False; assert is_valid_email('@no-user.com')==False; assert is_valid_url('https://example.com')==True; assert is_valid_url('not-a-url')==False; print('PASS')`,
  },
  {
    complexity: 7,
    name: 'stats_pkg',
    category: 'python_pkg',
    files: 3,
    description: `MULTI-FILE PROJECT: Create 3 files in tasks/stats_pkg/

Step 1: Use file_write to create tasks/stats_pkg/__init__.py with:
from .stats import mean, median, std_dev

Step 2: Use file_write to create tasks/stats_pkg/stats.py with:
def mean(numbers):
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)

def median(numbers):
    if not numbers:
        return 0
    sorted_nums = sorted(numbers)
    n = len(sorted_nums)
    mid = n // 2
    if n % 2 == 0:
        return (sorted_nums[mid - 1] + sorted_nums[mid]) / 2
    return sorted_nums[mid]

def std_dev(numbers):
    if len(numbers) < 2:
        return 0
    avg = mean(numbers)
    variance = sum((x - avg) ** 2 for x in numbers) / len(numbers)
    return variance ** 0.5

Step 3: Verify by running: python -c "from tasks.stats_pkg import mean; print(mean([1,2,3]))"

You MUST call file_write at least 2 times.`,
    validation: `from tasks.stats_pkg import mean, median, std_dev; assert mean([1,2,3])==2.0; assert mean([10,20])==15.0; assert median([1,2,3])==2; assert median([1,2,3,4])==2.5; sd = std_dev([2,4,4,4,5,5,7,9]); assert abs(sd - 2.0) < 0.01; print('PASS')`,
  },
  {
    complexity: 8,
    name: 'matrix_pkg',
    category: 'python_pkg',
    files: 3,
    description: `MULTI-FILE PROJECT: Create 3 files in tasks/matrix_pkg/

Step 1: Use file_write to create tasks/matrix_pkg/__init__.py with:
from .matrix import Matrix

Step 2: Use file_write to create tasks/matrix_pkg/matrix.py with:
class Matrix:
    def __init__(self, data):
        self.data = data
        self.rows = len(data)
        self.cols = len(data[0]) if data else 0

    def add(self, other):
        result = []
        for i in range(self.rows):
            row = []
            for j in range(self.cols):
                row.append(self.data[i][j] + other.data[i][j])
            result.append(row)
        return Matrix(result)

    def multiply(self, other):
        result = []
        for i in range(self.rows):
            row = []
            for j in range(other.cols):
                total = 0
                for k in range(self.cols):
                    total += self.data[i][k] * other.data[k][j]
                row.append(total)
            result.append(row)
        return Matrix(result)

    def to_list(self):
        return self.data

Step 3: Verify by running: python -c "from tasks.matrix_pkg import Matrix; m=Matrix([[1,2],[3,4]]); print(m.to_list())"

You MUST call file_write at least 2 times.`,
    validation: `from tasks.matrix_pkg import Matrix; a=Matrix([[1,2],[3,4]]); b=Matrix([[5,6],[7,8]]); c=a.add(b); assert c.to_list()==[[6,8],[10,12]]; d=a.multiply(b); assert d.to_list()==[[19,22],[43,50]]; print('PASS')`,
  },
  {
    complexity: 8,
    name: 'text_proc',
    category: 'python_pkg',
    files: 3,
    description: `MULTI-FILE PROJECT: Create 3 files in tasks/text_proc/

Step 1: Use file_write to create tasks/text_proc/__init__.py with:
from .tokenizer import tokenize
from .analyzer import word_frequency, top_words

Step 2: Use file_write to create tasks/text_proc/tokenizer.py with:
import re

def tokenize(text):
    text = text.lower()
    tokens = re.findall(r'[a-z]+', text)
    return tokens

Step 3: Use file_write to create tasks/text_proc/analyzer.py with:
from .tokenizer import tokenize

def word_frequency(text):
    tokens = tokenize(text)
    freq = {}
    for token in tokens:
        freq[token] = freq.get(token, 0) + 1
    return freq

def top_words(text, n=3):
    freq = word_frequency(text)
    sorted_words = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return sorted_words[:n]

Step 4: Verify by running: python -c "from tasks.text_proc import tokenize, top_words; print(tokenize('Hello World')); print(top_words('the cat and the dog'))"

You MUST call file_write 3 times to create all 3 files.`,
    validation: `from tasks.text_proc import tokenize, word_frequency, top_words; assert tokenize('Hello, World!')==['hello','world']; f=word_frequency('the cat and the dog'); assert f['the']==2; assert f['cat']==1; t=top_words('the cat and the dog the', 2); assert t[0]==('the',3); print('PASS')`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CATEGORY 2: Python CLI Tools (4 tasks, C6-C8)
  // Packages with importable functions
  // ─────────────────────────────────────────────────────────────────────────────
  {
    complexity: 6,
    name: 'passgen',
    category: 'python_cli',
    files: 2,
    description: `MULTI-FILE PROJECT: Create 2 files in tasks/passgen/

Step 1: Use file_write to create tasks/passgen/__init__.py with:
from .generator import generate_password

Step 2: Use file_write to create tasks/passgen/generator.py with:
import random
import string

def generate_password(length=12, use_digits=True, use_special=True):
    chars = string.ascii_letters
    if use_digits:
        chars += string.digits
    if use_special:
        chars += '!@#$%^&*'
    password = ''.join(random.choice(chars) for _ in range(length))
    return password

Step 3: Verify by running: python -c "from tasks.passgen import generate_password; p=generate_password(16); print(len(p), p)"

You MUST call file_write 2 times.`,
    validation: `from tasks.passgen import generate_password; p=generate_password(20); assert len(p)==20; p2=generate_password(8, use_digits=False, use_special=False); assert len(p2)==8; assert p2.isalpha(); print('PASS')`,
  },
  {
    complexity: 7,
    name: 'csv_tool',
    category: 'python_cli',
    files: 2,
    description: `MULTI-FILE PROJECT: Create 2 files in tasks/csv_tool/

Step 1: Use file_write to create tasks/csv_tool/__init__.py with:
from .parser import parse_csv, to_csv

Step 2: Use file_write to create tasks/csv_tool/parser.py with:
def parse_csv(text, delimiter=','):
    lines = text.strip().split('\\n')
    if not lines:
        return []
    headers = [h.strip() for h in lines[0].split(delimiter)]
    rows = []
    for line in lines[1:]:
        values = [v.strip() for v in line.split(delimiter)]
        row = {}
        for i, header in enumerate(headers):
            row[header] = values[i] if i < len(values) else ''
        rows.append(row)
    return rows

def to_csv(rows, delimiter=','):
    if not rows:
        return ''
    headers = list(rows[0].keys())
    lines = [delimiter.join(headers)]
    for row in rows:
        lines.append(delimiter.join(str(row.get(h, '')) for h in headers))
    return '\\n'.join(lines)

Step 3: Verify by running: python -c "from tasks.csv_tool import parse_csv; print(parse_csv('name,age\\nAlice,30'))"

You MUST call file_write 2 times.`,
    validation: `from tasks.csv_tool import parse_csv, to_csv; rows=parse_csv('name,age\\nAlice,30\\nBob,25'); assert len(rows)==2; assert rows[0]['name']=='Alice'; assert rows[1]['age']=='25'; csv=to_csv([{'a':'1','b':'2'}]); assert 'a,b' in csv; assert '1,2' in csv; print('PASS')`,
  },
  {
    complexity: 7,
    name: 'md_convert',
    category: 'python_cli',
    files: 2,
    description: `MULTI-FILE PROJECT: Create 2 files in tasks/md_convert/

Step 1: Use file_write to create tasks/md_convert/__init__.py with:
from .converter import md_to_html

Step 2: Use file_write to create tasks/md_convert/converter.py with:
import re

def md_to_html(md):
    lines = md.split('\\n')
    html_lines = []
    for line in lines:
        # Headers
        if line.startswith('### '):
            html_lines.append(f'<h3>{line[4:]}</h3>')
        elif line.startswith('## '):
            html_lines.append(f'<h2>{line[3:]}</h2>')
        elif line.startswith('# '):
            html_lines.append(f'<h1>{line[2:]}</h1>')
        else:
            # Bold
            line = re.sub(r'\\*\\*(.+?)\\*\\*', r'<strong>\\1</strong>', line)
            # Italic
            line = re.sub(r'\\*(.+?)\\*', r'<em>\\1</em>', line)
            # Code
            line = re.sub(r'` + '`(.+?)`' + `', r'<code>\\1</code>', line)
            if line.strip():
                html_lines.append(f'<p>{line}</p>')
    return '\\n'.join(html_lines)

Step 3: Verify by running: python -c "from tasks.md_convert import md_to_html; print(md_to_html('# Hello'))"

You MUST call file_write 2 times.`,
    validation: `from tasks.md_convert import md_to_html; assert md_to_html('# Hello')=='<h1>Hello</h1>'; assert md_to_html('## Sub')=='<h2>Sub</h2>'; h=md_to_html('**bold**'); assert '<strong>bold</strong>' in h; print('PASS')`,
  },
  {
    complexity: 8,
    name: 'json_valid',
    category: 'python_cli',
    files: 2,
    description: `MULTI-FILE PROJECT: Create 2 files in tasks/json_valid/

Step 1: Use file_write to create tasks/json_valid/__init__.py with:
from .validator import validate

Step 2: Use file_write to create tasks/json_valid/validator.py with:
def validate(data, schema):
    errors = []
    for field, rules in schema.items():
        required = rules.get('required', False)
        field_type = rules.get('type')
        if field not in data:
            if required:
                errors.append(f"Missing required field: {field}")
            continue
        value = data[field]
        if field_type == 'string' and not isinstance(value, str):
            errors.append(f"{field} must be a string")
        elif field_type == 'int' and not isinstance(value, int):
            errors.append(f"{field} must be an int")
        elif field_type == 'float' and not isinstance(value, (int, float)):
            errors.append(f"{field} must be a float")
        elif field_type == 'bool' and not isinstance(value, bool):
            errors.append(f"{field} must be a bool")
        if 'min' in rules and isinstance(value, (int, float)):
            if value < rules['min']:
                errors.append(f"{field} must be >= {rules['min']}")
        if 'max_length' in rules and isinstance(value, str):
            if len(value) > rules['max_length']:
                errors.append(f"{field} exceeds max length {rules['max_length']}")
    return errors

Step 3: Verify by running: python -c "from tasks.json_valid import validate; print(validate({'name':'A'}, {'name':{'type':'string','required':True}}))"

You MUST call file_write 2 times.`,
    validation: `from tasks.json_valid import validate; e1=validate({'name':'Alice','age':30}, {'name':{'type':'string','required':True},'age':{'type':'int','required':True}}); assert e1==[]; e2=validate({}, {'name':{'type':'string','required':True}}); assert len(e2)==1; assert 'Missing' in e2[0]; e3=validate({'age':'bad'}, {'age':{'type':'int','required':True}}); assert len(e3)==1; print('PASS')`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CATEGORY 3: Landing Pages (4 tasks, C6-C8)
  // HTML + CSS (+ JS for countdown). Validated by reading HTML with Python.
  // ─────────────────────────────────────────────────────────────────────────────
  {
    complexity: 7,
    name: 'coffee_landing',
    category: 'landing_page',
    files: 2,
    description: `MULTI-FILE PROJECT: Create 2 files in tasks/coffee_landing/

Step 1: Use file_write to create tasks/coffee_landing/index.html with a coffee shop landing page:
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Coffee Shop</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <h1>Brew & Bean</h1>
        <nav><a href="#menu">Menu</a> <a href="#about">About</a></nav>
    </header>
    <section id="menu">
        <h2>Our Menu</h2>
        <div class="menu-item"><h3>Espresso</h3><p>$3.50</p></div>
        <div class="menu-item"><h3>Latte</h3><p>$4.50</p></div>
        <div class="menu-item"><h3>Cappuccino</h3><p>$4.00</p></div>
    </section>
    <section id="about">
        <h2>About Us</h2>
        <p>Fresh roasted coffee since 2020.</p>
    </section>
    <footer><p>© 2026 Brew & Bean</p></footer>
</body>
</html>

Step 2: Use file_write to create tasks/coffee_landing/style.css with basic styling:
body { font-family: sans-serif; margin: 0; padding: 0; }
header { background: #4a2c2a; color: white; padding: 20px; text-align: center; }
nav a { color: #f0d9b5; margin: 0 10px; text-decoration: none; }
.menu-item { border: 1px solid #ccc; padding: 10px; margin: 10px; display: inline-block; }
footer { background: #333; color: white; text-align: center; padding: 10px; }

You MUST call file_write 2 times.`,
    validation: `h=open('/app/workspace/tasks/coffee_landing/index.html').read(); assert '<html' in h; assert 'menu-item' in h; assert 'Espresso' in h; assert 'style.css' in h; import os; assert os.path.exists('/app/workspace/tasks/coffee_landing/style.css'); print('PASS')`,
  },
  {
    complexity: 7,
    name: 'portfolio_page',
    category: 'landing_page',
    files: 2,
    description: `MULTI-FILE PROJECT: Create 2 files in tasks/portfolio_page/

Step 1: Use file_write to create tasks/portfolio_page/index.html with a portfolio page:
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Portfolio</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <h1>Jane Developer</h1>
        <p class="subtitle">Full-Stack Engineer</p>
    </header>
    <section id="projects">
        <h2>Projects</h2>
        <div class="project-card"><h3>TaskManager</h3><p>A React task management app</p></div>
        <div class="project-card"><h3>ChatBot</h3><p>AI-powered chat assistant</p></div>
        <div class="project-card"><h3>DataViz</h3><p>D3.js data visualization tool</p></div>
    </section>
    <section id="contact">
        <h2>Contact</h2>
        <p>Email: jane@example.com</p>
    </section>
</body>
</html>

Step 2: Use file_write to create tasks/portfolio_page/style.css with styling:
body { font-family: 'Segoe UI', sans-serif; margin: 0; background: #f5f5f5; }
header { background: #2c3e50; color: white; padding: 40px; text-align: center; }
.subtitle { color: #bdc3c7; }
#projects { padding: 20px; text-align: center; }
.project-card { background: white; border-radius: 8px; padding: 20px; margin: 10px; display: inline-block; width: 200px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
#contact { padding: 20px; text-align: center; }

You MUST call file_write 2 times.`,
    validation: `h=open('/app/workspace/tasks/portfolio_page/index.html').read(); assert '<html' in h; assert 'project-card' in h; assert 'TaskManager' in h; assert 'style.css' in h; import os; assert os.path.exists('/app/workspace/tasks/portfolio_page/style.css'); print('PASS')`,
  },
  {
    complexity: 6,
    name: 'newsletter_page',
    category: 'landing_page',
    files: 2,
    description: `MULTI-FILE PROJECT: Create 2 files in tasks/newsletter_page/

Step 1: Use file_write to create tasks/newsletter_page/index.html with a newsletter signup page:
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Newsletter</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>Stay Updated</h1>
        <p>Get the latest news delivered to your inbox.</p>
        <form id="signup-form">
            <input type="email" id="email-input" placeholder="your@email.com" required>
            <button type="submit" id="subscribe-btn">Subscribe</button>
        </form>
        <p class="disclaimer">We respect your privacy. Unsubscribe anytime.</p>
    </div>
</body>
</html>

Step 2: Use file_write to create tasks/newsletter_page/style.css with styling:
body { font-family: sans-serif; background: #eef2f7; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
.container { background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
h1 { color: #333; }
input[type="email"] { padding: 10px; width: 80%; border: 1px solid #ccc; border-radius: 4px; margin: 10px 0; }
button { background: #3498db; color: white; padding: 10px 24px; border: none; border-radius: 4px; cursor: pointer; }
.disclaimer { font-size: 12px; color: #999; }

You MUST call file_write 2 times.`,
    validation: `h=open('/app/workspace/tasks/newsletter_page/index.html').read(); assert '<html' in h; assert 'signup-form' in h; assert 'email-input' in h; assert 'subscribe-btn' in h; assert 'style.css' in h; import os; assert os.path.exists('/app/workspace/tasks/newsletter_page/style.css'); print('PASS')`,
  },
  {
    complexity: 8,
    name: 'countdown_page',
    category: 'landing_page',
    files: 3,
    description: `MULTI-FILE PROJECT: Create 3 files in tasks/countdown_page/

Step 1: Use file_write to create tasks/countdown_page/index.html with:
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Product Launch</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>Something Big is Coming</h1>
        <div id="countdown">
            <div class="time-box"><span id="days">00</span><label>Days</label></div>
            <div class="time-box"><span id="hours">00</span><label>Hours</label></div>
            <div class="time-box"><span id="minutes">00</span><label>Minutes</label></div>
            <div class="time-box"><span id="seconds">00</span><label>Seconds</label></div>
        </div>
        <p class="tagline">Stay tuned for our biggest launch yet.</p>
    </div>
    <script src="countdown.js"></script>
</body>
</html>

Step 2: Use file_write to create tasks/countdown_page/style.css with:
body { font-family: sans-serif; background: #1a1a2e; color: white; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
.container { text-align: center; }
#countdown { display: flex; gap: 20px; justify-content: center; margin: 30px 0; }
.time-box { background: #16213e; padding: 20px; border-radius: 8px; min-width: 80px; }
.time-box span { font-size: 2em; display: block; }
.time-box label { font-size: 0.8em; color: #a0a0a0; }
.tagline { color: #a0a0a0; }

Step 3: Use file_write to create tasks/countdown_page/countdown.js with:
function updateCountdown() {
    var target = new Date();
    target.setDate(target.getDate() + 30);
    var now = new Date();
    var diff = target - now;
    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((diff % (1000 * 60)) / 1000);
    document.getElementById('days').textContent = String(days).padStart(2, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
}
updateCountdown();
setInterval(updateCountdown, 1000);

You MUST call file_write 3 times to create all 3 files.`,
    validation: `h=open('/app/workspace/tasks/countdown_page/index.html').read(); assert '<html' in h; assert 'countdown' in h; assert 'time-box' in h; assert 'countdown.js' in h; import os; assert os.path.exists('/app/workspace/tasks/countdown_page/style.css'); assert os.path.exists('/app/workspace/tasks/countdown_page/countdown.js'); print('PASS')`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CATEGORY 4: Node.js Utilities (4 tasks, C6-C8)
  // CommonJS modules with index.js re-exporting
  // ─────────────────────────────────────────────────────────────────────────────
  {
    complexity: 6,
    name: 'config_parser',
    category: 'nodejs',
    files: 2,
    description: `MULTI-FILE PROJECT: Create 2 files in tasks/config_parser/

Step 1: Use file_write to create tasks/config_parser/index.js with:
const { parseJSON, parseEnv } = require('./parsers');
module.exports = { parseJSON, parseEnv };

Step 2: Use file_write to create tasks/config_parser/parsers.js with:
function parseJSON(text) {
    try {
        return { success: true, data: JSON.parse(text) };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function parseEnv(text) {
    var result = {};
    var lines = text.split('\\n');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;
        var eqIdx = line.indexOf('=');
        if (eqIdx === -1) continue;
        var key = line.substring(0, eqIdx).trim();
        var value = line.substring(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}

module.exports = { parseJSON, parseEnv };

Step 3: Verify by running: node -e "var c=require('./tasks/config_parser'); console.log(c.parseJSON('{\"a\":1}'))"

You MUST call file_write 2 times.`,
    validation: `var c=require('./tasks/config_parser'); var r=c.parseJSON('{"a":1}'); if(!r.success||r.data.a!==1) process.exit(1); var e=c.parseEnv('KEY=value\\nDB=postgres'); if(e.KEY!=='value'||e.DB!=='postgres') process.exit(1); var bad=c.parseJSON('not json'); if(bad.success!==false) process.exit(1); console.log('PASS')`,
  },
  {
    complexity: 7,
    name: 'collection_utils',
    category: 'nodejs',
    files: 3,
    description: `MULTI-FILE PROJECT: Create 3 files in tasks/collection_utils/

Step 1: Use file_write to create tasks/collection_utils/index.js with:
const { chunk, unique } = require('./arrays');
const { pick, omit } = require('./objects');
module.exports = { chunk, unique, pick, omit };

Step 2: Use file_write to create tasks/collection_utils/arrays.js with:
function chunk(arr, size) {
    var result = [];
    for (var i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
}

function unique(arr) {
    var seen = {};
    var result = [];
    for (var i = 0; i < arr.length; i++) {
        var key = String(arr[i]);
        if (!seen[key]) {
            seen[key] = true;
            result.push(arr[i]);
        }
    }
    return result;
}

module.exports = { chunk, unique };

Step 3: Use file_write to create tasks/collection_utils/objects.js with:
function pick(obj, keys) {
    var result = {};
    for (var i = 0; i < keys.length; i++) {
        if (obj.hasOwnProperty(keys[i])) {
            result[keys[i]] = obj[keys[i]];
        }
    }
    return result;
}

function omit(obj, keys) {
    var result = {};
    var omitSet = {};
    for (var i = 0; i < keys.length; i++) omitSet[keys[i]] = true;
    var allKeys = Object.keys(obj);
    for (var j = 0; j < allKeys.length; j++) {
        if (!omitSet[allKeys[j]]) {
            result[allKeys[j]] = obj[allKeys[j]];
        }
    }
    return result;
}

module.exports = { pick, omit };

You MUST call file_write 3 times to create all 3 files.`,
    validation: `var c=require('./tasks/collection_utils'); var ch=c.chunk([1,2,3,4,5],2); if(JSON.stringify(ch)!==JSON.stringify([[1,2],[3,4],[5]])) process.exit(1); var u=c.unique([1,2,2,3,3]); if(JSON.stringify(u)!==JSON.stringify([1,2,3])) process.exit(1); var p=c.pick({a:1,b:2,c:3},['a','c']); if(p.a!==1||p.c!==3||p.b!==undefined) process.exit(1); var o=c.omit({a:1,b:2,c:3},['b']); if(o.a!==1||o.c!==3||o.b!==undefined) process.exit(1); console.log('PASS')`,
  },
  {
    complexity: 8,
    name: 'event_emitter',
    category: 'nodejs',
    files: 2,
    description: `MULTI-FILE PROJECT: Create 2 files in tasks/event_emitter/

Step 1: Use file_write to create tasks/event_emitter/index.js with:
const EventEmitter = require('./emitter');
module.exports = EventEmitter;

Step 2: Use file_write to create tasks/event_emitter/emitter.js with:
function EventEmitter() {
    this._listeners = {};
}

EventEmitter.prototype.on = function(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push({ fn: fn, once: false });
    return this;
};

EventEmitter.prototype.once = function(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push({ fn: fn, once: true });
    return this;
};

EventEmitter.prototype.off = function(event, fn) {
    if (!this._listeners[event]) return this;
    this._listeners[event] = this._listeners[event].filter(function(l) { return l.fn !== fn; });
    return this;
};

EventEmitter.prototype.emit = function(event) {
    if (!this._listeners[event]) return this;
    var args = Array.prototype.slice.call(arguments, 1);
    var remaining = [];
    for (var i = 0; i < this._listeners[event].length; i++) {
        var listener = this._listeners[event][i];
        listener.fn.apply(null, args);
        if (!listener.once) remaining.push(listener);
    }
    this._listeners[event] = remaining;
    return this;
};

module.exports = EventEmitter;

You MUST call file_write 2 times.`,
    validation: `var EE=require('./tasks/event_emitter'); var e=new EE(); var count=0; function inc(){count++} e.on('test',inc); e.emit('test'); e.emit('test'); if(count!==2) process.exit(1); e.off('test',inc); e.emit('test'); if(count!==2) process.exit(1); var once=0; e.once('x',function(){once++}); e.emit('x'); e.emit('x'); if(once!==1) process.exit(1); console.log('PASS')`,
  },
  {
    complexity: 8,
    name: 'template_engine',
    category: 'nodejs',
    files: 2,
    description: `MULTI-FILE PROJECT: Create 2 files in tasks/template_engine/

Step 1: Use file_write to create tasks/template_engine/index.js with:
const { render } = require('./engine');
module.exports = { render };

Step 2: Use file_write to create tasks/template_engine/engine.js with:
function render(template, data) {
    var result = template;
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var pattern = new RegExp('\\\\{\\\\{\\\\s*' + key + '\\\\s*\\\\}\\\\}', 'g');
        result = result.replace(pattern, String(data[key]));
    }
    return result;
}

module.exports = { render };

Step 3: Verify by running: node -e "var t=require('./tasks/template_engine'); console.log(t.render('Hello {{name}}!', {name:'World'}))"

You MUST call file_write 2 times.`,
    validation: `var t=require('./tasks/template_engine'); var r=t.render('Hello {{name}}, you are {{age}}!',{name:'Alice',age:30}); if(r!=='Hello Alice, you are 30!') process.exit(1); var r2=t.render('{{a}} and {{b}}',{a:'X',b:'Y'}); if(r2!=='X and Y') process.exit(1); console.log('PASS')`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CATEGORY 5: Bonus Python (2 tasks, C6-C7)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    complexity: 7,
    name: 'todo_model',
    category: 'bonus_python',
    files: 3,
    description: `MULTI-FILE PROJECT: Create 3 files in tasks/todo_model/

Step 1: Use file_write to create tasks/todo_model/__init__.py with:
from .todo import Todo
from .store import TodoStore

Step 2: Use file_write to create tasks/todo_model/todo.py with:
class Todo:
    def __init__(self, title, done=False):
        self.title = title
        self.done = done

    def toggle(self):
        self.done = not self.done

    def to_dict(self):
        return {'title': self.title, 'done': self.done}

Step 3: Use file_write to create tasks/todo_model/store.py with:
from .todo import Todo

class TodoStore:
    def __init__(self):
        self._todos = []
        self._next_id = 1

    def add(self, title):
        todo = Todo(title)
        self._todos.append((self._next_id, todo))
        self._next_id += 1
        return self._next_id - 1

    def get(self, todo_id):
        for tid, todo in self._todos:
            if tid == todo_id:
                return todo
        return None

    def remove(self, todo_id):
        self._todos = [(tid, t) for tid, t in self._todos if tid != todo_id]

    def list_all(self):
        return [(tid, t.to_dict()) for tid, t in self._todos]

Step 4: Verify by running: python -c "from tasks.todo_model import TodoStore; s=TodoStore(); s.add('test'); print(s.list_all())"

You MUST call file_write 3 times.`,
    validation: `from tasks.todo_model import Todo, TodoStore; t=Todo('Buy milk'); assert t.title=='Buy milk'; assert t.done==False; t.toggle(); assert t.done==True; s=TodoStore(); id1=s.add('Task A'); id2=s.add('Task B'); assert len(s.list_all())==2; assert s.get(id1).title=='Task A'; s.remove(id1); assert len(s.list_all())==1; print('PASS')`,
  },
  {
    complexity: 6,
    name: 'color_conv',
    category: 'bonus_python',
    files: 2,
    description: `MULTI-FILE PROJECT: Create 2 files in tasks/color_conv/

Step 1: Use file_write to create tasks/color_conv/__init__.py with:
from .converter import hex_to_rgb, rgb_to_hex

Step 2: Use file_write to create tasks/color_conv/converter.py with:
def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    r = int(hex_str[0:2], 16)
    g = int(hex_str[2:4], 16)
    b = int(hex_str[4:6], 16)
    return (r, g, b)

def rgb_to_hex(r, g, b):
    return '#{:02x}{:02x}{:02x}'.format(r, g, b)

Step 3: Verify by running: python -c "from tasks.color_conv import hex_to_rgb, rgb_to_hex; print(hex_to_rgb('#ff0000')); print(rgb_to_hex(255,0,0))"

You MUST call file_write 2 times.`,
    validation: `from tasks.color_conv import hex_to_rgb, rgb_to_hex; assert hex_to_rgb('#ff0000')==(255,0,0); assert hex_to_rgb('#00ff00')==(0,255,0); assert hex_to_rgb('0000ff')==(0,0,255); assert rgb_to_hex(255,0,0)=='#ff0000'; assert rgb_to_hex(0,255,0)=='#00ff00'; print('PASS')`,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

// Directories to clean up before/after test
const TASK_DIRS = TASKS.map(t => t.name);

async function resetSystem() {
  console.log('\u{1f504} Resetting system...');

  try {
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    console.log('   \u2713 Agents reset');
  } catch (e) {
    console.log('   \u26a0 Could not reset agents');
  }

  // Clean up task subdirectories (use for loop to avoid Windows shell quoting issues)
  try {
    const { execSync } = require('child_process');
    const dirList = TASK_DIRS.join(' ');
    execSync(`docker exec abcc-agents sh -c "for d in ${dirList}; do rm -rf /app/workspace/tasks/\\$d; done; touch /app/workspace/tasks/__init__.py"`, { stdio: 'pipe' });
    console.log('   \u2713 Workspace cleaned (' + TASK_DIRS.length + ' directories)');
  } catch (e) {
    console.log('   \u26a0 Could not clean workspace: ' + e.message);
  }

  await sleep(2000);
}

async function createTask(task) {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      title: `[APPS-C${task.complexity}] ${task.name} (${task.files} files)`,
      description: task.description,
      expectedOutput: `${task.files} files created in tasks/${task.name}/`,
      taskType: 'code',
      priority: task.complexity,
      maxIterations: MAX_ITERATIONS,
      validationCommand: task.validation
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.status}`);
  }

  return response.json();
}

function getOllamaModel(complexity) {
  if (complexity >= 7) return 'qwen2.5-coder:16k';
  return 'qwen2.5-coder:8k';
}

async function executeTask(taskId, description, complexity) {
  const model = getOllamaModel(complexity);
  console.log(`   Model: ${model} | maxIter: ${MAX_ITERATIONS}`);
  const response = await fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      task_id: taskId,
      agent_id: 'coder-01',
      task_description: description,
      use_claude: false,
      model: model
    })
  });

  return response;
}

async function waitForAgent(maxWaitMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/agents/coder-01`, { headers: { 'X-API-Key': API_KEY } });
      const agent = await response.json();
      if (agent.status === 'idle') return true;
    } catch (e) {}
    await sleep(1000);
  }
  return false;
}

async function runValidation(task) {
  try {
    const { execSync } = require('child_process');
    let cmd;

    if (task.category === 'nodejs') {
      // Node.js validation runs with node -e
      cmd = `docker exec -w /app/workspace abcc-agents node -e "${task.validation.replace(/"/g, '\\"')}"`;
    } else {
      // Base64-encode Python validation to avoid shell escaping issues with <, ', /, etc.
      const b64 = Buffer.from(task.validation).toString('base64');
      cmd = `docker exec -w /app/workspace abcc-agents python3 -c "import base64; exec(base64.b64decode('${b64}').decode())"`;
    }

    const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
    return result.includes('PASS');
  } catch (e) {
    return false;
  }
}

function getComplexityColor(c) {
  if (c <= 4) return '\x1b[36m';  // Cyan
  if (c <= 6) return '\x1b[33m';  // Yellow
  if (c <= 8) return '\x1b[35m';  // Magenta
  return '\x1b[31m';              // Red
}

function getCategoryLabel(cat) {
  const labels = {
    python_pkg: '\u{1f40d} PY-PKG',
    python_cli: '\u{1f6e0}\ufe0f  PY-CLI',
    landing_page: '\u{1f310} HTML',
    nodejs: '\u{1f7e2} NODE',
    bonus_python: '\u{2b50} BONUS',
  };
  return labels[cat] || cat;
}

const RST = '\x1b[0m';

async function main() {
  console.log('\u2550'.repeat(70));
  console.log('\u{1f3d7}\ufe0f  MULTI-FILE APPS STRESS TEST - 20 TASKS (C6-C8)');
  console.log('\u2550'.repeat(70));
  console.log('Model: Dynamic (8K/16K by complexity) | Multi-file mini-projects');
  console.log(`Tasks: ${TASKS.length} | Files: ${TASKS.reduce((s, t) => s + t.files, 0)} total | maxIter: ${MAX_ITERATIONS}`);
  console.log(`Rest: ${REST_DELAY_MS / 1000}s between tasks | Reset every ${RESET_EVERY_N_TASKS} tasks`);
  console.log('');
  console.log('Categories:');
  console.log('  \u{1f40d} Python Packages (6)  | \u{1f6e0}\ufe0f  Python CLI Tools (4)');
  console.log('  \u{1f310} Landing Pages (4)    | \u{1f7e2} Node.js Utilities (4)');
  console.log('  \u{2b50} Bonus Python (2)');
  console.log('\u2550'.repeat(70) + '\n');

  await resetSystem();

  const results = {
    total: TASKS.length,
    passed: 0,
    failed: 0,
    errors: 0,
    model: 'dynamic (8K/16K)',
    byComplexity: {},
    byCategory: {},
    details: []
  };

  // Initialize complexity buckets
  for (let c = 6; c <= 8; c++) {
    results.byComplexity[c] = { total: 0, passed: 0, failed: 0 };
  }

  // Initialize category buckets
  const categories = ['python_pkg', 'python_cli', 'landing_page', 'nodejs', 'bonus_python'];
  for (const cat of categories) {
    results.byCategory[cat] = { total: 0, passed: 0, failed: 0 };
  }

  const startTime = Date.now();

  for (let i = 0; i < TASKS.length; i++) {
    const task = TASKS[i];
    const taskNum = i + 1;
    const color = getComplexityColor(task.complexity);
    const catLabel = getCategoryLabel(task.category);

    console.log(`\n[${taskNum}/${TASKS.length}] ${color}C${task.complexity}${RST} ${catLabel} ${task.name} (${task.files} files)`);
    console.log('\u2500'.repeat(50));

    const taskStart = Date.now();
    let status = 'error';
    let error = null;

    results.byComplexity[task.complexity].total++;
    results.byCategory[task.category].total++;

    try {
      const created = await createTask(task);
      console.log(`   Created: ${created.id.substring(0, 8)}...`);

      await fetch(`${API_BASE}/queue/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ taskId: created.id, agentId: 'coder-01' })
      });

      console.log('   Executing with Ollama...');
      const execResponse = await executeTask(created.id, task.description, task.complexity);
      const duration = Math.floor((Date.now() - taskStart) / 1000);

      if (!execResponse.ok) {
        throw new Error(`Execution failed: ${(await execResponse.text()).substring(0, 100)}`);
      }

      // Extract only success flag
      const execJson = await execResponse.json();
      const execSuccess = Boolean(execJson.success);

      await fetch(`${API_BASE}/tasks/${created.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ success: execSuccess })
      });

      console.log('   Validating...');
      const passed = await runValidation(task);

      if (passed) {
        status = 'passed';
        results.passed++;
        results.byComplexity[task.complexity].passed++;
        results.byCategory[task.category].passed++;
        console.log(`   ${color}\u2705 PASSED${RST} (${duration}s)`);
      } else {
        status = 'failed';
        results.failed++;
        results.byComplexity[task.complexity].failed++;
        results.byCategory[task.category].failed++;
        console.log(`   ${color}\u274c FAILED${RST} - validation failed (${duration}s)`);
      }

      await waitForAgent();

    } catch (e) {
      error = e.message;
      results.errors++;
      results.byComplexity[task.complexity].failed++;
      results.byCategory[task.category].failed++;
      console.log(`   \u{1f4a5} ERROR: ${e.message.substring(0, 80)}`);

      try {
        await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
      } catch (resetErr) {}

      await sleep(2000);
    }

    results.details.push({
      task: task.name,
      category: task.category,
      complexity: task.complexity,
      files: task.files,
      status,
      error,
      duration: Math.floor((Date.now() - taskStart) / 1000)
    });

    // Rest delay
    if (i < TASKS.length - 1) {
      console.log(`   \u{1f4a4} Resting ${REST_DELAY_MS / 1000}s...`);
      await sleep(REST_DELAY_MS);
    }

    // Aggressive reset every N tasks
    if ((i + 1) % RESET_EVERY_N_TASKS === 0 && i < TASKS.length - 1) {
      console.log(`\n\u{1f504} Resetting agent (clearing context after ${RESET_EVERY_N_TASKS} tasks)...`);
      try {
        await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
        console.log('   \u2713 Agent memory cleared\n');
      } catch (e) {
        console.log('   \u26a0 Could not reset agent\n');
      }
      await sleep(1000);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════════════════════════
  const totalDuration = Math.floor((Date.now() - startTime) / 1000);
  const successRate = Math.round((results.passed / results.total) * 100);

  console.log('\n' + '\u2550'.repeat(70));
  console.log('\u{1f4ca} MULTI-FILE APPS STRESS TEST RESULTS');
  console.log('\u2550'.repeat(70));
  console.log(`   Total:    ${results.passed}/${results.total} passed (${successRate}%)`);
  console.log(`   Failed:   ${results.failed} | Errors: ${results.errors}`);
  console.log(`   Duration: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);

  // By category
  console.log('\n\u{1f4c1} SUCCESS RATE BY CATEGORY:');
  console.log('\u2500'.repeat(50));
  for (const cat of categories) {
    const stats = results.byCategory[cat];
    if (stats.total === 0) continue;
    const rate = Math.round((stats.passed / stats.total) * 100);
    const bar = '\u2588'.repeat(Math.floor(rate / 10)) + '\u2591'.repeat(10 - Math.floor(rate / 10));
    const label = getCategoryLabel(cat).padEnd(12);
    console.log(`   ${label} ${bar} ${rate}% (${stats.passed}/${stats.total})`);
  }

  // By complexity
  console.log('\n\u{1f4c8} SUCCESS RATE BY COMPLEXITY:');
  console.log('\u2500'.repeat(50));
  for (let c = 6; c <= 8; c++) {
    const stats = results.byComplexity[c];
    if (stats.total === 0) continue;
    const rate = Math.round((stats.passed / stats.total) * 100);
    const bar = '\u2588'.repeat(Math.floor(rate / 10)) + '\u2591'.repeat(10 - Math.floor(rate / 10));
    const color = getComplexityColor(c);
    console.log(`   C${c}: ${color}${bar}${RST} ${rate}% (${stats.passed}/${stats.total})`);
  }

  // Timing breakdown
  console.log('\n\u23f1\ufe0f  TIMING BY CATEGORY:');
  console.log('\u2500'.repeat(50));
  for (const cat of categories) {
    const taskTimes = results.details.filter(d => d.category === cat && d.status === 'passed');
    if (taskTimes.length === 0) continue;
    const avg = Math.round(taskTimes.reduce((s, t) => s + t.duration, 0) / taskTimes.length);
    const max = Math.max(...taskTimes.map(t => t.duration));
    const min = Math.min(...taskTimes.map(t => t.duration));
    const label = getCategoryLabel(cat).padEnd(12);
    console.log(`   ${label} avg ${avg}s | min ${min}s | max ${max}s (${taskTimes.length} passed)`);
  }

  // Failures detail
  const failures = results.details.filter(d => d.status !== 'passed');
  if (failures.length > 0) {
    console.log('\n\u274c FAILURES:');
    console.log('\u2500'.repeat(50));
    for (const f of failures) {
      console.log(`   ${getCategoryLabel(f.category)} ${f.name} (C${f.complexity}) - ${f.status}${f.error ? ': ' + f.error.substring(0, 60) : ''}`);
    }
  }

  console.log('\u2550'.repeat(70));

  // Save results
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const resultsFile = `scripts/apps-results-${timestamp}.json`;
  fs.writeFileSync(
    resultsFile,
    JSON.stringify({
      ...results,
      totalDuration,
      successRate,
      timestamp: new Date().toISOString(),
      config: {
        maxIterations: MAX_ITERATIONS,
        restDelay: REST_DELAY_MS,
        resetEvery: RESET_EVERY_N_TASKS,
        taskTimeout: TASK_TIMEOUT_MS,
      }
    }, null, 2)
  );
  console.log(`\n\u{1f4be} Results saved to ${resultsFile}`);

  return results;
}

main()
  .then(results => process.exit(results.failed + results.errors > 0 ? 1 : 0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
