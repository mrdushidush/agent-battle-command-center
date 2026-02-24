#!/usr/bin/env node

/**
 * Ultimate 100-Task Stress Test
 *
 * Validates the full pipeline at scale: decomposition, multi-file code generation,
 * security, multi-language. A 95%+ pass rate proves production readiness.
 *
 * Sections (100 tasks):
 *   Section 1: React App (20) — 10 pre-decomposed + 10 CTO decomposed
 *   Section 2: Landing Pages (15) — 3 sites × 5 pages each
 *   Section 3: Web Server (25) — 13 Python + 12 Node.js stdlib APIs
 *   Section 4: Security (20) — 10 secure coding + 10 bug fixes
 *   Section 5: Bonus (20) — 5 TS + 5 Go + 5 Py data + 5 mini projects
 *
 * Usage:
 *   node scripts/ultimate-100-task-test.js                  # Full 100-task run
 *   node scripts/ultimate-100-task-test.js --skip-cto        # Skip CTO decomposition (90 tasks)
 *   node scripts/ultimate-100-task-test.js --section=3       # Run only Section 3
 *   node scripts/ultimate-100-task-test.js --dry-run         # Print task list, don't execute
 *   node scripts/ultimate-100-task-test.js --max=10          # Run first 10 tasks only
 *   node scripts/ultimate-100-task-test.js --no-retry        # Disable in-script retry
 */

const { execSync } = require('child_process');
const fs = require('fs');

// =============================================================================
// CONSTANTS
// =============================================================================

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || 'ceb3e905f7b1b5e899645c6ec467ca34';
const TASK_TIMEOUT_MS = 5 * 60 * 1000;
const REST_DELAY_MS = 3000;
const RESET_EVERY_N_TASKS = 3;
const MAX_ITERATIONS = 10;
const CTO_TIMEOUT_MS = 2 * 60 * 1000;

// =============================================================================
// CLI ARGS
// =============================================================================

const cliArgs = process.argv.slice(2);
const SKIP_CTO = cliArgs.includes('--skip-cto');
const DRY_RUN = cliArgs.includes('--dry-run');
const NO_RETRY = cliArgs.includes('--no-retry');
const SECTION_FILTER = (() => {
  const s = cliArgs.find(a => a.startsWith('--section='));
  return s ? parseInt(s.split('=')[1]) : null;
})();
const MAX_TASKS_LIMIT = (() => {
  const m = cliArgs.find(a => a.startsWith('--max='));
  return m ? parseInt(m.split('=')[1]) : null;
})();

if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
  console.log(`
Ultimate 100-Task Stress Test

Options:
  --skip-cto       Skip CTO decomposition tasks (run 90 tasks)
  --section=N      Run only section N (1-5)
  --dry-run        Print task list without executing
  --max=N          Run only first N tasks
  --no-retry       Disable in-script retry on failure
  --help           Show this help
`);
  process.exit(0);
}

// =============================================================================
// TASK DIRECTORIES (for cleanup)
// =============================================================================

const ALL_DIRS = [
  'react_taskmanager', 'react_weather', 'react_recipe',
  'coffee_landing_v2', 'saas_landing', 'portfolio_landing',
  'py_api_server', 'node_api_server',
  'security', 'security_fixes',
  'ts_utils', 'go_tools', 'py_data', 'mini_projects'
];

// =============================================================================
// SECTION 1A: REACT TASK MANAGER — 10 pre-decomposed tasks (C6-C8)
// Dir: tasks/react_taskmanager/
// =============================================================================

