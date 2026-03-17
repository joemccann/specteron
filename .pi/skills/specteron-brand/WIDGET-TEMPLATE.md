# Specteron Widget Template — Working Reference

This template contains the **exact patterns** that work correctly for `show_widget` calls. Use this as the canonical reference.

## Critical Lessons Learned

### 1. Theme Initialization — MUST Run Immediately
The theme must be set **before** the DOM renders to avoid flash of wrong theme:

```html
<script>
(function(){
  var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
  var saved=localStorage.getItem('specteron-theme');
  document.documentElement.setAttribute('data-theme',saved||(prefersDark?'dark':'light'));
})();
</script>
```

Place this **immediately after** the `<style>` block, **before** any HTML content.

### 2. SVG Icons — Use innerHTML Injection, Not Hidden Elements
Don't embed SVGs with `display:none` and toggle visibility — it doesn't work reliably. Instead:

1. Create an empty SVG container in HTML
2. Inject the path content via JavaScript after DOM loads

```html
<!-- In HTML -->
<button class="theme-toggle" id="toggle">
  <svg id="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"></svg>
</button>
```

```javascript
// In script at end
var icon=document.getElementById('icon');
var sunPath='<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
var moonPath='<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
function update(){
  var t=document.documentElement.getAttribute('data-theme');
  icon.innerHTML=t==='dark'?sunPath:moonPath;
}
update(); // Call immediately to set initial icon
```

### 3. Use `!important` for Critical Brand Colors
The morphdom diffing and CSS specificity can override styles. Use `!important` for:

```css
tbody tr{border-left:2px solid #05AD98 !important;}
.subject a{color:#05AD98 !important;}
.subject a:hover{color:#0FCFB5 !important;}
```

### 4. Hardcode Hex Values for Critical Colors
Don't rely solely on CSS variables for the accent color — hardcode `#05AD98` directly:

```css
.badge{background:#05AD98;color:#fff;}
tbody tr{border-left:2px solid #05AD98 !important;}
.subject a{color:#05AD98 !important;}
```

### 5. Use Simple IDs, Not Complex Selectors
```html
<!-- Good -->
<button id="toggle">
<svg id="icon">

<!-- Avoid -->
<button class="theme-toggle" aria-label="Toggle theme">
```

### 6. Script Structure — Two Scripts
1. **First script** (inline, after styles, before HTML): Initialize theme immediately
2. **Second script** (at end, after HTML): Set up interactivity

---

## Complete Working Template

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{--font-sans:'Inter',system-ui,sans-serif;--font-mono:'IBM Plex Mono',monospace;}
[data-theme="dark"]{--bg-base:#0a0f14;--bg-panel:#0f1519;--bg-hover:#151c22;--border-dim:#1e293b;--text-primary:#e2e8f0;--text-secondary:#94a3b8;--text-muted:#475569;--accent:#05AD98;--signal-strong:#0FCFB5;}
[data-theme="light"]{--bg-base:#FFFFFF;--bg-panel:#FFFFFF;--bg-hover:#F1F5F9;--border-dim:#BBBFBF;--text-primary:#000000;--text-secondary:#636363;--text-muted:#878787;--accent:#05AD98;--signal-strong:#048A7A;}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{height:100%;font-family:var(--font-sans);background:var(--bg-base);color:var(--text-primary);}
.container{background:var(--bg-panel);border:1px solid var(--border-dim);border-radius:4px;margin:12px;height:calc(100% - 24px);display:flex;flex-direction:column;overflow:hidden;}
.header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border-dim);flex-shrink:0;}
.header h1{font-size:18px;font-weight:600;color:var(--text-primary);}
.header-center{font-family:var(--font-mono);font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.03em;color:var(--text-muted);}
.header-right{display:flex;align-items:center;gap:10px;}
.badge{background:#05AD98;color:#fff;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:0.05em;}
.theme-toggle{background:var(--bg-hover);border:1px solid var(--border-dim);border-radius:999px;cursor:pointer;color:var(--text-secondary);display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;}
.theme-toggle:hover{background:var(--border-dim);}
.count{padding:10px 18px;font-size:14px;color:var(--text-secondary);border-bottom:1px solid var(--border-dim);flex-shrink:0;}
.table-wrapper{flex:1;overflow:auto;}
table{width:100%;border-collapse:collapse;}
th{background:var(--bg-panel);text-transform:uppercase;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;letter-spacing:0.1em;color:var(--text-muted);text-align:left;padding:10px 14px;border-bottom:1px solid var(--border-dim);}
td{padding:12px 14px;border-bottom:1px solid var(--border-dim);vertical-align:top;}
tbody tr{border-left:2px solid #05AD98 !important;background:var(--bg-panel);}
tbody tr:hover{background:var(--bg-hover);}
.sender{font-size:13px;font-weight:600;color:var(--text-primary);}
.subject a{font-size:13px;font-weight:500;color:#05AD98 !important;text-decoration:none;}
.subject a:hover{color:#0FCFB5 !important;}
.summary{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-secondary);line-height:1.4;}
.time{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:500;color:var(--text-muted);white-space:nowrap;}
.footer{padding:12px 18px;background:var(--bg-panel);border-top:1px solid var(--border-dim);text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.03em;color:var(--text-muted);text-transform:uppercase;}
</style>
<script>
(function(){
  var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
  var saved=localStorage.getItem('specteron-theme');
  document.documentElement.setAttribute('data-theme',saved||(prefersDark?'dark':'light'));
})();
</script>
<div class="container">
  <div class="header">
    <h1>Widget Title</h1>
    <div class="header-center">STATUS TEXT HERE</div>
    <div class="header-right">
      <span class="badge">BADGE</span>
      <button class="theme-toggle" id="toggle">
        <svg id="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"></svg>
      </button>
    </div>
  </div>
  <div class="count">Subtitle / count line</div>
  <div class="table-wrapper">
    <table>
      <thead><tr>
        <th>Column 1</th>
        <th>Column 2</th>
        <th>Column 3</th>
        <th>Column 4</th>
      </tr></thead>
      <tbody>
        <tr>
          <td class="sender">Cell 1</td>
          <td class="subject"><a href="#">Link text</a></td>
          <td class="summary">Description text</td>
          <td class="time">Timestamp</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="footer">Footer text</div>
</div>
<script>
(function(){
  var icon=document.getElementById('icon');
  var toggle=document.getElementById('toggle');
  var sunPath='<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  var moonPath='<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  function update(){
    var t=document.documentElement.getAttribute('data-theme');
    icon.innerHTML=t==='dark'?sunPath:moonPath;
  }
  update();
  toggle.onclick=function(){
    var t=document.documentElement.getAttribute('data-theme');
    var next=t==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',next);
    localStorage.setItem('specteron-theme',next);
    update();
  };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(e){
    if(!localStorage.getItem('specteron-theme')){
      document.documentElement.setAttribute('data-theme',e.matches?'dark':'light');
      update();
    }
  });
})();
</script>
```

---

## Checklist Before Generating Any Widget

- [ ] First `<script>` block sets theme immediately (IIFE, before HTML)
- [ ] Theme toggle button uses empty `<svg id="icon">` with innerHTML injection
- [ ] `!important` on `border-left`, link `color`, and link hover `color`
- [ ] Hardcoded `#05AD98` for badge background and accent colors
- [ ] Simple IDs (`id="toggle"`, `id="icon"`) not complex selectors
- [ ] Second `<script>` at end calls `update()` immediately after defining it
- [ ] OS theme change listener included
- [ ] `[data-theme="dark"]` and `[data-theme="light"]` selectors (not `:root`)
