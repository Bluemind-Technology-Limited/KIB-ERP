# KIB-ERP Onboarding System Integration Guide

## Overview

This guide explains how to integrate the onboarding tour system and welcome screens into your KIB-ERP application. The system provides role-specific onboarding experiences with interactive tours, help menus, and documentation.

---

## Files Created

### Core Onboarding Files

1. **`src/lib/tourSteps.ts`** - Tour step definitions
   - 6 role-specific tour flows
   - 50+ individual tour steps
   - Customizable styling and configuration

2. **`src/hooks/useTour.ts`** - Tour state management
   - Zustand store for persistent tour state
   - LocalStorage integration
   - Tour lifecycle management

3. **`src/components/Tour.tsx`** - Main tour component
   - Joyride integration wrapper
   - Custom tooltip styling
   - Callback handling

4. **`src/components/HeaderTourButton.tsx`** - Header help button
   - Help dropdown menu
   - Tour quick-start
   - Documentation links

5. **`src/components/WelcomeScreen.tsx`** - First-time user welcome
   - Role-specific welcome messages
   - Quick action suggestions
   - Tour initiation

6. **`src/styles/tour.css`** - Tour styling
   - KIB-themed styling
   - Responsive design
   - Accessibility features

### Documentation Files

7. **`ROLE_TASK_MAPPING.md`** - Role definitions
   - User role hierarchy
   - Permission matrix
   - Module access by role
   - Workflow descriptions
   - Daily checklists

8. **`SETUP_AND_USER_GUIDE.md`** - Complete user guide
   - System overview
   - Getting started guide
   - Module walkthroughs
   - Common workflows
   - Troubleshooting & FAQ

9. **`INTEGRATION_GUIDE.md`** - This file

---

## Installation Steps

### Step 1: Install Dependencies

```bash
cd kib-ERP
npm install
```

This installs `react-joyride` (added to package.json) along with other dependencies.

### Step 2: Import Tour Styles

Add to your main CSS file (e.g., `src/index.css` or `src/main.tsx`):

```typescript
import '../styles/tour.css';
import 'react-joyride/lib/react-joyride.css';
```

### Step 3: Add Tour to App Layout

Update your main layout component (e.g., `src/layouts/DashboardLayout.tsx`):

```typescript
import Tour from '../components/Tour';
import HeaderTourButton from '../components/HeaderTourButton';
import WelcomeScreen from '../components/WelcomeScreen';

export default function DashboardLayout() {
  const user = useAuthContext(); // Your auth context

  return (
    <>
      {/* Tour System */}
      <Tour userRole={user?.role} autoStart={!user?.hasSeenTour} />
      
      {/* Welcome Screen */}
      <WelcomeScreen 
        userName={user?.fullName}
        userRole={user?.role}
        onStartTour={() => {/* Handle tour start */}}
        onDismiss={() => {/* Mark as dismissed */}}
      />

      {/* Header with Tour Button */}
      <header className="flex items-center justify-between px-6 py-4">
        <div>/* Logo and navigation */</div>
        <div className="flex items-center gap-4">
          {/* Other header items */}
          <HeaderTourButton userRole={user?.role} />
        </div>
      </header>

      {/* Main content */}
      <main>
        {/* Your application content */}
      </main>
    </>
  );
}
```

### Step 4: Add Tour Anchor Classes

Add `tour-*` class names to key elements you want to highlight:

```typescript
// In BOM.tsx (Production module example)
<h2 className="tour-bom text-xl font-bold">Bill of Materials</h2>
<button className="tour-bom-create">Create BOM</button>

// In Materials.tsx (Master Data module example)
<button className="tour-master-data">Add Material</button>

// In your main dashboard
<div className="tour-dashboard">Dashboard Content</div>

// In your modules navigation
<nav className="tour-modules">Navigation Menu</nav>
<button className="tour-production-menu">Production</button>
<button className="tour-inventory-menu">Inventory</button>

// In your settings/profile area
<div className="tour-settings">Profile Settings</div>

// Additional important elements
<div className="tour-production">Production Section</div>
<div className="tour-inventory-readonly">Inventory View</div>
<div className="tour-kpis">KPI Dashboard</div>
<div className="tour-approvals">Approval Queue</div>
<div className="tour-reports">Reports Section</div>
```

### Step 5: Connect to User Authentication

Update your user context/store to track:

