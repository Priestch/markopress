# Interactive Components

Build interactive UI components with Marko's powerful reactivity system.

## Overview

MarkoPress is built on Marko.js v6, which provides a powerful reactive component system. This guide shows you how to build interactive components with:

- **State management** - Reactive data that updates the UI
- **Event handling** - Respond to user interactions
- **Forms & validation** - Collect and validate user input
- **Animations** - Smooth transitions and effects
- **Data fetching** - Load data from APIs

## State Management

Marko's reactive state system automatically updates your UI when data changes.

### Basic State

```marko
class {
  onCreate() {
    this.state = {
      count: 0,
      message: 'Hello, World!',
    };
  }

  increment() {
    this.state.count++;
  }
}

<div>
  <h1>${state.message}</h1>
  <p>Count: ${state.count}</p>
  <button onClick=>increment()>Increment</button>
</div>
```

### Computed State

```marko
class {
  onCreate() {
    this.state = {
      firstName: 'John',
      lastName: 'Doe',
    };
  }

  get fullName() {
    return `${this.state.firstName} ${this.state.lastName}`;
  }
}

<div>
  <p>Full name: ${fullName}</p>
</div>
```

### State from Props

```marko
class {
  onCreate() {
    this.state = {
      expanded: input.initiallyExpanded || false,
    };
  }

  toggle() {
    this.state.expanded = !this.state.expanded;
  }
}

<div class=${['accordion', { expanded: state.expanded }]}>
  <button onClick=>toggle()>
    ${state.expanded ? 'Collapse' : 'Expand'}
  </button>
  <if(state.expanded)>
    <p>${input.content}</p>
  </if>
</div>
```

## Event Handling

Marko provides easy-to-use event handlers for all DOM events.

### Click Events

```marko
class {
  handleClick() {
    alert('Button clicked!');
  }

  handleDoubleClick() {
    console.log('Double clicked!');
  }
}

<button onClick=>handleClick()>
  Click Me
</button>

<button onDblClick=>handleDoubleClick()>
  Double Click Me
</button>
```

### Input Events

```marko
class {
  onCreate() {
    this.state = {
      text: '',
      email: '',
    };
  }

  handleTextInput(e) {
    this.state.text = e.target.value;
  }

  handleEmailInput(e) {
    this.state.email = e.target.value;
  }

  handleSubmit() {
    console.log({
      text: this.state.text,
      email: this.state.email,
    });
  }
}

<div>
  <input type="text" value=state.text onInput=>handleTextInput(e) />
  <p>You typed: ${state.text}</p>

  <input type="email" value=state.email onInput=>handleEmailInput(e) />
  <p>Email: ${state.email}</p>

  <button onClick=>handleSubmit()>Submit</button>
</div>
```

### Keyboard Events

```marko
class {
  handleKeyDown(e) {
    if (e.key === 'Enter') {
      console.log('Enter pressed!');
    }
  }

  handleKeyPress(e) {
    console.log(`Key pressed: ${e.key}`);
  }

  handleKeyUp(e) {
    console.log(`Key released: ${e.key}`);
  }
}

<input
  type="text"
  onKeyDown=>handleKeyDown(e)
  onKeyPress=>handleKeyPress(e)
  onKeyUp=>handleKeyUp(e)
/>
```

### Mouse Events

```marko
class {
  handleMouseEnter() {
    console.log('Mouse entered');
  }

  handleMouseLeave() {
    console.log('Mouse left');
  }

  handleMouseMove(e) {
    console.log(`Mouse position: ${e.clientX}, ${e.clientY}`);
  }
}

<div
  onMouseEnter=>handleMouseEnter()
  onMouseLeave=>handleMouseLeave()
  onMouseMove=>handleMouseMove(e)
>
  Hover over me!
</div>
```

## Forms

Build interactive forms with validation and state management.

### Controlled Inputs

```marko
class {
  onCreate() {
    this.state = {
      name: '',
      email: '',
      message: '',
      subscribed: false,
    };
  }

  handleSubmit(e) {
    e.preventDefault();
    console.log(this.state);
  }
}

<form onSubmit=>handleSubmit(e)>
  <div class="form-group">
    <label>Name</label>
    <input
      type="text"
      value=state.name
      onInput=>state.name = e.target.value
    />
  </div>

  <div class="form-group">
    <label>Email</label>
    <input
      type="email"
      value=state.email
      onInput=>state.email = e.target.value
    />
  </div>

  <div class="form-group">
    <label>Message</label>
    <textarea
      value=state.message
      onInput=>state.message = e.target.value
    />
  </div>

  <div class="form-group">
    <label>
      <input
        type="checkbox"
        checked=state.subscribed
        onChange=>state.subscribed = e.target.checked
      />
      Subscribe to newsletter
    </label>
  </div>

  <button type="submit">Submit</button>
</form>
```

### Form Validation

