# CSS Cache Fix Instructions

## Changes Made
1. **Improved Cache-Busting**: Added random string to CSS version parameter for more aggressive cache-busting
2. **Added Visible Test Changes**: 
   - Gold border on top of header (3px solid)
   - Gold border on left of comp card (4px solid)
3. **Enhanced Server Cache Headers**: Added max-age=0 to cache-control headers

## To See Changes

### Step 1: Restart Your Server
```bash
# Stop your current server (Ctrl+C)
# Then restart it
npm start
# or
node src/app.js
```

### Step 2: Hard Refresh Browser
- **Mac**: `Cmd + Shift + R`
- **Windows/Linux**: `Ctrl + Shift + R`
- **Or**: Open DevTools (F12) → Right-click refresh button → "Empty Cache and Hard Reload"

### Step 3: Verify Test Changes Are Visible
You should see:
- A **gold border on top of the header** (3px)
- A **gold border on the left side of the comp card** (4px)

If you see these borders, CSS is loading correctly and all other changes should be visible.

### Step 4: Clear Browser Cache (If Still Not Working)
1. Open DevTools (F12)
2. Go to Application/Storage tab
3. Click "Clear site data"
4. Or use Incognito/Private window

### Step 5: Check Browser Console
- Open DevTools (F12) → Console tab
- Look for any CSS loading errors
- Check Network tab to see if CSS file is loading with new version parameter

## If Changes Still Don't Appear
1. Check that server is running and restarted
2. Verify you're accessing `http://localhost:3000` (not a cached IP)
3. Try a different browser
4. Check browser console for errors
5. Verify the CSS file path in Network tab shows the version parameter

## After Verification
Once you confirm the test borders are visible, we can remove them and keep the improved cache-busting.