```typescript
interface User {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  hasSeenTour: boolean; // NEW: Track if user has completed tour
  // ... other fields
}

// After user completes tour:
await updateUser({ hasSeenTour: true });
```

### Step 6: Update Package.json

Verify `react-joyride` is in dependencies (already added):

```json
{
  "dependencies": {
    "react-joyride": "^2.7.2",
    // ... other dependencies
  }
}
```

---

## Usage

### Automatic Tour on First Login

```typescript
<Tour 
  userRole={user?.role} 
  autoStart={!user?.hasSeenTour}  // Auto-start on first visit
/>
```

### Manual Tour Trigger

```typescript
const { startTour } = useTour();

function startOnboardingTour() {
  startTour(userRole);
}
```

### Check Tour Status

```typescript
import { useTour } from '../hooks/useTour';

function MyComponent() {
  const { isRunning, hasSeenTour } = useTour();
  
  if (isRunning) {
    return <p>Tour is active - following steps...</p>;
  }
  
  return <p>Regular view</p>;
}
```

### Customize Tour Steps

Edit `src/lib/tourSteps.ts` to add/modify steps:

```typescript
export const TOUR_STEPS: Record<UserRole, Step[]> = {
  PRODUCTION_MANAGER: [
    {
      target: '.tour-welcome',
      content: (
        <>
          <h4>Custom Welcome Message</h4>
          <p>Your custom onboarding text here</p>
        </>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    // ... more steps
  ],
  // ... other roles
};
```

### Add New Documentation Links

Update `HeaderTourButton.tsx` to add documentation links:

```typescript
<a
  href="/documentation/my-section"
  onClick={() => setShowMenu(false)}
  className="w-full px-4 py-2.5 flex items-center gap-3 text-left text-sm text-[#171717] hover:bg-slate-50 transition-colors"
>
  <MyIcon className="w-4 h-4 text-indigo-600 shrink-0" />
  <div className="flex-1">
    <div className="font-semibold">Section Title</div>
    <div className="text-xs text-slate-500">Description</div>
  </div>
</a>
```

---

## Role-Based Tour Flows

### Tour Structure by Role

Each role gets a customized 8-10 step tour:

#### SUPER_ADMIN Tour
1. Welcome message
2. Dashboard overview
3. Module navigation
4. Master Data module
5. Production module
6. Admin module
7. Settings
8. Completion message

#### EXECUTIVE_ADMIN Tour
1. Welcome message
2. Dashboard overview
3. KPI monitoring
4. Approval queue
5. Reports & analytics
6. Inventory visibility
7. Settings
8. Completion message

#### PRODUCTION_MANAGER Tour
1. Welcome message
2. Dashboard overview
3. Production menu
4. BOM creation
5. BOM creation form
6. Production orders
7. Inventory check
8. Yield tracking
9. Settings
10. Completion message

#### STORE_OFFICER Tour
1. Welcome message
2. Dashboard overview
3. Inventory menu
4. Warehouse structure
5. Goods receipt (GRN)
6. GRN workflow
7. Stock movements
8. Requisitions
9. Expiry monitoring
10. Settings
11. Completion message

#### PROCUREMENT_OFFICER Tour
1. Welcome message
2. Dashboard overview
3. Procurement menu
4. Suppliers
5. Add supplier
6. Requisitions
7. Requisition approval
8. Purchase orders
9. PO tracking
10. Settings
11. Completion message

#### QA_INSPECTOR Tour
1. Welcome message
2. Dashboard overview
3. QA menu
4. Material inspection
5. Inspection workflow
6. Batch management
7. Batch actions
8. Traceability
9. Certificates
10. Settings
11. Completion message

---

## Styling Customization

### Update Tour Colors

Edit `src/lib/tourSteps.ts`:

```typescript
export const TOUR_CONFIG = {
  styles: {
    options: {
      primaryColor: '#EA4335', // Main color (KIB red)
      backgroundColor: '#fff',
      textColor: '#171717',
      // ... other colors
    },
  },
};
```

### Update Tour Messages

Edit `src/lib/tourSteps.ts` step content:

```typescript
{
  target: '.tour-production',
  content: (
    <>
      <h4 className="font-bold mb-2">Your Custom Title</h4>
      <p>Your custom message here</p>
    </>
  ),
  placement: 'bottom',
},
```

### Update Button Styles

