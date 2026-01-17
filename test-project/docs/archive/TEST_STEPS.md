# How to Test the Test Project

## Quick Test (One Command)

```bash
cd /home/gp/Projects/markopress/test-project
./test-all.sh
```

This will:
1. Clean previous build
2. Build the project
3. Verify static HTML was generated
4. Show HTML preview
5. Start preview server

## Manual Testing Steps

### Step 1: Navigate to Test Project

```bash
cd /home/gp/Projects/markopress/test-project
```

### Step 2: Build the Project

```bash
npx marko-run build
```

**Expected Output:**
```
┌────────┬──────┬───────┬───────────┐
│ METHOD │ PATH │ ENTRY │ SIZE/GZIP │
├────────┼──────┼───────┼───────────┤
│ GET    │ /    │ page  │    0.0 kB │
└────────┴──────┴───────┴───────────┘
```

### Step 3: Verify Static HTML

```bash
ls -lh dist/public/
```

**Should see:**
```
index.html
```

### Step 4: View the HTML

```bash
cat dist/public/index.html
```

Or pretty print:
```bash
cat dist/public/index.html | sed 's/></>\n</g'
```

### Step 5: Preview the Site

**Option A: Use marko-run preview**
```bash
npx marko-run preview
```
Then open: http://localhost:4173

**Option B: Use a simple HTTP server**
```bash
python3 -m http.server 8080 --directory dist/public
```
Then open: http://localhost:8080

**Option C: Open directly in browser**
```bash
# Linux
xdg-open dist/public/index.html

# macOS
open dist/public/index.html
```

## Testing Different Scenarios

### Test 1: Verify Custom Content Directory

Check that content was loaded from `my-content/`:

```bash
node -e "
import { loadConfig } from '/home/gp/Projects/markopress/packages/markopress/dist/config/loader.js';
const config = await loadConfig(process.cwd());
console.log('Content directories:', config.content);
"
```

**Expected:**
```
Content directories: {
  pages: 'my-content/pages',
  docs: 'my-content/docs',
  blog: 'my-content/blog'
}
```

### Test 2: Verify Static Adapter

Check the HTML is properly generated:

```bash
grep -o "<title>.*</title>" dist/public/index.html
```

**Expected:**
```
<title>MarkoPress Test Site</title>
```

### Test 3: Test Multiple Routes (If Added)

Create additional routes:

```bash
# Create about page
mkdir -p src/routes
cat > src/routes/about.marko << 'EOF'
<!DOCTYPE html>
<html>
<head><title>About</title></head>
<body><h1>About Page</h1></body>
</html>
EOF

# Rebuild
npx marko-run build

# Check both files exist
ls -lh dist/public/
```

### Test 4: Check Build Size

```bash
du -sh dist/public/
```

### Test 5: Validate HTML

```bash
which tidy && tidy -eq dist/public/index.html
```

## Development Workflow

### Watch Mode (For Development)

```bash
# Terminal 1: Start dev server
npx marko-run dev

# Terminal 2: Make changes to routes
# The site will auto-reload
```

### Build + Preview Workflow

```bash
# Build
npx marko-run build

# Preview
npx marko-run preview

# Open in browser
xdg-open http://localhost:4173
```

## Troubleshooting

### Issue: "No routes found"

**Solution:** Make sure route files exist in `src/routes/`

```bash
ls -la src/routes/
```

Should show at least `+page.marko`

### Issue: Build succeeds but no HTML

**Check:**
```bash
# Is static adapter in vite.config?
grep -A 3 "adapter" vite.config.ts

# Should show: adapter: staticAdapter()
```

### Issue: Port already in use

**Use different port:**
```bash
npx marko-run preview --port 3000
```

## Test Checklist

Run through this checklist:

- [ ] Build completes without errors
- [ ] `dist/public/index.html` exists
- [ ] HTML contains expected content
- [ ] Preview server starts successfully
- [ ] Site loads in browser at http://localhost:4173
- [ ] Custom content directory (`my-content/`) is being used

## Quick Test Commands Reference

```bash
# Build
npx marko-run build

# Preview
npx marko-run preview

# Dev server
npx marko-run dev

# Check output
ls -lh dist/public/

# View HTML
cat dist/public/index.html

# Run all tests
./test-all.sh

# Open in browser
xdg-open dist/public/index.html  # Linux
open dist/public/index.html      # macOS
```

## Success Indicators

✅ **Build completes** - No error messages
✅ **HTML generated** - File exists at `dist/public/index.html`
✅ **Content correct** - HTML contains your content
✅ **Preview works** - Can view at http://localhost:4173
✅ **Custom dirs work** - Content loaded from `my-content/`
