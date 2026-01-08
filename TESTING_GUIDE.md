# Stop Reordering Feature - Manual Testing Guide

## Quick Test in Chrome DevTools

### 1. Open Page
- Navigate to: http://localhost:5174/dispatches
- Press F12 to open DevTools

### 2. Check Edit Stops Button
Look for "Edit Stops" button on route cards
```javascript
// Console check:
document.querySelectorAll('button').forEach(b => 
  b.textContent.includes('Edit Stops') && console.log('✅ Found:', b)
);
```

### 3. Test Dialog Opens
Click "Edit Stops" → Dialog should open with stop list

### 4. Test Drag-and-Drop
- Drag stops to reorder
- Watch for Save/Cancel buttons to appear
- Verify visual feedback (colored borders, grab cursor)

### 5. Test Save Button
- Click Save → Check Network tab for PATCH request
- Endpoint: /api/dispatch/routes/:id/reorder
- Should send: { newJobOrder: [...] }

## Component Locations
- UI: frontend/src/components/maps/ReorderableStopsList.tsx
- Page: frontend/src/pages/DispatchesPage.tsx:579-616
- API: backend/src/modules/dispatch/dispatch.controller.ts:146-177
