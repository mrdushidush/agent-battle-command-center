/**
 * Create super easy tasks (complexity 0) for audio testing
 *
 * Run with: node scripts/create-easy-test-tasks.js
 */

const API_URL = 'http://localhost:3001/api';

const easyTasks = [
  {
    title: 'Add two numbers (2+2)',
    description: `Create a simple function that adds two numbers together.

Write a file: tasks/add_numbers.py

Code:
def add(a, b):
    return a + b

Validation: python -c "from tasks.add_numbers import add; assert add(2, 2) == 4; print('Success!')"`,
    taskType: 'code',
    requiredAgent: 'coder',
    priority: 3,
    maxIterations: 3,
  },
  {
    title: 'Create hello world function',
    description: `Create a function that returns "Hello, World!"

Write a file: tasks/hello.py

Code:
def hello():
    return "Hello, World!"

Validation: python -c "from tasks.hello import hello; assert hello() == 'Hello, World!'; print('Success!')"`,
    taskType: 'code',
    requiredAgent: 'coder',
    priority: 2,
    maxIterations: 2,
  },
  {
    title: 'Multiply function',
    description: `Create a simple multiply function.

Write a file: tasks/multiply.py

Code:
def multiply(a, b):
    return a * b

Validation: python -c "from tasks.multiply import multiply; assert multiply(3, 4) == 12; print('Success!')"`,
    taskType: 'code',
    requiredAgent: 'coder',
    priority: 3,
    maxIterations: 3,
  },
  {
    title: 'Get current timestamp',
    description: `Create a function that returns the current timestamp.

Write a file: tasks/timestamp.py

Code:
import time

def get_timestamp():
    return int(time.time())

Validation: python -c "from tasks.timestamp import get_timestamp; assert get_timestamp() > 0; print('Success!')"`,
    taskType: 'code',
    requiredAgent: 'coder',
    priority: 2,
    maxIterations: 2,
  },
  {
    title: 'Reverse a string',
    description: `Create a function that reverses a string.

Write a file: tasks/reverse.py

Code:
def reverse(text):
    return text[::-1]

Validation: python -c "from tasks.reverse import reverse; assert reverse('hello') == 'olleh'; print('Success!')"`,
    taskType: 'code',
    requiredAgent: 'coder',
    priority: 3,
    maxIterations: 2,
  },
  {
    title: 'Check if number is even',
    description: `Create a function that checks if a number is even.

Write a file: tasks/is_even.py

Code:
def is_even(n):
    return n % 2 == 0

Validation: python -c "from tasks.is_even import is_even; assert is_even(4) == True; assert is_even(3) == False; print('Success!')"`,
    taskType: 'code',
    requiredAgent: 'coder',
    priority: 2,
    maxIterations: 2,
  },
  {
    title: 'Get list length',
    description: `Create a function that returns the length of a list.

Write a file: tasks/list_length.py

Code:
def get_length(items):
    return len(items)

Validation: python -c "from tasks.list_length import get_length; assert get_length([1,2,3]) == 3; print('Success!')"`,
    taskType: 'code',
    requiredAgent: 'coder',
    priority: 1,
    maxIterations: 2,
  },
];

async function createTasks() {
  console.log('🎮 Creating easy test tasks for audio testing...\n');

  for (const task of easyTasks) {
    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ Created: ${task.title}`);
        console.log(`   ID: ${result.id}`);
        console.log(`   Listen for: "Conscript reporting!" or similar\n`);
      } else {
        console.error(`❌ Failed to create "${task.title}":`, result);
      }
    } catch (error) {
      console.error(`❌ Error creating "${task.title}":`, error.message);
    }
  }

  console.log('\n🎉 All tasks created!');
  console.log('🔊 Now watch the UI and listen for C&C sounds!');
  console.log('\n📋 Expected audio sequence:');
  console.log('1. Task assigned → "Aye commander!" or similar');
  console.log('2. Agent starts → "Operation underway!"');
  console.log('3. Iteration 2 → "Got the plans right here!"');
  console.log('4. Task done → "SHAKE IT BABY!" 🎉');
  console.log('\n💡 Tip: Open the Tool Log (⌨️ icon) to see agent actions!');
}

createTasks().catch(console.error);