```marko
class {
  onCreate() {
    this.state = {
      email: '',
      password: '',
      errors: {},
    };
  }

  validate() {
    const errors = {};

    if (!this.state.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(this.state.email)) {
      errors.email = 'Invalid email format';
    }

    if (!this.state.password) {
      errors.password = 'Password is required';
    } else if (this.state.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    this.state.errors = errors;
    return Object.keys(errors).length === 0;
  }

  handleSubmit(e) {
    e.preventDefault();

    if (this.validate()) {
      console.log('Form is valid!', this.state);
    }
  }
}

<form onSubmit=>handleSubmit(e)>
  <div class="form-group">
    <label>Email</label>
    <input
      type="email"
      value=state.email
      onInput=>state.email = e.target.value
    />
    <if(state.errors.email)>
      <span class="error">${state.errors.email}</span>
    </if>
  </div>

  <div class="form-group">
    <label>Password</label>
    <input
      type="password"
      value=state.password
      onInput=>state.password = e.target.value
    />
    <if(state.errors.password)>
      <span class="error">${state.errors.password}</span>
    </if>
  </div>

  <button type="submit">Sign In</button>
</form>
```

### Radio Buttons & Selects

```marko
class {
  onCreate() {
    this.state = {
      plan: 'free',
      country: 'us',
      notifications: 'instant',
    };
  }
}

<div>
  <h3>Select a Plan</h3>
  <label>
    <input
      type="radio"
      name="plan"
      value="free"
      checked=state.plan === 'free'
      onChange=>state.plan = 'free'
    />
    Free
  </label>
  <label>
    <input
      type="radio"
      name="plan"
      value="pro"
      checked=state.plan === 'pro'
      onChange=>state.plan = 'pro'
    />
    Pro
  </label>
  <label>
    <input
      type="radio"
      name="plan"
      value="enterprise"
      checked=state.plan === 'enterprise'
      onChange=>state.plan = 'enterprise'
    />
    Enterprise
  </label>

  <h3>Country</h3>
  <select value=state.country onChange=>state.country = e.target.value>
    <option value="us">United States</option>
    <option value="uk">United Kingdom</option>
    <option value="ca">Canada</option>
    <option value="au">Australia</option>
  </select>
</div>
```

## Conditional Rendering

Show or hide content based on state or props.

### If/Else

```marko
class {
  onCreate() {
    this.state = {
      isLoggedIn: false,
      user: null,
    };
  }

  login() {
    this.state.isLoggedIn = true;
    this.state.user = { name: 'John' };
  }

  logout() {
    this.state.isLoggedIn = false;
    this.state.user = null;
  }
}

<div>
  <if(state.isLoggedIn)>
    <p>Welcome, ${state.user.name}!</p>
    <button onClick=>logout()>Logout</button>
  <else/>
    <p>Please log in</p>
    <button onClick=>login()>Login</button>
  </if>
</div>
```

### Ternary Operator

```marko
<div>
  <p>${state.isLoggedIn ? `Welcome, ${state.user.name}` : 'Please log in'}</p>
</div>
```

### Show/Hide Pattern

```marko
class {
  onCreate() {
    this.state = {
      modalOpen: false,
    };
  }

  openModal() {
    this.state.modalOpen = true;
  }

  closeModal() {
    this.state.modalOpen = false;
  }
}

<div>
  <button onClick=>openModal()>Open Modal</button>

  <if(state.modalOpen)>
    <div class="modal-overlay" onClick=>closeModal()>
      <div class="modal">
        <h2>Modal Title</h2>
        <p>Modal content goes here...</p>
        <button onClick=>closeModal()>Close</button>
      </div>
    </div>
  </if>
</div>
```

## Lists & Iteration

Render lists of data with Marko's `<for>` tag.

### Basic List

```marko
class {
  onCreate() {
    this.state = {
      items: ['Apple', 'Banana', 'Orange'],
    };
  }
}

<div>
  <ul>
    <for|item| of=state.items>
      <li>${item}</li>
    </for>
  </ul>
</div>
```

### List with Index

```marko
<ul>
  <for|item, index| of=state.items>
    <li>${index + 1}. ${item}</li>
  </for>
</ul>
```

### Dynamic List