Edit `src/styles/tour.css`:

```css
.kib-tour-btn-primary {
  background: #YOUR_COLOR;
  color: white;
  border: 1px solid #YOUR_COLOR;
}

.kib-tour-btn-primary:hover {
  background: #DARKER_COLOR;
  border-color: #DARKER_COLOR;
}
```

---

## Integration Checklist

### Before Deployment

- [ ] Install `react-joyride` package
- [ ] Import tour CSS files
- [ ] Add Tour component to main layout
- [ ] Add HeaderTourButton to header
- [ ] Add WelcomeScreen to layout
- [ ] Add `tour-*` anchor classes to key elements
- [ ] Update user model with `hasSeenTour` field
- [ ] Test tour on each role
- [ ] Verify localStorage persistence
- [ ] Test tour restart functionality
- [ ] Mobile responsive testing
- [ ] Accessibility testing (keyboard navigation, screen readers)

### Testing Checklist

#### Functional Tests
- [ ] Tour starts automatically on first login
- [ ] Tour skips on subsequent logins
- [ ] Help button shows menu
- [ ] "Take Tour" restarts tour
- [ ] "Exit Tour" stops tour
- [ ] All tour steps highlight correct elements
- [ ] Tour content displays correctly
- [ ] Next/Back buttons navigate properly
- [ ] Completion marks tour as seen

#### Role-Specific Tests
- [ ] SUPER_ADMIN sees admin-specific steps
- [ ] EXECUTIVE_ADMIN sees KPI steps
- [ ] PRODUCTION_MANAGER sees production steps
- [ ] STORE_OFFICER sees warehouse steps
- [ ] PROCUREMENT_OFFICER sees supplier steps
- [ ] QA_INSPECTOR sees inspection steps

#### User Experience Tests
- [ ] Tour tooltips don't block important UI
- [ ] Spotlight focuses correct elements
- [ ] Text is readable and helpful
- [ ] Buttons are easily clickable
- [ ] Mobile view is responsive
- [ ] Animations are smooth

#### Accessibility Tests
- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Screen reader announces steps
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] Skip Tour button accessible

---

## Troubleshooting

### Tour Not Starting

**Problem**: Tour doesn't start on first login

**Solution**:
1. Check `hasSeenTour` is tracked in user model
2. Verify `autoStart={!user?.hasSeenTour}` prop
3. Check browser console for errors
4. Verify Tour component is mounted before user loads

```typescript
// Debug log
console.log('User:', user?.email, 'Has seen tour:', user?.hasSeenTour);
console.log('Tour should start:', !user?.hasSeenTour);
```

### Anchor Classes Not Highlighting

**Problem**: Tour steps don't highlight elements

**Solution**:
1. Verify `tour-*` classes are on correct elements
2. Check that target selector matches class name
3. Use browser inspector to verify element exists
4. Check for CSS conflicts hiding elements

```typescript
// In tour steps, verify selector:
target: '.tour-bom', // Make sure this class exists on element

// In component:
<h2 className="tour-bom">Bill of Materials</h2>
```

### Styles Not Loading

**Problem**: Tour has no styling

**Solution**:
1. Verify CSS imports at top of `main.tsx`:
```typescript
import '../styles/tour.css';
import 'react-joyride/lib/react-joyride.css';
```
2. Check CSS file exists at path
3. Clear browser cache
4. Verify webpack/vite includes CSS

### LocalStorage Not Persisting

**Problem**: Tour state resets each refresh

**Solution**:
1. Check browser allows localStorage
2. Verify localStorage not disabled in settings
3. Check browser privacy mode (uses in-memory storage)
4. Use browser dev tools to verify localStorage:
```javascript
// In console:
localStorage.getItem('kib-tour-state')
```

### Tour Conflicts with Other Overlays

**Problem**: Tour spotlight conflicts with modals

**Solution**:
1. Ensure modals have higher z-index than tour (tour is 10000)
2. Set modal z-index appropriately:
```css
.modal {
  z-index: 20000; /* Higher than tour */
}
```
3. Consider disabling tour when modal open:
```typescript
const { stopTour } = useTour();

useEffect(() => {
  if (modalOpen) {
    stopTour();
  }
}, [modalOpen]);
```

---

## Performance Optimization

### Lazy Load Tour Component