const SECTION_1A = [
  {
    name: 'tm_utils', section: 1, complexity: 6, category: 'react',
    dir: 'react_taskmanager', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/react_taskmanager/utils.js with this content:
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function formatDate(date) {
  var d = new Date(date);
  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function filterTasks(tasks, filter) {
  if (filter === 'active') return tasks.filter(function(t) { return !t.done; });
  if (filter === 'completed') return tasks.filter(function(t) { return t.done; });
  return tasks;
}

if (typeof module !== 'undefined') module.exports = { generateId, formatDate, filterTasks };

Step 2: Verify the file was created by reading it.

DO NOT just output the code - you MUST call file_write.`,
    validation: `var u=require('./tasks/react_taskmanager/utils'); if(typeof u.generateId()!=='string') process.exit(1); var d=u.formatDate('2026-01-15'); if(!d.includes('2026')) process.exit(1); var tasks=[{done:false},{done:true}]; if(u.filterTasks(tasks,'active').length!==1) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'tm_styles', section: 1, complexity: 6, category: 'react',
    dir: 'react_taskmanager', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/react_taskmanager/style.css with this content:
body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
.task-list { list-style: none; padding: 0; max-width: 600px; margin: 0 auto; }
.task-item { background: white; border: 1px solid #ddd; padding: 12px 16px; margin: 8px 0; border-radius: 6px; display: flex; align-items: center; gap: 12px; }
.task-item.completed { text-decoration: line-through; opacity: 0.6; }
.task-item input[type="checkbox"] { width: 18px; height: 18px; }
.task-item .delete-btn { margin-left: auto; background: #ff4444; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; }
.add-form { display: flex; gap: 8px; margin-bottom: 16px; max-width: 600px; margin-left: auto; margin-right: auto; }
.add-form input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; }
.add-form button { padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
.filter-bar { display: flex; gap: 4px; margin-bottom: 16px; max-width: 600px; margin-left: auto; margin-right: auto; }
.filter-bar button { padding: 6px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; }
.filter-bar button.active { background: #4CAF50; color: white; border-color: #4CAF50; }
.task-counter { text-align: center; color: #666; margin-bottom: 16px; }
@media (max-width: 600px) { .add-form { flex-direction: column; } .task-item { flex-direction: column; align-items: flex-start; } }

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/react_taskmanager/style.css').read(); assert '.task-list' in h or 'task-list' in h; assert '@media' in h; assert '.task-item' in h or 'task-item' in h; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'tm_task_item', section: 1, complexity: 6, category: 'react',
    dir: 'react_taskmanager', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/react_taskmanager/TaskItem.jsx with:
function TaskItem(props) {
  var task = props.task;
  var onToggle = props.onToggle;
  var onDelete = props.onDelete;
  return React.createElement('div', { className: 'task-item' + (task.done ? ' completed' : '') },
    React.createElement('input', { type: 'checkbox', checked: task.done, onChange: function() { onToggle(task.id); } }),
    React.createElement('span', { className: 'task-title' }, task.title),
    React.createElement('button', { onClick: function() { onDelete(task.id); }, className: 'delete-btn' }, 'Delete')
  );
}

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/react_taskmanager/TaskItem.jsx').read(); assert 'onClick' in h or 'onclick' in h or 'onDelete' in h; assert 'className' in h or 'class' in h; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'tm_task_counter', section: 1, complexity: 6, category: 'react',
    dir: 'react_taskmanager', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/react_taskmanager/TaskCounter.jsx with a React component function TaskCounter that accepts props with 'total' and 'completed' numbers, and renders a paragraph showing "X of Y completed". Use React.createElement (CDN React, no JSX transform).

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/react_taskmanager/TaskCounter.jsx').read(); assert 'completed' in h.lower(); assert 'total' in h.lower() or 'length' in h.lower(); print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'tm_filter', section: 1, complexity: 7, category: 'react',
    dir: 'react_taskmanager', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/react_taskmanager/FilterBar.jsx with a React component function FilterBar that renders 3 filter buttons: "All", "Active", "Completed". Accepts props.currentFilter and props.onFilterChange. Highlights the active filter button. Use React.createElement (CDN React).

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/react_taskmanager/FilterBar.jsx').read(); assert 'All' in h; assert 'Active' in h; assert 'Completed' in h or 'completed' in h; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'tm_add_task', section: 1, complexity: 7, category: 'react',
    dir: 'react_taskmanager', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/react_taskmanager/AddTaskForm.jsx with a React component function AddTaskForm that has a text input and submit button. Uses React.useState for input value. On submit, calls props.onAdd(title) if title is not empty, then clears input. Use React.createElement (CDN React).

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/react_taskmanager/AddTaskForm.jsx').read(); assert 'onSubmit' in h or 'submit' in h.lower(); assert 'input' in h.lower(); print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'tm_task_list', section: 1, complexity: 7, category: 'react',
    dir: 'react_taskmanager', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/react_taskmanager/TaskList.jsx with a React component function TaskList that accepts props.tasks (array), props.onToggle, props.onDelete. Maps over tasks to render TaskItem for each. Shows "No tasks yet" if tasks array is empty. Use React.createElement (CDN React).

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/react_taskmanager/TaskList.jsx').read(); assert 'map' in h or 'forEach' in h; assert 'TaskItem' in h or 'task-item' in h or 'task' in h.lower(); print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'tm_storage', section: 1, complexity: 7, category: 'react',
    dir: 'react_taskmanager', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/react_taskmanager/storage.js with:
var Storage = {
  load: function(key) {
    try {
      var data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },
  save: function(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  },
  remove: function(key) {
    localStorage.removeItem(key);
  }
};

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/react_taskmanager/storage.js').read(); assert 'localStorage' in h; assert 'JSON' in h; assert 'save' in h or 'setItem' in h; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'tm_app', section: 1, complexity: 8, category: 'react',
    dir: 'react_taskmanager', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/react_taskmanager/App.jsx with a React component function App that:
- Uses React.useState for tasks array and filter string
- Has addTask(title) that adds {id, title, done:false} to tasks
- Has toggleTask(id) that toggles done status
- Has deleteTask(id) that removes task
- Renders AddTaskForm, FilterBar, TaskCounter, and TaskList
- Wires all callbacks and state
Use React.createElement (CDN React, no JSX transform).

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/react_taskmanager/App.jsx').read(); assert 'useState' in h; assert 'addTask' in h or 'add' in h.lower(); print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'tm_index', section: 1, complexity: 6, category: 'react',
    dir: 'react_taskmanager', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/react_taskmanager/index.html with:
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Manager</title>
    <link rel="stylesheet" href="style.css">
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
</head>
<body>
    <div id="root"></div>
    <script src="utils.js"></script>
    <script src="storage.js"></script>
    <script src="TaskItem.jsx"></script>
    <script src="TaskCounter.jsx"></script>
    <script src="FilterBar.jsx"></script>
    <script src="AddTaskForm.jsx"></script>
    <script src="TaskList.jsx"></script>
    <script src="App.jsx"></script>
    <script>
        var root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(App));
    </script>
</body>
</html>

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/react_taskmanager/index.html').read(); assert 'react' in h.lower(); assert 'id="root"' in h or "id='root'" in h; assert 'style.css' in h; print('PASS')`,
    validationLang: 'py'
  },
];

// =============================================================================
// SECTION 1B: CTO DECOMPOSED APPS — 2 briefs, ~5 subtasks each (C10)
// Fallback tasks used if CTO decomposition fails
// =============================================================================

const CTO_BRIEFS = [
  {
    name: 'React Weather Dashboard',
    dir: 'react_weather',
    brief: `Create a React Weather Dashboard (CDN, no build tools) with these files in tasks/react_weather/:
1. index.html — CDN React 18 + ReactDOM, loads all scripts, has root div
2. style.css — modern card-based layout, responsive grid, weather icons via emoji
3. WeatherDisplay.jsx — shows current temp, city name, condition icon (React.createElement)
4. SearchBar.jsx — input + search button, calls onSearch callback (React.createElement)
5. ForecastCards.jsx — renders 3-day forecast as cards (React.createElement)
Each file should be self-contained and use React.createElement (no JSX transform).`,
    expectedFiles: ['index.html', 'style.css', 'WeatherDisplay.jsx', 'SearchBar.jsx', 'ForecastCards.jsx'],
    fallbackTasks: [
      {
        name: 'weather_index', complexity: 6, category: 'react_cto',
        dir: 'react_weather', files: 1,
        description: `Use file_write to create tasks/react_weather/index.html with: <!DOCTYPE html>, React 18 CDN scripts (unpkg.com/react@18, react-dom@18), <div id="root">, link to style.css, script tags for WeatherDisplay.jsx, SearchBar.jsx, ForecastCards.jsx, and App.jsx.`,
        validation: `h=open('/app/workspace/tasks/react_weather/index.html').read(); assert 'react' in h.lower(); assert 'id="root"' in h or "id='root'" in h; print('PASS')`,
        validationLang: 'py'
      },
      {
        name: 'weather_styles', complexity: 6, category: 'react_cto',
        dir: 'react_weather', files: 1,
        description: `Use file_write to create tasks/react_weather/style.css with: body styling, .weather-card class with border-radius and shadow, .forecast-grid with CSS grid or flexbox, .search-bar with input and button styling, responsive @media query.`,
        validation: `h=open('/app/workspace/tasks/react_weather/style.css').read(); assert 'weather' in h.lower() or 'card' in h.lower() or 'grid' in h.lower(); print('PASS')`,
        validationLang: 'py'
      },
      {
        name: 'weather_display', complexity: 7, category: 'react_cto',
        dir: 'react_weather', files: 1,
        description: `Use file_write to create tasks/react_weather/WeatherDisplay.jsx with a function WeatherDisplay(props) that uses React.createElement to render: city name in h2, temperature in large span, weather condition with emoji icon. Props: city, temp, condition.`,
        validation: `h=open('/app/workspace/tasks/react_weather/WeatherDisplay.jsx').read(); assert 'WeatherDisplay' in h; assert 'createElement' in h or 'React' in h; print('PASS')`,
        validationLang: 'py'
      },
      {
        name: 'weather_search', complexity: 7, category: 'react_cto',
        dir: 'react_weather', files: 1,
        description: `Use file_write to create tasks/react_weather/SearchBar.jsx with a function SearchBar(props) that uses React.createElement to render: text input for city name and a Search button. Uses React.useState for input value. On submit calls props.onSearch(city).`,
        validation: `h=open('/app/workspace/tasks/react_weather/SearchBar.jsx').read(); assert 'SearchBar' in h; assert 'input' in h.lower() or 'Input' in h; print('PASS')`,
        validationLang: 'py'
      },
      {
        name: 'weather_forecast', complexity: 7, category: 'react_cto',
        dir: 'react_weather', files: 1,
        description: `Use file_write to create tasks/react_weather/ForecastCards.jsx with a function ForecastCards(props) that uses React.createElement to render a row of 3 forecast cards. Each card shows: day name, emoji icon, high/low temp. Props: forecast (array of {day, icon, high, low}).`,
        validation: `h=open('/app/workspace/tasks/react_weather/ForecastCards.jsx').read(); assert 'ForecastCards' in h or 'Forecast' in h; assert 'createElement' in h or 'React' in h; print('PASS')`,
        validationLang: 'py'
      },
    ]
  },
  {
    name: 'React Recipe Browser',
    dir: 'react_recipe',
    brief: `Create a React Recipe Browser (CDN, no build tools) with these files in tasks/react_recipe/:
1. index.html — CDN React 18 + ReactDOM, loads all scripts, has root div
2. style.css — recipe card grid layout, responsive, appetizing color scheme
3. RecipeList.jsx — renders array of recipe cards with title, image placeholder, prep time (React.createElement)
4. RecipeDetail.jsx — shows full recipe: title, ingredients list, instructions (React.createElement)
5. Favorites.jsx — manages favorite recipes with add/remove toggle (React.createElement)
Each file should be self-contained and use React.createElement (no JSX transform).`,
    expectedFiles: ['index.html', 'style.css', 'RecipeList.jsx', 'RecipeDetail.jsx', 'Favorites.jsx'],
    fallbackTasks: [
      {
        name: 'recipe_index', complexity: 6, category: 'react_cto',
        dir: 'react_recipe', files: 1,
        description: `Use file_write to create tasks/react_recipe/index.html with: <!DOCTYPE html>, React 18 CDN scripts, <div id="root">, link to style.css, script tags for RecipeList.jsx, RecipeDetail.jsx, Favorites.jsx, and App.jsx.`,
        validation: `h=open('/app/workspace/tasks/react_recipe/index.html').read(); assert 'react' in h.lower(); assert 'id="root"' in h or "id='root'" in h; print('PASS')`,
        validationLang: 'py'
      },
      {
        name: 'recipe_styles', complexity: 6, category: 'react_cto',
        dir: 'react_recipe', files: 1,
        description: `Use file_write to create tasks/react_recipe/style.css with: body styling, .recipe-card class with border and padding, .recipe-grid with CSS grid or flexbox, .recipe-detail section styling, .favorite-btn with toggle state styling.`,
        validation: `h=open('/app/workspace/tasks/react_recipe/style.css').read(); assert 'recipe' in h.lower() or 'card' in h.lower(); print('PASS')`,
        validationLang: 'py'
      },
      {
        name: 'recipe_list', complexity: 7, category: 'react_cto',
        dir: 'react_recipe', files: 1,
        description: `Use file_write to create tasks/react_recipe/RecipeList.jsx with a function RecipeList(props) that uses React.createElement to render recipe cards in a grid. Each card has: title, prep time, short description. Props: recipes (array), onSelect callback.`,
        validation: `h=open('/app/workspace/tasks/react_recipe/RecipeList.jsx').read(); assert 'RecipeList' in h; assert 'createElement' in h or 'React' in h; print('PASS')`,
        validationLang: 'py'
      },
      {
        name: 'recipe_detail', complexity: 7, category: 'react_cto',
        dir: 'react_recipe', files: 1,
        description: `Use file_write to create tasks/react_recipe/RecipeDetail.jsx with a function RecipeDetail(props) that uses React.createElement to show: recipe title in h2, ingredients as ul/li list, instructions as ordered list. Props: recipe object with title, ingredients array, instructions array.`,
        validation: `h=open('/app/workspace/tasks/react_recipe/RecipeDetail.jsx').read(); assert 'RecipeDetail' in h; assert 'createElement' in h or 'React' in h; print('PASS')`,
        validationLang: 'py'
      },
      {
        name: 'recipe_favorites', complexity: 7, category: 'react_cto',
        dir: 'react_recipe', files: 1,
        description: `Use file_write to create tasks/react_recipe/Favorites.jsx with a function Favorites(props) that uses React.createElement to render favorite recipe list. Has a toggle button (heart/star icon) per recipe. Props: favorites (array), onToggle callback.`,
        validation: `h=open('/app/workspace/tasks/react_recipe/Favorites.jsx').read(); assert 'Favorites' in h or 'favorite' in h.lower(); assert 'createElement' in h or 'React' in h; print('PASS')`,
        validationLang: 'py'
      },
    ]
  }
];

// =============================================================================
// SECTION 2: LANDING PAGES — 15 tasks across 3 sites (C6-C8)
// =============================================================================

const SECTION_2 = [
  // --- Coffee Shop (5 tasks) — Dir: tasks/coffee_landing_v2/ ---
  {
    name: 'coffee_hero', section: 2, complexity: 7, category: 'landing',
    dir: 'coffee_landing_v2', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/coffee_landing_v2/index.html with this content:
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Brew & Bean Coffee</title>
<style>
body { font-family: sans-serif; margin: 0; }
.hero { background: #4a2c2a; color: white; padding: 60px 20px; text-align: center; }
.hero h1 { font-size: 3em; margin-bottom: 10px; }
.cta-btn { display: inline-block; background: #d4a574; color: #333; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
nav a { color: #f0d9b5; margin: 0 10px; text-decoration: none; }
footer { background: #333; color: white; text-align: center; padding: 10px; }
</style>
</head>
<body>
  <header class="hero">
    <nav><a href="menu.html">Menu</a> <a href="about.html">About</a> <a href="contact.html">Contact</a></nav>
    <h1>Brew & Bean</h1>
    <p>Freshly roasted, always delicious</p>
    <a href="menu.html" class="cta-btn">View Our Menu</a>
  </header>
  <footer><p>&copy; 2026 Brew & Bean</p></footer>
</body>
</html>

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/coffee_landing_v2/index.html').read(); assert '<h1>' in h; assert 'hero' in h or 'Hero' in h; assert 'style' in h.lower(); print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'coffee_menu', section: 2, complexity: 7, category: 'landing',
    dir: 'coffee_landing_v2', files: 1,
    description: `Use file_write to create tasks/coffee_landing_v2/menu.html with a coffee shop menu page: <!DOCTYPE html>, title "Menu - Brew & Bean", link to style.css, <h1>Our Menu</h1>, a grid of 6 menu items each in a div.menu-item with <h3> name and <p> price: Espresso $3.50, Latte $4.50, Cappuccino $4.00, Mocha $5.00, Americano $3.00, Cold Brew $4.50.`,
    validation: `h=open('/app/workspace/tasks/coffee_landing_v2/menu.html').read(); assert 'Espresso' in h or 'espresso' in h; assert 'menu-item' in h or 'menu' in h; assert '$' in h or 'price' in h; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'coffee_about', section: 2, complexity: 6, category: 'landing',
    dir: 'coffee_landing_v2', files: 1,
    description: `Use file_write to create tasks/coffee_landing_v2/about.html with: <!DOCTYPE html>, title "About - Brew & Bean", link to style.css, sections for "Our Story" (founded paragraph), "Our Team" (3 team member names), "Our Mission" (quality coffee paragraph).`,
    validation: `h=open('/app/workspace/tasks/coffee_landing_v2/about.html').read(); assert 'story' in h.lower() or 'Story' in h; assert 'mission' in h.lower() or 'Mission' in h; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'coffee_contact', section: 2, complexity: 6, category: 'landing',
    dir: 'coffee_landing_v2', files: 1,
    description: `Use file_write to create tasks/coffee_landing_v2/contact.html with: <!DOCTYPE html>, title "Contact - Brew & Bean", link to style.css, a contact form with: input name (text, required), input email (email, required), textarea message, submit button "Send Message".`,
    validation: `h=open('/app/workspace/tasks/coffee_landing_v2/contact.html').read(); assert 'form' in h.lower(); assert 'email' in h.lower(); assert 'message' in h.lower() or 'textarea' in h.lower(); print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'coffee_nav', section: 2, complexity: 7, category: 'landing',
    dir: 'coffee_landing_v2', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/coffee_landing_v2/nav.js with:
function toggleMenu() {
  var nav = document.querySelector('.mobile-nav');
  if (nav) {
    nav.classList.toggle('open');
  }
}

function smoothScroll(targetId) {
  var el = document.getElementById(targetId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

function initNav() {
  var hamburger = document.querySelector('.hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', toggleMenu);
  }
  var links = document.querySelectorAll('a[href^="#"]');
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener('click', function(e) {
      e.preventDefault();
      var target = this.getAttribute('href').substring(1);
      smoothScroll(target);
    });
  }
}

if (typeof module !== 'undefined') module.exports = { toggleMenu, smoothScroll, initNav };

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/coffee_landing_v2/nav.js').read(); assert 'toggleMenu' in h or 'toggle' in h; assert 'scroll' in h.lower(); print('PASS')`,
    validationLang: 'py'
  },

  // --- SaaS Product (5 tasks) — Dir: tasks/saas_landing/ ---
  {
    name: 'saas_hero', section: 2, complexity: 7, category: 'landing',
    dir: 'saas_landing', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/saas_landing/index.html with this content:
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>LaunchPad SaaS</title>
<style>
body { font-family: 'Segoe UI', sans-serif; margin: 0; color: #333; }
.hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 80px 20px; text-align: center; }
.hero h1 { font-size: 2.5em; }
.cta-group { margin-top: 30px; }
.cta-primary { background: #fff; color: #764ba2; padding: 12px 30px; border-radius: 25px; text-decoration: none; margin: 0 10px; font-weight: bold; }
.cta-secondary { color: white; border: 2px solid white; padding: 12px 30px; border-radius: 25px; text-decoration: none; margin: 0 10px; }
section { padding: 60px 20px; max-width: 1000px; margin: 0 auto; }
</style>
</head>
<body>
  <header class="hero">
    <h1>Launch Faster with LaunchPad</h1>
    <p>The all-in-one platform for modern teams</p>
    <div class="cta-group">
      <a href="#" class="cta-primary">Start Free Trial</a>
      <a href="#features" class="cta-secondary">Learn More</a>
    </div>
  </header>
  <section id="features"></section>
  <section id="pricing"></section>
  <section id="testimonials"></section>
  <footer id="footer"></footer>
</body>
</html>

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/saas_landing/index.html').read(); assert '<h1>' in h; assert 'cta' in h.lower() or 'button' in h.lower() or 'btn' in h.lower(); assert 'style' in h.lower(); print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'saas_features', section: 2, complexity: 7, category: 'landing',
    dir: 'saas_landing', files: 1,
    description: `Use file_write to create tasks/saas_landing/features.html with: an HTML snippet (section#features) containing <h2>Features</h2> and 3 feature cards in a div.feature-grid. Each card (div.feature-card) has: an emoji icon, h3 title, and p description. Features: "Lightning Fast" (speed), "Secure" (security), "Team Collaboration" (teamwork).`,
    validation: `h=open('/app/workspace/tasks/saas_landing/features.html').read(); assert 'feature' in h.lower(); c=h.lower().count('card') + h.lower().count('feature-'); assert c >= 2 or h.count('<h3>') >= 2 or h.count('<h3') >= 2; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'saas_pricing', section: 2, complexity: 8, category: 'landing',
    dir: 'saas_landing', files: 1,
    description: `Use file_write to create tasks/saas_landing/pricing.html with: a section containing <h2>Pricing</h2> and 3 pricing tier cards. Each card (div.pricing-card) has: plan name (h3), price (div.price), feature list (ul), and CTA button. Tiers: Free ($0/mo, 3 features), Pro ($29/mo, 6 features, class "popular"), Enterprise ($99/mo, unlimited). The Pro card should have a class "popular" or "highlighted".`,
    validation: `h=open('/app/workspace/tasks/saas_landing/pricing.html').read(); assert 'pricing' in h.lower() or 'price' in h.lower(); assert '$' in h or 'free' in h.lower(); assert 'popular' in h.lower() or 'highlight' in h.lower() or 'Pro' in h; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'saas_testimonials', section: 2, complexity: 6, category: 'landing',
    dir: 'saas_landing', files: 1,
    description: `Use file_write to create tasks/saas_landing/testimonials.html with: a section containing <h2>What Our Customers Say</h2> and 3 testimonial cards. Each card (div.testimonial) has: blockquote with quote text, and p.author with person's name and company.`,
    validation: `h=open('/app/workspace/tasks/saas_landing/testimonials.html').read(); assert 'testimonial' in h.lower() or 'quote' in h.lower() or 'blockquote' in h.lower(); print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'saas_footer', section: 2, complexity: 6, category: 'landing',
    dir: 'saas_landing', files: 1,
    description: `Use file_write to create tasks/saas_landing/footer.html with: a footer element with 3 columns (div.footer-col): "Product" links (Features, Pricing, Docs), "Company" links (About, Blog, Careers), "Connect" links (Twitter, GitHub, Email). Include copyright line.`,
    validation: `h=open('/app/workspace/tasks/saas_landing/footer.html').read(); assert 'footer' in h.lower(); assert 'Product' in h or 'product' in h; print('PASS')`,
    validationLang: 'py'
  },

  // --- Dev Portfolio (5 tasks) — Dir: tasks/portfolio_landing/ ---
  {
    name: 'portfolio_hero', section: 2, complexity: 7, category: 'landing',
    dir: 'portfolio_landing', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/portfolio_landing/index.html with this content:
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Dev Portfolio</title>
<style>
body { font-family: 'Courier New', monospace; margin: 0; background: #0d1117; color: #c9d1d9; }
.hero { background: #161b22; padding: 80px 20px; text-align: center; }
.hero h1 { color: #58a6ff; font-size: 2.5em; }
.subtitle { color: #8b949e; }
.social-links { margin-top: 20px; }
.social { color: #58a6ff; margin: 0 10px; text-decoration: none; }
section { padding: 40px 20px; max-width: 800px; margin: 0 auto; }
</style>
</head>
<body>
  <header class="hero">
    <h1>Alex Developer</h1>
    <p class="subtitle">Full-Stack Engineer</p>
    <div class="social-links">
      <a href="#" class="social">GitHub</a>
      <a href="#" class="social">LinkedIn</a>
      <a href="#" class="social">Twitter</a>
    </div>
  </header>
  <section id="projects"></section>
  <section id="skills"></section>
  <section id="experience"></section>
  <section id="contact"></section>
</body>
</html>

DO NOT just output the code - you MUST call file_write.`,
    validation: `h=open('/app/workspace/tasks/portfolio_landing/index.html').read(); assert '<h1>' in h; assert 'social' in h.lower(); assert 'style' in h.lower(); print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'portfolio_projects', section: 2, complexity: 7, category: 'landing',
    dir: 'portfolio_landing', files: 1,
    description: `Use file_write to create tasks/portfolio_landing/projects.html with: <h2>Projects</h2> and 4 project cards (div.project-card). Each card has: h3 project name, p description, div.tech-tags with span tags for technologies. Projects: "TaskFlow" (React, Node.js), "DataViz" (D3.js, Python), "ChatBot" (OpenAI, Express), "DevOps CLI" (Go, Docker).`,
    validation: `h=open('/app/workspace/tasks/portfolio_landing/projects.html').read(); assert 'project' in h.lower(); c=h.lower().count('card') + h.count('<h3'); assert c >= 3; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'portfolio_skills', section: 2, complexity: 6, category: 'landing',
    dir: 'portfolio_landing', files: 1,
    description: `Use file_write to create tasks/portfolio_landing/skills.html with: <h2>Skills</h2> and 8+ skill items. Each skill has a label and a progress bar (div.progress-bar with inner div.progress at width %). Skills: JavaScript 90%, Python 85%, React 88%, Node.js 82%, SQL 75%, Docker 70%, Go 65%, TypeScript 80%.`,
    validation: `h=open('/app/workspace/tasks/portfolio_landing/skills.html').read(); assert 'skill' in h.lower() or 'progress' in h.lower(); assert 'JavaScript' in h or 'javascript' in h or 'JS' in h; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'portfolio_timeline', section: 2, complexity: 7, category: 'landing',
    dir: 'portfolio_landing', files: 1,
    description: `Use file_write to create tasks/portfolio_landing/timeline.html with: <h2>Experience</h2> and 3 timeline entries (div.timeline-entry). Each entry has: span.year, h3 role title, p.company, p description. Entries: 2024 "Senior Developer" at TechCorp, 2022 "Full-Stack Engineer" at StartupXYZ, 2020 "Junior Developer" at WebAgency.`,
    validation: `h=open('/app/workspace/tasks/portfolio_landing/timeline.html').read(); assert 'timeline' in h.lower() or 'experience' in h.lower(); assert '202' in h; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'portfolio_contact', section: 2, complexity: 6, category: 'landing',
    dir: 'portfolio_landing', files: 1,
    description: `Use file_write to create tasks/portfolio_landing/contact.html with: <h2>Get In Touch</h2>, a contact form (name input, email input, message textarea, submit button), and social links section (GitHub, LinkedIn, Email links).`,
    validation: `h=open('/app/workspace/tasks/portfolio_landing/contact.html').read(); assert 'form' in h.lower() or 'input' in h.lower(); assert 'email' in h.lower(); print('PASS')`,
    validationLang: 'py'
  },
];

// =============================================================================
// SECTION 3: WEB SERVER — 25 tasks (13 Python + 12 Node.js)
// =============================================================================

const SECTION_3 = [
  // --- Python stdlib HTTP API (13 tasks) — Dir: tasks/py_api_server/ ---
  {
    name: 'py_json_response', section: 3, complexity: 5, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/json_helpers.py with this content:
import json

def json_response(data, status=200):
    return {
        'body': json.dumps(data),
        'status': status,
        'headers': {'Content-Type': 'application/json'}
    }

def error_response(message, status=400):
    return json_response({'error': message}, status)

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.json_helpers import json_response, error_response; import json; r=json_response({'ok':True}); assert r['status']==200; assert json.loads(r['body'])=={'ok':True}; e=error_response('bad',400); assert e['status']==400; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_router', section: 3, complexity: 7, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/router.py with this content:
class Router:
    def __init__(self):
        self.routes = {}

    def add_route(self, method, path, handler):
        key = method.upper() + ' ' + path
        self.routes[key] = handler

    def match(self, method, path):
        key = method.upper() + ' ' + path
        if key in self.routes:
            return self.routes[key]
        return None

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.router import Router; r=Router(); r.add_route('GET','/items',lambda:'ok'); assert r.match('GET','/items')()=='ok'; assert r.match('POST','/items') is None; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_request_parser', section: 3, complexity: 7, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/request_parser.py with this content:
import json

def parse_query_string(qs):
    params = {}
    if not qs:
        return params
    for pair in qs.split('&'):
        if '=' in pair:
            key, value = pair.split('=', 1)
            params[key] = value
    return params

def parse_json_body(body_str):
    try:
        return json.loads(body_str)
    except (json.JSONDecodeError, TypeError):
        return None

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.request_parser import parse_query_string, parse_json_body; r=parse_query_string('a=1&b=2'); assert r=={'a':'1','b':'2'}; assert parse_json_body('{"x":1}')=={'x':1}; assert parse_json_body('bad') is None; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_todo_model', section: 3, complexity: 6, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/todo_model.py with this content:
class TodoStore:
    def __init__(self):
        self._todos = {}
        self._next_id = 1

    def create(self, title):
        todo = {'id': self._next_id, 'title': title, 'done': False}
        self._todos[self._next_id] = todo
        self._next_id += 1
        return todo

    def get(self, todo_id):
        return self._todos.get(todo_id)

    def list_all(self):
        return list(self._todos.values())

    def delete(self, todo_id):
        if todo_id in self._todos:
            del self._todos[todo_id]
            return True
        return False

    def update(self, todo_id, title=None, done=None):
        todo = self._todos.get(todo_id)
        if not todo:
            return None
        if title is not None:
            todo['title'] = title
        if done is not None:
            todo['done'] = done
        return todo

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.todo_model import TodoStore; s=TodoStore(); t=s.create('Buy milk'); assert t['title']=='Buy milk'; assert t['done']==False; assert len(s.list_all())==1; s.update(t['id'],done=True); assert s.get(t['id'])['done']==True; s.delete(t['id']); assert len(s.list_all())==0; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_todo_handlers', section: 3, complexity: 8, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/todo_handlers.py with this content:
import json

def handle_list(store):
    return {'body': json.dumps(store.list_all()), 'status': 200}

def handle_create(store, body_str):
    try:
        data = json.loads(body_str)
    except (json.JSONDecodeError, TypeError):
        return {'body': json.dumps({'error': 'invalid json'}), 'status': 400}
    title = data.get('title', '')
    if not title:
        return {'body': json.dumps({'error': 'title required'}), 'status': 400}
    todo = store.create(title)
    return {'body': json.dumps(todo), 'status': 201}

def handle_get(store, todo_id):
    todo = store.get(todo_id)
    if not todo:
        return {'body': json.dumps({'error': 'not found'}), 'status': 404}
    return {'body': json.dumps(todo), 'status': 200}

def handle_delete(store, todo_id):
    if store.delete(todo_id):
        return {'body': json.dumps({'ok': True}), 'status': 200}
    return {'body': json.dumps({'error': 'not found'}), 'status': 404}

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.todo_model import TodoStore; from tasks.py_api_server.todo_handlers import handle_list, handle_create, handle_get, handle_delete; import json; s=TodoStore(); r=handle_create(s,'{"title":"test"}'); assert r['status']==201; d=json.loads(r['body']); assert d['title']=='test'; r2=handle_list(s); assert r2['status']==200; r3=handle_get(s,d['id']); assert r3['status']==200; r4=handle_delete(s,d['id']); assert r4['status']==200; r5=handle_get(s,d['id']); assert r5['status']==404; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_middleware_logger', section: 3, complexity: 6, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/middleware.py with this content:
def log_request(method, path, status, duration_ms=0):
    return f"{method} {path} -> {status} ({duration_ms}ms)"

def apply_cors(headers=None):
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
    if headers:
        cors.update(headers)
    return cors

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.middleware import log_request, apply_cors; r=log_request('GET','/api/items',200,15); assert 'GET' in r; assert '200' in r; c=apply_cors(); assert c['Access-Control-Allow-Origin']=='*'; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_error_handler', section: 3, complexity: 6, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/error_handler.py with this content:
import json

def handle_error(error_type, message='An error occurred'):
    status_map = {
        'not_found': 404,
        'bad_request': 400,
        'unauthorized': 401,
        'forbidden': 403,
        'internal': 500
    }
    status = status_map.get(error_type, 500)
    return {
        'body': json.dumps({'error': message, 'type': error_type}),
        'status': status,
        'headers': {'Content-Type': 'application/json'}
    }

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.error_handler import handle_error; import json; r=handle_error('not_found','item missing'); assert r['status']==404; d=json.loads(r['body']); assert d['error']=='item missing'; r2=handle_error('bad_request'); assert r2['status']==400; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_validator', section: 3, complexity: 7, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/validators.py with this content:
def validate_todo(data):
    errors = []
    if not isinstance(data, dict):
        return (False, ['data must be a dictionary'])
    title = data.get('title')
    if not title:
        errors.append('title is required')
    elif not isinstance(title, str):
        errors.append('title must be a string')
    elif len(title) > 200:
        errors.append('title must be 200 characters or less')
    if 'done' in data and not isinstance(data['done'], bool):
        errors.append('done must be a boolean')
    return (len(errors) == 0, errors)

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.validators import validate_todo; ok,e=validate_todo({'title':'test'}); assert ok==True; ok2,e2=validate_todo({}); assert ok2==False; assert 'title' in e2[0].lower(); ok3,e3=validate_todo({'title':'x','done':'yes'}); assert ok3==False; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_cors_headers', section: 3, complexity: 5, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/cors.py with this content:
def get_cors_headers(origin='*', methods=None, headers_list=None):
    if methods is None:
        methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    if headers_list is None:
        headers_list = ['Content-Type', 'Authorization']
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': ', '.join(methods),
        'Access-Control-Allow-Headers': ', '.join(headers_list)
    }

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.cors import get_cors_headers; h=get_cors_headers(); assert h['Access-Control-Allow-Origin']=='*'; assert 'GET' in h['Access-Control-Allow-Methods']; h2=get_cors_headers('http://example.com',['GET']); assert h2['Access-Control-Allow-Origin']=='http://example.com'; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_pagination', section: 3, complexity: 7, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/pagination.py with this content:
def paginate(items, page=1, per_page=10):
    total = len(items)
    total_pages = (total + per_page - 1) // per_page if total > 0 else 1
    page = max(1, min(page, total_pages))
    start = (page - 1) * per_page
    end = start + per_page
    return {
        'items': items[start:end],
        'page': page,
        'per_page': per_page,
        'total': total,
        'total_pages': total_pages
    }

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.pagination import paginate; items=list(range(25)); r=paginate(items,1,10); assert len(r['items'])==10; assert r['total']==25; assert r['total_pages']==3; r2=paginate(items,3,10); assert len(r2['items'])==5; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_auth_token', section: 3, complexity: 8, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/auth.py with this content:
import hmac
import hashlib
import time
import json
import base64

SECRET = 'default-secret-key'

def generate_token(user_id, secret=None):
    if secret is None:
        secret = SECRET
    payload = {'user_id': user_id, 'exp': int(time.time()) + 3600}
    payload_str = base64.b64encode(json.dumps(payload).encode()).decode()
    sig = hmac.new(secret.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
    return payload_str + '.' + sig

def verify_token(token, secret=None):
    if secret is None:
        secret = SECRET
    try:
        parts = token.split('.')
        if len(parts) != 2:
            return None
        payload_str, sig = parts
        expected = hmac.new(secret.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.b64decode(payload_str).decode())
        if payload.get('exp', 0) < time.time():
            return None
        return payload
    except Exception:
        return None

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.auth import generate_token, verify_token; t=generate_token('user123'); assert '.' in t; p=verify_token(t); assert p is not None; assert p['user_id']=='user123'; assert verify_token('bad.token') is None; assert verify_token(t,'wrong-secret') is None; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_rate_limiter', section: 3, complexity: 8, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/rate_limiter.py with this content:
import time

class RateLimiter:
    def __init__(self, max_requests=10, window_seconds=60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._clients = {}

    def allow(self, client_id):
        now = time.time()
        if client_id not in self._clients:
            self._clients[client_id] = []
        # Remove expired entries
        self._clients[client_id] = [t for t in self._clients[client_id] if now - t < self.window_seconds]
        if len(self._clients[client_id]) >= self.max_requests:
            return False
        self._clients[client_id].append(now)
        return True

    def remaining(self, client_id):
        now = time.time()
        if client_id not in self._clients:
            return self.max_requests
        active = [t for t in self._clients[client_id] if now - t < self.window_seconds]
        return max(0, self.max_requests - len(active))

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.rate_limiter import RateLimiter; rl=RateLimiter(3,60); assert rl.allow('a')==True; assert rl.allow('a')==True; assert rl.allow('a')==True; assert rl.allow('a')==False; assert rl.remaining('a')==0; assert rl.allow('b')==True; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_server_main', section: 3, complexity: 8, category: 'py_api',
    dir: 'py_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_api_server/server.py with this content:
from .router import Router
from .todo_model import TodoStore
from .todo_handlers import handle_list, handle_create, handle_get, handle_delete
from .cors import get_cors_headers

def create_app():
    router = Router()
    store = TodoStore()

    router.add_route('GET', '/todos', lambda: handle_list(store))
    router.add_route('POST', '/todos', lambda body='{}': handle_create(store, body))

    return {
        'router': router,
        'store': store,
        'cors_headers': get_cors_headers()
    }

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_api_server.server import create_app; app=create_app(); assert app['router'] is not None; assert app['store'] is not None; h=app['router'].match('GET','/todos'); assert h is not None; print('PASS')`,
    validationLang: 'py'
  },

  // --- Node.js stdlib HTTP API (12 tasks) — Dir: tasks/node_api_server/ ---
  {
    name: 'node_json_response', section: 3, complexity: 5, category: 'node_api',
    dir: 'node_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/node_api_server/jsonResponse.js with this content:
function jsonResponse(data, statusCode) {
  if (statusCode === undefined) statusCode = 200;
  return {
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
    statusCode: statusCode
  };
}

function errorResponse(message, statusCode) {
  if (statusCode === undefined) statusCode = 400;
  return jsonResponse({ error: message }, statusCode);
}

module.exports = { jsonResponse, errorResponse };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var m=require('./tasks/node_api_server/jsonResponse'); var r=m.jsonResponse({ok:true}); if(r.statusCode!==200) process.exit(1); if(JSON.parse(r.body).ok!==true) process.exit(1); var e=m.errorResponse('bad',400); if(e.statusCode!==400) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'node_router', section: 3, complexity: 7, category: 'node_api',
    dir: 'node_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/node_api_server/router.js with this content:
function Router() {
  this.routes = {};
}

Router.prototype.addRoute = function(method, path, handler) {
  var key = method.toUpperCase() + ' ' + path;
  this.routes[key] = handler;
};

Router.prototype.match = function(method, path) {
  var key = method.toUpperCase() + ' ' + path;
  return this.routes[key] || null;
};

module.exports = Router;

DO NOT just output the code - you MUST call file_write.`,
    validation: `var Router=require('./tasks/node_api_server/router'); var r=new Router(); r.addRoute('GET','/items',function(){return 'ok'}); if(r.match('GET','/items')()==='ok'&&r.match('POST','/items')===null) console.log('PASS'); else process.exit(1)`,
    validationLang: 'node'
  },
  {
    name: 'node_query_parser', section: 3, complexity: 6, category: 'node_api',
    dir: 'node_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/node_api_server/queryParser.js with this content:
function parseQuery(qs) {
  var result = {};
  if (!qs) return result;
  var pairs = qs.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var idx = pairs[i].indexOf('=');
    if (idx === -1) continue;
    var key = decodeURIComponent(pairs[i].substring(0, idx));
    var val = decodeURIComponent(pairs[i].substring(idx + 1));
    result[key] = val;
  }
  return result;
}

module.exports = { parseQuery };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var m=require('./tasks/node_api_server/queryParser'); var r=m.parseQuery('a=1&b=hello'); if(r.a==='1'&&r.b==='hello') console.log('PASS'); else process.exit(1)`,
    validationLang: 'node'
  },
  {
    name: 'node_note_model', section: 3, complexity: 7, category: 'node_api',
    dir: 'node_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/node_api_server/noteModel.js with this content:
function NoteStore() {
  this._notes = {};
  this._nextId = 1;
}

NoteStore.prototype.create = function(title, content) {
  var note = { id: this._nextId, title: title, content: content || '' };
  this._notes[this._nextId] = note;
  this._nextId++;
  return note;
};

NoteStore.prototype.get = function(id) {
  return this._notes[id] || null;
};

NoteStore.prototype.listAll = function() {
  var self = this;
  return Object.keys(this._notes).map(function(k) { return self._notes[k]; });
};

NoteStore.prototype.remove = function(id) {
  if (this._notes[id]) { delete this._notes[id]; return true; }
  return false;
};

module.exports = NoteStore;

DO NOT just output the code - you MUST call file_write.`,
    validation: `var NoteStore=require('./tasks/node_api_server/noteModel'); var s=new NoteStore(); var n=s.create('Test','body'); if(n.title!=='Test') process.exit(1); if(s.listAll().length!==1) process.exit(1); if(!s.get(n.id)) process.exit(1); s.remove(n.id); if(s.listAll().length!==0) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'node_note_handlers', section: 3, complexity: 8, category: 'node_api',
    dir: 'node_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/node_api_server/noteHandlers.js with this content:
function handleList(store) {
  return { body: JSON.stringify(store.listAll()), status: 200 };
}

function handleCreate(store, bodyStr) {
  try {
    var data = JSON.parse(bodyStr);
  } catch(e) {
    return { body: JSON.stringify({error:'invalid json'}), status: 400 };
  }
  if (!data.title) return { body: JSON.stringify({error:'title required'}), status: 400 };
  var note = store.create(data.title, data.content || '');
  return { body: JSON.stringify(note), status: 201 };
}

function handleGet(store, id) {
  var note = store.get(id);
  if (!note) return { body: JSON.stringify({error:'not found'}), status: 404 };
  return { body: JSON.stringify(note), status: 200 };
}

function handleDelete(store, id) {
  if (store.remove(id)) return { body: JSON.stringify({ok:true}), status: 200 };
  return { body: JSON.stringify({error:'not found'}), status: 404 };
}

module.exports = { handleList, handleCreate, handleGet, handleDelete };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var NoteStore=require('./tasks/node_api_server/noteModel'); var h=require('./tasks/node_api_server/noteHandlers'); var s=new NoteStore(); var r=h.handleCreate(s,'{"title":"test"}'); if(r.status!==201) process.exit(1); var d=JSON.parse(r.body); var r2=h.handleList(s); if(r2.status!==200) process.exit(1); var r3=h.handleGet(s,d.id); if(r3.status!==200) process.exit(1); var r4=h.handleDelete(s,d.id); if(r4.status!==200) process.exit(1); var r5=h.handleGet(s,d.id); if(r5.status!==404) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'node_middleware', section: 3, complexity: 6, category: 'node_api',
    dir: 'node_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/node_api_server/middleware.js with this content:
function logRequest(method, path, status, durationMs) {
  if (durationMs === undefined) durationMs = 0;
  return method + ' ' + path + ' -> ' + status + ' (' + durationMs + 'ms)';
}

function corsHeaders(origin) {
  if (origin === undefined) origin = '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

module.exports = { logRequest, corsHeaders };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var m=require('./tasks/node_api_server/middleware'); var l=m.logRequest('GET','/api',200,15); if(!l.includes('GET')||!l.includes('200')) process.exit(1); var c=m.corsHeaders(); if(c['Access-Control-Allow-Origin']!=='*') process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'node_error_handler', section: 3, complexity: 6, category: 'node_api',
    dir: 'node_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/node_api_server/errorHandler.js with this content:
var statusMap = {
  not_found: 404, bad_request: 400, unauthorized: 401, forbidden: 403, internal: 500
};

function handleError(errorType, message) {
  if (!message) message = 'An error occurred';
  var status = statusMap[errorType] || 500;
  return {
    body: JSON.stringify({ error: message, type: errorType }),
    status: status,
    headers: { 'Content-Type': 'application/json' }
  };
}

module.exports = { handleError };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var m=require('./tasks/node_api_server/errorHandler'); var r=m.handleError('not_found','missing'); if(r.status!==404) process.exit(1); var d=JSON.parse(r.body); if(d.error!=='missing') process.exit(1); var r2=m.handleError('bad_request'); if(r2.status!==400) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'node_validator', section: 3, complexity: 7, category: 'node_api',
    dir: 'node_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/node_api_server/validator.js with this content:
function validateNote(data) {
  var errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['data must be an object'] };
  if (!data.title) errors.push('title is required');
  else if (typeof data.title !== 'string') errors.push('title must be a string');
  else if (data.title.length > 200) errors.push('title must be 200 chars or less');
  if (data.content !== undefined && typeof data.content !== 'string') errors.push('content must be a string');
  return { valid: errors.length === 0, errors: errors };
}

module.exports = { validateNote };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var m=require('./tasks/node_api_server/validator'); var r=m.validateNote({title:'test'}); if(!r.valid) process.exit(1); var r2=m.validateNote({}); if(r2.valid) process.exit(1); var r3=m.validateNote({title:123}); if(r3.valid) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'node_uuid', section: 3, complexity: 6, category: 'node_api',
    dir: 'node_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/node_api_server/uuid.js with this content:
var crypto = require('crypto');

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

function shortId() {
  return crypto.randomBytes(4).toString('hex');
}

module.exports = { generateId, shortId };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var m=require('./tasks/node_api_server/uuid'); var id=m.generateId(); if(typeof id!=='string'||id.length!==32) process.exit(1); var s=m.shortId(); if(typeof s!=='string'||s.length!==8) process.exit(1); if(m.generateId()===m.generateId()) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'node_pagination', section: 3, complexity: 7, category: 'node_api',
    dir: 'node_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/node_api_server/pagination.js with this content:
function paginate(items, page, perPage) {
  if (page === undefined) page = 1;
  if (perPage === undefined) perPage = 10;
  var total = items.length;
  var totalPages = total > 0 ? Math.ceil(total / perPage) : 1;
  page = Math.max(1, Math.min(page, totalPages));
  var start = (page - 1) * perPage;
  var end = start + perPage;
  return {
    items: items.slice(start, end),
    page: page,
    perPage: perPage,
    total: total,
    totalPages: totalPages
  };
}

module.exports = { paginate };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var m=require('./tasks/node_api_server/pagination'); var items=[]; for(var i=0;i<25;i++) items.push(i); var r=m.paginate(items,1,10); if(r.items.length!==10||r.total!==25||r.totalPages!==3) process.exit(1); var r2=m.paginate(items,3,10); if(r2.items.length!==5) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'node_auth', section: 3, complexity: 8, category: 'node_api',
    dir: 'node_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/node_api_server/auth.js with this content:
var crypto = require('crypto');

var SECRET = 'default-secret-key';

function createToken(userId, secret) {
  if (!secret) secret = SECRET;
  var payload = JSON.stringify({ userId: userId, exp: Date.now() + 3600000 });
  var payloadB64 = Buffer.from(payload).toString('base64');
  var sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
  return payloadB64 + '.' + sig;
}

function verifyToken(token, secret) {
  if (!secret) secret = SECRET;
  try {
    var parts = token.split('.');
    if (parts.length !== 2) return null;
    var payloadB64 = parts[0];
    var sig = parts[1];
    var expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
    if (sig !== expected) return null;
    var payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch(e) { return null; }
}

module.exports = { createToken, verifyToken };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var m=require('./tasks/node_api_server/auth'); var t=m.createToken('user1'); if(!t.includes('.')) process.exit(1); var p=m.verifyToken(t); if(!p||p.userId!=='user1') process.exit(1); if(m.verifyToken('bad.token')!==null) process.exit(1); if(m.verifyToken(t,'wrong')!==null) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'node_server_main', section: 3, complexity: 8, category: 'node_api',
    dir: 'node_api_server', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/node_api_server/server.js with this content:
var Router = require('./router');
var NoteStore = require('./noteModel');
var handlers = require('./noteHandlers');
var mw = require('./middleware');

function createApp() {
  var router = new Router();
  var store = new NoteStore();

  router.addRoute('GET', '/notes', function() { return handlers.handleList(store); });
  router.addRoute('POST', '/notes', function(body) { return handlers.handleCreate(store, body || '{}'); });

  return {
    router: router,
    store: store,
    corsHeaders: mw.corsHeaders()
  };
}

module.exports = { createApp };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var m=require('./tasks/node_api_server/server'); var app=m.createApp(); if(!app.router||!app.store) process.exit(1); var h=app.router.match('GET','/notes'); if(!h) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
];

// =============================================================================
// SECTION 4A: SECURE CODING — 10 tasks (C5-C8)
// Dir: tasks/security/
// =============================================================================

const SECTION_4A = [
  {
    name: 'sec_sanitize_html', section: 4, complexity: 7, category: 'security',
    dir: 'security', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/security/sanitize_html.py with this content:
def sanitize_html(text):
    replacements = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;'}
    result = text
    result = result.replace('&', '&amp;')
    result = result.replace('<', '&lt;')
    result = result.replace('>', '&gt;')
    result = result.replace('"', '&quot;')
    result = result.replace("'", '&#x27;')
    return result

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security.sanitize_html import sanitize_html; assert sanitize_html('<script>alert("xss")</script>')=='&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'; assert sanitize_html('hello')=='hello'; assert '&lt;' in sanitize_html('<b>'); print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'sec_password_hash', section: 4, complexity: 8, category: 'security',
    dir: 'security', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/security/password_hash.py with this content:
import hashlib
import secrets

def hash_password(password):
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return salt + ':' + hashed

def verify_password(password, stored_hash):
    parts = stored_hash.split(':')
    if len(parts) != 2:
        return False
    salt, expected = parts
    actual = hashlib.sha256((salt + password).encode()).hexdigest()
    return actual == expected

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security.password_hash import hash_password, verify_password; h=hash_password('mypass'); assert ':' in h; assert verify_password('mypass',h)==True; assert verify_password('wrong',h)==False; h2=hash_password('mypass'); assert h!=h2; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'sec_input_validator', section: 4, complexity: 7, category: 'security',
    dir: 'security', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/security/input_validator.py with this content:
import re

def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_username(username):
    pattern = r'^[a-zA-Z][a-zA-Z0-9_]{2,19}$'
    return bool(re.match(pattern, username))

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security.input_validator import validate_email, validate_username; assert validate_email('test@example.com')==True; assert validate_email('bad')==False; assert validate_username('alice_123')==True; assert validate_username('1bad')==False; assert validate_username('ab')==False; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'sec_rate_limit', section: 4, complexity: 8, category: 'security',
    dir: 'security', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/security/token_bucket.py with this content:
import time

class TokenBucket:
    def __init__(self, rate, capacity):
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_refill = time.time()

    def _refill(self):
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_refill = now

    def consume(self, tokens=1):
        self._refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security.token_bucket import TokenBucket; tb=TokenBucket(10,3); assert tb.consume()==True; assert tb.consume()==True; assert tb.consume()==True; assert tb.consume()==False; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'sec_csrf_token', section: 4, complexity: 7, category: 'security',
    dir: 'security', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/security/csrf.py with this content:
import secrets
import time

_tokens = {}

def generate_csrf(session_id, ttl=3600):
    token = secrets.token_urlsafe(32)
    _tokens[token] = {'session': session_id, 'expires': time.time() + ttl}
    return token

def validate_csrf(token, session_id):
    if token not in _tokens:
        return False
    entry = _tokens[token]
    if entry['session'] != session_id:
        return False
    if entry['expires'] < time.time():
        del _tokens[token]
        return False
    del _tokens[token]
    return True

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security.csrf import generate_csrf, validate_csrf; t=generate_csrf('sess1'); assert isinstance(t,str); assert len(t)>10; assert validate_csrf(t,'sess1')==True; assert validate_csrf(t,'sess1')==False; t2=generate_csrf('sess2'); assert validate_csrf(t2,'wrong')==False; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'sec_sanitize_sql', section: 4, complexity: 7, category: 'security',
    dir: 'security', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/security/safe_query.py with this content:
def build_safe_query(template, params):
    placeholders = []
    values = []
    parts = template.split('?')
    if len(parts) - 1 != len(params):
        raise ValueError('Parameter count mismatch')
    result = parts[0]
    for i, param in enumerate(params):
        placeholder = ':param' + str(i)
        result += placeholder + parts[i + 1]
        placeholders.append(placeholder)
        values.append(param)
    return {'query': result, 'params': dict(zip(placeholders, values))}

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security.safe_query import build_safe_query; r=build_safe_query('SELECT * FROM users WHERE id = ? AND name = ?', [1,'alice']); assert ':param0' in r['query']; assert ':param1' in r['query']; assert '?' not in r['query']; assert r['params'][':param0']==1; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'sec_jwt_simple', section: 4, complexity: 8, category: 'security',
    dir: 'security', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/security/jwt_simple.py with this content:
import base64
import hmac
import hashlib
import json
import time

def _b64encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def _b64decode(s):
    padding = 4 - len(s) % 4
    if padding != 4:
        s += '=' * padding
    return base64.urlsafe_b64decode(s)

def create_jwt(payload, secret):
    header = _b64encode(json.dumps({'alg':'HS256','typ':'JWT'}).encode())
    payload_copy = dict(payload)
    if 'exp' not in payload_copy:
        payload_copy['exp'] = int(time.time()) + 3600
    body = _b64encode(json.dumps(payload_copy).encode())
    msg = header + '.' + body
    sig = _b64encode(hmac.new(secret.encode(), msg.encode(), hashlib.sha256).digest())
    return msg + '.' + sig

def decode_jwt(token, secret):
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        msg = parts[0] + '.' + parts[1]
        expected_sig = _b64encode(hmac.new(secret.encode(), msg.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(parts[2], expected_sig):
            return None
        payload = json.loads(_b64decode(parts[1]))
        if payload.get('exp', 0) < time.time():
            return None
        return payload
    except Exception:
        return None

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security.jwt_simple import create_jwt, decode_jwt; t=create_jwt({'user':'alice'},'secret'); assert t.count('.')==2; p=decode_jwt(t,'secret'); assert p is not None; assert p['user']=='alice'; assert decode_jwt(t,'wrong') is None; assert decode_jwt('bad.token.here','secret') is None; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'sec_brute_force', section: 4, complexity: 7, category: 'security',
    dir: 'security', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/security/login_guard.py with this content:
import time

class LoginGuard:
    def __init__(self, max_attempts=5, lockout_seconds=300):
        self.max_attempts = max_attempts
        self.lockout_seconds = lockout_seconds
        self._attempts = {}

    def record_attempt(self, username, success):
        now = time.time()
        if username not in self._attempts:
            self._attempts[username] = {'count': 0, 'locked_until': 0}
        entry = self._attempts[username]
        if success:
            entry['count'] = 0
            entry['locked_until'] = 0
            return True
        entry['count'] += 1
        if entry['count'] >= self.max_attempts:
            entry['locked_until'] = now + self.lockout_seconds
        return False

    def is_locked(self, username):
        if username not in self._attempts:
            return False
        entry = self._attempts[username]
        if entry['locked_until'] > time.time():
            return True
        if entry['locked_until'] > 0 and entry['locked_until'] <= time.time():
            entry['count'] = 0
            entry['locked_until'] = 0
        return False

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security.login_guard import LoginGuard; g=LoginGuard(3,300); assert g.is_locked('alice')==False; g.record_attempt('alice',False); g.record_attempt('alice',False); g.record_attempt('alice',False); assert g.is_locked('alice')==True; g2=LoginGuard(3,300); g2.record_attempt('bob',False); g2.record_attempt('bob',True); assert g2.is_locked('bob')==False; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'sec_xss_filter', section: 4, complexity: 7, category: 'security',
    dir: 'security', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/security/xss_filter.js with this content:
function filterXSS(input) {
  if (typeof input !== 'string') return '';
  var result = input;
  // Remove script tags and content
  result = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove event handlers
  result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  result = result.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');
  // Remove javascript: URLs
  result = result.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  return result;
}

module.exports = { filterXSS };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var m=require('./tasks/security/xss_filter'); var r=m.filterXSS('<script>alert("x")</script>hello'); if(r.includes('<script')) process.exit(1); if(!r.includes('hello')) process.exit(1); var r2=m.filterXSS('<div onclick="evil()">ok</div>'); if(r2.includes('onclick')) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'sec_csp_builder', section: 4, complexity: 7, category: 'security',
    dir: 'security', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/security/csp_builder.js with this content:
function buildCSP(config) {
  var directives = [];
  var keys = Object.keys(config);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var values = config[key];
    if (Array.isArray(values)) {
      directives.push(key + ' ' + values.join(' '));
    } else {
      directives.push(key + ' ' + values);
    }
  }
  return directives.join('; ');
}

module.exports = { buildCSP };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var m=require('./tasks/security/csp_builder'); var r=m.buildCSP({'default-src':["'self'"],'script-src':["'self'","https://cdn.example.com"],'style-src':["'self'","'unsafe-inline'"]}); if(!r.includes("default-src")) process.exit(1); if(!r.includes("script-src")) process.exit(1); if(!r.includes("cdn.example.com")) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
];

// =============================================================================
// SECTION 4B: BUG FIX CHALLENGES — 10 tasks (C5-C7)
// Dir: tasks/security_fixes/
// Agent must read buggy file, identify the vulnerability, and fix it
// =============================================================================

// Buggy source files to seed before Section 4B runs
const BUGGY_FILES = {
  'sql_inject.py': `def get_user(db, username):\n    query = f"SELECT * FROM users WHERE name = '{username}'"\n    return db.execute(query)\n`,
  'xss_reflect.py': `def render_greeting(username):\n    return f"<h1>Welcome, {username}!</h1>"\n`,
  'path_traversal.py': `import os\ndef read_file(base_dir, filename):\n    path = os.path.join(base_dir, filename)\n    with open(path) as f:\n        return f.read()\n`,
  'weak_hash.py': `import hashlib\ndef hash_password(password):\n    return hashlib.md5(password.encode()).hexdigest()\n`,
  'hardcoded_secret.py': `SECRET_KEY = "admin123"\ndef get_secret():\n    return SECRET_KEY\n`,
  'insecure_random.py': `import random\ndef generate_token(length=32):\n    chars = 'abcdefghijklmnopqrstuvwxyz0123456789'\n    return ''.join(random.choice(chars) for _ in range(length))\n`,
  'missing_validation.py': `def process_user(data):\n    age = int(data['age'])\n    name = data['name']\n    return {'name': name, 'age': age}\n`,
  'info_leak.py': `def divide(a, b):\n    try:\n        return a / b\n    except Exception as e:\n        return str(e)\n`,
  'open_redirect.py': `def redirect(url):\n    return {'status': 302, 'location': url}\n`,
  'type_confusion.py': `def is_admin(user):\n    return user.get('role') == True or user.get('role') == 'admin'\n`,
};

const SECTION_4B = [
  {
    name: 'fix_sql_inject', section: 4, complexity: 7, category: 'bugfix',
    dir: 'security_fixes', files: 1,
    description: `SECURITY FIX: Read the file tasks/security_fixes/sql_inject.py which has a SQL injection vulnerability (f-string query interpolation). Fix it by using parameterized queries. The function get_user(db, username) should return a dict with 'query' and 'params' keys instead of calling db.execute directly. Use file_write to save the fixed version.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security_fixes.sql_inject import get_user; r=get_user(None,"admin' OR 1=1 --"); assert isinstance(r,dict); q=r.get('query',''); assert "'" not in q or '?' in q or ':' in q or '%s' in q; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'fix_xss_reflect', section: 4, complexity: 7, category: 'bugfix',
    dir: 'security_fixes', files: 1,
    description: `SECURITY FIX: Read the file tasks/security_fixes/xss_reflect.py which has a reflected XSS vulnerability (raw username in HTML). Fix it by HTML-escaping the username before inserting into HTML. Replace <, >, &, " with their HTML entities. Use file_write to save the fixed version.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security_fixes.xss_reflect import render_greeting; r=render_greeting('<script>alert("x")</script>'); assert '<script>' not in r; assert '&lt;' in r or '&amp;' in r; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'fix_path_traversal', section: 4, complexity: 7, category: 'bugfix',
    dir: 'security_fixes', files: 1,
    description: `SECURITY FIX: Read the file tasks/security_fixes/path_traversal.py which has a path traversal vulnerability (no validation of filename). Fix read_file to reject filenames containing '..' and ensure the resolved path starts with base_dir. Return None or raise ValueError for invalid paths. Use file_write to save the fixed version.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security_fixes.path_traversal import read_file
try:
    r=read_file('/tmp','../etc/passwd')
    assert r is None
except (ValueError, Exception):
    pass
print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'fix_weak_hash', section: 4, complexity: 6, category: 'bugfix',
    dir: 'security_fixes', files: 1,
    description: `SECURITY FIX: Read the file tasks/security_fixes/weak_hash.py which uses MD5 without salt (weak hashing). Fix hash_password to use SHA-256 with a random salt. Return format: salt_hex + ':' + hash_hex. Use secrets or os.urandom for salt. Use file_write to save the fixed version.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security_fixes.weak_hash import hash_password; h=hash_password('test'); assert ':' in h; parts=h.split(':'); assert len(parts)==2; assert len(parts[0])>=16; assert len(parts[1])==64; h2=hash_password('test'); assert h!=h2; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'fix_hardcoded_secret', section: 4, complexity: 5, category: 'bugfix',
    dir: 'security_fixes', files: 1,
    description: `SECURITY FIX: Read the file tasks/security_fixes/hardcoded_secret.py which has a hardcoded secret key "admin123". Fix get_secret() to generate a random secret using the secrets module (secrets.token_hex(32)) if no environment variable SECRET_KEY is set. Check os.environ first, fall back to random generation. Use file_write to save the fixed version.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security_fixes.hardcoded_secret import get_secret; s=get_secret(); assert s!='admin123'; assert len(s)>=16; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'fix_insecure_random', section: 4, complexity: 6, category: 'bugfix',
    dir: 'security_fixes', files: 1,
    description: `SECURITY FIX: Read the file tasks/security_fixes/insecure_random.py which uses random.choice (predictable PRNG) for token generation. Fix generate_token to use secrets.token_hex or secrets.token_urlsafe instead of random.choice. Use file_write to save the fixed version.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security_fixes.insecure_random import generate_token; t=generate_token(32); assert isinstance(t,str); assert len(t)>=32; t2=generate_token(32); assert t!=t2; import inspect; src=inspect.getsource(generate_token); assert 'secrets' in src or 'urandom' in src; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'fix_missing_validation', section: 4, complexity: 7, category: 'bugfix',
    dir: 'security_fixes', files: 1,
    description: `SECURITY FIX: Read the file tasks/security_fixes/missing_validation.py which has no input validation (int(data['age']) can crash on bad input). Fix process_user to validate: data must be a dict, 'name' must be a non-empty string, 'age' must be convertible to int and between 0-150. Return {'error': message} on invalid input. Use file_write to save the fixed version.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security_fixes.missing_validation import process_user; r=process_user({'name':'Alice','age':'30'}); assert r.get('name')=='Alice' or r.get('age')==30; r2=process_user({'name':'','age':'30'}); assert 'error' in r2; r3=process_user({'name':'Bob','age':'abc'}); assert 'error' in r3; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'fix_info_leak', section: 4, complexity: 6, category: 'bugfix',
    dir: 'security_fixes', files: 1,
    description: `SECURITY FIX: Read the file tasks/security_fixes/info_leak.py which leaks error details via str(e). Fix divide to return a generic error message like {'error': 'division error'} instead of exposing internal exception details. Return the result as a number on success. Use file_write to save the fixed version.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security_fixes.info_leak import divide; r=divide(10,2); assert r==5 or r==5.0; r2=divide(1,0); assert isinstance(r2,dict); assert 'error' in r2; assert 'division' in str(r2).lower() or 'zero' in str(r2).lower() or 'error' in str(r2).lower(); print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'fix_open_redirect', section: 4, complexity: 7, category: 'bugfix',
    dir: 'security_fixes', files: 1,
    description: `SECURITY FIX: Read the file tasks/security_fixes/open_redirect.py which allows redirecting to any URL (open redirect). Fix redirect(url) to only allow redirects to relative URLs (starting with /) or a whitelist of allowed domains. For invalid URLs, return {'status': 400, 'error': 'invalid redirect'}. Use file_write to save the fixed version.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security_fixes.open_redirect import redirect; r=redirect('/dashboard'); assert r['status']==302 or r.get('location')=='/dashboard'; r2=redirect('https://evil.com'); assert r2.get('status')==400 or 'error' in r2; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'fix_type_confusion', section: 4, complexity: 7, category: 'bugfix',
    dir: 'security_fixes', files: 1,
    description: `SECURITY FIX: Read the file tasks/security_fixes/type_confusion.py which has a type confusion bug (comparing role to True with ==). Fix is_admin(user) to strictly check that user['role'] is the string 'admin' only. Use isinstance check or explicit type comparison. Use file_write to save the fixed version.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.security_fixes.type_confusion import is_admin; assert is_admin({'role':'admin'})==True; assert is_admin({'role':'user'})==False; assert is_admin({'role':True})==False; assert is_admin({'role':1})==False; assert is_admin({})==False; print('PASS')`,
    validationLang: 'py'
  },
];

// =============================================================================
// SECTION 5: BONUS — 20 tasks (5 TS + 5 Go + 5 Py data + 5 mini projects)
// =============================================================================

const SECTION_5 = [
  // --- TypeScript Utilities (5 tasks) — Dir: tasks/ts_utils/ ---
  // Self-testing: each file runs its own tests and prints PASS
  {
    name: 'ts_result', section: 5, complexity: 7, category: 'typescript',
    dir: 'ts_utils', files: 1, fileName: 'result.ts',
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/ts_utils/result.ts with this content:
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function ok<T>(value: T): Result<T, never> { return { ok: true, value }; }
function err<E>(error: E): Result<never, E> { return { ok: false, error }; }
function map<T, U, E>(r: Result<T, E>, fn: (v: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : r;
}
function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw new Error('unwrap on Err');
}

// Self-test
const r1 = ok(42);
if (!r1.ok || r1.value !== 42) throw new Error('fail ok');
const r2 = err('bad');
if (r2.ok) throw new Error('fail err');
const r3 = map(ok(5), (x: number) => x * 2);
if (!r3.ok || r3.value !== 10) throw new Error('fail map');
try { unwrap(err('x')); throw new Error('should throw'); } catch(e: any) { if (!e.message.includes('unwrap')) throw e; }
console.log('PASS');

DO NOT just output the code - you MUST call file_write.`,
    validation: null,
    validationLang: 'tsx'
  },
  {
    name: 'ts_pipe', section: 5, complexity: 7, category: 'typescript',
    dir: 'ts_utils', files: 1, fileName: 'pipe.ts',
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/ts_utils/pipe.ts with this content:
function pipe(...fns: Array<(x: any) => any>) {
  return (input: any) => fns.reduce((acc, fn) => fn(acc), input);
}

// Self-test
const double = (x: number) => x * 2;
const addOne = (x: number) => x + 1;
const toString = (x: number) => String(x);

const transform = pipe(double, addOne, toString);
if (transform(5) !== '11') throw new Error('fail pipe');
const identity = pipe();
if (identity(42) !== 42) throw new Error('fail empty pipe');
const single = pipe(double);
if (single(3) !== 6) throw new Error('fail single');
console.log('PASS');

DO NOT just output the code - you MUST call file_write.`,
    validation: null,
    validationLang: 'tsx'
  },
  {
    name: 'ts_deep_clone', section: 5, complexity: 7, category: 'typescript',
    dir: 'ts_utils', files: 1, fileName: 'deepClone.ts',
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/ts_utils/deepClone.ts with this content:
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as any;
  const result: any = {};
  for (const key of Object.keys(obj as any)) {
    result[key] = deepClone((obj as any)[key]);
  }
  return result;
}

// Self-test
const orig = { a: 1, b: { c: [1, 2, 3] }, d: new Date('2026-01-01') };
const clone = deepClone(orig);
if (clone.a !== 1 || clone.b.c[0] !== 1) throw new Error('fail values');
clone.b.c.push(4);
if (orig.b.c.length !== 3) throw new Error('fail independence');
if (!(clone.d instanceof Date)) throw new Error('fail date type');
if (clone.d.getTime() !== orig.d.getTime()) throw new Error('fail date value');
console.log('PASS');

DO NOT just output the code - you MUST call file_write.`,
    validation: null,
    validationLang: 'tsx'
  },
  {
    name: 'ts_event_bus', section: 5, complexity: 8, category: 'typescript',
    dir: 'ts_utils', files: 1, fileName: 'eventBus.ts',
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/ts_utils/eventBus.ts with this content:
type Handler = (...args: any[]) => void;

class EventBus {
  private listeners: Map<string, Array<{ fn: Handler; once: boolean }>> = new Map();

  on(event: string, fn: Handler): this {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push({ fn, once: false });
    return this;
  }

  once(event: string, fn: Handler): this {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push({ fn, once: true });
    return this;
  }

  off(event: string, fn: Handler): this {
    const list = this.listeners.get(event);
    if (list) this.listeners.set(event, list.filter(l => l.fn !== fn));
    return this;
  }

  emit(event: string, ...args: any[]): this {
    const list = this.listeners.get(event);
    if (!list) return this;
    const remaining = list.filter(l => { l.fn(...args); return !l.once; });
    this.listeners.set(event, remaining);
    return this;
  }
}

// Self-test
const bus = new EventBus();
let count = 0;
const inc = () => { count++; };
bus.on('test', inc);
bus.emit('test');
bus.emit('test');
if (count !== 2) throw new Error('fail on');
bus.off('test', inc);
bus.emit('test');
if (count !== 2) throw new Error('fail off');
let onceCount = 0;
bus.once('x', () => { onceCount++; });
bus.emit('x');
bus.emit('x');
if (onceCount !== 1) throw new Error('fail once');
console.log('PASS');

DO NOT just output the code - you MUST call file_write.`,
    validation: null,
    validationLang: 'tsx'
  },
  {
    name: 'ts_maybe', section: 5, complexity: 7, category: 'typescript',
    dir: 'ts_utils', files: 1, fileName: 'maybe.ts',
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/ts_utils/maybe.ts with this content:
class Maybe<T> {
  private constructor(private value: T | null) {}

  static of<T>(value: T | null | undefined): Maybe<T> {
    return new Maybe<T>(value === undefined ? null : value);
  }

  map<U>(fn: (v: T) => U): Maybe<U> {
    if (this.value === null) return Maybe.of<U>(null);
    return Maybe.of(fn(this.value));
  }

  flatMap<U>(fn: (v: T) => Maybe<U>): Maybe<U> {
    if (this.value === null) return Maybe.of<U>(null);
    return fn(this.value);
  }

  getOrElse(defaultVal: T): T {
    return this.value !== null ? this.value : defaultVal;
  }

  isNothing(): boolean { return this.value === null; }
}

// Self-test
const m1 = Maybe.of(5).map(x => x * 2);
if (m1.getOrElse(0) !== 10) throw new Error('fail map');
const m2 = Maybe.of<number>(null).map(x => x * 2);
if (m2.getOrElse(99) !== 99) throw new Error('fail nothing');
const m3 = Maybe.of(3).flatMap(x => Maybe.of(x + 1));
if (m3.getOrElse(0) !== 4) throw new Error('fail flatMap');
if (!Maybe.of(null).isNothing()) throw new Error('fail isNothing');
console.log('PASS');

DO NOT just output the code - you MUST call file_write.`,
    validation: null,
    validationLang: 'tsx'
  },

  // --- Go CLI Tools (5 tasks) — Dir: tasks/go_tools/ ---
  // Self-testing: each file is package main with main() that prints PASS
  {
    name: 'go_word_count', section: 5, complexity: 6, category: 'go',
    dir: 'go_tools', files: 1, fileName: 'word_count.go',
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/go_tools/word_count.go with this content:
package main

import (
\t"fmt"
\t"strings"
)

func wordCount(s string) int {
\treturn len(strings.Fields(s))
}

func lineCount(s string) int {
\tif s == "" { return 0 }
\treturn len(strings.Split(s, "\\n"))
}

func charCount(s string) int {
\tcount := 0
\tfor _, c := range s {
\t\tif c != ' ' && c != '\\n' && c != '\\t' {
\t\t\tcount++
\t\t}
\t}
\treturn count
}

func main() {
\tif wordCount("hello world") != 2 { panic("fail wordCount") }
\tif wordCount("") != 0 { panic("fail empty") }
\tif lineCount("a\\nb\\nc") != 3 { panic("fail lineCount") }
\tif charCount("a b c") != 3 { panic("fail charCount") }
\tfmt.Println("PASS")
}

DO NOT just output the code - you MUST call file_write.`,
    validation: null,
    validationLang: 'go'
  },
  {
    name: 'go_fizzbuzz', section: 5, complexity: 5, category: 'go',
    dir: 'go_tools', files: 1, fileName: 'fizzbuzz.go',
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/go_tools/fizzbuzz.go with this content:
package main

import "fmt"

func fizzbuzz(n int) string {
\tif n%15 == 0 { return "FizzBuzz" }
\tif n%3 == 0 { return "Fizz" }
\tif n%5 == 0 { return "Buzz" }
\treturn fmt.Sprintf("%d", n)
}

func main() {
\tif fizzbuzz(15) != "FizzBuzz" { panic("fail 15") }
\tif fizzbuzz(9) != "Fizz" { panic("fail 9") }
\tif fizzbuzz(10) != "Buzz" { panic("fail 10") }
\tif fizzbuzz(7) != "7" { panic("fail 7") }
\tfmt.Println("PASS")
}

DO NOT just output the code - you MUST call file_write.`,
    validation: null,
    validationLang: 'go'
  },
  {
    name: 'go_stack', section: 5, complexity: 8, category: 'go',
    dir: 'go_tools', files: 1, fileName: 'stack.go',
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/go_tools/stack.go with this content:
package main

import "fmt"

type Stack struct {
\titems []int
}

func (s *Stack) Push(item int) {
\ts.items = append(s.items, item)
}

func (s *Stack) Pop() (int, bool) {
\tif len(s.items) == 0 { return 0, false }
\tval := s.items[len(s.items)-1]
\ts.items = s.items[:len(s.items)-1]
\treturn val, true
}

func (s *Stack) Peek() (int, bool) {
\tif len(s.items) == 0 { return 0, false }
\treturn s.items[len(s.items)-1], true
}

func (s *Stack) Size() int { return len(s.items) }
func (s *Stack) IsEmpty() bool { return len(s.items) == 0 }

func main() {
\ts := &Stack{}
\tif !s.IsEmpty() { panic("fail empty") }
\ts.Push(1)
\ts.Push(2)
\tv, ok := s.Peek()
\tif !ok || v != 2 { panic("fail peek") }
\tif s.Size() != 2 { panic("fail size") }
\tv, ok = s.Pop()
\tif !ok || v != 2 { panic("fail pop") }
\tv, ok = s.Pop()
\tif !ok || v != 1 { panic("fail pop2") }
\t_, ok = s.Pop()
\tif ok { panic("fail empty pop") }
\tfmt.Println("PASS")
}

DO NOT just output the code - you MUST call file_write.`,
    validation: null,
    validationLang: 'go'
  },
  {
    name: 'go_csv_parser', section: 5, complexity: 7, category: 'go',
    dir: 'go_tools', files: 1, fileName: 'csv_parser.go',
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/go_tools/csv_parser.go with this content:
package main

import (
\t"fmt"
\t"strings"
)

func parseCSV(input string) [][]string {
\tvar result [][]string
\tlines := strings.Split(strings.TrimSpace(input), "\\n")
\tfor _, line := range lines {
\t\tif line == "" { continue }
\t\tfields := strings.Split(line, ",")
\t\tfor i := range fields {
\t\t\tfields[i] = strings.TrimSpace(fields[i])
\t\t}
\t\tresult = append(result, fields)
\t}
\treturn result
}

func main() {
\tdata := parseCSV("name,age\\nAlice,30\\nBob,25")
\tif len(data) != 3 { panic("fail rows") }
\tif data[0][0] != "name" { panic("fail header") }
\tif data[1][0] != "Alice" { panic("fail data") }
\tif data[2][1] != "25" { panic("fail data2") }
\tfmt.Println("PASS")
}

DO NOT just output the code - you MUST call file_write.`,
    validation: null,
    validationLang: 'go'
  },
  {
    name: 'go_slug', section: 5, complexity: 6, category: 'go',
    dir: 'go_tools', files: 1, fileName: 'slug.go',
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/go_tools/slug.go with this content:
package main

import (
\t"fmt"
\t"regexp"
\t"strings"
)

func slugify(s string) string {
\ts = strings.ToLower(strings.TrimSpace(s))
\treg := regexp.MustCompile("[^a-z0-9\\\\s-]")
\ts = reg.ReplaceAllString(s, "")
\treg2 := regexp.MustCompile("[\\\\s-]+")
\ts = reg2.ReplaceAllString(s, "-")
\ts = strings.Trim(s, "-")
\treturn s
}

func main() {
\tif slugify("Hello World") != "hello-world" { panic("fail basic") }
\tif slugify("  Foo  Bar  ") != "foo-bar" { panic("fail spaces") }
\tif slugify("Go is Great!") != "go-is-great" { panic("fail special") }
\tfmt.Println("PASS")
}

DO NOT just output the code - you MUST call file_write.`,
    validation: null,
    validationLang: 'go'
  },

  // --- Python Data Pipelines (5 tasks) — Dir: tasks/py_data/ ---
  {
    name: 'py_csv_transform', section: 5, complexity: 7, category: 'py_data',
    dir: 'py_data', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_data/csv_transform.py with this content:
def parse_csv(text, delimiter=','):
    lines = text.strip().split('\\n')
    if not lines:
        return []
    headers = [h.strip() for h in lines[0].split(delimiter)]
    rows = []
    for line in lines[1:]:
        values = [v.strip() for v in line.split(delimiter)]
        row = dict(zip(headers, values))
        rows.append(row)
    return rows

def filter_rows(rows, predicate):
    return [r for r in rows if predicate(r)]

def transform(rows, fn):
    return [fn(r) for r in rows]

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_data.csv_transform import parse_csv, filter_rows, transform; rows=parse_csv('name,age\\nAlice,30\\nBob,25\\nCarol,35'); assert len(rows)==3; assert rows[0]['name']=='Alice'; f=filter_rows(rows,lambda r:int(r['age'])>=30); assert len(f)==2; t=transform(rows,lambda r:r['name'].upper()); assert t==['ALICE','BOB','CAROL']; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_aggregator', section: 5, complexity: 7, category: 'py_data',
    dir: 'py_data', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_data/aggregator.py with this content:
def group_by(items, key_fn):
    groups = {}
    for item in items:
        k = key_fn(item)
        if k not in groups:
            groups[k] = []
        groups[k].append(item)
    return groups

def aggregate(groups, agg_fn):
    result = {}
    for key, items in groups.items():
        result[key] = agg_fn(items)
    return result

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_data.aggregator import group_by, aggregate; data=[{'cat':'A','val':10},{'cat':'B','val':20},{'cat':'A','val':30}]; g=group_by(data,lambda x:x['cat']); assert len(g['A'])==2; assert len(g['B'])==1; a=aggregate(g,lambda items:sum(i['val'] for i in items)); assert a['A']==40; assert a['B']==20; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_data_validator', section: 5, complexity: 7, category: 'py_data',
    dir: 'py_data', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_data/schema_validator.py with this content:
class Schema:
    def __init__(self):
        self.rules = {}

    def required(self, field):
        if field not in self.rules:
            self.rules[field] = {}
        self.rules[field]['required'] = True
        return self

    def string(self, field):
        if field not in self.rules:
            self.rules[field] = {}
        self.rules[field]['type'] = 'string'
        return self

    def number(self, field):
        if field not in self.rules:
            self.rules[field] = {}
        self.rules[field]['type'] = 'number'
        return self

    def validate(self, data):
        errors = []
        for field, rule in self.rules.items():
            if rule.get('required') and field not in data:
                errors.append(f'{field} is required')
                continue
            if field not in data:
                continue
            val = data[field]
            ftype = rule.get('type')
            if ftype == 'string' and not isinstance(val, str):
                errors.append(f'{field} must be a string')
            elif ftype == 'number' and not isinstance(val, (int, float)):
                errors.append(f'{field} must be a number')
        return {'valid': len(errors) == 0, 'errors': errors}

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_data.schema_validator import Schema; s=Schema().required('name').string('name').required('age').number('age'); r=s.validate({'name':'Alice','age':30}); assert r['valid']==True; r2=s.validate({}); assert r2['valid']==False; assert len(r2['errors'])>=2; r3=s.validate({'name':123,'age':'bad'}); assert r3['valid']==False; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_frequency', section: 5, complexity: 6, category: 'py_data',
    dir: 'py_data', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_data/frequency.py with this content:
def char_frequency(text):
    freq = {}
    for c in text.lower():
        if c.isalpha():
            freq[c] = freq.get(c, 0) + 1
    return freq

def top_n(freq, n=5):
    sorted_items = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return sorted_items[:n]

def histogram(freq, max_width=20):
    if not freq:
        return ''
    max_val = max(freq.values())
    lines = []
    for char, count in sorted(freq.items()):
        bar_len = int(count / max_val * max_width)
        lines.append(f'{char} |{"#" * bar_len} ({count})')
    return '\\n'.join(lines)

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_data.frequency import char_frequency, top_n, histogram; f=char_frequency('hello'); assert f['l']==2; assert f['h']==1; t=top_n(f,2); assert t[0][0]=='l'; h=histogram({'a':3,'b':1}); assert '#' in h; assert 'a' in h; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'py_text_pipeline', section: 5, complexity: 8, category: 'py_data',
    dir: 'py_data', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/py_data/pipeline.py with this content:
class Pipeline:
    def __init__(self):
        self.steps = []

    def add_step(self, fn):
        self.steps.append(fn)
        return self

    def execute(self, data):
        result = data
        for step in self.steps:
            result = step(result)
        return result

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.py_data.pipeline import Pipeline; p=Pipeline(); p.add_step(lambda x:x.lower()).add_step(lambda x:x.strip()).add_step(lambda x:x.replace(' ','-')); assert p.execute('  Hello World  ')=='hello-world'; p2=Pipeline(); assert p2.execute('unchanged')=='unchanged'; print('PASS')`,
    validationLang: 'py'
  },

  // --- Real-World Mini Projects (5 tasks) — Dir: tasks/mini_projects/ ---
  {
    name: 'mini_todo_cli', section: 5, complexity: 8, category: 'mini',
    dir: 'mini_projects', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/mini_projects/todo_cli.py with this content:
class TodoApp:
    def __init__(self):
        self._todos = []
        self._next_id = 1

    def add(self, title):
        todo = {'id': self._next_id, 'title': title, 'done': False}
        self._todos.append(todo)
        self._next_id += 1
        return todo

    def list(self, show_done=True):
        if show_done:
            return list(self._todos)
        return [t for t in self._todos if not t['done']]

    def done(self, todo_id):
        for t in self._todos:
            if t['id'] == todo_id:
                t['done'] = True
                return True
        return False

    def remove(self, todo_id):
        before = len(self._todos)
        self._todos = [t for t in self._todos if t['id'] != todo_id]
        return len(self._todos) < before

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.mini_projects.todo_cli import TodoApp; app=TodoApp(); t=app.add('Buy milk'); assert t['title']=='Buy milk'; app.add('Walk dog'); assert len(app.list())==2; app.done(t['id']); assert len(app.list(show_done=False))==1; app.remove(t['id']); assert len(app.list())==1; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'mini_calculator', section: 5, complexity: 7, category: 'mini',
    dir: 'mini_projects', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/mini_projects/calculator.py with this content:
class Calculator:
    def __init__(self):
        self.memory = 0
        self.last_result = 0

    def add(self, a, b):
        self.last_result = a + b
        return self.last_result

    def subtract(self, a, b):
        self.last_result = a - b
        return self.last_result

    def multiply(self, a, b):
        self.last_result = a * b
        return self.last_result

    def divide(self, a, b):
        if b == 0:
            return None
        self.last_result = a / b
        return self.last_result

    def store(self):
        self.memory = self.last_result

    def recall(self):
        return self.memory

    def clear(self):
        self.memory = 0
        self.last_result = 0

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.mini_projects.calculator import Calculator; c=Calculator(); assert c.add(2,3)==5; assert c.subtract(10,4)==6; assert c.multiply(3,4)==12; assert c.divide(10,2)==5.0; assert c.divide(1,0) is None; c.add(42,0); c.store(); assert c.recall()==42; c.clear(); assert c.recall()==0; print('PASS')`,
    validationLang: 'py'
  },
  {
    name: 'mini_markdown', section: 5, complexity: 8, category: 'mini',
    dir: 'mini_projects', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/mini_projects/markdown.js with this content:
function renderMarkdown(md) {
  var lines = md.split('\\n');
  var html = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    // Headers
    if (line.startsWith('### ')) { html.push('<h3>' + line.substring(4) + '</h3>'); continue; }
    if (line.startsWith('## ')) { html.push('<h2>' + line.substring(3) + '</h2>'); continue; }
    if (line.startsWith('# ')) { html.push('<h1>' + line.substring(2) + '</h1>'); continue; }
    // Bold
    line = line.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
    // Italic
    line = line.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
    // Links
    line = line.replace(/\\[(.+?)\\]\\((.+?)\\)/g, '<a href="$2">$1</a>');
    // List items
    if (line.startsWith('- ')) { html.push('<li>' + line.substring(2) + '</li>'); continue; }
    if (line.trim()) html.push('<p>' + line + '</p>');
  }
  return html.join('\\n');
}

module.exports = { renderMarkdown };

DO NOT just output the code - you MUST call file_write.`,
    validation: `var m=require('./tasks/mini_projects/markdown'); var r=m.renderMarkdown('# Hello'); if(!r.includes('<h1>Hello</h1>')) process.exit(1); var r2=m.renderMarkdown('**bold** and *italic*'); if(!r2.includes('<strong>bold</strong>')) process.exit(1); if(!r2.includes('<em>italic</em>')) process.exit(1); var r3=m.renderMarkdown('[link](http://x.com)'); if(!r3.includes('href')) process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'mini_config', section: 5, complexity: 7, category: 'mini',
    dir: 'mini_projects', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/mini_projects/config.js with this content:
function ConfigManager(defaults) {
  this._data = {};
  if (defaults) {
    var keys = Object.keys(defaults);
    for (var i = 0; i < keys.length; i++) {
      this._data[keys[i]] = defaults[keys[i]];
    }
  }
}

ConfigManager.prototype.get = function(key, fallback) {
  if (this._data.hasOwnProperty(key)) return this._data[key];
  return fallback !== undefined ? fallback : undefined;
};

ConfigManager.prototype.set = function(key, value) {
  this._data[key] = value;
  return this;
};

ConfigManager.prototype.has = function(key) {
  return this._data.hasOwnProperty(key);
};

ConfigManager.prototype.delete = function(key) {
  if (this._data.hasOwnProperty(key)) {
    delete this._data[key];
    return true;
  }
  return false;
};

ConfigManager.prototype.toObject = function() {
  var result = {};
  var keys = Object.keys(this._data);
  for (var i = 0; i < keys.length; i++) {
    result[keys[i]] = this._data[keys[i]];
  }
  return result;
};

module.exports = ConfigManager;

DO NOT just output the code - you MUST call file_write.`,
    validation: `var CM=require('./tasks/mini_projects/config'); var c=new CM({port:3000,host:'localhost'}); if(c.get('port')!==3000) process.exit(1); if(!c.has('host')) process.exit(1); c.set('debug',true); if(c.get('debug')!==true) process.exit(1); c.delete('debug'); if(c.has('debug')) process.exit(1); if(c.get('missing','default')!=='default') process.exit(1); console.log('PASS')`,
    validationLang: 'node'
  },
  {
    name: 'mini_state_machine', section: 5, complexity: 8, category: 'mini',
    dir: 'mini_projects', files: 1,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/mini_projects/state_machine.py with this content:
class StateMachine:
    def __init__(self, initial_state):
        self.current = initial_state
        self.states = set()
        self.transitions = {}
        self.states.add(initial_state)

    def add_state(self, name):
        self.states.add(name)
        return self

    def add_transition(self, from_state, event, to_state):
        key = (from_state, event)
        self.transitions[key] = to_state
        self.states.add(from_state)
        self.states.add(to_state)
        return self

    def trigger(self, event):
        key = (self.current, event)
        if key not in self.transitions:
            raise ValueError(f"No transition from '{self.current}' on '{event}'")
        self.current = self.transitions[key]
        return self.current

    def get_state(self):
        return self.current

DO NOT just output the code - you MUST call file_write.`,
    validation: `import sys; sys.path.insert(0,'/app/workspace'); from tasks.mini_projects.state_machine import StateMachine; sm=StateMachine('idle'); sm.add_transition('idle','start','running'); sm.add_transition('running','pause','paused'); sm.add_transition('paused','resume','running'); sm.add_transition('running','stop','idle'); assert sm.get_state()=='idle'; sm.trigger('start'); assert sm.get_state()=='running'; sm.trigger('pause'); assert sm.get_state()=='paused'; sm.trigger('resume'); assert sm.get_state()=='running'; sm.trigger('stop'); assert sm.get_state()=='idle'
try:
    sm.trigger('invalid')
    assert False
except ValueError:
    pass
print('PASS')`,
    validationLang: 'py'
  },
];

// =============================================================================
// ASSEMBLE ALL TASKS
// =============================================================================

const ALL_SECTIONS = {
  1: { name: 'React App', tasks: SECTION_1A, cto: CTO_BRIEFS },
  2: { name: 'Landing Pages', tasks: SECTION_2 },
  3: { name: 'Web Server', tasks: SECTION_3 },
  4: { name: 'Security', tasks: [...SECTION_4A, ...SECTION_4B] },
  5: { name: 'Bonus', tasks: SECTION_5 },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getOllamaModel(complexity) {
  if (complexity >= 9) return 'qwen2.5-coder:32k';
  if (complexity >= 7) return 'qwen2.5-coder:16k';
  return 'qwen2.5-coder:8k';
}

function getComplexityColor(c) {
  if (c <= 2) return '\x1b[32m';
  if (c <= 4) return '\x1b[36m';
  if (c <= 6) return '\x1b[33m';
  if (c <= 8) return '\x1b[35m';
  return '\x1b[31m';
}

function getCategoryLabel(cat) {
  const labels = {
    react: '\u{1f4a0} REACT', react_cto: '\u{1f916} CTO-REACT',
    landing: '\u{1f310} LANDING',
    py_api: '\u{1f40d} PY-API', node_api: '\u{1f7e2} NODE-API',
    security: '\u{1f512} SECURE', bugfix: '\u{1f41b} BUGFIX',
    typescript: '\u{1f535} TS', go: '\u{1f7e1} GO',
    py_data: '\u{1f4ca} PY-DATA', mini: '\u{2b50} MINI',
  };
  return labels[cat] || cat;
}

const RST = '\x1b[0m';

// =============================================================================
// WORKSPACE SETUP
// =============================================================================

async function resetSystem() {
  console.log('\u{1f504} Resetting system...');

  try {
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    console.log('   \u2713 Agents reset');
  } catch (e) {
    console.log('   \u26a0 Could not reset agents');
  }

  // Create all task directories with __init__.py (one at a time to avoid Windows shell issues)
  let dirsCreated = 0;
  for (const d of ALL_DIRS) {
    try {
      execSync(`docker exec abcc-agents sh -c "rm -rf /app/workspace/tasks/${d} && mkdir -p /app/workspace/tasks/${d} && touch /app/workspace/tasks/${d}/__init__.py"`, { stdio: 'pipe' });
      dirsCreated++;
    } catch (e) {
      console.log(`   \u26a0 Could not create ${d}: ${e.message.substring(0, 60)}`);
    }
  }
  try {
    execSync(`docker exec abcc-agents sh -c "touch /app/workspace/tasks/__init__.py"`, { stdio: 'pipe' });
  } catch (e) {}
  console.log(`   \u2713 Workspace cleaned (${dirsCreated}/${ALL_DIRS.length} directories created)`);

  await sleep(2000);
}

// =============================================================================
// BUG-FIX FILE SEEDER
// =============================================================================

function seedBuggyFiles() {
  console.log('\n\u{1f41b} Seeding buggy files for Section 4B...');
  // Ensure directory exists
  try {
    execSync(`docker exec abcc-agents sh -c "mkdir -p /app/workspace/tasks/security_fixes && touch /app/workspace/tasks/security_fixes/__init__.py && touch /app/workspace/tasks/__init__.py"`, { stdio: 'pipe' });
  } catch (e) {}
  let seeded = 0;
  for (const [filename, content] of Object.entries(BUGGY_FILES)) {
    try {
      const b64 = Buffer.from(content).toString('base64');
      execSync(`docker exec abcc-agents sh -c "echo '${b64}' | base64 -d > /app/workspace/tasks/security_fixes/${filename}"`, { stdio: 'pipe' });
      seeded++;
    } catch (e) {
      console.log(`   \u26a0 Failed to seed ${filename}: ${e.message.substring(0, 60)}`);
    }
  }
  // Verify seeding
  try {
    const files = execSync(`docker exec abcc-agents sh -c "ls /app/workspace/tasks/security_fixes/*.py 2>/dev/null | wc -l"`, { encoding: 'utf8' }).trim();
    console.log(`   \u2713 Seeded ${seeded}/${Object.keys(BUGGY_FILES).length} buggy files (${files} .py files on disk)`);
  } catch (e) {
    console.log(`   \u2713 Seeded ${seeded}/${Object.keys(BUGGY_FILES).length} buggy files`);
  }
}

// =============================================================================
// TASK CREATION & EXECUTION
// =============================================================================

/**
 * Build a validationCommand suitable for the server-side /run-validation endpoint.
 * The endpoint runs inside the agents container, so no `docker exec` needed.
 */
function buildValidationCommand(task) {
  if (!task.validation) return null;
  const lang = task.validationLang || 'py';
  if (lang === 'tsx') {
    const fileName = task.fileName || `${task.name}.ts`;
    return `tsx tasks/${task.dir}/${fileName}`;
  }
  if (lang === 'go') {
    const fileName = task.fileName || `${task.name}.go`;
    return `go run tasks/${task.dir}/${fileName}`;
  }
  // Prepend LANG= prefix so server knows the correct language
  // (description-based detection fails for React/HTML tasks with Python validation)
  const serverLang = lang === 'py' ? 'python' : lang === 'node' ? 'javascript' : 'python';
  return `LANG=${serverLang} ${task.validation}`;
}

/**
 * Detect validation language for the server endpoint
 */
function getValidationLang(task) {
  const lang = task.validationLang || 'py';
  if (lang === 'py') return 'python';
  if (lang === 'node') return 'javascript';
  if (lang === 'tsx') return 'typescript';
  if (lang === 'go') return 'go';
  return 'python';
}

async function createTask(task) {
  const validationCommand = buildValidationCommand(task);
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      title: `[U100-S${task.section}-C${task.complexity}] ${task.name}`,
      description: task.description,
      expectedOutput: `Files created in tasks/${task.dir || 'misc'}/`,
      taskType: 'code',
      priority: task.complexity,
      maxIterations: MAX_ITERATIONS,
      // Pass validationCommand for server-side async validation pipeline
      validationCommand: validationCommand || undefined,
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.status}`);
  }
  return response.json();
}

async function executeTask(taskId, description, complexity) {
  const model = getOllamaModel(complexity);
  console.log(`   Model: ${model}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TASK_TIMEOUT_MS);
  try {
    const response = await fetch(`${AGENTS_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        task_id: taskId,
        agent_id: 'coder-01',
        task_description: description,
        use_claude: false,
        model: model
      })
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
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

// =============================================================================
// CLIENT-SIDE VALIDATION (fallback when server async validation unavailable)
// =============================================================================

function runValidationLocal(task) {
  try {
    let cmd;
    const lang = task.validationLang || 'py';

    if (lang === 'tsx') {
      const fileName = task.fileName || `${task.name}.ts`;
      const filePath = `tasks/${task.dir}/${fileName}`;
      cmd = `docker exec -w /app/workspace abcc-agents tsx ${filePath}`;
    } else if (lang === 'go') {
      const fileName = task.fileName || `${task.name}.go`;
      const filePath = `tasks/${task.dir}/${fileName}`;
      cmd = `docker exec -w /app/workspace abcc-agents go run ${filePath}`;
    } else if (lang === 'node') {
      const b64 = Buffer.from(task.validation).toString('base64');
      cmd = `docker exec -w /app/workspace abcc-agents node -e "eval(Buffer.from('${b64}','base64').toString())"`;
    } else {
      const b64 = Buffer.from(task.validation).toString('base64');
      cmd = `docker exec -w /app/workspace abcc-agents python3 -c "import base64; exec(base64.b64decode('${b64}').decode())"`;
    }

    const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
    return result.includes('PASS');
  } catch (e) {
    return false;
  }
}

// =============================================================================
// SERVER-SIDE ASYNC VALIDATION (polls /api/validation/results)
// =============================================================================

/**
 * Poll the server for a validation result. Background validation typically
 * completes in 1-3s after task completion.
 */
async function pollValidationResult(taskId, maxWaitMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const resp = await fetch(`${API_BASE}/validation/results?taskId=${taskId}`, {
        headers: { 'X-API-Key': API_KEY }
      });
      if (resp.ok) {
        const result = await resp.json();
        if (result && result.validatedAt) {
          return result; // { taskId, passed, error, validatedAt }
        }
      }
    } catch (e) {}
    await sleep(500);
  }
  return null; // Timed out waiting
}

/**
 * Check if the server has async validation enabled
 */
async function checkAsyncValidationAvailable() {
  try {
    const resp = await fetch(`${API_BASE}/validation/status`, {
      headers: { 'X-API-Key': API_KEY }
    });
    return resp.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Process the server-side retry queue (non-blocking).
 * Kicks off retries in background, polls for completion, returns final results.
 */
async function processRetryQueue() {
  try {
    // 1. Kick off retry processing (returns immediately)
    const startResp = await fetch(`${API_BASE}/validation/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    });
    if (!startResp.ok) return null;
    const startResult = await startResp.json();
    if (!startResult.started) {
      console.log(`   No retries to process`);
      return null;
    }
    console.log(`   Retry queue started (${startResult.count} entries)...`);

    // 2. Poll status until retryInProgress is false (up to 20 min)
    const maxWaitMs = 20 * 60 * 1000;
    const pollStart = Date.now();
    while (Date.now() - pollStart < maxWaitMs) {
      await sleep(5000);
      const status = await getValidationStatus();
      if (status && !status.retryInProgress) {
        console.log(`   Retry queue complete (${Math.round((Date.now() - pollStart) / 1000)}s)`);
        break;
      }
      const elapsed = Math.round((Date.now() - pollStart) / 1000);
      console.log(`   ... retrying (${elapsed}s, ${status?.passed || '?'} passed, ${status?.failed || '?'} failed)`);
    }

    // 3. Fetch final retry results
    const resultsResp = await fetch(`${API_BASE}/validation/retry-results`, {
      headers: { 'X-API-Key': API_KEY },
    });
    if (!resultsResp.ok) return null;
    return resultsResp.json();
  } catch (e) {
    console.log(`   Retry queue error: ${e.message}`);
    return null;
  }
}

/**
 * Get current validation status from server
 */
async function getValidationStatus() {
  try {
    const resp = await fetch(`${API_BASE}/validation/status`, {
      headers: { 'X-API-Key': API_KEY }
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch (e) {
    return null;
  }
}

// =============================================================================
// CTO DECOMPOSITION FLOW
// =============================================================================

async function runCTODecomposition(brief, results) {
  console.log(`\n\u{1f916} CTO Decomposition: ${brief.name}`);
  console.log('\u2500'.repeat(50));

  // Create parent task
  try {
    const parentResponse = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({
        title: `[CTO-DECOMP] ${brief.name}`,
        description: brief.brief,
        taskType: 'decomposition',
        priority: 10,
        maxIterations: 5
      })
    });

    if (!parentResponse.ok) throw new Error('Failed to create parent task');
    const parent = await parentResponse.json();
    console.log(`   Parent: ${parent.id.substring(0, 8)}...`);

    // Attempt decomposition
    const decompResponse = await fetch(`${API_BASE}/task-planning/${parent.id}/decompose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY }
    });

    if (!decompResponse.ok) throw new Error(`Decomposition failed: ${decompResponse.status}`);
    const decompData = await decompResponse.json();
    console.log(`   Assigned to: ${decompData.assignedTo}`);

    // Execute the CTO agent to actually perform decomposition
    const decompReq = decompData.decompositionRequest;
    console.log('   Executing CTO agent (Claude) for decomposition...');
    const ctoExecResponse = await fetch(`${AGENTS_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: decompReq.task_id,
        agent_id: decompReq.agent_id,
        task_description: decompReq.task_description,
        expected_output: decompReq.expected_output,
        use_claude: true,
      })
    });

    if (!ctoExecResponse.ok) {
      const errText = await ctoExecResponse.text();
      throw new Error(`CTO execution failed: ${ctoExecResponse.status} ${errText.substring(0, 100)}`);
    }
    const ctoResult = await ctoExecResponse.json();
    console.log(`   CTO finished: success=${ctoResult.success}`);

    // Release CTO agent (only if complete_decomposition() didn't already do it)
    const parentCheck = await fetch(`${API_BASE}/tasks/${parent.id}`, {
      headers: { 'X-API-Key': API_KEY }
    }).then(r => r.json());
    if (parentCheck.status !== 'completed') {
      await fetch(`${API_BASE}/tasks/${parent.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ success: Boolean(ctoResult.success) })
      });
    } else {
      console.log('   CTO already completed parent task via complete_decomposition()');
      // Ensure CTO agent is idle
      await fetch(`${API_BASE}/agents/reset-all`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY }
      });
    }

    // Fetch subtasks created by CTO
    await sleep(2000); // Brief wait for DB consistency
    const subtasksResponse = await fetch(`${API_BASE}/task-planning/${parent.id}/subtasks`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const subtasksData = await subtasksResponse.json();
    let subtasks = subtasksData.subtasks || [];

    // If no subtasks from immediate fetch, poll briefly
    if (subtasks.length === 0) {
      console.log('   No subtasks yet, polling...');
      const pollStart = Date.now();
      while (Date.now() - pollStart < CTO_TIMEOUT_MS) {
        await sleep(5000);
        try {
          const taskResponse = await fetch(`${API_BASE}/tasks/${parent.id}`, {
            headers: { 'X-API-Key': API_KEY }
          });
          const taskData = await taskResponse.json();
          if (taskData.subTasks && taskData.subTasks.length > 0) {
            subtasks = taskData.subTasks;
            break;
          }
          if (taskData.status === 'completed' || taskData.status === 'failed') {
            break;
          }
        } catch (e) {}
        console.log('   ... waiting for subtasks');
      }
    }

    if (subtasks.length > 0) {
      console.log(`   \u2713 Got ${subtasks.length} subtasks from CTO`);
      // Execute each subtask
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i];
        console.log(`   [CTO ${i + 1}/${subtasks.length}] ${st.title || st.id.substring(0, 8)}`);
        // Execute as regular Ollama task
        try {
          await fetch(`${API_BASE}/queue/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
            body: JSON.stringify({ taskId: st.id, agentId: 'coder-01' })
          });
          const execResp = await executeTask(st.id, st.description || '', 7);
          const execJson = await execResp.json();
          await fetch(`${API_BASE}/tasks/${st.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
            body: JSON.stringify({ success: Boolean(execJson.success) })
          });
          await waitForAgent();
          results.ctoGenerated++;
          results.totalRun++;
          results.passed++;
          results.details.push({ task: st.title || st.id, section: 1, category: 'cto_decomposed', complexity: 7, status: 'passed', duration: 0 });
          console.log(`   \u2705 Subtask completed`);
        } catch (e) {
          results.ctoGenerated++;
          results.totalRun++;
          results.failed++;
          results.details.push({ task: st.title || st.id, section: 1, category: 'cto_decomposed', complexity: 7, status: 'failed', duration: 0 });
          console.log(`   \u274c Subtask failed: ${e.message.substring(0, 60)}`);
          // Wait for agent to become idle before next subtask
          await waitForAgent();
        }
        await sleep(REST_DELAY_MS);
      }
      return subtasks.length;
    }

    throw new Error('No subtasks generated within timeout');
  } catch (e) {
    console.log(`   \u26a0 CTO decomposition failed: ${e.message.substring(0, 80)}`);
    console.log('   Falling back to pre-defined tasks...');
    return 0; // Signal to use fallback
  }
}

// =============================================================================
// EXECUTION ENGINE
// =============================================================================

async function runTaskSequence(tasks, results, sectionNum) {
  for (let i = 0; i < tasks.length; i++) {
    if (MAX_TASKS_LIMIT && results.totalRun >= MAX_TASKS_LIMIT) {
      console.log(`\n\u23f9 Reached --max=${MAX_TASKS_LIMIT} limit, stopping.`);
      return;
    }

    const task = tasks[i];
    const globalNum = results.totalRun + 1;
    const color = getComplexityColor(task.complexity);
    const catLabel = getCategoryLabel(task.category);

    console.log(`\n[${globalNum}] ${color}C${task.complexity}${RST} ${catLabel} ${task.name}`);
    console.log('\u2500'.repeat(50));

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would execute: ${task.dir}/${task.name}`);
      results.totalRun++;
      results.details.push({ task: task.name, section: sectionNum, category: task.category, complexity: task.complexity, status: 'dry_run', duration: 0 });
      continue;
    }

    const taskStart = Date.now();
    let status = 'error';
    let error = null;

    // Initialize complexity bucket if needed
    if (!results.byComplexity[task.complexity]) {
      results.byComplexity[task.complexity] = { total: 0, passed: 0, failed: 0 };
    }
    if (!results.byCategory[task.category]) {
      results.byCategory[task.category] = { total: 0, passed: 0, failed: 0 };
    }
    if (!results.bySection[sectionNum]) {
      results.bySection[sectionNum] = { total: 0, passed: 0, failed: 0 };
    }

    results.byComplexity[task.complexity].total++;
    results.byCategory[task.category].total++;
    results.bySection[sectionNum].total++;

    try {
      const created = await createTask(task);
      console.log(`   Created: ${created.id.substring(0, 8)}...`);

      // Track taskId for this task (used for server-side validation lookup)
      task._taskId = created.id;

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

      const execJson = await execResponse.json();
      const execSuccess = Boolean(execJson.success);

      await fetch(`${API_BASE}/tasks/${created.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ success: execSuccess })
      });

      // Validation: use server-side async validation if available, else fall back to local
      let passed = false;
      if (results._asyncValidation && task.validation) {
        console.log('   Validating (server-side)...');
        const valResult = await pollValidationResult(created.id, 10000);
        if (valResult) {
          passed = valResult.passed;
          if (!passed) {
            console.log(`   Server validation error: ${(valResult.error || '').substring(0, 80)}`);
          }
        } else {
          // Server validation timed out, fall back to local
          console.log('   Server validation timed out, trying local...');
          passed = runValidationLocal(task);
        }
      } else if (task.validation) {
        console.log('   Validating (local)...');
        passed = runValidationLocal(task);
      } else {
        // No validation defined — consider passed if execution succeeded
        passed = execSuccess;
      }

      // No in-script retry — retries are deferred to the server-side retry queue
      if (passed) {
        status = 'passed';
        results.passed++;
        results.byComplexity[task.complexity].passed++;
        results.byCategory[task.category].passed++;
        results.bySection[sectionNum].passed++;
        console.log(`   ${color}\u2705 PASSED${RST} (${duration}s)`);
      } else {
        status = 'failed';
        results.failed++;
        results.byComplexity[task.complexity].failed++;
        results.byCategory[task.category].failed++;
        results.bySection[sectionNum].failed++;
        console.log(`   ${color}\u274c FAILED${RST} - validation failed (${duration}s)`);
      }

      await waitForAgent();

    } catch (e) {
      error = e.message;
      results.errors++;
      results.byComplexity[task.complexity].failed++;
      results.byCategory[task.category].failed++;
      results.bySection[sectionNum].failed++;
      console.log(`   \u{1f4a5} ERROR: ${e.message.substring(0, 80)}`);

      try {
        await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
      } catch (resetErr) {}
      await sleep(2000);
    }

    results.totalRun++;
    results.details.push({
      task: task.name, section: sectionNum, category: task.category,
      complexity: task.complexity, status, error,
      duration: Math.floor((Date.now() - taskStart) / 1000),
      taskId: task._taskId || null
    });

    // Rest delay
    if (i < tasks.length - 1) {
      console.log(`   \u{1f4a4} Resting ${REST_DELAY_MS / 1000}s...`);
      await sleep(REST_DELAY_MS);
    }

    // Agent reset every N tasks
    if ((results.totalRun) % RESET_EVERY_N_TASKS === 0 && i < tasks.length - 1) {
      console.log(`\n\u{1f504} Resetting agent (context clear after ${RESET_EVERY_N_TASKS} tasks)...`);
      try {
        await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
        console.log('   \u2713 Agent memory cleared');
      } catch (e) {
        console.log('   \u26a0 Could not reset agent');
      }
      await sleep(1000);
    }
  }
}

// =============================================================================
// RESULTS REPORTER
// =============================================================================

function printReport(results, totalDuration) {
  const successRate = results.totalRun > 0 ? Math.round((results.passed / results.totalRun) * 100) : 0;

  console.log('\n' + '\u2550'.repeat(70));
  console.log('\u{1f3c6} ULTIMATE 100-TASK STRESS TEST RESULTS');
  console.log('\u2550'.repeat(70));
  console.log(`   Total:      ${results.passed}/${results.totalRun} passed (${successRate}%)`);
  console.log(`   Failed:     ${results.failed} | Errors: ${results.errors}`);
  console.log(`   Retries:    ${results.retriesSaved} saved by ${results._asyncValidation ? 'server-side' : 'in-script'} retry`);
  if (results.ctoGenerated > 0) {
    console.log(`   CTO Tasks:  ${results.ctoGenerated} generated by decomposition`);
  }
  console.log(`   Duration:   ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);

  // By section
  console.log('\n\u{1f4c1} SUCCESS RATE BY SECTION:');
  console.log('\u2500'.repeat(50));
  const sectionNames = { 1: 'React App', 2: 'Landing Pages', 3: 'Web Server', 4: 'Security', 5: 'Bonus' };
  for (const [sec, stats] of Object.entries(results.bySection)) {
    if (stats.total === 0) continue;
    const rate = Math.round((stats.passed / stats.total) * 100);
    const bar = '\u2588'.repeat(Math.floor(rate / 10)) + '\u2591'.repeat(10 - Math.floor(rate / 10));
    console.log(`   S${sec} ${(sectionNames[sec] || '').padEnd(15)} ${bar} ${rate}% (${stats.passed}/${stats.total})`);
  }

  // By category
  console.log('\n\u{1f3f7}\ufe0f  SUCCESS RATE BY CATEGORY:');
  console.log('\u2500'.repeat(50));
  for (const [cat, stats] of Object.entries(results.byCategory)) {
    if (stats.total === 0) continue;
    const rate = Math.round((stats.passed / stats.total) * 100);
    const bar = '\u2588'.repeat(Math.floor(rate / 10)) + '\u2591'.repeat(10 - Math.floor(rate / 10));
    const label = getCategoryLabel(cat).padEnd(14);
    console.log(`   ${label} ${bar} ${rate}% (${stats.passed}/${stats.total})`);
  }

  // By complexity
  console.log('\n\u{1f4c8} SUCCESS RATE BY COMPLEXITY:');
  console.log('\u2500'.repeat(50));
  for (let c = 1; c <= 10; c++) {
    const stats = results.byComplexity[c];
    if (!stats || stats.total === 0) continue;
    const rate = Math.round((stats.passed / stats.total) * 100);
    const bar = '\u2588'.repeat(Math.floor(rate / 10)) + '\u2591'.repeat(10 - Math.floor(rate / 10));
    const color = getComplexityColor(c);
    console.log(`   C${c}: ${color}${bar}${RST} ${rate}% (${stats.passed}/${stats.total})`);
  }

  // Timing breakdown by section
  console.log('\n\u23f1\ufe0f  TIMING BY SECTION:');
  console.log('\u2500'.repeat(50));
  for (const sec of Object.keys(sectionNames)) {
    const taskTimes = results.details.filter(d => d.section == sec && d.status === 'passed');
    if (taskTimes.length === 0) continue;
    const avg = Math.round(taskTimes.reduce((s, t) => s + t.duration, 0) / taskTimes.length);
    const max = Math.max(...taskTimes.map(t => t.duration));
    const min = Math.min(...taskTimes.map(t => t.duration));
    console.log(`   S${sec} ${(sectionNames[sec] || '').padEnd(15)} avg ${avg}s | min ${min}s | max ${max}s (${taskTimes.length} passed)`);
  }

  // Failures detail
  const failures = results.details.filter(d => d.status !== 'passed' && d.status !== 'dry_run');
  if (failures.length > 0) {
    console.log('\n\u274c FAILURES:');
    console.log('\u2500'.repeat(50));
    for (const f of failures) {
      console.log(`   S${f.section} ${getCategoryLabel(f.category)} ${f.task} (C${f.complexity}) - ${f.status}${f.error ? ': ' + f.error.substring(0, 60) : ''}`);
    }
  }

  // Grade
  console.log('\n' + '\u2550'.repeat(70));
  if (successRate >= 95) {
    console.log('\u{1f3c6} GRADE: PRODUCTION READY (' + successRate + '% >= 95% target)');
  } else if (successRate >= 90) {
    console.log('\u{1f948} GRADE: NEAR PRODUCTION (' + successRate + '% - close to 95% target)');
  } else if (successRate >= 80) {
    console.log('\u{1f949} GRADE: GOOD (' + successRate + '% - needs improvement for production)');
  } else {
    console.log('\u26a0\ufe0f  GRADE: NEEDS WORK (' + successRate + '% - below 80%)');
  }
  console.log('\u2550'.repeat(70));
}

// =============================================================================
// MAIN ORCHESTRATOR
// =============================================================================

async function main() {
  console.log('\u2550'.repeat(70));
  console.log('\u{1f3c6} ULTIMATE 100-TASK STRESS TEST');
  console.log('\u2550'.repeat(70));
  console.log('Model: Dynamic (8K/16K/32K by complexity) | Full Pipeline Validation');

  const sectionsToRun = SECTION_FILTER ? [SECTION_FILTER] : [1, 2, 3, 4, 5];
  let totalExpected = 0;
  for (const s of sectionsToRun) {
    const sec = ALL_SECTIONS[s];
    if (sec) totalExpected += sec.tasks.length;
    if (s === 1 && !SKIP_CTO) totalExpected += 10; // CTO fallback count
  }

  console.log(`Sections: ${sectionsToRun.join(', ')} | Tasks: ~${totalExpected} | Skip CTO: ${SKIP_CTO}`);
  console.log(`Rest: ${REST_DELAY_MS / 1000}s | Reset every ${RESET_EVERY_N_TASKS} tasks | Retry: ${!NO_RETRY} (deferred)`);
  if (DRY_RUN) console.log('\u{1f4cb} DRY RUN MODE - no tasks will be executed');
  if (MAX_TASKS_LIMIT) console.log(`\u{1f522} Limited to first ${MAX_TASKS_LIMIT} tasks`);
  console.log('\u2550'.repeat(70) + '\n');

  // Check for server-side async validation
  let asyncValidationAvailable = false;
  if (!DRY_RUN) {
    asyncValidationAvailable = await checkAsyncValidationAvailable();
    if (asyncValidationAvailable) {
      console.log('\u2705 Server-side async validation: ENABLED');
      // Clear previous validation state
      await fetch(`${API_BASE}/validation/clear`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY }
      }).catch(() => {});
    } else {
      console.log('\u26a0 Server-side async validation: unavailable (using local validation)');
    }
  }

  if (!DRY_RUN) {
    await resetSystem();
  }

  const results = {
    totalRun: 0, passed: 0, failed: 0, errors: 0,
    retriesSaved: 0, ctoGenerated: 0,
    byComplexity: {}, byCategory: {}, bySection: {},
    details: [],
    _asyncValidation: asyncValidationAvailable  // internal flag for runTaskSequence
  };

  const startTime = Date.now();

  for (const sectionNum of sectionsToRun) {
    if (MAX_TASKS_LIMIT && results.totalRun >= MAX_TASKS_LIMIT) break;

    const sec = ALL_SECTIONS[sectionNum];
    if (!sec) { console.log(`\u26a0 Section ${sectionNum} not found`); continue; }

    console.log('\n' + '\u2550'.repeat(70));
    console.log(`\u{1f4e6} SECTION ${sectionNum}: ${sec.name.toUpperCase()}`);
    console.log('\u2550'.repeat(70));

    // Seed buggy files BEFORE running Section 4 tasks
    if (sectionNum === 4 && !DRY_RUN) {
      seedBuggyFiles();
    }

    // Run regular tasks
    await runTaskSequence(sec.tasks, results, sectionNum);

    // CTO decomposition for Section 1
    if (sectionNum === 1 && !SKIP_CTO && !DRY_RUN) {
      // Seed bug fix files before Section 4b but after section 3
      // handled separately below
      for (const brief of CTO_BRIEFS) {
        if (MAX_TASKS_LIMIT && results.totalRun >= MAX_TASKS_LIMIT) break;

        const generated = await runCTODecomposition(brief, results);
        if (generated === 0) {
          // Use fallback tasks
          console.log(`   Using ${brief.fallbackTasks.length} fallback tasks for ${brief.name}`);
          await runTaskSequence(brief.fallbackTasks.map(t => ({ ...t, section: 1 })), results, 1);
        }
      }
    } else if (sectionNum === 1 && !SKIP_CTO && DRY_RUN) {
      for (const brief of CTO_BRIEFS) {
        if (MAX_TASKS_LIMIT && results.totalRun >= MAX_TASKS_LIMIT) break;
        console.log(`\n\u{1f916} [DRY RUN] CTO Decomposition: ${brief.name} (5 fallback tasks)`);
        for (const ft of brief.fallbackTasks) {
          if (MAX_TASKS_LIMIT && results.totalRun >= MAX_TASKS_LIMIT) break;
          results.totalRun++;
          results.details.push({ task: ft.name, section: 1, category: ft.category, complexity: ft.complexity, status: 'dry_run', duration: 0 });
          console.log(`   [DRY RUN] ${ft.name} (C${ft.complexity})`);
        }
      }
    }

    // (buggy files already seeded at start of Section 4)
  }

  // === RETRY PHASE: process server-side retry queue ===
  if (asyncValidationAvailable && !DRY_RUN && !NO_RETRY) {
    console.log('\n' + '\u2550'.repeat(70));
    console.log('\u{1f504} RETRY PHASE — Processing server-side retry queue');
    console.log('\u2550'.repeat(70));

    // Wait for any pending validations to finish
    let waitCount = 0;
    while (waitCount < 30) {
      const valStatus = await getValidationStatus();
      if (!valStatus || valStatus.pending === 0) break;
      console.log(`   Waiting for ${valStatus.pending} pending validations...`);
      await sleep(1000);
      waitCount++;
    }

    const valStatus = await getValidationStatus();
    if (valStatus) {
      console.log(`   Validation summary: ${valStatus.passed} passed, ${valStatus.failed} failed, ${valStatus.retryQueueSize} in retry queue`);
    }

    if (valStatus && valStatus.retryQueueSize > 0) {
      console.log(`   Processing ${valStatus.retryQueueSize} failed validations...`);
      const retryResults = await processRetryQueue();

      if (retryResults) {
        console.log(`\n   Retry results: ${retryResults.saved} saved / ${retryResults.retried} retried`);

        // Update results with retries saved
        for (const detail of retryResults.details) {
          if (detail.savedAt) {
            // Find the failed task in results and flip it to passed
            const match = results.details.find(d => d.taskId === detail.taskId && d.status === 'failed');
            if (match) {
              match.status = 'passed';
              match.retryPhase = detail.savedAt;
              results.passed++;
              results.failed--;
              results.retriesSaved++;

              // Update complexity/category/section buckets
              if (results.byComplexity[match.complexity]) {
                results.byComplexity[match.complexity].passed++;
                results.byComplexity[match.complexity].failed--;
              }
              if (results.byCategory[match.category]) {
                results.byCategory[match.category].passed++;
                results.byCategory[match.category].failed--;
              }
              if (results.bySection[match.section]) {
                results.bySection[match.section].passed++;
                results.bySection[match.section].failed--;
              }

              console.log(`   \u2705 ${match.task} saved by ${detail.savedAt}`);
            }
          } else {
            console.log(`   \u274c ${detail.taskId.substring(0, 8)} still failing: ${(detail.finalError || '').substring(0, 60)}`);
          }
        }
      }
    } else {
      console.log('   No failed validations to retry.');
    }
  }

  const totalDuration = Math.floor((Date.now() - startTime) / 1000);

  printReport(results, totalDuration);

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const resultsFile = `scripts/ultimate-100-results-${timestamp}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify({
    ...results,
    totalDuration,
    successRate: results.totalRun > 0 ? Math.round((results.passed / results.totalRun) * 100) : 0,
    timestamp: new Date().toISOString(),
    config: {
      maxIterations: MAX_ITERATIONS,
      restDelay: REST_DELAY_MS,
      resetEvery: RESET_EVERY_N_TASKS,
      skipCto: SKIP_CTO,
      noRetry: NO_RETRY,
      sectionFilter: SECTION_FILTER,
      maxTasksLimit: MAX_TASKS_LIMIT,
      asyncValidation: asyncValidationAvailable
    }
  }, null, 2));
  console.log(`\n\u{1f4be} Results saved to ${resultsFile}`);

  return results;
}

main()
  .then(results => process.exit(results.failed + results.errors > 0 ? 1 : 0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