```marko
class {
  onCreate() {
    this.state = {
      todos: [
        { id: 1, text: 'Learn Marko', done: false },
        { id: 2, text: 'Build something', done: false },
      ],
      newTodoText: '',
    };
  }

  addTodo() {
    if (!this.state.newTodoText.trim()) return;

    this.state.todos = [
      ...this.state.todos,
      {
        id: Date.now(),
        text: this.state.newTodoText,
        done: false,
      },
    ];
    this.state.newTodoText = '';
  }

  toggleTodo(id) {
    this.state.todos = this.state.todos.map(todo =>
      todo.id === id ? { ...todo, done: !todo.done } : todo
    );
  }

  deleteTodo(id) {
    this.state.todos = this.state.todos.filter(todo => todo.id !== id);
  }
}

<div>
  <input
    type="text"
    value=state.newTodoText
    placeholder="New todo..."
    onInput=>state.newTodoText = e.target.value
  />
  <button onClick=>addTodo()>Add</button>

  <ul>
    <for|todo| of=state.todos>
      <li class=${{ done: todo.done }}>
        <input
          type="checkbox"
          checked=todo.done
          onChange=>toggleTodo(todo.id)
        />
        <span>${todo.text}</span>
        <button onClick=>deleteTodo(todo.id)>Delete</button>
      </li>
    </for>
  </ul>
</div>
```

## Animations & Transitions

Add smooth animations with CSS and Marko's reactivity.

### CSS Transitions

```marko
class {
  onCreate() {
    this.state = {
      visible: true,
    };
  }

  toggle() {
    this.state.visible = !this.state.visible;
  }
}

<style>`
  .box {
    width: 100px;
    height: 100px;
    background: var(--accent-color);
    transition: all 0.3s ease;
    opacity: 1;
    transform: scale(1);
  }

  .box.hidden {
    opacity: 0;
    transform: scale(0.8);
  }
`</style>

<div>
  <button onClick=>toggle()>Toggle</button>
  <div class=${['box', { hidden: !state.visible }]}>
    Animated Box
  </div>
</div>
```

### Animated Counter

```marko
class {
  onCreate() {
    this.state = {
      count: 0,
    };
  }

  increment() {
    // Animate the count
    const start = this.state.count;
    const end = start + 1;
    const duration = 300;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      this.state.count = start + (end - start) * easeProgress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }
}

<div>
  <p>Count: ${Math.round(state.count)}</p>
  <button onClick=>increment()>Increment</button>
</div>
```

## Data Fetching

Load data from APIs asynchronously.

### Basic Fetch

```marko
class {
  onCreate() {
    this.state = {
      data: null,
      loading: true,
      error: null,
    };

    this.fetchData();
  }

  async fetchData() {
    try {
      const response = await fetch('https://api.example.com/data');
      const data = await response.json();
      this.state.data = data;
    } catch (error) {
      this.state.error = error.message;
    } finally {
      this.state.loading = false;
    }
  }
}

<div>
  <if(state.loading)>
    <p>Loading...</p>
  <else-if(state.error)>
    <p>Error: ${state.error}</p>
  <else/>
    <pre>${JSON.stringify(state.data, null, 2)}</pre>
  </if>
</div>
```

### Search with Debounce

```marko
class {
  onCreate() {
    this.state = {
      query: '',
      results: [],
      loading: false,
    };
    this.timeout = null;
  }

  search() {
    clearTimeout(this.timeout);

    if (!this.state.query.trim()) {
      this.state.results = [];
      return;
    }

    this.state.loading = true;

    this.timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://api.example.com/search?q=${encodeURIComponent(this.state.query)}`
        );
        const results = await response.json();
        this.state.results = results;
      } catch (error) {
        console.error(error);
      } finally {
        this.state.loading = false;
      }
    }, 300);
  }

  onQueryChange(e) {
    this.state.query = e.target.value;
    this.search();
  }
}

<div>
  <input
    type="text"
    value=state.query
    placeholder="Search..."
    onInput=>onQueryChange(e)
  />

  <if(state.loading)>
    <p>Searching...</p>
  <else/>
    <ul>
      <for|result| of=state.results>
        <li>${result.title}</li>
      </for>
    </ul>
  </if>
</div>
```

## Best Practices

### 1. Keep Components Small

```marko
// ❌ Bad: Large component
class {
  // 500 lines of code
}

// ✅ Good: Small, focused components
class {
  // 50 lines of code
}
```

### 2. Use Props for Configuration

```marko
// ✅ Good: Configurable via props
<components.Button
  text="Click Me"
  variant="primary"
  size="large"
/>
```

### 3. Handle Loading States

```marko
class {
  async loadData() {
    this.state.loading = true;
    this.state.error = null;

    try {
      this.state.data = await fetchData();
    } catch (error) {
      this.state.error = error;
    } finally {
      this.state.loading = false;
    }
  }
}
```

### 4. Clean Up Side Effects

```marko
class {
  onCreate() {
    this.interval = setInterval(() => {
      console.log('Tick');
    }, 1000);
  }

  onDestroy() {
    clearInterval(this.interval);
  }
}
```

## Examples

See the MarkoPress source code for more examples:

- [Default Theme](https://github.com/markopress/theme-default)
- [Component Library](https://github.com/markopress/components)
- [Example Sites](https://github.com/markopress/examples)

## Next Steps

- 🎨 Learn about [Theming](./theming.md)
- 🔌 Build [Plugins](./plugins.md)
- 📖 Read [API Reference](./api.md)