```typescript
import { lazy, Suspense } from 'react';

const Tour = lazy(() => import('../components/Tour'));

export default function DashboardLayout() {
  return (
    <Suspense fallback={null}>
      <Tour userRole={user?.role} />
    </Suspense>
  );
}
```

### Defer Welcome Screen

```typescript
// Only show on first visit
const [showWelcome, setShowWelcome] = useState(!user?.hasSeenTour);

useEffect(() => {
  // Delay to avoid blocking initial render
  const timer = setTimeout(() => {
    setShowWelcome(!user?.hasSeenTour);
  }, 1000);
  return () => clearTimeout(timer);
}, [user?.hasSeenTour]);
```

### Cache Tour Steps

Tour steps are already memoized in `tourSteps.ts` as constants.

---

## Analytics & Tracking

### Track Tour Completion

```typescript
async function trackTourCompletion(role: string) {
  await fetch('/api/analytics/tour-completed', {
    method: 'POST',
    body: JSON.stringify({ role, timestamp: new Date() }),
  });
}

// In Tour component callback:
const handleJoyrideCallback = (data: CallBackProps) => {
  if (data.status === STATUS.FINISHED) {
    trackTourCompletion(userRole);
  }
};
```

### Track Tour Step Duration

```typescript
const stepStartTime = useRef<number>(null);

const handleJoyrideCallback = (data: CallBackProps) => {
  if (stepStartTime.current) {
    const duration = Date.now() - stepStartTime.current;
    trackStepDuration(data.index, duration);
  }
  stepStartTime.current = Date.now();
};
```

### Track Tour Abandonment

```typescript
const handleJoyrideCallback = (data: CallBackProps) => {
  if (data.status === STATUS.SKIPPED) {
    trackAbandonedAt(data.index, userRole);
  }
};
```

---

## Documentation

### Accessing Documentation In-App

Users can access documentation via:
1. Help button (?) → User Guide
2. Help button (?) → FAQ
3. Documentation links in footer
4. Embedded help text in modals

### Keeping Documentation Updated

When adding new features:
1. Update tour steps in `tourSteps.ts`
2. Update `SETUP_AND_USER_GUIDE.md`
3. Update `ROLE_TASK_MAPPING.md` if workflow changed
4. Add to FAQ if commonly asked

---

## Support & Maintenance

### Regular Maintenance

- Review tour completion metrics monthly
- Update tour steps based on UI changes
- Refresh documentation quarterly
- Monitor support tickets for tour feedback
- A/B test different tour variations

### User Feedback

Collect feedback on tour effectiveness:
- "Was the tour helpful?" survey
- Track which steps users skip
- Monitor support tickets mentioning tour
- Gather user suggestions for improvements

### Version Control

Track tour changes:
- Update version in `SETUP_AND_USER_GUIDE.md`
- Document breaking changes
- Maintain backwards compatibility
- Clear localStorage on major updates if needed:

```typescript
// In migration code
if (appVersion > lastSeenTourVersion) {
  localStorage.removeItem('kib-tour-state');
  // Force re-take tour
}
```

---

## Next Steps

1. **Install & Test**: Follow installation steps above
2. **Customize**: Edit tour steps for your specific workflows
3. **Deploy**: Test on staging environment
4. **Monitor**: Track tour completion metrics
5. **Iterate**: Gather feedback and improve based on usage

---

## FAQ for Integration

**Q: Can multiple users see different tours?**
A: Yes! Each role has a customized tour. Tours are role-specific.

**Q: How do I reset tour for a user?**
A: Click "Take Tour" in help menu, or clear their localStorage entry `kib-tour-state`.

**Q: Can I make tour optional?**
A: Yes, set `autoStart={false}` and let users start via help menu.

**Q: Does tour work on mobile?**
A: Yes, tour is responsive. Elements scale appropriately.

**Q: How do I track tour effectiveness?**
A: Implement analytics hooks (see Analytics section above).

**Q: Can tour steps link to documentation?**
A: Not directly, but help menu has doc links. Consider adding in tour content.

**Q: How often should I update tour?**
A: Update whenever UI significantly changes or workflows updated.

---

## Support

For questions about integration:
1. Check this guide's FAQ and Troubleshooting sections
2. Review `SETUP_AND_USER_GUIDE.md` for user-facing help
3. Check `ROLE_TASK_MAPPING.md` for workflow context
4. Review tour step definitions in `tourSteps.ts`
5. Contact development team with specific issues

